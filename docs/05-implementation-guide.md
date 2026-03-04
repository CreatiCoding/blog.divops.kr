# Claude 실행용 구현 가이드

> 이 문서는 Claude가 읽고 전체 프로젝트를 단계별로 구축할 수 있도록 작성되었습니다.
> 각 Step을 순서대로 실행하면 blog.divops.kr 블로그 플랫폼이 완성됩니다.

## 전제조건

### 보유 인프라
- **Dokploy**: 앱 배포 플랫폼 (운영 중)
- **MinIO**: S3 호환 스토리지 (운영 중, `s3.dokploy.creco.dev`)
- **도메인**: `blog.divops.kr` (DNS 설정 가능)

### 사전 준비 (사용자가 직접 수행)
- GitHub OAuth App 생성 (로컬 개발용 + 프로덕션용)
- MinIO에 `blog-images` 버킷 생성
- GitHub Secrets 설정 (CI/CD용)

### 주의사항/함정

| 항목 | 주의사항 |
|------|---------|
| **Yarn PnP** | `node_modules` 없음. `require.resolve` 대신 PnP API 사용. 일부 패키지는 `.yarnrc.yml`에 `packageExtensions` 필요 |
| **Next.js 16** | `middleware.ts` → `proxy.ts`, `params`/`searchParams`/`cookies`/`headers` 모두 `await` 필수 |
| **Turbopack** | Next.js 16 기본 번들러. `next.config.ts`에서 webpack 커스텀 설정 사용 시 호환성 확인 필요 |
| **mise** | `mise.toml`에 node, yarn 버전 명시. 로컬/CI 모두 `mise install`로 통일 |
| **Prisma + PnP** | `postinstall` 스크립트에 `prisma generate` 추가 필요 |
| **Auth.js v5** | `@auth/prisma-adapter` 사용. adapter 스키마 정확히 일치해야 함 |
| **ESLint** | Next.js 16에서 `next lint` 제거됨. Flat Config 직접 구성 |

---

## Step 1: 프로젝트 초기 설정

### 목표
Yarn Berry PnP 모노리포 워크스페이스 초기화

### CLI 명령어

```bash
# 프로젝트 루트에서 실행
cd /path/to/blog.divops.kr

# mise로 Node.js + Yarn 설치 (mise.toml 기반)
mise install

# Yarn Berry 초기화
yarn init -2

# PnP 모드 설정
yarn config set nodeLinker pnp

# 워크스페이스 디렉토리 생성
mkdir -p services/blog
mkdir -p packages/fixtures/src
mkdir -p packages/testing/src
```

### 생성할 파일

#### `mise.toml`

```toml
[tools]
node = "22"
yarn = "4"
```

#### `package.json` (루트)

```json
{
  "name": "blog-divops-kr",
  "private": true,
  "workspaces": [
    "services/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "yarn workspace @blog/service dev",
    "build": "yarn workspace @blog/service build",
    "start": "yarn workspace @blog/service start",
    "lint": "yarn workspace @blog/service lint",
    "typecheck": "yarn workspace @blog/service typecheck",
    "test": "yarn workspace @blog/service test",
    "e2e": "yarn workspace @blog/service e2e"
  },
  "packageManager": "yarn@4.6.0"
}
```

#### `.yarnrc.yml`

```yaml
nodeLinker: pnp

packageExtensions:
  "@auth/prisma-adapter@*":
    peerDependencies:
      "@prisma/client": "*"
```

#### `tsconfig.json` (루트)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

#### `packages/fixtures/package.json`

```json
{
  "name": "@blog/fixtures",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {}
}
```

#### `packages/fixtures/src/index.ts`

```typescript
export * from './users';
export * from './posts';
```

#### `packages/fixtures/src/users.ts`

```typescript
export const mockAdmin = {
  id: 'cuid-admin-001',
  name: 'Admin User',
  email: 'admin@divops.kr',
  emailVerified: null,
  image: 'https://github.com/admin.png',
  role: 'ADMIN' as const,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

export const mockUser = {
  id: 'cuid-user-001',
  name: 'Regular User',
  email: 'user@example.com',
  emailVerified: null,
  image: null,
  role: 'USER' as const,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};
```

#### `packages/fixtures/src/posts.ts`

