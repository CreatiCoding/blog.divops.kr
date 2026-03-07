import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { pageViews, siteVisits } from '@db/schema';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    let visitorId = cookieStore.get('vid')?.value;
    const isNew = !visitorId;

    if (!visitorId) {
      visitorId = crypto.randomUUID();
    }

    const { path } = await request.json();

    if (!path || typeof path !== 'string') {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const userAgent = request.headers.get('user-agent') ?? null;
    const referrer = request.headers.get('referer') ?? null;
    const today = new Date().toISOString().slice(0, 10);

    await Promise.all([
      db
        .insert(siteVisits)
        .values({ visitorId, visitedDate: today })
        .onConflictDoNothing(),
      db.insert(pageViews).values({
        path,
        userAgent,
        referrer,
      }),
    ]);

    const response = NextResponse.json({ ok: true });

    if (isNew) {
      response.cookies.set('vid', visitorId, {
        httpOnly: false,
        maxAge: 365 * 24 * 60 * 60,
        path: '/',
        sameSite: 'lax',
      });
    }

    return response;
  } catch {
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 });
  }
}
