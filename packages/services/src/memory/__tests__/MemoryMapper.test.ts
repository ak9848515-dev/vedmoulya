import { describe, it, expect } from 'vitest';
import { MemoryMapper } from '../MemoryMapper.js';
import { MemoryCategory } from '@vedmoulya/domain';
import { MemoryImportance } from '@vedmoulya/domain';
import { MemoryConfidence } from '@vedmoulya/domain';
import { MemoryStrength } from '@vedmoulya/domain';
import { MemorySource } from '@vedmoulya/domain';
import { MemoryRetentionPolicy } from '@vedmoulya/domain';
import { generateMemoryId } from '@vedmoulya/domain';
import { Memory } from '@vedmoulya/domain';
import type { MemoryDTO } from '../MemoryDTO.js';

function createTestMemory(overrides: Partial<Record<string, unknown>> = {}): Memory {
  const createdAt = new Date('2024-01-01');
  const updatedAt = new Date('2024-06-01');
  return Memory.create({
    id: generateMemoryId(),
    category: MemoryCategory.experience(),
    title: 'Test Memory',
    content: 'Test content description',
    importance: MemoryImportance.medium(),
    confidence: MemoryConfidence.medium(),
    source: MemorySource.systemGenerated('automated'),
    retentionPolicy: MemoryRetentionPolicy.shortTerm(),
    tags: ['test', 'important'],
    metadata: { source: 'unit-test' },
    ...overrides,
  });
}

