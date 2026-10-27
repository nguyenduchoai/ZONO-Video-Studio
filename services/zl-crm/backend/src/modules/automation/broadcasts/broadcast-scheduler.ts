// Phase F — Broadcast scheduler.
//
// Polls automation_broadcasts table for state='scheduled' AND scheduledAt ≤ now,
// then auto-triggers /start (same logic as manual start). 60s interval is fine —
// we're not millisecond-precise, the worker's own poll cycle adds another buffer.
//
// Recurring broadcasts (scheduleKind='recurring') are out of scope v1 — only
// one-shot 'scheduled' supported here. Add cron parser in future phase.

import { prisma } from '../../../shared/database/prisma-client.js';
import { logger } from '../../../shared/utils/logger.js';

const POLL_INTERVAL_MS = 60_000; // 1 minute
let handle: NodeJS.Timeout | null = null;

export function startBroadcastScheduler(): void {
  if (handle) {
    logger.warn('[broadcast-scheduler] already started');
    return;
  }
  logger.info('[broadcast-scheduler] starting (poll every 60s)');
  handle = setInterval(() => { void tick(); }, POLL_INTERVAL_MS);
  void tick();
}

export function stopBroadcastScheduler(): void {
  if (handle) {
    clearInterval(handle);
    handle = null;
  }
}

async function tick(): Promise<void> {
  try {
    const due = await prisma.automationBroadcast.findMany({
      where: {
        state: 'scheduled',
        scheduledAt: { lte: new Date() },
      },
      select: { id: true, orgId: true, name: true },
      take: 20, // batch limit per tick
    });
    if (due.length === 0) return;

    logger.info(`[broadcast-scheduler] firing ${due.length} due broadcasts`);
    for (const bc of due) {
      await fireBroadcast(bc.id, bc.orgId).catch((err) => {
        logger.error(`[broadcast-scheduler] fire ${bc.id} (${bc.name}) error:`, err);
      });
    }
  } catch (err) {
    logger.error('[broadcast-scheduler] tick error:', err);
  }
}

// Reuse the same start logic as the route handler — but call it as a function
// so the scheduler doesn't have to make an HTTP request to itself.
async function fireBroadcast(broadcastId: string, orgId: string): Promise<void> {
  const bc = await prisma.automationBroadcast.findFirst({
    where: { id: broadcastId, orgId, state: 'scheduled' },
  });
  if (!bc) return; // race: already fired or cancelled

  // Same logic as broadcast-routes :id/start (minus auth check + recipient filter)
  // Lazy import to avoid circular dep
  const { resolveAndEnqueue } = await import('./fire-broadcast.js');
  await resolveAndEnqueue(bc);
}
