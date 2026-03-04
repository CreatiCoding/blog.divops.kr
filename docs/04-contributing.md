# 프로젝트 기여 및 개발 방법

## 개발 환경 셋업

### 필수 요구사항

| 도구 | 버전 | 설치 |
|------|------|------|
| **Node.js** | 20.9+ | [nodejs.org](https://nodejs.org) |
| **Yarn** | 4.x (Berry) | Corepack으로 자동 활성화 |
| **Docker** | 최신 | [docker.com](https://docker.com) (로컬 DB용) |
| **Git** | 최신 | - |

### 초기 설정

```bash
# 1. 저장소 클론
git clone https://github.com/user/blog.divops.kr.git
cd blog.divops.kr

# 2. Corepack 활성화 (Yarn Berry 자동 설치)
corepack enable

# 3. 의존성 설치
yarn install

# 4. 환경변수 설정
cp .env.example .env.local
# .env.local 파일을 편집하여 실제 값 입력

# 5. DB 설정 (로컬 PostgreSQL)
docker run -d \
  --name blog-postgres \
  -e POSTGRES_DB=blog \
  -e POSTGRES_USER=blog \
  -e POSTGRES_PASSWORD=blog \
  -p 5432:5432 \
  postgres:15

# 6. DB 마이그레이션 + 시드
yarn prisma db push
yarn prisma db seed

# 7. 개발 서버 실행
yarn dev
```

### Yarn Berry PnP 주의사항

이 프로젝트는 Yarn Berry PnP (Plug'n'Play)를 사용합니다.

- `node_modules` 폴더가 없습니다 (정상)
- `.pnp.cjs` / `.pnp.loader.mjs` 파일이 의존성 매핑을 관리합니다
- IDE에서 타입 인식을 위해 SDK 설정이 필요합니다:

```bash
# VS Code
yarn dlx @yarnpkg/sdks vscode

# WebStorm/IntelliJ
yarn dlx @yarnpkg/sdks idea
```

## 로컬 개발 서버

```bash
# 개발 서버 시작 (Turbopack 자동 적용)
yarn dev

# 브라우저에서 열기
# http://localhost:3000        → 블로그 메인
# http://localhost:3000/admin  → 관리자 (로그인 필요)
```

### 스크립트 목록

| 스크립트 | 명령어 | 설명 |
|---------|--------|------|
| `dev` | `yarn dev` | 개발 서버 (Turbopack) |
| `build` | `yarn build` | 프로덕션 빌드 |
| `start` | `yarn start` | 프로덕션 서버 |
| `lint` | `yarn lint` | ESLint 실행 |
| `typecheck` | `yarn typecheck` | TypeScript 타입 검사 |
| `test` | `yarn test` | Vitest 단위/통합 테스트 |
| `e2e` | `yarn e2e` | Playwright E2E 테스트 |
| `prisma:generate` | `yarn prisma generate` | Prisma 클라이언트 생성 |
| `prisma:push` | `yarn prisma db push` | DB 스키마 동기화 |
| `prisma:seed` | `yarn prisma db seed` | 시드 데이터 삽입 |

## 환경변수 설정

### `.env.example`

```bash
# ─── Database ───
DATABASE_URL="postgresql://blog:blog@localhost:5432/blog"

# ─── Auth.js ───
AUTH_SECRET="your-random-secret-key-here"
AUTH_GITHUB_ID="your-github-oauth-app-id"
AUTH_GITHUB_SECRET="your-github-oauth-app-secret"

# ─── MinIO (S3) ───
S3_ENDPOINT="https://s3.dokploy.creco.dev"
S3_ACCESS_KEY="your-minio-access-key"
S3_SECRET_KEY="your-minio-secret-key"

# ─── App ───
NEXTAUTH_URL="http://localhost:3000"
```

### 환경변수 설명

| 변수 | 필수 | 설명 |
|------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 연결 문자열 |
| `AUTH_SECRET` | ✅ | Auth.js 세션 암호화 키 (`openssl rand -base64 32`로 생성) |
| `AUTH_GITHUB_ID` | ✅ | GitHub OAuth App Client ID |
| `AUTH_GITHUB_SECRET` | ✅ | GitHub OAuth App Client Secret |
| `S3_ENDPOINT` | ✅ | MinIO 엔드포인트 URL |
| `S3_ACCESS_KEY` | ✅ | MinIO Access Key |
| `S3_SECRET_KEY` | ✅ | MinIO Secret Key |
| `NEXTAUTH_URL` | 로컬 | 로컬 개발 시 앱 URL |

### GitHub OAuth App 설정

1. [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/developers) 이동
2. "New OAuth App" 클릭
3. 설정:
   - **Application name**: `blog.divops.kr (dev)`
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Client ID → `AUTH_GITHUB_ID`
5. Client Secret 생성 → `AUTH_GITHUB_SECRET`

> 프로덕션용 OAuth App은 별도로 생성하며, Homepage URL과 Callback URL에 `https://blog.divops.kr`을 사용합니다.

## 브랜치 전략

### 브랜치 구조

```
main ─────────────────────────────────────────▶ (프로덕션)
  │
  ├── feat/post-crud ────── PR ──────▶ merge
  │
  ├── feat/image-upload ─── PR ──────▶ merge
  │
  └── fix/seo-metadata ──── PR ──────▶ merge
```

### 브랜치 네이밍

| 접두사 | 용도 | 예시 |
|--------|------|------|
| `feat/` | 새 기능 | `feat/post-editor` |
| `fix/` | 버그 수정 | `fix/auth-redirect` |
| `refactor/` | 리팩토링 | `refactor/prisma-queries` |
| `docs/` | 문서 수정 | `docs/api-guide` |
| `test/` | 테스트 추가 | `test/upload-api` |
| `chore/` | 설정/도구 | `chore/ci-pipeline` |

### PR 워크플로우

1. `main`에서 feature 브랜치 생성
2. 작업 + 커밋
3. PR 생성 → CI 자동 실행 (lint → test → build → e2e)
4. 리뷰 후 merge
5. `main` push → 자동 Docker 빌드 + Dokploy 배포

## 코드 컨벤션

### ESLint (Flat Config)

```typescript
// eslint.config.mjs
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat();

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
```

### TypeScript (strict)

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "exactOptionalPropertyTypes": false
  }
}
```

### 파일/폴더 네이밍

| 대상 | 규칙 | 예시 |
|------|------|------|
| 파일 | kebab-case | `post-list.tsx` |
| 컴포넌트 | PascalCase (export) | `export function PostList()` |
| 유틸/lib | camelCase (export) | `export function formatDate()` |
| 타입 | PascalCase | `type PostWithAuthor = ...` |
| 상수 | SCREAMING_SNAKE_CASE | `const MAX_FILE_SIZE = ...` |

### 임포트 순서

```typescript
// 1. 외부 라이브러리
import { NextResponse } from 'next/server';
import { z } from 'zod';