```typescript
export const mockPost = {
  id: 'cuid-post-001',
  title: 'Test Post Title',
  slug: 'test-post-title',
  content: '<p>This is test content for the blog post.</p>',
  excerpt: 'Test excerpt for the post',
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
  title: 'Draft Post',
  slug: 'draft-post',
  published: false,
  publishedAt: null,
};

export const mockPosts = [mockPost, mockDraftPost];
```

#### `packages/testing/package.json`

```json
{
  "name": "@blog/testing",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@blog/fixtures": "workspace:*"
  },
  "peerDependencies": {
    "vitest": "*"
  }
}
```

#### `packages/testing/src/index.ts`

```typescript
export * from './prisma-mock';
export * from './s3-mock';
export * from './auth-mock';
```

#### `packages/testing/src/prisma-mock.ts`

```typescript
import { vi } from 'vitest';

export function createPrismaMock() {
  return {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    account: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn((fn: any) => fn()),
  };
}
```

#### `packages/testing/src/s3-mock.ts`

```typescript
import { vi } from 'vitest';

export function createS3Mock() {
  return {
    send: vi.fn().mockResolvedValue({
      $metadata: { httpStatusCode: 200 },
    }),
  };
}
```

#### `packages/testing/src/auth-mock.ts`

```typescript
import { vi } from 'vitest';
import { mockAdmin } from '@blog/fixtures';

export function mockAuth(user = mockAdmin) {
  return vi.fn().mockResolvedValue({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  });
}

export function mockNoAuth() {
  return vi.fn().mockResolvedValue(null);
}
```

#### `.env.example`

```bash
# ─── Database ───
DATABASE_URL="postgresql://blog:blog@localhost:5432/blog"

# ─── Auth.js ───
AUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_GITHUB_ID="your-github-oauth-app-id"
AUTH_GITHUB_SECRET="your-github-oauth-app-secret"

# ─── MinIO (S3) ───
S3_ENDPOINT="https://s3.dokploy.creco.dev"
S3_ACCESS_KEY="your-minio-access-key"
S3_SECRET_KEY="your-minio-secret-key"

# ─── App ───
NEXTAUTH_URL="http://localhost:3000"
```

### 검증 명령어

```bash
yarn --version
# 통과 기준: 4.x.x

yarn workspaces list
# 통과 기준: 3개 workspace 출력 (root, @blog/fixtures, @blog/testing)
```

---

## Step 2: Next.js 16 앱 생성

### 목표
`services/blog`에 Next.js 16 앱을 생성하고 기본 레이아웃을 구성합니다.

### 의존성 패키지

```json
{
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "postcss": "^8.0.0",
    "@eslint/eslintrc": "^3.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^16.0.0"
  }
}
```

### 생성할 파일

#### `services/blog/package.json`

```json
{
  "name": "@blog/service",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@blog/fixtures": "workspace:*",
    "@blog/testing": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "postcss": "^8.0.0",
    "@eslint/eslintrc": "^3.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^16.0.0"
  }
}
```

#### `services/blog/next.config.ts`

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's3.dokploy.creco.dev',
      },
      {
        protocol: 'https',
        hostname: '*.githubusercontent.com',
      },
    ],
  },
};

export default nextConfig;
```

#### `services/blog/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "noUncheckedIndexedAccess": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

#### `services/blog/postcss.config.mjs`

```javascript
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
```

#### `services/blog/eslint.config.mjs`

```javascript
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat();

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'prefer-const': 'error',
    },
  },
];
```

