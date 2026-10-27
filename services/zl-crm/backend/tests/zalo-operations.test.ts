import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({
  getFriendOnlines: vi.fn(),
}));

const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const rateLimiterMock = vi.hoisted(() => ({
  checkLimits: vi.fn(),
  recordSend: vi.fn(),
}));

vi.mock('../src/modules/zalo/zalo-pool.js', () => ({
  zaloPool: {
    getInstance: vi.fn(() => ({
      status: 'connected',
      api: apiMock,
    })),
    reconnect: vi.fn(),
  },
}));

vi.mock('../src/modules/zalo/zalo-rate-limiter.js', () => ({
  zaloRateLimiter: rateLimiterMock,
}));

vi.mock('../src/shared/database/prisma-client.js', () => ({
  prisma: {
    zaloAccount: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../src/shared/utils/logger.js', () => ({
  logger: loggerMock,
}));

const { zaloOps } = await import('../src/shared/zalo-operations.js');

beforeEach(() => {
  vi.clearAllMocks();
  rateLimiterMock.checkLimits.mockResolvedValue({ allowed: true });
});

describe('zaloOps.getFriendOnlines', () => {
  it('returns an empty presence list for malformed SDK JSON responses without error logging', async () => {
    apiMock.getFriendOnlines.mockRejectedValue(new SyntaxError('Unexpected token \'�\', "🧸 LUXURY "... is not valid JSON'));

    await expect(zaloOps.getFriendOnlines('za-1')).resolves.toEqual({ onlines: [] });
    expect(loggerMock.error).not.toHaveBeenCalled();
    expect(loggerMock.debug).toHaveBeenCalled();
  });
});