// 2. 내부 패키지
import { mockPost } from '@blog/fixtures';

// 3. 프로젝트 내부 (절대 경로)
import { prisma } from '@/lib/prisma';
import { PostList } from '@/components/post/post-list';

// 4. 타입 (type import)
import type { Post } from '@prisma/client';
```

## 커밋 컨벤션

### Conventional Commits

```
<type>(<scope>): <description>

[optional body]
```

### 타입

| 타입 | 설명 | 예시 |
|------|------|------|
| `feat` | 새 기능 | `feat(post): add post creation API` |
| `fix` | 버그 수정 | `fix(auth): handle expired session redirect` |
| `refactor` | 리팩토링 | `refactor(prisma): extract query helpers` |
| `test` | 테스트 | `test(upload): add file size validation tests` |
| `docs` | 문서 | `docs: update contributing guide` |
| `chore` | 설정/도구 | `chore(ci): add e2e test job` |
| `style` | 포맷팅 | `style: fix eslint warnings` |

### 예시

```
feat(post): add markdown editor with TipTap

- Configure TipTap with StarterKit extension
- Add image upload via drag & drop
- Support markdown shortcuts
```

## 테스트 작성 가이드

### 파일 위치

```
services/blog/
├── __tests__/
│   ├── api/
│   │   ├── posts.test.ts       # API Route 테스트
│   │   └── upload.test.ts
│   ├── components/
│   │   ├── post-list.test.tsx  # 컴포넌트 테스트
│   │   └── editor.test.tsx
│   └── lib/
│       ├── auth.test.ts        # 유틸 테스트
│       └── s3.test.ts
└── e2e/
    ├── blog.spec.ts            # 블로그 E2E
    └── admin.spec.ts           # 관리자 E2E
```

### 단위 테스트 예시

```typescript
// __tests__/api/posts.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPrismaMock } from '@blog/testing';
import { mockPost } from '@blog/fixtures';

vi.mock('@/lib/prisma', () => ({
  prisma: createPrismaMock(),
}));

describe('POST /api/posts', () => {
  it('should create a post when authenticated', async () => {
    // arrange
    const prisma = (await import('@/lib/prisma')).prisma;
    prisma.post.create.mockResolvedValue(mockPost);

    // act
    const response = await POST(
      new Request('http://localhost/api/posts', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test', content: 'Content' }),
      })
    );

    // assert
    expect(response.status).toBe(201);
    expect(prisma.post.create).toHaveBeenCalled();
  });
});
```

### E2E 테스트 예시

```typescript
// e2e/blog.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Blog', () => {
  test('should display post list on main page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount.greaterThan(0);
  });

  test('should navigate to post detail', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('article').first().click();
    await expect(page).toHaveURL(/\/.+/);
    await expect(page.getByRole('article')).toBeVisible();
  });
});
```

### 테스트 작성 원칙

1. **AAA 패턴**: Arrange → Act → Assert
2. **테스트 이름**: `should <expected behavior> when <condition>`
3. **mock 사용**: `packages/testing`의 공유 mock 활용
4. **fixture 사용**: `packages/fixtures`의 일관된 데이터 활용
5. **격리**: 각 테스트는 독립적으로 실행 가능해야 함