#### `services/blog/src/app/layout.tsx`

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'blog.divops.kr',
    template: '%s | blog.divops.kr',
  },
  description: 'DevOps와 프론트엔드 기술 블로그',
  metadataBase: new URL('https://blog.divops.kr'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

#### `services/blog/src/app/globals.css`

```css
@import 'tailwindcss';
```

#### `services/blog/src/app/(blog)/page.tsx`

```tsx
export default function HomePage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">blog.divops.kr</h1>
      <p className="text-gray-600">DevOps와 프론트엔드 기술 블로그</p>
    </main>
  );
}
```

### 검증 명령어

```bash
cd services/blog
yarn build
# 통과 기준: 빌드 성공 (exit code 0)
```

---

## Step 3: DB + Prisma 설정

### 목표
PostgreSQL + Prisma ORM 설정, Auth.js 호환 스키마, 시드 데이터

### 추가 의존성

```
prisma (devDependencies)
@prisma/client (dependencies)
```

### 생성할 파일

#### `services/blog/prisma/schema.prisma`

02-architecture.md의 "DB 스키마" 섹션 참조. 전체 스키마를 그대로 사용합니다.

#### `services/blog/prisma/seed.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 관리자 사용자 생성
  const admin = await prisma.user.upsert({
    where: { email: 'admin@divops.kr' },
    update: {},
    create: {
      email: 'admin@divops.kr',
      name: 'Admin',
      role: 'ADMIN',
    },
  });

  // 샘플 포스트 생성
  await prisma.post.upsert({
    where: { slug: 'hello-world' },
    update: {},
    create: {
      title: 'Hello World',
      slug: 'hello-world',
      content: '<p>블로그의 첫 번째 글입니다. 환영합니다!</p>',
      excerpt: '블로그의 첫 번째 글입니다.',
      published: true,
      publishedAt: new Date(),
      authorId: admin.id,
    },
  });

  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

#### `services/blog/src/lib/prisma.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

### `services/blog/package.json` 수정

`prisma` 섹션과 `postinstall` 스크립트를 추가합니다:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

### 검증 명령어

```bash
yarn prisma generate
# 통과 기준: Prisma Client 생성 성공

yarn prisma db push
# 통과 기준: 스키마가 DB에 반영됨 (DATABASE_URL 필요)

yarn prisma db seed
# 통과 기준: 시드 데이터 삽입 완료
```

---

## Step 4: Auth.js (인증)

### 목표
GitHub OAuth 인증 + proxy.ts 인증 가드

### 추가 의존성

```
next-auth@beta (dependencies) - Auth.js v5
@auth/prisma-adapter (dependencies)
```

### 생성할 파일

#### `services/blog/src/lib/auth.ts`

```typescript
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        // @ts-expect-error -- role is added by Prisma adapter
        session.user.role = user.role;
      }
      return session;
    },
  },
});
```

#### `services/blog/src/app/api/auth/[...nextauth]/route.ts`

```typescript
import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
```

#### `services/blog/proxy.ts`

```typescript
import { auth } from '@/lib/auth';

export default async function proxy(request: Request) {
  const url = new URL(request.url);

  // 관리자 영역 보호
  if (url.pathname.startsWith('/admin')) {
    const session = await auth();
    if (!session?.user) {
      return Response.redirect(new URL('/api/auth/signin', request.url));
    }
  }

  return undefined;
}
```

### 검증 명령어

```bash
yarn build
# 통과 기준: Auth.js 관련 코드 포함 빌드 성공

# 수동 검증: 브라우저에서
# GET /api/auth/providers → GitHub provider 표시
# GET /api/auth/session → null (미로그인) 또는 세션 객체
```

---

## Step 5: 블로그 CRUD API

### 목표
글 생성/수정/삭제/조회 API Routes

### 생성할 파일

#### `services/blog/src/app/api/posts/route.ts`

```typescript
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// 글 목록 조회 (공개)
export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') ?? '1');
  const limit = Number(url.searchParams.get('limit') ?? '10');
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: { published: true },
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
      include: { author: { select: { name: true, image: true } } },
    }),
    prisma.post.count({ where: { published: true } }),
  ]);

  return Response.json({ posts, total, page, limit });
}

// 글 생성 (인증 필요)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { title, content, excerpt, coverImage, slug, published } = body;

  if (!title || !content || !slug) {
    return Response.json(
      { error: 'title, content, slug are required' },
      { status: 400 }
    );
  }

  const post = await prisma.post.create({
    data: {
      title,
      slug,
      content,
      excerpt,
      coverImage,
      published: published ?? false,
      publishedAt: published ? new Date() : null,
      authorId: session.user.id,
    },
  });

  return Response.json(post, { status: 201 });
}
```

#### `services/blog/src/app/api/posts/[id]/route.ts`

```typescript
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// 글 상세 조회
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const post = await prisma.post.findUnique({
    where: { id },
    include: { author: { select: { name: true, image: true } } },
  });

  if (!post) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json(post);
}

// 글 수정
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  if (existing.authorId !== session.user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const post = await prisma.post.update({
    where: { id },
    data: {
      ...body,
      publishedAt: body.published && !existing.published ? new Date() : existing.publishedAt,
    },
  });

  return Response.json(post);
}

// 글 삭제
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  if (existing.authorId !== session.user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.post.delete({ where: { id } });

  return Response.json({ success: true });
}
```

### 검증 명령어

```bash
yarn build
# 통과 기준: API route 빌드 성공

yarn test -- --grep "posts"
# 통과 기준: CRUD API 단위 테스트 통과
```

---

## Step 6: 이미지 업로드

### 목표
MinIO (S3 호환) 연동 이미지 업로드 API

### 추가 의존성

```
@aws-sdk/client-s3 (dependencies)
```

### 생성할 파일

#### `services/blog/src/lib/s3.ts`

```typescript
import { S3Client } from '@aws-sdk/client-s3';

export const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,
});

export const S3_BUCKET = 'blog-images';
```

#### `services/blog/src/app/api/upload/route.ts`

```typescript
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { auth } from '@/lib/auth';
import { s3Client, S3_BUCKET } from '@/lib/s3';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json(
      { error: 'File type not allowed. Use JPEG, PNG, GIF, or WebP.' },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return Response.json(
      { error: 'File too large. Maximum 5MB.' },
      { status: 400 }
    );
  }

  const ext = file.name.split('.').pop();
  const key = `uploads/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    })
  );

  const url = `${process.env.S3_ENDPOINT}/${S3_BUCKET}/${key}`;
  return Response.json({ url });
}
```

### 검증 명령어

```bash
yarn build
# 통과 기준: 빌드 성공

