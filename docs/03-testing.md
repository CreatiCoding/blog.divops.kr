# 프로젝트 검증 방법

## 테스트 전략 개요

| 유형 | 도구 | 범위 | 위치 |
|------|------|------|------|
| **단위 테스트** | Vitest + React Testing Library | 컴포넌트, 유틸, API 핸들러 | `services/blog/__tests__/` |
| **통합 테스트** | Vitest | Prisma 쿼리, S3 업로드 | `services/blog/__tests__/` |
| **E2E 테스트** | Playwright | 전체 사용자 플로우 | `services/blog/e2e/` |

## 테스트 패키지 구조

### `packages/fixtures` - Mock 데이터

테스트 전반에서 사용할 일관된 mock 데이터를 제공합니다.

```typescript
// packages/fixtures/src/users.ts
export const mockAdmin = {
  id: 'cuid-admin-001',
  name: 'Admin User',
  email: 'admin@divops.kr',
  role: 'ADMIN' as const,
  image: 'https://github.com/admin.png',
};

export const mockUser = {
  id: 'cuid-user-001',
  name: 'Regular User',
  email: 'user@example.com',
  role: 'USER' as const,
  image: null,
};
```

```typescript
// packages/fixtures/src/posts.ts
export const mockPost = {
  id: 'cuid-post-001',
  title: 'Test Post Title',
  slug: 'test-post-title',
  content: '<p>Test content</p>',
  excerpt: 'Test excerpt',
  coverImage: 'https://s3.dokploy.creco.dev/blog-images/test.jpg',
  published: true,
  publishedAt: new Date('2026-01-01'),
  authorId: 'cuid-admin-001',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

export const mockDraftPost = {
  ...mockPost,
  id: 'cuid-post-002',
  slug: 'draft-post',
  published: false,
  publishedAt: null,
};
```

### `packages/testing` - 테스트 유틸리티

```typescript
// packages/testing/src/prisma-mock.ts
import { vi } from 'vitest';

export function createPrismaMock() {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  };
}
```

```typescript
// packages/testing/src/s3-mock.ts
import { vi } from 'vitest';

export function createS3Mock() {
  return {
    send: vi.fn().mockResolvedValue({}),
  };
}
```

```typescript
// packages/testing/src/auth-mock.ts
import { vi } from 'vitest';
import { mockAdmin } from '@blog/fixtures';

export function mockAuth(user = mockAdmin) {
  return vi.fn().mockResolvedValue({
    user,
    expires: new Date(Date.now() + 86400000).toISOString(),
  });
}

export function mockNoAuth() {
  return vi.fn().mockResolvedValue(null);
}
```

## Step별 검증 테스트

### Step 1: 프로젝트 초기 설정

```bash
# 검증 기준
yarn --version          # 4.x 확인
node -e "require('./package.json')" # 파싱 성공
yarn workspaces list    # 3개 workspace 표시
```

### Step 2: Next.js 16 앱

```bash
cd services/blog
yarn build              # 빌드 성공
yarn dev                # 개발 서버 실행 확인
```

### Step 3: DB + Prisma

```bash
yarn prisma generate    # 클라이언트 생성 성공
yarn prisma db push     # 스키마 동기화 성공
yarn prisma db seed     # 시드 데이터 삽입 성공
```

**단위 테스트:**
- Prisma 클라이언트 초기화 테스트
- 각 모델 CRUD 동작 테스트 (mock DB)

### Step 4: Auth.js

**단위 테스트:**
- Auth 설정 초기화 테스트
- 세션 콜백 동작 (role 포함 확인)

**통합 테스트:**
- `/api/auth/session` 응답 구조 확인
- 미인증 상태에서 admin 접근 시 리다이렉트

### Step 5: 블로그 CRUD API

**단위 테스트:**
- `POST /api/posts` - 글 생성 (인증 필요, 필드 검증)
- `GET /api/posts` - 글 목록 (페이지네이션)
- `PUT /api/posts/[id]` - 글 수정 (본인 글만)
- `DELETE /api/posts/[id]` - 글 삭제 (본인 글만)
- 미인증 요청 시 401 응답

### Step 6: 이미지 업로드

**단위 테스트:**
- `POST /api/upload` - 파일 업로드 성공
- 미인증 요청 시 401 응답
- 지원하지 않는 파일 형식 거부
- 파일 크기 제한 확인

### Step 7: 프론트엔드 UI

