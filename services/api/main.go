// blog.divops.kr API·페이지 서버. nginx(:3000) 가 /assets 같은 정적 파일만 직접 내주고 나머지는 전부 이 서버로 넘긴다.
// 예전 Next.js 서비스와 같은 URL·API 응답 형태·쿠키 이름·OAuth 콜백 경로를 유지한다.
// DB 스키마는 예전 drizzle 마이그레이션이 만든 그대로 쓴다. 여기서는 마이그레이션을 돌리지 않는다.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// 사이트 주소는 예전 metadataBase·sitemap·JSON-LD 에 박혀 있던 값 그대로다.
const siteURL = "https://blog.divops.kr"
const siteName = "blog.divops.kr"
const siteDescription = "DevOps와 프론트엔드 기술 블로그"
const googleVerification = "zpZHz5nGuK9g_3uNl7twb-q5OZXdG5mpt-g094vneb4"

type config struct {
	authSecret    string
	githubID      string
	githubSecret  string
	authURL       string // https://blog.divops.kr (끝의 /api/auth 는 떼어 둔다)
	allowedUsers  []string
	s3Endpoint    string
	s3AccessKey   string
	s3SecretKey   string
	uploadMaxMB   float64
	sqlToken      string
	staticDir     string
	secureCookies bool
}

type server struct {
	cfg   config
	db    *pgxpool.Pool
	pages *pageRenderer
	http  *http.Client
}

func loadConfig() config {
	authURL := strings.TrimRight(os.Getenv("AUTH_URL"), "/")
	authURL = strings.TrimSuffix(authURL, "/api/auth")
	if authURL == "" {
		authURL = siteURL
	}
	var allowed []string
	for _, u := range strings.Split(os.Getenv("AUTH_ALLOWED_USERS"), ",") {
		if u = strings.TrimSpace(u); u != "" {
			allowed = append(allowed, u)
		}
	}
	maxMB := 10.0
	if v := os.Getenv("UPLOAD_MAX_FILE_SIZE_MB"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			maxMB = f
		}
	}
	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "/usr/share/nginx/html"
	}
	return config{
		authSecret:    os.Getenv("AUTH_SECRET"),
		githubID:      os.Getenv("AUTH_GITHUB_ID"),
		githubSecret:  os.Getenv("AUTH_GITHUB_SECRET"),
		authURL:       authURL,
		allowedUsers:  allowed,
		s3Endpoint:    strings.TrimRight(os.Getenv("S3_ENDPOINT"), "/"),
		s3AccessKey:   os.Getenv("S3_ACCESS_KEY"),
		s3SecretKey:   os.Getenv("S3_SECRET_KEY"),
		uploadMaxMB:   maxMB,
		sqlToken:      os.Getenv("SQL_TOKEN"),
		staticDir:     staticDir,
		secureCookies: strings.HasPrefix(authURL, "https://"),
	}
}

