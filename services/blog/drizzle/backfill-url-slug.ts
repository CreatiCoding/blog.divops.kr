import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { posts } from './schema';

config({ path: '.env.local' });

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

const isDryRun = process.argv.includes('--dry-run');

/**
 * 한글 slug를 영어로 번역하여 urlSlug를 채우는 스크립트.
 *
 * Google Translate 무료 API를 사용하여 한글 → 영어 번역 후
 * slug 형식(kebab-case)으로 변환합니다.
 *
 * 사용법:
 *   yarn db:backfill-url-slug              # 실제 업데이트
 *   yarn db:backfill-url-slug --dry-run    # 미리보기만
 */

async function translateToEnglish(text: string): Promise<string> {
  // 한글이 포함되지 않은 경우 그대로 반환
  if (!/[가-힣]/.test(text)) {
    return text;
  }

  // slug의 하이픈을 공백으로 변환하여 번역 품질 향상
  const readable = text.replace(/-/g, ' ');

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t&q=${encodeURIComponent(readable)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Translation failed for "${text}": ${res.status}`);
  }

  const data = await res.json();
  const translated: string = data[0]
    .map((segment: [string]) => segment[0])
    .join('');

  return translated;
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

async function main() {
  const allPosts = await db
    .select({ id: posts.id, title: posts.title, slug: posts.slug, urlSlug: posts.urlSlug })
    .from(posts);

  const postsToUpdate = allPosts.filter((p) => !p.urlSlug);

  if (isDryRun) {
    console.log(`\n📋 [DRY RUN] 전체 ${allPosts.length}개 포스트 미리보기\n`);
    console.log('─'.repeat(80));

    for (const post of allPosts) {
      if (post.urlSlug) {
        console.log(`  ✅ "${post.slug}" → "${post.urlSlug}" (이미 설정됨)`);
      } else {
        const translated = await translateToEnglish(post.slug);
        const urlSlug = toSlug(translated);
        console.log(`  🔄 "${post.slug}" → "${urlSlug}" (변환 예정)`);
      }
    }

    console.log('─'.repeat(80));
    console.log(`\n  변환 대상: ${postsToUpdate.length}개`);
    console.log(`  이미 설정: ${allPosts.length - postsToUpdate.length}개`);
    console.log('\n⚠️  실제 적용하려면 --dry-run 없이 실행하세요.\n');
    return;
  }

  if (postsToUpdate.length === 0) {
    console.log('All posts already have urlSlug. Nothing to do.');
    return;
  }

  console.log(`Found ${postsToUpdate.length} posts without urlSlug.\n`);

  for (const post of postsToUpdate) {
    const translated = await translateToEnglish(post.slug);
    const urlSlug = toSlug(translated);

    console.log(`  "${post.slug}" → "${urlSlug}"`);

    await db
      .update(posts)
      .set({ urlSlug })
      .where(eq(posts.id, post.id));
  }

  console.log(`\nDone! Updated ${postsToUpdate.length} posts.`);
  console.log(
    '\nPlease review the generated urlSlugs in the admin panel.',
    '\nAfter confirming, run the NOT NULL migration:',
    '\n  ALTER TABLE "post" ALTER COLUMN "urlSlug" SET NOT NULL;'
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.end());
