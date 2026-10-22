// Go 서버가 index.html 의 <script id="__DATA__"> 에 넣어 주는 초기 데이터.
export type Author = { name: string | null; image: string | null } | null;

export type PostListItem = {
  id: string;
  title: string;
  slug: string;
  urlSlug: string;
  category: string | null;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: string | null;
  viewCount?: number;
  author: Author;
};

export type PostData = {
  id: string;
  title: string;
  urlSlug: string;
  category: string | null;
  content: string;
  coverImage: string | null;
  publishedAt: string | null;
  author: Author;
};

export type InitialData =
  | { page: 'home'; posts: PostListItem[]; total: number; pageSize: number }
  | { page: 'post'; post: PostData }
  | { page: 'notfound' }
  | { page: 'admin' };

function read(): InitialData | null {
  const el = document.getElementById('__DATA__');
  if (!el?.textContent) return null;
  try {
    return JSON.parse(el.textContent) as InitialData;
  } catch {
    return null;
  }
}

// 첫 화면에서만 쓴다. 이후 화면 이동(관리 화면 안)은 API 로 받는다.
export const initialData = read();
export const initialPath = window.location.pathname;
