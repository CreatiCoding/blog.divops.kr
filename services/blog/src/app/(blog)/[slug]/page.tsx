import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { posts, users } from '@db/schema';
import { PostDetail } from '@/components/post/post-detail';
import { TableOfContents } from '@/components/post/table-of-contents';

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
    .where(eq(posts.slug, slug));

  if (!post) notFound();

  return (
    <div className="max-w-[960px] mx-auto px-6 py-12 lg:flex lg:gap-10">
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
        />
      </section>
    </div>
  );
}
