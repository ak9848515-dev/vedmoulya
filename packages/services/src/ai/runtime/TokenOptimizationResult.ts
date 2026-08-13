// ──────────────────────────────────────────────────────────────────
// VedMoulya — Token Optimization Result
// Typed telemetry contract for the AI input-optimization pipeline
// (AI-RUNTIME-002): raw → ranked → filtered → deduplicated →
// compressed → final, with every stage measured so the runtime can
// prove cost/context discipline instead of asserting it.
// ──────────────────────────────────────────────────────────────────

export type OptimizationStage = 'raw' | 'ranked' | 'filtered' | 'compressed' | 'final';

export interface OptimizationStageTokens {
  stage: OptimizationStage;
  tokens: number;
  items: number;
}

export interface TokenOptimizationResult {
  /** Tokens of the original assembled context. */
  originalTokens: number;
  /** Tokens after EI-003 relevance ranking. */
  rankedTokens: number;
  /** Tokens after relevance filtering + deduplication. */
  filteredTokens: number;
  /** Tokens after EI-003 compression. */
  compressedTokens: number;
  /** Tokens actually sent to the provider. */
  finalTokens: number;
  /** originalTokens - finalTokens. */
  tokensRemoved: number;
  /** 1 - finalTokens/originalTokens (0 when there was nothing to remove). */
  compressionRatio: number;
  /** Number of context items dropped by the pipeline. */
  itemsRemoved: number;
  /** Pipeline label for telemetry. */
  strategyUsed: 'rank-filter-dedupe-compress' | 'none-needed';
  /** Estimated input cost in USD using the default 4-char heuristic. */
  estimatedInputCost: number;
  /** Estimated output cost (requested maxOutputTokens) in USD. */
  estimatedOutputCost: number;
  /** estimatedInputCost + estimatedOutputCost. */
  estimatedTotalCost: number;
  /** True when even the compressed context exceeds the caller budget. */
  budgetBreached: boolean;
  /** Per-stage token measurement. */
  stages: OptimizationStageTokens[];
}
