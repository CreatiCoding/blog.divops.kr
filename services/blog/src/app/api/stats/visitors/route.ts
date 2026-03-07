import { db } from '@/lib/db';
import { pageViews } from '@db/schema';
import { count, gte } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const [totalResult, todayResult] = await Promise.all([
      db.select({ count: count() }).from(pageViews),
      db
        .select({ count: count() })
        .from(pageViews)
        .where(gte(pageViews.createdAt, todayStart)),
    ]);

    return Response.json({
      total: totalResult[0]?.count ?? 0,
      today: todayResult[0]?.count ?? 0,
    });
  } catch {
    return Response.json({ total: 0, today: 0 });
  }
}
