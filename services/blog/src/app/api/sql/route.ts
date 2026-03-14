import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

const SQL_TOKEN = process.env.SQL_TOKEN;

export async function POST(request: Request) {
  // 토큰 인증
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token || !SQL_TOKEN || token !== SQL_TOKEN) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'query (string) is required' }, { status: 400 });
    }

    const result = await db.execute(sql.raw(query));

    return Response.json({
      success: true,
      rows: result,
      rowCount: result.length,
    });
  } catch (err) {
    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
