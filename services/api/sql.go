package main

import (
	"bytes"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"net/netip"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

// sqlExec: POST /api/sql — SQL_TOKEN Bearer 인증으로 보호되는 임의 SQL 실행 엔드포인트(예전과 같은 경로·인증·응답).
// 주의: DB 전체를 읽고 쓸 수 있는 관리용 기능이다. SQL_TOKEN 이 새면 DB 가 통째로 노출된다.
func (s *server) sqlExec(w http.ResponseWriter, r *http.Request) {
	// 예전 코드: authorization 헤더에서 'Bearer ' 를 한 번 지운 값을 토큰과 비교했다.
	token := strings.Replace(r.Header.Get("Authorization"), "Bearer ", "", 1)
	if token == "" || s.cfg.sqlToken == "" || subtle.ConstantTimeCompare([]byte(token), []byte(s.cfg.sqlToken)) != 1 {
		jsonError(w, 401, "Unauthorized")
		return
	}
	body, err := decodeBody(r)
	if err != nil {
		writeJSON(w, 500, map[string]any{"success": false, "error": err.Error()})
		return
	}
	query, ok := body["query"].(string)
	if !ok || query == "" {
		jsonError(w, 400, "query (string) is required")
		return
	}
	rows, err := s.db.Query(r.Context(), query)
	if err != nil {
		writeJSON(w, 500, map[string]any{"success": false, "error": pgMessage(err)})
		return
	}
	defer rows.Close()
	fields := rows.FieldDescriptions()
	out := []orderedRow{}
	for rows.Next() {
		vals, err := rows.Values()
		if err != nil {
			writeJSON(w, 500, map[string]any{"success": false, "error": pgMessage(err)})
			return
		}
		row := orderedRow{}
		for i, f := range fields {
			row = append(row, kv{f.Name, jsValue(vals[i])})
		}
		out = append(out, row)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, 500, map[string]any{"success": false, "error": pgMessage(err)})
		return
	}
	writeJSON(w, 200, map[string]any{"success": true, "rows": out, "rowCount": len(out)})
}

func pgMessage(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Message
	}
	return err.Error()
}

type kv struct {
	k string
	v any
}

// orderedRow 는 컬럼 순서를 지켜 JSON 객체로 내보낸다(JS 객체처럼, 같은 이름은 뒤 값이 이긴다).
type orderedRow []kv

func (o orderedRow) MarshalJSON() ([]byte, error) {
	idx := map[string]int{}
	var uniq []kv
	for _, e := range o {
		if i, ok := idx[e.k]; ok {
			uniq[i].v = e.v
			continue
		}
		idx[e.k] = len(uniq)
		uniq = append(uniq, e)
	}
	var buf bytes.Buffer
	buf.WriteByte('{')
	for i, e := range uniq {
		if i > 0 {
			buf.WriteByte(',')
		}
		k, _ := marshal(e.k)
		v, err := marshal(e.v)
		if err != nil {
			return nil, err
		}
		buf.Write(k)
		buf.WriteByte(':')
		buf.Write(v)
	}
	buf.WriteByte('}')
	return buf.Bytes(), nil
}

// jsValue 는 postgres-js 가 JS 값으로 바꾸던 모양에 맞춘다: bigint·numeric 은 문자열, 날짜는 ISO 문자열, bytea 는 Buffer JSON.
func jsValue(v any) any {
	switch x := v.(type) {
	case nil:
		return nil
	case int64:
		return fmt.Sprint(x)
	case time.Time:
		return isoString(x)
	case pgtype.Numeric:
		if !x.Valid {
			return nil
		}
		if x.NaN {
			return "NaN"
		}
		b, _ := x.MarshalJSON()
		return strings.Trim(string(b), `"`)
	case *big.Int:
		return x.String()
	case [16]byte:
		return fmt.Sprintf("%x-%x-%x-%x-%x", x[0:4], x[4:6], x[6:8], x[8:10], x[10:])
	case []byte:
		data := make([]int, len(x))
		for i, c := range x {
			data[i] = int(c)
		}
		return map[string]any{"type": "Buffer", "data": data}
	case netip.Prefix:
		return x.String()
	case []any:
		out := make([]any, len(x))
		for i, e := range x {
			out[i] = jsValue(e)
		}
		return out
	default:
		if _, err := json.Marshal(x); err != nil {
			return fmt.Sprint(x)
		}
		return x
	}
}
