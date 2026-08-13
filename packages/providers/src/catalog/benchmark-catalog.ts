// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Catalog: Benchmark Dataset Definitions
// EI-002 — Enterprise Provider Registry & Intelligence Platform
// The registry knows HOW providers/models are evaluated (dataset
// definitions: capability, scenario, difficulty, expected quality/
// tokens/cost/latency envelopes) — it does NOT run benchmarks here.
// The Provider Benchmark Engine (EI-003) executes these datasets and
// writes measured scores back into the capability matrix.
//
// Expected figures are REGISTRY ESTIMATES derived from public
// benchmarks and provider documentation — the definition envelope a
// measured result is compared against, not a recommendation.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType, QualityTier } from '@vedmoulya/ai';
import type {
  BenchmarkDifficulty,
  ProviderBenchmarkCategory,
  ProviderBenchmarkDefinition,
} from '../types/provider-types.js';

// ── Compact builder ─────────────────────────────────────────────────────────

interface DatasetSpec {
  benchmarkId: string;
  category: ProviderBenchmarkCategory;
  capability: CapabilityType;
  scenario: string;
  difficulty: BenchmarkDifficulty;
  description: string;
  expectedQuality: number;
  expectedTokens: number;
  expectedCostUsd: number;
  expectedLatencyMs: number;
  expectedTier: QualityTier;
}

const DATASET_EPOCH = new Date('2026-08-03T00:00:00.000Z');
const EPOCH_ISO = DATASET_EPOCH.toISOString();

function d(spec: DatasetSpec): ProviderBenchmarkDefinition {
  return {
    benchmarkId: spec.benchmarkId,
    category: spec.category,
    capability: spec.capability,
    scenario: spec.scenario,
    difficulty: spec.difficulty,
    description: spec.description,
    expectedQuality: spec.expectedQuality,
    expectedTokens: spec.expectedTokens,
    expectedCostUsd: spec.expectedCostUsd,
    expectedLatencyMs: spec.expectedLatencyMs,
    updatedAt: EPOCH_ISO,
  };
}

// ── Benchmark Dataset Definitions ───────────────────────────────────────────
// One curated definition per category, spanning all four difficulty levels.
// Scenarios map to the shared @vedmoulya/ai capability taxonomy so EI-003
// can bind measured scores straight back into provider capability matrices.

