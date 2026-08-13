// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Bridge: Capability Mapper
// EPIC-014 — maps the EPIC-013 capability vocabulary to the frozen
// runtime vocabulary (@vedmoulya/ai CapabilityType). A capability with
// NO honest runtime mapping is reported as unmapped — the step is
// UNAVAILABLE for execution, never executed via a wrong capability.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityId } from '@vedmoulya/capability-marketplace';

/** Runtime capability ids from @vedmoulya/ai (frozen). */
export type RuntimeCapability =
  | 'reasoning'
  | 'coding'
  | 'vision'
  | 'embeddings'
  | 'summarization'
  | 'classification'
  | 'translation'
  | 'speech'
  | 'image_understanding'
  | 'general_conversation'
  | 'content_generation';

interface CapabilityMapping {
  runtime?: RuntimeCapability;
  /** Why this mapping (or why none) — honesty first. */
  note: string;
}

/**
 * Only capabilities the frozen runtime can actually perform are mapped.
 * Everything else returns runtime:undefined → the resolver marks the
 * step UNAVAILABLE with the note as the reason. Never fake a mapping.
 */
const MAPPINGS: Record<CapabilityId, CapabilityMapping> = {
  TEXT_GENERATION: { runtime: 'content_generation', note: 'Runtime content generation.' },
  REASONING: { runtime: 'reasoning', note: 'Runtime reasoning specialist.' },
  CODING: { runtime: 'coding', note: 'Runtime coding specialist.' },
  RESEARCH: {
    runtime: 'reasoning',
    note: 'Research is executed as a bounded reasoning call (no live web automation is claimed).',
  },
  RAG: {
    note: 'No execution path — RAG requires a collection the run does not bind in this phase.',
  },
  VISION: { runtime: 'vision', note: 'Runtime vision capability.' },
  IMAGE_GENERATION: { note: 'No runtime execution path for image generation.' },
  VIDEO_GENERATION: { note: 'No runtime execution path for video generation.' },
  VIDEO_EDITING: { note: 'No runtime execution path for video editing.' },
  AUDIO_GENERATION: { note: 'No runtime execution path for audio generation.' },
  TEXT_TO_SPEECH: {
    runtime: 'speech',
    note: 'Runtime speech capability (where the provider supports it).',
  },
  SPEECH_TO_TEXT: {
    runtime: 'speech',
    note: 'Runtime speech capability (where the provider supports it).',
  },
  MUSIC: { note: 'No runtime execution path for music generation.' },
  AVATAR: { note: 'No runtime execution path for avatars.' },
  TRANSLATION: { runtime: 'translation', note: 'Runtime translation capability.' },
  DOCUMENT_PROCESSING: { note: 'No single runtime execution path for document processing.' },
  EMBEDDINGS: { runtime: 'embeddings', note: 'Runtime embeddings capability.' },
  WEB_RESEARCH: { note: 'No runtime execution path — live web research is not claimed.' },
  BROWSER_AUTOMATION: { note: 'No runtime execution path — browser automation is NOT supported.' },
  CODE_EXECUTION: { note: 'No runtime execution path for arbitrary code execution.' },
  DEPLOYMENT: { note: 'No runtime execution path — deployment is outside this execution phase.' },
  QUALITY_EVALUATION: {
    note: 'Quality is verified deterministically by the run verifier — not a provider call.',
  },
  ASSEMBLY: {
    note: 'Assembly is performed by the run itself (artifact chaining) — not a provider call.',
  },
};

export function mapCapability(capability: CapabilityId): CapabilityMapping {
  // eslint-disable-next-line security/detect-object-injection -- Constant-record lookup: MAPPINGS is a closed module-scope record keyed by the CapabilityId union (never user-controlled input).
  return MAPPINGS[capability];
}

export function isMapped(capability: CapabilityId): boolean {
  // eslint-disable-next-line security/detect-object-injection -- Constant-record lookup: same closed union key as above.
  return MAPPINGS[capability].runtime !== undefined;
}
