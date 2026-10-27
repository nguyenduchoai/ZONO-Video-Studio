// Phase 7 — Cron event scheduler.
//
// Unlocks 2 trigger event types that were declared in the catalog but had no
// emission source until now:
//   - 'birthday'        — fires daily at 08:00 Asia/Ho_Chi_Minh for every
//                         contact whose Contact.birthDate matches today (MM-DD).
//                         Per-contact emit so triggers/sequences process each
//                         birthday individually.
//   - 'scheduled_cron'  — fires per-trigger based on the cron expression stored
//                         in AutomationTrigger.eventFilter.cron. Org-scoped emit
//                         (no contactId) → materializer resolves trigger.segmentSpec.
//
// node-cron is already a project dep (used by friend-sync-cron). Reuse it for
// consistency.
//
// Hot-reload: registerCronTrigger() / unregisterCronTrigger() let trigger routes
// invalidate the schedule registry when a trigger is created/updated/enabled.
// Without this, a new scheduled_cron trigger wouldn't fire until next reboot.

import cron from 'node-cron';
import { prisma } from '../../../shared/database/prisma-client.js';
import { logger } from '../../../shared/utils/logger.js';
import { automationEventBus } from './event-bus.js';

const TZ = 'Asia/Ho_Chi_Minh';

// Map<triggerId, ScheduledTask> — for hot-reload
const cronJobs = new Map<string, ReturnType<typeof cron.schedule>>();

let birthdayJob: ReturnType<typeof cron.schedule> | null = null;
let isStarted = false;

// ── Public API ─────────────────────────────────────────────────────────────

export async function startCronEventScheduler(): Promise<void> {
  if (isStarted) {
    logger.warn('[cron-scheduler] already started');
    return;
  }
  isStarted = true;

  // Birthday — daily 8am VN
  birthdayJob = cron.schedule('0 8 * * *', () => { void fireBirthdayEvents(); }, { timezone: TZ });
  logger.info('[cron-scheduler] birthday job registered (daily 08:00 ' + TZ + ')');

  // Scheduled_cron — load all enabled triggers, register each
  await reloadAllScheduledCronTriggers();

  logger.info('[cron-scheduler] started — birthday + ' + cronJobs.size + ' scheduled_cron triggers');
}

export function stopCronEventScheduler(): void {
  if (birthdayJob) { birthdayJob.stop(); birthdayJob = null; }
  for (const job of cronJobs.values()) job.stop();
  cronJobs.clear();
  isStarted = false;
}

// Called by trigger routes after CREATE/UPDATE/toggle so a new/edited trigger
// starts firing without a server restart.
export async function registerCronTrigger(triggerId: string): Promise<void> {
  // Always tear down existing job for this trigger first (idempotent re-register)
  unregisterCronTrigger(triggerId);

  const trigger = await prisma.automationTrigger.findUnique({
    where: { id: triggerId },
    select: { id: true, orgId: true, eventType: true, eventFilter: true, enabled: true, name: true },
  });
  if (!trigger) return;
  if (trigger.eventType !== 'scheduled_cron') return;
  if (!trigger.enabled) return;

  const cronExpr = extractCronExpression(trigger.eventFilter);
  if (!cronExpr) {
    logger.warn(`[cron-scheduler] trigger ${trigger.id} (${trigger.name}) has no cron expression in eventFilter`);
    return;
  }
  if (!cron.validate(cronExpr)) {
    logger.warn(`[cron-scheduler] trigger ${trigger.id} (${trigger.name}) has invalid cron expression: ${cronExpr}`);
    return;
  }

  const job = cron.schedule(cronExpr, () => {
    void fireScheduledCronEvent(trigger.id, trigger.orgId, cronExpr);
  }, { timezone: TZ });

  cronJobs.set(trigger.id, job);
  logger.info(`[cron-scheduler] registered trigger ${trigger.id} (${trigger.name}) with cron '${cronExpr}'`);
}

export function unregisterCronTrigger(triggerId: string): void {
  const existing = cronJobs.get(triggerId);
  if (existing) {
    existing.stop();
    cronJobs.delete(triggerId);
    logger.info(`[cron-scheduler] unregistered trigger ${triggerId}`);
  }
}

