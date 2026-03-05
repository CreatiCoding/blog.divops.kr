import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { posts, users } from '@db/schema';
import { PostDetail } from '@/components/post/post-detail';

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const allPosts = await db
      .select({ slug: posts.slug })
      .from(posts)
      .where(eq(posts.published, true));

    return allPosts.map((post) => ({ slug: post.slug }));
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
  const slug = decodeURIComponent(rawSlug);
  try {
    const [post] = await db
      .select()
      .from(posts)
      .where(eq(posts.slug, slug));

    if (!post) return {};

    return {
      title: post.title,
      description: post.excerpt,
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
  const slug = decodeURIComponent(rawSlug);

  const [post] = await db
    .select({
      id: posts.id,
      title: posts.title,
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
    .where(eq(posts.slug, slug));

  if (!post) notFound();

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <PostDetail
        title={post.title}
        content={post.content}
        coverImage={post.coverImage}
        publishedAt={post.publishedAt?.toISOString() ?? null}
        author={post.author}
      />
    </main>
  );
}
