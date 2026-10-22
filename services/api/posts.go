package main

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type author struct {
	Name  *string `json:"name"`
	Image *string `json:"image"`
}

// authorOrNil 은 drizzle 의 leftJoin 중첩 select 처럼, 필드가 전부 null 이면 author 자체를 null 로 낸다.
func authorOrNil(name, image *string) *author {
	if name == nil && image == nil {
		return nil
	}
	return &author{Name: name, Image: image}
}

// listItem 은 GET /api/posts 와 홈 화면의 글 한 줄이다(필드 순서도 예전 응답과 같다).
type listItem struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Slug        string  `json:"slug"`
	URLSlug     *string `json:"urlSlug"`
	Category    *string `json:"category"`
	Excerpt     *string `json:"excerpt"`
	CoverImage  *string `json:"coverImage"`
	PublishedAt *jsTime `json:"publishedAt"`
	Author      *author `json:"author"`
}

// postRow 는 post 테이블 한 줄 전체다(insert/update ... returning 응답).
type postRow struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Slug        string  `json:"slug"`
	URLSlug     *string `json:"urlSlug"`
	Content     string  `json:"content"`
	Excerpt     *string `json:"excerpt"`
	Category    *string `json:"category"`
	CoverImage  *string `json:"coverImage"`
	Published   bool    `json:"published"`
	PublishedAt *jsTime `json:"publishedAt"`
	ViewCount   int     `json:"viewCount"`
	AuthorID    string  `json:"authorId"`
	CreatedAt   jsTime  `json:"createdAt"`
	UpdatedAt   jsTime  `json:"updatedAt"`
}

const postRowCols = `id, title, slug, "urlSlug", content, excerpt, category, "coverImage", published, "publishedAt", "viewCount", "authorId", "createdAt", "updatedAt"`

func scanPostRow(row pgx.Row) (*postRow, error) {
	var p postRow
	var pub *time.Time
	var created, updated time.Time
	err := row.Scan(&p.ID, &p.Title, &p.Slug, &p.URLSlug, &p.Content, &p.Excerpt, &p.Category, &p.CoverImage,
		&p.Published, &pub, &p.ViewCount, &p.AuthorID, &created, &updated)
	if err != nil {
		return nil, err
	}
	p.PublishedAt = ptrTime(pub)
	p.CreatedAt = jsTime{created}
	p.UpdatedAt = jsTime{updated}
	return &p, nil
}

// postDetail 은 GET /api/posts/{id} 응답이다.
type postDetail struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Slug        string  `json:"slug"`
	URLSlug     *string `json:"urlSlug"`
	Category    *string `json:"category"`
	Content     string  `json:"content"`
	Excerpt     *string `json:"excerpt"`
	CoverImage  *string `json:"coverImage"`
	Published   bool    `json:"published"`
	PublishedAt *jsTime `json:"publishedAt"`
	AuthorID    string  `json:"authorId"`
	CreatedAt   jsTime  `json:"createdAt"`
	UpdatedAt   jsTime  `json:"updatedAt"`
	Author      *author `json:"author"`
}

