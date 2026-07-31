import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryEventPublisher } from '../events/MemoryEventPublisher.js';

const mockPublish = vi.hoisted(() => vi.fn());

vi.mock('@vedmoulya/core', () => ({
  InMemoryEventBus: vi.fn().mockImplementation(() => ({
    publish: mockPublish,
  })),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe('MemoryEventPublisher', () => {
  let publisher: MemoryEventPublisher;

  beforeEach(() => {
    vi.clearAllMocks();
    publisher = new MemoryEventPublisher({ publish: mockPublish } as never);
  });

  it('publishes a memory event to the event bus', () => {
    const event = {
      type: 'memory.created' as const,
      memoryId: 'mem-1' as never,
      timestamp: new Date('2024-01-01'),
      data: { category: 'experience' },
    };

    publisher.publish(event);

    expect(mockPublish).toHaveBeenCalledTimes(1);
    const publishedEvent = mockPublish.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(publishedEvent.type).toBe('memory.created');
    expect(publishedEvent.aggregateId).toBe('mem-1');
    expect(publishedEvent.aggregateType).toBe('Memory');
    expect(publishedEvent.metadata).toEqual({
      service: 'memory',
      version: '1.0',
    });
  });

  it('includes event data in published payload', () => {
    const event = {
      type: 'memory.recalled' as const,
      memoryId: 'mem-2' as never,
      timestamp: new Date('2024-01-02'),
      data: { recallStrength: 0.8, previousStrength: 0.5 },
    };

    publisher.publish(event);

    const publishedEvent = mockPublish.mock.calls[0]?.[0] as Record<string, unknown>;
    const data = publishedEvent.data as Record<string, unknown>;
    expect(data.recallStrength).toBe(0.8);
    expect(data.previousStrength).toBe(0.5);
    expect(data.memoryId).toBe('mem-2');
  });

  it('uses "unknown" aggregateId when memoryId is not set', () => {
    const event = {
      type: 'memory.decayed' as const,
      memoryId: undefined as never,
      timestamp: new Date('2024-01-03'),
      data: {},
    };

    publisher.publish(event);

    const publishedEvent = mockPublish.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(publishedEvent.aggregateId).toBe('unknown');
  });

  it('publishes all events when publishAll is called', () => {
    const events = [
      {
        type: 'memory.created' as const,
        memoryId: 'mem-1' as never,
        timestamp: new Date(),
        data: {},
      },
      {
        type: 'memory.updated' as const,
        memoryId: 'mem-1' as never,
        timestamp: new Date(),
        data: {},
      },
      {
        type: 'memory.archived' as const,
        memoryId: 'mem-1' as never,
        timestamp: new Date(),
        data: {},
      },
    ];

    publisher.publishAll(events);

    expect(mockPublish).toHaveBeenCalledTimes(3);
  });

  it('handles publish errors gracefully', () => {
    mockPublish.mockImplementationOnce(() => {
      throw new Error('Event bus error');
    });

    const event = {
      type: 'memory.created' as const,
      memoryId: 'mem-1' as never,
      timestamp: new Date(),
      data: {},
    };

    expect(() => publisher.publish(event)).not.toThrow();
  });
});
