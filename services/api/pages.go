package main

// 화면 HTML: Vite 가 만든 index.html 을 읽어 <!--ssr-head--> 에 title/description/og/canonical/JSON-LD 를,
// <!--ssr-body--> 에 크롤러가 JS 없이 읽을 본문 HTML 을, <!--ssr-data--> 에 React 가 다시 그릴 초기 데이터를 넣는다.
// 브라우저에서는 React 가 #root 를 같은 모양으로 다시 그린다(createRoot).

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type pageRenderer struct {
	dir                            string
	pre, afterHead, afterBody, end string
}

func newPageRenderer(dir string) (*pageRenderer, error) {
	b, err := os.ReadFile(filepath.Join(dir, "index.html"))
	if err != nil {
		return nil, err
	}
	s := string(b)
	p := &pageRenderer{dir: dir}
	var ok bool
	if p.pre, s, ok = strings.Cut(s, "<!--ssr-head-->"); !ok {
		return nil, errors.New("index.html 에 <!--ssr-head--> 가 없다")
	}
	if p.afterHead, s, ok = strings.Cut(s, "<!--ssr-body-->"); !ok {
		return nil, errors.New("index.html 에 <!--ssr-body--> 가 없다")
	}
	if p.afterBody, p.end, ok = strings.Cut(s, "<!--ssr-data-->"); !ok {
		return nil, errors.New("index.html 에 <!--ssr-data--> 가 없다")
	}
	return p, nil
}

func (p *pageRenderer) render(w http.ResponseWriter, status int, head, body string, data any) {
	dj, _ := json.Marshal(data) // json.Marshal 은 <, >, & 를 < 로 바꿔 script 안에서 안전하다
	var buf bytes.Buffer
	buf.WriteString(p.pre)
	buf.WriteString(head)
	buf.WriteString(p.afterHead)
	buf.WriteString(body)
	buf.WriteString(p.afterBody)
	buf.WriteString(`<script id="__DATA__" type="application/json">`)
	buf.Write(dj)
	buf.WriteString(`</script>`)
	buf.WriteString(p.end)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(status)
	w.Write(buf.Bytes())
}

// ─── <head> ───

type headMeta struct {
	Title       string
	Description string
	Canonical   string
	NoIndex     bool
	OG          [][2]string // property, content
	Twitter     [][2]string
	JSONLD      any
}

var headTmpl = template.Must(template.New("head").Parse(`<title>{{.Title}}</title>
{{- if .Description}}<meta name="description" content="{{.Description}}"/>{{end}}
{{- if .NoIndex}}<meta name="robots" content="noindex"/>{{end}}
{{- if .Canonical}}<link rel="canonical" href="{{.Canonical}}"/>{{end}}
<meta name="google-site-verification" content="` + googleVerification + `"/>
{{- range .OG}}<meta property="{{index . 0}}" content="{{index . 1}}"/>{{end}}
{{- range .Twitter}}<meta name="{{index . 0}}" content="{{index . 1}}"/>{{end}}
{{- if .JSONLD}}<script type="application/ld+json">{{.JSONLD}}</script>{{end}}`))

func renderHead(m headMeta) string {
	var buf bytes.Buffer
	if m.JSONLD != nil {
		b, _ := json.Marshal(m.JSONLD)
		m.JSONLD = template.JS(b) // json.Marshal 이 < > & 를 이스케이프하므로 script 안에 그대로 넣어도 안전
	}
	if err := headTmpl.Execute(&buf, m); err != nil {
		log.Printf("head template: %v", err)
	}
	return buf.String()
}

// ─── <body> (크롤러용 초기 HTML. 클래스는 React 컴포넌트와 같다) ───

var kst = time.FixedZone("KST", 9*60*60)

func koDate(t *jsTime) string {
	if t == nil {
		return ""
	}
	k := t.In(kst)
	return fmt.Sprintf("%d년 %d월 %d일", k.Year(), int(k.Month()), k.Day())
}

