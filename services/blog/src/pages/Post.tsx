import { PostDetail } from '@/components/post/post-detail';
import { TableOfContents } from '@/components/post/table-of-contents';
import { ViewCounter } from '@/components/post/view-counter';
import { initialData, initialPath } from '@/data';
import { useLocation } from 'react-router';
import { NotFound } from './NotFound';

// 글 상세는 Go 가 index.html 에 넣어 준 데이터로 그린다(목록의 링크는 일반 링크라 항상 서버를 거친다).
export function PostPage() {
  const { pathname } = useLocation();
  const post = initialData?.page === 'post' && pathname === initialPath ? initialData.post : null;

  if (!post) return <NotFound />;

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
          publishedAt={post.publishedAt}
          author={post.author}
          viewCounter={<ViewCounter postId={post.id} />}
        />
      </section>
    </div>
  );
}
