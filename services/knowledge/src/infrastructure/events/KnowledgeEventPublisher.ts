// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Event Publisher
// Domain events → EventBus for the Knowledge Graph bounded context
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

import { InMemoryEventBus, logger } from '@vedmoulya/core';
import type { KnowledgeEvent } from '@vedmoulya/domain';

export class KnowledgeEventPublisher {
  private readonly eventBus: InMemoryEventBus;
  private readonly serviceName = 'knowledge';

  constructor(eventBus: InMemoryEventBus) {
    this.eventBus = eventBus;
  }

  /** Publish a domain event to the event bus */
  publish(event: KnowledgeEvent): void {
    try {
      void this.eventBus.publish({
        id: crypto.randomUUID(),
        type: event.type,
        aggregateId: event.nodeId ?? event.edgeId ?? event.graphId ?? 'unknown',
        aggregateType: event.nodeId
          ? 'KnowledgeNode'
          : event.edgeId
            ? 'KnowledgeEdge'
            : 'KnowledgeGraph',
        timestamp: event.timestamp,
        data: {
          ...event.data,
          nodeId: event.nodeId,
          edgeId: event.edgeId,
          graphId: event.graphId,
        },
        metadata: {
          service: this.serviceName,
          version: '1.0',
        },
      } as unknown as import('@vedmoulya/core').DomainEvent);

      logger.debug('Knowledge event published', { type: event.type });
    } catch (error) {
      logger.error('Failed to publish knowledge event', {
        type: event.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Publish multiple domain events */
  publishAll(events: KnowledgeEvent[]): void {
    for (const event of events) {
      this.publish(event);
    }
  }
}
