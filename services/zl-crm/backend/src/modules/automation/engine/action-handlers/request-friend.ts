// Phase G — request_friend action handler (REAL Zalo SDK).
//
// Flow:
//   1. Read contact.phoneNormalized
//   2. zaloOps.findUser(nickId, phone) → resolve per-nick UID
//      - not_found → outcome 'no_zalo', mark contact zaloResolveStatus
//      - rate_limited → retryable
//   3. zaloOps.sendFriendRequest(nickId, greeting, uid)
//   4. markFriendRequestSent(nickId, uid, contactId) — creates Friend row
//      with pending_sent + FriendshipAttempt row in 'sent' state
//
// Set AUTOMATION_STUB_MODE=true to revert to stub for safe testing.

import { prisma } from '../../../../shared/database/prisma-client.js';
import { logger } from '../../../../shared/utils/logger.js';
import { zaloOps } from '../../../../shared/zalo-operations.js';
import { markFriendRequestSent } from '../../../zalo/friend-event-handler.js';
import type { ActionContext, ActionResult } from '../types.js';

const STUB_MODE = process.env.AUTOMATION_STUB_MODE === 'true';

export async function requestFriendHandler(ctx: ActionContext): Promise<ActionResult> {
  const snap = ctx.blockSnapshot as { greetingVariants?: string[] };

  if (!Array.isArray(snap.greetingVariants) || snap.greetingVariants.length === 0) {
    return {
      outcome: 'failure',
      errorCode: 'BAD_SNAPSHOT',
      errorMessage: 'blockSnapshot.greetingVariants empty',
      retryable: false,
    };
  }
  if (!ctx.assignedNickId) {
    return {
      outcome: 'failure',
      errorCode: 'NO_NICK',
      errorMessage: 'assignedNickId required for request_friend',
      retryable: false,
    };
  }

  const greeting = snap.greetingVariants[Math.floor(Math.random() * snap.greetingVariants.length)];

  // STUB mode for testing without hitting Zalo
  if (STUB_MODE) {
    logger.info(`[request-friend STUB] would send "${greeting.slice(0, 40)}..." from nick ${ctx.assignedNickId} to contact ${ctx.contactId}`);
    return {
      outcome: 'success',
      data: { stub: true, greetingUsed: greeting },
    };
  }

  // ── Real impl ────────────────────────────────────────────────────────────
  // Step 1: get contact's phone
  const contact = await prisma.contact.findFirst({
    where: { id: ctx.contactId, orgId: ctx.orgId },
    select: { id: true, phone: true, phoneNormalized: true, fullName: true, crmName: true },
  });
  if (!contact) {
    return { outcome: 'failure', errorCode: 'CONTACT_MISSING', errorMessage: 'Contact not found', retryable: false };
  }
  const phone = contact.phoneNormalized || contact.phone;
  if (!phone) {
    return {
      outcome: 'no_zalo',
      errorCode: 'NO_PHONE',
      errorMessage: 'Contact has no phone number',
      retryable: false,
    };
  }

  // Step 2: resolve per-nick UID via findUser
  let lookupResult: Record<string, unknown> | null;
  try {
    const raw = await zaloOps.findUser(ctx.assignedNickId, phone);
    lookupResult = (raw as Record<string, unknown>) || {};
  } catch (err: any) {
    const code = err?.code as string | undefined;
    if (code === 'RATE_LIMITED') {
      return {
        outcome: 'failure',
        errorCode: 'RATE_LIMITED',
        errorMessage: 'Zalo rate-limited findUser',
        retryable: true,
      };
    }
    if (code === 'NOT_CONNECTED') {
      return {
        outcome: 'failure',
        errorCode: 'NOT_CONNECTED',
        errorMessage: 'Nick disconnected from Zalo',
        retryable: true,
      };
    }
    // findUser commonly throws for phones with no Zalo — treat as no_zalo
    return {
      outcome: 'no_zalo',
      errorCode: 'PHONE_NOT_ON_ZALO',
      errorMessage: err?.message ?? 'Phone không có Zalo',
      retryable: false,
    };
  }
  const uid = String(lookupResult?.uid || lookupResult?.userId || '');
  if (!uid) {
    return {
      outcome: 'no_zalo',
      errorCode: 'PHONE_NOT_ON_ZALO',
      errorMessage: 'findUser returned no uid',
      retryable: false,
    };
  }

  // Step 2.5: check if already friend (avoid wasted attempt + skip_reason hint)
  const existingFriend = await prisma.friend.findUnique({
    where: { zaloAccountId_zaloUidInNick: { zaloAccountId: ctx.assignedNickId, zaloUidInNick: uid } },
    select: { friendshipStatus: true },
  });
  if (existingFriend?.friendshipStatus === 'accepted') {
    return {
      outcome: 'already_friend',
      data: { uid, friendshipStatus: 'accepted' },
    };
  }
  if (existingFriend?.friendshipStatus === 'pending_sent') {
    return {
      outcome: 'success',
      data: { uid, note: 'already pending_sent, skip duplicate send' },
    };
  }

  // Step 3: send the request
  try {
    await zaloOps.sendFriendRequest(ctx.assignedNickId, greeting, uid);
  } catch (err: any) {
    const code = err?.code as string | undefined;
    const msg = err?.message ?? String(err);
    if (code === 'RATE_LIMITED') {
      return { outcome: 'failure', errorCode: 'RATE_LIMITED', errorMessage: msg, retryable: true };
    }
    if (code === 'NOT_CONNECTED') {
      return { outcome: 'failure', errorCode: 'NOT_CONNECTED', errorMessage: msg, retryable: true };
    }
    return {
      outcome: 'failure',
      errorCode: 'SEND_FRIEND_REQ_FAILED',
      errorMessage: msg,
      retryable: false,
    };
  }

  // Step 4: persist state — Friend row pending_sent + FriendshipAttempt sent
  try {
    await markFriendRequestSent(ctx.assignedNickId, uid, ctx.contactId);
  } catch (err) {
    logger.warn(`[request-friend] markFriendRequestSent failed (non-fatal):`, err);
  }

  logger.info(`[request-friend] sent from nick=${ctx.assignedNickId} to uid=${uid} contact=${ctx.contactId}`);
  return {
    outcome: 'success',
    data: {
      uid,
      greetingUsed: greeting,
      lookupGlobalId: lookupResult?.globalId ?? null,
      lookupUsername: lookupResult?.username ?? null,
    },
  };
}
