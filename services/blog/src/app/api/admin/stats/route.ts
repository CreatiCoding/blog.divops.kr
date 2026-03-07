import { db } from '@/lib/db';
import { pageViews } from '@db/schema';
import { sql, gte, count } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalResult,
    todayResult,
    dailyVisitors,
    topPages,
    topReferrers,
    topUserAgents,
  ] = await Promise.all([
    // Total visitors
    db.select({ count: count() }).from(pageViews),

    // Today visitors
    db
      .select({ count: count() })
      .from(pageViews)
      .where(gte(pageViews.createdAt, todayStart)),

    // Daily visitors (last 30 days)
    db
      .select({
        date: sql<string>`DATE(${pageViews.createdAt})`.as('date'),
        count: count(),
      })
      .from(pageViews)
      .where(gte(pageViews.createdAt, thirtyDaysAgo))
      .groupBy(sql`DATE(${pageViews.createdAt})`)
      .orderBy(sql`DATE(${pageViews.createdAt})`),

    // Top pages
    db
      .select({
        path: pageViews.path,
        count: count(),
      })
      .from(pageViews)
      .groupBy(pageViews.path)
      .orderBy(sql`count(*) DESC`)
      .limit(10),

    // Top referrers
    db
      .select({
        referrer: pageViews.referrer,
        count: count(),
      })
      .from(pageViews)
      .where(sql`${pageViews.referrer} IS NOT NULL AND ${pageViews.referrer} != ''`)
      .groupBy(pageViews.referrer)
      .orderBy(sql`count(*) DESC`)
      .limit(10),

    // Top user agents
    db
      .select({
        userAgent: pageViews.userAgent,
        count: count(),
      })
      .from(pageViews)
      .where(sql`${pageViews.userAgent} IS NOT NULL AND ${pageViews.userAgent} != ''`)
      .groupBy(pageViews.userAgent)
      .orderBy(sql`count(*) DESC`)
      .limit(10),
  ]);

  return Response.json({
    total: totalResult[0]?.count ?? 0,
    today: todayResult[0]?.count ?? 0,
    dailyVisitors,
    topPages,
    topReferrers,
    topUserAgents,
  });
}
