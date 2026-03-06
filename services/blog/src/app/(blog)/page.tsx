import { db } from '@/lib/db';
import { posts, users } from '@db/schema';
import { eq, desc } from 'drizzle-orm';
import { PostList } from '@/components/post/post-list';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let postList: {
    id: string;
    title: string;
    slug: string;
    category: string | null;
    excerpt: string | null;
    coverImage: string | null;
    publishedAt: Date | null;
    viewCount: number;
    author: { name: string | null; image: string | null } | null;
  }[] = [];

  try {
    postList = await db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        category: posts.category,
        excerpt: posts.excerpt,
        coverImage: posts.coverImage,
        publishedAt: posts.publishedAt,
        viewCount: posts.viewCount,
        author: {
          name: users.name,
          image: users.image,
        },
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .where(eq(posts.published, true))
      .orderBy(desc(posts.publishedAt))
      .limit(20);
  } catch {
    // DB 연결 실패 시 빈 목록으로 fallback
  }

  const serialized = postList.map((p) => ({
    ...p,
    publishedAt: p.publishedAt?.toISOString() ?? null,
  }));

  return (
    <section className="max-w-[720px] mx-auto px-6 pt-20 pb-16">
      <div className="mb-16">
        <h1 className="text-[28px] font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Blog
        </h1>
        <p className="mt-2 text-[15px] text-gray-400 dark:text-gray-500">
          DevOps와 프론트엔드 개발에 대한 이야기
        </p>
      </div>
      <PostList posts={serialized} />
    </section>
  );
}
