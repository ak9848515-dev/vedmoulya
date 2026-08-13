// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Validation tests
// EI-009 — Enterprise Knowledge Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { KnowledgeValidationService } from '../KnowledgeValidationService.js';
import type { KnowledgeItem } from '../../../types/knowledge-types.js';
import { createCatalogKnowledgeItems } from '../../../catalog/knowledge-catalog.js';

function item(overrides: Partial<KnowledgeItem> = {}): KnowledgeItem {
  return { ...createCatalogKnowledgeItems()[0], ...overrides };
}

describe('KnowledgeValidationService', () => {
  const service = new KnowledgeValidationService();

  it('passes a well-formed item', () => {
    const report = service.validate(item());
    expect(report.passed).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it('collects all issues instead of failing fast', () => {
    const report = service.validate(
      item({
        knowledgeId: '',
        title: 'x',
        description: '',
        source: '',
        owner: '',
        category: 'alien' as KnowledgeItem['category'],
        sourceType: 'telepathy' as KnowledgeItem['sourceType'],
        trust: { ...item().trust, score: 2 },
        createdAt: 'not-a-date',
      }),
    );
    expect(report.passed).toBe(false);
    expect(report.issues.length).toBeGreaterThan(3);
  });

  it('expects citations for documentary sources', () => {
    const report = service.validate(item({ sourceType: 'document', citations: [] }));
    expect(report.passed).toBe(false);
    expect(report.issues.some((issue) => issue.includes('citation'))).toBe(true);
  });

  it('detects duplicate relationship edges', () => {
    const base = item();
    const duplicate = [base.relationships[0], base.relationships[0]].filter(Boolean);
    const report = service.validate(item({ relationships: duplicate }));
    expect(report.passed).toBe(false);
    expect(report.issues.some((issue) => issue.includes('duplicate'))).toBe(true);
  });

  it('flags unresolved dependency/relationship targets when known ids are given', () => {
    const report = service.validate(
      item({
        dependencies: [
          { dependencyId: 'd1', targetId: 'kn_ghost', type: 'depends_on', criticality: 'high' },
        ],
      }),
      { requireResolvedRelationships: true, knownIds: new Set(['kn_real']) },
    );
    expect(report.passed).toBe(false);
    expect(report.issues.some((issue) => issue.includes('does not exist'))).toBe(true);
  });

  it('checks dates', () => {
    const report = service.validate(item({ updatedAt: 'whenever' }));
    expect(report.issues.some((issue) => issue.includes('updatedAt'))).toBe(true);
  });
});
