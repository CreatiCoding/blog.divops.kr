import { vi } from 'vitest';
import { mockAdmin } from '@blog/fixtures';

export function mockAuth(user = mockAdmin) {
  return vi.fn().mockResolvedValue({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  });
}

export function mockNoAuth() {
  return vi.fn().mockResolvedValue(null);
}
