// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Intelligence Pipeline: Identifier
// EI-006 / INT-001
// ──────────────────────────────────────────────────────────────────

const SYMBOL_PIPELINE_ID = Symbol('PipelineId');

export type PipelineId = string & { readonly [SYMBOL_PIPELINE_ID]: true };

export function createPipelineId(id: string): PipelineId {
  return id as PipelineId;
}

export function generatePipelineId(): PipelineId {
  return `pipeline_${String(Date.now())}_${Math.random().toString(36).slice(2, 9)}` as PipelineId;
}
