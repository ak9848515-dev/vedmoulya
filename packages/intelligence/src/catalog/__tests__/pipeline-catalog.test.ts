// ──────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Pipeline Tests: Seed Catalog + PipelineId
// EI-006 / INT-001
// Covers the pipeline seed catalog lookups and the id value-object
// factories (coverage gate: catalog was 50% / PipelineId 66%).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  PIPELINE_CATALOG,
  SEED_PIPELINE_CATALOG_SIZE,
  findCatalogEntry,
} from '../../catalog/pipeline-catalog.js';
import { createPipelineId, generatePipelineId } from '../../domain/value-objects/PipelineId.js';

describe('pipeline seed catalog', () => {
  it('exposes the five seed goals with labels and descriptions', () => {
    expect(SEED_PIPELINE_CATALOG_SIZE).toBe(5);
    expect(PIPELINE_CATALOG).toHaveLength(5);
    for (const entry of PIPELINE_CATALOG) {
      expect(entry.goalId).toMatch(/^goal_/);
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('resolves a known catalog entry by goal id', () => {
    const entry = findCatalogEntry('goal_blog_seed');
    expect(entry?.label).toContain('blog');
  });

  it('returns undefined for an unknown goal id', () => {
    expect(findCatalogEntry('goal_not_in_catalog')).toBeUndefined();
  });
});

describe('PipelineId value object', () => {
  it('creates a branded id from a string', () => {
    expect(createPipelineId('pipeline_abc')).toBe('pipeline_abc');
  });

  it('generates unique prefixed ids', () => {
    const a = generatePipelineId();
    const b = generatePipelineId();
    expect(a).toMatch(/^pipeline_/);
    expect(a).not.toBe(b);
  });
});
