import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { posts, users } from '@db/schema';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [post] = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      category: posts.category,
      content: posts.content,
      excerpt: posts.excerpt,
      coverImage: posts.coverImage,
      published: posts.published,
      publishedAt: posts.publishedAt,
      authorId: posts.authorId,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      author: {
        name: users.name,
        image: users.image,
      },
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.id, id));

  if (!post) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json(post);
}

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

  const [existing] = await db
    .select({
      id: posts.id,
      authorId: posts.authorId,
      published: posts.published,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .where(eq(posts.id, id));

  if (!existing) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  if (existing.authorId !== session.user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [post] = await db
    .update(posts)
    .set({
      ...body,
      publishedAt:
        body.published && !existing.published
          ? new Date()
          : existing.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id))
    .returning();

  return Response.json(post);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const [existing] = await db
    .select({
      id: posts.id,
      authorId: posts.authorId,
    })
    .from(posts)
    .where(eq(posts.id, id));

  if (!existing) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  if (existing.authorId !== session.user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  await db.delete(posts).where(eq(posts.id, id));

  return Response.json({ success: true });
}
