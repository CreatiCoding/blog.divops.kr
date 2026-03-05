import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, posts } from './schema';

config({ path: '.env.local' });

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function main() {
  const [admin] = await db
    .insert(users)
    .values({
      email: 'admin@divops.kr',
      name: 'admin',
      role: 'ADMIN',
    })
    .onConflictDoNothing()
    .returning();

  if (admin) {
    await db
      .insert(posts)
      .values({
        title: 'Hello World',
        slug: 'hello-world',
        content: '<p>블로그의 첫 번째 글입니다. 환영합니다!</p>',
        excerpt: '블로그의 첫 번째 글입니다.',
        published: true,
        publishedAt: new Date(),
        authorId: admin.id,
      })
      .onConflictDoNothing();
  }

  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.end());
