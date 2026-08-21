// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Provider Runtime Registry (EPIC-019)
//
// SINGLE SOURCE OF TRUTH for "provider state" so the configuration layer
// (getConfig), the startup diagnostics (PreflightEngine, npm run doctor), the
// gateway production validator (validateProductionAIConfig), the runtime
// registration (registerPlatformProviders) and the UI agree on the truth:
//
//   Catalog evidence ≠ runtime capability.  A family may exist in the provider
//   catalog/registry (packages/providers) without a runnable ProviderAdapter.
//
//   Configuration ≠ availability.  An env key only CONFIGURES a provider when
//   a runtime adapter exists for it in this repository.
//
//   Availability ≠ execution.  A registered adapter is AVAILABLE; a successful
//   outcome is only ever claimed when live execution was actually attempted.
//
// This module is PURE (no I/O, no node builtins) so it stays testable and
// bundle-import safe. State is derived from a plain env record.
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic rule
   false-positive: every dynamic env access uses key NAMES from the closed
   PROVIDER_RUNTIME_DESCRIPTORS table or keys produced by `.find` over that
   same table — never attacker-controlled property names. */

export type ProviderRuntimeMode = 'development' | 'test' | 'staging' | 'production';

export type ProviderRuntimeStatus =
  | 'CONFIGURED' // adapter exists + key present + will be registered
  | 'AVAILABLE' // adapter exists + no key yet -> dormant
  | 'NOT_CONFIGURED' // adapter exists + key absent
  | 'UNSUPPORTED_RUNTIME' // taxonomy/catalog only — no adapter in this build
  | 'MOCK' // deterministic provider active (dev default or explicit prod opt-in)
  | 'DISABLED' // present but intentionally not registered (mock in production)
  | 'ERROR'; // configuration/resolution error (e.g. placeholder-length key)

export interface ProviderRuntimeState {
  family: string;
  name: string;
  status: ProviderRuntimeStatus;
  /** Static human-readable explanation (never contains secret values). */
  reason: string;
  /** Canonical env key NAMES that provision this provider. */
  envKeys: string[];
  /** A ProviderAdapter implementation exists in this repository. */
  adapterImplemented: boolean;
  /** registerPlatformProviders would register this family in this mode. */
  registered: boolean;
  /** The adapter can perform a model call (ignoring credentials/network). */
  canExecute: boolean;
  /** Free-tier available (self-hosted / explicit free plans). Never assumed. */
  freeTier: boolean;
  /** Eligible to be AI_DEFAULT_PROVIDER in this mode (runtime-truthful). */
  defaultEligible: boolean;
}

export interface ProviderRuntimeDescriptor {
  family: string;
  name: string;
  envKeys: readonly string[];
  /** Adapter module in services/orchestrator, or null for catalog-only families. */
  adapter: string | null;
  canExecute: boolean;
  freeTier: boolean;
  /** True when this family may be AI_DEFAULT_PROVIDER in production/staging. */
  defaultEligibleStrict: boolean;
}

/**
 * The runtime descriptor table. KEEP IN SYNC with
 * services/orchestrator/src/index.ts (registerPlatformProviders) — the
 * orchestrator test `provider runtime registry agrees with registration`
 * (services/orchestrator/src/__tests__/index.test.ts) enforces the contract.
 */
export const PROVIDER_RUNTIME_DESCRIPTORS: readonly ProviderRuntimeDescriptor[] = [
  {
    family: 'openai',
    name: 'OpenAI',
    envKeys: ['AI_OPENAI_API_KEY', 'OPENAI_API_KEY'],
    adapter:
      'VercelAIProvider (primary, Vercel AI SDK) / OpenAIProvider (raw-fetch, only with AI_RUNTIME_LEGACY_RAW_FETCH=true)',
    canExecute: true,
    freeTier: false,
    defaultEligibleStrict: true,
  },
  {
    family: 'deepseek',
    name: 'DeepSeek',
    envKeys: ['AI_DEEPSEEK_API_KEY'],
    adapter: 'DeepSeekProvider (Vercel AI SDK, OpenAI-compatible endpoint)',
    canExecute: true,
    freeTier: false,
    defaultEligibleStrict: true,
  },
  {
    family: 'anthropic',
    name: 'Anthropic (Claude)',
    envKeys: ['AI_ANTHROPIC_API_KEY'],
    adapter: null,
    canExecute: false,
    freeTier: false,
    defaultEligibleStrict: false,
  },
  {
    family: 'google',
    name: 'Google (Gemini)',
    envKeys: ['AI_GOOGLE_API_KEY'],
    adapter: 'GoogleGeminiProvider (Vercel AI SDK, @ai-sdk/google, generativelanguage API)',
    canExecute: true,
    freeTier: false,
    defaultEligibleStrict: true,
  },
  {
    family: 'openrouter',
    name: 'OpenRouter',
    envKeys: [],
    adapter: null,
    canExecute: false,
    freeTier: false,
    defaultEligibleStrict: false,
  },
  {
    family: 'ollama',
    name: 'Ollama (Local)',
    envKeys: [],
    // Provider Intelligence UI has local-model DISCOVERY; there is no
    // execution adapter (Ollama never receives a production model request).
    adapter: null,
    canExecute: false,
    freeTier: true,
    defaultEligibleStrict: false,
  },
  {
    family: 'mock',
    name: 'Mock (Deterministic)',
    envKeys: [],
    adapter: 'MockProvider',
    canExecute: true,
    freeTier: true,
    defaultEligibleStrict: false,
  },
];

