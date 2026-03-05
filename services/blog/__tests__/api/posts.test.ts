import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {},
}));

vi.mock('@db/schema', () => ({
  posts: {
    id: 'posts.id',
    title: 'posts.title',
    slug: 'posts.slug',
    content: 'posts.content',
    excerpt: 'posts.excerpt',
    coverImage: 'posts.coverImage',
    published: 'posts.published',
    publishedAt: 'posts.publishedAt',
    authorId: 'posts.authorId',
    createdAt: 'posts.createdAt',
    updatedAt: 'posts.updatedAt',
  },
  users: {
    id: 'users.id',
    name: 'users.name',
    image: 'users.image',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
  desc: vi.fn((col: unknown) => ({ type: 'desc', col })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  count: vi.fn(() => 'count()'),
}));

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const mockedAuth = vi.mocked(auth) as any;

// ─── Helpers ───

const BASE_URL = 'http://localhost:3000';

const mockSession = {
  user: { id: 'user-1', name: 'Test User', email: 'test@test.com', image: null },
  expires: new Date(Date.now() + 86400000).toISOString(),
};

function jsonRequest(url: string, options?: RequestInit) {
  return new Request(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
}

/**
 * Drizzle 체이닝 mock을 만드는 헬퍼.
 * 마지막 메서드가 호출되면 resolvedValue를 반환한다.
 */
function createChain(resolvedValue: unknown, methods: string[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const lastMethod = methods[methods.length - 1];

  for (const method of methods) {
    if (method === lastMethod) {
      chain[method] = vi.fn().mockResolvedValue(resolvedValue);
    } else {
      chain[method] = vi.fn().mockReturnValue(chain);
    }
  }

  return chain;
}

// ─── Tests ───

describe('Posts API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // import 캐시 초기화 (각 테스트에서 route를 fresh하게 import)
    vi.resetModules();
  });

  // ────────────────────────────
  // GET /api/posts
  // ────────────────────────────

  describe('GET /api/posts', () => {
    function setupGetMock(postList: unknown[], totalCount: number) {
      // db.select()가 두 번 호출된다:
      //   1) 목록 쿼리: select({...}).from().leftJoin().where().orderBy().limit().offset()
      //   2) count 쿼리: select({value: count()}).from().where()
      let callIndex = 0;

      const listChain = createChain(postList, [
        'from',
        'leftJoin',
        'where',
        'orderBy',
        'limit',
        'offset',
      ]);

      const countChain = createChain([{ value: totalCount }], [
        'from',
        'where',
      ]);

      const dbMock = db as unknown as Record<string, unknown>;
      dbMock.select = vi.fn().mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) return listChain;
        return countChain;
      });
    }

    it('POST-001: 기본 조회 - page=1, limit=10 기본값, published=true만', async () => {
      const fakePosts = [
        {
          id: 'post-1',
          title: 'First Post',
          slug: 'first-post',
          excerpt: 'excerpt',
          coverImage: null,
          publishedAt: new Date('2025-01-01'),
          author: { name: 'Test User', image: null },
        },
      ];
      setupGetMock(fakePosts, 1);

      const { GET } = await import('@/app/api/posts/route');
      const response = await GET(jsonRequest(`${BASE_URL}/api/posts`));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.posts).toHaveLength(1);
      expect(data.total).toBe(1);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(10);
    });

    it('POST-002: 페이지네이션 - ?page=2&limit=5', async () => {
      const fakePosts = [
        {
          id: 'post-6',
          title: 'Sixth Post',
          slug: 'sixth-post',
          excerpt: null,
          coverImage: null,
          publishedAt: new Date('2025-01-06'),
          author: { name: 'Test User', image: null },
        },
      ];
      setupGetMock(fakePosts, 10);

      const { GET } = await import('@/app/api/posts/route');
      const response = await GET(
        jsonRequest(`${BASE_URL}/api/posts?page=2&limit=5`)
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.page).toBe(2);
      expect(data.limit).toBe(5);
      expect(data.total).toBe(10);
      expect(data.posts).toHaveLength(1);
    });

    it('POST-004: author 정보 포함', async () => {
      const fakePosts = [
        {
          id: 'post-1',
          title: 'Post with Author',
          slug: 'post-with-author',
          excerpt: null,
          coverImage: null,
          publishedAt: new Date(),
          author: { name: 'Author Name', image: 'https://example.com/avatar.png' },
        },
      ];
      setupGetMock(fakePosts, 1);

      const { GET } = await import('@/app/api/posts/route');
      const response = await GET(jsonRequest(`${BASE_URL}/api/posts`));
      const data = await response.json();

      expect(data.posts[0].author).toEqual({
        name: 'Author Name',
        image: 'https://example.com/avatar.png',
      });
    });

    it('POST-007: 빈 결과', async () => {
      setupGetMock([], 0);

      const { GET } = await import('@/app/api/posts/route');
      const response = await GET(jsonRequest(`${BASE_URL}/api/posts`));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.posts).toEqual([]);
      expect(data.total).toBe(0);
    });
  });

  // ────────────────────────────
  // POST /api/posts
  // ────────────────────────────

  describe('POST /api/posts', () => {
    function setupInsertMock(returnValue: unknown[]) {
      const chain = createChain(returnValue, ['values', 'returning']);
      const dbMock = db as unknown as Record<string, unknown>;
      dbMock.insert = vi.fn().mockReturnValue(chain);
    }

    it('POST-010: 초안 정상 생성 (published=false)', async () => {
      mockedAuth.mockResolvedValue(mockSession);
      const createdPost = {
        id: 'post-new',
        title: 'Draft Post',
        slug: 'draft-post',
        content: 'Draft content',
        published: false,
        publishedAt: null,
        authorId: 'user-1',
      };
      setupInsertMock([createdPost]);

      const { POST } = await import('@/app/api/posts/route');
      const response = await POST(
        jsonRequest(`${BASE_URL}/api/posts`, {
          method: 'POST',
          body: JSON.stringify({
            title: 'Draft Post',
            content: 'Draft content',
            slug: 'draft-post',
            published: false,
          }),
        })
      );
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.published).toBe(false);
      expect(data.publishedAt).toBeNull();
    });

    it('POST-011: 발행 정상 생성 (published=true, publishedAt 설정)', async () => {
      mockedAuth.mockResolvedValue(mockSession);
      const createdPost = {
        id: 'post-new',
        title: 'Published Post',
        slug: 'published-post',
        content: 'Published content',
        published: true,
        publishedAt: new Date().toISOString(),
        authorId: 'user-1',
      };
      setupInsertMock([createdPost]);

      const { POST } = await import('@/app/api/posts/route');
      const response = await POST(
        jsonRequest(`${BASE_URL}/api/posts`, {
          method: 'POST',
          body: JSON.stringify({
            title: 'Published Post',
            content: 'Published content',
            slug: 'published-post',
            published: true,
          }),
        })
      );
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.published).toBe(true);
      expect(data.publishedAt).not.toBeNull();
    });

    it('POST-012: 미인증 -> 401', async () => {
      mockedAuth.mockResolvedValue(null);

      const { POST } = await import('@/app/api/posts/route');
      const response = await POST(
        jsonRequest(`${BASE_URL}/api/posts`, {
          method: 'POST',
          body: JSON.stringify({
            title: 'Test',
            content: 'Content',
            slug: 'test',
          }),
        })
      );

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('POST-013: title 누락 -> 400', async () => {
      mockedAuth.mockResolvedValue(mockSession);

      const { POST } = await import('@/app/api/posts/route');
      const response = await POST(
        jsonRequest(`${BASE_URL}/api/posts`, {
          method: 'POST',
          body: JSON.stringify({
            content: 'Content',
            slug: 'test',
          }),
        })
      );

      expect(response.status).toBe(400);
    });

    it('POST-014: content 누락 -> 400', async () => {
      mockedAuth.mockResolvedValue(mockSession);

      const { POST } = await import('@/app/api/posts/route');
      const response = await POST(
        jsonRequest(`${BASE_URL}/api/posts`, {
          method: 'POST',
          body: JSON.stringify({
            title: 'Test',
            slug: 'test',
          }),
        })
      );

      expect(response.status).toBe(400);
    });

    it('POST-015: slug 누락 -> 400', async () => {
      mockedAuth.mockResolvedValue(mockSession);

      const { POST } = await import('@/app/api/posts/route');
      const response = await POST(
        jsonRequest(`${BASE_URL}/api/posts`, {
          method: 'POST',
          body: JSON.stringify({
            title: 'Test',
            content: 'Content',
          }),
        })
      );

      expect(response.status).toBe(400);
    });

    it('POST-017: published 미지정 -> false 기본값', async () => {
      mockedAuth.mockResolvedValue(mockSession);
      const createdPost = {
        id: 'post-new',
        title: 'No Published Flag',
        slug: 'no-published-flag',
        content: 'Content',
        published: false,
        publishedAt: null,
        authorId: 'user-1',
      };
      setupInsertMock([createdPost]);

      const { POST } = await import('@/app/api/posts/route');
      const response = await POST(
        jsonRequest(`${BASE_URL}/api/posts`, {
          method: 'POST',
          body: JSON.stringify({
            title: 'No Published Flag',
            content: 'Content',
            slug: 'no-published-flag',
            // published 필드 생략
          }),
        })
      );
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.published).toBe(false);
    });
  });

  // ────────────────────────────
  // GET /api/posts/:id
  // ────────────────────────────

  describe('GET /api/posts/:id', () => {
    function setupSelectOneMock(result: unknown[]) {
      const chain = createChain(result, [
        'from',
        'leftJoin',
        'where',
      ]);
      const dbMock = db as unknown as Record<string, unknown>;
      dbMock.select = vi.fn().mockReturnValue(chain);
    }

    it('POST-020: 정상 조회', async () => {
      const fakePost = {
        id: 'post-1',
        title: 'Test Post',
        slug: 'test-post',
        content: 'Full content here',
        excerpt: 'excerpt',
        coverImage: null,
        published: true,
        publishedAt: new Date('2025-01-01').toISOString(),
        authorId: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: { name: 'Test User', image: null },
      };
      setupSelectOneMock([fakePost]);

      const { GET } = await import('@/app/api/posts/[id]/route');
      const response = await GET(
        jsonRequest(`${BASE_URL}/api/posts/post-1`),
        { params: Promise.resolve({ id: 'post-1' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('post-1');
      expect(data.content).toBe('Full content here');
      expect(data.author.name).toBe('Test User');
    });

    it('POST-021: 존재하지 않는 ID -> 404', async () => {
      setupSelectOneMock([]);

      const { GET } = await import('@/app/api/posts/[id]/route');
      const response = await GET(
        jsonRequest(`${BASE_URL}/api/posts/nonexistent`),
        { params: Promise.resolve({ id: 'nonexistent' }) }
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Not found');
    });
  });

  // ────────────────────────────
  // PUT /api/posts/:id
  // ────────────────────────────

  describe('PUT /api/posts/:id', () => {
    function setupPutMocks(
      existing: unknown[] | null,
      updated: unknown[] = []
    ) {
      const dbMock = db as unknown as Record<string, unknown>;

      // select는 기존 글 조회용 (from().where() 체이닝)
      const existingChain = createChain(existing ?? [], ['from', 'where']);
      dbMock.select = vi.fn().mockImplementation(() => {
        return existingChain;
      });

      // update 체이닝
      const updateChain = createChain(updated, ['set', 'where', 'returning']);
      dbMock.update = vi.fn().mockReturnValue(updateChain);
    }

    it('POST-030: 정상 수정', async () => {
      mockedAuth.mockResolvedValue(mockSession);
      const existing = {
        id: 'post-1',
        title: 'Old Title',
        authorId: 'user-1',
        published: true,
        publishedAt: new Date('2025-01-01'),
      };
      const updated = {
        id: 'post-1',
        title: 'New Title',
        authorId: 'user-1',
        published: true,
        publishedAt: new Date('2025-01-01'),
        updatedAt: new Date(),
      };
      setupPutMocks([existing], [updated]);

      const { PUT } = await import('@/app/api/posts/[id]/route');
      const response = await PUT(
        jsonRequest(`${BASE_URL}/api/posts/post-1`, {
          method: 'PUT',
          body: JSON.stringify({ title: 'New Title' }),
        }),
        { params: Promise.resolve({ id: 'post-1' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe('New Title');
    });

    it('POST-031: 미인증 -> 401', async () => {
      mockedAuth.mockResolvedValue(null);

      const { PUT } = await import('@/app/api/posts/[id]/route');
      const response = await PUT(
        jsonRequest(`${BASE_URL}/api/posts/post-1`, {
          method: 'PUT',
          body: JSON.stringify({ title: 'New Title' }),
        }),
        { params: Promise.resolve({ id: 'post-1' }) }
      );

      expect(response.status).toBe(401);
    });

    it('POST-032: 존재하지 않는 글 -> 404', async () => {
      mockedAuth.mockResolvedValue(mockSession);
      setupPutMocks([]);

      const { PUT } = await import('@/app/api/posts/[id]/route');
      const response = await PUT(
        jsonRequest(`${BASE_URL}/api/posts/nonexistent`, {
          method: 'PUT',
          body: JSON.stringify({ title: 'New Title' }),
        }),
        { params: Promise.resolve({ id: 'nonexistent' }) }
      );

      expect(response.status).toBe(404);
    });

    it('POST-033: 다른 사용자 글 -> 403', async () => {
      mockedAuth.mockResolvedValue(mockSession);
      const existing = {
        id: 'post-1',
        title: 'Other User Post',
        authorId: 'user-other', // 다른 사용자
        published: false,
        publishedAt: null,
      };
      setupPutMocks([existing]);

      const { PUT } = await import('@/app/api/posts/[id]/route');
      const response = await PUT(
        jsonRequest(`${BASE_URL}/api/posts/post-1`, {
          method: 'PUT',
          body: JSON.stringify({ title: 'Hijack' }),
        }),
        { params: Promise.resolve({ id: 'post-1' }) }
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });

    it('POST-034: 초안 -> 발행 전환 (publishedAt 설정)', async () => {
      mockedAuth.mockResolvedValue(mockSession);
      const existing = {
        id: 'post-1',
        title: 'Draft',
        authorId: 'user-1',
        published: false, // 초안
        publishedAt: null,
      };
      const updated = {
        id: 'post-1',
        title: 'Draft',
        authorId: 'user-1',
        published: true,
        publishedAt: new Date(), // 새로 설정됨
        updatedAt: new Date(),
      };
      setupPutMocks([existing], [updated]);

      const { PUT } = await import('@/app/api/posts/[id]/route');
      const response = await PUT(
        jsonRequest(`${BASE_URL}/api/posts/post-1`, {
          method: 'PUT',
          body: JSON.stringify({ published: true }),
        }),
        { params: Promise.resolve({ id: 'post-1' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.published).toBe(true);
      expect(data.publishedAt).not.toBeNull();
    });

    it('POST-035: 이미 발행된 글 수정 (publishedAt 유지)', async () => {
      mockedAuth.mockResolvedValue(mockSession);
      const originalPublishedAt = new Date('2025-01-01');
      const existing = {
        id: 'post-1',
        title: 'Published',
        authorId: 'user-1',
        published: true, // 이미 발행
        publishedAt: originalPublishedAt,
      };
      const updated = {
        id: 'post-1',
        title: 'Updated Published',
        authorId: 'user-1',
        published: true,
        publishedAt: originalPublishedAt, // 유지
        updatedAt: new Date(),
      };
      setupPutMocks([existing], [updated]);

      const { PUT } = await import('@/app/api/posts/[id]/route');
      const response = await PUT(
        jsonRequest(`${BASE_URL}/api/posts/post-1`, {
          method: 'PUT',
          body: JSON.stringify({ title: 'Updated Published', published: true }),
        }),
        { params: Promise.resolve({ id: 'post-1' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      // publishedAt이 원래 값 그대로 유지되어야 한다
      expect(new Date(data.publishedAt).toISOString()).toBe(
        originalPublishedAt.toISOString()
      );
    });
  });

  // ────────────────────────────
  // DELETE /api/posts/:id
  // ────────────────────────────

  describe('DELETE /api/posts/:id', () => {
    function setupDeleteMocks(existing: unknown[] | null) {
      const dbMock = db as unknown as Record<string, unknown>;

      // select 체이닝 (기존 글 조회)
      const selectChain = createChain(existing ?? [], ['from', 'where']);
      dbMock.select = vi.fn().mockReturnValue(selectChain);

      // delete 체이닝
      const deleteChain = createChain(undefined, ['where']);
      dbMock.delete = vi.fn().mockReturnValue(deleteChain);
    }

    it('POST-040: 정상 삭제', async () => {
      mockedAuth.mockResolvedValue(mockSession);
      setupDeleteMocks([
        { id: 'post-1', authorId: 'user-1', title: 'To Delete' },
      ]);

      const { DELETE } = await import('@/app/api/posts/[id]/route');
      const response = await DELETE(
        jsonRequest(`${BASE_URL}/api/posts/post-1`, { method: 'DELETE' }),
        { params: Promise.resolve({ id: 'post-1' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('POST-041: 미인증 -> 401', async () => {
      mockedAuth.mockResolvedValue(null);

      const { DELETE } = await import('@/app/api/posts/[id]/route');
      const response = await DELETE(
        jsonRequest(`${BASE_URL}/api/posts/post-1`, { method: 'DELETE' }),
        { params: Promise.resolve({ id: 'post-1' }) }
      );

      expect(response.status).toBe(401);
    });

    it('POST-042: 존재하지 않는 글 -> 404', async () => {
      mockedAuth.mockResolvedValue(mockSession);
      setupDeleteMocks([]);

      const { DELETE } = await import('@/app/api/posts/[id]/route');
      const response = await DELETE(
        jsonRequest(`${BASE_URL}/api/posts/nonexistent`, { method: 'DELETE' }),
        { params: Promise.resolve({ id: 'nonexistent' }) }
      );

      expect(response.status).toBe(404);
    });

    it('POST-043: 다른 사용자 글 -> 403', async () => {
      mockedAuth.mockResolvedValue(mockSession);
      setupDeleteMocks([
        { id: 'post-1', authorId: 'user-other', title: 'Not Mine' },
      ]);

      const { DELETE } = await import('@/app/api/posts/[id]/route');
      const response = await DELETE(
        jsonRequest(`${BASE_URL}/api/posts/post-1`, { method: 'DELETE' }),
        { params: Promise.resolve({ id: 'post-1' }) }
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });
  });
});