func (s *server) queryPublishedPosts(ctx context.Context, limit, offset int) ([]listItem, int, error) {
	rows, err := s.db.Query(ctx, `
		SELECT p.id, p.title, p.slug, p."urlSlug", p.category, p.excerpt, p."coverImage", p."publishedAt", u.name, u.image
		FROM post p LEFT JOIN "user" u ON p."authorId" = u.id
		WHERE p.published = true
		ORDER BY p."publishedAt" DESC
		LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := []listItem{}
	for rows.Next() {
		var it listItem
		var pub *time.Time
		var name, image *string
		if err := rows.Scan(&it.ID, &it.Title, &it.Slug, &it.URLSlug, &it.Category, &it.Excerpt, &it.CoverImage, &pub, &name, &image); err != nil {
			return nil, 0, err
		}
		it.PublishedAt = ptrTime(pub)
		it.Author = authorOrNil(name, image)
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	var total int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM post WHERE published = true`).Scan(&total); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// jsNumber 는 JS 의 Number(x) 처럼 정수 문자열을 읽는다. 못 읽으면 기본값.
func jsNumber(v string, def int) int {
	n, err := strconv.Atoi(strings.TrimSpace(v))
	if err != nil {
		return def
	}
	return n
}

func (s *server) listPosts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page := 1
	if q.Has("page") {
		page = jsNumber(q.Get("page"), 1)
	}
	limit := 10
	if q.Has("limit") {
		limit = jsNumber(q.Get("limit"), 10)
	}
	if page < 1 {
		page = 1
	}
	if limit < 0 {
		limit = 0
	}
	if limit > 1000 {
		limit = 1000
	}
	items, total, err := s.queryPublishedPosts(r.Context(), limit, (page-1)*limit)
	if err != nil {
		log.Printf("listPosts: %v", err)
		jsonError(w, 500, "Internal Server Error")
		return
	}
	writeJSON(w, 200, map[string]any{"posts": items, "total": total, "page": page, "limit": limit})
}

func (s *server) getPost(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var p postDetail
	var pub *time.Time
	var created, updated time.Time
	var name, image *string
	err := s.db.QueryRow(r.Context(), `
		SELECT p.id, p.title, p.slug, p."urlSlug", p.category, p.content, p.excerpt, p."coverImage", p.published, p."publishedAt",
		       p."authorId", p."createdAt", p."updatedAt", u.name, u.image
		FROM post p LEFT JOIN "user" u ON p."authorId" = u.id
		WHERE p.id = $1`, id).Scan(&p.ID, &p.Title, &p.Slug, &p.URLSlug, &p.Category, &p.Content, &p.Excerpt, &p.CoverImage,
		&p.Published, &pub, &p.AuthorID, &created, &updated, &name, &image)
	if errors.Is(err, pgx.ErrNoRows) {
		jsonError(w, 404, "Not found")
		return
	}
	if err != nil {
		log.Printf("getPost: %v", err)
		jsonError(w, 500, "Internal Server Error")
		return
	}
	p.PublishedAt = ptrTime(pub)
	p.CreatedAt = jsTime{created}
	p.UpdatedAt = jsTime{updated}
	p.Author = authorOrNil(name, image)
	writeJSON(w, 200, p)
}

var markdownImageRe = regexp.MustCompile(`!\[[^\]]*\]\(([^)]+)\)`)

// extractFirstImageURL 은 마크다운 본문의 첫 이미지 주소다(없으면 "").
func extractFirstImageURL(md string) string {
	m := markdownImageRe.FindStringSubmatch(md)
	if m == nil {
		return ""
	}
	return m[1]
}

// truthy 는 JS 의 if (x) 판정이다.
func truthy(v any) bool {
	switch x := v.(type) {
	case nil:
		return false
	case bool:
		return x
	case string:
		return x != ""
	case float64:
		return x != 0
	default:
		return true
	}
}

func strOrNil(v any) *string {
	if s, ok := v.(string); ok {
		return &s
	}
	return nil
}

func newID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func decodeBody(r *http.Request) (map[string]any, error) {
	var body map[string]any
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(&body); err != nil {
		return nil, err
	}
	if body == nil {
		body = map[string]any{}
	}
	return body, nil
}

