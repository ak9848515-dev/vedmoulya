// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Lifecycle tests
// EI-009 — Enterprise Knowledge Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { KnowledgeLifecycleService } from '../KnowledgeLifecycleService.js';
import { createCatalogKnowledgeItems } from '../../../catalog/knowledge-catalog.js';

describe('KnowledgeLifecycleService', () => {
  const service = new KnowledgeLifecycleService();

  it('transitions draft → review → active → deprecated → archived', () => {
    let item = {
      ...(createCatalogKnowledgeItems().find((i) => i.lifecycleStatus === 'draft') ??
        createCatalogKnowledgeItems()[0]),
      lifecycleStatus: 'draft' as const,
    };
    for (const to of ['review', 'active', 'deprecated', 'archived'] as const) {
      const result = service.transition(item, to, 'owner');
      expect(result.transitioned).toBe(true);
      expect(result.item.lifecycleStatus).toBe(to);
      expect(result.item.audit.length).toBeGreaterThan(item.audit.length);
      item = result.item;
    }
  });

  it('rejects illegal transitions with a message', () => {
    const draft = { ...createCatalogKnowledgeItems()[0], lifecycleStatus: 'draft' as const };
    const result = service.transition(draft, 'active', 'owner');
    expect(result.transitioned).toBe(false);
    expect(result.message).toContain('Cannot activate');
    expect(result.item.lifecycleStatus).toBe('draft');
  });

  it('no-ops on same-status transitions', () => {
    const item = { ...createCatalogKnowledgeItems()[0], lifecycleStatus: 'active' as const };
    const result = service.transition(item, 'active', 'owner');
    expect(result.transitioned).toBe(true);
    expect(result.item.lifecycleStatus).toBe('active');
  });

  it('re-scores trust on transition (active items outrank drafts)', () => {
    const item = {
      ...createCatalogKnowledgeItems()[0],
      lifecycleStatus: 'draft' as const,
      trust: { score: 0.4, level: 'low' as const, factors: [] },
    };
    const activated = service.transition(item, 'review', 'owner').item;
    expect(activated.trust.score).not.toBe(0.4);
  });
});
