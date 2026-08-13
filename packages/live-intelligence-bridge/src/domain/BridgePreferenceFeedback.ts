// ──────────────────────────────────────────────────────────────────
// VedMoulya — Live Intelligence Bridge · BridgePreferenceFeedback
// EPIC-017 § Phase 10 — PREFERENCE / PERFORMANCE FEEDBACK.
//
// Derives TASK-SPECIFIC, EVIDENCE-BASED, TIME-AWARE, REVERSIBLE
// performance facts from the EPIC-014 preference ledger + execution
// outcomes. NEVER a global permanent ranking — a provider that was
// excellent yesterday may not remain excellent forever. Facts are
// recorded through the EXISTING BrainPreferencePort (single seam).
// ──────────────────────────────────────────────────────────────────

import type { BridgePerformanceFact } from '../types/bridge-types.js';
import type { ExecutionPreferenceEvent } from '@vedmoulya/execution-bridge';

export interface PerformanceFactInput {
  loopId: string;
  capability: string;
  providerId: string;
  modelId?: string;
  /** 0..100 derived quality from the outcome evaluation. */
  qualityScore: number;
  privacyBenefit: 'yes' | 'no' | 'UNKNOWN';
  costBenefit: 'yes' | 'no' | 'UNKNOWN';
  evidence: string[];
  now: string;
}

export interface PreferenceFeedbackInput {
  loopId: string;
  capability: string;
  providerId: string;
  modelId?: string;
  events: ExecutionPreferenceEvent[];
  now: string;
}

export class BridgePreferenceFeedback {
  /** Build a task-specific performance fact from an outcome. */
  fact(input: PerformanceFactInput): BridgePerformanceFact {
    return {
      id: hashId(`${input.loopId}|${input.capability}|${input.providerId}|${input.now}`),
      loopId: input.loopId,
      capability: input.capability,
      providerId: input.providerId,
      modelId: input.modelId,
      taskQuality: this.classOf(input.qualityScore),
      privacyBenefit: input.privacyBenefit,
      costBenefit: input.costBenefit,
      derived: true,
      recordedAt: input.now,
      evidence: input.evidence,
    };
  }

  /**
   * Task-specific performance view from the ledger: per (capability,
   * provider) aggregate of recent events, time-weighted (older events
   * decay). This is a DERIVED view — reversible, never permanent.
   */
  taskProfile(
    input: PreferenceFeedbackInput,
  ): Array<{
    capability: string;
    providerId: string;
    modelId?: string;
    score: number;
    evidenceCount: number;
  }> {
    const map = new Map<
      string,
      { capability: string; providerId: string; modelId?: string; score: number; count: number }
    >();

    for (const event of input.events) {
      if (!event.provider || !event.capability) continue;
      const key = `${event.capability}|${event.provider}`;
      const entry = map.get(key) ?? {
        capability: event.capability,
        providerId: event.provider,
        modelId: event.model,
        score: 0,
        count: 0,
      };

      // Explicit user approval/rejection is authoritative; observations
      // are weaker. Events decay with age (simple recency weight).
      const recency = Math.max(0.5, 1 - this.ageHours(event.timestamp, input.now) / (24 * 30));
      const weight =
        event.source === 'explicit_user_approval' || event.source === 'explicit_user_rejection'
          ? 1.5
          : 0.8;
      const outcome =
        event.source === 'explicit_user_rejection'
          ? 20
          : event.source === 'explicit_user_approval'
            ? 95
            : 65;
      entry.score =
        (entry.score * entry.count + outcome * weight * recency) / (entry.count + weight);
      entry.count += weight;
      map.set(key, entry);
    }

    return [...map.values()].map((e) => ({
      capability: e.capability,
      providerId: e.providerId,
      modelId: e.modelId,
      score: Math.round(e.score),
      evidenceCount: Math.round(e.count),
    }));
  }

  private classOf(score: number): 'EXCELLENT' | 'GOOD' | 'ADEQUATE' | 'POOR' | 'UNKNOWN' {
    if (score >= 85) return 'EXCELLENT';
    if (score >= 70) return 'GOOD';
    if (score >= 50) return 'ADEQUATE';
    if (score >= 0) return 'POOR';
    return 'UNKNOWN';
  }

  private ageHours(timestamp: string, now: string): number {
    const t = new Date(timestamp).getTime();
    const n = new Date(now).getTime();
    if (Number.isNaN(t) || Number.isNaN(n)) return 0;
    return (n - t) / 3_600_000;
  }
}

function hashId(seed: string): string {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < seed.length; i += 1) {
    const code = seed.charCodeAt(i);
    h1 = ((h1 << 5) + h1 + code) >>> 0;
    h2 = ((h2 << 5) + h2 + code) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
