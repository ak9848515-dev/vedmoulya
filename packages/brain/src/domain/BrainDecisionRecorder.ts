// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · BrainDecisionRecorder
// EPIC-016 §20 — Brain decision record.
//
// Every meaningful Brain decision is explainable:
// decision · reason · alternatives · selected option · evidence ·
// confidence · constraints · provider/model · cost if known · quality
// estimate · timestamp · provenance.
// ──────────────────────────────────────────────────────────────────

import type { BrainDecisionRecord } from '../types/brain-types.js';
import type { ClockPort } from '../contracts/brain-ports.js';
import type { BrainDecisionStore } from '../contracts/brain-ports.js';

export interface DecisionInput {
  taskId: string;
  userId: string;
  decision: string;
  reason: string;
  alternatives: string[];
  selected: string;
  evidence?: string[];
  confidence?: number;
  constraints?: string[];
  providerId?: string;
  modelId?: string;
  costEstimateUsd?: number;
  qualityEstimate?: number;
  provenance?: string;
}

export class BrainDecisionRecorder {
  constructor(
    private readonly store: BrainDecisionStore,
    private readonly clock: ClockPort,
  ) {}

  record(input: DecisionInput): BrainDecisionRecord {
    const record: BrainDecisionRecord = {
      id: `decision-${input.taskId}-${Math.random().toString(36).slice(2, 8)}`,
      taskId: input.taskId,
      userId: input.userId,
      decision: input.decision,
      reason: input.reason,
      alternatives: input.alternatives,
      selected: input.selected,
      evidence: input.evidence ?? [],
      confidence: input.confidence ?? 0.5,
      constraints: input.constraints ?? [],
      providerId: input.providerId,
      modelId: input.modelId,
      costEstimateUsd: input.costEstimateUsd,
      qualityEstimate: input.qualityEstimate,
      createdAt: this.clock.now(),
      provenance: input.provenance ?? 'brain',
    };
    this.store.save(record);
    return record;
  }

  /** Concise user-facing explanation ("Why did VedMoulya choose this?"). */
  explain(record: BrainDecisionRecord): string {
    const parts = [`Decision: ${record.decision}`, `Why: ${record.reason}`];
    if (record.alternatives.length > 0) {
      parts.push(`Alternatives considered: ${record.alternatives.join(', ')}`);
    }
    if (record.evidence.length > 0) {
      parts.push(`Evidence: ${record.evidence.slice(0, 3).join('; ')}`);
    }
    parts.push(`Confidence: ${Math.round(record.confidence * 100)}%`);
    if (record.costEstimateUsd !== undefined) {
      parts.push(`Estimated cost: $${record.costEstimateUsd.toFixed(4)}`);
    }
    return parts.join(' · ');
  }
}
