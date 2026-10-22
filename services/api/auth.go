package main

// GitHub OAuth 로그인 + DB 세션. 예전 Auth.js(@auth/drizzle-adapter, database 세션 전략)와 같은 테이블·쿠키 이름·경로를 쓴다.
//  - 콜백: /api/auth/callback/github (GitHub OAuth 앱 설정 그대로)
//  - 세션: "session" 테이블의 sessionToken 을 (__Secure-)authjs.session-token 쿠키에 담는다 → 전환 전 로그인 세션도 그대로 유효
//  - 사용자/계정: "user", "account" 테이블을 Auth.js 어댑터와 같은 방식으로 찾고 없으면 만든다
//  - AUTH_ALLOWED_USERS 에 있는 GitHub login 만 로그인할 수 있다

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"log"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// GitHub 주소. 테스트에서 가짜 서버로 바꾼다.
var (
	githubWeb = "https://github.com"
	githubAPI = "https://api.github.com"
)

const (
	sessionMaxAge    = 30 * 24 * time.Hour // Auth.js 기본값
	sessionUpdateAge = 24 * time.Hour
)

type session struct {
	UserID  string
	Name    *string
	Email   *string
	Image   *string
	Role    string
	Expires time.Time
}

func (s *server) cookieName(base string) string {
	if s.cfg.secureCookies {
		return "__Secure-authjs." + base
	}
	return "authjs." + base
}

func (s *server) setCookie(w http.ResponseWriter, base, value string, maxAge time.Duration) {
	c := &http.Cookie{
		Name: s.cookieName(base), Value: value, Path: "/", HttpOnly: true,
		Secure: s.cfg.secureCookies, SameSite: http.SameSiteLaxMode,
	}
	if maxAge > 0 {
		c.MaxAge = int(maxAge.Seconds())
		c.Expires = time.Now().Add(maxAge)
	} else if maxAge < 0 {
		c.MaxAge = -1
		c.Expires = time.Unix(0, 0)
	}
	http.SetCookie(w, c)
}

// currentSession 은 요청의 세션 쿠키로 로그인 사용자를 찾는다. 만료가 하루 이상 지났으면 Auth.js 처럼 만료를 연장한다.
func (s *server) currentSession(r *http.Request, w http.ResponseWriter) *session {
	c, err := r.Cookie(s.cookieName("session-token"))
	if err != nil || c.Value == "" {
		return nil
	}
	var sess session
	err = s.db.QueryRow(r.Context(), `
		SELECT s.expires, u.id, u.name, u.email, u.image, u.role::text
		FROM session s JOIN "user" u ON u.id = s."userId"
		WHERE s."sessionToken" = $1`, c.Value).Scan(&sess.Expires, &sess.UserID, &sess.Name, &sess.Email, &sess.Image, &sess.Role)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			log.Printf("session lookup: %v", err)
		}
		return nil
	}
	now := time.Now().UTC()
	if !sess.Expires.After(now) {
		s.db.Exec(r.Context(), `DELETE FROM session WHERE "sessionToken" = $1`, c.Value)
		return nil
	}
	if sess.Expires.Add(-sessionMaxAge).Add(sessionUpdateAge).Before(now) {
		exp := nowMs().Add(sessionMaxAge)
		if _, err := s.db.Exec(r.Context(), `UPDATE session SET expires = $1 WHERE "sessionToken" = $2`, exp, c.Value); err == nil {
			sess.Expires = exp
			if w != nil {
				s.setCookie(w, "session-token", c.Value, sessionMaxAge)
			}
		}
	}
	return &sess
}

func (s *server) authProviders(w http.ResponseWriter, r *http.Request) {
	base := s.cfg.authURL + "/api/auth"
	writeJSON(w, 200, map[string]any{"github": map[string]string{
		"id": "github", "name": "GitHub", "type": "oauth",
		"signinUrl": base + "/signin/github", "callbackUrl": base + "/callback/github",
	}})
}

type sessionUser struct {
	Name  *string `json:"name"`
	Email *string `json:"email"`
	Image *string `json:"image"`
	ID    string  `json:"id"`
	Role  string  `json:"role"`
}

func (s *server) authSession(w http.ResponseWriter, r *http.Request) {
	sess := s.currentSession(r, w)
	if sess == nil {
		writeJSON(w, 200, nil)
		return
	}
	writeJSON(w, 200, map[string]any{
		"user":    sessionUser{Name: sess.Name, Email: sess.Email, Image: sess.Image, ID: sess.UserID, Role: sess.Role},
		"expires": isoString(sess.Expires),
	})
}