func (s *server) createPost(w http.ResponseWriter, r *http.Request) {
	sess := s.currentSession(r, w)
	if sess == nil {
		jsonError(w, 401, "Unauthorized")
		return
	}
	body, err := decodeBody(r)
	if err != nil {
		jsonError(w, 400, "Invalid JSON")
		return
	}
	title, content, slug, urlSlug := body["title"], body["content"], body["slug"], body["urlSlug"]
	if !truthy(title) || !truthy(content) || !truthy(slug) || !truthy(urlSlug) {
		jsonError(w, 400, "title, content, slug, urlSlug are required")
		return
	}
	ts, cs, ss, us := strOrNil(title), strOrNil(content), strOrNil(slug), strOrNil(urlSlug)
	if ts == nil || cs == nil || ss == nil || us == nil {
		jsonError(w, 400, "title, content, slug, urlSlug are required")
		return
	}
	var cover *string
	if truthy(body["coverImage"]) {
		cover = strOrNil(body["coverImage"])
	} else if u := extractFirstImageURL(*cs); u != "" {
		cover = &u
	}
	published := truthy(body["published"])
	var publishedAt *time.Time
	if published {
		t := nowMs()
		publishedAt = &t
	}
	now := nowMs()
	row := s.db.QueryRow(r.Context(), `
		INSERT INTO post (id, title, slug, "urlSlug", content, category, excerpt, "coverImage", published, "publishedAt", "authorId", "createdAt", "updatedAt")
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
		RETURNING `+postRowCols,
		newID(), *ts, *ss, *us, *cs, strOrNil(body["category"]), strOrNil(body["excerpt"]), cover, published, publishedAt, sess.UserID, now)
	p, err := scanPostRow(row)
	if err != nil {
		log.Printf("createPost: %v", err)
		jsonError(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, p)
}

// 예전 PUT 은 body 를 통째로 set 에 펼쳤다. 여기서는 글쓰기 화면이 보내는 필드만 받는다(viewCount·authorId 등 임의 컬럼 변경 차단).
var updatableCols = []struct{ key, col string }{
	{"title", "title"},
	{"slug", "slug"},
	{"urlSlug", `"urlSlug"`},
	{"content", "content"},
	{"excerpt", "excerpt"},
	{"category", "category"},
	{"coverImage", `"coverImage"`},
	{"published", "published"},
}

func (s *server) loadOwner(w http.ResponseWriter, r *http.Request, userID string) (published bool, publishedAt *time.Time, ok bool) {
	var authorID string
	err := s.db.QueryRow(r.Context(), `SELECT "authorId", published, "publishedAt" FROM post WHERE id = $1`, r.PathValue("id")).
		Scan(&authorID, &published, &publishedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		jsonError(w, 404, "Not found")
		return
	}
	if err != nil {
		log.Printf("loadOwner: %v", err)
		jsonError(w, 500, "Internal Server Error")
		return
	}
	if authorID != userID {
		jsonError(w, 403, "Forbidden")
		return
	}
	return published, publishedAt, true
}

func (s *server) updatePost(w http.ResponseWriter, r *http.Request) {
	sess := s.currentSession(r, w)
	if sess == nil {
		jsonError(w, 401, "Unauthorized")
		return
	}
	body, err := decodeBody(r)
	if err != nil {
		jsonError(w, 400, "Invalid JSON")
		return
	}
	wasPublished, oldPublishedAt, ok := s.loadOwner(w, r, sess.UserID)
	if !ok {
		return
	}
	if c, isStr := body["content"].(string); isStr && c != "" && !truthy(body["coverImage"]) {
		if u := extractFirstImageURL(c); u != "" {
			body["coverImage"] = u
		} else {
			body["coverImage"] = nil
		}
	}

	sets := []string{}
	args := []any{}
	add := func(col string, v any) {
		args = append(args, v)
		sets = append(sets, col+" = $"+strconv.Itoa(len(args)))
	}
	for _, c := range updatableCols {
		v, present := body[c.key]
		if !present {
			continue
		}
		switch c.key {
		case "published":
			b, isBool := v.(bool)
			if !isBool {
				jsonError(w, 400, "published must be boolean")
				return
			}
			add(c.col, b)
		case "title", "slug", "urlSlug", "content":
			sv, isStr := v.(string)
			if !isStr {
				jsonError(w, 400, c.key+" must be string")
				return
			}
			add(c.col, sv)
		default: // nullable 텍스트
			if v != nil {
				if _, isStr := v.(string); !isStr {
					jsonError(w, 400, c.key+" must be string or null")
					return
				}
			}
			add(c.col, strOrNil(v))
		}
	}
	publishedAt := oldPublishedAt
	if truthy(body["published"]) && !wasPublished {
		t := nowMs()
		publishedAt = &t
	}
	add(`"publishedAt"`, publishedAt)
	add(`"updatedAt"`, nowMs())
	args = append(args, r.PathValue("id"))
	row := s.db.QueryRow(r.Context(),
		`UPDATE post SET `+strings.Join(sets, ", ")+` WHERE id = $`+strconv.Itoa(len(args))+` RETURNING `+postRowCols, args...)
	p, err := scanPostRow(row)
	if err != nil {
		log.Printf("updatePost: %v", err)
		jsonError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, p)
}

func (s *server) deletePost(w http.ResponseWriter, r *http.Request) {
	sess := s.currentSession(r, w)
	if sess == nil {
		jsonError(w, 401, "Unauthorized")
		return
	}
	if _, _, ok := s.loadOwner(w, r, sess.UserID); !ok {
		return
	}
	if _, err := s.db.Exec(r.Context(), `DELETE FROM post WHERE id = $1`, r.PathValue("id")); err != nil {
		log.Printf("deletePost: %v", err)
		jsonError(w, 500, "Internal Server Error")
		return
	}
	writeJSON(w, 200, map[string]bool{"success": true})
}

// 조회수: viewed_posts 쿠키(JSON 배열, 24시간)로 같은 브라우저의 중복 증가를 막는다.
func (s *server) viewPost(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var viewCount int
	err := s.db.QueryRow(r.Context(), `SELECT "viewCount" FROM post WHERE id = $1`, id).Scan(&viewCount)
	if errors.Is(err, pgx.ErrNoRows) {
		jsonError(w, 404, "Not found")
		return
	}
	if err != nil {
		jsonError(w, 503, "View count not available")
		return
	}
	viewed := []string{}
	if c, err := r.Cookie("viewed_posts"); err == nil {
		raw := c.Value
		if dec, err := url.QueryUnescape(raw); err == nil {
			raw = dec
		}
		if json.Unmarshal([]byte(raw), &viewed) != nil {
			viewed = []string{}
		}
	}
	for _, v := range viewed {
		if v == id {
			writeJSON(w, 200, map[string]any{"viewCount": viewCount, "alreadyViewed": true})
			return
		}
	}
	var updated int
	if err := s.db.QueryRow(r.Context(), `UPDATE post SET "viewCount" = "viewCount" + 1 WHERE id = $1 RETURNING "viewCount"`, id).Scan(&updated); err != nil {
		jsonError(w, 503, "View count not available")
		return
	}
	viewed = append(viewed, id)
	b, _ := json.Marshal(viewed)
	http.SetCookie(w, &http.Cookie{
		Name: "viewed_posts", Value: encodeURIComponent(string(b)), Path: "/",
		MaxAge: 60 * 60 * 24, Expires: time.Now().Add(24 * time.Hour), HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})
	writeJSON(w, 200, map[string]any{"viewCount": updated, "alreadyViewed": false})
}

// encodeURIComponent 는 Next 의 cookies().set 이 값을 인코딩하던 방식과 같다.
func encodeURIComponent(s string) string {
	const keep = "-_.!~*'()"
	var b strings.Builder
	for _, c := range []byte(s) {
		if c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || strings.IndexByte(keep, c) >= 0 {
			b.WriteByte(c)
		} else {
			b.WriteString("%" + strings.ToUpper(hex.EncodeToString([]byte{c})))
		}
	}
	return b.String()
}

func (s *server) categories(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), `SELECT DISTINCT category FROM post WHERE category IS NOT NULL ORDER BY category`)
	if err != nil {
		log.Printf("categories: %v", err)
		jsonError(w, 500, "Internal Server Error")
		return
	}
	cats, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		jsonError(w, 500, "Internal Server Error")
		return
	}
	if cats == nil {
		cats = []string{}
	}
	writeJSON(w, 200, cats)
}

