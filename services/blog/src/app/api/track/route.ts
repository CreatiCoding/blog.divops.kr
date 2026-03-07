import { db } from '@/lib/db';
import { pageViews } from '@db/schema';

export async function POST(request: Request) {
  try {
    const { path } = await request.json();

    if (!path || typeof path !== 'string') {
      return Response.json({ error: 'Invalid path' }, { status: 400 });
    }

    const userAgent = request.headers.get('user-agent') ?? null;
    const referrer = request.headers.get('referer') ?? null;

    await db.insert(pageViews).values({
      path,
      userAgent,
      referrer,
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Tracking failed' }, { status: 500 });
  }
}
