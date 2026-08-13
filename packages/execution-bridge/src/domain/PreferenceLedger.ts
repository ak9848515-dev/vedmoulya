// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Bridge: Preference Feedback Ledger (PHASE 5)
// EPIC-014 — captures what ACTUALLY happened during execution so
// future intelligence (EPIC-015) can learn from real outcomes. Every
// event preserves provenance: source, timestamp, execution, step,
// reason, confidence, explicit-vs-inferred.
//
// RULE: explicit user preference ALWAYS outranks inferred behavior.
// An inferred observation is recorded as an observation — it is NEVER
// silently converted into a permanent user preference. Promotion is a
// future-intelligence decision, never done here.
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import type { ExecutionPreferenceEvent, PreferenceEventSource } from '../types/execution-types.js';
import type { PreferenceLedgerPort } from '../contracts/execution-ports.js';

export interface PreferenceFactInput {
  executionId: string;
  stepId?: string;
  source: PreferenceEventSource;
  fact: string;
  provider?: string;
  model?: string;
  capability?: string;
  reason?: string;
  confidence: number;
}

export class PreferenceLedger {
  private readonly store: PreferenceLedgerPort;
  private readonly now: () => string;

  constructor(store: PreferenceLedgerPort, now: () => string) {
    this.store = store;
    this.now = now;
  }

  record(input: PreferenceFactInput): ExecutionPreferenceEvent {
    const event: ExecutionPreferenceEvent = {
      eventId: `pe-${generateId()}`,
      executionId: input.executionId,
      stepId: input.stepId,
      source: input.source,
      fact: input.fact,
      provider: input.provider,
      model: input.model,
      capability: input.capability,
      reason: input.reason,
      confidence: this.clampConfidence(input.confidence, input.source),
      timestamp: this.now(),
    };
    return this.store.record(event);
  }

  list(executionId?: string): ExecutionPreferenceEvent[] {
    return this.store.list(executionId);
  }

  /**
   * Confidence is bounded by source: explicit facts are high-confidence,
   * inferred observations are deliberately capped below the explicit
   * threshold so the ledger can never outrank a stated preference.
   */
  private clampConfidence(raw: number, source: PreferenceEventSource): number {
    const clamped = Math.max(0, Math.min(1, raw));
    if (source === 'inferred_observation') return Math.min(clamped, 0.5);
    return clamped;
  }
}
