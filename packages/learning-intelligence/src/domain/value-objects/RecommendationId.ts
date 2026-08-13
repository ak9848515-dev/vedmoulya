// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Recommendation Id
// EI-007 — Enterprise Learning Intelligence Platform
// Deterministic branded ids for recommendations and their decisions.
// Recommendation ids are deterministic per (type, entity) so the safety
// decision store can overlay approval state across regeneration.
// ──────────────────────────────────────────────────────────────────

export type RecommendationId = string & { readonly __recommendationId: unique symbol };

export type DecisionId = string & { readonly __decisionId: unique symbol };

export function createRecommendationId(type: string, entityId: string): RecommendationId {
  return `rec_${type}_${entityId}` as RecommendationId;
}

export function createDecisionId(recommendationId: string): DecisionId {
  return `decision_${recommendationId}` as DecisionId;
}