func randomToken(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// csrf: 로그인/로그아웃 폼에 넣는 토큰(쿠키와 같은 값을 폼으로 다시 보내는 double-submit).
func (s *server) csrfToken(w http.ResponseWriter, r *http.Request) string {
	if c, err := r.Cookie(s.cookieName("csrf-token")); err == nil && c.Value != "" {
		return c.Value
	}
	t := randomToken(32)
	s.setCookie(w, "csrf-token", t, 0)
	return t
}

func (s *server) checkCSRF(r *http.Request) bool {
	c, err := r.Cookie(s.cookieName("csrf-token"))
	if err != nil || c.Value == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(c.Value), []byte(r.FormValue("csrfToken"))) == 1
}

func (s *server) authCSRF(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]string{"csrfToken": s.csrfToken(w, r)})
}

// safeCallback 은 로그인 뒤 돌아갈 주소를 같은 사이트 안으로만 허용한다.
func (s *server) safeCallback(raw string) string {
	if raw == "" {
		return ""
	}
	if strings.HasPrefix(raw, s.cfg.authURL+"/") || raw == s.cfg.authURL {
		raw = strings.TrimPrefix(raw, s.cfg.authURL)
		if raw == "" {
			raw = "/"
		}
	}
	if !strings.HasPrefix(raw, "/") || strings.HasPrefix(raw, "//") || strings.HasPrefix(raw, "/\\") {
		return ""
	}
	return raw
}

func authPage(w http.ResponseWriter, status int, title, inner string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	fmt.Fprintf(w, `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="robots" content="noindex"/><title>%s</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:#f9fafb;color:#111827}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;min-width:280px;text-align:center}
button,a.btn{display:inline-block;margin-top:16px;padding:10px 18px;border-radius:8px;border:0;background:#24292f;color:#fff;font-size:15px;cursor:pointer;text-decoration:none}
p{color:#6b7280;font-size:14px}</style></head><body><div class="card">%s</div></body></html>`, html.EscapeString(title), inner)
}

func (s *server) authSigninPage(w http.ResponseWriter, r *http.Request) {
	cb := s.safeCallback(r.URL.Query().Get("callbackUrl"))
	if cb == "" {
		cb = "/admin"
	}
	t := s.csrfToken(w, r)
	authPage(w, 200, "Sign In", fmt.Sprintf(`<h1 style="font-size:20px;margin:0">blog.divops.kr</h1>
<form action="/api/auth/signin/github" method="POST"><input type="hidden" name="csrfToken" value="%s"/><input type="hidden" name="callbackUrl" value="%s"/>
<button type="submit">Sign in with GitHub</button></form>`, html.EscapeString(t), html.EscapeString(cb)))
}

// signed 쿠키: 값 + "." + HMAC-SHA256(AUTH_SECRET). PKCE verifier·state 가 위조되지 않게 한다.
func (s *server) sign(v string) string {
	return v + "." + base64.RawURLEncoding.EncodeToString(hmacSHA256([]byte(s.cfg.authSecret), v))
}

func (s *server) unsign(v string) (string, bool) {
	i := strings.LastIndexByte(v, '.')
	if i < 0 {
		return "", false
	}
	if !hmac.Equal([]byte(s.sign(v[:i])), []byte(v)) {
		return "", false
	}
	return v[:i], true
}

func (s *server) redirectURI() string {
	return s.cfg.authURL + "/api/auth/callback/github"
}

// authSigninGithub: GitHub authorize 로 302. Auth.js 와 같은 scope·PKCE(S256) 에 state 를 더한다.
func (s *server) authSigninGithub(w http.ResponseWriter, r *http.Request) {
	if s.cfg.githubID == "" || s.cfg.authSecret == "" {
		http.Redirect(w, r, "/api/auth/error?error=Configuration", http.StatusFound)
		return
	}
	if r.Method == http.MethodPost && !s.checkCSRF(r) {
		// Auth.js 처럼 CSRF 가 안 맞으면 로그인 화면으로 돌려보낸다.
		http.Redirect(w, r, "/api/auth/signin?csrf=true", http.StatusFound)
		return
	}
	cb := s.safeCallback(r.FormValue("callbackUrl"))
	if cb == "" {
		cb = "/admin"
	}
	verifier := randomToken(32)
	state := randomToken(24)
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])
	s.setCookie(w, "pkce.code_verifier", s.sign(verifier), 15*time.Minute)
	s.setCookie(w, "state", s.sign(state), 15*time.Minute)
	s.setCookie(w, "callback-url", cb, 0)

	q := url.Values{}
	q.Set("scope", "read:user user:email")
	q.Set("response_type", "code")
	q.Set("client_id", s.cfg.githubID)
	q.Set("redirect_uri", s.redirectURI())
	q.Set("state", state)
	q.Set("code_challenge", challenge)
	q.Set("code_challenge_method", "S256")
	http.Redirect(w, r, githubWeb+"/login/oauth/authorize?"+q.Encode(), http.StatusFound)
}

