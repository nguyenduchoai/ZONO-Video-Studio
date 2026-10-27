/**
 * chao-hang-public-routes.ts — Public endpoint nhận JOB CHÀO HÀNG từ BOT nội bộ.
 * Auth bằng x-api-key (apiKeyAuth dùng chung với các public route khác).
 *
 * POST /api/public/chao-hang/jobs — lưu 1 job CRM (idempotent theo job_id), TRẢ NGAY
 * { accepted, crm_job_ref } rồi xử lý gửi ở chế độ NỀN (runChaoHangJob fire-and-forget).
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';
import { apiKeyAuth } from './public-api-routes.js';
import { runChaoHangJob, runUidResolve } from './chao-hang-worker.js';

export async function chaoHangPublicRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', apiKeyAuth);

  app.post('/api/public/chao-hang/jobs', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const orgId = (request as any).orgId as string;
      const body = request.body as Record<string, any>;

      const botJobId = Number(body?.job_id);
      const botBaseUrl = typeof body?.bot_base_url === 'string' ? body.bot_base_url : '';
      const internalKey = typeof body?.internal_key === 'string' ? body.internal_key : '';
      const config = (body?.config ?? {}) as Record<string, any>;
      const zaloAccountId = typeof config?.zalo_account_id === 'string' ? config.zalo_account_id : '';
      const products = Array.isArray(body?.products) ? body.products : [];

      if (!Number.isInteger(botJobId)) return reply.status(400).send({ error: 'job_id (số nguyên) bắt buộc' });
      if (!botBaseUrl) return reply.status(400).send({ error: 'bot_base_url bắt buộc' });
      if (!internalKey) return reply.status(400).send({ error: 'internal_key bắt buộc' });
      if (!zaloAccountId) return reply.status(400).send({ error: 'config.zalo_account_id bắt buộc' });

      // Nick gửi phải thuộc org này.
      const account = await prisma.zaloAccount.findFirst({
        where: { id: zaloAccountId, orgId },
        select: { id: true },
      });
      if (!account) return reply.status(404).send({ error: 'Zalo account (nick gửi) không thuộc tổ chức' });

      // Idempotent theo (orgId, botJobId): có rồi thì cập nhật metadata, không tạo trùng.
      const existing = await prisma.chaoHangJob.findUnique({
        where: { orgId_botJobId: { orgId, botJobId } },
        select: { id: true },
      });

      let crmJobId: string;
      if (existing) {
        await prisma.chaoHangJob.update({
          where: { id: existing.id },
          data: {
            poCode: typeof body?.po_code === 'string' ? body.po_code : undefined,
            botBaseUrl,
            internalKey,
            zaloAccountId,
            config,
            products,
            status: 'running', // cho phép resume khi re-trigger
            error: null,
          },
        });
        crmJobId = existing.id;
        logger.info(`[chao-hang] re-trigger job bot=${botJobId} → crm=${crmJobId} (resume)`);
      } else {
        const created = await prisma.chaoHangJob.create({
          data: {
            orgId,
            botJobId,
            poCode: typeof body?.po_code === 'string' ? body.po_code : null,
            botBaseUrl,
            internalKey,
            zaloAccountId,
            config,
            products,
            status: 'running',
          },
          select: { id: true },
        });
        crmJobId = created.id;
        logger.info(`[chao-hang] nhận job mới bot=${botJobId} → crm=${crmJobId} (${products.length} SP)`);
      }

      // Xử lý NỀN — không block response (KHÔNG await).
      setImmediate(() => void runChaoHangJob(crmJobId));

      return reply.status(202).send({ accepted: true, crm_job_ref: crmJobId });
    } catch (err) {
      logger.error('[chao-hang] POST /jobs error:', err);
      return reply.status(500).send({ error: 'Failed to accept chao-hang job' });
    }
  });

  // POST /api/public/uid-resolve - BOT cron day batch khach can tim UID (auto-RMKT).
  app.post('/api/public/uid-resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const orgId = (request as any).orgId as string;
      const body = request.body as Record<string, any>;
      const botBaseUrl = typeof body?.bot_base_url === 'string' ? body.bot_base_url : '';
      const internalKey = typeof body?.internal_key === 'string' ? body.internal_key : '';
      const zaloAccountId = typeof body?.zalo_account_id === 'string' ? body.zalo_account_id : '';
      const items = Array.isArray(body?.items) ? body.items : [];
      const delaySec = Number(body?.config?.uid_lookup_delay_sec) || 30;
      if (!botBaseUrl || !internalKey || !zaloAccountId) return reply.status(400).send({ error: 'thieu tham so' });
      if (!items.length) return reply.send({ accepted: true, count: 0 });
      const account = await prisma.zaloAccount.findFirst({ where: { id: zaloAccountId, orgId }, select: { id: true } });
      if (!account) return reply.status(404).send({ error: 'Zalo account khong thuoc to chuc' });
      setImmediate(() => void runUidResolve({ orgId, botBaseUrl, internalKey, zaloAccountId, items, delaySec }).catch((e) => logger.error('[uid-resolve] loi nen: ' + (e as Error).message)));
      return reply.status(202).send({ accepted: true, count: items.length });
    } catch (err) {
      logger.error('[uid-resolve] POST error:', err);
      return reply.status(500).send({ error: 'Failed to accept uid-resolve' });
    }
  });
}
