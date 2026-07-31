// ──────────────────────────────────────────────────────────────────
// VedMoulya — Event Bus Interfaces
// Domain event publishing and subscription
// Implements BLP-001/D02 — Engineering Principle #7 (Event-Driven)
// ──────────────────────────────────────────────────────────────────

/**
 * Base domain event interface
 */
export interface DomainEvent {
  readonly id: string;
  readonly type: string;
  readonly source: string;
  readonly timestamp: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly data: Record<string, unknown>;
}

/**
 * Event handler for domain events
 */
export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void> | void;

/**
 * Event bus for publishing and subscribing to domain events
 */
export interface EventBus {
  /**
   * Publish an event to all subscribers
   */
  publish(event: DomainEvent): Promise<void>;

  /**
   * Subscribe to events of a specific type
   */
  subscribe(eventType: string, handler: EventHandler): void;

  /**
   * Unsubscribe a handler from an event type
   */
  unsubscribe(eventType: string, handler: EventHandler): void;

  /**
   * Subscribe to all events (wildcard)
   */
  subscribeAll(handler: EventHandler): void;
}

/**
 * In-memory event bus implementation for development/testing
 */
export class InMemoryEventBus implements EventBus {
  private readonly subscribers = new Map<string, Set<EventHandler>>();
  private readonly wildcardSubscribers = new Set<EventHandler>();
  private publishedEvents: DomainEvent[] = [];

  publish(event: DomainEvent): Promise<void> {
    this.publishedEvents.push(event);

    // Call type-specific subscribers
    const typeSubscribers = this.subscribers.get(event.type);
    if (typeSubscribers) {
      for (const handler of typeSubscribers) {
        Promise.resolve(handler(event)).catch((error: unknown) => {
          console.error(`Event handler failed for ${event.type}:`, error);
        });
      }
    }

    // Call wildcard subscribers
    for (const handler of this.wildcardSubscribers) {
      Promise.resolve(handler(event)).catch((error: unknown) => {
        console.error(`Wildcard handler failed for ${event.type}:`, error);
      });
    }

    return Promise.resolve();
  }

  subscribe(eventType: string, handler: EventHandler): void {
    const existing = this.subscribers.get(eventType) ?? new Set();
    existing.add(handler);
    this.subscribers.set(eventType, existing);
  }

  unsubscribe(eventType: string, handler: EventHandler): void {
    const existing = this.subscribers.get(eventType);
    if (existing) {
      existing.delete(handler);
      if (existing.size === 0) {
        this.subscribers.delete(eventType);
      }
    }
  }

  subscribeAll(handler: EventHandler): void {
    this.wildcardSubscribers.add(handler);
  }

  /**
   * Get all published events (for testing)
   */
  getPublishedEvents(): DomainEvent[] {
    return [...this.publishedEvents];
  }

  /**
   * Clear all subscribers and published events (for testing)
   */
  clear(): void {
    this.subscribers.clear();
    this.wildcardSubscribers.clear();
    this.publishedEvents = [];
  }
}

/**
 * Generate a domain event ID
 */
export function createEventId(): string {
  return `evt_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

/**
 * Create a domain event
 */
export function createEvent(
  type: string,
  source: string,
  data: Record<string, unknown>,
  correlationId: string,
  causationId?: string,
): DomainEvent {
  return {
    id: createEventId(),
    type,
    source,
    timestamp: new Date().toISOString(),
    correlationId,
    causationId,
    data,
  };
}
