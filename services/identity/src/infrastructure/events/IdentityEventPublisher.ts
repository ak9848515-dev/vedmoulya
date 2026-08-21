// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Event Publisher
// Publishes identity domain events to the event bus
// ──────────────────────────────────────────────────────────────────

import { createEvent, logger } from '@vedmoulya/core';
import type { EventBus } from '@vedmoulya/core';
import type { IdentityEvent } from '@vedmoulya/domain';
import { createUserId } from '@vedmoulya/domain';

export class IdentityEventPublisher {
  private readonly eventBus: EventBus;
  private readonly source: string;

  constructor(eventBus: EventBus, source: string = 'identity-service') {
    this.eventBus = eventBus;
    this.source = source;
  }

  /** Publishes an identity domain event to the event bus */
  async publish(event: IdentityEvent, correlationId?: string): Promise<void> {
    const eventPayload: Record<string, unknown> = {
      userId: event.userId,
      ...event.data,
      timestamp: event.timestamp.toISOString(),
    };
    const domainEvent = createEvent(
      event.type,
      this.source,
      eventPayload,
      correlationId ?? `corr_${event.userId}`,
    );

    await this.eventBus.publish(domainEvent);
    logger.debug('Identity event published', { type: event.type, userId: event.userId });
  }

  /** Publishes multiple events in sequence */
  async publishMany(events: IdentityEvent[], correlationId?: string): Promise<void> {
    for (const event of events) {
      await this.publish(event, correlationId);
    }
  }

  /** Convenience: publish a user logged-in event */
  async publishUserLoggedIn(userId: string, correlationId?: string): Promise<void> {
    await this.publish(
      {
        type: 'identity.user.logged_in',
        userId: createUserId(userId),
        timestamp: new Date(),
        data: {},
      },
      correlationId,
    );
  }

  /** Convenience: publish a user logged-out event */
  async publishUserLoggedOut(userId: string, correlationId?: string): Promise<void> {
    await this.publish(
      {
        type: 'identity.user.logged_out',
        userId: createUserId(userId),
        timestamp: new Date(),
        data: {},
      },
      correlationId,
    );
  }

  /** Convenience: publish a user email-verified event */
  async publishUserEmailVerified(userId: string, correlationId?: string): Promise<void> {
    await this.publish(
      {
        type: 'identity.user.email.verified',
        userId: createUserId(userId),
        timestamp: new Date(),
        data: {},
      },
      correlationId,
    );
  }

  /** Convenience: publish a user created event */
  async publishUserCreated(userId: string, email: string, correlationId?: string): Promise<void> {
    await this.publish(
      {
        type: 'identity.user.created',
        userId: createUserId(userId),
        timestamp: new Date(),
        data: { email },
      },
      correlationId,
    );
  }
}
