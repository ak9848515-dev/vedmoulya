// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Production AI Configuration Validation
// AI-RUNTIME-002 C-07 — the AI EXECUTION configuration surface.
//
// CONTEXT-AWARE (auth decoupling): authentication and the gateway's service
// construction must NEVER be blocked solely because an AI provider credential
// is absent. This module therefore:
//   1. HARD-FAILS only on genuine AI misconfiguration (AI_DEFAULT_PROVIDER
//      naming a catalog-only family that has no runtime adapter);
//   2. REPORTS a truthful AI execution state (ok/errors) for missing optional
//      AI credentials and tuning — the service starts, authentication works,
//      and every AI-backed feature abstains/fails at runtime with the honest
//      "no provider configured" state. Production NEVER silently serves the
//      deterministic mock (registerPlatformProviders enforces that).
//
// It never reads secrets itself — it only checks presence/policy and lets the
// @vedmoulya/core secret validator enforce strength.
// ─────────────────────────────────────────────────────────────────────────────

import {
  EnvironmentError,
  readProviderRuntimeState,
  toRuntimeMode,
  validateDefaultProvider,
} from '@vedmoulya/core';

export interface ProductionAIConfigState {
  /** NODE_ENV evaluated (production / staging are strict). */
  env: string;
  /** OpenAI key present AND runtime-adapter supported (canonical/legacy). */
  openAiKeyPresent: boolean;
  /** DeepSeek key present AND runtime-adapter supported. */
  deepSeekKeyPresent: boolean;
  /** Google Gemini key present AND runtime-adapter supported (SPRINT-049). */
  googleKeyPresent: boolean;
  /** AI_DEFAULT_PROVIDER value (default 'openai'). */
  defaultProvider: string;
  /** AI_DEFAULT_PROVIDER names a family with a real adapter (EPIC-019). */
  defaultProviderSupported: boolean;
  /** Production/staging strictness applies. */
  strict: boolean;
  /** AI_ENABLE_MOCK — the only way production may use the deterministic mock. */
  mockExplicitlyEnabled: boolean;
  /** AI_RUNTIME_LEGACY_RAW_FETCH — opt-in raw-fetch provider path. */
  legacyRawFetchEnabled: boolean;
  /** RAG database URL present. */
  ragDatabaseUrlPresent: boolean;
  /** Token budget configured. */
  maxInputTokensConfigured: boolean;
  /** Max output tokens configured. */
  maxOutputTokensConfigured: boolean;
  /** Provider timeout configured. */
  providerTimeoutMsConfigured: boolean;
  /** Observability exporter endpoint configured (optional). */
  otelEndpointConfigured: boolean;
  /** Tool allowlist policy configured (empty = default deny-all). */
  toolAllowlistConfigured: boolean;
  /** Prompt cache configured (enabled by default). */
  promptCacheConfigured: boolean;
}

/** Snapshot the current AI runtime configuration state from the environment. */
export function readProductionAIConfigState(): ProductionAIConfigState {
  // NODE_ENV is narrowed to a development/test/production union by some
  // bundlers (Next.js) — widening to string keeps the staging check valid
  // in every build context.
  const env: string = process.env.NODE_ENV ?? 'development';
  const strict = env === 'production' || env === 'staging';
  const runtimeMode = toRuntimeMode(env);
  // EPIC-019 — the runtime registry is the SINGLE source of truth for whether
  // a provider is CONFIGURED (key present + adapter implemented). A catalog-only
  // family (e.g. a set AI_ANTHROPIC_API_KEY) never counts as an execution path.
  const states = readProviderRuntimeState(process.env, runtimeMode);
  const openAi = states.find((s) => s.family === 'openai');
  const deepSeek = states.find((s) => s.family === 'deepseek');
  const google = states.find((s) => s.family === 'google');
  const defaultProviderCheck = validateDefaultProvider(process.env, runtimeMode);
  return {
    env,
    strict,
    openAiKeyPresent: openAi?.status === 'CONFIGURED',
    deepSeekKeyPresent: deepSeek?.status === 'CONFIGURED',
    googleKeyPresent: google?.status === 'CONFIGURED',
    defaultProvider: (process.env.AI_DEFAULT_PROVIDER ?? 'openai').trim(),
    defaultProviderSupported: defaultProviderCheck.ok,
    mockExplicitlyEnabled: process.env.AI_ENABLE_MOCK === 'true',
    legacyRawFetchEnabled: process.env.AI_RUNTIME_LEGACY_RAW_FETCH === 'true',
    ragDatabaseUrlPresent: Boolean(
      process.env.IDENTITY_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim(),
    ),
    maxInputTokensConfigured: Boolean(process.env.AI_MAX_INPUT_TOKENS?.trim()),
    maxOutputTokensConfigured: Boolean(process.env.AI_MAX_OUTPUT_TOKENS?.trim()),
    providerTimeoutMsConfigured: Boolean(process.env.AI_PROVIDER_TIMEOUT_MS?.trim()),
    otelEndpointConfigured: Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim()),
    toolAllowlistConfigured: Boolean(process.env.AI_TOOL_ALLOWLIST?.trim()),
    promptCacheConfigured: process.env.AI_PROMPT_CACHE_ENABLED !== 'false',
  };
}

