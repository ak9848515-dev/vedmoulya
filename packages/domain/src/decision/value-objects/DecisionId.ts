// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: DecisionId
// Branded identifier for decision entities
// ──────────────────────────────────────────────────────────────────

export type DecisionId = string & { readonly __brand: 'DecisionId' };

export function createDecisionId(value: string): DecisionId {
  return value as DecisionId;
}

export function generateDecisionId(): DecisionId {
  return `dec_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}` as DecisionId;
}
