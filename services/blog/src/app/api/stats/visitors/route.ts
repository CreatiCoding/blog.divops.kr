import { db } from '@/lib/db';
import { siteVisits } from '@db/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const [[totalRow], [todayRow]] = await Promise.all([
      db
        .select({
          count: sql<number>`count(distinct ${siteVisits.visitorId})`,
        })
        .from(siteVisits),
      db
        .select({
          count: sql<number>`count(distinct ${siteVisits.visitorId})`,
        })
        .from(siteVisits)
        .where(eq(siteVisits.visitedDate, today)),
    ]);

    return Response.json({
      total: Number(totalRow?.count ?? 0),
      today: Number(todayRow?.count ?? 0),
    });
  } catch {
    return Response.json({ total: 0, today: 0 });
  }
}
