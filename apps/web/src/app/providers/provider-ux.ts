// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider UX vocabulary (pure presentation logic)
// AI PROVIDER UX SIMPLIFICATION
//
// Everything here is PRESENTATION ONLY. Nothing in this module configures a
// provider: endpoints, protocols, credentials, model discovery and routing
// stay in the existing preset registry (@vedmoulya/shared providerPresets),
// the provider runtime registry and the orchestrator. The UI reads those
// facts and renders calm, human language.
//
// Rules encoded here:
//   - names/vendors come from the registry (with presentation aliases for
//     user-facing short names — never a second provider registry),
//   - connection status is derived from the SAME readiness truth the rest of
//     the screen uses (provider-readiness.ts),
//   - raw capability ids are translated into plain-language sentences,
//   - raw error text is never shown: failures become friendly, actionable
//     messages.
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- the lookup tables below are
   indexed by the provider FAMILY id coming from the platform provider registry
   (a closed set of catalog ids), never by attacker-controlled input; the rule
   is a false positive on these presentational maps (same convention as
   apps/web/src/app/providers/ModelSelector.tsx). */

import { isSimpleProviderPreset, providerPreset } from '@vedmoulya/shared';
import { deriveProviderState } from './provider-state.js';

// ── Provider identity ───────────────────────────────────────────────────────

/**
 * Presentation short names for KNOWN families. The registry (catalog) still
 * owns the authoritative name; these only make the card readable ("Gemini"
 * instead of "Google (Gemini)"). Unknown families always fall back to the
 * registry name — nothing is invented for providers VedMoulya does not know.
 */
const PROVIDER_SHORT_NAMES: Record<string, string> = {
  google: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Claude',
  deepseek: 'DeepSeek',
  ollama: 'Ollama',
  openrouter: 'OpenRouter',
  mock: 'Mock (Test)',
};

/** Who makes the AI — mirrors the preset table's vendor identity. */
const PROVIDER_VENDORS: Record<string, string> = {
  google: 'Google',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  deepseek: 'DeepSeek',
  ollama: 'Local',
  openrouter: 'OpenRouter',
  mock: 'Development',
};

/** Logo tile colours per family (brand-adjacent, dark-mode aware). */
const PROVIDER_TILES: Record<string, string> = {
  openai: 'bg-[#10A37F]/15 text-[#10A37F]',
  anthropic: 'bg-[#D97757]/15 text-[#D97757]',
  google: 'bg-[#4285F4]/15 text-[#4285F4]',
  deepseek: 'bg-[#4D6BFE]/15 text-[#4D6BFE]',
  openrouter: 'bg-[#7C3AED]/15 text-[#7C3AED]',
  ollama: 'bg-[#64748B]/15 text-[#64748B]',
  mock: 'bg-[#94A3B8]/15 text-[#64748B]',
};

const DEFAULT_TILE = 'bg-[#F1F5F9] text-[#64748B] dark:bg-[#334155] dark:text-[#E2E8F0]';

export interface ProviderIdentity {
  /** Family id from the platform registry (never typed by the user). */
  family: string;
  /** Readable provider name. */
  name: string;
  /** Who makes the AI. */
  vendor: string;
  /** One-character mark for the logo tile. */
  monogram: string;
  /** Tailwind classes for the logo tile. */
  tile: string;
}

/**
 * Build the user-facing identity of a provider from the registry name (when
 * the catalog supplied one) plus the shared preset table. Pure and total —
 * every input yields a renderable identity.
 */
export function providerIdentity(family: string, registryName?: string): ProviderIdentity {
  const preset = providerPreset(family);
  const shortName = PROVIDER_SHORT_NAMES[family];
  // First non-blank candidate wins: presentation alias → registry name →
  // preset display name. A provider is never rendered without a name.
  const name =
    [shortName, registryName, preset.displayName].find(
      (candidate) => (candidate ?? '').trim() !== '',
    ) ?? preset.displayName;
  const vendor = PROVIDER_VENDORS[family] ?? 'Custom endpoint';
  const monogram = name.trim().charAt(0).toUpperCase();
  return {
    family,
    name: name.trim(),
    vendor,
    monogram: monogram === '' ? '?' : monogram,
    tile: PROVIDER_TILES[family] ?? DEFAULT_TILE,
  };
}

/** True when VedMoulya knows this family's configuration preset. */
export function isBuiltInProvider(family: string): boolean {
  return isSimpleProviderPreset(family) && providerPreset(family).simpleModeSupported;
}