yarn test -- --grep "upload"
# 통과 기준: 업로드 API 단위 테스트 통과
```

---

## Step 7: 프론트엔드 UI

### 목표
TipTap 에디터, 글 목록/상세 페이지, 관리자 UI

### 추가 의존성

```
@tiptap/react (dependencies)
@tiptap/starter-kit (dependencies)
@tiptap/extension-image (dependencies)
@tiptap/pm (dependencies)
```

### 생성할 파일

주요 컴포넌트:
- `services/blog/src/components/post/post-list.tsx` - 글 목록
- `services/blog/src/components/post/post-detail.tsx` - 글 상세
- `services/blog/src/components/editor/tiptap-editor.tsx` - TipTap 에디터
- `services/blog/src/app/(blog)/[slug]/page.tsx` - 글 상세 페이지 (SSG + ISR)
- `services/blog/src/app/admin/layout.tsx` - 관리자 레이아웃 (인증 가드)
- `services/blog/src/app/admin/write/page.tsx` - 글 작성 페이지
- `services/blog/src/app/admin/posts/page.tsx` - 글 관리 페이지

> 각 파일의 구현 내용은 02-architecture.md의 디렉토리 구조와 코드 예시를 참조합니다.
> UI 컴포넌트는 Tailwind CSS v4를 사용하여 스타일링합니다.

### 검증 명령어

```bash
yarn build
# 통과 기준: 모든 페이지 빌드 성공

yarn test -- --grep "component"
# 통과 기준: 컴포넌트 테스트 통과
```

---

## Step 8: SEO + 최적화

### 목표
Metadata API, sitemap, ISR, OG 이미지

### 생성할 파일

- `services/blog/src/app/sitemap.ts` - 동적 사이트맵 (02-architecture.md 참조)
- `services/blog/src/app/robots.ts` - robots.txt
- `services/blog/src/app/(blog)/[slug]/page.tsx`에 `generateMetadata` + `generateStaticParams` + `revalidate` 추가

#### `services/blog/src/app/robots.ts`

```typescript
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/'],
    },
    sitemap: 'https://blog.divops.kr/sitemap.xml',
  };
}
```

### 검증 명령어

```bash
yarn build
# 통과 기준: sitemap.xml, robots.txt 생성 확인

# 수동 검증:
# GET /sitemap.xml → XML 사이트맵 반환
# GET /robots.txt → robots 규칙 반환
```

---

## Step 9: 테스트 + CI/CD + 배포

### 목표
Vitest/Playwright 테스트 완성, GitHub Actions CI/CD, Dokploy 배포

### 추가 의존성

```
vitest (devDependencies)
@testing-library/react (devDependencies)
@testing-library/jest-dom (devDependencies)
@vitejs/plugin-react (devDependencies)
jsdom (devDependencies)
@playwright/test (devDependencies)
```

### 생성할 파일

#### `services/blog/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