var bodyTmpl = template.Must(template.New("body").Funcs(template.FuncMap{
	"koDate": koDate,
	"iso": func(t *jsTime) string {
		if t == nil {
			return ""
		}
		return isoString(t.Time)
	},
	"deref": func(s *string) string {
		if s == nil {
			return ""
		}
		return *s
	},
	"indent": func(level, min int) string { return fmt.Sprintf("padding-left:%dpx", 12+(level-min)*12) },
}).Parse(`
{{define "layout"}}<header class="sticky top-0 z-50 bg-white/70 dark:bg-gray-950/70 backdrop-blur-xl border-b border-gray-100/80 dark:border-gray-800/80"><nav class="max-w-[720px] mx-auto px-6 h-14 flex items-center justify-between"><a href="/" class="text-[15px] font-semibold tracking-tight text-gray-900 dark:text-gray-100 hover:text-gray-500 dark:hover:text-gray-400 transition-colors">blog.divops.kr</a><div class="flex items-center gap-3"><div class="w-8 h-8"></div></div></nav></header><main class="flex-1">{{template "content" .}}</main><footer class="border-t border-gray-100/80 dark:border-gray-800/80"><div class="max-w-[720px] mx-auto px-6 py-10"><p class="text-[13px] text-gray-300 dark:text-gray-600">&copy; {{.Year}} divops.kr</p></div></footer>{{end}}

{{define "home"}}<section class="max-w-[720px] mx-auto px-6 pt-20 pb-16"><div class="mb-16"><h1 class="text-[28px] font-bold tracking-tight text-gray-900 dark:text-gray-100">Blog</h1><p class="mt-2 text-[15px] text-gray-400 dark:text-gray-500">DevOps와 프론트엔드 개발에 대한 이야기</p></div>
{{- if not .Posts}}<div class="py-20 text-center"><p class="text-gray-300 dark:text-gray-600 text-[15px]">아직 작성된 글이 없습니다.</p></div>
{{- else}}<div class="flex flex-col">{{range .Posts}}<a href="/{{deref .URLSlug}}" class="group block"><article class="py-6 border-b border-gray-100 dark:border-gray-800 last:border-0 flex flex-col sm:flex-row sm:gap-5"><div class="relative w-full h-[180px] sm:w-[160px] sm:h-[100px] shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 mb-3 sm:mb-0"><img src="{{if .CoverImage}}{{deref .CoverImage}}{{else}}https://picsum.photos/400/200{{end}}" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/></div><div class="min-w-0 flex-1"><div class="flex items-center gap-2 mb-2.5">{{if .Category}}<span class="text-[12px] font-semibold uppercase tracking-wider text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-2 py-0.5 rounded">{{deref .Category}}</span>{{end}}{{if .PublishedAt}}<time datetime="{{iso .PublishedAt}}" class="text-[13px] text-gray-300 dark:text-gray-600">{{koDate .PublishedAt}}</time>{{end}}</div><h2 class="text-[18px] font-semibold text-gray-900 dark:text-gray-100 leading-snug tracking-tight group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors duration-200">{{.Title}}</h2>{{if .Excerpt}}<p class="mt-2 text-[14px] text-gray-400 dark:text-gray-500 leading-relaxed line-clamp-2">{{deref .Excerpt}}</p>{{end}}{{if .Author}}{{if .Author.Name}}<p class="mt-3 text-[12px] text-gray-300 dark:text-gray-600">{{deref .Author.Name}}</p>{{end}}{{end}}</div></article></a>{{end}}</div>{{end}}</section>{{end}}

{{define "post"}}<div class="max-w-[960px] mx-auto px-6 py-12 lg:flex lg:gap-10"><aside class="hidden lg:block w-[200px] shrink-0">{{if .Headings}}<nav class="sticky top-24"><p class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">목차</p><ul class="space-y-1 text-[13px] border-l border-gray-200 dark:border-gray-700">{{$min := .MinLevel}}{{range .Headings}}<li><a href="#{{.ID}}" style="{{indent .Level $min}}" class="block py-1 transition-colors leading-snug text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">{{.Text}}</a></li>{{end}}</ul></nav>{{end}}</aside><section class="flex-1 min-w-0 max-w-[720px]"><article><header class="mb-12 pt-8"><div class="flex items-center gap-2.5 mb-5">{{with .Post}}{{if .Category}}<span class="text-[12px] font-semibold uppercase tracking-wider text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-2 py-0.5 rounded">{{deref .Category}}</span>{{end}}{{if .PublishedAt}}<time datetime="{{iso .PublishedAt}}" class="text-[13px] text-gray-300 dark:text-gray-600">{{koDate .PublishedAt}}</time>{{end}}{{end}}</div><h1 class="text-[32px] md:text-[38px] font-extrabold leading-[1.25] tracking-tight text-gray-900 dark:text-gray-100 break-keep">{{.Post.Title}}</h1>{{with .Post.Author}}{{if .Name}}<div class="flex items-center gap-2.5 mt-6">{{if .Image}}<img src="{{deref .Image}}" alt="{{deref .Name}}" width="24" height="24" class="rounded-full"/>{{end}}<a href="https://github.com/{{deref .Name}}" target="_blank" rel="noopener noreferrer" class="text-[13px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">{{deref .Name}}</a></div>{{end}}{{end}}</header>{{if .Post.CoverImage}}<img src="{{deref .Post.CoverImage}}" alt="{{.Post.Title}}" width="800" height="400" class="w-full rounded-xl mb-12 object-cover"/>{{end}}<div class="prose prose-lg max-w-none">{{.HTML}}</div></article></section></div>{{end}}

{{define "notfound"}}<section class="max-w-[720px] mx-auto px-6 flex flex-col items-center justify-center min-h-[60vh] text-center"><p class="text-[120px] font-bold leading-none tracking-tighter text-gray-100 dark:text-gray-800 select-none">404</p><h1 class="mt-4 text-[22px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">페이지를 찾을 수 없어요</h1><p class="mt-2 text-[15px] text-gray-400 dark:text-gray-500">요청하신 페이지가 존재하지 않거나, 이동되었을 수 있어요.</p><a href="/" class="mt-8 inline-flex items-center gap-1.5 text-[14px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">홈으로 돌아가기</a></section>{{end}}
`))

