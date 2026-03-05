import { randomBytes } from 'crypto';

export function createId(): string {
  return randomBytes(16).toString('hex');
}
