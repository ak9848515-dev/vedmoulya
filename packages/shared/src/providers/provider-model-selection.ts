// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Deterministic model selection (provider METADATA, no VENDOR LOGIC)
// G9 — one-click provider auto-configuration.
//
// WHY THIS EXISTS
// "Which model should be used by default?" must NOT be answered by the OpenAI,
// Anthropic, Gemini or Ollama setup screens — that would put provider-specific
// setup logic in the UI (exactly what G9 removes). It is answered here, once,
// from the model id + the capabilities the provider/catalog really reports:
//
//   1. an explicit provider default (the preset/adapter's own default model) wins
//      ONLY when the provider really offers it,
//   2. otherwise a deterministic ranking prefers coding/general-purpose models
//      (…-coder, …-instruct, chat, general …) over specialised ones,
//   3. a stable tie-break (the provider's own served order, then id) keeps the
//      choice deterministic for the same discovery result — never random.
//
// Nothing here is invented: every decision uses real model metadata. With no
// models discovered at all the caller is told `source: 'none'` so it can say
// honestly that no model could be chosen.
// ─────────────────────────────────────────────────────────────────────────────

/** A model as the provider really reported it (plus optional catalog facts). */
export interface SelectableModel {
  /** The provider's real model id (never fabricated). */
  id: string;
  /** Human name when the provider reports one; falls back to the id. */
  name: string;
  /** Capability ids when known (Ollama /api/tags carries none). */
  capabilities?: readonly string[];
  /** Served context window when known (Ollama reports it). */
  contextLength?: number;
}

/** Where the chosen model came from — the caller always learns the truth. */
export type PreferredModelSource = 'provider_default' | 'capability_rank' | 'first_available';

export interface PreferredModelChoice<TModel extends SelectableModel = SelectableModel> {
  /** The chosen model, or null when nothing was discovered. */
  model: TModel | null;
  /** Why this model was chosen. */
  source: PreferredModelSource | 'none';
  /** The ranking score (higher is better) — 0 when no model was chosen. */
  score: number;
  /** True when more than one model was available (offer [Change model]). */
  hasChoice: boolean;
}

/** Capability ids that describe a general-purpose conversational model. */
const GENERAL_CAPABILITIES: ReadonlySet<string> = new Set([
  'general',
  'general_conversation',
  'chat',
  'text_generation',
  'generation',
  'reasoning',
]);

/** Capability ids that describe a coding model. */
const CODING_CAPABILITIES: ReadonlySet<string> = new Set([
  'coding',
  'code',
  'code_generation',
  'code_completion',
]);

/**
 * Family tokens that mark a model as coding-oriented. These are MODEL-NAME
 * tokens the providers themselves publish (ollama `…-coder`, `…-instruct`,
 * `…-chat`), not vendor setup logic — the same ranking applies to every
 * provider, including ones VedMoulya has never heard of.
 */
const CODING_NAME_TOKENS: readonly string[] = ['coder', 'codellama', 'deepseek-coder', '-code'];

/** Family tokens that mark a model as general-purpose / instruct-tuned. */
const GENERAL_NAME_TOKENS: readonly string[] = [
  'instruct',
  'chat',
  'general',
  'turbo',
  'flash',
  'mini',
];

/**
 * Family tokens for models that are NOT good conversation defaults (embedding
 * and vision-encoder models cannot answer a normal prompt). They are ranked
 * last so a working general model always wins when one exists.
 */
const NON_CHAT_NAME_TOKENS: readonly string[] = [
  'embed',
  'bge-',
  'nomic-embed',
  'whisper',
  'tts',
  'stable-diffusion',
  'clip',
];

/** Largest deterministic bonus — an explicit provider default beats ranking. */
const PROVIDER_DEFAULT_SCORE = 1_000_000;

function includesAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

/**
 * Score ONE model. Deterministic for the same input: the same discovery result
 * always yields the same winner, on every run and every deployment.
 */
export function scorePreferredModel(model: SelectableModel): number {
  const id = model.id.toLowerCase();
  const name = (model.name || model.id).toLowerCase();
  const capabilities = new Set((model.capabilities ?? []).map((cap) => cap.toLowerCase()));

  let score = 0;

  // Coding / general-purpose capability metadata beats name guessing.
  for (const cap of capabilities) {
    if (CODING_CAPABILITIES.has(cap)) score += 40;
    else if (GENERAL_CAPABILITIES.has(cap)) score += 25;
  }

  // Name tokens published by the providers themselves.
  if (includesAny(id, CODING_NAME_TOKENS) || includesAny(name, CODING_NAME_TOKENS)) score += 30;
  if (includesAny(id, GENERAL_NAME_TOKENS) || includesAny(name, GENERAL_NAME_TOKENS)) score += 20;

  // Embeddings and other non-chat models are demoted hard so a chat model wins.
  if (includesAny(id, NON_CHAT_NAME_TOKENS) || includesAny(name, NON_CHAT_NAME_TOKENS))
    score -= 200;

  // A larger served context window is generally the better default — bounded so
  // it can never outweigh "this is a coding/general model".
  if (typeof model.contextLength === 'number' && model.contextLength > 0) {
    score += Math.min(model.contextLength / 1_000_000, 10);
  }
  return score;
}

/**
 * Choose the default model for a provider from what it REALLY reported.
 *
 * @param models          discovered models, in the provider's own order
 * @param providerDefault the preset/adapter default model id (may be absent)
 */
export function choosePreferredModel<TModel extends SelectableModel>(
  models: readonly TModel[],
  providerDefault?: string,
): PreferredModelChoice<TModel> {
  if (models.length === 0) return { model: null, source: 'none', score: 0, hasChoice: false };

  const preferred = providerDefault?.trim();
  if (preferred !== undefined && preferred !== '') {
    const exact = models.find((model) => model.id === preferred);
    if (exact) {
      return {
        model: exact,
        source: 'provider_default',
        score: PROVIDER_DEFAULT_SCORE,
        hasChoice: models.length > 1,
      };
    }
  }

  // Rank every model; ties keep the provider's own order (the index is only a
  // tie-break, never the primary criterion).
  let best: TModel | undefined;
  let bestScore = 0;
  let bestIndex = 0;
  for (const [index, candidate] of models.entries()) {
    const score = scorePreferredModel(candidate);
    if (best === undefined || score > bestScore) {
      best = candidate;
      bestScore = score;
      bestIndex = index;
    }
  }
  if (best === undefined) {
    // Unreachable (the length check above guarantees at least one model) — kept
    // so the noUncheckedIndexedAccess contract stays honest without casts.
    return { model: null, source: 'none', score: 0, hasChoice: false };
  }

  return {
    model: best,
    // The provider's first model winning the ranking means there was nothing
    // better to rank — say so instead of implying a preference was applied.
    source: bestIndex === 0 ? 'first_available' : 'capability_rank',
    score: bestScore,
    hasChoice: models.length > 1,
  };
}
