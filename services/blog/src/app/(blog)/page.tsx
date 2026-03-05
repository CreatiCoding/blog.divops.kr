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
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">blog.divops.kr</h1>
      <PostList posts={serialized} />
    </main>
  );
}
