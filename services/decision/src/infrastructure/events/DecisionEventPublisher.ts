// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Event Publisher
// Domain events → EventBus for the Decision Engine bounded context
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { InMemoryEventBus, logger } from '@vedmoulya/core';
import type { DecisionEvent } from '@vedmoulya/domain';

export class DecisionEventPublisher {
  private readonly eventBus: InMemoryEventBus;
  private readonly serviceName = 'decision';

  constructor(eventBus: InMemoryEventBus) {
    this.eventBus = eventBus;
  }

  /** Publish a domain event to the event bus */
  publish(event: DecisionEvent): void {
    try {
      void this.eventBus.publish({
        id: crypto.randomUUID(),
        type: event.type,
        aggregateId: event.decisionId ?? 'unknown',
        aggregateType: 'Decision',
        timestamp: event.timestamp,
        data: {
          ...event.data,
          decisionId: event.decisionId,
        },
        metadata: {
          service: this.serviceName,
          version: '1.0',
        },
      } as unknown as import('@vedmoulya/core').DomainEvent);

      logger.debug('Decision event published', { type: event.type });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to publish decision event', {
        type: event.type,
        error: errMsg,
      });
    }
  }

  /** Publish multiple domain events */
  publishAll(events: DecisionEvent[]): void {
    for (const event of events) {
      this.publish(event);
    }
  }
}
