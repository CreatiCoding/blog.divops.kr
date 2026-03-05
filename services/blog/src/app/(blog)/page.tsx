import { db } from '@/lib/db';
import { posts, users } from '@db/schema';
import { eq, desc } from 'drizzle-orm';
import { PostList } from '@/components/post/post-list';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const postList = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
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
