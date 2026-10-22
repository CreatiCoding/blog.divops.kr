package main

import (
	"crypto/rand"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

func uuidV4() string {
	b := make([]byte, 16)
	rand.Read(b)
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

// todayUTC 는 JS 의 new Date().toISOString().slice(0, 10) 이다.
func todayUTC() string {
	return time.Now().UTC().Format("2006-01-02")
}

// track: 페이지뷰 기록 + 하루 방문자(vid 쿠키) 기록. 예전 /api/track 과 같다.
func (s *server) track(w http.ResponseWriter, r *http.Request) {
	visitorID := ""
	if c, err := r.Cookie("vid"); err == nil {
		visitorID = c.Value
	}
	isNew := visitorID == ""
	if isNew {
		visitorID = uuidV4()
	}
	body, err := decodeBody(r)
	if err != nil {
		jsonError(w, 500, "Tracking failed")
		return
	}
	path, ok := body["path"].(string)
	if !ok || path == "" {
		jsonError(w, 400, "Invalid path")
		return
	}
	var ua, ref *string
	if v := r.Header.Get("User-Agent"); v != "" {
		ua = &v
	}
	if v := r.Header.Get("Referer"); v != "" && !strings.Contains(v, "blog.divops.kr") {
		ref = &v
	}
	ctx := r.Context()
	if _, err := s.db.Exec(ctx, `INSERT INTO site_visit (visitor_id, visited_date) VALUES ($1, $2) ON CONFLICT DO NOTHING`, visitorID, todayUTC()); err != nil {
		log.Printf("track site_visit: %v", err)
		jsonError(w, 500, "Tracking failed")
		return
	}
	if _, err := s.db.Exec(ctx, `INSERT INTO page_view (id, path, "userAgent", referrer, "createdAt") VALUES ($1, $2, $3, $4, $5)`,
		newID(), path, ua, ref, nowMs()); err != nil {
		log.Printf("track page_view: %v", err)
		jsonError(w, 500, "Tracking failed")
		return
	}
	if isNew {
		http.SetCookie(w, &http.Cookie{
			Name: "vid", Value: visitorID, Path: "/", MaxAge: 365 * 24 * 60 * 60,
			Expires: time.Now().Add(365 * 24 * time.Hour), SameSite: http.SameSiteLaxMode,
		})
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (s *server) visitorCounts(r *http.Request) (total, today int, err error) {
	err = s.db.QueryRow(r.Context(), `
		SELECT (SELECT count(DISTINCT visitor_id) FROM site_visit),
		       (SELECT count(DISTINCT visitor_id) FROM site_visit WHERE visited_date = $1)`, todayUTC()).Scan(&total, &today)
	return
}

func (s *server) visitorStats(w http.ResponseWriter, r *http.Request) {
	total, today, err := s.visitorCounts(r)
	if err != nil {
		log.Printf("visitorStats: %v", err)
		total, today = 0, 0
	}
	writeJSON(w, 200, map[string]int{"total": total, "today": today})
}

type countRow struct {
	key   string
	count int
}

func (s *server) adminStats(w http.ResponseWriter, r *http.Request) {
	if s.currentSession(r, w) == nil {
		jsonError(w, 401, "Unauthorized")
		return
	}
	total, today, err := s.visitorCounts(r)
	if err != nil {
		log.Printf("adminStats: %v", err)
		jsonError(w, 500, "Internal Server Error")
		return
	}
	ctx := r.Context()
	since := time.Now().UTC().Add(-30 * 24 * time.Hour).Format("2006-01-02")

	type daily struct {
		Date  string `json:"date"`
		Count int    `json:"count"`
	}
	dailyVisitors := []daily{}
	rows, err := s.db.Query(ctx, `SELECT to_char(visited_date, 'YYYY-MM-DD'), count(DISTINCT visitor_id) FROM site_visit WHERE visited_date >= $1 GROUP BY visited_date ORDER BY visited_date`, since)
	if err != nil {
		jsonError(w, 500, "Internal Server Error")
		return
	}
	for rows.Next() {
		var d daily
		if err := rows.Scan(&d.Date, &d.Count); err != nil {
			rows.Close()
			jsonError(w, 500, "Internal Server Error")
			return
		}
		dailyVisitors = append(dailyVisitors, d)
	}
	rows.Close()

	top := func(col string) ([]countRow, error) {
		where := ""
		if col != "path" {
			where = ` WHERE ` + col + ` IS NOT NULL AND ` + col + ` != ''`
		}
		rows, err := s.db.Query(ctx, `SELECT `+col+`, count(*) FROM page_view`+where+` GROUP BY `+col+` ORDER BY count(*) DESC LIMIT 10`)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		var out []countRow
		for rows.Next() {
			var c countRow
			if err := rows.Scan(&c.key, &c.count); err != nil {
				return nil, err
			}
			out = append(out, c)
		}
		return out, rows.Err()
	}
	toMaps := func(rows []countRow, name string) []map[string]any {
		out := []map[string]any{}
		for _, c := range rows {
			out = append(out, map[string]any{name: c.key, "count": c.count})
		}
		return out
	}
	pages, err1 := top("path")
	refs, err2 := top("referrer")
	uas, err3 := top(`"userAgent"`)
	if err1 != nil || err2 != nil || err3 != nil {
		jsonError(w, 500, "Internal Server Error")
		return
	}
	writeJSON(w, 200, map[string]any{
		"total":         total,
		"today":         today,
		"dailyVisitors": dailyVisitors,
		"topPages":      toMaps(pages, "path"),
		"topReferrers":  toMaps(refs, "referrer"),
		"topUserAgents": toMaps(uas, "userAgent"),
	})
}
