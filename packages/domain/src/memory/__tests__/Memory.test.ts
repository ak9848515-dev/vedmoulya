import { describe, it, expect } from 'vitest';
import { Memory } from '../entities/Memory.js';
import { MemoryCategory } from '../value-objects/MemoryCategory.js';
import { MemoryImportance } from '../value-objects/MemoryImportance.js';
import { MemoryConfidence } from '../value-objects/MemoryConfidence.js';
import { MemorySource } from '../value-objects/MemorySource.js';
import { MemoryRetentionPolicy } from '../value-objects/MemoryRetentionPolicy.js';
import { generateMemoryId } from '../value-objects/MemoryId.js';

describe('Memory', () => {
  const defaultProps = {
    id: generateMemoryId(),
    category: MemoryCategory.experience(),
    title: 'Test Memory',
    content: 'This is test content for the memory entity.',
  };

  describe('create', () => {
    it('creates a memory with default values', () => {
      const memory = Memory.create(defaultProps);
      expect(memory.title).toBe(defaultProps.title);
      expect(memory.content).toBe(defaultProps.content);
      expect(memory.category.value).toBe('experience');
      expect(memory.importance.level).toBe('medium');
      expect(memory.confidence.level).toBe('medium');
      expect(memory.state.state).toBe('active');
      expect(memory.version.label).toBe('v1.0.0');
      expect(memory.tags).toEqual([]);
      expect(memory.metadata).toEqual({});
      expect(memory.entityStatus).toBe('active');
      expect(memory.createdAt).toBeInstanceOf(Date);
      expect(memory.updatedAt).toBeInstanceOf(Date);
    });

    it('emits created event', () => {
      const memory = Memory.create(defaultProps);
      const events = memory.pullEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('memory.created');
    });

    it('accepts custom values', () => {
      const memory = Memory.create({
        ...defaultProps,
        importance: MemoryImportance.critical(),
        confidence: MemoryConfidence.high(),
        source: MemorySource.userInput('test'),
        tags: ['important', 'test'],
        metadata: { key: 'value' },
        retentionPolicy: MemoryRetentionPolicy.permanent(),
      });
      expect(memory.importance.level).toBe('critical');
      expect(memory.confidence.level).toBe('high');
      expect(memory.source.type).toBe('user_input');
      expect(memory.tags).toContain('important');
      expect(memory.metadata).toEqual({ key: 'value' });
      expect(memory.retentionPolicy.isPermanent).toBe(true);
    });
  });

  describe('update', () => {
    it('updates title and content', () => {
      const memory = Memory.create(defaultProps);
      memory.update('New Title', 'New content');
      expect(memory.title).toBe('New Title');
      expect(memory.content).toBe('New content');
    });

    it('bumps patch version', () => {
      const memory = Memory.create(defaultProps);
      const versionBefore = memory.version.label;
      memory.update('New Title', 'New content');
      expect(memory.version.label).not.toBe(versionBefore);
      expect(memory.version.patch).toBe(1);
    });

    it('emits updated event', () => {
      const memory = Memory.create(defaultProps);
      memory.pullEvents(); // drain created event
      memory.update('New Title', 'New content');
      const events = memory.pullEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('memory.updated');
    });
  });

  describe('recall', () => {
    it('strengthens the memory', () => {
      const memory = Memory.create(defaultProps);
      const strengthBefore = memory.strength.value;
      memory.recall();
      expect(memory.strength.value).toBeGreaterThan(strengthBefore);
    });

    it('refreshes freshness', () => {
      const memory = Memory.create(defaultProps);
      memory.recall();
      expect(memory.freshness.state).toBe('vivid');
    });

    it('sets state to recalled', () => {
      const memory = Memory.create(defaultProps);
      memory.recall();
      expect(memory.state.state).toBe('recalled');
    });

    it('sets lastRecalledAt', () => {
      const memory = Memory.create(defaultProps);
      expect(memory.lastRecalledAt).toBeUndefined();
      memory.recall();
      expect(memory.lastRecalledAt).toBeInstanceOf(Date);
    });

    it('emits recalled event', () => {
      const memory = Memory.create(defaultProps);
      memory.pullEvents();
      memory.recall();
      const events = memory.pullEvents();
      expect(events[0]!.type).toBe('memory.recalled');
    });
  });

  describe('failedRecall', () => {
    it('weakens the memory', () => {
      const memory = Memory.create(defaultProps);
      const strengthBefore = memory.strength.value;
      memory.failedRecall();
      expect(memory.strength.value).toBeLessThan(strengthBefore);
    });

    it('sets state to decaying', () => {
      const memory = Memory.create(defaultProps);
      memory.failedRecall();
      expect(memory.state.state).toBe('decaying');
    });
  });

  describe('importance changes', () => {
    it('increaseImportance boosts score', () => {
      const memory = Memory.create(defaultProps);
      const scoreBefore = memory.importance.score;
      memory.increaseImportance(2);
      expect(memory.importance.score).toBeGreaterThan(scoreBefore);
    });

    it('decreaseImportance reduces score', () => {
      const memory = Memory.create(defaultProps);
      const scoreBefore = memory.importance.score;
      memory.decreaseImportance(2);
      expect(memory.importance.score).toBeLessThan(scoreBefore);
    });
  });

  describe('confidence changes', () => {
    it('strengthenConfidence increases score', () => {
      const memory = Memory.create(defaultProps);
      memory.strengthenConfidence(0.2);
      expect(memory.confidence.score).toBeGreaterThan(0.6);
    });

    it('weakenConfidence decreases score', () => {
      const memory = Memory.create(defaultProps);
      const scoreBefore = memory.confidence.score;
      memory.weakenConfidence(0.3);
      expect(memory.confidence.score).toBeLessThan(scoreBefore);
    });
  });

  describe('decay', () => {
    it('weakens strength over time', () => {
      const memory = Memory.create(defaultProps);
      const strengthBefore = memory.strength.value;
      memory.applyDecay(72); // 72 hours
      expect(memory.strength.value).toBeLessThan(strengthBefore);
    });

    it('transitions to decaying when strength is weak', () => {
      const memory = Memory.create(defaultProps);
      memory.applyDecay(5000); // Very long time
      expect(memory.state.state).toBe('decaying');
    });
  });

  describe('knowledge graph integration', () => {
    it('linkToKnowledgeNode sets reference', () => {
      const memory = Memory.create(defaultProps);
      memory.linkToKnowledgeNode('kg-node-123');
      expect(memory.knowledgeNodeId).toBe('kg-node-123');
    });

    it('linkToKnowledgeNode emits event', () => {
      const memory = Memory.create(defaultProps);
      memory.pullEvents();
      memory.linkToKnowledgeNode('kg-node-123');
      const events = memory.pullEvents();
      expect(events[0]!.type).toBe('memory.knowledge_linked');
    });

    it('unlinkFromKnowledgeNode clears reference', () => {
      const memory = Memory.create({ ...defaultProps, knowledgeNodeId: 'kg-node-123' });
      memory.unlinkFromKnowledgeNode();
      expect(memory.knowledgeNodeId).toBeUndefined();
    });

    it('unlinkFromKnowledgeNode emits event', () => {
      const memory = Memory.create({ ...defaultProps, knowledgeNodeId: 'kg-node-123' });
      memory.pullEvents();
      memory.unlinkFromKnowledgeNode();
      const events = memory.pullEvents();
      expect(events[0]!.type).toBe('memory.knowledge_unlinked');
    });
  });

  describe('merge', () => {
    it('combines content from both memories', () => {
      const target = Memory.create(defaultProps);
      const source = Memory.create({
        ...defaultProps,
        id: generateMemoryId(),
        title: 'Source Memory',
        content: 'Source content to merge',
        importance: MemoryImportance.high(),
      });

      target.merge(source);
      expect(target.content).toContain('Source content to merge');
      expect(target.content.indexOf(defaultProps.content)).toBe(0);
      expect(target.content).toContain('---');
    });

    it('takes the higher importance', () => {
      const target = Memory.create(defaultProps);
      const source = Memory.create({
        ...defaultProps,
        id: generateMemoryId(),
        title: 'Source',
        content: 'Content',
        importance: MemoryImportance.high(),
      });

      target.merge(source);
      expect(target.importance.score).toBe(7); // high = 7
    });

    it('combines tags', () => {
      const target = Memory.create({ ...defaultProps, tags: ['tag1'] });
      const source = Memory.create({
        ...defaultProps,
        id: generateMemoryId(),
        title: 'Source',
        content: 'Content',
        tags: ['tag2', 'tag3'],
      });

      target.merge(source);
      expect(target.tags).toContain('tag1');
      expect(target.tags).toContain('tag2');
      expect(target.tags).toContain('tag3');
    });

    it('emits merged event', () => {
      const target = Memory.create(defaultProps);
      const source = Memory.create({
        ...defaultProps,
        id: generateMemoryId(),
        title: 'Source',
        content: 'Content',
      });

      target.pullEvents();
      target.merge(source);
      const events = target.pullEvents();
      expect(events[0]!.type).toBe('memory.merged');
    });
  });

  describe('lifecycle', () => {
    it('archive sets state to archived', () => {
      const memory = Memory.create(defaultProps);
      memory.archive('No longer needed');
      expect(memory.state.state).toBe('archived');
      expect(memory.entityStatus).toBe('archived');
    });

    it('archive emits event', () => {
      const memory = Memory.create(defaultProps);
      memory.pullEvents();
      memory.archive('test');
      const events = memory.pullEvents();
      expect(events[0]!.type).toBe('memory.archived');
    });

    it('restore returns to active', () => {
      const memory = Memory.create(defaultProps);
      memory.archive('test');
      memory.restore();
      expect(memory.state.state).toBe('active');
      expect(memory.entityStatus).toBe('active');
    });

    it('restore emits event', () => {
      const memory = Memory.create(defaultProps);
      memory.archive('test');
      memory.pullEvents();
      memory.restore();
      const events = memory.pullEvents();
      expect(events[0]!.type).toBe('memory.restored');
    });

    it('forget sets state to forgotten', () => {
      const memory = Memory.create(defaultProps);
      memory.forget('Expired data');
      expect(memory.state.state).toBe('forgotten');
      expect(memory.entityStatus).toBe('archived');
    });

    it('forget emits event', () => {
      const memory = Memory.create(defaultProps);
      memory.pullEvents();
      memory.forget('test');
      const events = memory.pullEvents();
      expect(events[0]!.type).toBe('memory.forgotten');
    });
  });

  describe('tags', () => {
    it('addTag adds unique tags', () => {
      const memory = Memory.create(defaultProps);
      memory.addTag('important');
      memory.addTag('important'); // duplicate
      expect(memory.tags).toHaveLength(1);
      expect(memory.tags).toContain('important');
    });

    it('removeTag removes existing tags', () => {
      const memory = Memory.create({ ...defaultProps, tags: ['a', 'b', 'c'] });
      memory.removeTag('b');
      expect(memory.tags).toEqual(['a', 'c']);
    });
  });

  describe('metadata', () => {
    it('updateMetadata merges new values', () => {
      const memory = Memory.create({ ...defaultProps, metadata: { existing: 'value' } });
      memory.updateMetadata({ newKey: 'newValue' });
      expect(memory.metadata).toEqual({ existing: 'value', newKey: 'newValue' });
    });

    it('returns a copy to prevent mutation', () => {
      const memory = Memory.create(defaultProps);
      const meta = memory.metadata;
      meta.test = 'mutated';
      expect(memory.metadata).not.toHaveProperty('test');
    });
  });

  describe('category', () => {
    it('changeCategory updates category', () => {
      const memory = Memory.create(defaultProps);
      memory.changeCategory(MemoryCategory.reflection());
      expect(memory.category.value).toBe('reflection');
    });
  });

  describe('retention policy', () => {
    it('changeRetentionPolicy updates policy', () => {
      const memory = Memory.create(defaultProps);
      memory.changeRetentionPolicy(MemoryRetentionPolicy.permanent());
      expect(memory.retentionPolicy.isPermanent).toBe(true);
    });
  });

  describe('pullEvents', () => {
    it('returns and clears pending events', () => {
      const memory = Memory.create(defaultProps);
      const events1 = memory.pullEvents();
      expect(events1).toHaveLength(1);
      const events2 = memory.pullEvents();
      expect(events2).toHaveLength(0);
    });
  });

  describe('property access', () => {
    it('tags are immutable through getter', () => {
      const memory = Memory.create({ ...defaultProps, tags: ['test'] });
      expect(() => {
        (memory.tags as string[]).push('new');
      }).toThrow();
    });
  });
});
