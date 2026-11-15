# blog.divops.kr

## 구조 (2026-10 전환 후)

- `services/blog`: Vite + React 화면. `Dockerfile`(Dokploy 가 이 경로를 씀, 컨텍스트는 저장소 루트), `nginx.conf`, `entrypoint.sh` 도 여기.
- `services/api`: Go 서버. 모든 `/api/*`, 화면 HTML(SEO 메타·본문 서버 주입), `sitemap.xml`, `robots.txt`, GitHub OAuth.
- 런타임 이미지는 nginx:alpine + Go 바이너리. Node 없음.

## 지켜야 할 것

- **DB 스키마를 바꾸지 않는다.** 마이그레이션 실행 금지. Go 는 기존 테이블(`post`, `user`, `account`, `session`, `page_view`, `site_visit`)을 그대로 쓴다.
- 외부가 기대는 경로 유지: `/api/auth/callback/github`(GitHub OAuth 앱), `/sitemap.xml`(indexing.yml), `/api/sql`(SQL_TOKEN Bearer), 글 URL `/<urlSlug>`, 옛 한글 slug → 301.
- 세션 쿠키 이름 `__Secure-authjs.session-token`, 값은 `session` 테이블의 `sessionToken`(Auth.js database 세션과 호환).
- 글 상세·홈의 `<head>` 와 본문은 Go 가 넣는다(`services/api/pages.go`). Go 템플릿의 Tailwind 클래스는 `globals.css` 의 `@source "../../api"` 로 생성된다.

## 로컬 검증

- 프론트: `npx -y -p node@22 -p corepack -c 'corepack yarn build'` (저장소 루트)
- API: `cd services/api && go vet ./... && go test ./...`
- 통합: `docker build -f services/blog/Dockerfile .` 후 3000 포트, DB 는 백업 덤프를 로컬 postgres 에 복원해서.

## 배포

- `main` push → Dokploy 앱 `PAsCNfn9M18-gIzzR9Zld`. 자동 배포가 안 보이면 `application.deploy` 를 직접 호출.
- deployment 가 `done` 이고 라이브에 반영된 걸 확인한 뒤에 "배포됐다"고 말한다.

## iOS 홈 화면 앱(standalone): 상태 표시줄 위 흐림 막기

홈 화면에 추가해서 열면 맨 위 시계·배터리 줄에 흐림(블러) 띠가 생기는 문제. claude-bridge 에서 밝혀 고쳤고(SPEC 1.74, 1.163) 다른 사이트도 같은 방식으로 맞춘다.

- 원인: iOS 26 홈 화면 앱은 화면 맨 위 4px 아래 요소에서 부모로 올라가며 **폭 90% 이상인 `position: fixed`/`sticky` 상자**를 찾는다. 있으면 그 길에서 처음 만난 배경색으로 상태 표시줄을 칠하고, **없으면 흐리게 덮는다.**
- 규칙:
  1. 화면마다 맨 바깥 틀을 `position: fixed; inset: 0`(스크롤은 그 안에서 `overflow: auto`)로 두거나, 상단 바를 폭 100% `position: sticky; top: 0` 로 둔다. 로그인·404 같은 별도 화면도 빠뜨리지 않는다.
  2. 그 틀에서 맨 위 요소까지 가는 길에 **배경색이 있어야 한다.** 모두 투명이면 iOS 가 엉뚱한 색으로 칠한다(claude-bridge 1.163).
  3. `viewport` 에 `viewport-fit=cover` 를 쓰지 않는다. 쓰면 내용이 상태 표시줄 밑으로 깔린다.
  4. `<meta name="theme-color">` 를 라이트·다크 두 개(`media="(prefers-color-scheme: …)"`)로 두고, 값은 맨 위 상단 바의 배경색과 같게 한다. `<meta name="color-scheme" content="light dark">` 도 둔다.
- 입력칸: iOS Safari 는 16px 보다 작은 `input`·`textarea` 에 포커스하면 화면을 확대한다. 터치 기기(`@media (pointer: coarse)`)에서는 16px 이상으로 둔다. 연락처·주소 자동완성은 `autocomplete="off"` 를 무시하니, 막아야 하는 대화 입력칸은 `contenteditable="plaintext-only"` 로 만든다(report.creco.dev 34a56ef).
- 확인: 폰 폭(390px)으로 띄워 `document.elementFromPoint(195, 4)` 에서 부모로 올라가며 fixed/sticky 상자와 배경색이 나오는지 본다. 실제 확인은 iPhone 홈 화면 앱에서 한다.

이 저장소에서 맞춘 곳:

- 상단 바에 `data-topbar` 를 붙였다: 공개 화면 `PublicLayout.tsx` 와 Go 템플릿(`services/api/pages.go` 의 `layout`)의 `<header class="sticky top-0 … bg-white dark:bg-gray-950">`, 관리 화면 `AdminLayout.tsx` 의 `<nav class="sticky top-0 … bg-white dark:bg-gray-900">`. 반투명(`/70`, `/80` + `backdrop-blur`)이던 것을 불투명으로 바꿨다.
- 테마는 `.dark` 클래스(JS)로 바뀌므로 theme-color 를 따라 바꾼다: `index.html` 의 첫 스크립트가 `#ffffff`/`#030712` 로 맞추고, `src/lib/theme-color.ts` 의 `syncThemeColor()` 가 `[data-topbar]` 의 실제 배경색(#hex 로 변환)을 넣는다. 테마 토글(`ThemeToggle.tsx`)과 관리 화면 진입·이탈(`AdminLayout.tsx`, 다크 `#101828`)에서 부른다.
- Go 인증 화면(`services/api/auth.go` 의 `authPage`)은 `.frame{position:fixed;inset:0;overflow:auto;background:#f9fafb}` 틀에 담고 theme-color 는 `#f9fafb`.
- 터치 기기 입력칸 16px 은 `src/globals.css` 의 `@media (pointer: coarse)`(레이어 밖이라 Tailwind `text-sm` 보다 앞선다).
- 함정: `body` 를 `position: fixed` 틀로 쓸 때는 `html { overflow: hidden }` 을 같이 둔다. 없으면 body 가 스크롤되지 않아 긴 내용이 잘리고 앵커 이동도 안 된다. 틀 안 스크롤로 바뀌므로 화면 이동 때 맨 위로 올리는 코드는 `window` 가 아니라 그 틀을 스크롤해야 한다(learn·tools·agent-bridge 에서 확인).
