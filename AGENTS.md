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
