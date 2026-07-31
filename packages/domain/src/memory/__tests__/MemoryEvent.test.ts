import { describe, it, expect } from 'vitest';
import { createMemoryEvent } from '../events/MemoryEvent.js';
import { createMemoryId } from '../value-objects/MemoryId.js';

describe('MemoryEvent', () => {
  describe('createMemoryEvent', () => {
    const memoryId = createMemoryId('test-id');

    it('creates an event with the given type', () => {
      const event = createMemoryEvent('memory.created', memoryId);
      expect(event.type).toBe('memory.created');
    });

    it('includes the memory ID', () => {
      const event = createMemoryEvent('memory.updated', memoryId);
      expect(event.memoryId).toBe(memoryId);
    });

    it('sets a timestamp', () => {
      const before = Date.now();
      const event = createMemoryEvent('memory.recalled', memoryId);
      const after = Date.now();
      expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(before);
      expect(event.timestamp.getTime()).toBeLessThanOrEqual(after);
    });

    it('includes data', () => {
      const event = createMemoryEvent('memory.archived', memoryId, { reason: 'test' });
      expect(event.data).toEqual({ reason: 'test' });
    });

    it('defaults data to empty object', () => {
      const event = createMemoryEvent('memory.restored', memoryId);
      expect(event.data).toEqual({});
    });

    it('accepts all known event types', () => {
      const types = [
        'memory.created',
        'memory.updated',
        'memory.recalled',
        'memory.strengthened',
        'memory.weakened',
        'memory.merged',
        'memory.split',
        'memory.archived',
        'memory.restored',
        'memory.forgotten',
        'memory.knowledge_linked',
        'memory.knowledge_unlinked',
        'memory.decayed',
        'memory.consolidated',
        'memory.timeline_retrieved',
        'memory.search_executed',
        'memory.reflection_generated',
        'memory.retention_applied',
      ] as const;

      for (const type of types) {
        const event = createMemoryEvent(type, memoryId);
        expect(event.type).toBe(type);
      }
    });
  });
});
