# blog.divops.kr

DevOps/프론트엔드 기술 블로그. 관리자가 GitHub 로그인 후 글을 쓰고, 방문자·검색엔진에는 서버에서 메타와 본문을 넣은 HTML 로 제공합니다.

> 2026-10: Next.js 16 에서 **Vite(React) + nginx + Go** 한 컨테이너 구조로 바꿨습니다. 런타임 이미지에 Node 가 없습니다.
> `docs/` 는 Next.js 시절 문서라 구조 설명은 이 README 와 `AGENTS.md` 가 기준입니다.

## 구조

```
services/blog   Vite + React 19 + react-router + Tailwind v4 (화면, Dockerfile, nginx.conf, entrypoint.sh)
services/api    Go 서버 (표준 라이브러리 + pgx + goldmark)
                - /api/* 전부 (예전 Next route handler 와 같은 경로·응답)
                - 화면 HTML: index.html 의 <head> 에 title/description/og/canonical/JSON-LD,
                  #root 에 크롤러용 본문 HTML, __DATA__ 에 초기 데이터를 넣어 내려준다
                - /sitemap.xml, /robots.txt
                - GitHub OAuth (콜백 /api/auth/callback/github) + DB 세션(Auth.js 와 같은 테이블·쿠키)
```

컨테이너: nginx(:3000) 가 `/assets/*`, `/icon.svg` 를 직접 내주고 나머지는 Go(127.0.0.1:8080)로 넘깁니다. `blog.creco.dev` 는 nginx 가 `blog.divops.kr` 로 308.

DB 스키마는 예전 drizzle 마이그레이션(`services/blog/drizzle/migrations`, 참고용)이 만든 그대로 씁니다. Go 는 마이그레이션을 돌리지 않습니다.

## 환경변수 (Dokploy)

| 키 | 용도 |
|----|------|
| `DATABASE_URL` | Postgres 접속 |
| `AUTH_URL` | 사이트 주소. OAuth redirect_uri = `$AUTH_URL/api/auth/callback/github`, https 면 `__Secure-` 쿠키 |
| `AUTH_SECRET` | PKCE/state 쿠키 서명 |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | GitHub OAuth 앱 |
| `AUTH_ALLOWED_USERS` | 로그인(=글쓰기) 허용 GitHub login, 쉼표 구분. 비어 있으면 아무도 로그인 못 함 |
| `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | 이미지 업로드(MinIO, `blog-images` 버킷) |
| `UPLOAD_MAX_FILE_SIZE_MB` | 업로드 최대 크기 (기본 10) |
| `SQL_TOKEN` | `POST /api/sql` (임의 SQL 실행, 관리용) Bearer 토큰 |
| `AUTH_TRUST_HOST` | Auth.js 시절 키. 지금은 읽지 않음 |

## 로컬 개발

```bash
mise install && corepack enable && yarn install

# 프론트 빌드 (services/blog/dist)
yarn build

# Go 서버: 빌드된 dist 를 STATIC_DIR 로 주면 화면·정적 파일까지 Go 가 내준다
cd services/api
DATABASE_URL=postgres://... AUTH_URL=http://localhost:8080 STATIC_DIR=../blog/dist API_ADDR=:8080 go run .

# 테스트
go vet ./... && go test ./...
```

운영과 같은 구성: 저장소 루트에서 `docker build -f services/blog/Dockerfile .` 후 컨테이너 3000 포트.

## 배포

`main` push → Dokploy(앱 `PAsCNfn9M18-gIzzR9Zld`) 자동 배포 + `.github/workflows/deploy.yml`. `indexing.yml` 이 매일 sitemap 기반 Google 색인 요청을 보냅니다.

## 라이센스

MIT
