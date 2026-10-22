package main

// TEST_DATABASE_URL 이 있을 때만 도는 통합 테스트(운영 DB 덤프를 복원한 로컬 postgres 용).
// 가짜 GitHub 서버로 로그인 전체 흐름(authorize → callback → 세션 → 글쓰기 권한)을 돌린다.

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestGithubLoginFlow(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL 없음")
	}
	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	login := os.Getenv("TEST_GITHUB_LOGIN")
	ghID := os.Getenv("TEST_GITHUB_ID")
	if login == "" || ghID == "" {
		t.Skip("TEST_GITHUB_LOGIN/TEST_GITHUB_ID 없음")
	}
	var gotVerifier string
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/login/oauth/access_token":
			r.ParseForm()
			gotVerifier = r.Form.Get("code_verifier")
			if r.Form.Get("code") != "good-code" || r.Form.Get("redirect_uri") != "http://localhost/api/auth/callback/github" {
				json.NewEncoder(w).Encode(map[string]string{"error": "bad_verification_code"})
				return
			}
			json.NewEncoder(w).Encode(map[string]string{"access_token": "gho_test", "token_type": "bearer", "scope": "read:user,user:email"})
		case "/user":
			if r.Header.Get("Authorization") != "Bearer gho_test" {
				w.WriteHeader(401)
				return
			}
			w.Write([]byte(`{"id":` + ghID + `,"login":"` + login + `","email":null,"avatar_url":"https://x/a.png"}`))
		case "/user/emails":
			w.Write([]byte(`[{"email":"other@x","primary":false},{"email":"primary@x","primary":true}]`))
		default:
			w.WriteHeader(404)
		}
	}))
	defer fake.Close()
	githubWeb, githubAPI = fake.URL, fake.URL
	defer func() { githubWeb, githubAPI = "https://github.com", "https://api.github.com" }()

	s := &server{
		cfg: config{authURL: "http://localhost", authSecret: "s", githubID: "cid", githubSecret: "sec", allowedUsers: []string{login}},
		db:  pool, http: fake.Client(),
	}
	h := s.routes()
	do := func(method, target string, cookies []*http.Cookie, form url.Values) *httptest.ResponseRecorder {
		var req *http.Request
		if form != nil {
			req = httptest.NewRequest(method, target, strings.NewReader(form.Encode()))
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		} else {
			req = httptest.NewRequest(method, target, nil)
		}
		for _, c := range cookies {
			req.AddCookie(c)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}

	// 1) 로그인 시작
	rec := do("GET", "/api/auth/signin/github?callbackUrl=/admin/write", nil, nil)
	if rec.Code != 302 {
		t.Fatalf("signin: %d", rec.Code)
	}
	loc, _ := url.Parse(rec.Header().Get("Location"))
	q := loc.Query()
	if loc.Path != "/login/oauth/authorize" || q.Get("client_id") != "cid" || q.Get("redirect_uri") != "http://localhost/api/auth/callback/github" || q.Get("code_challenge_method") != "S256" {
		t.Fatalf("authorize url: %s", loc)
	}
	cookies := rec.Result().Cookies()

	// 2) state 가 틀리면 거절
	rec = do("GET", "/api/auth/callback/github?code=good-code&state=wrong", cookies, nil)
	if !strings.Contains(rec.Header().Get("Location"), "OAuthCallbackError") {
		t.Fatalf("bad state accepted: %s", rec.Header().Get("Location"))
	}

	// 3) 정상 콜백 → 기존 user/account 재사용, 세션 생성
	var before int
	pool.QueryRow(context.Background(), `SELECT count(*) FROM "user"`).Scan(&before)
	rec = do("GET", "/api/auth/callback/github?code=good-code&state="+url.QueryEscape(q.Get("state")), cookies, nil)
	if rec.Code != 302 || rec.Header().Get("Location") != "/admin/write" {
		t.Fatalf("callback: %d %s", rec.Code, rec.Header().Get("Location"))
	}
	if gotVerifier == "" {
		t.Fatal("PKCE verifier not sent")
	}
	var after int
	pool.QueryRow(context.Background(), `SELECT count(*) FROM "user"`).Scan(&after)
	if after != before {
		t.Fatalf("user count changed %d -> %d (existing account should be reused)", before, after)
	}
	var sessCookie *http.Cookie
	for _, c := range rec.Result().Cookies() {
		if c.Name == "authjs.session-token" && c.Value != "" {
			sessCookie = c
		}
	}
	if sessCookie == nil {
		t.Fatal("no session cookie")
	}
	defer pool.Exec(context.Background(), `DELETE FROM session WHERE "sessionToken" = $1`, sessCookie.Value)

	// 4) 세션으로 /api/auth/session, /admin, 글쓰기 API 접근
	rec = do("GET", "/api/auth/session", []*http.Cookie{sessCookie}, nil)
	if !strings.Contains(rec.Body.String(), `"name":"`+login+`"`) {
		t.Fatalf("session: %s", rec.Body.String())
	}
	rec = do("GET", "/api/admin/posts", []*http.Cookie{sessCookie}, nil)
	if rec.Code != 200 {
		t.Fatalf("admin posts: %d", rec.Code)
	}

	// 5) 허용 목록에 없는 사용자는 AccessDenied
	s.cfg.allowedUsers = []string{"someone-else"}
	rec = do("GET", "/api/auth/signin/github", nil, nil)
	loc, _ = url.Parse(rec.Header().Get("Location"))
	rec = do("GET", "/api/auth/callback/github?code=good-code&state="+url.QueryEscape(loc.Query().Get("state")), rec.Result().Cookies(), nil)
	if !strings.Contains(rec.Header().Get("Location"), "AccessDenied") {
		t.Fatalf("not allowed user got: %s", rec.Header().Get("Location"))
	}
	s.cfg.allowedUsers = nil
	rec = do("GET", "/api/auth/signin/github", nil, nil)
	loc, _ = url.Parse(rec.Header().Get("Location"))
	rec = do("GET", "/api/auth/callback/github?code=good-code&state="+url.QueryEscape(loc.Query().Get("state")), rec.Result().Cookies(), nil)
	if !strings.Contains(rec.Header().Get("Location"), "AccessDenied") {
		t.Fatalf("empty allow list should deny: %s", rec.Header().Get("Location"))
	}
}