type adminPostItem struct {
	ID        string  `json:"id"`
	Title     string  `json:"title"`
	Category  *string `json:"category"`
	Published bool    `json:"published"`
	CreatedAt jsTime  `json:"createdAt"`
}

// adminPosts 는 관리 화면의 전체 글 목록(초안 포함)이다. 예전 admin/posts 서버 컴포넌트의 쿼리와 같다.
func (s *server) adminPosts(w http.ResponseWriter, r *http.Request) {
	if s.currentSession(r, w) == nil {
		jsonError(w, 401, "Unauthorized")
		return
	}
	rows, err := s.db.Query(r.Context(), `SELECT id, title, category, published, "createdAt" FROM post ORDER BY "createdAt" DESC`)
	if err != nil {
		jsonError(w, 500, "Internal Server Error")
		return
	}
	defer rows.Close()
	out := []adminPostItem{}
	for rows.Next() {
		var it adminPostItem
		var created time.Time
		if err := rows.Scan(&it.ID, &it.Title, &it.Category, &it.Published, &created); err != nil {
			jsonError(w, 500, "Internal Server Error")
			return
		}
		it.CreatedAt = jsTime{created}
		out = append(out, it)
	}
	writeJSON(w, 200, out)
}

var (
	koSlugStrip = regexp.MustCompile(`[^a-z0-9가-힣\s-]`)
	enSlugStrip = regexp.MustCompile(`[^a-z0-9\s-]`)
	spacesRe    = regexp.MustCompile(`\s+`)
	dashesRe    = regexp.MustCompile(`-+`)
	edgeDashRe  = regexp.MustCompile(`^-|-$`)
	hangulRe    = regexp.MustCompile(`[가-힣]`)
)

