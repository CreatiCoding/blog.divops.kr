import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { posts } from '@db/schema';

const TOKEN = process.env.MIGRATE_TOKEN;

export async function PUT(request: Request) {
  const auth = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!auth || !TOKEN || auth !== TOKEN) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, content } = await request.json();
  if (!id || !content) {
    return Response.json({ error: 'id and content required' }, { status: 400 });
  }

  const [updated] = await db
    .update(posts)
    .set({ content, updatedAt: new Date() })
    .where(eq(posts.id, id))
    .returning({ id: posts.id, title: posts.title });

  if (!updated) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json({ success: true, post: updated });
}
