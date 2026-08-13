// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Learning Seed Catalog
// EI-007 — Enterprise Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { createCatalogLearningEvents, SEED_LEARNING_SIZE } from '../learning-catalog.js';
import { validateLearningEvent } from '../../domain/rules/LearningRules.js';
import { LEARNING_CATEGORIES } from '../../types/learning-types.js';

describe('learning-catalog', () => {
  it('exports the declared seed size', () => {
    expect(SEED_LEARNING_SIZE).toBe(54);
    expect(createCatalogLearningEvents()).toHaveLength(SEED_LEARNING_SIZE);
  });

  it('covers all 10 learning categories', () => {
    const events = createCatalogLearningEvents();
    const categories = new Set(events.map((e) => e.category));
    for (const category of LEARNING_CATEGORIES) {
      expect(categories.has(category)).toBe(true);
    }
  });

  it('every seed event is valid per the learning rules', () => {
    for (const event of createCatalogLearningEvents()) {
      expect(validateLearningEvent(event).passed, `invalid event: ${event.eventId}`).toBe(true);
    }
  });

  it('events are unique and spread across recent days', () => {
    const events = createCatalogLearningEvents();
    const ids = new Set(events.map((e) => e.eventId));
    expect(ids.size).toBe(events.length);
    const dates = events.map((e) => new Date(e.occurredAt).getTime());
    expect(Math.max(...dates) - Math.min(...dates)).toBeLessThanOrEqual(14 * 86_400_000);
  });

  it('references realistic seed entities (providers, goals, capabilities)', () => {
    const events = createCatalogLearningEvents();
    const entityIds = events.map((e) => e.entityId);
    const sourceIds = events
      .map((e) => e.sourceRef?.sourceId)
      .filter((s): s is string => s !== undefined);
    expect(entityIds).toContain('openai');
    expect(entityIds).toContain('research');
    expect(entityIds).toContain('ctx_knowledge_provider_001');
    expect(sourceIds).toContain('goal_blog_seed');
  });
});