func slugWith(strip *regexp.Regexp, text string) string {
	s := strings.ToLower(text)
	s = strip.ReplaceAllString(s, "")
	s = spacesRe.ReplaceAllString(s, "-")
	s = dashesRe.ReplaceAllString(s, "-")
	s = edgeDashRe.ReplaceAllString(s, "")
	return strings.TrimSpace(s)
}

// translateClient 는 HTTP/1.1 만 쓴다. 이 비공식 엔드포인트는 Go 의 HTTP/2 요청에 429("Sorry...")를 돌려준다(로컬에서 확인).
var translateClient = &http.Client{
	Timeout: 15 * time.Second,
	Transport: &http.Transport{
		Proxy:        http.ProxyFromEnvironment,
		TLSNextProto: map[string]func(string, *tls.Conn) http.RoundTripper{},
	},
}

func (s *server) translateToEnglish(ctx context.Context, text string) (string, error) {
	if !hangulRe.MatchString(text) {
		return text, nil
	}
	readable := strings.ReplaceAll(text, "-", " ")
	u := "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t&q=" + url.QueryEscape(readable)
	req, _ := http.NewRequestWithContext(ctx, "GET", u, nil)
	res, err := translateClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return "", errors.New("translation failed: " + res.Status)
	}
	var data []any
	if err := json.NewDecoder(res.Body).Decode(&data); err != nil {
		return "", err
	}
	segs, _ := data[0].([]any)
	var b strings.Builder
	for _, seg := range segs {
		if arr, ok := seg.([]any); ok && len(arr) > 0 {
			if t, ok := arr[0].(string); ok {
				b.WriteString(t)
			}
		}
	}
	return b.String(), nil
}

func (s *server) slugify(w http.ResponseWriter, r *http.Request) {
	body, err := decodeBody(r)
	if err != nil {
		jsonError(w, 500, "Failed to generate slug")
		return
	}
	title, ok := body["title"].(string)
	if !ok || title == "" {
		jsonError(w, 400, "title is required")
		return
	}
	slug := slugWith(koSlugStrip, title)
	translated, err := s.translateToEnglish(r.Context(), slug)
	if err != nil {
		log.Printf("slugify: %v", err)
		jsonError(w, 500, "Failed to generate slug")
		return
	}
	writeJSON(w, 200, map[string]string{"slug": slug, "urlSlug": slugWith(enSlugStrip, translated)})
}
