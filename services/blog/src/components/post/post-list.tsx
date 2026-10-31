import type { PostListItem } from '@/data';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthorLink } from './author-link';

type Post = PostListItem;

export function PostList({
  initialPosts,
  total,
  pageSize,
}: {
  initialPosts: Post[];
  total: number;
  pageSize: number;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const hasMore = posts.length < total;

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    const nextPage = page + 1;
    try {
      const res = await fetch(`/api/posts?page=${nextPage}&limit=${pageSize}`);
      const data = await res.json();
      setPosts((prev) => [...prev, ...data.posts]);
      setPage(nextPage);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, pageSize]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  if (posts.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-[15px]">아직 작성된 글이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {posts.map((post) => (
        <a key={post.id} href={`/${post.urlSlug}`} className="group block">
          <article className="py-6 border-b border-gray-100 dark:border-gray-800 last:border-0 flex flex-col sm:flex-row sm:gap-5">
            <div
              className={`relative w-full h-[180px] sm:w-[160px] sm:h-[100px] shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 mb-3 sm:mb-0${
                post.coverImage ? '' : ' hidden sm:block'
              }`}
            >
              {post.coverImage && (
                <img
                  src={post.coverImage}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                {post.category && (
                  <span className="text-[12px] font-medium text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded">
                    {post.category}
                  </span>
                )}
                {post.publishedAt && (
                  <time
                    dateTime={post.publishedAt}
                    className="text-[13px] text-gray-500 dark:text-gray-400"
                  >
                    {new Date(post.publishedAt).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                )}
                {post.viewCount != null && post.viewCount > 0 && (
                  <span className="text-[13px] text-gray-500 dark:text-gray-400">
                    조회 {post.viewCount.toLocaleString()}
                  </span>
                )}
              </div>
              <h2 className="text-[18px] font-semibold text-gray-900 dark:text-gray-100 leading-snug tracking-tight group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors duration-200">
                {post.title}
              </h2>
              {post.excerpt && (
                <p className="mt-2 text-[14px] text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-2">
                  {post.excerpt}
                </p>
              )}
              {post.author?.name && (
                <p className="mt-3 text-[12px] text-gray-500 dark:text-gray-400">
                  <AuthorLink
                    name={post.author.name}
                    className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    stopPropagation
                  />
                </p>
              )}
            </div>
          </article>
        </a>
      ))}
      {hasMore && <div ref={sentinelRef} className="h-px" />}
    </div>
  );
}
