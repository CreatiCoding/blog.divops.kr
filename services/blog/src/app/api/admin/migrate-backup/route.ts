import { eq, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { posts, users } from '@db/schema';

interface BackupPost {
  title: string;
  slug: string;
  urlSlug: string;
  category: string;
  content: string;
  excerpt: string;
  createdAt: number;
  updatedAt: number;
}

// 일회용 마이그레이션 토큰 (마이그레이션 완료 후 이 파일 삭제)
const MIGRATE_TOKEN = process.env.MIGRATE_TOKEN;

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  // 토큰 인증 또는 세션 인증
  if (token && MIGRATE_TOKEN && token === MIGRATE_TOKEN) {
    // 토큰 인증 통과
  } else {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const [adminCheck] = await db
      .select()
      .from(users)
      .where(eq(users.name, 'CreatiCoding'))
      .limit(1);
    if (!adminCheck || adminCheck.id !== session.user.id) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }
  }

  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.name, 'CreatiCoding'))
    .limit(1);

  if (!admin) {
    return Response.json({ error: 'No user found (CreatiCoding)' }, { status: 500 });
  }

  try {
    const { posts: backupPosts, newPassword } = (await request.json()) as {
      posts: BackupPost[];
      newPassword?: string;
    };

    const results: { title: string; status: string }[] = [];

    // 1) DB 비밀번호 변경 (옵션)
    if (newPassword) {
      try {
        await db.execute(
          sql.raw(`ALTER USER blog WITH PASSWORD '${newPassword.replace(/'/g, "''")}'`)
        );
        results.push({ title: '[DB PASSWORD]', status: 'changed' });
      } catch (err) {
        results.push({
          title: '[DB PASSWORD]',
          status: `failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    // 2) 백업 포스트 마이그레이션
    if (backupPosts?.length) {
      for (const post of backupPosts) {
        try {
          const createdAt = new Date(post.createdAt);
          const updatedAt = new Date(post.updatedAt);

          const [inserted] = await db
            .insert(posts)
            .values({
              title: post.title,
              slug: post.slug,
              urlSlug: post.urlSlug,
              content: post.content,
              excerpt: post.excerpt || null,
              category: post.category,
              published: true,
              publishedAt: createdAt,
              authorId: admin.id,
              createdAt,
              updatedAt,
            })
            .onConflictDoNothing()
            .returning();

          results.push({
            title: post.title,
            status: inserted ? 'inserted' : 'skipped (conflict)',
          });
        } catch (err) {
          results.push({
            title: post.title,
            status: `failed: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    }

    return Response.json({
      success: true,
      results,
      summary: {
        total: results.length,
        inserted: results.filter((r) => r.status === 'inserted').length,
        skipped: results.filter((r) => r.status.startsWith('skipped')).length,
        failed: results.filter((r) => r.status.startsWith('failed')).length,
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
