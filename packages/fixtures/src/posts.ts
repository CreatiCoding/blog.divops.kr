export const mockPost = {
  id: 'cuid-post-001',
  title: 'Test Post Title',
  slug: 'test-post-title',
  content: '<p>This is test content for the blog post.</p>',
  excerpt: 'Test excerpt for the post',
  coverImage: 'https://s3.dokploy.creco.dev/blog-images/test.jpg',
  published: true,
  publishedAt: new Date('2026-01-01'),
  authorId: 'cuid-admin-001',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

export const mockDraftPost = {
  ...mockPost,
  id: 'cuid-post-002',
  title: 'Draft Post',
  slug: 'draft-post',
  published: false,
  publishedAt: null,
};

export const mockPosts = [mockPost, mockDraftPost];