**컴포넌트 테스트:**
- 글 목록 렌더링 (PostList)
- 글 상세 렌더링 (PostDetail)
- TipTap 에디터 초기화 및 입력
- 관리자 레이아웃 (인증 상태별)

### Step 8: SEO

**단위 테스트:**
- `generateMetadata` 반환값 검증
- `sitemap()` 반환 구조 검증
- OG 이미지 메타 태그 확인

### Step 9: E2E + CI/CD

**Playwright E2E 테스트:**
- 블로그 메인 페이지 로드
- 글 상세 페이지 탐색
- 관리자 로그인 → 글 작성 → 발행 → 확인
- 이미지 업로드 플로우

## CI/CD 파이프라인 (GitHub Actions)

### 워크플로우 구조

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌──────────────┐
│  lint   │────▶│  test   │────▶│  build  │────▶│  e2e-test    │
│         │     │  (unit) │     │         │     │  (playwright)│
└─────────┘     └─────────┘     └─────────┘     └──────────────┘
                                                        │
                                                        ▼ (main only)
                                                ┌──────────────┐
                                                │ docker-build │
                                                │ + deploy     │
                                                └──────────────┘
```

### GitHub Secrets 설정

CI/CD에서 사용하는 환경변수는 **GitHub Secrets**로 관리합니다.

| Secret Name | 용도 | 사용하는 Job |
|-------------|------|-------------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 | build, e2e-test |
| `AUTH_SECRET` | Auth.js 암호화 키 | build, e2e-test |
| `AUTH_GITHUB_ID` | GitHub OAuth App Client ID | e2e-test |
| `AUTH_GITHUB_SECRET` | GitHub OAuth App Client Secret | e2e-test |
| `S3_ENDPOINT` | MinIO 엔드포인트 URL | e2e-test |
| `S3_ACCESS_KEY` | MinIO Access Key | e2e-test |
| `S3_SECRET_KEY` | MinIO Secret Key | e2e-test |

### 워크플로우 파일

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Enable Corepack
        run: corepack enable
      - name: Install dependencies
        run: yarn install --immutable
      - name: Lint
        run: yarn lint
      - name: Type check
        run: yarn typecheck

  test:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Enable Corepack
        run: corepack enable
      - name: Install dependencies
        run: yarn install --immutable
      - name: Run unit tests
        run: yarn test

  build:
    runs-on: ubuntu-latest
    needs: test
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      AUTH_SECRET: ${{ secrets.AUTH_SECRET }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Enable Corepack
        run: corepack enable
      - name: Install dependencies
        run: yarn install --immutable
      - name: Build
        run: yarn build

  e2e-test:
    runs-on: ubuntu-latest
    needs: build
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      AUTH_SECRET: ${{ secrets.AUTH_SECRET }}
      AUTH_GITHUB_ID: ${{ secrets.AUTH_GITHUB_ID }}
      AUTH_GITHUB_SECRET: ${{ secrets.AUTH_GITHUB_SECRET }}
      S3_ENDPOINT: ${{ secrets.S3_ENDPOINT }}
      S3_ACCESS_KEY: ${{ secrets.S3_ACCESS_KEY }}
      S3_SECRET_KEY: ${{ secrets.S3_SECRET_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Enable Corepack
        run: corepack enable
      - name: Install dependencies
        run: yarn install --immutable
      - name: Install Playwright browsers
        run: yarn playwright install --with-deps chromium
      - name: Build
        run: yarn build
      - name: Run E2E tests
        run: yarn e2e

  docker-build:
    runs-on: ubuntu-latest
    needs: e2e-test
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker image
        run: docker build -t blog-divops ./services/blog
```

## 로컬 테스트 실행 방법

### 단위/통합 테스트

```bash
# 전체 테스트 실행
yarn test

# 특정 파일 테스트
yarn test services/blog/__tests__/api/posts.test.ts

# watch 모드
yarn test --watch

# 커버리지
yarn test --coverage
```

### E2E 테스트

```bash
# Playwright 브라우저 설치 (최초 1회)
yarn playwright install

# E2E 테스트 실행
yarn e2e

# UI 모드 (디버깅)
yarn playwright test --ui

# 특정 테스트만
yarn playwright test e2e/blog.spec.ts
```

### 환경 준비

E2E 테스트 전에 로컬 환경이 필요합니다:

```bash
# 1. 환경변수 설정
cp .env.example .env.local
# .env.local 파일 편집

# 2. DB 준비
yarn prisma db push
yarn prisma db seed

# 3. 개발 서버 실행 (E2E 테스트 전)
yarn dev
```
