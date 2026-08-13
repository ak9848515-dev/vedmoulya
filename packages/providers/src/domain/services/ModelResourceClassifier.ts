// ──────────────────────────────────────────────────────────────────
// VedMoulya — Model Resource Classifier
// EPIC-012A — AI Provider Intelligence (Phase 8)
//
// Distinguishes LOCAL / FREE HOSTED / FREE API QUOTA / USER-PAID API /
// AGGREGATOR / OPEN MODEL / CUSTOM ENDPOINT / ENTERPRISE. The critical
// corrections over the legacy single `costTier`:
//   - "open source" is NEVER treated as "free API" (openWeights is
//     independent of freeToUse).
//   - "free model" is NEVER treated as "unlimited free inference"
//     (a free tier can be quota-limited).
// Classifications are derived from registry facts (family, pricing,
// tags, availability) — nothing is invented.
// ──────────────────────────────────────────────────────────────────

import type { ModelResourceType, ResourceClassification } from '../../types/intelligence-types.js';

export interface ResourceFacts {
  family: string;
  /** USD per 1M input tokens from the registry. */
  inputPerMillionTokens: number;
  outputPerMillionTokens: number;
  tags: string[];
  /** Registry-declared free tier. */
  costTier: 'free' | 'low' | 'medium' | 'high';
  /** Known local-runtime families. */
  localFamilies?: string[];
  /** Known aggregator families (e.g. openrouter). */
  aggregatorFamilies?: string[];
}

const DEFAULT_LOCAL_FAMILIES = ['ollama', 'lm-studio', 'local', 'custom'];
const DEFAULT_AGGREGATOR_FAMILIES = ['openrouter'];

/**
 * Classify a provider/model resource. Deterministic and pure — every
 * conclusion is derived from the supplied facts and explained in
 * `reasons` (no hidden state, no fabrication).
 */
export function classifyResource(facts: ResourceFacts): ResourceClassification {
  const localFamilies = facts.localFamilies ?? DEFAULT_LOCAL_FAMILIES;
  const aggregatorFamilies = facts.aggregatorFamilies ?? DEFAULT_AGGREGATOR_FAMILIES;
  const reasons: string[] = [];
  const family = facts.family.toLowerCase();

  const isLocalFamily = localFamilies.includes(family);
  const isAggregator = aggregatorFamilies.includes(family);
  const openWeights = facts.tags.some(
    (t) =>
      t.toLowerCase() === 'open' ||
      t.toLowerCase() === 'open-weights' ||
      t.toLowerCase() === 'open-source',
  );
  const zeroCost = facts.inputPerMillionTokens <= 0 && facts.outputPerMillionTokens <= 0;

  let resourceType: ModelResourceType;
  let freeToUse = false;

  if (isLocalFamily) {
    resourceType = 'LOCAL';
    freeToUse = zeroCost;
    reasons.push(zeroCost ? 'local runtime with zero per-token cost' : 'local runtime');
  } else if (isAggregator) {
    resourceType = 'AGGREGATOR';
    freeToUse = false;
    reasons.push(
      'aggregator gateway (e.g. OpenRouter) — per-token cost depends on the routed model',
    );
  } else if (facts.costTier === 'free') {
    // Free tier is not "unlimited free inference" — classify by evidence.
    resourceType = zeroCost ? 'FREE_HOSTED' : 'FREE_API_QUOTA';
    freeToUse = true;
    reasons.push(
      zeroCost
        ? 'registry declares free hosted tier with zero listed per-token price'
        : 'registry declares free API quota — free up to quota limits, paid beyond',
    );
  } else if (facts.inputPerMillionTokens > 0 || facts.outputPerMillionTokens > 0) {
    resourceType = 'USER_PAID_API';
    reasons.push('per-token API pricing listed');
  } else {
    resourceType = 'CUSTOM_ENDPOINT';
    reasons.push('no known pricing and not a recognized family — custom endpoint');
  }

  // Open weights is orthogonal to cost: an open model can be paid-API hosted.
  if (openWeights) {
    reasons.push('open model weights (independent of hosting cost)');
  }

  if (!zeroCost && facts.costTier === 'free') {
    reasons.push('free tier is quota-limited — not unlimited free inference');
  }

  return {
    resourceType,
    freeToUse,
    openWeights,
    reasons: reasons.filter(Boolean),
  };
}

/**
 * Map a registry classification onto the model-intelligence resource
 * type vocabulary. `ENTERPRISE` is only assigned when explicitly tagged.
 */
export function resolveResourceType(
  classification: ResourceClassification,
  tags: string[],
): ModelResourceType {
  if (tags.some((t) => t.toLowerCase() === 'enterprise')) return 'ENTERPRISE';
  return classification.resourceType;
}