export function isValueSet(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== '';
}

export function isStrictRuntimeMode(mode: ProviderRuntimeMode): boolean {
  return mode === 'production' || mode === 'staging';
}

/** Narrow any NODE_ENV string to the known runtime-mode union. */
export function toRuntimeMode(env: string): ProviderRuntimeMode {
  if (env === 'production' || env === 'staging' || env === 'test') {
    return env;
  }
  return 'development';
}

export interface ProviderRuntimeOptions {
  aiEnabled?: boolean;
}

export function readProviderRuntimeState(
  env: Record<string, string | undefined>,
  mode: ProviderRuntimeMode,
  options: ProviderRuntimeOptions = {},
): ProviderRuntimeState[] {
  const strict = isStrictRuntimeMode(mode);
  const aiEnabled = options.aiEnabled ?? env.FF_AI_ASSISTANT_ENABLED !== 'false';
  const mockExplicit = env.AI_ENABLE_MOCK === 'true';

  return PROVIDER_RUNTIME_DESCRIPTORS.map((desc) => {
    if (desc.family === 'mock') {
      // The mock is only ever active when AI itself is enabled — an AI-ops
      // disabled platform registers no provider at all (truthful).
      const active = aiEnabled && (!strict || mockExplicit);
      return {
        family: desc.family,
        name: desc.name,
        status: active ? 'MOCK' : 'DISABLED',
        reason: strict
          ? mockExplicit
            ? 'Explicit production opt-in (AI_ENABLE_MOCK=true) — the only way production may serve the deterministic mock.'
            : 'Not registered in production unless AI_ENABLE_MOCK=true (never silent).'
          : 'Automatically registered in development/test so every AI pipeline is exercisable without provider keys.',
        envKeys: [],
        adapterImplemented: true,
        registered: active,
        canExecute: desc.canExecute,
        freeTier: desc.freeTier,
        defaultEligible: false,
      };
    }
    return computeRealProviderState(desc, env);
  });
}

function computeRealProviderState(
  desc: ProviderRuntimeDescriptor,
  env: Record<string, string | undefined>,
): ProviderRuntimeState {
  const presentKey = desc.envKeys.find((k) => isValueSet(env[k]));

  if (desc.adapter === null) {
    return {
      family: desc.family,
      name: desc.name,
      status: 'UNSUPPORTED_RUNTIME',
      reason: presentKey
        ? `Taxonomy/catalog only — no runtime adapter exists, so ${presentKey} is never consumed by the AI runtime.`
        : 'Taxonomy/catalog only — no ProviderAdapter is implemented in this repository.',
      envKeys: [...desc.envKeys],
      adapterImplemented: false,
      registered: false,
      canExecute: false,
      freeTier: desc.freeTier,
      defaultEligible: false,
    };
  }

  if (presentKey === undefined) {
    return {
      family: desc.family,
      name: desc.name,
      status: 'NOT_CONFIGURED',
      reason: `No key set (${desc.envKeys.join(' / ')}) — the ${desc.family} adapter is dormant and will NOT be registered.`,
      envKeys: [...desc.envKeys],
      adapterImplemented: true,
      registered: false,
      canExecute: desc.canExecute,
      freeTier: desc.freeTier,
      defaultEligible: desc.defaultEligibleStrict,
    };
  }

  const value = env[presentKey] ?? '';
  if (value.trim().length < 32) {
    return {
      family: desc.family,
      name: desc.name,
      status: 'ERROR',
      reason: `${presentKey} is set but looks shorter than a real key (< 32 chars) — production fail-fast validation would reject it.`,
      envKeys: [...desc.envKeys],
      adapterImplemented: true,
      registered: false,
      canExecute: desc.canExecute,
      freeTier: desc.freeTier,
      defaultEligible: desc.defaultEligibleStrict,
    };
  }

  return {
    family: desc.family,
    name: desc.name,
    status: 'CONFIGURED',
    reason: `${presentKey} is set — ${desc.adapter} will be registered by registerPlatformProviders.`,
    envKeys: [...desc.envKeys],
    adapterImplemented: true,
    registered: true,
    canExecute: desc.canExecute,
    freeTier: desc.freeTier,
    defaultEligible: desc.defaultEligibleStrict,
  };
}

