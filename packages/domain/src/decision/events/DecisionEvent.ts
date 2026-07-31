// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Domain Events
// All domain events emitted by the Decision Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import type { DecisionId } from '../value-objects/DecisionId.js';

export type DecisionEventType =
  | 'decision.created'
  | 'decision.status_changed'
  | 'decision.made'
  | 'decision.completed'
  | 'decision.archived'
  | 'decision.cancelled'
  | 'decision.reevaluated'
  | 'decision.option_added'
  | 'decision.option_scored'
  | 'decision.knowledge_linked'
  | 'decision.memory_linked'
  | 'decision.confidence_updated'
  | 'decision.evidence_added'
  | 'decision.reviewed';

export interface DecisionEvent {
  type: DecisionEventType;
  decisionId?: DecisionId;
  timestamp: Date;
  data: Record<string, unknown>;
}

export function createDecisionEvent(
  type: DecisionEventType,
  decisionId: DecisionId,
  data: Record<string, unknown> = {},
): DecisionEvent {
  return { type, decisionId, timestamp: new Date(), data };
}
