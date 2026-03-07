import { db } from '@/lib/db';
import { posts, users } from '@db/schema';
import { eq, desc, count } from 'drizzle-orm';
import { PostList } from '@/components/post/post-list';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 10;

export default async function HomePage() {
  let postList: {
    id: string;
    title: string;
    slug: string;
    category: string | null;
    excerpt: string | null;
    coverImage: string | null;
    publishedAt: Date | null;
    author: { name: string | null; image: string | null } | null;
  }[] = [];
  let total = 0;

  try {
    const [rows, [totalResult]] = await Promise.all([
      db
        .select({
          id: posts.id,
          title: posts.title,
          slug: posts.slug,
          category: posts.category,
          excerpt: posts.excerpt,
          coverImage: posts.coverImage,
          publishedAt: posts.publishedAt,
          author: {
            name: users.name,
            image: users.image,
          },
        })
        .from(posts)
        .leftJoin(users, eq(posts.authorId, users.id))
        .where(eq(posts.published, true))
        .orderBy(desc(posts.publishedAt))
        .limit(PAGE_SIZE),
      db
        .select({ value: count() })
        .from(posts)
        .where(eq(posts.published, true)),
    ]);
    postList = rows;
    total = totalResult?.value ?? 0;
  } catch {
    // DB 연결 실패 시 빈 목록으로 fallback
  }

  const serialized = postList.map((p) => ({
    ...p,
    publishedAt: p.publishedAt?.toISOString() ?? null,
  }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'blog.divops.kr',
    url: 'https://blog.divops.kr',
    description: 'DevOps와 프론트엔드 기술 블로그',
  };

  return (
    <section className="max-w-[720px] mx-auto px-6 pt-20 pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mb-16">
        <h1 className="text-[28px] font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Blog
        </h1>
        <p className="mt-2 text-[15px] text-gray-400 dark:text-gray-500">
          DevOps와 프론트엔드 개발에 대한 이야기
        </p>
      </div>
      <PostList initialPosts={serialized} total={total} pageSize={PAGE_SIZE} />
    </section>
  );
}
