// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: StrategyId
// Branded type for execution strategy identifiers
// EI-004 — Enterprise Execution Strategy Engine
// ──────────────────────────────────────────────────────────────────

const SYMBOL_STRATEGY_ID = Symbol('StrategyId');

export type StrategyId = string & { readonly [SYMBOL_STRATEGY_ID]: true };

export function createStrategyId(id: string): StrategyId {
  return id as StrategyId;
}

export function generateStrategyId(): StrategyId {
  return `strategy_${String(Date.now())}_${Math.random().toString(36).slice(2, 9)}` as StrategyId;
}
