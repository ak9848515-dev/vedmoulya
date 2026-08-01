// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: IdentityEventPublisher
// Covers publish, publishMany, and the convenience event helpers.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUserId } from '@vedmoulya/domain';
import { IdentityEventPublisher } from '../src/infrastructure/events/IdentityEventPublisher.js';

describe('IdentityEventPublisher', () => {
  const publish = vi.fn();

  beforeEach(() => {
    publish.mockReset();
    publish.mockResolvedValue(undefined);
  });

  function makePublisher(source = 'identity-service'): IdentityEventPublisher {
    return new IdentityEventPublisher({ publish } as never, source);
  }

  it('publishes a domain event with a generated correlation id', async () => {
    const publisher = makePublisher();
    await publisher.publish({
      type: 'identity.user.created',
      userId: createUserId('usr_1'),
      timestamp: new Date('2024-01-01'),
      data: { email: 'a@b.com' },
    });

    expect(publish).toHaveBeenCalledTimes(1);
    const event = publish.mock.calls[0]![0] as Record<string, unknown>;
    expect(event.type).toBe('identity.user.created');
    expect(event.source).toBe('identity-service');
    expect(event.correlationId).toContain('corr_');
    // createEvent stores the payload under `data`, not `payload`.
    expect((event.data as Record<string, unknown>).email).toBe('a@b.com');
  });

  it('publishes with an explicit correlation id', async () => {
    const publisher = makePublisher();
    await publisher.publish(
      {
        type: 'identity.user.created',
        userId: createUserId('usr_1'),
        timestamp: new Date(),
        data: {},
      },
      'corr-explicit',
    );
    const event = publish.mock.calls[0]![0] as Record<string, unknown>;
    expect(event.correlationId).toBe('corr-explicit');
  });

  it('publishes many events in sequence', async () => {
    const publisher = makePublisher();
    await publisher.publishMany(
      [
        {
          type: 'identity.user.logged_in',
          userId: createUserId('usr_1'),
          timestamp: new Date(),
          data: {},
        },
        {
          type: 'identity.user.logged_out',
          userId: createUserId('usr_1'),
          timestamp: new Date(),
          data: {},
        },
      ],
      'corr-batch',
    );
    expect(publish).toHaveBeenCalledTimes(2);
    expect((publish.mock.calls[0]![0] as Record<string, unknown>).correlationId).toBe('corr-batch');
  });

  it('publishUserLoggedIn publishes the login event', async () => {
    const publisher = makePublisher();
    await publisher.publishUserLoggedIn('usr_2');
    const event = publish.mock.calls[0]![0] as Record<string, unknown>;
    expect(event.type).toBe('identity.user.logged_in');
  });

  it('publishUserLoggedOut publishes the logout event', async () => {
    const publisher = makePublisher();
    await publisher.publishUserLoggedOut('usr_2');
    const event = publish.mock.calls[0]![0] as Record<string, unknown>;
    expect(event.type).toBe('identity.user.logged_out');
  });

  it('publishUserCreated publishes the created event with email payload', async () => {
    const publisher = makePublisher();
    await publisher.publishUserCreated('usr_3', 'new@b.com');
    const event = publish.mock.calls[0]![0] as Record<string, unknown>;
    expect(event.type).toBe('identity.user.created');
    // createEvent stores the payload under `data`, not `payload`.
    expect((event.data as Record<string, unknown>).email).toBe('new@b.com');
  });
});
