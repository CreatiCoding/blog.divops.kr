/**
 * Docker entrypoint: 마이그레이션 → backfill → Next.js start
 *
 * production 의존성(postgres)만 사용하므로
 * drizzle-kit, tsx 없이 동작합니다.
 */
const { readFileSync } = require('fs');
const { join } = require('path');

const MIGRATIONS_DIR = join(__dirname, '..', 'drizzle', 'migrations');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

async function main() {
  const postgres = (await import('postgres')).default;
  const sql = postgres(DATABASE_URL);

  // ─── 1. 마이그레이션 ───

  async function runMigrations() {
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
        console.log(`  skip: ${migrationFile} (already applied)`);
        continue;
      }

      const filePath = join(MIGRATIONS_DIR, migrationFile);
      const content = readFileSync(filePath, 'utf-8');

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
      console.log(`  applied: ${migrationFile}`);
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
      console.log(`    "${post.slug}" -> "${urlSlug}"`);

      await sql`UPDATE post SET "urlSlug" = ${urlSlug} WHERE id = ${post.id}`;
    }

    console.log(`  Backfilled ${posts.length} posts.`);
  }

  // ─── Run ───

  try {
    console.log('\nRunning migrations...');
    await runMigrations();

    console.log('\nBackfilling urlSlugs...');
    await backfillUrlSlugs();

    console.log('\nDatabase ready!\n');
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('Database setup failed:', err);
  process.exit(1);
});
