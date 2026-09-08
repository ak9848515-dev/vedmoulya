// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Optimization: In-Memory Outcome Store
//
// Records what happened after each recommendation (Phase 21 feedback
// loop) so recommendation effectiveness/uplift can be measured. The
// store contract is narrow; a durable implementation can back it with
// the existing persistence architecture later.
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory store
   implements the Promise-returning port with synchronous Map-backed
   bodies (no I/O); async markers required for conformance. */

import type { RecommendationOutcomeRecord } from '../types/experience-optimization-types.js';
import type { RecommendationOutcomeStore } from '../contracts/experience-optimization-ports.js';

export class InMemoryRecommendationOutcomeStore implements RecommendationOutcomeStore {
  private readonly records: RecommendationOutcomeRecord[] = [];

  async save(record: RecommendationOutcomeRecord): Promise<void> {
    this.records.push(record);
  }

  async list(): Promise<RecommendationOutcomeRecord[]> {
    return [...this.records];
  }
}
