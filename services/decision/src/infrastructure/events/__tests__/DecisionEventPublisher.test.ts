// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Decision Event Publisher unit tests
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi } from 'vitest';
import { DecisionEventPublisher } from '../DecisionEventPublisher.js';
import { logger } from '@vedmoulya/core';

function makeEventBus() {
  return { publish: vi.fn().mockResolvedValue(undefined) };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: 'decision.created',
    decisionId: 'dec-1',
    timestamp: new Date('2026-01-01T00:00:00Z'),
    data: { category: 'strategic' },
    ...overrides,
  };
}

describe('DecisionEventPublisher', () => {
  it('publishes a single event with metadata', () => {
    const bus = makeEventBus();
    const publisher = new DecisionEventPublisher(bus as never);
    publisher.publish(makeEvent() as never);
    expect(bus.publish).toHaveBeenCalledOnce();
    const [envelope] = bus.publish.mock.calls[0] as [Record<string, unknown>];
    expect(envelope.type).toBe('decision.created');
    expect(envelope.aggregateId).toBe('dec-1');
    expect(envelope.aggregateType).toBe('Decision');
    expect(envelope.metadata).toEqual({ service: 'decision', version: '1.0' });
    expect((envelope.data as Record<string, unknown>).decisionId).toBe('dec-1');
  });

  it('falls back to unknown aggregate id when decisionId is absent', () => {
    const bus = makeEventBus();
    const publisher = new DecisionEventPublisher(bus as never);
    publisher.publish(makeEvent({ decisionId: undefined }) as never);
    const [envelope] = bus.publish.mock.calls[0] as [Record<string, unknown>];
    expect(envelope.aggregateId).toBe('unknown');
  });

  it('logs and swallows publish failures', () => {
    // publish() wraps `void this.eventBus.publish(...)` in a try/catch that only
    // catches SYNCHRONOUS throws, so the mock must throw, not reject.
    const bus = {
      publish: vi.fn().mockImplementation(() => {
        throw new Error('bus down');
      }),
    };
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const publisher = new DecisionEventPublisher(bus as never);
    expect(() => publisher.publish(makeEvent() as never)).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('publishAll publishes every event', () => {
    const bus = makeEventBus();
    const publisher = new DecisionEventPublisher(bus as never);
    publisher.publishAll([makeEvent({ type: 'decision.made' }), makeEvent()] as never);
    expect(bus.publish).toHaveBeenCalledTimes(2);
  });
});
