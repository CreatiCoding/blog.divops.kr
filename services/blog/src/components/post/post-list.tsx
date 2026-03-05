'use client';

import Link from 'next/link';

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: string | null;
  author: { name: string | null; image: string | null } | null;
};

export function PostList({ posts }: { posts: Post[] }) {
  if (posts.length === 0) {
    return <p className="text-gray-500">아직 작성된 글이 없습니다.</p>;
  }

  return (
    <div className="space-y-8">
      {posts.map((post) => (
        <article key={post.id} className="border-b pb-8">
          <Link href={`/${post.slug}`} className="group">
            <h2 className="text-2xl font-bold group-hover:text-blue-600 transition-colors">
              {post.title}
            </h2>
            {post.excerpt && (
              <p className="mt-2 text-gray-600 line-clamp-2">{post.excerpt}</p>
            )}
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
              {post.author?.name && <span>{post.author.name}</span>}
              {post.publishedAt && (
                <time dateTime={post.publishedAt}>
                  {new Date(post.publishedAt).toLocaleDateString('ko-KR')}
                </time>
              )}
            </div>
          </Link>
        </article>
      ))}
    </div>
  );
}