func renderBody(content string, data any) string {
	t, err := bodyTmpl.Clone()
	if err != nil {
		return ""
	}
	template.Must(t.New("content").Parse(`{{template "` + content + `" .}}`))
	var buf bytes.Buffer
	if err := t.ExecuteTemplate(&buf, "layout", data); err != nil {
		log.Printf("body template %s: %v", content, err)
		return ""
	}
	return buf.String()
}

// ─── 화면 핸들러 ───

const homePageSize = 10

type homeView struct {
	Year  int
	Posts []listItem
}

func (s *server) homePage(w http.ResponseWriter, r *http.Request) {
	items, total, err := s.queryPublishedPosts(r.Context(), homePageSize, 0)
	if err != nil {
		// 예전처럼 DB 연결 실패 시 빈 목록으로 연다
		log.Printf("home: %v", err)
		items, total = []listItem{}, 0
	}
	head := renderHead(headMeta{
		Title:       siteName,
		Description: siteDescription,
		Canonical:   siteURL,
		OG: [][2]string{
			{"og:title", siteName}, {"og:description", siteDescription}, {"og:url", siteURL},
			{"og:site_name", siteName}, {"og:type", "website"},
		},
		JSONLD: map[string]string{
			"@context": "https://schema.org", "@type": "WebSite", "name": siteName, "url": siteURL, "description": siteDescription,
		},
	})
	body := renderBody("home", homeView{Year: time.Now().In(kst).Year(), Posts: items})
	s.pages.render(w, 200, head, body, map[string]any{"page": "home", "posts": items, "total": total, "pageSize": homePageSize})
}

type postView struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	URLSlug     *string `json:"urlSlug"`
	Category    *string `json:"category"`
	Content     string  `json:"content"`
	Excerpt     *string `json:"-"`
	CoverImage  *string `json:"coverImage"`
	PublishedAt *jsTime `json:"publishedAt"`
	Author      *author `json:"author"`
}

type postPageView struct {
	Year     int
	Post     *postView
	HTML     template.HTML
	Headings []heading
	MinLevel int
}

type jsonLDPerson struct {
	Type string `json:"@type"`
	Name string `json:"name"`
}

type blogPostingLD struct {
	Context          string        `json:"@context"`
	Type             string        `json:"@type"`
	Headline         string        `json:"headline"`
	DatePublished    string        `json:"datePublished,omitempty"`
	DateModified     string        `json:"dateModified,omitempty"`
	Image            string        `json:"image,omitempty"`
	Author           *jsonLDPerson `json:"author,omitempty"`
	Publisher        any           `json:"publisher"`
	MainEntityOfPage any           `json:"mainEntityOfPage"`
}

