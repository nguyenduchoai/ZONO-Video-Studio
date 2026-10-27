// Phase 7 — Webhook ingestion routes for external systems.
//
// v1 endpoint: POST /api/v1/automation/webhooks/order
//   Used by external order/POS systems (Haravan, Sapo, KiotViet, custom) to
//   notify ZaloCRM when an order succeeds. ZaloCRM then emits 'order_success'
//   AutomationEvent → triggers bound to this event fire (typical use:
//   sequence chúc mừng + chăm sóc sau mua).
//
// Auth: same JWT as other API routes — external system must hold a CRM
// service-account JWT (created by admin). For unauthenticated webhook
// ingestion with HMAC signature, see future TODO at bottom.
//
// Body shape:
//   { contactId?: string,           // CRM Contact.id if known
//     phone?: string,               // OR phone number — server resolves to contactId
//     orderId: string,              // External order ref (required, for dedup hint)
//     amount?: number,              // VND total
//     currency?: string,            // default 'VND'
//     items?: Array<{name, qty, price}>,
//     productName?: string,         // shorthand for items[0].name
//     metadata?: Record<string, unknown> }
//
// Engine receives payload via trigger.eventFilter — triggers can filter by
// amount range, productName regex, etc.

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../../shared/database/prisma-client.js';
import { authMiddleware } from '../../auth/auth-middleware.js';
import { logger } from '../../../shared/utils/logger.js';
import { automationEventBus } from '../engine/event-bus.js';
import { normalizePhone } from '../../../shared/utils/phone.js';

const BASE = '/api/v1/automation/webhooks';

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  // POST /webhooks/order
  app.post(`${BASE}/order`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user!;
      const body = (request.body ?? {}) as Record<string, unknown>;

      // Validate required: orderId + (contactId OR phone)
      if (typeof body.orderId !== 'string' || !body.orderId.trim()) {
        return reply.status(400).send({ error: 'orderId is required' });
      }
      if (!body.contactId && !body.phone) {
        return reply.status(400).send({ error: 'contactId or phone is required' });
      }

      // Resolve contactId — if not given directly, look up by normalized phone
      let contactId: string | null = null;
      if (typeof body.contactId === 'string' && body.contactId) {
        const c = await prisma.contact.findFirst({
          where: { id: body.contactId, orgId: user.orgId },
          select: { id: true },
        });
        if (!c) return reply.status(404).send({ error: 'contact not found by contactId' });
        contactId = c.id;
      } else if (typeof body.phone === 'string') {
        const normalized = normalizePhone(body.phone);
        if (!normalized) {
          return reply.status(400).send({ error: 'phone format invalid' });
        }
        const c = await prisma.contact.findFirst({
          where: { orgId: user.orgId, phoneNormalized: normalized },
          select: { id: true },
        });
        if (!c) {
          return reply.status(404).send({
            error: 'contact not found by phone',
            detail: `Phone ${normalized} chưa có trong hệ thống. Tạo Contact trước.`,
          });
        }
        contactId = c.id;
      }

      // Idempotency check — if this orderId already triggered an event for
      // this org, don't double-fire. Use a deterministic key in payload.
      // (Production-grade idempotency would use a dedicated table — for v1 we
      //  trust the orderId is unique per external system.)
      const idempotencyKey = `order:${user.orgId}:${body.orderId}`;

      // Emit event — materializer picks up triggers with eventType='order_success'
      automationEventBus.emit({
        type: 'order_success',
        orgId: user.orgId,
        occurredAt: new Date(),
        contactId: contactId ?? undefined,
        payload: {
          orderId: body.orderId,
          amount: typeof body.amount === 'number' ? body.amount : undefined,
          currency: typeof body.currency === 'string' ? body.currency : 'VND',
          items: Array.isArray(body.items) ? body.items : undefined,
          productName: typeof body.productName === 'string' ? body.productName : undefined,
          metadata: typeof body.metadata === 'object' && body.metadata !== null
            ? body.metadata
            : undefined,
          idempotencyKey,
        },
      });

      logger.info(`[webhook] order_success emitted — order=${body.orderId} contact=${contactId} org=${user.orgId}`);

      return reply.status(202).send({
        accepted: true,
        eventType: 'order_success',
        contactId,
        idempotencyKey,
        note: 'Event emitted; engine will materialize tasks asynchronously',
      });
    } catch (error) {
      logger.error('[webhook] order_success error:', error);
      return reply.status(500).send({ error: 'Failed to process webhook' });
    }
  });
}

// ── TODO (future) ──────────────────────────────────────────────────────────
// HMAC-signed webhook endpoint at /api/v1/automation/webhooks/public/order/:orgWebhookToken
// for external systems that can't hold a JWT. Pattern:
//   1. Admin generates webhookToken via Settings UI (stored in AppSetting)
//   2. External system POSTs with header X-Signature: hmac-sha256(secret, body)
//   3. Server validates signature before emit
//   4. Dedicated IngestedWebhook table for idempotency tracking
