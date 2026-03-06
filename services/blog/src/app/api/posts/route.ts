import { eq, desc, count } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { posts, users } from '@db/schema';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') ?? '1');
  const limit = Number(url.searchParams.get('limit') ?? '10');
  const offset = (page - 1) * limit;

  const [postList, [totalResult]] = await Promise.all([
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
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(posts)
      .where(eq(posts.published, true)),
  ]);

  return Response.json({
    posts: postList,
    total: totalResult?.value ?? 0,
    page,
    limit,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { title, content, excerpt, coverImage, slug, published, category } = body;

  if (!title || !content || !slug) {
    return Response.json(
      { error: 'title, content, slug are required' },
      { status: 400 }
    );
  }

  const [post] = await db
    .insert(posts)
    .values({
      title,
      slug,
      content,
      category: category ?? null,
      excerpt,
      coverImage,
      published: published ?? false,
      publishedAt: published ? new Date() : null,
      authorId: session.user.id,
    })
    .returning();

  return Response.json(post, { status: 201 });
}
