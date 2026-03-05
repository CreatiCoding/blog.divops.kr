# 프로젝트 설계서

## 모노리포 구조

Yarn Berry PnP workspace를 사용한 모노리포 구조입니다.

```yaml
# package.json (root)
{
  "private": true,
  "workspaces": ["services/*", "packages/*"]
}
```

## 디렉토리 구조

```
blog.divops.kr/
├── .github/
│   └── workflows/
│       └── ci.yml                   # CI/CD 파이프라인
├── .yarn/                           # Yarn Berry PnP
├── docs/                            # 프로젝트 문서
├── services/
│   └── blog/                        # Next.js 16 블로그 앱
│       ├── src/
│       │   ├── app/
│       │   │   ├── (blog)/          # 공개 블로그 페이지 (Route Group)
│       │   │   │   ├── page.tsx     # 글 목록 (메인)
│       │   │   │   └── [slug]/
│       │   │   │       └── page.tsx # 글 상세 (SSG + ISR)
│       │   │   ├── admin/           # 관리자 영역
│       │   │   │   ├── layout.tsx   # 인증 가드 레이아웃
│       │   │   │   ├── write/
│       │   │   │   │   └── page.tsx # 글 작성 (TipTap)
│       │   │   │   └── posts/
│       │   │   │       └── page.tsx # 글 관리
│       │   │   ├── api/
│       │   │   │   ├── auth/
│       │   │   │   │   └── [...nextauth]/
│       │   │   │   │       └── route.ts  # Auth.js 핸들러
│       │   │   │   ├── posts/
│       │   │   │   │   └── route.ts      # 글 CRUD API
│       │   │   │   └── upload/
│       │   │   │       └── route.ts      # 이미지 업로드 API
│       │   │   ├── layout.tsx       # 루트 레이아웃
│       │   │   └── sitemap.ts       # 동적 사이트맵
│       │   ├── components/
│       │   │   ├── editor/          # TipTap 에디터 관련
│       │   │   ├── post/            # 글 표시 컴포넌트
│       │   │   └── ui/              # 공통 UI 컴포넌트
│       │   ├── lib/
│       │   │   ├── db.ts            # Drizzle 클라이언트
│       │   │   ├── s3.ts            # MinIO (S3) 클라이언트
│       │   │   └── auth.ts          # Auth.js 설정
│       │   └── types/
│       │       └── index.ts
│       ├── drizzle/
│       │   ├── schema.ts            # DB 스키마 (TypeScript)
│       │   ├── utils.ts             # 유틸 (createId 등)
│       │   └── seed.ts              # 시드 데이터
│       ├── drizzle.config.ts        # Drizzle Kit 설정
│       ├── e2e/                     # Playwright E2E 테스트
│       │   ├── blog.spec.ts
│       │   └── admin.spec.ts
│       ├── __tests__/               # Vitest 단위/통합 테스트
│       ├── proxy.ts                 # Next.js 16 proxy (구 middleware)
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── playwright.config.ts
│       ├── vitest.config.ts
│       ├── Dockerfile
│       └── package.json
├── packages/
│   ├── fixtures/                    # 테스트용 mock 데이터
│   │   ├── src/
│   │   │   ├── users.ts             # mock User 데이터
│   │   │   ├── posts.ts             # mock Post 데이터
│   │   │   └── index.ts
│   │   └── package.json
│   └── testing/                     # 테스트 공유 유틸
│       ├── src/
│       │   ├── prisma-mock.ts       # Drizzle DB mock
│       │   ├── s3-mock.ts           # S3 클라이언트 mock
│       │   ├── auth-mock.ts         # Auth.js mock
│       │   ├── render.tsx           # 커스텀 render (providers 포함)
│       │   └── index.ts
│       └── package.json
├── .env.example                     # 환경변수 템플릿
├── .yarnrc.yml                      # Yarn Berry 설정
├── package.json                     # 루트 (workspaces)
├── tsconfig.json                    # 루트 TypeScript 설정
└── yarn.lock
```

## DB 스키마

Drizzle ORM을 사용하며, Auth.js 호환 스키마 + 블로그 테이블을 포함합니다.

스키마는 `services/blog/drizzle/schema.ts`에 TypeScript로 정의됩니다.

주요 테이블:
- `user` - Auth.js 호환 사용자 테이블 (role: USER | ADMIN)
- `account` - OAuth 계정 연동
- `session` - 세션 관리
- `verificationToken` - 이메일 인증 토큰
- `post` - 블로그 글 (title, slug, content, published, authorId 등)

### 테이블 관계도

```
User ─────┬───── Account (1:N)
           ├───── Session (1:N)
           └───── Post    (1:N)

VerificationToken (독립)
```

## Next.js 16 반영 사항

Next.js 16은 여러 breaking changes가 있으므로 주의가 필요합니다.

### proxy.ts (구 middleware.ts)

Next.js 16에서 `middleware.ts`가 `proxy.ts`로 변경되었습니다.

```typescript
// services/blog/proxy.ts
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

  // 그 외 요청은 통과
  return undefined;
}
```

### Async APIs

Next.js 16에서 다음 API들은 반드시 `await`해야 합니다:

