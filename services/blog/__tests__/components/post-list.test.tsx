import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PostList } from '../../src/components/post/post-list';

afterEach(cleanup);

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const createPost = (
  overrides: Partial<Parameters<typeof PostList>[0]['posts'][number]> = {},
) => ({
  id: '1',
  title: '테스트 글 제목',
  slug: 'test-post',
  category: null as string | null,
  excerpt: '테스트 요약입니다.',
  coverImage: null,
  publishedAt: '2025-01-15T00:00:00.000Z',
  author: { name: '홍길동', image: null },
  ...overrides,
});

describe('PostList', () => {
  it('UI-001: 빈 목록이면 "아직 작성된 글이 없습니다." 메시지를 표시한다', () => {
    render(<PostList posts={[]} />);
    expect(screen.getByText('아직 작성된 글이 없습니다.')).toBeInTheDocument();
  });

  it('UI-002: 글 제목을 h2 태그로 렌더링한다', () => {
    render(<PostList posts={[createPost({ title: 'Next.js 시작하기' })]} />);
    const heading = screen.getByRole('heading', {
      level: 2,
      name: 'Next.js 시작하기',
    });
    expect(heading).toBeInTheDocument();
  });

  it('UI-003: 글 링크의 href가 /<slug> 형식이다', () => {
    render(<PostList posts={[createPost({ slug: 'my-first-post' })]} />);
    const link = screen.getByRole('link', { name: /테스트 글 제목/ });
    expect(link).toHaveAttribute('href', '/my-first-post');
  });

  it('UI-004: excerpt가 있으면 요약 텍스트를 표시한다', () => {
    render(<PostList posts={[createPost({ excerpt: '이것은 요약입니다' })]} />);
    expect(screen.getByText('이것은 요약입니다')).toBeInTheDocument();
  });

  it('UI-005: excerpt가 없으면 요약 영역을 렌더링하지 않는다', () => {
    render(
      <PostList posts={[createPost({ excerpt: null })]} />,
    );
    // excerpt용 p만 없어야 함 (author.name p는 있을 수 있음)
    expect(screen.queryByText('테스트 요약입니다.')).not.toBeInTheDocument();
  });

  it('UI-006: 작성자 이름을 표시한다', () => {
    render(
      <PostList
        posts={[createPost({ author: { name: '김작가', image: null } })]}
      />,
    );
    expect(screen.getByText('김작가')).toBeInTheDocument();
  });

  it('UI-007: 작성자가 없으면 이름 영역을 렌더링하지 않는다', () => {
    render(<PostList posts={[createPost({ author: null })]} />);
    expect(screen.queryByText('홍길동')).not.toBeInTheDocument();
  });

  it('UI-008: publishedAt이 있으면 ko-KR 형식으로 날짜를 표시한다', () => {
    render(
      <PostList
        posts={[createPost({ publishedAt: '2025-01-15T00:00:00.000Z' })]}
      />,
    );
    const timeEl = screen.getByRole('time');
    expect(timeEl).toHaveAttribute('datetime', '2025-01-15T00:00:00.000Z');
    expect(timeEl).toHaveTextContent(
      new Date('2025-01-15T00:00:00.000Z').toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    );
  });

  it('UI-009: publishedAt이 없으면 time 태그를 렌더링하지 않는다', () => {
    render(<PostList posts={[createPost({ publishedAt: null })]} />);
    expect(screen.queryByRole('time')).not.toBeInTheDocument();
  });

  it('여러 글이 있으면 글 수만큼 article을 렌더링한다', () => {
    const posts = [
      createPost({ id: '1', title: '글 1', slug: 'post-1' }),
      createPost({ id: '2', title: '글 2', slug: 'post-2' }),
      createPost({ id: '3', title: '글 3', slug: 'post-3' }),
    ];
    render(<PostList posts={posts} />);
    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(3);
  });
});
