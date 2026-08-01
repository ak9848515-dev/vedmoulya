// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Decision Validation Schemas unit tests
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  createDecisionSchema,
  updateDecisionSchema,
  addOptionSchema,
  scoreOptionSchema,
  assessRiskSchema,
  assessOpportunitySchema,
  decideSchema,
  completeDecisionSchema,
  mergeDecisionsSchema,
  paginationQuery,
  searchQuery,
} from '../DecisionSchemas.js';

describe('createDecisionSchema', () => {
  it('accepts a valid payload', () => {
    const parsed = createDecisionSchema.parse({
      title: 'Move to Berlin',
      description: 'Relocate for career',
      category: 'career',
    });
    expect(parsed.title).toBe('Move to Berlin');
    expect(parsed.category).toBe('career');
  });

  it('accepts optional fields', () => {
    const parsed = createDecisionSchema.parse({
      title: 'Buy a house',
      description: 'Housing decision',
      category: 'strategic',
      priorityScore: 8,
      initiator: 'user',
      tags: ['housing'],
      metadata: { budget: 500000 },
    });
    expect(parsed.priorityScore).toBe(8);
    expect(parsed.tags).toEqual(['housing']);
  });

  it('rejects invalid categories and empty titles', () => {
    expect(
      createDecisionSchema.safeParse({
        title: 'X',
        description: 'Y',
        category: 'nonsense',
      }).success,
    ).toBe(false);
    expect(
      createDecisionSchema.safeParse({
        title: '',
        description: 'Y',
        category: 'career',
      }).success,
    ).toBe(false);
  });
});

describe('updateDecisionSchema', () => {
  it('accepts partial updates', () => {
    const parsed = updateDecisionSchema.parse({ title: 'Renamed' });
    expect(parsed.title).toBe('Renamed');
  });

  it('rejects priority scores out of range', () => {
    expect(updateDecisionSchema.safeParse({ priorityScore: 11 }).success).toBe(false);
  });
});

describe('addOptionSchema', () => {
  it('applies default empty pros/cons', () => {
    const parsed = addOptionSchema.parse({ label: 'Option A', description: 'Desc' });
    expect(parsed.pros).toEqual([]);
    expect(parsed.cons).toEqual([]);
  });

  it('accepts provided pros/cons', () => {
    const parsed = addOptionSchema.parse({
      label: 'Option A',
      description: 'Desc',
      pros: ['fast'],
      cons: ['costly'],
    });
    expect(parsed.pros).toEqual(['fast']);
  });
});

describe('scoreOptionSchema', () => {
  it('accepts valid criteria', () => {
    const parsed = scoreOptionSchema.parse({
      optionId: 'opt-1',
      criteria: [{ criterion: 'impact', score: 80, weight: 0.5 }],
    });
    expect(parsed.criteria).toHaveLength(1);
  });

  it('rejects out-of-range scores', () => {
    expect(
      scoreOptionSchema.safeParse({
        optionId: 'opt-1',
        criteria: [{ criterion: 'impact', score: 101, weight: 0.5 }],
      }).success,
    ).toBe(false);
  });
});

describe('assessRiskSchema / assessOpportunitySchema', () => {
  it('accepts valid risk assessment', () => {
    const parsed = assessRiskSchema.parse({
      optionId: 'opt-1',
      riskScore: 0.6,
      description: 'Market risk',
      mitigation: 'Diversify',
    });
    expect(parsed.riskScore).toBe(0.6);
  });

  it('accepts valid opportunity assessment', () => {
    const parsed = assessOpportunitySchema.parse({
      optionId: 'opt-1',
      opportunityScore: 0.8,
      description: 'Upside',
    });
    expect(parsed.opportunityScore).toBe(0.8);
  });

  it('rejects scores above 1', () => {
    expect(
      assessRiskSchema.safeParse({ optionId: 'opt-1', riskScore: 1.5, description: 'x' }).success,
    ).toBe(false);
  });
});

describe('decideSchema / completeDecisionSchema', () => {
  it('accepts a decide payload', () => {
    const parsed = decideSchema.parse({
      optionId: 'opt-1',
      reasoningMethod: 'pros_cons',
      reasoningSummary: 'Clear winner',
    });
    expect(parsed.optionId).toBe('opt-1');
  });

  it('accepts a complete payload with valid result', () => {
    const parsed = completeDecisionSchema.parse({
      result: 'success',
      description: 'Worked out',
    });
    expect(parsed.result).toBe('success');
  });

  it('rejects an invalid outcome result', () => {
    expect(
      completeDecisionSchema.safeParse({ result: 'miraculous', description: 'x' }).success,
    ).toBe(false);
  });
});

describe('mergeDecisionsSchema', () => {
  it('accepts two or more source ids', () => {
    const parsed = mergeDecisionsSchema.parse({
      sourceIds: ['dec-1', 'dec-2'],
      targetTitle: 'Merged',
    });
    expect(parsed.sourceIds).toHaveLength(2);
  });

  it('rejects a single source id', () => {
    expect(
      mergeDecisionsSchema.safeParse({ sourceIds: ['dec-1'], targetTitle: 'Merged' }).success,
    ).toBe(false);
  });
});

describe('paginationQuery / searchQuery', () => {
  it('coerces and defaults pagination values', () => {
    expect(paginationQuery.parse({}).page).toBe(1);
    expect(paginationQuery.parse({}).limit).toBe(20);
    expect(paginationQuery.parse({ page: '3', limit: '50' }).page).toBe(3);
  });

  it('rejects limits above the max', () => {
    expect(paginationQuery.safeParse({ limit: 200 }).success).toBe(false);
  });

  it('parses search queries with optional filters', () => {
    const parsed = searchQuery.parse({ q: 'career', category: 'career', status: 'evaluating' });
    expect(parsed.q).toBe('career');
    expect(parsed.category).toBe('career');
    expect(parsed.page).toBe(1);
  });

  it('rejects invalid search categories', () => {
    expect(searchQuery.safeParse({ category: 'nonsense' }).success).toBe(false);
  });
});
