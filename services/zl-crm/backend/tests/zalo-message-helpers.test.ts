import { describe, expect, it, vi, beforeEach } from 'vitest';

const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('../src/shared/database/prisma-client.js', () => ({
  prisma: {
    contact: {
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('../src/shared/utils/logger.js', () => ({
  logger: loggerMock,
}));

const { detectContentType } = await import('../src/modules/zalo/zalo-message-helpers.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('detectContentType', () => {
  it('treats Zalo webchat string messages as text without discovery log noise', () => {
    expect(detectContentType('webchat', 'anh test gui anh cai nhe')).toBe('text');
    expect(loggerMock.info).not.toHaveBeenCalled();
  });
});