type githubProfile struct {
	ID        int64   `json:"id"`
	Login     string  `json:"login"`
	Email     *string `json:"email"`
	AvatarURL *string `json:"avatar_url"`
}

func (s *server) authError(w http.ResponseWriter, r *http.Request, code string, err error) {
	if err != nil {
		log.Printf("auth %s: %v", code, err)
	}
	http.Redirect(w, r, "/api/auth/error?error="+url.QueryEscape(code), http.StatusFound)
}

func (s *server) authCallbackGithub(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	if e := q.Get("error"); e != "" {
		s.authError(w, r, "OAuthCallbackError", errors.New(e))
		return
	}
	readSigned := func(base string) string {
		c, err := r.Cookie(s.cookieName(base))
		if err != nil {
			return ""
		}
		v, ok := s.unsign(c.Value)
		if !ok {
			return ""
		}
		return v
	}
	verifier := readSigned("pkce.code_verifier")
	state := readSigned("state")
	s.setCookie(w, "pkce.code_verifier", "", -1)
	s.setCookie(w, "state", "", -1)
	if verifier == "" || state == "" || subtle.ConstantTimeCompare([]byte(state), []byte(q.Get("state"))) != 1 {
		s.authError(w, r, "OAuthCallbackError", errors.New("state/pkce mismatch"))
		return
	}
	token, err := s.exchangeCode(r.Context(), q.Get("code"), verifier)
	if err != nil {
		s.authError(w, r, "OAuthCallbackError", err)
		return
	}
	prof, err := s.githubUser(r.Context(), token.AccessToken)
	if err != nil {
		s.authError(w, r, "OAuthCallbackError", err)
		return
	}
	// 예전 signIn 콜백은 목록이 비면 누구나 허용했다. 글쓰기 권한이 걸린 일이라 여기서는 비어 있으면 아무도 허용하지 않는다.
	if !slices.Contains(s.cfg.allowedUsers, prof.Login) {
		s.authError(w, r, "AccessDenied", fmt.Errorf("login %q not allowed", prof.Login))
		return
	}
	userID, err := s.upsertGithubUser(r.Context(), prof, token)
	if err != nil {
		s.authError(w, r, "OAuthAccountNotLinked", err)
		return
	}
	sessionToken := uuidV4()
	if _, err := s.db.Exec(r.Context(), `INSERT INTO session ("sessionToken", "userId", expires) VALUES ($1, $2, $3)`,
		sessionToken, userID, nowMs().Add(sessionMaxAge)); err != nil {
		s.authError(w, r, "Configuration", err)
		return
	}
	s.setCookie(w, "session-token", sessionToken, sessionMaxAge)
	cb := "/admin"
	if c, err := r.Cookie(s.cookieName("callback-url")); err == nil {
		if v := s.safeCallback(c.Value); v != "" {
			cb = v
		}
	}
	http.Redirect(w, r, cb, http.StatusFound)
}

type ghToken struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	Scope       string `json:"scope"`
	Error       string `json:"error"`
}

