import { useEffect, useState } from 'react';
import { PostList } from '@/components/post/post-list';
import { initialData, type PostListItem } from '@/data';

const PAGE_SIZE = 10;

export function HomePage() {
  const seeded = initialData?.page === 'home' ? initialData : null;
  const [state, setState] = useState<{ posts: PostListItem[]; total: number } | null>(
    seeded ? { posts: seeded.posts, total: seeded.total } : null,
  );

  // 서버 데이터가 없을 때(개발 서버 등)만 API 로 받는다.
  useEffect(() => {
    if (state) return;
    fetch(`/api/posts?page=1&limit=${PAGE_SIZE}`)
      .then((res) => res.json())
      .then((data) => setState({ posts: data.posts, total: data.total }))
      .catch(() => setState({ posts: [], total: 0 }));
  }, [state]);

  return (
    <section className="max-w-[720px] mx-auto px-6 pt-12 sm:pt-20 pb-16">
      <div className="mb-8 sm:mb-16">
        <h1 className="text-[28px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          Blog
        </h1>
        <p className="mt-2 text-[15px] text-gray-600 dark:text-gray-300">
          DevOps와 프론트엔드 개발에 대한 이야기
        </p>
      </div>
      {state && <PostList initialPosts={state.posts} total={state.total} pageSize={PAGE_SIZE} />}
    </section>
  );
}
