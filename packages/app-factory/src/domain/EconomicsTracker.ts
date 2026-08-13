// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Economics Tracker
// EPIC-007 — Phase 17. Tracks application-generation economics:
// AI calls, input/output/total tokens, estimated cost, cache hits,
// iterations, retries, provider usage and generation time — plus the
// ESTIMATED-before vs ACTUAL-after comparison shown to the user.
// The factory NEVER sends the entire repository to a model: context is
// built from file relevance, task context, symbol extraction and
// targeted diffs (Phase 17 — optimized repeated context aggressively).
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import type { EconomicsSnapshot } from '../types/app-types.js';

export class EconomicsTracker {
  private aiCalls = 0;
  private inputTokens = 0;
  private outputTokens = 0;
  private cacheHits = 0;
  private iterations = 0;
  private retries = 0;
  private readonly providerUsage = new Map<string, number>();
  private startedAt = 0;

  constructor(
    private readonly applicationId: string,
    private readonly estimatedBefore: { estimatedTokens: number; estimatedCostUsd: number },
  ) {}

  start(): void {
    this.startedAt = Date.now();
  }

  /** Record one specialist (AI) call with its accounting. */
  recordCall(input: {
    tokens: { input: number; output: number; total: number };
    costUsd: number;
    provider: string;
    cacheHit?: boolean;
    retried?: boolean;
  }): void {
    this.aiCalls += 1;
    this.inputTokens += input.tokens.input;
    this.outputTokens += input.tokens.output;
    if (input.cacheHit === true) this.cacheHits += 1;
    if (input.retried === true) this.retries += 1;
    this.providerUsage.set(input.provider, (this.providerUsage.get(input.provider) ?? 0) + 1);
  }

  recordIteration(): void {
    this.iterations += 1;
  }

  snapshot(): EconomicsSnapshot {
    const totalTokens = this.inputTokens + this.outputTokens;
    const generationTimeMs = this.startedAt > 0 ? Date.now() - this.startedAt : 0;
    return {
      applicationId: this.applicationId,
      aiCalls: this.aiCalls,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      totalTokens,
      estimatedCostUsd: Number(((totalTokens / 1_000_000) * 3 + this.aiCalls * 0.001).toFixed(5)),
      cacheHits: this.cacheHits,
      iterations: this.iterations,
      retries: this.retries,
      providerUsage: Object.fromEntries(this.providerUsage),
      generationTimeMs,
      estimatedBefore: this.estimatedBefore,
    };
  }
}

/** Deterministic id helper (tests + operator scripts). */
export function economicsId(): string {
  return `econ-${generateId()}`;
}
