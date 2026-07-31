import { describe, it, expect, vi } from 'vitest';
import { DecisionFactory } from '../factory/DecisionFactory.js';

describe('DecisionFactory', () => {
  const mockRepository = {
    findById: vi.fn(),
    findByCategory: vi.fn(),
    findByStatus: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    search: vi.fn(),
    findByKnowledgeNodeId: vi.fn(),
    findByMemoryId: vi.fn(),
    findPendingDecisions: vi.fn(),
    findRecentlyCompleted: vi.fn(),
    count: vi.fn(),
    countByCategory: vi.fn(),
    countByStatus: vi.fn(),
    countLinked: vi.fn(),
  };

  const factory = new DecisionFactory(mockRepository);

  describe('createDecision', () => {
    it('creates a decision with valid input', async () => {
      const result = await factory.createDecision({
        title: 'Test Decision',
        description: 'Test description',
        category: 'strategic',
        tags: ['test'],
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.title).toBe('Test Decision');
      expect(result.data?.category).toBe('strategic');
    });

    it('uses operational as default category for invalid', async () => {
      const result = await factory.createDecision({
        title: 'Test',
        description: 'Test',
        category: 'invalid_category',
      });

      expect(result.success).toBe(true);
      expect(result.data?.category).toBe('operational');
    });

    it('creates with priority score', async () => {
      const result = await factory.createDecision({
        title: 'Test',
        description: 'Test',
        category: 'technical',
        priorityScore: 8,
      });

      expect(result.success).toBe(true);
      expect(result.data?.priority.score).toBe(8);
    });

    it('creates with initiator', async () => {
      const result = await factory.createDecision({
        title: 'Test',
        description: 'Test',
        category: 'business',
        initiator: 'ai_orchestrator',
      });

      expect(result.success).toBe(true);
      expect(result.data?.initiator).toBe('ai_orchestrator');
    });
  });

  describe('reconstructDecision', () => {
    it('reconstructs a decision from persisted data', () => {
      const decision = DecisionFactory.reconstructDecision({
        id: 'dec_123',
        title: 'Reconstructed',
        description: 'From DB',
        category: 'strategic',
        status: 'completed',
        priorityLevel: 'high',
        priorityScore: 8,
        confidenceLevel: 'medium',
        confidenceScore: 0.6,
        versionMajor: 1,
        versionMinor: 2,
        versionPatch: 3,
        initiator: 'user',
      });

      expect(decision.title).toBe('Reconstructed');
      expect(decision.status.toString()).toBe('completed');
      expect(decision.priority.level).toBe('high');
      expect(decision.version.label).toBe('v1.2.3');
    });

    it('handles minimal data', () => {
      const decision = DecisionFactory.reconstructDecision({
        id: 'dec_min',
        title: 'Minimal',
        description: 'Minimal reconstruction',
        category: 'personal',
      });

      expect(decision.title).toBe('Minimal');
      expect(decision.status.toString()).toBe('requested');
      expect(decision.priority.level).toBe('medium');
    });
  });
});
