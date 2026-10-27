/**
 * public-api-broadcast.test.ts — Test các endpoint public mới:
 * liệt kê accounts, broadcast đăng nhiều nhóm (+ ghi GroupPostLog).
 * Text-only để tránh tải ảnh (network). Tắt giãn nhịp giữa nhóm.
 */
process.env.BROADCAST_GROUP_DELAY_MS = '0'; // phải set TRƯỚC khi import module (đọc lúc load)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { mockPrisma } from './test-helpers.js';

const prismaMock = mockPrisma();
const sendMessageMock = vi.fn();

vi.mock('../src/shared/database/prisma-client.js', () => ({ prisma: prismaMock }));
vi.mock('../src/modules/zalo/zalo-pool.js', () => ({
  zaloPool: { getApi: vi.fn(() => ({ sendMessage: sendMessageMock })) },
}));

const { publicApiRoutes } = await import('../src/modules/api/public-api-routes.js');

const HEADERS = { 'x-api-key': 'zcrm_testkey', 'content-type': 'application/json' };

function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  app.register(publicApiRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  // apiKeyAuth → org-1
  prismaMock.appSetting.findFirst.mockResolvedValue({ orgId: 'org-1' });
  // account connected
  prismaMock.zaloAccount.findFirst.mockResolvedValue({ id: 'za-1', status: 'connected', displayName: 'Nick A' });
  // group names
  prismaMock.conversation.findMany.mockResolvedValue([
    { externalThreadId: 'g1', groupName: 'Nhóm 1' },
    { externalThreadId: 'g2', groupName: 'Nhóm 2' },
  ]);
  prismaMock.groupPostLog.create.mockResolvedValue({ id: 'log-1' });
  sendMessageMock.mockResolvedValue({ msgId: 'm1' });
});

describe('POST /api/public/groups/broadcast', () => {
  it('đăng nhiều nhóm thành công + ghi log status=ok', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST', url: '/api/public/groups/broadcast', headers: HEADERS,
      payload: { zaloAccountId: 'za-1', groupIds: ['g1', 'g2'], content: 'Hello' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ success: true, sent: 2, failed: 0, status: 'ok' });
    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    // gửi vào group → threadType = 1
    expect(sendMessageMock).toHaveBeenCalledWith('Hello', 'g1', 1);
    expect(prismaMock.groupPostLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ok', sentCount: 2, failedCount: 0 }) }),
    );
  });

  it('1 nhóm lỗi → status=partial, không dừng cả lô', async () => {
    sendMessageMock.mockResolvedValueOnce({ msgId: 'm1' }).mockRejectedValueOnce(new Error('group blocked'));
    const app = buildApp();
    const res = await app.inject({
      method: 'POST', url: '/api/public/groups/broadcast', headers: HEADERS,
      payload: { zaloAccountId: 'za-1', groupIds: ['g1', 'g2'], content: 'Hi' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ sent: 1, failed: 1, status: 'partial' });
    expect(body.results.find((r: any) => r.groupId === 'g2')).toMatchObject({ ok: false, error: 'group blocked' });
  });

  it('thiếu groupIds → 400', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST', url: '/api/public/groups/broadcast', headers: HEADERS,
      payload: { zaloAccountId: 'za-1', content: 'x' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('nick chưa connected → 422', async () => {
    prismaMock.zaloAccount.findFirst.mockResolvedValue({ id: 'za-1', status: 'disconnected', displayName: 'Nick A' });
    const app = buildApp();
    const res = await app.inject({
      method: 'POST', url: '/api/public/groups/broadcast', headers: HEADERS,
      payload: { zaloAccountId: 'za-1', groupIds: ['g1'], content: 'x' },
    });
    expect(res.statusCode).toBe(422);
  });

  it('thiếu API key → 401', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST', url: '/api/public/groups/broadcast',
      headers: { 'content-type': 'application/json' },
      payload: { zaloAccountId: 'za-1', groupIds: ['g1'], content: 'x' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/public/zalo-accounts', () => {
  it('liệt kê tài khoản theo org', async () => {
    prismaMock.zaloAccount.findMany.mockResolvedValue([
      { id: 'za-1', displayName: 'Nick A', status: 'connected', avatarUrl: null },
    ]);
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/public/zalo-accounts', headers: HEADERS });
    expect(res.statusCode).toBe(200);
    expect(res.json().accounts).toHaveLength(1);
  });
});