describe('MemoryMapper', () => {
  describe('toDTO', () => {
    it('maps a Memory entity to a MemoryDTO', () => {
      const memory = createTestMemory();
      const dto = MemoryMapper.toDTO(memory);

      expect(dto.id).toBe(memory.id);
      expect(dto.category).toBe('experience');
      expect(dto.title).toBe('Test Memory');
      expect(dto.content).toBe('Test content description');
      expect(dto.importance.score).toBe(5);
      expect(dto.importance.level).toBe('medium');
      expect(dto.confidence.score).toBeCloseTo(0.6);
      expect(dto.confidence.level).toBe('medium');
      expect(dto.tags).toEqual(['test', 'important']);
      expect(dto.createdAt).toBeDefined();
      expect(dto.updatedAt).toBeDefined();
    });

    it('includes knowledgeNodeId when present', () => {
      const memory = createTestMemory();
      memory.linkToKnowledgeNode('kg-node-123');
      const dto = MemoryMapper.toDTO(memory);
      expect(dto.knowledgeNodeId).toBe('kg-node-123');
    });

    it('sets knowledgeNodeId to undefined when not linked', () => {
      const memory = createTestMemory();
      const dto = MemoryMapper.toDTO(memory);
      expect(dto.knowledgeNodeId).toBeUndefined();
    });

    it('includes lastRecalledAt when present', () => {
      const memory = createTestMemory();
      memory.recall();
      const dto = MemoryMapper.toDTO(memory);
      expect(dto.lastRecalledAt).toBeDefined();
      expect(typeof dto.lastRecalledAt).toBe('string');
    });

    it('maps state correctly', () => {
      const memory = createTestMemory();
      let dto = MemoryMapper.toDTO(memory);
      expect(dto.state).toBe('active');

      memory.archive('test');
      dto = MemoryMapper.toDTO(memory);
      expect(dto.state).toBe('archived');
    });

    it('maps strength fields', () => {
      const memory = createTestMemory();
      const dto = MemoryMapper.toDTO(memory);
      expect(dto.strength).toBeDefined();
      expect(dto.strength.value).toBeDefined();
      expect(dto.strength.interval).toBeDefined();
      expect(dto.strength.easeFactor).toBeDefined();
    });

    it('maps source fields', () => {
      const memory = createTestMemory();
      const dto = MemoryMapper.toDTO(memory);
      expect(dto.source.type).toBeDefined();
      expect(dto.source.detail).toBeDefined();
    });

    it('maps version label', () => {
      const memory = createTestMemory();
      const dto = MemoryMapper.toDTO(memory);
      expect(dto.version).toBe('v1.0.0');
    });

    it('maps retention policy', () => {
      const memory = createTestMemory();
      const dto = MemoryMapper.toDTO(memory);
      expect(dto.retentionPolicy).toBeDefined();
    });
  });

  describe('toListDTO', () => {
    it('maps array of memories to paginated list', () => {
      const memories = [createTestMemory(), createTestMemory()];
      const result = MemoryMapper.toListDTO(memories, 2, 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('calculates totalPages correctly', () => {
      const memories = [createTestMemory()];
      const result = MemoryMapper.toListDTO(memories, 25, 2, 10);
      expect(result.totalPages).toBe(3);
      expect(result.page).toBe(2);
    });

    it('handles zero total gracefully', () => {
      const result = MemoryMapper.toListDTO([], 0, 1, 20);
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('toTimelineEntries', () => {
    it('maps timeline entries with correct types', () => {
      const memory = createTestMemory();
      const entries = [
        { memory, date: new Date('2024-01-01'), type: 'created' as const },
        { memory, date: new Date('2024-06-01'), type: 'recalled' as const },
      ];

      const dtos = MemoryMapper.toTimelineEntries(entries);
      expect(dtos).toHaveLength(2);
      expect(dtos[0]!.type).toBe('created');
      expect(dtos[1]!.type).toBe('recalled');
      expect(dtos[0]!.date).toBeDefined();
      expect(dtos[0]!.memory.id).toBe(memory.id);
    });
  });

  describe('toStatsDTO', () => {
    it('maps statistics to DTO', () => {
      const dto = MemoryMapper.toStatsDTO({
        total: 100,
        byCategory: { experience: 40, observation: 30, reflection: 30 },
        byState: { active: 80, archived: 20 },
        linkedCount: 15,
      });

      expect(dto.total).toBe(100);
      expect(dto.byCategory.experience).toBe(40);
      expect(dto.byState.active).toBe(80);
      expect(dto.linkedCount).toBe(15);
    });
  });

  describe('toDecayResults', () => {
    it('maps decay results to DTOs', () => {
      const results = MemoryMapper.toDecayResults([
        {
          memoryId: 'mem-1',
          previousStrength: 0.5,
          newStrength: 0.3,
          transitioned: true,
          newState: 'decaying',
        },
      ]);

      expect(results).toHaveLength(1);
      expect(results[0]!.memoryId).toBe('mem-1');
      expect(results[0]!.previousStrength).toBeCloseTo(0.5);
      expect(results[0]!.newStrength).toBeCloseTo(0.3);
      expect(results[0]!.transitioned).toBe(true);
      expect(results[0]!.newState).toBe('decaying');
    });

    it('handles empty decay results', () => {
      const results = MemoryMapper.toDecayResults([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('toConsolidationSuggestions', () => {
    it('maps consolidation suggestions to DTOs', () => {
      const suggestions = MemoryMapper.toConsolidationSuggestions([
        {
          sourceId: 'mem-1',
          targetId: 'mem-2',
          reason: 'Similar content',
          confidence: 0.85,
        },
      ]);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]!.sourceId).toBe('mem-1');
      expect(suggestions[0]!.targetId).toBe('mem-2');
      expect(suggestions[0]!.reason).toBe('Similar content');
      expect(suggestions[0]!.confidence).toBeCloseTo(0.85);
    });
  });

  describe('toRetentionResult', () => {
    it('maps retention result to DTO', () => {
      const dto = MemoryMapper.toRetentionResult({ archived: 5, forgotten: 3 });
      expect(dto.archived).toBe(5);
      expect(dto.forgotten).toBe(3);
    });
  });

  describe('toContractEvent', () => {
    it('maps memory to contract event', () => {
      const memory = createTestMemory();
      const event = MemoryMapper.toContractEvent(memory, 'created');

      expect(event.type).toBe('memory.created');
      expect(event.memoryId).toBe(memory.id);
      expect(event.timestamp).toBeDefined();
      expect(event.data.title).toBe('Test Memory');
      expect(event.data.category).toBe('experience');
    });

    it('maps archived state to contract event', () => {
      const memory = createTestMemory();
      const event = MemoryMapper.toContractEvent(memory, 'archived');
      expect(event.type).toBe('memory.archived');
    });
  });
});
