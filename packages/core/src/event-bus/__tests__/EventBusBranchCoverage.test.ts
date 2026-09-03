// ──────────────────────────────────────────────────────────────────
// VedMoulya — Targeted branch-coverage tests for event-bus gaps
// Covers wildcard handler error path, unsubscribe from non-existent
// type, and the createEvent causationId branch.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { InMemoryEventBus, createEvent, createEventId } from '../index.js';

function makeEvent(type = 'test.event') {
  return createEvent(type, 'test', { key: 'val' }, 'corr-1');
}

describe('event-bus — branch coverage', () => {
  it('wildcard handler error does not crash (catch path on line 74)', async () => {
    const bus = new InMemoryEventBus();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Async handler so Promise.resolve() wraps the rejected promise
    // and .catch() handles it rather than the throw propagating.
    bus.subscribeAll(async () => {
      throw new Error('wildcard handler error');
    });
    await bus.publish(makeEvent());
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('type-specific handler error does not crash (catch path on line 66)', async () => {
    const bus = new InMemoryEventBus();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Async handler so Promise.resolve() wraps the rejected promise
    // and .catch() handles it rather than the throw propagating.
    bus.subscribe('test.event', async () => {
      throw new Error('handler error');
    });
    await bus.publish(makeEvent());
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('unsubscribe from non-existent type does not throw', () => {
    const bus = new InMemoryEventBus();
    const handler = () => {};
    // Should be a no-op
    expect(() => bus.unsubscribe('nonexistent', handler)).not.toThrow();
  });

  it('unsubscribe removes handler and deletes set when empty', async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];
    const handler = (event: ReturnType<typeof makeEvent>) => {
      received.push(event.type);
    };
    bus.subscribe('test.event', handler);
    bus.unsubscribe('test.event', handler);
    await bus.publish(makeEvent());
    expect(received).toHaveLength(0);
  });

  it('createEvent with causationId includes it', () => {
    const ev = createEvent('test', 'src', {}, 'corr-1', 'cause-1');
    expect(ev.causationId).toBe('cause-1');
  });

  it('createEvent without causationId leaves it undefined', () => {
    const ev = createEvent('test', 'src', {}, 'corr-1');
    expect(ev.causationId).toBeUndefined();
  });

  it('createEventId returns a 24-char hex string with evt_ prefix', () => {
    const id = createEventId();
    expect(id).toMatch(/^evt_[a-f0-9]{24}$/);
  });

  it('publish returns a resolved promise', async () => {
    const bus = new InMemoryEventBus();
    const result = bus.publish(makeEvent());
    expect(result).toBeInstanceOf(Promise);
    await result;
  });

  it('getPublishedEvents returns a copy', async () => {
    const bus = new InMemoryEventBus();
    await bus.publish(makeEvent());
    const events = bus.getPublishedEvents();
    events.push(makeEvent('extra'));
    expect(bus.getPublishedEvents()).toHaveLength(1);
  });

  it('subscribeAll receives events from multiple types', async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];
    bus.subscribeAll((event) => {
      received.push(event.type);
    });
    await bus.publish(makeEvent('a'));
    await bus.publish(makeEvent('b'));
    await bus.publish(makeEvent('c'));
    expect(received).toEqual(['a', 'b', 'c']);
  });

  it('multiple handlers for same event type are all called', async () => {
    const bus = new InMemoryEventBus();
    const calls: number[] = [];
    bus.subscribe('test.event', () => {
      calls.push(1);
    });
    bus.subscribe('test.event', () => {
      calls.push(2);
    });
    await bus.publish(makeEvent());
    expect(calls).toEqual([1, 2]);
  });

  it('handler receiving async promise rejections is caught', async () => {
    const bus = new InMemoryEventBus();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    bus.subscribe('test.event', async () => {
      throw new Error('async rejection');
    });
    await bus.publish(makeEvent());
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
