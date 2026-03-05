'use client';

import Link from 'next/link';

type Post = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: string | null;
  author: { name: string | null; image: string | null } | null;
};

export function PostList({ posts }: { posts: Post[] }) {
  if (posts.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-400 text-[15px]">아직 작성된 글이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {posts.map((post) => (
        <Link key={post.id} href={`/${post.slug}`} className="group block">
          <article className="py-7 -mx-4 px-4 rounded-2xl transition-colors duration-200 hover:bg-gray-50">
            <div className="flex items-center gap-2 mb-3">
              {post.category && (
                <span className="text-[13px] font-semibold text-blue-500">
                  {post.category}
                </span>
              )}
              {post.category && post.publishedAt && (
                <span className="text-gray-300">{'·'}</span>
              )}
              {post.publishedAt && (
                <time
                  dateTime={post.publishedAt}
                  className="text-[13px] text-gray-400"
                >
                  {new Date(post.publishedAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
              )}
            </div>
            <h2 className="text-[20px] font-bold text-gray-900 leading-snug tracking-tight group-hover:text-blue-500 transition-colors duration-200">
              {post.title}
            </h2>
            {post.excerpt && (
              <p className="mt-2 text-[15px] text-gray-500 leading-relaxed line-clamp-2">
                {post.excerpt}
              </p>
            )}
            {post.author?.name && (
              <p className="mt-3 text-[13px] text-gray-400">
                {post.author.name}
              </p>
            )}
          </article>
        </Link>
      ))}
    </div>
  );
}
