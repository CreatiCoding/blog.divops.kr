# blog.divops.kr

DevOps/프론트엔드 기술 블로그 플랫폼. 관리자가 로그인 후 글을 작성하고, 방문자에게 SEO 최적화된 정적 페이지로 제공합니다.

## 기술스택

| 역할 | 기술 |
|------|------|
| **프레임워크** | Next.js 16 (App Router) |
| **언어** | TypeScript (strict) |
| **스타일링** | Tailwind CSS v4 |
| **DB** | PostgreSQL 15 + Prisma ORM |
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
│  │  (blog.divops.kr)│   │  (Prisma ORM)      │  │
│  │                  │   └────────────────────┘  │
│  │  - 공개 (SSG/ISR)│                           │
│  │  - 관리자 (인증) │──▶┌────────────────────┐  │
│  │  - Auth.js       │   │  MinIO (S3 호환)   │  │
│  └──────────────────┘   └────────────────────┘  │
│                                                  │
│  Traefik (리버스 프록시 + SSL)                    │
└─────────────────────────────────────────────────┘
```

## 시작하기

```bash
# Corepack 활성화 (Yarn Berry)
corepack enable

# 의존성 설치
yarn install

# 환경변수 설정
cp .env.example .env.local

# DB 마이그레이션 + 시드
yarn prisma db push
yarn prisma db seed

# 개발 서버
yarn dev
```

자세한 개발 환경 셋업은 [docs/04-contributing.md](docs/04-contributing.md)를 참고하세요.

## 프로젝트 구조

```
blog.divops.kr/
├── services/blog/          # Next.js 16 블로그 앱
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

## 라이센스

[MIT](LICENSE)
