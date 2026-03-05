import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PostDetail } from '../../src/components/post/post-detail';

afterEach(cleanup);

vi.mock('next/image', () => ({
  default: (props: any) => {
    const { priority, ...rest } = props;
    return <img {...rest} />;
  },
}));

const defaultProps = {
  title: '테스트 글 제목',
  content: '<p>본문 내용입니다.</p>',
  coverImage: null,
  publishedAt: '2025-01-15T00:00:00.000Z',
  author: { name: '홍길동', image: '/avatar.png' },
};

describe('PostDetail', () => {
  it('UI-010: 제목을 h1 태그로 렌더링한다', () => {
    render(<PostDetail {...defaultProps} title="딥다이브 포스트" />);
    const heading = screen.getByRole('heading', {
      level: 1,
      name: '딥다이브 포스트',
    });
    expect(heading).toBeInTheDocument();
  });

  it('UI-011: 본문 HTML 콘텐츠를 렌더링한다', () => {
    render(
      <PostDetail
        {...defaultProps}
        content="<p>Hello <strong>World</strong></p>"
      />,
    );
    expect(screen.getByText('World')).toBeInTheDocument();
  });

  it('UI-012: 커버 이미지가 있으면 img를 렌더링한다', () => {
    render(
      <PostDetail {...defaultProps} coverImage="/cover.png" title="커버 글" />,
    );
    const img = screen.getByAltText('커버 글');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/cover.png');
  });

  it('UI-013: 커버 이미지가 없으면 커버 img를 렌더링하지 않는다', () => {
    render(<PostDetail {...defaultProps} coverImage={null} />);
    // 아바타만 존재, 커버 이미지는 없어야 한다
    const images = screen.queryAllByRole('img');
    expect(images).toHaveLength(1); // 아바타만
    expect(images[0]).toHaveAttribute('src', '/avatar.png');
  });

  it('UI-014: 작성자 아바타가 있으면 img를 렌더링한다', () => {
    render(
      <PostDetail
        {...defaultProps}
        author={{ name: '홍길동', image: '/avatar.png' }}
      />,
    );
    const avatar = screen.getByAltText('홍길동');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('src', '/avatar.png');
  });

  it('UI-015: 작성자 아바타가 없으면 아바타 img를 렌더링하지 않는다', () => {
    render(
      <PostDetail
        {...defaultProps}
        author={{ name: '홍길동', image: null }}
        coverImage={null}
      />,
    );
    const images = screen.queryAllByRole('img');
    expect(images).toHaveLength(0);
  });

  it('UI-016: publishedAt이 있으면 time 태그로 날짜를 렌더링한다', () => {
    render(
      <PostDetail
        {...defaultProps}
        publishedAt="2025-03-01T00:00:00.000Z"
      />,
    );
    const timeEl = screen.getByRole('time');
    expect(timeEl).toHaveAttribute('datetime', '2025-03-01T00:00:00.000Z');
    expect(timeEl).toHaveTextContent(
      new Date('2025-03-01T00:00:00.000Z').toLocaleDateString('ko-KR'),
    );
  });
});
