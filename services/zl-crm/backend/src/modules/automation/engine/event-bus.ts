// Phase 7 Engine — in-memory pub/sub event bus.
//
// v1: single-process EventEmitter. For multi-instance deployment, swap to
// Redis Streams or BullMQ — engine's external API (emit/on) stays identical.
//
// Listeners MUST be idempotent: same event may be re-emitted on crash/restart
// or accidentally double-fired by an integration. Use Trigger.id + Contact.id
// + event timestamp as a natural idempotency key when persisting downstream.

import { EventEmitter } from 'node:events';
import { logger } from '../../../shared/utils/logger.js';
import type { AutomationEvent } from './types.js';
import type { TriggerEventType } from '../triggers/types.js';

const BUS_EVENT = 'automation.event';

class AutomationEventBus {
  private emitter = new EventEmitter();

  constructor() {
    // Default max listeners is 10 — generous enough for ~10 internal
    // listeners (one per eventType worth wiring). Increase if engine grows.
    this.emitter.setMaxListeners(50);
  }

  emit(event: AutomationEvent): void {
    logger.debug('[automation.event-bus] emit', { type: event.type, contactId: event.contactId });
    // Always async — listeners must not block the producer (incoming msg handler etc.)
    setImmediate(() => {
      try {
        this.emitter.emit(BUS_EVENT, event);
      } catch (err) {
        logger.error('[automation.event-bus] listener error:', err);
      }
    });
  }

  on(listener: (event: AutomationEvent) => Promise<void> | void): () => void {
    const wrapped = async (event: AutomationEvent) => {
      try {
        await listener(event);
      } catch (err) {
        logger.error('[automation.event-bus] listener threw:', err);
      }
    };
    this.emitter.on(BUS_EVENT, wrapped);
    // Return unsubscribe function
    return () => this.emitter.off(BUS_EVENT, wrapped);
  }

  // Listener that only fires for specific event types (filter at bus level
  // so each listener doesn't repeat the switch).
  onType(
    types: TriggerEventType[],
    listener: (event: AutomationEvent) => Promise<void> | void,
  ): () => void {
    const typeSet = new Set(types);
    return this.on((event) => {
      if (!typeSet.has(event.type)) return;
      return listener(event);
    });
  }

  // For tests & shutdown
  removeAllListeners(): void {
    this.emitter.removeAllListeners(BUS_EVENT);
  }
}

export const automationEventBus = new AutomationEventBus();
