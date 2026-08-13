import { describe, expect, it } from 'vitest';
import { ProviderBenchmarkDatasetService } from '../ProviderBenchmarkDatasetService.js';
import {
  createBenchmarkDataset,
  BENCHMARK_DATASET_SIZE,
} from '../../../catalog/benchmark-catalog.js';

describe('ProviderBenchmarkDatasetService', () => {
  const svc = new ProviderBenchmarkDatasetService();

  it('lists all benchmark dataset definitions', () => {
    const all = svc.listAll();
    expect(all.length).toBe(BENCHMARK_DATASET_SIZE);
    expect(all.length).toBeGreaterThan(0);
  });

  it('finds a definition by id', () => {
    const definition = svc.findById('B-001');
    expect(definition).toBeDefined();
    expect(definition?.category).toBe('general_knowledge');
    expect(definition?.capability).toBe('general_conversation');
    expect(definition?.difficulty).toBe('basic');
  });

  it('returns undefined for unknown id', () => {
    expect(svc.findById('B-999')).toBeUndefined();
  });

  it('filters by category', () => {
    const results = svc.filterBy({ category: 'reasoning' });
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const definition of results) {
      expect(definition.category).toBe('reasoning');
    }
  });

  it('filters by capability', () => {
    const results = svc.filterBy({ capability: 'summarization' });
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const definition of results) {
      expect(definition.capability).toBe('summarization');
    }
  });

  it('filters by difficulty', () => {
    const results = svc.filterBy({ difficulty: 'intermediate' });
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const definition of results) {
      expect(definition.difficulty).toBe('intermediate');
    }
  });

  it('filters by all three criteria', () => {
    const results = svc.filterBy({
      category: 'reasoning',
      capability: 'embeddings',
      difficulty: 'expert',
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.benchmarkId).toBe('B-012');
  });

  it('summarizes the full dataset', () => {
    const summary = svc.summarize();
    expect(summary.total).toBe(BENCHMARK_DATASET_SIZE);
    expect(summary.byCategory.reasoning).toBeGreaterThanOrEqual(1);
    expect(summary.byDifficulty.basic).toBeGreaterThanOrEqual(1);
    expect(summary.byDifficulty.intermediate).toBeGreaterThanOrEqual(1);
    expect(summary.byDifficulty.advanced).toBeGreaterThanOrEqual(1);
    expect(summary.byDifficulty.expert).toBeGreaterThanOrEqual(1);
  });

  it('every definition has valid quality and cost fields', () => {
    for (const definition of svc.listAll()) {
      expect(definition.expectedQuality).toBeGreaterThanOrEqual(0);
      expect(definition.expectedQuality).toBeLessThanOrEqual(1);
      expect(definition.expectedCostUsd).toBeGreaterThanOrEqual(0);
      expect(definition.expectedTokens).toBeGreaterThan(0);
      expect(definition.expectedLatencyMs).toBeGreaterThan(0);
    }
  });
});
