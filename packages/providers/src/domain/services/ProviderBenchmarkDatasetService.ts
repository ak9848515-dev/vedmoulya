// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Domain Service: Benchmark Dataset Service
// Holds and filters the benchmark DATASET DEFINITIONS (EI-002). The
// registry stores how providers are evaluated — capability, scenario,
// difficulty, and expected quality/tokens/cost/latency envelopes — but
// never runs a benchmark. EI-003 executes these datasets and writes
// measured scores back into provider capability matrices.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import { createBenchmarkDataset } from '../../catalog/benchmark-catalog.js';
import type {
  BenchmarkDifficulty,
  ProviderBenchmarkCategory,
  ProviderBenchmarkDefinition,
} from '../../types/provider-types.js';
import {
  BENCHMARK_DIFFICULTIES,
  PROVIDER_BENCHMARK_CATEGORIES,
} from '../../types/provider-types.js';

// ── Filter ──────────────────────────────────────────────────────────────────

export interface BenchmarkDatasetFilter {
  category?: ProviderBenchmarkCategory;
  capability?: CapabilityType;
  difficulty?: BenchmarkDifficulty;
}

export interface BenchmarkDatasetSummary {
  total: number;
  byCategory: Partial<Record<ProviderBenchmarkCategory, number>>;
  byDifficulty: Partial<Record<BenchmarkDifficulty, number>>;
}

/**
 * Immutable view over the benchmark dataset definitions. The dataset is
 * injected (defaulting to the seed catalog) so tests and future engines
 * can supply their own sets without changing the registry contract.
 */
export class ProviderBenchmarkDatasetService {
  private readonly dataset: readonly ProviderBenchmarkDefinition[];

  constructor(dataset: readonly ProviderBenchmarkDefinition[] = createBenchmarkDataset()) {
    this.dataset = Object.freeze(dataset.map((definition) => ({ ...definition })));
  }

  listAll(): readonly ProviderBenchmarkDefinition[] {
    return this.dataset;
  }

  findById(benchmarkId: string): ProviderBenchmarkDefinition | undefined {
    return this.dataset.find((definition) => definition.benchmarkId === benchmarkId);
  }

  /** Filter definitions by category, capability, and/or difficulty. */
  filterBy(filter: BenchmarkDatasetFilter = {}): ProviderBenchmarkDefinition[] {
    return this.dataset.filter((definition) => {
      if (filter.category !== undefined && definition.category !== filter.category) return false;
      if (filter.capability !== undefined && definition.capability !== filter.capability)
        return false;
      if (filter.difficulty !== undefined && definition.difficulty !== filter.difficulty)
        return false;
      return true;
    });
  }

  /** Counts by category and difficulty (for marketplace/registry views). */
  summarize(items: readonly ProviderBenchmarkDefinition[] = this.dataset): BenchmarkDatasetSummary {
    const byCategory: Partial<Record<ProviderBenchmarkCategory, number>> = {};
    const byDifficulty: Partial<Record<BenchmarkDifficulty, number>> = {};
    for (const category of PROVIDER_BENCHMARK_CATEGORIES) byCategory[category] = 0;
    for (const difficulty of BENCHMARK_DIFFICULTIES) byDifficulty[difficulty] = 0;
    for (const definition of items) {
      byCategory[definition.category] = (byCategory[definition.category] ?? 0) + 1;
      byDifficulty[definition.difficulty] = (byDifficulty[definition.difficulty] ?? 0) + 1;
    }
    return { total: items.length, byCategory, byDifficulty };
  }
}
