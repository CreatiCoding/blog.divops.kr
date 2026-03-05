# blog.divops.kr

DevOps/프론트엔드 기술 블로그 플랫폼. 관리자가 로그인 후 글을 작성하고, 방문자에게 SEO 최적화된 정적 페이지로 제공합니다.

## 기술스택

| 역할 | 기술 |
|------|------|
| **프레임워크** | Next.js 16 (App Router) |
| **언어** | TypeScript (strict) |
| **스타일링** | Tailwind CSS v4 |
| **DB** | PostgreSQL 15 + Drizzle ORM |
| **인증** | Auth.js (NextAuth v5) + GitHub OAuth |
| **에디터** | TipTap (WYSIWYG) |
| **이미지 저장** | MinIO (S3 호환) |
| **패키지 매니저** | Yarn Berry (PnP) |
| **테스트** | Vitest / Playwright |
| **CI/CD** | GitHub Actions |
| **배포** | Dokploy (Docker) |

## 아키텍처

```
┌─────────────────────────────────────────────────┐
│                    Dokploy                       │
│                                                  │
│  ┌──────────────────┐   ┌────────────────────┐  │
│  │  Next.js 16 App  │──▶│  PostgreSQL 15     │  │
│  │  (blog.divops.kr)│   │  (Drizzle ORM)     │  │
│  │                  │   └────────────────────┘  │
│  │  - 공개 (SSG/ISR)│                           │
│  │  - 관리자 (인증) │──▶┌────────────────────┐  │
│  │  - Auth.js       │   │  MinIO (S3 호환)   │  │
│  └──────────────────┘   └────────────────────┘  │
│                                                  │
│  Traefik (리버스 프록시 + SSL)                    │
└─────────────────────────────────────────────────┘
```

## 로컬 개발 환경 설정

### 사전 요구사항

- [mise](https://mise.jdx.dev/) (Node.js, Yarn 버전 관리)
- [Docker](https://www.docker.com/) (PostgreSQL, MinIO 실행용)
- GitHub OAuth App (인증용)

### 1. 저장소 클론 및 의존성 설치

```bash
git clone https://github.com/CreatiCoding/blog.divops.kr.git
cd blog.divops.kr

# mise로 Node.js 22 + Yarn 4 설치
mise install

# 의존성 설치 (PnP 모드)
yarn install
```

### 2. 외부 서비스 실행 (Docker)

```bash
# PostgreSQL
docker run -d --name blog-postgres \
  -e POSTGRES_USER=blog \
  -e POSTGRES_PASSWORD=blog \
  -e POSTGRES_DB=blog \
  -p 5432:5432 \
  postgres:15-alpine

# MinIO (S3 호환 스토리지)
docker run -d --name blog-minio \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  -p 9000:9000 \
  -p 9001:9001 \
  minio/minio server /data --console-address ":9001"
```

MinIO 콘솔(`http://localhost:9001`)에서 `blog-images` 버킷을 생성하고, Access Key를 발급하세요.

### 3. 환경변수 설정

```bash
cp .env.example services/blog/.env.local
```

`services/blog/.env.local`을 열어 값을 채웁니다:

```env
# ─── Database ───
DATABASE_URL="postgresql://blog:blog@localhost:5432/blog"

# ─── Auth.js ───
AUTH_SECRET="$(openssl rand -base64 32 으로 생성)"
AUTH_GITHUB_ID="GitHub OAuth App Client ID"
AUTH_GITHUB_SECRET="GitHub OAuth App Client Secret"

# ─── MinIO (S3) ───
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="MinIO에서 발급한 Access Key"
S3_SECRET_KEY="MinIO에서 발급한 Secret Key"

# ─── App ───
NEXTAUTH_URL="http://localhost:3000"
```

> GitHub OAuth App은 [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/developers)에서 생성합니다.
> - Homepage URL: `http://localhost:3000`
> - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`

### 4. DB 마이그레이션 및 시드

```bash
# 스키마를 DB에 반영
yarn workspace @blog/service db:push

# 기본 데이터 시드 (관리자 계정 + 샘플 글)
yarn workspace @blog/service db:seed
```

### 5. 개발 서버 실행

```bash
yarn dev
```

`http://localhost:3000`에서 블로그를 확인할 수 있습니다.

- 블로그 홈: `http://localhost:3000`
- 관리자 페이지: `http://localhost:3000/admin` (GitHub 로그인 필요)
- Drizzle Studio (DB 뷰어): `yarn workspace @blog/service db:studio`

## 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `yarn dev` | 개발 서버 실행 |
| `yarn build` | 프로덕션 빌드 |
| `yarn test` | 단위 테스트 (Vitest) |
| `yarn e2e` | E2E 테스트 (Playwright) |
| `yarn lint` | ESLint 검사 |
| `yarn typecheck` | TypeScript 타입 검사 |

## 프로젝트 구조

```
blog.divops.kr/
├── services/blog/          # Next.js 16 블로그 앱
│   ├── src/app/            # App Router 페이지/API
│   ├── src/components/     # React 컴포넌트
│   ├── src/lib/            # DB, Auth, S3 클라이언트
│   ├── drizzle/            # DB 스키마, 시드, 마이그레이션
│   ├── __tests__/          # 단위 테스트
│   └── e2e/                # E2E 테스트
├── packages/fixtures/      # 테스트용 mock 데이터
├── packages/testing/       # 테스트 공유 유틸리티
└── docs/                   # 프로젝트 문서
```

## 문서

| 문서 | 설명 |
|------|------|
| [01-introduction](docs/01-introduction.md) | 프로젝트 소개, 인프라, 아키텍처 다이어그램 |
| [02-architecture](docs/02-architecture.md) | 설계서, DB 스키마, 인증/이미지 플로우, SEO |
| [03-testing](docs/03-testing.md) | 테스트 전략, CI/CD 파이프라인 |
| [04-contributing](docs/04-contributing.md) | 개발 환경, 브랜치 전략, 코드 컨벤션 |
| [05-implementation-guide](docs/05-implementation-guide.md) | Step 1~9 구현 가이드 |
| [06-feature-specification](docs/06-feature-specification.md) | 기능 명세서 및 테스트 케이스 |

## 라이센스

[MIT](LICENSE)