/**
 * PROVIDER-UX (Ollama) — which configuration experience a provider's
 * Configure/Add-AI step must open.
 *
 * A LOCAL provider (no credential, models read from a locally running server)
 * needs the auto-detect flow in SimpleProviderConfig; the cloud-oriented
 * ProviderConfigScreen cannot discover local models. Everything else keeps the
 * ProviderConfigScreen experience the built-in cloud providers already use.
 * Pure and total, so the routing decision is unit-testable without rendering
 * the whole page. It lives here (not in page.tsx) because a Next.js page module
 * may only export its page fields.
 */
export function configureExperienceFor(family: string): 'simple-local' | 'config-screen' {
  return providerPreset(family).credentialType === 'none_local' ? 'simple-local' : 'config-screen';
}

/**
 * OAuth availability. The ONLY provider OAuth in this codebase is the Google
 * identity authorization (services/identity — consumed through the existing
 * `beginGoogleSignIn` session manager). No other provider OAuth exists, so the
 * UI must never pretend one does.
 */
export function supportsOAuth(family: string): boolean {
  return family === 'google';
}

// ── Connection status (one vocabulary for the whole experience) ─────────────

export type ConnectionKey = 'connected' | 'issue' | 'not_connected';

export interface ConnectionDisplay {
  key: ConnectionKey;
  /** ✓ Connected / ⚠ Connection issue / ○ Not connected */
  label: string;
  symbol: string;
  /** Tailwind text colour class. */
  tone: string;
  /** Optional one-line explanation (never a raw technical error). */
  hint?: string;
}

export interface ProviderStatusDisplay {
  connection: ConnectionDisplay;
  /**
   * True when the provider is genuinely configured (a runtime key exists or
   * the deterministic dev/test mock is active). A provider that cannot operate
   * can never be marked active or enabled from the UI.
   */
  configured: boolean;
}

/**
 * Map the runtime-truth status (the SAME registry the config layer,
 * production validator and registration use) onto the calm connection
 * vocabulary. PROVIDER-01: this is now a pure PROJECTION of the single
 * provider lifecycle (`provider-state.ts`) — it derives nothing of its own, so
 * `configured` and the connection chip cannot contradict the provider card or
 * the readiness indicator. Only the SHAPE is local to this module;
 * operator-facing runtime reasons (env key names, adapter internals) are never
 * shown to the user because the canonical hints never contain them.
 */
export function providerStatusDisplay(
  runtimeStatus: string | undefined,
  providerName: string,
  /**
   * The user's enable preference. Passing it keeps this display honest: a
   * configured-but-disabled provider is NOT "Connected" (PROVIDER-01 —
   * configured ≠ connected ≠ enabled ≠ ready). Defaults to `true` for call
   * sites that only hold a status snapshot.
   */
  enabled = true,
  /** Optional outcome of the last REAL verification for this provider. */
  lastVerification?: { ok: boolean; failureKind?: string },
): ProviderStatusDisplay {
  const state = deriveProviderState({ runtimeStatus, enabled, lastVerification });
  const configured = state.runtimeConfigured;
  // The REASON always comes from the canonical lifecycle, so the connection
  // chip, the readiness indicator and the provider card can never disagree
  // about why a provider is unusable. The provider name is only needed for a
  // state that carries no message of its own (guaranteed total fallback).
  const issueHint = state.hint.trim() === '' ? `Couldn't connect to ${providerName}.` : state.hint;

  if (state.ready) {
    return {
      connection: {
        key: 'connected',
        label: 'Connected',
        symbol: '✓',
        tone: 'text-emerald-600 dark:text-emerald-400',
        hint: state.hint,
      },
      configured,
    };
  }
  if (state.lifecycle === 'DEGRADED' || state.lifecycle === 'FAILED') {
    // Two honest flavours of trouble: reachability (retry helps) vs a rejected
    // credential (the user must reconnect). Raw technical text is never shown.
    return {
      connection: {
        key: 'issue',
        // One calm label for both flavours; the canonical lifecycle state
        // (and its hint) carries the distinction between "couldn't reach it"
        // and "the credential was rejected".
        label: 'Connection issue',
        symbol: '⚠',
        tone: 'text-amber-600 dark:text-amber-400',
        hint: issueHint,
      },
      configured,
    };
  }
  if (state.lifecycle === 'CONFIGURING' || state.lifecycle === 'VERIFYING') {
    return {
      connection: {
        key: 'not_connected',
        label: state.label,
        symbol: state.symbol,
        tone: state.tone,
        hint: state.hint,
      },
      configured,
    };
  }
  return {
    connection: {
      key: 'not_connected',
      label: 'Not connected',
      symbol: '○',
      // #64748B on white is 4.76:1 (WCAG AA); the darker slate tint failed it.
      tone: 'text-[#64748B] dark:text-[#94A3B8]',
      // The canonical lifecycle owns every not-connected wording (missing
      // credential, catalog-only, not-registered) — this module no longer
      // keeps a second copy of that vocabulary.
      hint: state.hint,
    },
    configured,
  };
}

