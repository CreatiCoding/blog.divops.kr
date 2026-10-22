package main

import (
	"bytes"
	"regexp"
	"strconv"
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
	"github.com/yuin/goldmark/text"
)

// 크롤러용 본문 HTML. 브라우저에서는 React(react-markdown + remark-gfm + rehype-raw)가 같은 마크다운을 다시 그린다.
var md = goldmark.New(
	goldmark.WithExtensions(extension.GFM),
	goldmark.WithParserOptions(parser.WithAutoHeadingID()),
	goldmark.WithRendererOptions(html.WithUnsafe()), // 예전 rehype-raw 처럼 본문의 raw HTML 을 살린다(작성자는 허용된 관리자뿐)
)

var (
	headingSlugStrip = regexp.MustCompile(`[^a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s-]`)
	headingRe        = regexp.MustCompile(`(?m)^(#{1,3})\s+(.+)$`)
)

// generateSlug 는 프론트 heading-utils 의 generateSlug 와 같다(목차 앵커 id).
func generateSlug(t string) string {
	s := strings.ToLower(t)
	s = headingSlugStrip.ReplaceAllString(s, "")
	s = spacesRe.ReplaceAllString(s, "-")
	s = dashesRe.ReplaceAllString(s, "-")
	return edgeDashRe.ReplaceAllString(s, "")
}

type slugTracker map[string]int

func (t slugTracker) next(text string) string {
	base := generateSlug(text)
	n := t[base]
	t[base] = n + 1
	if n == 0 {
		return base
	}
	return base + "-" + strconv.Itoa(n)
}

type heading struct {
	ID    string
	Text  string
	Level int
}

// extractHeadings 는 프론트 extractHeadings 와 같다(본문 원문에서 #~### 줄을 뽑는다).
func extractHeadings(content string) []heading {
	tr := slugTracker{}
	var out []heading
	for _, m := range headingRe.FindAllStringSubmatch(content, -1) {
		t := strings.TrimSpace(m[2])
		out = append(out, heading{ID: tr.next(t), Text: t, Level: len(m[1])})
	}
	return out
}

type headingIDs struct{ tr slugTracker }

func (h *headingIDs) Generate(value []byte, _ ast.NodeKind) []byte {
	return []byte(h.tr.next(strings.TrimSpace(string(value))))
}
func (h *headingIDs) Put(value []byte) { h.tr[string(value)]++ }

// renderMarkdown 은 본문을 HTML 로 만든다. 표지 이미지와 같은 첫 이미지는 프론트처럼 본문에서 뺀다.
func renderMarkdown(src, coverImage string) string {
	b := []byte(src)
	ctx := parser.NewContext(parser.WithIDs(&headingIDs{tr: slugTracker{}}))
	doc := md.Parser().Parse(text.NewReader(b), parser.WithContext(ctx))
	if coverImage != "" {
		var target ast.Node
		ast.Walk(doc, func(n ast.Node, entering bool) (ast.WalkStatus, error) {
			if img, ok := n.(*ast.Image); ok && entering && string(img.Destination) == coverImage {
				target = n
				return ast.WalkStop, nil
			}
			return ast.WalkContinue, nil
		})
		if target != nil && target.Parent() != nil {
			target.Parent().RemoveChild(target.Parent(), target)
		}
	}
	var buf bytes.Buffer
	if err := md.Renderer().Render(&buf, b, doc); err != nil {
		return ""
	}
	return buf.String()
}
