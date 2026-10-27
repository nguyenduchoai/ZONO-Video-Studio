/**
 * chao-hang.test.ts — Test endpoint nhận job CHÀO HÀNG + worker gửi nền.
 * Mock ở biên: prisma, zalo-pool, sendToThread (public-api-routes), zaloOps, global fetch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { mockPrisma } from './test-helpers.js';

const prismaMock = mockPrisma();
const sendToThreadMock = vi.fn();
const findUserMock = vi.fn();
const getApiMock = vi.fn(() => ({ sendMessage: vi.fn() }));

vi.mock('../src/shared/database/prisma-client.js', () => ({ prisma: prismaMock }));
vi.mock('../src/modules/zalo/zalo-pool.js', () => ({ zaloPool: { getApi: getApiMock } }));
vi.mock('../src/shared/zalo-operations.js', () => ({ zaloOps: { findUser: findUserMock } }));
// Giữ apiKeyAuth/PartialSendError/PUBLIC_MAX_IMAGES thật, chỉ thay sendToThread.
vi.mock('../src/modules/api/public-api-routes.js', async (orig) => {
  const real = (await orig()) as any;
  return { ...real, sendToThread: sendToThreadMock };
});

const { chaoHangPublicRoutes } = await import('../src/modules/api/chao-hang-public-routes.js');
const { runChaoHangJob } = await import('../src/modules/api/chao-hang-worker.js');

const HEADERS = { 'x-api-key': 'zcrm_testkey', 'content-type': 'application/json' };

function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  app.register(chaoHangPublicRoutes);
  return app;
}

const JOB_BODY = {
  job_id: 123,
  po_code: 'PN00045',
  bot_base_url: 'https://noibo.example.shop',
  internal_key: 'secret-xyz',
  products: [
    { ma: 'SP1', ten: 'Áo', anh: { base: 'https://x/base.png', SL20: 'https://x/sl20.png' } },
  ],
  config: { zalo_account_id: 'za-1', send_delay_sec: 0, uid_lookup_delay_sec: 0, active_start_hour: 0, active_end_hour: 24 },
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.appSetting.findFirst.mockResolvedValue({ orgId: 'org-1' });
  prismaMock.zaloAccount.findFirst.mockResolvedValue({ id: 'za-1' });
});

describe('POST /api/public/chao-hang/jobs', () => {
  it('tạo job mới → 202 accepted + crm_job_ref', async () => {
    prismaMock.chaoHangJob.findUnique.mockResolvedValue(null);
    prismaMock.chaoHangJob.create.mockResolvedValue({ id: 'crm-job-1' });

    const app = buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/public/chao-hang/jobs', headers: HEADERS, payload: JOB_BODY });

    expect(res.statusCode).toBe(202);
    const json = res.json();
    expect(json.accepted).toBe(true);
    expect(json.crm_job_ref).toBe('crm-job-1');
    expect(prismaMock.chaoHangJob.create).toHaveBeenCalledOnce();
    await app.close();
  });

  it('thiếu internal_key → 400', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST', url: '/api/public/chao-hang/jobs', headers: HEADERS,
      payload: { ...JOB_BODY, internal_key: '' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('nick gửi không thuộc org → 404', async () => {
    prismaMock.zaloAccount.findFirst.mockResolvedValue(null);
    const app = buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/public/chao-hang/jobs', headers: HEADERS, payload: JOB_BODY });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('re-trigger cùng job_id → update, KHÔNG tạo trùng', async () => {
    prismaMock.chaoHangJob.findUnique.mockResolvedValue({ id: 'crm-job-1' });
    prismaMock.chaoHangJob.update.mockResolvedValue({ id: 'crm-job-1' });

    const app = buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/public/chao-hang/jobs', headers: HEADERS, payload: JOB_BODY });

    expect(res.statusCode).toBe(202);
    expect(res.json().crm_job_ref).toBe('crm-job-1');
    expect(prismaMock.chaoHangJob.create).not.toHaveBeenCalled();
    expect(prismaMock.chaoHangJob.update).toHaveBeenCalled();
    await app.close();
  });
});

describe('runChaoHangJob (worker)', () => {
  const JOB_ROW = {
    id: 'crm-job-1', orgId: 'org-1', botJobId: 123, poCode: 'PN00045',
    botBaseUrl: 'https://noibo.example.shop', internalKey: 'secret-xyz',
    zaloAccountId: 'za-1', status: 'running',
    config: { send_delay_sec: 0, uid_lookup_delay_sec: 0, uid_lookup_daily_limit: 50, active_start_hour: 0, active_end_hour: 24 },
    products: JOB_BODY.products,
  };

  function mockBotFetch(recipients: any[]) {
    global.fetch = vi.fn(async (url: any) => {
      const u = String(url);
      if (u.includes('/recipients')) {
        return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({ recipients, products: JOB_BODY.products }) } as any;
      }
      // /uid hoặc /ket-qua
      return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({ success: true }) } as any;
    }) as any;
  }

  beforeEach(() => {
    prismaMock.chaoHangJob.findUnique.mockResolvedValue(JOB_ROW);
    prismaMock.chaoHangJob.update.mockResolvedValue(JOB_ROW);
    prismaMock.chaoHangResult.upsert.mockResolvedValue({});
    prismaMock.chaoHangResult.findMany.mockResolvedValue([]);
    prismaMock.chaoHangResult.groupBy.mockResolvedValue([]);
    prismaMock.chaoHangResult.count.mockResolvedValue(0);
  });

  it('khách CÓ sẵn UID found → gửi thẳng (không findUser), set done', async () => {
    mockBotFetch([{ customer_id: 9, name: 'Anh A', phone: '0901', zalo_uid: 'uid-9', uid_status: 'found', tier: 'SL20' }]);
    prismaMock.chaoHangResult.findUnique.mockResolvedValue({ status: 'pending' });
    sendToThreadMock.mockResolvedValue(undefined);

    await runChaoHangJob('crm-job-1');

    expect(findUserMock).not.toHaveBeenCalled();
    // Gửi đúng 1 lần, threadType user = 0, ảnh SL20
    expect(sendToThreadMock).toHaveBeenCalledOnce();
    const args = sendToThreadMock.mock.calls[0];
    expect(args[4]).toBe(0); // threadType user
    expect(args[3]).toBe('uid-9'); // threadId = uid
    expect(args[6]).toEqual(['https://x/sl20.png']); // tier SL20
    // set done
    const doneCall = prismaMock.chaoHangJob.update.mock.calls.find((c: any[]) => c[0]?.data?.status === 'done');
    expect(doneCall).toBeTruthy();
  });

  it('khách đã sent → bỏ qua (idempotent)', async () => {
    mockBotFetch([{ customer_id: 9, zalo_uid: 'uid-9', uid_status: 'found', tier: 'SL20' }]);
    prismaMock.chaoHangResult.findUnique.mockResolvedValue({ status: 'sent' });

    await runChaoHangJob('crm-job-1');
    expect(sendToThreadMock).not.toHaveBeenCalled();
  });

  it('uid_status=not_found → skipped, không tìm lại UID', async () => {
    mockBotFetch([{ customer_id: 9, phone: '0901', zalo_uid: null, uid_status: 'not_found', tier: 'SL20' }]);
    prismaMock.chaoHangResult.findUnique.mockResolvedValue({ status: 'pending' });

    await runChaoHangJob('crm-job-1');
    expect(findUserMock).not.toHaveBeenCalled();
    expect(sendToThreadMock).not.toHaveBeenCalled();
    const skipped = prismaMock.chaoHangResult.upsert.mock.calls.find((c: any[]) => c[0]?.update?.status === 'skipped');
    expect(skipped).toBeTruthy();
  });

  it('chưa biết UID → findUser, tìm được thì gửi + POST /uid found', async () => {
    mockBotFetch([{ customer_id: 9, phone: '0901', zalo_uid: null, uid_status: 'unknown', tier: 'SL20' }]);
    prismaMock.chaoHangResult.findUnique.mockResolvedValue({ status: 'pending' });
    findUserMock.mockResolvedValue({ uid: 'uid-found-9' });
    sendToThreadMock.mockResolvedValue(undefined);

    await runChaoHangJob('crm-job-1');

    expect(findUserMock).toHaveBeenCalledWith('za-1', '0901');
    expect(sendToThreadMock).toHaveBeenCalledOnce();
    expect(sendToThreadMock.mock.calls[0][3]).toBe('uid-found-9');
    // có gọi /uid về bot
    const uidPost = (global.fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('/uid'));
    expect(uidPost).toBeTruthy();
  });
});