func (s *server) findPostByURLSlug(ctx context.Context, urlSlug string) (*postView, error) {
	var p postView
	var pub *time.Time
	var name, image *string
	err := s.db.QueryRow(ctx, `
		SELECT p.id, p.title, p."urlSlug", p.category, p.content, p.excerpt, p."coverImage", p."publishedAt", u.name, u.image
		FROM post p LEFT JOIN "user" u ON p."authorId" = u.id
		WHERE p."urlSlug" = $1`, urlSlug).Scan(&p.ID, &p.Title, &p.URLSlug, &p.Category, &p.Content, &p.Excerpt, &p.CoverImage, &pub, &name, &image)
	if err != nil {
		return nil, err
	}
	p.PublishedAt = ptrTime(pub)
	p.Author = authorOrNil(name, image)
	return &p, nil
}

func (s *server) postPage(w http.ResponseWriter, r *http.Request, urlSlug string) {
	p, err := s.findPostByURLSlug(r.Context(), urlSlug)
	if errors.Is(err, pgx.ErrNoRows) {
		// 예전 한글 slug 로 들어오면 영어 urlSlug 로 영구 이동
		var target *string
		err2 := s.db.QueryRow(r.Context(), `SELECT "urlSlug" FROM post WHERE slug = $1`, urlSlug).Scan(&target)
		if err2 == nil && target != nil && *target != "" {
			http.Redirect(w, r, "/"+url.PathEscape(*target), http.StatusMovedPermanently)
			return
		}
		s.notFoundPage(w, r)
		return
	}
	if err != nil {
		log.Printf("postPage: %v", err)
		http.Error(w, "Internal Server Error", 500)
		return
	}
	canonical := siteURL + "/" + deref(p.URLSlug)
	cover := deref(p.CoverImage)
	desc := deref(p.Excerpt)
	og := [][2]string{{"og:title", p.Title}}
	tw := [][2]string{}
	if desc != "" {
		og = append(og, [2]string{"og:description", desc})
	}
	og = append(og, [2]string{"og:url", canonical}, [2]string{"og:site_name", siteName})
	if cover != "" {
		og = append(og, [2]string{"og:image", cover})
	}
	og = append(og, [2]string{"og:type", "article"})
	if p.PublishedAt != nil {
		og = append(og, [2]string{"article:published_time", isoString(p.PublishedAt.Time)})
	}
	if cover != "" {
		tw = append(tw, [2]string{"twitter:card", "summary_large_image"})
	} else {
		tw = append(tw, [2]string{"twitter:card", "summary"})
	}
	tw = append(tw, [2]string{"twitter:title", p.Title})
	if desc != "" {
		tw = append(tw, [2]string{"twitter:description", desc})
	}
	if cover != "" {
		tw = append(tw, [2]string{"twitter:image", cover})
	}
	ld := blogPostingLD{
		Context: "https://schema.org", Type: "BlogPosting", Headline: p.Title, Image: cover,
		Publisher:        map[string]string{"@type": "Organization", "name": siteName, "url": siteURL},
		MainEntityOfPage: map[string]string{"@type": "WebPage", "@id": canonical},
	}
	if p.PublishedAt != nil {
		ld.DatePublished = isoString(p.PublishedAt.Time)
		ld.DateModified = ld.DatePublished
	}
	if p.Author != nil && p.Author.Name != nil && *p.Author.Name != "" {
		ld.Author = &jsonLDPerson{Type: "Person", Name: *p.Author.Name}
	}
	head := renderHead(headMeta{
		Title: p.Title + " | " + siteName, Description: desc, Canonical: canonical, OG: og, Twitter: tw, JSONLD: ld,
	})
	hs := extractHeadings(p.Content)
	minLevel := 3
	for _, h := range hs {
		minLevel = min(minLevel, h.Level)
	}
	body := renderBody("post", postPageView{
		Year: time.Now().In(kst).Year(), Post: p, HTML: template.HTML(renderMarkdown(p.Content, cover)), Headings: hs, MinLevel: minLevel,
	})
	s.pages.render(w, 200, head, body, map[string]any{"page": "post", "post": p})
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func (s *server) notFoundPage(w http.ResponseWriter, r *http.Request) {
	head := renderHead(headMeta{Title: siteName, Description: siteDescription, NoIndex: true})
	body := renderBody("notfound", map[string]int{"Year": time.Now().In(kst).Year()})
	s.pages.render(w, 404, head, body, map[string]string{"page": "notfound"})
}

// adminPage: 로그인 안 했으면 예전 미들웨어처럼 로그인 화면으로 307, 했으면 SPA 를 연다. /admin 은 /admin/posts 로.
func (s *server) adminPage(w http.ResponseWriter, r *http.Request) {
	if s.currentSession(r, w) == nil {
		http.Redirect(w, r, "/api/auth/signin", http.StatusTemporaryRedirect)
		return
	}
	if r.URL.Path == "/admin" {
		http.Redirect(w, r, "/admin/posts", http.StatusTemporaryRedirect)
		return
	}
	switch r.URL.Path {
	case "/admin/posts", "/admin/write", "/admin/stats":
	default:
		s.notFoundPage(w, r)
		return
	}
	head := renderHead(headMeta{Title: siteName, Description: siteDescription, NoIndex: true})
	s.pages.render(w, 200, head, "", map[string]string{"page": "admin"})
}

// staticFile 은 Vite 빌드 산출물(/assets/*, /icon.svg 등)을 내준다. 운영에서는 nginx 가 먼저 처리하고, 개발·예비용이다.
func (s *server) staticFile(w http.ResponseWriter, r *http.Request) {
	if !s.serveStatic(w, r) {
		s.notFoundPage(w, r)
	}
}

func (s *server) serveStatic(w http.ResponseWriter, r *http.Request) bool {
	rel := path.Clean("/" + r.URL.Path)
	if rel == "/" || rel == "/index.html" {
		return false
	}
	full := filepath.Join(s.pages.dir, filepath.FromSlash(rel))
	if !strings.HasPrefix(full, filepath.Clean(s.pages.dir)+string(filepath.Separator)) {
		return false
	}
	st, err := os.Stat(full)
	if err != nil || st.IsDir() {
		return false
	}
	if strings.HasPrefix(rel, "/assets/") {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	}
	http.ServeFile(w, r, full)
	return true
}

func (s *server) catchAll(w http.ResponseWriter, r *http.Request) {
	p := r.PathValue("path")
	if strings.HasPrefix(p, "api/") || p == "api" {
		s.notFoundPage(w, r)
		return
	}
	if s.serveStatic(w, r) {
		return
	}
	if p == "" || strings.Contains(p, "/") || p == "index.html" {
		s.notFoundPage(w, r)
		return
	}
	s.postPage(w, r, p)
}

// ─── robots / sitemap ───

func robots(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte("User-Agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: " + siteURL + "/sitemap.xml\n"))
}

