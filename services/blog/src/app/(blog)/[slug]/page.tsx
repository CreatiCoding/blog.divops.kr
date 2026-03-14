import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { posts, users } from '@db/schema';
import { PostDetail } from '@/components/post/post-detail';
import { ViewCounter } from '@/components/post/view-counter';
import { TableOfContents } from '@/components/post/table-of-contents';

/**
 * 기존 한글 slug로 접근한 경우 영어 urlSlug로 301 리다이렉트.
 * urlSlug로 찾지 못했을 때만 호출된다.
 */
async function redirectIfOldSlug(slug: string): Promise<never> {
  const [post] = await db
    .select({ urlSlug: posts.urlSlug })
    .from(posts)
    .where(eq(posts.slug, slug));

  if (post?.urlSlug) {
    redirect(`/${post.urlSlug}`);
  }

  notFound();
}

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const allPosts = await db
      .select({ urlSlug: posts.urlSlug })
      .from(posts)
      .where(eq(posts.published, true));

    return allPosts.map((post) => ({ slug: post.urlSlug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const urlSlug = decodeURIComponent(rawSlug);
  try {
    const [post] = await db
      .select()
      .from(posts)
      .where(eq(posts.urlSlug, urlSlug));

    if (!post) return {};

    return {
      title: post.title,
      description: post.excerpt,
      alternates: {
        canonical: `/${post.urlSlug}`,
      },
      openGraph: {
        title: post.title,
        description: post.excerpt ?? undefined,
        images: post.coverImage ? [post.coverImage] : [],
        type: 'article',
        publishedTime: post.publishedAt?.toISOString(),
      },
    };
  } catch {
    return {};
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const urlSlug = decodeURIComponent(rawSlug);

  const [post] = await db
    .select({
      id: posts.id,
      title: posts.title,
      urlSlug: posts.urlSlug,
      category: posts.category,
      content: posts.content,
      coverImage: posts.coverImage,
      publishedAt: posts.publishedAt,
      author: {
        name: users.name,
        image: users.image,
      },
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.urlSlug, urlSlug));

  if (!post) {
    await redirectIfOldSlug(urlSlug);
    return; // unreachable, but satisfies TypeScript
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.publishedAt?.toISOString(),
    ...(post.coverImage && { image: post.coverImage }),
    author: post.author?.name
      ? { '@type': 'Person', name: post.author.name }
      : undefined,
    publisher: {
      '@type': 'Organization',
      name: 'blog.divops.kr',
      url: 'https://blog.divops.kr',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://blog.divops.kr/${post.urlSlug}`,
    },
  };

  return (
    <div className="max-w-[960px] mx-auto px-6 py-12 lg:flex lg:gap-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <aside className="hidden lg:block w-[200px] shrink-0">
        <TableOfContents content={post.content} />
      </aside>
      <section className="flex-1 min-w-0 max-w-[720px]">
        <PostDetail
          title={post.title}
          category={post.category}
          content={post.content}
          coverImage={post.coverImage}
          publishedAt={post.publishedAt?.toISOString() ?? null}
          author={post.author}
          viewCounter={<ViewCounter postId={post.id} />}
        />
      </section>
    </div>
  );
}