const BENCHMARK_DATASETS: readonly DatasetSpec[] = [
  {
    benchmarkId: 'B-001',
    category: 'general_knowledge',
    capability: 'general_conversation',
    scenario: 'Answer 50 diverse general-knowledge questions across 10 domains',
    difficulty: 'basic',
    description:
      'Broad factual QA covering history, science, geography, and current events; measures grounding and hallucination resistance.',
    expectedQuality: 0.9,
    expectedTokens: 12000,
    expectedCostUsd: 0.006,
    expectedLatencyMs: 1200,
    expectedTier: 'standard',
  },
  {
    benchmarkId: 'B-002',
    category: 'reasoning',
    capability: 'reasoning',
    scenario: 'Solve 25 multi-step logical reasoning puzzles',
    difficulty: 'intermediate',
    description:
      'Chain-of-thought puzzles requiring deduction across 4–6 steps; measures compositional reasoning depth.',
    expectedQuality: 0.85,
    expectedTokens: 28000,
    expectedCostUsd: 0.02,
    expectedLatencyMs: 3200,
    expectedTier: 'premium',
  },
  {
    benchmarkId: 'B-003',
    category: 'coding',
    capability: 'coding',
    scenario: 'Implement 20 functions from natural-language specs with tests',
    difficulty: 'intermediate',
    description:
      'Spec-to-code generation with hidden test verification; measures correctness, style, and test coverage.',
    expectedQuality: 0.82,
    expectedTokens: 45000,
    expectedCostUsd: 0.035,
    expectedLatencyMs: 4200,
    expectedTier: 'premium',
  },
  {
    benchmarkId: 'B-004',
    category: 'mathematics',
    capability: 'reasoning',
    scenario: 'Solve 30 competition-level math word problems',
    difficulty: 'advanced',
    description:
      'Arithmetic, algebra, and combinatorics word problems; measures numeric reasoning and step fidelity.',
    expectedQuality: 0.78,
    expectedTokens: 36000,
    expectedCostUsd: 0.03,
    expectedLatencyMs: 3800,
    expectedTier: 'premium',
  },
  {
    benchmarkId: 'B-005',
    category: 'long_context',
    capability: 'summarization',
    scenario: 'Summarize a 50k-token research report into a 5-point brief',
    difficulty: 'advanced',
    description:
      'Long-context comprehension: recall, cross-reference, and faithful compression beyond 50k tokens.',
    expectedQuality: 0.88,
    expectedTokens: 56000,
    expectedCostUsd: 0.05,
    expectedLatencyMs: 9000,
    expectedTier: 'premium',
  },
  {
    benchmarkId: 'B-006',
    category: 'instruction_following',
    capability: 'general_conversation',
    scenario: 'Follow 20 multi-part instructions with explicit constraints',
    difficulty: 'basic',
    description:
      'Constraint adherence (format, length, tone, exclusions) across heterogeneous tasks; measures instruction fidelity.',
    expectedQuality: 0.92,
    expectedTokens: 15000,
    expectedCostUsd: 0.008,
    expectedLatencyMs: 1400,
    expectedTier: 'standard',
  },
  {
    benchmarkId: 'B-007',
    category: 'multimodal',
    capability: 'vision',
    scenario: 'Describe 40 images including objects, spatial relations, and anomalies',
    difficulty: 'intermediate',
    description:
      'Image understanding: object identification, layout reasoning, and anomaly detection in natural and document images.',
    expectedQuality: 0.87,
    expectedTokens: 18000,
    expectedCostUsd: 0.015,
    expectedLatencyMs: 2200,
    expectedTier: 'standard',
  },
  {
    benchmarkId: 'B-008',
    category: 'translation',
    capability: 'translation',
    scenario: 'Translate 30 business documents EN→HI preserving tone and terminology',
    difficulty: 'intermediate',
    description:
      'Professional translation fidelity (fluency, terminology, register) evaluated against human reference translations.',
    expectedQuality: 0.86,
    expectedTokens: 30000,
    expectedCostUsd: 0.022,
    expectedLatencyMs: 3000,
    expectedTier: 'standard',
  },
  {
    benchmarkId: 'B-009',
    category: 'summarization',
    capability: 'summarization',
    scenario: 'Summarize 25 news articles into key-fact bullets without distortion',
    difficulty: 'basic',
    description:
      'Extractive-abstractive summary quality: faithfulness, salience, and absence of invented facts.',
    expectedQuality: 0.9,
    expectedTokens: 16000,
    expectedCostUsd: 0.009,
    expectedLatencyMs: 1500,
    expectedTier: 'standard',
  },
  {
    benchmarkId: 'B-010',
    category: 'creative_writing',
    capability: 'content_generation',
    scenario: 'Write 12 brand-aligned long-form articles from detailed briefs',
    difficulty: 'advanced',
    description:
      'Long-form generation: structure, brand voice, originality, and audience fit judged by rubric.',
    expectedQuality: 0.84,
    expectedTokens: 52000,
    expectedCostUsd: 0.045,
    expectedLatencyMs: 5200,
    expectedTier: 'premium',
  },
  {
    benchmarkId: 'B-011',
    category: 'tool_use',
    capability: 'classification',
    scenario: 'Route 50 support tickets to correct categories using a tool-calling loop',
    difficulty: 'intermediate',
    description:
      'Function-calling reliability: correct tool selection, argument extraction, and loop termination.',
    expectedQuality: 0.88,
    expectedTokens: 26000,
    expectedCostUsd: 0.018,
    expectedLatencyMs: 2800,
    expectedTier: 'standard',
  },
  {
    benchmarkId: 'B-012',
    category: 'reasoning',
    capability: 'embeddings',
    scenario: 'Retrieve top-5 relevant documents from a 10k corpus for 40 queries',
    difficulty: 'expert',
    description:
      'Embedding retrieval quality: recall@5 and precision across a 10k-document enterprise corpus.',
    expectedQuality: 0.8,
    expectedTokens: 2000,
    expectedCostUsd: 0.002,
    expectedLatencyMs: 600,
    expectedTier: 'standard',
  },
];

/** The full benchmark dataset definition set (definitions only — no scores). */
export function createBenchmarkDataset(): ProviderBenchmarkDefinition[] {
  return BENCHMARK_DATASETS.map(d);
}

/** Total number of benchmark dataset definitions in the seed set. */
export const BENCHMARK_DATASET_SIZE = BENCHMARK_DATASETS.length;
