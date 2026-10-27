// Phase 7 Engine — Action handler registry & dispatcher.
//
// Each Block.actionType has 1 handler. Worker calls dispatcher.execute() —
// dispatcher routes to the right handler by actionType. Handlers receive
// frozen blockSnapshot (NOT live Block.content) per snapshot rule (anh chốt
// Q1: edit Block does not affect running tasks).
//
// Phase G ship real impls for: request_friend, send_message, update_status.
// Other types throw NotImplemented — engine surfaces via Task.skipReason.

import type { ActionContext, ActionResult, ActionHandler } from './types.js';
import type { BlockActionType } from '../blocks/types.js';
import { logger } from '../../../shared/utils/logger.js';

const handlers = new Map<BlockActionType, ActionHandler>();

export function registerActionHandler(
  actionType: BlockActionType,
  handler: ActionHandler,
): void {
  if (handlers.has(actionType)) {
    logger.warn(`[action-dispatcher] handler for '${actionType}' already registered, replacing`);
  }
  handlers.set(actionType, handler);
}

export async function dispatchAction(ctx: ActionContext): Promise<ActionResult> {
  const handler = handlers.get(ctx.actionType);
  if (!handler) {
    return {
      outcome: 'failure',
      errorCode: 'NOT_IMPLEMENTED',
      errorMessage: `Action handler for '${ctx.actionType}' not registered`,
      retryable: false,
    };
  }
  try {
    return await handler(ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[action-dispatcher] handler '${ctx.actionType}' threw:`, err);
    return {
      outcome: 'failure',
      errorCode: 'HANDLER_EXCEPTION',
      errorMessage: msg,
      retryable: true, // unknown errors → retry once, worker enforces max attempts
    };
  }
}

export function listRegisteredActionTypes(): BlockActionType[] {
  return Array.from(handlers.keys());
}

// Test helper — reset registry between tests
export function _resetHandlers(): void {
  handlers.clear();
}