// ── Internal ───────────────────────────────────────────────────────────────

async function reloadAllScheduledCronTriggers(): Promise<void> {
  // Clear current jobs
  for (const job of cronJobs.values()) job.stop();
  cronJobs.clear();

  const triggers = await prisma.automationTrigger.findMany({
    where: { eventType: 'scheduled_cron', enabled: true },
    select: { id: true, orgId: true, eventFilter: true, name: true },
  });

  for (const t of triggers) {
    const cronExpr = extractCronExpression(t.eventFilter);
    if (!cronExpr || !cron.validate(cronExpr)) {
      logger.warn(`[cron-scheduler] skip trigger ${t.id} (${t.name}): invalid/missing cron expression`);
      continue;
    }
    const job = cron.schedule(cronExpr, () => {
      void fireScheduledCronEvent(t.id, t.orgId, cronExpr);
    }, { timezone: TZ });
    cronJobs.set(t.id, job);
  }
}

function extractCronExpression(eventFilter: unknown): string | null {
  if (!eventFilter || typeof eventFilter !== 'object') return null;
  const f = eventFilter as Record<string, unknown>;
  return typeof f.cron === 'string' ? f.cron : null;
}

async function fireScheduledCronEvent(triggerId: string, orgId: string, cronExpr: string): Promise<void> {
  try {
    // Re-check trigger is still enabled (defensive — could have been disabled
    // between schedule registration and fire time without unregister called)
    const stillEnabled = await prisma.automationTrigger.count({
      where: { id: triggerId, enabled: true },
    });
    if (stillEnabled === 0) {
      unregisterCronTrigger(triggerId);
      return;
    }

    automationEventBus.emit({
      type: 'scheduled_cron',
      orgId,
      occurredAt: new Date(),
      // no contactId — materializer resolves trigger.segmentSpec to get contacts
      payload: { triggerId, cron: cronExpr },
    });
    logger.info(`[cron-scheduler] fired scheduled_cron trigger ${triggerId} (cron='${cronExpr}')`);
  } catch (err) {
    logger.error(`[cron-scheduler] fireScheduledCronEvent error for ${triggerId}:`, err);
  }
}

async function fireBirthdayEvents(): Promise<void> {
  try {
    // Find all contacts whose birthDate month-day matches today (across all orgs).
    // birthDate is DATE type (no time), stored once at any year — we match MM-DD.
    // Postgres: extract(MONTH from birth_date) = X AND extract(DAY) = Y
    const now = new Date();
    // Build localized today for VN (UTC+7) since cron runs in TZ
    const vnNow = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
    const month = vnNow.getMonth() + 1; // 1-12
    const day = vnNow.getDate();         // 1-31

    const contacts = await prisma.$queryRaw<Array<{ id: string; org_id: string; birth_date: Date }>>`
      SELECT id, org_id, birth_date
      FROM contacts
      WHERE birth_date IS NOT NULL
        AND EXTRACT(MONTH FROM birth_date) = ${month}
        AND EXTRACT(DAY FROM birth_date) = ${day}
        AND merged_into IS NULL
    `;

    if (contacts.length === 0) {
      logger.info('[cron-scheduler] birthday tick — 0 contacts have birthday today');
      return;
    }

    logger.info(`[cron-scheduler] birthday tick — ${contacts.length} contacts have birthday today`);

    for (const c of contacts) {
      const ageGuess = vnNow.getFullYear() - new Date(c.birth_date).getFullYear();
      automationEventBus.emit({
        type: 'birthday',
        orgId: c.org_id,
        occurredAt: new Date(),
        contactId: c.id,
        payload: {
          birthDate: c.birth_date,
          age: ageGuess,
          month,
          day,
        },
      });
    }
  } catch (err) {
    logger.error('[cron-scheduler] fireBirthdayEvents error:', err);
  }
}

// ── Test helper — fire birthday once manually (admin) ──────────────────────
export async function fireBirthdayNowForTesting(): Promise<{ count: number }> {
  const before = cronJobs.size; // just to mark we're "running"
  await fireBirthdayEvents();
  return { count: before };
}
