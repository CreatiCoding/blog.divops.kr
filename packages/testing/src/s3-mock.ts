import { vi } from 'vitest';

export function createS3Mock() {
  return {
    send: vi.fn().mockResolvedValue({
      $metadata: { httpStatusCode: 200 },
    }),
  };
}