```typescript
// params
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // ...
}

// searchParams
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  // ...
}

// cookies, headers
import { cookies, headers } from 'next/headers';
const cookieStore = await cookies();
const headerList = await headers();
```

### Turbopack

Next.js 16에서는 Turbopack이 기본 번들러입니다. 별도 플래그 불필요.

```bash
# 개발 서버 (Turbopack 자동 적용)
yarn dev
```

### ESLint Flat Config

`next lint`가 제거되었으므로 ESLint Flat Config를 직접 구성합니다.

```typescript
// eslint.config.mjs
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat();

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // 프로젝트 커스텀 룰
    },
  },
];
```

## 인증 플로우

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
│  사용자   │────▶│  /api/auth/  │────▶│  GitHub     │────▶│  콜백    │
│ (브라우저)│     │  signin      │     │  OAuth      │     │  처리    │
└──────────┘     └──────────────┘     └─────────────┘     └──────────┘
                                                                │
                                                                ▼
┌──────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
│  세션    │◀────│  Auth.js     │◀────│  DB 저장    │◀────│  User    │
│  쿠키    │     │  세션 생성    │     │  (Prisma)   │     │  생성    │
└──────────┘     └──────────────┘     └─────────────┘     └──────────┘

             proxy.ts에서 세션 확인
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│  /admin  │────▶│  proxy.ts    │────▶│  세션 확인   │──▶ 통과 or 리다이렉트
│  요청    │     │  (인증 가드)  │     │  auth()     │
└──────────┘     └──────────────┘     └─────────────┘
```

### 인증 설정 (Auth.js)

```typescript
// services/blog/src/lib/auth.ts
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from './db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.role = user.role;
      return session;
    },
  },
});
```

## 이미지 업로드 플로우

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
│  TipTap  │────▶│  /api/upload │────▶│  MinIO (S3) │────▶│  공개 URL│
│  에디터  │     │  (API Route) │     │  PutObject  │     │  반환    │
│  D&D/붙여│     │  인증 확인   │     │             │     │          │
│  넣기    │     └──────────────┘     └─────────────┘     └──────────┘
└──────────┘
```

### S3 클라이언트 설정

```typescript
// services/blog/src/lib/s3.ts
import { S3Client } from '@aws-sdk/client-s3';

export const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: 'us-east-1', // MinIO 기본값
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true, // MinIO 필수
});

export const S3_BUCKET = 'blog-images';
```

### 업로드 API

```typescript
// services/blog/src/app/api/upload/route.ts
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { auth } from '@/lib/auth';
import { s3Client, S3_BUCKET } from '@/lib/s3';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File;

  const key = `uploads/${Date.now()}-${file.name}`;
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

## SEO 전략

### SSG + ISR

```typescript
// services/blog/src/app/(blog)/[slug]/page.tsx
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { posts } from '../../../../drizzle/schema';

// 빌드 타임에 모든 글의 경로를 생성
export async function generateStaticParams() {
  const allPosts = await db
    .select({ slug: posts.slug })
    .from(posts)
    .where(eq(posts.published, true));
  return allPosts.map((post) => ({ slug: post.slug }));
}

// ISR: 60초마다 재검증
export const revalidate = 60;
```

### Metadata API

```typescript
// services/blog/src/app/(blog)/[slug]/page.tsx
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [post] = await db.select().from(posts).where(eq(posts.slug, slug));

  return {
    title: post?.title,
    description: post?.excerpt,
    openGraph: {
      title: post?.title,
      description: post?.excerpt ?? undefined,
      images: post?.coverImage ? [post.coverImage] : [],
      type: 'article',
      publishedTime: post?.publishedAt?.toISOString(),
    },
  };
}
```

### Sitemap

```typescript
// services/blog/src/app/sitemap.ts
import type { MetadataRoute } from 'next';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { posts } from '../../drizzle/schema';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const allPosts = await db
    .select({ slug: posts.slug, updatedAt: posts.updatedAt })
    .from(posts)
    .where(eq(posts.published, true));

  const postUrls = allPosts.map((post) => ({
    url: `https://blog.divops.kr/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [
    {
      url: 'https://blog.divops.kr',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...postUrls,
  ];
}
```

## 구현 단계

| Step | 내용 | 주요 산출물 |
|------|------|------------|
| **1** | 프로젝트 초기 설정 | Yarn Berry PnP, workspace, TypeScript |
| **2** | Next.js 16 앱 생성 | `services/blog`, 기본 레이아웃 |
| **3** | DB + Drizzle 설정 | 스키마, 마이그레이션, 시드 |
| **4** | Auth.js (인증) | GitHub OAuth, proxy.ts, 세션 관리 |
| **5** | 블로그 CRUD API | 글 생성/수정/삭제/조회 API Routes |
| **6** | 이미지 업로드 | MinIO 연동, 업로드 API |
| **7** | 프론트엔드 UI | TipTap 에디터, 글 목록/상세, 관리자 UI |
| **8** | SEO + 최적화 | Metadata, sitemap, ISR, OG 이미지 |
| **9** | 테스트 + CI/CD + 배포 | Vitest, Playwright, GitHub Actions, Dokploy |