func (s *server) exchangeCode(ctx context.Context, code, verifier string) (*ghToken, error) {
	form := url.Values{}
	form.Set("client_id", s.cfg.githubID)
	form.Set("client_secret", s.cfg.githubSecret)
	form.Set("code", code)
	form.Set("redirect_uri", s.redirectURI())
	form.Set("code_verifier", verifier)
	req, _ := http.NewRequestWithContext(ctx, "POST", githubWeb+"/login/oauth/access_token", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	res, err := s.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	var t ghToken
	if err := json.NewDecoder(res.Body).Decode(&t); err != nil {
		return nil, err
	}
	if t.Error != "" || t.AccessToken == "" {
		return nil, fmt.Errorf("token exchange failed: %s", t.Error)
	}
	return &t, nil
}

func (s *server) githubGet(ctx context.Context, path, token string, out any) error {
	req, _ := http.NewRequestWithContext(ctx, "GET", githubAPI+path, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("User-Agent", "blog.divops.kr")
	req.Header.Set("Accept", "application/vnd.github+json")
	res, err := s.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return fmt.Errorf("github %s: %s", path, res.Status)
	}
	return json.NewDecoder(res.Body).Decode(out)
}

func (s *server) githubUser(ctx context.Context, token string) (*githubProfile, error) {
	var p githubProfile
	if err := s.githubGet(ctx, "/user", token, &p); err != nil {
		return nil, err
	}
	if p.Email == nil || *p.Email == "" {
		// Auth.js GitHub provider 처럼 공개 이메일이 없으면 primary 이메일을 쓴다.
		var emails []struct {
			Email   string `json:"email"`
			Primary bool   `json:"primary"`
		}
		if err := s.githubGet(ctx, "/user/emails", token, &emails); err == nil && len(emails) > 0 {
			e := emails[0].Email
			for _, x := range emails {
				if x.Primary {
					e = x.Email
					break
				}
			}
			p.Email = &e
		}
	}
	return &p, nil
}

// upsertGithubUser 는 Auth.js 어댑터 순서를 따른다: account 로 찾기 → (allowDangerousEmailAccountLinking) email 로 찾아 연결 → 새로 만들기.
func (s *server) upsertGithubUser(ctx context.Context, p *githubProfile, t *ghToken) (string, error) {
	providerAccountID := strconv.FormatInt(p.ID, 10)
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var userID string
	err = tx.QueryRow(ctx, `SELECT "userId" FROM account WHERE provider = 'github' AND "providerAccountId" = $1`, providerAccountID).Scan(&userID)
	if err == nil {
		return userID, tx.Commit(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	if p.Email != nil && *p.Email != "" {
		err = tx.QueryRow(ctx, `SELECT id FROM "user" WHERE email = $1`, *p.Email).Scan(&userID)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return "", err
		}
	}
	if userID == "" {
		userID = uuidV4()
		now := nowMs()
		if _, err := tx.Exec(ctx, `INSERT INTO "user" (id, name, email, image, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $5)`,
			userID, p.Login, p.Email, p.AvatarURL, now); err != nil {
			return "", err
		}
	}
	if _, err := tx.Exec(ctx, `INSERT INTO account ("userId", type, provider, "providerAccountId", access_token, token_type, scope) VALUES ($1, 'oauth', 'github', $2, $3, $4, $5)`,
		userID, providerAccountID, t.AccessToken, t.TokenType, t.Scope); err != nil {
		return "", err
	}
	return userID, tx.Commit(ctx)
}

func (s *server) authSignoutPage(w http.ResponseWriter, r *http.Request) {
	t := s.csrfToken(w, r)
	authPage(w, 200, "Sign Out", fmt.Sprintf(`<h1 style="font-size:20px;margin:0">Sign Out</h1><p>로그아웃할까요?</p>
<form action="/api/auth/signout" method="POST"><input type="hidden" name="csrfToken" value="%s"/><button type="submit">Sign out</button></form>`, html.EscapeString(t)))
}

func (s *server) authSignout(w http.ResponseWriter, r *http.Request) {
	if !s.checkCSRF(r) {
		http.Redirect(w, r, "/api/auth/signout", http.StatusFound)
		return
	}
	if c, err := r.Cookie(s.cookieName("session-token")); err == nil && c.Value != "" {
		s.db.Exec(r.Context(), `DELETE FROM session WHERE "sessionToken" = $1`, c.Value)
	}
	s.setCookie(w, "session-token", "", -1)
	cb := s.safeCallback(r.FormValue("callbackUrl"))
	if cb == "" {
		cb = "/"
	}
	http.Redirect(w, r, cb, http.StatusFound)
}

func (s *server) authErrorPage(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("error")
	msg := "로그인 중 문제가 생겼어요."
	status := 500
	switch code {
	case "AccessDenied":
		msg, status = "허용된 사용자만 로그인할 수 있어요.", 403
	case "OAuthCallbackError", "OAuthAccountNotLinked":
		status = 400
	}
	authPage(w, status, "Error", fmt.Sprintf(`<h1 style="font-size:20px;margin:0">%s</h1><p>%s</p><a class="btn" href="/api/auth/signin">다시 로그인</a>`,
		html.EscapeString(code), html.EscapeString(msg)))
}