#### `services/blog/vitest.setup.ts`

```typescript
import '@testing-library/jest-dom/vitest';
```

#### `services/blog/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'yarn start',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

#### `services/blog/Dockerfile`

```dockerfile
FROM node:20-alpine AS base

# mise를 사용해 Yarn Berry 설치
RUN apk add --no-cache curl bash \
    && curl https://mise.run | sh
ENV PATH="/root/.local/bin:/root/.local/share/mise/shims:$PATH"
COPY mise.toml ./
RUN mise install

FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
COPY services/blog/package.json ./services/blog/
COPY packages/fixtures/package.json ./packages/fixtures/
COPY packages/testing/package.json ./packages/testing/
RUN yarn install --immutable

FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./
COPY . .
RUN yarn workspace @blog/service prisma generate
RUN yarn workspace @blog/service build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/services/blog/public ./services/blog/public
COPY --from=builder --chown=nextjs:nodejs /app/services/blog/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/services/blog/.next/static ./services/blog/.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "services/blog/server.js"]
```

#### `.github/workflows/ci.yml`

GitHub Secrets를 사용하여 환경변수를 주입하는 CI/CD 파이프라인입니다.

**필요한 GitHub Secrets:**

| Secret Name | 용도 | 사용하는 Job |
|-------------|------|-------------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 | build, e2e-test |
| `AUTH_SECRET` | Auth.js 암호화 키 | build, e2e-test |
| `AUTH_GITHUB_ID` | GitHub OAuth App Client ID | e2e-test |
| `AUTH_GITHUB_SECRET` | GitHub OAuth App Client Secret | e2e-test |
| `S3_ENDPOINT` | MinIO 엔드포인트 URL | e2e-test |
| `S3_ACCESS_KEY` | MinIO Access Key | e2e-test |
| `S3_SECRET_KEY` | MinIO Secret Key | e2e-test |

```yaml
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
      - uses: jdx/mise-action@v2
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
      - uses: jdx/mise-action@v2
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
      - uses: jdx/mise-action@v2
      - name: Install dependencies
        run: yarn install --immutable
      - name: Generate Prisma Client
        run: yarn workspace @blog/service prisma generate
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
      - uses: jdx/mise-action@v2
      - name: Install dependencies
        run: yarn install --immutable
      - name: Generate Prisma Client
        run: yarn workspace @blog/service prisma generate
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
        run: docker build -t blog-divops -f services/blog/Dockerfile .
```

### Dokploy 배포 (MCP 도구 호출 순서)

Dokploy MCP 도구를 사용한 배포 순서:

```
1. project-create         → 프로젝트 생성 ("blog.divops.kr")
2. postgres-create        → PostgreSQL 데이터베이스 생성
3. postgres-deploy        → PostgreSQL 배포
4. application-create     → Next.js 앱 생성
5. application-saveGitProvider 또는 application-saveDockerProvider → 소스 설정
6. application-saveBuildType → 빌드 타입 설정 (dockerfile)
7. application-saveEnvironment → 환경변수 설정 (DATABASE_URL, AUTH_SECRET 등)
8. domain-create          → 도메인 연결 (blog.divops.kr, HTTPS + Let's Encrypt)
9. application-deploy     → 앱 배포
```

#### 환경변수 설정 예시 (MCP)

```
DATABASE_URL=postgresql://<user>:<pass>@<postgres-app-name>:5432/blog
AUTH_SECRET=<generated-secret>
AUTH_GITHUB_ID=<github-oauth-id>
AUTH_GITHUB_SECRET=<github-oauth-secret>
S3_ENDPOINT=https://s3.dokploy.creco.dev
S3_ACCESS_KEY=<minio-access-key>
S3_SECRET_KEY=<minio-secret-key>
```

### 검증 명령어

```bash
# 단위 테스트
yarn test
# 통과 기준: 모든 테스트 통과

# E2E 테스트
yarn e2e
# 통과 기준: 모든 E2E 시나리오 통과

# Docker 빌드
docker build -t blog-divops ./services/blog
# 통과 기준: 이미지 빌드 성공

# Docker 실행 테스트
docker run -p 3000:3000 --env-file .env blog-divops
# 통과 기준: http://localhost:3000 접근 가능
```