/** A provider is ACTIVE only when it operates AND the user switched it on. */
export function isProviderActive(enabled: boolean, status: ProviderStatusDisplay): boolean {
  return enabled && status.configured;
}

// ── Capability sentences (auto-detected, read-only) ─────────────────────────

/**
 * Plain-language capability sentences, ordered by how people think about an
 * AI assistant. Accepts BOTH raw capability ids from the provider catalog
 * (reasoning, general_conversation, …) and the display labels the experience
 * view model uses (Reasoning, Chat, Vision, …). Unknown values are shown
 * verbatim rather than dropped.
 */
const CAPABILITY_PHRASES: ReadonlyArray<readonly [readonly string[], string]> = [
  [['reasoning'], 'Thinking & reasoning'],
  [['general_conversation', 'chat'], 'Conversations'],
  [['vision', 'image_understanding'], 'Understanding images'],
  [['content_generation', 'creative_writing', 'generation'], 'Creating content'],
  [['tools', 'function_calling', 'tool_use'], 'Tool use'],
  [['coding'], 'Writing & reviewing code'],
  [['summarization', 'summarisation'], 'Summarising documents'],
  [['translation'], 'Translation'],
  [['speech', 'audio'], 'Speech & audio'],
  [['embeddings'], 'Search & memory'],
  [['classification'], 'Classifying information'],
];

/** Upper bound on the capability list — a calm summary, not a spec sheet. */
export const MAX_CAPABILITY_PHRASES = 6;

export function capabilityPhrases(capabilities: readonly string[]): string[] {
  const values = capabilities.map((cap) => cap.trim()).filter((cap) => cap !== '');
  const lowered = values.map((cap) => cap.toLowerCase());
  const phrases: string[] = [];
  for (const [aliases, phrase] of CAPABILITY_PHRASES) {
    if (lowered.some((cap) => aliases.includes(cap)) && !phrases.includes(phrase)) {
      phrases.push(phrase);
    }
  }
  for (const [index, cap] of values.entries()) {
    const known = CAPABILITY_PHRASES.some(([aliases]) => aliases.includes(lowered[index] ?? ''));
    if (!known && !phrases.includes(cap)) phrases.push(cap);
  }
  return phrases.slice(0, MAX_CAPABILITY_PHRASES);
}

// ── Friendly failures ───────────────────────────────────────────────────────

export interface FriendlyError {
  /** "Couldn't connect to Gemini." */
  title: string;
  /** Optional actionable hint. */
  hint?: string;
}

const ERROR_HINTS: Record<string, string> = {
  invalid_api_key: 'Check your API key and try again.',
  unauthorized: "This credential isn't authorised for this AI. Check your API key and try again.",
  unreachable: 'The AI could not be reached. Check your connection and try again.',
  rate_limited: 'The AI is busy right now. Wait a moment and try again.',
  unavailable: 'The AI is temporarily unavailable. Try again shortly.',
  not_found: 'The AI did not recognise this request. Check your API key and try again.',
  bad_request: 'Something about that request was not accepted. Check your API key and try again.',
  no_credential: 'No credential was provided. Enter your API key and try again.',
};

/**
 * Convert a provider failure into a friendly, actionable message. Raw
 * technical text is never surfaced: only the classified error kind is used,
 * and unknown kinds get the generic retry guidance.
 */
export function friendlyConnectionError(providerName: string, errorKind?: string): FriendlyError {
  const hint =
    (errorKind ? ERROR_HINTS[errorKind] : undefined) ?? 'Check your API key and try again.';
  return { title: `Couldn't connect to ${providerName}.`, hint };
}

// ── Model selection vocabulary ──────────────────────────────────────────────

/**
 * Automatic model selection is offered when the AI genuinely offers a choice
 * (more than one model is known). With a single model the UI selects it and
 * removes the interaction entirely.
 */
export function supportsAutomaticModel(modelCount: number): boolean {
  return modelCount > 1;
}

/**
 * Short model subtitle built from REAL capability data (never marketing
 * copy): "Thinking & reasoning · Understanding images".
 */
export function modelSubtitle(capabilities: readonly string[]): string | undefined {
  const phrases = capabilityPhrases(capabilities).slice(0, 2);
  return phrases.length > 0 ? phrases.join(' · ') : undefined;
}
