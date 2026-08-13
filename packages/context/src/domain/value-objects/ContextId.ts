// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: ContextId
// Branded type for context item identifiers
// ──────────────────────────────────────────────────────────────────

const SYMBOL_CONTEXT_ID = Symbol('ContextId');

export type ContextId = string & { readonly [SYMBOL_CONTEXT_ID]: true };

export function createContextId(id: string): ContextId {
  return id as ContextId;
}

export function generateContextId(): ContextId {
  return `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}` as ContextId;
}
