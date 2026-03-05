import { db } from '@/lib/db';
import { posts } from '@db/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
  const result = await db
    .selectDistinct({ category: posts.category })
    .from(posts)
    .where(sql`${posts.category} IS NOT NULL`)
    .orderBy(posts.category);

  const categories = result.map((r) => r.category!);

  return Response.json(categories);
}
