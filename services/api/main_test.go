package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestGenerateSlug(t *testing.T) {
	cases := map[string]string{
		"CLI 개발에서 고려할 점들":       "cli-개발에서-고려할-점들",
		"register가 뭐길래?":        "register가-뭐길래",
		"ts-node vs tsx, 직접 비교": "ts-node-vs-tsx-직접-비교",
		"  --Hello  World--  ":    "hello-world",
	}
	for in, want := range cases {
		if got := generateSlug(in); got != want {
			t.Errorf("generateSlug(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestExtractHeadingsDuplicates(t *testing.T) {
	hs := extractHeadings("# A\n## A\ntext\n### B\n#### C\n")
	if len(hs) != 3 || hs[0].ID != "a" || hs[1].ID != "a-1" || hs[2].ID != "b" || hs[2].Level != 3 {
		t.Fatalf("unexpected headings: %+v", hs)
	}
}

func TestRenderMarkdownSkipsCoverAndAddsIDs(t *testing.T) {
	src := "![cover](https://x/c.png)\n\n## 제목 하나\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n<div class=\"raw\">raw</div>\n\n![other](https://x/o.png)\n"
	out := renderMarkdown(src, "https://x/c.png")
	if strings.Contains(out, "c.png") {
		t.Errorf("cover image should be skipped: %s", out)
	}
	for _, want := range []string{`id="제목-하나"`, "<table>", `<div class="raw">raw</div>`, "o.png"} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q in %s", want, out)
		}
	}
}

func TestISOString(t *testing.T) {
	tm := time.Date(2025, 6, 28, 19, 46, 11, 513_900_000, time.UTC)
	if got := isoString(tm); got != "2025-06-28T19:46:11.513Z" {
		t.Errorf("isoString = %s", got)
	}
}

func TestSlugWith(t *testing.T) {
	if got := slugWith(koSlugStrip, "TSC 빌드 없이 TypeScript CLI 툴 개발하기!"); got != "tsc-빌드-없이-typescript-cli-툴-개발하기" {
		t.Errorf("ko slug = %q", got)
	}
	if got := slugWith(enSlugStrip, "Developing TypeScript CLI tools without TSC build"); got != "developing-typescript-cli-tools-without-tsc-build" {
		t.Errorf("en slug = %q", got)
	}
}

func TestSafeCallback(t *testing.T) {
	s := &server{cfg: config{authURL: "https://blog.divops.kr"}}
	cases := map[string]string{
		"/admin":                        "/admin",
		"https://blog.divops.kr/admin":  "/admin",
		"https://blog.divops.kr":        "/",
		"//evil.com":                    "",
		"https://evil.com/admin":        "",
		"https://blog.divops.kr.evil.x": "",
		"/\\evil.com":                   "",
	}
	for in, want := range cases {
		if got := s.safeCallback(in); got != want {
			t.Errorf("safeCallback(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestSignUnsign(t *testing.T) {
	s := &server{cfg: config{authSecret: "secret"}}
	v := s.sign("abc.def")
	if got, ok := s.unsign(v); !ok || got != "abc.def" {
		t.Fatalf("unsign(sign) = %q %v", got, ok)
	}
	if _, ok := s.unsign(v + "x"); ok {
		t.Fatal("tampered value accepted")
	}
	other := &server{cfg: config{authSecret: "other"}}
	if _, ok := other.unsign(v); ok {
		t.Fatal("value signed with another secret accepted")
	}
}

func TestEncodeURIComponent(t *testing.T) {
	if got := encodeURIComponent(`["a1","b2"]`); got != "%5B%22a1%22%2C%22b2%22%5D" {
		t.Errorf("got %s", got)
	}
}

func TestExtractFirstImageURL(t *testing.T) {
	if got := extractFirstImageURL("hi ![a](https://x/1.png) ![b](https://x/2.png)"); got != "https://x/1.png" {
		t.Errorf("got %q", got)
	}
	if got := extractFirstImageURL("no image"); got != "" {
		t.Errorf("got %q", got)
	}
}

func testRenderer(t *testing.T) *pageRenderer {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "index.html"), []byte(`<html><head><!--ssr-head--></head><body><div id="root"><!--ssr-body--></div><!--ssr-data--></body></html>`), 0o644)
	os.MkdirAll(filepath.Join(dir, "assets"), 0o755)
	os.WriteFile(filepath.Join(dir, "assets", "a.js"), []byte("js"), 0o644)
	p, err := newPageRenderer(dir)
	if err != nil {
		t.Fatal(err)
	}
	return p
}

func TestPageRendererInjects(t *testing.T) {
	p := testRenderer(t)
	rec := httptest.NewRecorder()
	head := renderHead(headMeta{Title: "제목 <b>", Description: "설명 \"따옴표\"", Canonical: siteURL + "/x", JSONLD: map[string]string{"headline": "</script><x>"}})
	p.render(rec, 200, head, "<p>본문</p>", map[string]string{"content": "</script>"})
	out := rec.Body.String()
	for _, want := range []string{"<title>제목 &lt;b&gt;</title>", `content="설명 &#34;따옴표&#34;"`, `<link rel="canonical" href="https://blog.divops.kr/x"/>`, "<p>본문</p>", `</script>`} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q in %s", want, out)
		}
	}
	if strings.Count(out, "</script>") != 2 { // JSON-LD 와 __DATA__ 의 닫는 태그만
		t.Errorf("unexpected </script> count in %s", out)
	}
}

func TestStaticAndRobots(t *testing.T) {
	s := &server{pages: testRenderer(t)}
	rec := httptest.NewRecorder()
	s.staticFile(rec, httptest.NewRequest("GET", "/assets/a.js", nil))
	if rec.Code != 200 || rec.Body.String() != "js" {
		t.Errorf("static: %d %q", rec.Code, rec.Body.String())
	}
	rec = httptest.NewRecorder()
	if s.serveStatic(rec, httptest.NewRequest("GET", "/../../etc/passwd", nil)) {
		t.Error("path traversal served")
	}
	rec = httptest.NewRecorder()
	robots(rec, httptest.NewRequest("GET", "/robots.txt", nil))
	want := "User-Agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: https://blog.divops.kr/sitemap.xml\n"
	if rec.Body.String() != want {
		t.Errorf("robots = %q", rec.Body.String())
	}
}

func TestSQLRequiresToken(t *testing.T) {
	cases := []struct {
		token, header string
		want          int
	}{
		{"", "Bearer ", 401},
		{"tok", "", 401},
		{"tok", "Bearer wrong", 401},
	}
	for _, c := range cases {
		s := &server{cfg: config{sqlToken: c.token}}
		req := httptest.NewRequest("POST", "/api/sql", strings.NewReader(`{"query":"select 1"}`))
		if c.header != "" {
			req.Header.Set("Authorization", c.header)
		}
		rec := httptest.NewRecorder()
		s.sqlExec(rec, req)
		if rec.Code != c.want {
			t.Errorf("token=%q header=%q: got %d", c.token, c.header, rec.Code)
		}
	}
}

func TestAWSEscapePath(t *testing.T) {
	if got := awsEscapePath("uploads/1-a b.png"); got != "uploads/1-a%20b.png" {
		t.Errorf("got %s", got)
	}
}

var _ = http.StatusOK
