/**
 * Docker entrypoint: 마이그레이션 → backfill → Next.js start
 *
 * production 의존성(postgres, drizzle-orm)만 사용하므로
 * drizzle-kit, tsx 없이 동작합니다.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'drizzle', 'migrations');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

// ─── 0. DB 연결 대기 ───

async function waitForDb(maxRetries = 10, delayMs = 3000) {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      await sql`SELECT 1`;
      console.log('  ✅ DB connected');
      return;
    } catch (err) {
      console.log(`  ⏳ DB not ready (attempt ${i}/${maxRetries}): ${err.message}`);
      if (i === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

// ─── 1. 마이그레이션 ───

async function runMigrations() {
  // drizzle 마이그레이션 히스토리 테이블 생성
  await sql`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at BIGINT
    )
  `;

  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf-8')
  );

  const applied = await sql`SELECT hash FROM "__drizzle_migrations"`;
  const appliedHashes = new Set(applied.map((r) => r.hash));

  for (const entry of journal.entries) {
    const migrationFile = `${entry.tag}.sql`;
    const hash = migrationFile;

    if (appliedHashes.has(hash)) {
      console.log(`  ⏭️  ${migrationFile} (already applied)`);
      continue;
    }

    const filePath = join(MIGRATIONS_DIR, migrationFile);
    const content = readFileSync(filePath, 'utf-8');

    // drizzle-kit 포맷: --> statement-breakpoint 로 구문 분리
    const statements = content
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      await sql.unsafe(stmt);
    }

    await sql`
      INSERT INTO "__drizzle_migrations" (hash, created_at)
      VALUES (${hash}, ${Date.now()})
    `;
    console.log(`  ✅ ${migrationFile}`);
  }
}

// ─── 2. Backfill urlSlug ───

async function translateToEnglish(text) {
  if (!/[가-힣]/.test(text)) return text;

  const readable = text.replace(/-/g, ' ');
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t&q=${encodeURIComponent(readable)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Translation failed for "${text}": ${res.status}`);

  const data = await res.json();
  return data[0].map((segment) => segment[0]).join('');
}

function toSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

async function backfillUrlSlugs() {
  const posts = await sql`
    SELECT id, slug, "urlSlug" FROM post WHERE "urlSlug" IS NULL
  `;

  if (posts.length === 0) {
    console.log('  All posts already have urlSlug.');
    return;
  }

  console.log(`  Found ${posts.length} posts without urlSlug.`);

  for (const post of posts) {
    const translated = await translateToEnglish(post.slug);
    const urlSlug = toSlug(translated);
    console.log(`    "${post.slug}" → "${urlSlug}"`);

    await sql`UPDATE post SET "urlSlug" = ${urlSlug} WHERE id = ${post.id}`;
  }

  console.log(`  ✅ Backfilled ${posts.length} posts.`);
}

// ─── Main ───

try {
  console.log('\n⏳ Waiting for DB...');
  await waitForDb();

  console.log('\n🔄 Running migrations...');
  await runMigrations();

  console.log('\n🔄 Backfilling urlSlugs...');
  await backfillUrlSlugs();

  console.log('\n✅ Database ready!\n');
} catch (err) {
  console.error('❌ Database setup failed:', err);
  process.exit(1);
} finally {
  await sql.end();
}