export interface ProductionAIValidationResult {
  ok: boolean;
  errors: string[];
}

/**
 * Context-aware validation of the production AI execution surface.
 *
 * HARD FAIL (throws EnvironmentError in production/staging):
 *   - AI_DEFAULT_PROVIDER names a catalog-only family (no runtime adapter).
 *     This is a genuine misconfiguration that would produce confusing runtime
 *     failures — it is never an auth prerequisite.
 *
 * ADVISORY (returned in `errors`, service still constructs — auth unaffected):
 *   - No AI provider key configured → AI execution NOT READY (truthful state).
 *   - Recommended token budgets / provider timeout / tool allowlist absent.
 *
 * Development/test never validates strictly (safe deterministic doubles).
 */
export function validateProductionAIConfig(): ProductionAIValidationResult {
  const state = readProductionAIConfigState();
  const errors: string[] = [];

  if (!state.strict) {
    return { ok: true, errors };
  }

  // 0. EPIC-019 — AI_DEFAULT_PROVIDER must name a family that actually has a
  //    runtime adapter. A catalog-only default (anthropic/openrouter/ollama)
  //    is a hard error: it would pass config validation and then fail at
  //    runtime with "no provider registered". This is the ONLY hard-fail —
  //    it is a misconfiguration, never a missing optional credential.
  if (!state.defaultProviderSupported) {
    errors.push(
      `AI_DEFAULT_PROVIDER="${state.defaultProvider}" is not available at runtime ` +
        '(catalog-only family — no ProviderAdapter exists). Choose AI_DEFAULT_PROVIDER=openai, deepseek or google.',
    );
    const err = new EnvironmentError(['AI configuration']);
    err.message = `Production AI configuration is invalid (fail-fast). ${errors.join(' ')}`;
    throw err;
  }

  // 1. AI provider credentials: OpenAI / Google Gemini / DeepSeek are the
  //    runtime execution paths. Absent keys mean AI execution is NOT READY —
  //    reported truthfully, NEVER blocking authentication or the AI Providers
  //    management screen. Production still never silently serves the mock
  //    (registerPlatformProviders enforces AI_ENABLE_MOCK=true explicitly).
  if (
    !state.openAiKeyPresent &&
    !state.deepSeekKeyPresent &&
    !state.googleKeyPresent &&
    !state.mockExplicitlyEnabled
  ) {
    errors.push(
      'No AI provider key is configured in production — AI execution is NOT READY. ' +
        'Set AI_OPENAI_API_KEY, AI_GOOGLE_API_KEY or AI_DEEPSEEK_API_KEY to enable AI execution. ' +
        'Authentication and account management remain fully available without it.',
    );
  }

  // 2. RAG database: production RAG runs against Postgres + pgvector. The
  //    shared gateway database URL is the RAG store (config.database.url).
  if (!state.ragDatabaseUrlPresent) {
    errors.push(
      'IDENTITY_DATABASE_URL (or DATABASE_URL) is required in production — the RAG vector store ' +
        'and every engine registry live in Postgres + pgvector.',
    );
  }

  // 3. Token budgets: hard input-token guard + output bound.
  if (!state.maxInputTokensConfigured) {
    errors.push('AI_MAX_INPUT_TOKENS is recommended in production (hard input-token budget).');
  }
  if (!state.maxOutputTokensConfigured) {
    errors.push('AI_MAX_OUTPUT_TOKENS is recommended in production (output bound).');
  }

  // 4. Provider timeout: bounded provider execution.
  if (!state.providerTimeoutMsConfigured) {
    errors.push(
      'AI_PROVIDER_TIMEOUT_MS is recommended in production (bounded provider execution).',
    );
  }

  // 5. Tool policy: secure tool runtime requires an explicit allowlist in
  //    production (empty allowlist = default deny-all — safe but explicit
  //    configuration is required for any tool to run).
  if (!state.toolAllowlistConfigured) {
    errors.push(
      'AI_TOOL_ALLOWLIST must be explicitly configured in production (e.g. "echo,current_time,calculator"). ' +
        'An unconfigured tool policy means tools are disabled by default.',
    );
  }

  return { ok: errors.length === 0, errors };
}
