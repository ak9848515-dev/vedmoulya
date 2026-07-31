import { describe, it, expect, vi } from 'vitest';
import { DecisionDomainService } from '../services/DecisionDomainService.js';
import { Decision } from '../entities/Decision.js';
import { generateDecisionId } from '../value-objects/DecisionId.js';

describe('DecisionDomainService', () => {
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

  const service = new DecisionDomainService(mockRepository);

  const createDecisionWithOptions = () => {
    const decision = Decision.create({
      id: generateDecisionId(),
      title: 'Test',
      description: 'Test',
      category: 'strategic',
    });
    decision.addOption({
      id: 'a',
      label: 'Option A',
      description: '',
      pros: ['Fast'],
      cons: ['Expensive'],
    });
    decision.addOption({
      id: 'b',
      label: 'Option B',
      description: '',
      pros: ['Cheap'],
      cons: ['Slow'],
    });
    return decision;
  };

  describe('calculatePriority', () => {
    it('calculates priority from factors', () => {
      const priority = DecisionDomainService.calculatePriority({
        urgency: 8,
        impact: 7,
        timeSensitivity: 9,
        strategicAlignment: 6,
        stakeholderPressure: 5,
      });
      expect(priority.score).toBeGreaterThan(0);
      expect(priority.level).toBeDefined();
    });
  });

  describe('calculateConfidence', () => {
    it('returns low for decision with no options scored', () => {
      const confidence = DecisionDomainService.calculateConfidence(createDecisionWithOptions());
      expect(confidence.level).toBe('low');
    });

    it('increases with evidence and reasoning', () => {
      const decision = createDecisionWithOptions();
      decision.addEvidence({
        id: 'ev1',
        type: 'knowledge',
        source: 'kg',
        content: 'data',
        relevanceScore: 0.8,
        timestamp: new Date(),
      });
      const confidence = DecisionDomainService.calculateConfidence(decision);
      expect(confidence.score).toBeGreaterThan(0.3);
    });
  });

  describe('rankOptions', () => {
    it('returns empty array for decision with no scored options', async () => {
      const decision = createDecisionWithOptions();
      const result = await service.rankOptions(decision);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('recommend', () => {
    it('returns error for unscored decision', async () => {
      const decision = createDecisionWithOptions();
      const result = await service.recommend(decision);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No scored options');
    });
  });

  describe('compareOptions', () => {
    it('compares two options by label', async () => {
      const decision = createDecisionWithOptions();
      const result = await service.compareOptions(decision, 'a', 'b');
      expect(result.success).toBe(true);
      expect(result.data?.optionA).toBe('Option A');
      expect(result.data?.optionB).toBe('Option B');
    });

    it('fails when option not found', async () => {
      const decision = createDecisionWithOptions();
      const result = await service.compareOptions(decision, 'a', 'nonexistent');
      expect(result.success).toBe(false);
    });
  });
});
