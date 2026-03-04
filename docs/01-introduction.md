# 프로젝트 소개서

## 개요

**blog.divops.kr**은 DevOps/프론트엔드 기술 블로그 플랫폼입니다.
관리자가 로그인 후 글을 작성하고, 방문자에게 SEO 최적화된 정적 페이지로 제공합니다.

| 항목 | 값 |
|------|-----|
| **도메인** | `blog.divops.kr` |
| **유형** | 기술 블로그 (관리자 전용 CMS + 공개 블로그) |
| **인증** | GitHub OAuth (관리자 전용) |
| **배포** | Dokploy (Docker 기반 셀프 호스팅) |

## 핵심 기능

### 공개 영역 (방문자)
- 글 목록 (메인 페이지) - SSG + ISR
- 글 상세 보기 - SSG + ISR
- SEO 최적화 (OG 태그, sitemap, structured data)

### 관리자 영역 (인증 필요)
- GitHub OAuth 로그인
- 글 작성/수정/삭제 (TipTap WYSIWYG 에디터)
- 이미지/썸네일 업로드 (MinIO S3 호환 스토리지)
- 글 관리 대시보드

## 기술스택

| 역할 | 기술 | 버전 |
|------|------|------|
| **프레임워크** | Next.js (App Router) | 16 |
| **언어** | TypeScript | 5.x (strict) |
| **스타일링** | Tailwind CSS | v4 |
| **DB** | PostgreSQL + Prisma ORM | PostgreSQL 15 / Prisma 6.x |
| **인증** | Auth.js (NextAuth v5) | v5 |
| **에디터** | TipTap | 2.x |
| **이미지 저장** | MinIO (S3 호환) | 기존 운영 중 |
| **패키지 매니저** | Yarn Berry (PnP) | 4.x |
| **빌드** | Turbopack (Next.js 16 기본) | - |
| **테스트** | Vitest + React Testing Library / Playwright | - |
| **CI/CD** | GitHub Actions | - |
| **배포** | Dokploy (Docker) | - |

## 보유 인프라

| 리소스 | 상태 | 도메인/접근 |
|--------|------|------------|
| **Dokploy** | ✅ 운영 중 | 앱 배포 플랫폼 |
| **MinIO (S3)** | ✅ 운영 중 | `s3.dokploy.creco.dev` |
| **MinIO Console** | ✅ 운영 중 | `s3-console.dokploy.creco.dev` |
| **PostgreSQL** | 🆕 생성 필요 | Dokploy에서 생성 |

## 아키텍처 다이어그램

```
┌──────────────────────────────────────────────────────────┐
│                        Dokploy                            │
│                                                           │
│  ┌─────────────────────┐                                  │
│  │   Next.js 16 App    │                                  │
│  │   (blog.divops.kr)  │                                  │
│  │                     │                                  │
│  │  ┌───────────────┐  │     ┌─────────────────────┐     │
│  │  │  공개 페이지   │  │     │    PostgreSQL 15     │     │
│  │  │  (SSG/ISR)    │  │────▶│    (Prisma ORM)     │     │
│  │  └───────────────┘  │     └─────────────────────┘     │
│  │                     │                                  │
│  │  ┌───────────────┐  │     ┌─────────────────────┐     │
│  │  │  관리자 영역   │  │     │   MinIO (S3 호환)    │     │
│  │  │  (인증 필요)  │  │────▶│   이미지 저장소      │     │
│  │  └───────────────┘  │     │   s3.dokploy.creco   │     │
│  │                     │     └─────────────────────┘     │
│  │  ┌───────────────┐  │                                  │
│  │  │  Auth.js      │  │     ┌─────────────────────┐     │
│  │  │  (proxy.ts)   │  │────▶│   GitHub OAuth       │     │
│  │  └───────────────┘  │     └─────────────────────┘     │
│  └─────────────────────┘                                  │
│                                                           │
│  Traefik (리버스 프록시 + SSL)                             │
└──────────────────────────────────────────────────────────┘

       ▲                              ▲
       │ HTTPS                        │ HTTPS
       │                              │
  ┌─────────┐                   ┌──────────┐
  │ 방문자   │                   │  관리자   │
  │ (읽기)   │                   │ (글 작성) │
  └─────────┘                   └──────────┘
```

### 데이터 흐름

1. **방문자** → Traefik → Next.js SSG/ISR 페이지 → (캐시된 HTML)
2. **관리자 로그인** → Auth.js → GitHub OAuth → 세션 생성
3. **글 작성** → Next.js API → Prisma → PostgreSQL
4. **이미지 업로드** → Next.js API → MinIO (S3 호환) → 공개 URL 반환
5. **글 발행** → ISR revalidate → 정적 페이지 재생성
