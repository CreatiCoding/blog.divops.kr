export const mockAdmin = {
  id: 'cuid-admin-001',
  name: 'Admin User',
  email: 'admin@divops.kr',
  emailVerified: null,
  image: 'https://github.com/admin.png',
  role: 'ADMIN' as const,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

export const mockUser = {
  id: 'cuid-user-001',
  name: 'Regular User',
  email: 'user@example.com',
  emailVerified: null,
  image: null,
  role: 'USER' as const,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};
