import { cookies } from 'next/headers';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { posts } from '@db/schema';

const COOKIE_NAME = 'viewed_posts';
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24시간

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const [post] = await db
      .select({ id: posts.id, viewCount: posts.viewCount })
      .from(posts)
      .where(eq(posts.id, id));

    if (!post) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const cookieStore = await cookies();
    const viewedRaw = cookieStore.get(COOKIE_NAME)?.value ?? '[]';

    let viewed: string[];
    try {
      viewed = JSON.parse(viewedRaw);
    } catch {
      viewed = [];
    }

    if (viewed.includes(id)) {
      return Response.json({ viewCount: post.viewCount, alreadyViewed: true });
    }

    const [updated] = await db
      .update(posts)
      .set({ viewCount: sql`${posts.viewCount} + 1` })
      .where(eq(posts.id, id))
      .returning({ viewCount: posts.viewCount });

    viewed.push(id);
    cookieStore.set(COOKIE_NAME, JSON.stringify(viewed), {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });

    return Response.json({
      viewCount: updated?.viewCount ?? post.viewCount + 1,
      alreadyViewed: false,
    });
  } catch {
    return Response.json({ error: 'View count not available' }, { status: 503 });
  }
}