export interface RuntimeExecutionReadyResult {
  ok: boolean;
  /** Static reason (never secret values). */
  reason: string;
  /** Families that will actually be registered in this mode. */
  providers: string[];
}

/**
 * Can the platform actually execute an AI request in this mode?
 * - strict (production/staging): a CONFIGURED real provider, or the explicit
 *   production mock opt-in (AI_ENABLE_MOCK=true). NEVER a silent mock fallback.
 * - development/test: the deterministic mock is always capable.
 * AI disabled (FF_AI_ASSISTANT_ENABLED=false) is always considered ready.
 */
export function runtimeExecutionReady(
  env: Record<string, string | undefined>,
  mode: ProviderRuntimeMode,
  options: ProviderRuntimeOptions = {},
): RuntimeExecutionReadyResult {
  const aiEnabled = options.aiEnabled ?? env.FF_AI_ASSISTANT_ENABLED !== 'false';
  if (!aiEnabled) {
    return {
      ok: true,
      reason: 'AI assistant disabled (FF_AI_ASSISTANT_ENABLED=false) — no provider required.',
      providers: [],
    };
  }
  const states = readProviderRuntimeState(env, mode, { aiEnabled });
  const strict = isStrictRuntimeMode(mode);
  const real = states
    .filter((s) => s.status === 'CONFIGURED' && s.adapterImplemented)
    .map((s) => s.family);
  const mockState = states.find((s) => s.family === 'mock');
  const mockActive = mockState?.registered === true;

  if (real.length > 0) {
    return {
      ok: true,
      reason: `Runtime provider(s) configured and will be registered: ${real.join(', ')}.`,
      providers: real,
    };
  }
  if (mockActive) {
    return {
      ok: true,
      reason: strict
        ? 'Explicit production mock opt-in (AI_ENABLE_MOCK=true).'
        : 'Deterministic mock provider available for development/test.',
      providers: ['mock'],
    };
  }
  return {
    ok: false,
    reason: 'No runtime provider would be registered — this configuration is not executable.',
    providers: [],
  };
}

export type DefaultProviderValidation =
  { ok: true; family: string } | { ok: false; family: string; reason: string };

/**
 * Is the configured AI_DEFAULT_PROVIDER value truthful at runtime?
 * In production/staging a catalog-only family (anthropic/google/openrouter/
 * ollama) is REJECTED — the platform must never pretend it can execute a
 * provider that has no adapter. In development/test the check is advisory
 * (the mock still runs) but the state is reported honestly.
 */
export function validateDefaultProvider(
  env: Record<string, string | undefined>,
  mode: ProviderRuntimeMode,
): DefaultProviderValidation {
  const family = env.AI_DEFAULT_PROVIDER?.trim() || 'openai';
  const strict = isStrictRuntimeMode(mode);
  const desc = PROVIDER_RUNTIME_DESCRIPTORS.find((d) => d.family === family);

  if (!desc) {
    return {
      ok: false,
      family,
      reason: `AI_DEFAULT_PROVIDER="${family}" is not a known provider family. Choose openai or deepseek.`,
    };
  }
  if (desc.adapter === null) {
    return {
      ok: !strict,
      family,
      reason: `AI_DEFAULT_PROVIDER="${family}" exists only in the taxonomy/catalog — no runtime adapter is implemented. Choose openai or deepseek (or leave the default openai).`,
    };
  }
  if (desc.family === 'mock') {
    return strict
      ? {
          ok: false,
          family,
          reason:
            'AI_DEFAULT_PROVIDER="mock" must never be the production default — production never silently serves the mock.',
        }
      : { ok: true, family };
  }
  return { ok: true, family };
}