func (s *server) sitemap(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), `SELECT "urlSlug", "updatedAt" FROM post WHERE published = true`)
	if err != nil {
		log.Printf("sitemap: %v", err)
		http.Error(w, "Internal Server Error", 500)
		return
	}
	defer rows.Close()
	var buf bytes.Buffer
	buf.WriteString("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n")
	entry := func(loc, lastmod, freq, prio string) {
		buf.WriteString("<url>\n<loc>")
		template.HTMLEscape(&buf, []byte(loc))
		buf.WriteString("</loc>\n<lastmod>" + lastmod + "</lastmod>\n<changefreq>" + freq + "</changefreq>\n<priority>" + prio + "</priority>\n</url>\n")
	}
	entry(siteURL, isoString(time.Now()), "daily", "1")
	for rows.Next() {
		var slug *string
		var updated time.Time
		if err := rows.Scan(&slug, &updated); err != nil {
			http.Error(w, "Internal Server Error", 500)
			return
		}
		entry(siteURL+"/"+deref(slug), isoString(updated), "weekly", "0.8")
	}
	if rows.Err() != nil {
		http.Error(w, "Internal Server Error", 500)
		return
	}
	buf.WriteString("</urlset>\n")
	w.Header().Set("Content-Type", "application/xml")
	w.Write(buf.Bytes())
}
