// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Event Publisher
// Domain events → EventBus for the Memory Engine bounded context
// ARC-003/ARC-004 — Memory Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { InMemoryEventBus, logger } from '@vedmoulya/core';
import type { MemoryEvent } from '@vedmoulya/domain';

export class MemoryEventPublisher {
  private readonly eventBus: InMemoryEventBus;
  private readonly serviceName = 'memory';

  constructor(eventBus: InMemoryEventBus) {
    this.eventBus = eventBus;
  }

  /** Publish a domain event to the event bus */
  publish(event: MemoryEvent): void {
    try {
      void this.eventBus.publish({
        id: crypto.randomUUID(),
        type: event.type,
        aggregateId: event.memoryId ?? 'unknown',
        aggregateType: 'Memory',
        timestamp: event.timestamp,
        data: {
          ...event.data,
          memoryId: event.memoryId,
        },
        metadata: {
          service: this.serviceName,
          version: '1.0',
        },
      } as unknown as import('@vedmoulya/core').DomainEvent);

      logger.debug('Memory event published', { type: event.type });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to publish memory event', {
        type: event.type,
        error: errMsg,
      });
    }
  }

  /** Publish multiple domain events */
  publishAll(events: MemoryEvent[]): void {
    for (const event of events) {
      this.publish(event);
    }
  }
}