func main() {
	addr := os.Getenv("API_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}
	cfg := loadConfig()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is not set")
	}
	pcfg, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Fatalf("DATABASE_URL parse: %v", err)
	}
	pcfg.MaxConns = 10
	pool, err := pgxpool.NewWithConfig(context.Background(), pcfg)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	// 예전 entrypoint 처럼 DB 가 뜰 때까지 기다리되, 못 붙어도 서버는 띄운다(페이지가 빈 목록으로라도 열리게).
	for i := 1; i <= 10; i++ {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		err = pool.Ping(ctx)
		cancel()
		if err == nil {
			log.Printf("db connected")
			break
		}
		log.Printf("db not ready (attempt %d/10): %v", i, err)
		time.Sleep(3 * time.Second)
	}

	pages, err := newPageRenderer(cfg.staticDir)
	if err != nil {
		log.Fatalf("index.html: %v", err)
	}

	s := &server{cfg: cfg, db: pool, pages: pages, http: &http.Client{Timeout: 15 * time.Second}}
	srv := &http.Server{
		Addr:              addr,
		Handler:           s.routes(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	log.Printf("api listening on %s", addr)
	log.Fatal(srv.ListenAndServe())
}

func (s *server) routes() http.Handler {
	mux := http.NewServeMux()

	// 글 API (예전 Next route handler 와 같은 경로·응답)
	mux.HandleFunc("GET /api/posts", s.listPosts)
	mux.HandleFunc("POST /api/posts", s.createPost)
	mux.HandleFunc("GET /api/posts/{id}", s.getPost)
	mux.HandleFunc("PUT /api/posts/{id}", s.updatePost)
	mux.HandleFunc("DELETE /api/posts/{id}", s.deletePost)
	mux.HandleFunc("POST /api/posts/{id}/view", s.viewPost)
	mux.HandleFunc("GET /api/categories", s.categories)
	mux.HandleFunc("POST /api/slugify", s.slugify)
	mux.HandleFunc("POST /api/upload", s.upload)
	mux.HandleFunc("POST /api/sql", s.sqlExec)

	// 방문자 통계
	mux.HandleFunc("POST /api/track", s.track)
	mux.HandleFunc("GET /api/stats/visitors", s.visitorStats)
	mux.HandleFunc("GET /api/admin/stats", s.adminStats)
	mux.HandleFunc("GET /api/admin/posts", s.adminPosts) // 새로 추가: 예전엔 서버 컴포넌트가 DB 를 직접 읽었다

	// 인증 (Auth.js 와 같은 경로. GitHub OAuth 앱의 콜백 URL 을 바꾸지 않아도 된다)
	mux.HandleFunc("GET /api/auth/providers", s.authProviders)
	mux.HandleFunc("GET /api/auth/session", s.authSession)
	mux.HandleFunc("GET /api/auth/csrf", s.authCSRF)
	mux.HandleFunc("GET /api/auth/signin", s.authSigninPage)
	mux.HandleFunc("GET /api/auth/signin/github", s.authSigninGithub)
	mux.HandleFunc("POST /api/auth/signin/github", s.authSigninGithub)
	mux.HandleFunc("GET /api/auth/callback/github", s.authCallbackGithub)
	mux.HandleFunc("GET /api/auth/signout", s.authSignoutPage)
	mux.HandleFunc("POST /api/auth/signout", s.authSignout)
	mux.HandleFunc("GET /api/auth/error", s.authErrorPage)

	// SEO
	mux.HandleFunc("GET /robots.txt", robots)
	mux.HandleFunc("GET /sitemap.xml", s.sitemap)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) })

	// 화면
	mux.HandleFunc("GET /{$}", s.homePage)
	mux.HandleFunc("GET /admin", s.adminPage)
	mux.HandleFunc("GET /admin/{rest...}", s.adminPage)
	mux.HandleFunc("GET /assets/", s.staticFile)
	mux.HandleFunc("GET /{path...}", s.catchAll)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 업로드 상한 + 여유. 실제 파일 크기 검사는 upload 핸들러가 한다.
		limit := int64(s.cfg.uploadMaxMB*1024*1024) + 1<<20
		if limit < 2<<20 {
			limit = 2 << 20
		}
		r.Body = http.MaxBytesReader(w, r.Body, limit)
		mux.ServeHTTP(w, r)
	})
}

// marshal 은 JSON.stringify 처럼 <, >, & 를 그대로 두고 끝 줄바꿈 없이 직렬화한다.
func marshal(v any) ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	return bytes.TrimRight(buf.Bytes(), "\n"), nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	b, err := marshal(v)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if w.Header().Get("Cache-Control") == "" {
		w.Header().Set("Cache-Control", "no-store")
	}
	w.WriteHeader(status)
	w.Write(b)
}

func jsonError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// jsTime 은 JS 의 Date#toISOString() 형식(밀리초, Z)으로 직렬화한다. 예전 API 응답과 같은 문자열이 나온다.
type jsTime struct{ time.Time }

func (t jsTime) MarshalJSON() ([]byte, error) {
	return []byte(`"` + isoString(t.Time) + `"`), nil
}

func isoString(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z")
}

func ptrTime(t *time.Time) *jsTime {
	if t == nil {
		return nil
	}
	return &jsTime{*t}
}

// nowMs 는 JS new Date() 처럼 밀리초까지만 있는 UTC 시각이다. 컬럼이 timestamp without time zone 이라 UTC 로 넣는다.
func nowMs() time.Time {
	return time.Now().UTC().Truncate(time.Millisecond)
}
