import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({}),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({ send: mockSend })),
  PutObjectCommand: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));

vi.mock('@/lib/s3', () => ({
  s3Client: { send: mockSend },
  S3_BUCKET: 'blog-images',
}));

import { auth } from '@/lib/auth';
import { PutObjectCommand } from '@aws-sdk/client-s3';

const mockedAuth = vi.mocked(auth) as any;
const MockedPutObjectCommand = vi.mocked(PutObjectCommand);

function createFile(name: string, type: string, sizeInBytes: number) {
  const buffer = new ArrayBuffer(sizeInBytes);
  return {
    name,
    type,
    size: sizeInBytes,
    arrayBuffer: () => Promise.resolve(buffer),
  } as unknown as File;
}

// formData를 mock해서 직접 반환하는 방식 사용
async function callPOST(file?: File) {
  const { POST } = await import('@/app/api/upload/route');

  const mockFormData = new Map<string, File | null>();
  if (file) {
    mockFormData.set('file', file);
  }

  const request = {
    formData: vi.fn().mockResolvedValue({
      get: (key: string) => mockFormData.get(key) ?? null,
    }),
  } as unknown as Request;

  return POST(request);
}

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.S3_ENDPOINT = 'https://s3.test.dev';
    mockedAuth.mockResolvedValue({ user: { id: '1', name: 'Test' } } as any);
    mockSend.mockResolvedValue({});
  });

  it('UPLOAD-001: JPEG 파일 정상 업로드 시 200과 url을 반환한다', async () => {
    const file = createFile('photo.jpg', 'image/jpeg', 1024);
    const response = await callPOST(file);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.url).toMatch(/^https:\/\/s3\.test\.dev\/blog-images\/uploads\/.+\.jpg$/);
  });

  it('UPLOAD-002: PNG 파일 정상 업로드 시 200을 반환한다', async () => {
    const file = createFile('image.png', 'image/png', 2048);
    const response = await callPOST(file);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.url).toMatch(/\.png$/);
  });

  it('UPLOAD-003: GIF 파일 정상 업로드 시 200을 반환한다', async () => {
    const file = createFile('animation.gif', 'image/gif', 512);
    const response = await callPOST(file);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.url).toMatch(/\.gif$/);
  });

  it('UPLOAD-004: WebP 파일 정상 업로드 시 200을 반환한다', async () => {
    const file = createFile('modern.webp', 'image/webp', 768);
    const response = await callPOST(file);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.url).toMatch(/\.webp$/);
  });

  it('UPLOAD-005: 미인증 사용자는 401을 반환한다', async () => {
    mockedAuth.mockResolvedValue(null);

    const file = createFile('photo.jpg', 'image/jpeg', 1024);
    const response = await callPOST(file);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('UPLOAD-006: 파일이 없으면 400 "No file provided"를 반환한다', async () => {
    const response = await callPOST();
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('No file provided');
  });

  it('UPLOAD-007: SVG 파일은 400을 반환한다', async () => {
    const file = createFile('icon.svg', 'image/svg+xml', 256);
    const response = await callPOST(file);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('File type not allowed. Use JPEG, PNG, GIF, or WebP.');
  });

  it('UPLOAD-008: PDF 파일은 400을 반환한다', async () => {
    const file = createFile('document.pdf', 'application/pdf', 1024);
    const response = await callPOST(file);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('File type not allowed. Use JPEG, PNG, GIF, or WebP.');
  });

  it('UPLOAD-009: 6MB 파일은 400을 반환한다', async () => {
    const sixMB = 6 * 1024 * 1024;
    const file = createFile('large.jpg', 'image/jpeg', sixMB);
    const response = await callPOST(file);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('File too large. Maximum 5MB.');
  });

  it('UPLOAD-010: 정확히 5MB 파일은 성공한다', async () => {
    const fiveMB = 5 * 1024 * 1024;
    const file = createFile('exact.png', 'image/png', fiveMB);
    const response = await callPOST(file);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.url).toBeDefined();
  });

  it('UPLOAD-011: S3 key에 원본 파일 확장자가 포함된다', async () => {
    const file = createFile('my-photo.custom.jpg', 'image/jpeg', 512);
    await callPOST(file);

    expect(MockedPutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: expect.stringMatching(/\.jpg$/),
      })
    );
  });

  it('UPLOAD-012: S3 key는 uploads/ 프리픽스와 UUID를 포함한다', async () => {
    const file = createFile('test.webp', 'image/webp', 256);
    await callPOST(file);

    const uuidPattern =
      /^uploads\/\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

    expect(MockedPutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: expect.stringMatching(uuidPattern),
      })
    );
  });
});
