// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Connection Tester & Model Discovery (FINAL-02)
//
// ONE family-aware, server-side connection test used by the friendly provider
// UX (Simple mode + first-login Gemini flow). For a credential the user
// supplies, it performs a REAL reachability/auth probe against the provider's
// own list endpoint and — on success — returns the ACTUAL models the provider
// reports (never invented ids) so the UI can populate the model dropdown.
//
// SECURITY CONTRACT:
//   - the API key is used for THIS request only; it is never persisted, never
//     logged, and never echoed back — every outgoing message is scrubbed.
//   - server-managed mode (Gemini) reads THIS deployment's AI_GOOGLE_API_KEY
//     (the same env key the runtime registers) and sends the key only to
//     Google; the response carries no secret material.
//   - failures are mapped to actionable, friendly messages (invalid key,
//     unreachable, rate limited, provider unavailable) — never raw stacks,
//     never credential material.
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from '@vedmoulya/core';
import { resolvePlatformCredential, type ProviderCredentialSource } from '@vedmoulya/providers';

// Google Gemini generativelanguage API (same host @ai-sdk/google uses).
const GOOGLE_GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com';
const OPENAI_ENDPOINT = 'https://api.openai.com/v1';
// Same constant DeepSeekProvider uses (api-docs.deepseek.com).
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com';
const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com';
// OpenRouter speaks the OpenAI chat-completions contract on its own base URL.
// Wired through the SHARED OpenAI-compatible path — no provider-specific branch.
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1';
// OpenRouter serves its model CATALOG anonymously (GET /models answers 200 for a
// missing, malformed or revoked key), so the catalog can never authenticate a
// credential. GET /key is the provider's documented credential endpoint: it
// returns the key's OWN record and answers 401 for an invalid key.
const OPENROUTER_KEY_ENDPOINT = `${OPENROUTER_ENDPOINT}/key`;
// Same default OllamaProvider/OllamaLocalModelDiscovery use.
const OLLAMA_DEFAULT_ENDPOINT = 'http://localhost:11434';

/**
 * Shared timeout budgets for the ONE connection pipeline.
 *
 * The generation validation always loads/answers on the chosen model, so a
 * LOCAL runtime pays a cold-start (model load) on the very first attempt —
 * measured at ~13s for a small Ollama model on a developer laptop. The old
 * single 10s budget therefore failed the FIRST connect of every local model and
 * misreported it as "the provider is not running". The probe is a cheap list
 * call and keeps a tight budget; the generation gets a real one. Both are
 * overridable (per call, or deployment-wide with AI_PROVIDER_TIMEOUT_MS).
 */
export const DEFAULT_PROBE_TIMEOUT_MS = 15_000;
export const DEFAULT_GENERATION_TIMEOUT_MS = 60_000;

/** Deployment-wide override (AI_PROVIDER_TIMEOUT_MS), when it is a positive number. */
function envTimeoutMs(env: Record<string, string | undefined>): number | undefined {
  const raw = env.AI_PROVIDER_TIMEOUT_MS?.trim();
  if (raw === undefined || raw === '') return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/** Families this tester can probe (openai-compatible = user-supplied endpoint). */
export type TestableProviderFamily =
  'google' | 'openai' | 'anthropic' | 'deepseek' | 'openrouter' | 'ollama' | 'openai-compatible';

/** Friendly failure taxonomy for the UI (rendered with a readable message). */
export type ProviderConnectionErrorKind =
  | 'invalid_api_key'
  | 'unauthorized'
  | 'unreachable'
  | 'rate_limited'
  /**
   * BUGFIX (quota vs. throttle) — the provider answered 429 because this
   * ACCOUNT CANNOT PAY (its own error envelope says so), not because it is
   * busy. The status code alone cannot tell the two apart, which is why an
   * out-of-credit account used to be classified as `rate_limited` and the UI
   * told the user to “try again” — an action that can never succeed until the
   * account is funded. Separated so the surfaces can say what is really wrong.
   */
  | 'quota_exhausted'
  | 'unavailable'
  | 'not_found'
  | 'bad_request'
  | 'no_credential'
  /**
   * G9 — the provider IS reachable from the server, but a browser on this
   * machine cannot reach it (the local runtime's browser-origin policy). This
   * is an implementation detail of local runtimes: the user is told what is
   * true ("VedMoulya can see Ollama, browser access is blocked") and given ONE
   * recovery instruction — never asked to configure networking.
   */
  | 'browser_origin_blocked'
  /**
   * BUGFIX (Ollama honesty) — connected, but the local runtime reports NO
   * installed models. This is emphatically NOT "not installed": the server
   * answered, so it exists. The user needs to pull a model, not reinstall.
   */
  | 'no_models'
  /**
   * BUGFIX (Ollama honesty) — the model the setup selected is not among the
   * models the runtime actually serves (removed/renamed since selection).
   */
  | 'model_unavailable';

export interface DiscoveredProviderModel {
  /** The provider's real model id (e.g. "models/gemini-2.5-flash" → id). */
  id: string;
  /** Human name when the provider reports one; falls back to the id. */
  name: string;
}

/**
 * G9 — the outcome of a LIGHTWEIGHT real generation check performed after
 * discovery (step 5 of the one-click flow: "does this provider actually
 * answer?"). It is deliberately tiny (a one-token prompt) so setup stays fast
 * and cheap, and it is only ever attempted on a provider that already
 * authenticated — never to discover.
 */
export interface ProviderGenerationValidation {
  /** True when the provider produced a real completion. */
  ok: boolean;
  /** The model that answered (the chosen default). */
  modelId: string;
  /** Measured round-trip of the generation call. */
  latencyMs: number;
  /** Friendly, redacted failure message when ok is false. */
  message?: string;
  /** Classified failure kind when ok is false. */
  errorKind?: ProviderConnectionErrorKind;
}

export interface ProviderConnectionTestResult {
  connected: boolean;
  status: 'connected' | 'failed';
  message: string;
  errorKind?: ProviderConnectionErrorKind;
  /**
   * WHICH credential authenticated the probe: the user's, this deployment's,
   * or none (PROVIDER-01 Decision 4). The caller always learns the source; the
   * secret itself is never returned.
   */
  credentialSource: ProviderCredentialSource;
  /** Measured round-trip of the probe. */
  latencyMs?: number;
  /** Number of models the provider actually reported. */
  modelCount?: number;
  /** The provider's real models (population for the Simple-mode dropdown). */
  models?: DiscoveredProviderModel[];
  testedAt: string;
  /** True when the probe used THIS deployment's server-managed key. */
  serverManagedKey: boolean;
  /** Whether the AI runtime currently has this family's credential (env). */
  runtimeConfigured: boolean;
  /** Honest runtime explanation (never a secret). */
  runtimeNote?: string;
}

/**
 * PROD-DIAG — WHERE the generation validation failed, with enough resolution to
 * tell the four production conditions apart. This exists because the friendly
 * taxonomy collapses several distinct provider conditions into one UI-facing
 * `errorKind` ('unavailable' covers BOTH an HTTP 5xx AND an HTTP 200 whose body
 * carried no usable answer), which made a live Gemini setup failure
 * indistinguishable in production logs.
 *
 * It is a DIAGNOSTIC-ONLY dimension: it is reported through the structured
 * logger and never through the user-facing message, so no screen changes
 * behaviour and no provider appears connected that was not really validated.
 */
export type GenerationDiagnosticClassification =
  /** The provider answered with a usable completion — the ONLY success path. */
  | 'generation_success'
  /** A non-2xx HTTP status from the provider (401/403/429/5xx/other). */
  | 'generation_http_error'
  /** HTTP 2xx, but the body carried no usable candidate — the provider's `ok`
   *  status is NOT the same thing as the provider answering. */
  | 'generation_empty_response'
  /** The request never completed (timeout / DNS / TLS / connection refused). */
  | 'generation_network_error'
  /** No model to validate, so no request was issued at all. */
  | 'generation_not_attempted';

/**
 * PROD-DIAG — the safe, credential-free metadata captured for ONE generation
 * validation attempt.
 *
 * SECURITY CONTRACT (this is why the shape is read-only and narrow):
 *   • NEVER carries an API key, Authorization header, cookie or token.
 *   • NEVER carries the request body, the prompt, or the provider's response
 *     body — only the BOOLEANS about whether a candidate/content part existed
 *     and the character COUNT of the answer text.
 *   • `providerStatusReason` is populated only from an allow-listed set of
 *     provider status tokens (see `safeProviderStatusReason`), never from free
 *     text that could echo an echoed credential.
 *   • It is never returned to the browser; it goes to server-side logs only.
 */
export interface GenerationValidationDiagnostic {
  /** Provider family the validation ran against (e.g. 'google'). */
  providerFamily: TestableProviderFamily;
  /** Pipeline stage — always the validation stage. */
  stage: 'validate';
  /** The model id the validation was attempted on (never invented). */
  modelId: string;
  classification: GenerationDiagnosticClassification;
  /** HTTP status when a response was received at all. */
  httpStatus?: number;
  /** The EXISTING user-facing classification, so both views line up. */
  errorKind?: ProviderConnectionErrorKind;
  /** Measured round-trip of the attempt. */
  latencyMs: number;
  /** True when no credential could be resolved for the request. */
  noCredential?: boolean;
  /** True when the provider's body contained a candidates/choices/content array. */
  candidatePresent?: boolean;
  /** True when a usable text part was present inside that candidate. */
  contentPartPresent?: boolean;
  /** Character count of the answer text — never the text itself. */
  answerLength?: number;
  /** Allow-listed provider status token (e.g. 'UNAVAILABLE'), never raw text. */
  providerStatusReason?: string;
  /**
   * The platform error NAME for a network/timeout failure ('AbortError',
   * 'TimeoutError', 'TypeError'). A fixed platform identifier — never provider
   * text and never the error message.
   */
  networkErrorName?: string;
}

export interface TestProviderConnectionInput {
  family: TestableProviderFamily;
  /** User-supplied key — used for THIS probe only, never stored or logged. */
  apiKey?: string;
  /**
   * An ALREADY-RESOLVED credential (user credential first, then the platform
   * one) from the server-side credential service. When present it wins over
   * `apiKey`/env resolution so the probe cannot pick a different source than
   * the resolver decided — the secret still never leaves the server.
   */
  credential?: { source: Exclude<ProviderCredentialSource, 'NONE'>; secret: string };
  /** User-supplied endpoint (ollama / openai-compatible). */
  endpointUrl?: string;
  /** Test doubles only. */
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  /** Env source (tests inject; production = process.env). */
  env?: Record<string, string | undefined>;
  /**
   * PROD-DIAG — optional diagnostic reporter for the generation validation.
   * Omitted in production ⇒ the structured logger. A caller that needs the
   * classification elsewhere (or a test) can inject its own sink; the sink only
   * ever receives the credential-free record described above.
   */
  onDiagnostic?: GenerationDiagnosticSink;
}

/**
 * PROD-DIAG — where a generation-validation diagnostic is reported.
 *
 * Defaults to the repository's structured logger (a JSON line in Vercel logs).
 * Tests inject a capture function to assert the exact payload — including the
 * proof that no credential material is present — without spying on the logger.
 */
export type GenerationDiagnosticSink = (diagnostic: GenerationValidationDiagnostic) => void;

/**
 * PROD-DIAG — emit ONE structured diagnostic record through the caller's sink.
 *
 * The sink defaults to the repository's structured logger, so production
 * (Vercel) gets a JSON line without any new logging dependency, while tests
 * inject a capture function and assert the exact payload. The record contains
 * only allow-listed scalar metadata — there is no code path here that can
 * receive a key, a header, the request body or the response body.
 */
function emitGenerationDiagnostic(
  sink: GenerationDiagnosticSink | undefined,
  diagnostic: GenerationValidationDiagnostic,
): void {
  if (sink) {
    sink(diagnostic);
    return;
  }
  const { classification, ...context } = diagnostic;
  // Failures are warn (they are the interesting production signal); a success is
  // info so it stays visible without looking like an incident.
  if (classification === 'generation_success') {
    logger.info('[provider-setup] generation validation succeeded', { classification, ...context });
    return;
  }
  logger.warn('[provider-setup] generation validation failed', { classification, ...context });
}

// __TESTER_TAIL__

/** Defensive scrub — a credential must never reach a user-facing message.
 * Only keys of plausible credential length are scrubbed: scrubbing a
 * trivially-short string (e.g. "k") would mangle the friendly message by
 * replacing every matching character ("Invalid API [redacted]ey").
 * Provider messages are fixed strings that never contain the key anyway —
 * this is defence in depth against error text that echoes input. */
function redactKey(message: string, key: string | undefined): string {
  if (!key || key.length < 8) return message;
  return message.split(key).join('[redacted]');
}

/**
 * PROD-DIAG — allow-listed provider status/reason tokens that are safe to log.
 *
 * The provider's error `status` string is a short, machine-readable enum
 * (Google's `google.rpc.Status` codes, or an OpenAI/Anthropic `error.type`).
 * Only tokens on this list are ever emitted; anything else is dropped rather
 * than logged, so an unexpected value can never smuggle credential material or
 * free-form provider text into production logs.
 */
const SAFE_PROVIDER_STATUS_REASONS: readonly string[] = [
  'INVALID_ARGUMENT',
  'FAILED_PRECONDITION',
  'PERMISSION_DENIED',
  'NOT_FOUND',
  'UNAUTHENTICATED',
  'RESOURCE_EXHAUSTED',
  'INTERNAL',
  'UNAVAILABLE',
  'DEADLINE_EXCEEDED',
  'ABORTED',
  'OUT_OF_RANGE',
  'CANCELLED',
  'UNKNOWN',
  'invalid_request_error',
  'authentication_error',
  'permission_error',
  'not_found_error',
  'rate_limit_error',
  // Funding signals — a 429 whose body names the ACCOUNT's balance rather than
  // a throttle. Allow-listed so the diagnostic log can name the real cause:
  // these tokens were previously dropped, which is exactly why an out-of-credit
  // account was indistinguishable from a transient rate limit in production.
  'insufficient_quota',
  'credit_balance_exhausted',
  'api_error',
  'overloaded_error',
  'timeout_error',
];

/**
 * 429 error tokens that mean "this account cannot pay", as opposed to "slow
 * down and retry". Only these two readings of a 429 exist, and only the
 * provider's own allow-listed token can separate them.
 */
const QUOTA_EXHAUSTED_STATUS_REASONS: ReadonlySet<string> = new Set([
  'insufficient_quota',
  'credit_balance_exhausted',
]);

/**
 * PROD-DIAG — extract a provider status token if (and only if) it is on the
 * allow-list. The value is read from the parsed error envelope ONLY; the raw
 * response text is never touched, and a non-allow-listed value returns
 * `undefined` instead of being logged.
 */
export function safeProviderStatusReason(body: unknown): string | undefined {
  if (body === null || typeof body !== 'object') return undefined;
  const error = (body as { error?: unknown }).error;
  if (error === null || typeof error !== 'object') return undefined;
  const record = error as { status?: unknown; type?: unknown; code?: unknown };
  // Google spells it `status`; OpenAI/Anthropic spell it `type`. `code` is a
  // number in both APIs, so it only matches when it is a literal token.
  const candidates = [record.status, record.type, record.code];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (SAFE_PROVIDER_STATUS_REASONS.includes(trimmed)) return trimmed;
  }
  return undefined;
}

/**
 * PROD-DIAG — character count of the model's answer text (0 when absent).
 * Only the LENGTH is ever reported; the text itself stays in memory.
 *
 * It reads the SAME fields the family's parse function reads (via the shared
 * `firstMessagePart` reader, which accepts both Anthropic's flat `content`
 * array and Gemini's nested `candidate.content.parts`), so the count can never
 * describe a payload the parser did not look at.
 */
export function generationAnswerLength(body: unknown, family: TestableProviderFamily): number {
  if (family === 'ollama') {
    const message = (body as { message?: { content?: unknown } }).message;
    return typeof message?.content === 'string' ? message.content.trim().length : 0;
  }
  if (
    family === 'openai' ||
    family === 'deepseek' ||
    family === 'openrouter' ||
    family === 'openai-compatible'
  ) {
    const choices = (body as { choices?: Array<Record<string, unknown>> }).choices;
    const first = choices?.[0];
    const message = first ? (first as { message?: { content?: unknown } }).message : undefined;
    return typeof message?.content === 'string' ? message.content.trim().length : 0;
  }
  if (family === 'anthropic') {
    // Anthropic answers with the parts array directly on the body.
    return firstMessagePart(body).trim().length;
  }
  // Google: the parts live on the FIRST candidate, so that candidate is the
  // value the shared reader expects (passing the whole body would always read
  // as empty and misreport every Gemini answer as zero-length).
  const candidates = (body as { candidates?: unknown[] }).candidates;
  const first = Array.isArray(candidates) ? candidates[0] : undefined;
  return first === undefined ? 0 : firstMessagePart(first).trim().length;
}

/**
 * PROD-DIAG — whether the parsed body contained ANY candidate/choice container
 * at all, WITHOUT reading its content. This separates two very different
 * HTTP 200 conditions that the UI cannot tell apart:
 *   • `candidatePresent: false` → the provider returned no candidate array
 *     (e.g. Gemini answered with a `promptFeedback` block and no candidates,
 *     or a safety/blocked response);
 *   • `candidatePresent: true, contentPartPresent: false` → a candidate came
 *     back but carried no usable text part.
 */
export function hasGenerationCandidate(body: unknown, family: TestableProviderFamily): boolean {
  if (family === 'ollama') {
    const message = (body as { message?: unknown }).message;
    return message !== null && typeof message === 'object';
  }
  if (
    family === 'openai' ||
    family === 'deepseek' ||
    family === 'openrouter' ||
    family === 'openai-compatible'
  ) {
    const choices = (body as { choices?: unknown }).choices;
    return Array.isArray(choices) && choices.length > 0;
  }
  // google + anthropic both report an array of content containers.
  const containers =
    family === 'anthropic'
      ? (body as { content?: unknown }).content
      : (body as { candidates?: unknown }).candidates;
  return Array.isArray(containers) && containers.length > 0;
}

/**
 * PROD-DIAG — read the provider's error status token from a NON-OK response.
 *
 * The response is consumed through `clone().text()` so the ORIGINAL response
 * stays unread (the caller may still need it) and the raw text is parsed into an
 * object and immediately discarded. Failure to read/parse yields `undefined`:
 * a diagnostic must never throw and must never turn a provider error into a
 * different error. The text is never logged and never returned.
 */
async function readSafeProviderStatusReason(response: Response): Promise<string | undefined> {
  try {
    const text = await response.clone().text();
    if (text.trim() === '') return undefined;
    return safeProviderStatusReason(JSON.parse(text));
  } catch {
    // Unreadable/oversized/non-JSON error body — nothing safe to report.
    return undefined;
  }
}

function mapHttpFailure(
  status: number,
  statusText: string,
  /**
   * The provider's own allow-listed error token, when one was read from a
   * non-OK body (see `readSafeProviderStatusReason`). Optional so every call
   * site that has no body keeps the previous behaviour EXACTLY.
   */
  providerStatusReason?: string,
): {
  message: string;
  errorKind: ProviderConnectionErrorKind;
} {
  if (status === 401 || status === 403) {
    return {
      message:
        'Invalid API key — the provider rejected this credential. Check the key and try again.',
      errorKind: 'invalid_api_key',
    };
  }
  if (status === 404) {
    return { message: 'Endpoint not found — verify the server URL.', errorKind: 'not_found' };
  }
  if (status === 429) {
    // A 429 has TWO meanings and the status code cannot tell them apart: a
    // THROTTLE clears on its own, an exhausted balance never does. Reporting
    // both as rate-limited is what made an out-of-credit OpenAI account read as
    // a temporary outage with a futile retry, so the provider's own error token
    // (and nothing else) decides which one this is.
    if (
      providerStatusReason !== undefined &&
      QUOTA_EXHAUSTED_STATUS_REASONS.has(providerStatusReason)
    ) {
      return {
        message:
          'This provider account has no remaining credits — add credits to the account, then try again.',
        errorKind: 'quota_exhausted',
      };
    }
    return {
      message: 'Rate limit or quota exceeded — wait a moment and try again.',
      errorKind: 'rate_limited',
    };
  }
  if (status >= 500) {
    return {
      message: `Provider temporarily unavailable (HTTP ${status}) — try again shortly.`,
      errorKind: 'unavailable',
    };
  }
  if (status === 400) {
    return {
      message: 'The provider rejected the request as malformed (HTTP 400).',
      errorKind: 'bad_request',
    };
  }
  return {
    message: `Request rejected by the provider (HTTP ${status} ${statusText}).`,
    errorKind: 'unauthorized',
  };
}

function mapNetworkError(
  error: unknown,
  timeoutMs: number,
): {
  message: string;
  errorKind: ProviderConnectionErrorKind;
} {
  const timedOut =
    error instanceof Error &&
    (error.name === 'AbortError' ||
      error.name === 'TimeoutError' ||
      /timeout/i.test(error.message));
  if (timedOut) {
    return {
      message: `Connection timed out after ${Math.round(timeoutMs / 1000)}s — the provider may be slow or unreachable.`,
      errorKind: 'unreachable',
    };
  }
  return {
    message: 'Endpoint unreachable — check the URL and your network connection.',
    errorKind: 'unreachable',
  };
}

/** Runtime truth per family: does THIS deployment have the credential set? */
function runtimeStateFor(
  family: TestableProviderFamily,
  env: Record<string, string | undefined>,
): { runtimeConfigured: boolean; runtimeNote?: string } {
  // Read the environment ONCE into the set of names that really carry a value,
  // then answer from that set. A keyed member access on the environment would
  // let a name resolve an inherited `Object.prototype` member as "configured",
  // and it is exactly the shape the object-injection heuristic flags — so the
  // entries are folded through a Set instead: only OWN enumerable env names
  // that hold a non-blank string can ever report as configured.
  const configuredNames = new Set(
    Object.entries(env)
      .filter(([, value]) => typeof value === 'string' && value.trim() !== '')
      .map(([name]) => name),
  );
  // Credential families answer through the ONE shared env-key table, so the
  // tester, the runtime registry and the credential resolver cannot disagree.
  const hasPlatformKey = resolvePlatformCredential(family, env) !== undefined;
  switch (family) {
    case 'google':
      return {
        runtimeConfigured: hasPlatformKey,
        runtimeNote: hasPlatformKey
          ? 'This deployment has a server-managed Gemini credential (AI_GOOGLE_API_KEY) — AI execution is live.'
          : 'No Gemini credential is configured for this deployment — set AI_GOOGLE_API_KEY server-side to activate AI execution.',
      };
    case 'openai':
      return {
        runtimeConfigured: hasPlatformKey,
        runtimeNote: hasPlatformKey
          ? 'This deployment has a server-managed OpenAI credential — AI execution is live.'
          : 'No OpenAI credential is configured for this deployment — set AI_OPENAI_API_KEY server-side to activate AI execution.',
      };
    case 'deepseek':
      return {
        runtimeConfigured: hasPlatformKey,
        runtimeNote: hasPlatformKey
          ? 'This deployment has a server-managed DeepSeek credential — AI execution is live.'
          : 'No DeepSeek credential is configured for this deployment — set AI_DEEPSEEK_API_KEY server-side to activate AI execution.',
      };
    case 'openrouter':
      return {
        runtimeConfigured: hasPlatformKey,
        runtimeNote: hasPlatformKey
          ? 'This deployment has a server-managed OpenRouter credential (AI_OPENROUTER_API_KEY) — AI execution is live.'
          : 'No OpenRouter credential is configured for this deployment — paste your OpenRouter key, or set AI_OPENROUTER_API_KEY server-side.',
      };
    case 'ollama':
      return {
        runtimeConfigured: configuredNames.has('AI_OLLAMA_BASE_URL'),
        runtimeNote: configuredNames.has('AI_OLLAMA_BASE_URL')
          ? 'This deployment registers Ollama for AI execution (AI_OLLAMA_BASE_URL).'
          : 'Ollama is not registered for execution on this deployment — set AI_OLLAMA_BASE_URL server-side to activate it.',
      };
    case 'anthropic':
      return {
        runtimeConfigured: false,
        runtimeNote:
          'This VedMoulya build has no Anthropic execution adapter — the connection can be verified but not executed yet.',
      };
    case 'openai-compatible':
      return { runtimeConfigured: false };
  }
}

/** Gemini ListModels → real model ids (generateContent-capable). */
function parseGeminiModels(body: unknown): DiscoveredProviderModel[] {
  const models = (body as { models?: Array<Record<string, unknown>> }).models ?? [];
  return models
    .filter(
      (m) =>
        !Array.isArray(m.supportedGenerationMethods) ||
        (m.supportedGenerationMethods as string[]).includes('generateContent'),
    )
    .map((m) => {
      const raw = typeof m.name === 'string' ? m.name : '';
      const id = raw.startsWith('models/') ? raw.slice('models/'.length) : raw;
      const display = typeof m.displayName === 'string' ? m.displayName : '';
      return { id, name: display || id };
    })
    .filter((m) => m.id !== '');
}

/** OpenAI-style list → real model ids. */
function parseOpenAIModels(body: unknown): DiscoveredProviderModel[] {
  const data = (body as { data?: Array<Record<string, unknown>> }).data ?? [];
  return data
    .map((m) => (typeof m.id === 'string' ? { id: m.id, name: m.id } : null))
    .filter((m): m is DiscoveredProviderModel => m !== null);
}

/** Anthropic list → real model ids (display_name when present). */
function parseAnthropicModels(body: unknown): DiscoveredProviderModel[] {
  const data = (body as { data?: Array<Record<string, unknown>> }).data ?? [];
  return data
    .map((m) => {
      const id = typeof m.id === 'string' ? m.id : '';
      const display = typeof m.display_name === 'string' ? m.display_name : '';
      return { id, name: display || id };
    })
    .filter((m) => m.id !== '');
}

/** Ollama /api/tags → real installed model names. */
function parseOllamaModels(body: unknown): DiscoveredProviderModel[] {
  const models = (body as { models?: Array<Record<string, unknown>> }).models ?? [];
  return models
    .map((m) => {
      const id = typeof m.name === 'string' ? m.name : '';
      return { id, name: id };
    })
    .filter((m) => m.id !== '');
}

/**
 * G9 — model metadata for DETERMINISTIC default selection. The tester keeps the
 * plain `.models` contract (id/name) that existing callers depend on and adds
 * this optional projection with the extra facts a ranking may use. Ollama
 * reports the served context window per model; REST list endpoints rarely do,
 * in which case contextLength is simply absent (never guessed).
 */
export function discoverModelMetadata(
  family: TestableProviderFamily,
  body: unknown,
): Array<{ id: string; name: string; contextLength?: number }> {
  if (family !== 'ollama') {
    return parseModelsFor(family, body).map((m) => ({ id: m.id, name: m.name }));
  }
  const models = (body as { models?: Array<Record<string, unknown>> }).models ?? [];
  return models
    .map((m) => {
      const id = typeof m.name === 'string' ? m.name : '';
      const raw = m.details as { context_length?: unknown } | undefined;
      const contextLength =
        typeof raw?.context_length === 'number' ? raw.context_length : undefined;
      return contextLength === undefined ? { id, name: id } : { id, name: id, contextLength };
    })
    .filter((m) => m.id !== '');
}

/** The model-list parser for a family (also used by discoverModelMetadata). */
function parseModelsFor(family: TestableProviderFamily, body: unknown): DiscoveredProviderModel[] {
  switch (family) {
    case 'google':
      return parseGeminiModels(body);
    case 'anthropic':
      return parseAnthropicModels(body);
    case 'ollama':
      return parseOllamaModels(body);
    case 'openai':
    case 'deepseek':
    case 'openrouter':
    case 'openai-compatible':
    default:
      return parseOpenAIModels(body);
  }
}

// ── G9 — real generation validation (step 5 of the one-click flow) ──────────
// "Connected" must mean "this AI can answer", not "this AI listed models". So
// after discovery the orchestrator asks the provider for ONE tiny completion on
// the model it is about to persist. The probe is intentionally minimal (a
// one-word answer, a few output tokens) so setup stays fast and cheap.

/** The one-word prompt used for validation (kept trivial on purpose). */
const VALIDATION_PROMPT = 'Reply with the single word: ok';

/** Output-token cap for the validation call — never a real generation. */
const VALIDATION_MAX_TOKENS = 5;

interface GenerationPlan {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  /** Reads a real completion out of the provider's own response shape. */
  parse: (body: unknown) => boolean;
}

function firstMessagePart(value: unknown): string {
  const content = (value as { content?: unknown }).content;
  // Two real provider shapes share this reader: Anthropic puts the parts array
  // directly on `.content` (`content: [{ text }]`), while Gemini nests it one
  // level deeper on `candidate.content.parts`. Reading only the flat shape made
  // every Gemini validation look like "the provider produced no reply" even on
  // a real completion, so the nested shape is accepted here.
  const parts = Array.isArray(content)
    ? content
    : (content as { parts?: unknown } | undefined)?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part) =>
      typeof (part as { text?: unknown }).text === 'string' ? (part as { text: string }).text : '',
    )
    .join('');
}

/** The validation request for one family + model (provider-shaped, tiny). */
function generationPlanFor(
  input: TestProviderConnectionInput,
  apiKey: string | undefined,
  modelId: string,
  env: Record<string, string | undefined>,
): GenerationPlan {
  switch (input.family) {
    case 'google':
      return {
        url: `${GOOGLE_GEMINI_ENDPOINT}/v1beta/models/${encodeURIComponent(modelId)}:generateContent`,
        headers: apiKey
          ? { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' }
          : { 'Content-Type': 'application/json' },
        body: { contents: [{ parts: [{ text: VALIDATION_PROMPT }] }] },
        parse: (body): boolean => {
          const candidates = (body as { candidates?: Array<Record<string, unknown>> }).candidates;
          const first = candidates?.[0];
          return first ? firstMessagePart(first).trim() !== '' : false;
        },
      };
    case 'anthropic':
      return {
        url: `${ANTHROPIC_ENDPOINT}/v1/messages`,
        headers: {
          'x-api-key': apiKey ?? '',
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: {
          model: modelId,
          max_tokens: VALIDATION_MAX_TOKENS,
          messages: [{ role: 'user', content: VALIDATION_PROMPT }],
        },
        parse: (body) => firstMessagePart(body).trim() !== '',
      };
    case 'ollama': {
      const base = (
        input.endpointUrl?.trim() ||
        env.AI_OLLAMA_BASE_URL?.trim() ||
        OLLAMA_DEFAULT_ENDPOINT
      ).replace(/\/+$/, '');
      return {
        url: `${base}/api/chat`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          model: modelId,
          stream: false,
          messages: [{ role: 'user', content: VALIDATION_PROMPT }],
        },
        parse: (body): boolean => {
          const message = (body as { message?: { content?: unknown } }).message;
          return typeof message?.content === 'string' && message.content.trim() !== '';
        },
      };
    }
    case 'openai':
    case 'deepseek':
    case 'openrouter':
    case 'openai-compatible':
    default: {
      const base =
        input.family === 'openai'
          ? OPENAI_ENDPOINT
          : input.family === 'deepseek'
            ? DEEPSEEK_ENDPOINT
            : input.family === 'openrouter'
              ? OPENROUTER_ENDPOINT
              : (input.endpointUrl?.trim() ?? '').replace(/\/+$/, '');
      return {
        url: `${base}/chat/completions`,
        headers: { Authorization: `Bearer ${apiKey ?? ''}`, 'Content-Type': 'application/json' },
        body: {
          model: modelId,
          max_tokens: VALIDATION_MAX_TOKENS,
          messages: [{ role: 'user', content: VALIDATION_PROMPT }],
        },
        parse: (body): boolean => {
          const choices = (body as { choices?: Array<Record<string, unknown>> }).choices;
          const first = choices?.[0];
          if (!first) return false;
          const message = (first as { message?: { content?: unknown } }).message;
          if (typeof message?.content === 'string' && message.content.trim() !== '') return true;
          // Reasoning models may return an empty content string but real output.
          return typeof (first as { finish_reason?: unknown }).finish_reason === 'string';
        },
      };
    }
  }
}

/**
 * G9 — validate that the provider really ANSWERS with the chosen model.
 *
 * This is the step that lets the UI say "✓ connected" honestly: model discovery
 * alone only proves the list endpoint works. A failure here is reported with
 * the same friendly taxonomy as the probe (never raw provider text, never the
 * credential).
 */
export async function validateProviderGeneration(
  input: TestProviderConnectionInput & { modelId: string },
): Promise<ProviderGenerationValidation> {
  const env = input.env ?? process.env;
  const fetchFn = input.fetchFn ?? globalThis.fetch;
  const timeoutMs = input.timeoutMs ?? envTimeoutMs(env) ?? DEFAULT_GENERATION_TIMEOUT_MS;
  const modelId = input.modelId.trim();
  if (modelId === '') {
    // PROD-DIAG — no request was issued at all, so this is reported as
    // "not attempted" and must never be confused with a provider failure.
    emitGenerationDiagnostic(input.onDiagnostic, {
      providerFamily: input.family,
      stage: 'validate',
      modelId,
      classification: 'generation_not_attempted',
      errorKind: 'no_credential',
      latencyMs: 0,
    });
    return {
      ok: false,
      modelId,
      latencyMs: 0,
      message: 'No model was available to test.',
      errorKind: 'no_credential',
    };
  }

  const explicit = input.credential;
  const apiKey =
    explicit?.source === 'USER'
      ? explicit.secret
      : input.apiKey?.trim() || explicit?.secret || resolvePlatformCredential(input.family, env);

  const plan = generationPlanFor(input, apiKey ?? undefined, modelId, env);
  const startedAt = Date.now();
  try {
    const response = await fetchFn(plan.url, {
      method: 'POST',
      headers: plan.headers,
      body: JSON.stringify(plan.body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      // PROD-DIAG — a provider error answers with a small JSON envelope whose
      // `error.status`/`error.type` is a machine-readable enum token. Only the
      // parsed envelope is read, only allow-listed tokens are kept, and the raw
      // body is discarded — the response text is never logged.
      const providerStatusReason = await readSafeProviderStatusReason(response);
      // BUGFIX (Ollama honesty) — a local runtime that REFUSES the model with
      // 404 has been reached and answered; the MODEL is missing, not the server.
      // Reporting this as "unreachable" is what told users with a running Ollama
      // that Ollama was not installed.
      if (input.family === 'ollama' && response.status === 404) {
        emitGenerationDiagnostic(input.onDiagnostic, {
          providerFamily: input.family,
          stage: 'validate',
          modelId,
          classification: 'generation_http_error',
          httpStatus: response.status,
          errorKind: 'model_unavailable',
          latencyMs,
          noCredential: apiKey === undefined,
          ...(providerStatusReason !== undefined ? { providerStatusReason } : {}),
        });
        return {
          ok: false,
          modelId,
          latencyMs,
          message: `This Ollama server does not have the model "${modelId}" installed.`,
          errorKind: 'model_unavailable',
        };
      }
      // The SAME allow-listed token that is logged decides the user-facing
      // classification, so the diagnostic and the screen can never disagree
      // about what the provider said.
      const { message, errorKind } = mapHttpFailure(
        response.status,
        response.statusText,
        providerStatusReason,
      );
      emitGenerationDiagnostic(input.onDiagnostic, {
        providerFamily: input.family,
        stage: 'validate',
        modelId,
        classification: 'generation_http_error',
        httpStatus: response.status,
        errorKind,
        latencyMs,
        noCredential: apiKey === undefined,
        ...(providerStatusReason !== undefined ? { providerStatusReason } : {}),
      });
      return { ok: false, modelId, latencyMs, message: redactKey(message, apiKey), errorKind };
    }
    const body = await response.json();
    if (!plan.parse(body)) {
      // PROD-DIAG — THE distinction this whole task exists for: the transport
      // succeeded (HTTP 200) but the body carried no usable answer. This is NOT
      // the same condition as an HTTP failure, yet the existing taxonomy reported
      // both as `unavailable`, which is why the live Gemini failure could not be
      // identified from logs. Only booleans + a character COUNT are reported;
      // the answer text and the response body are never logged.
      emitGenerationDiagnostic(input.onDiagnostic, {
        providerFamily: input.family,
        stage: 'validate',
        modelId,
        classification: 'generation_empty_response',
        httpStatus: response.status,
        errorKind: 'unavailable',
        latencyMs,
        noCredential: apiKey === undefined,
        candidatePresent: hasGenerationCandidate(body, input.family),
        contentPartPresent: generationAnswerLength(body, input.family) > 0,
        answerLength: generationAnswerLength(body, input.family),
      });
      return {
        ok: false,
        modelId,
        latencyMs,
        message: 'The AI answered the model list but produced no reply — try another model.',
        errorKind: 'unavailable',
      };
    }
    // PROD-DIAG — the ONE success path. Logged so a production run always shows
    // which of the two `ok` conditions actually happened.
    emitGenerationDiagnostic(input.onDiagnostic, {
      providerFamily: input.family,
      stage: 'validate',
      modelId,
      classification: 'generation_success',
      httpStatus: response.status,
      latencyMs,
      noCredential: apiKey === undefined,
      candidatePresent: true,
      contentPartPresent: true,
      answerLength: generationAnswerLength(body, input.family),
    });
    return { ok: true, modelId, latencyMs };
  } catch (error) {
    const { message, errorKind } = mapNetworkError(error, timeoutMs);
    const latencyMs = Date.now() - startedAt;
    // PROD-DIAG — the request never completed. `errorName` is a fixed platform
    // identifier ('AbortError'/'TimeoutError'/…), never provider text, so it is
    // safe; the error MESSAGE is deliberately not logged because an error can
    // echo request material and is redacted only for the user-facing copy.
    emitGenerationDiagnostic(input.onDiagnostic, {
      providerFamily: input.family,
      stage: 'validate',
      modelId,
      classification: 'generation_network_error',
      errorKind,
      latencyMs,
      noCredential: apiKey === undefined,
      networkErrorName: error instanceof Error ? error.name : undefined,
    });
    return {
      ok: false,
      modelId,
      latencyMs,
      message: redactKey(message, apiKey),
      errorKind,
    };
  }
}

// ── G9 — local-runtime browser access (implementation detail) ───────────────
// A local runtime (Ollama) can be reachable from the server while a BROWSER on
// the same machine is refused, because the runtime only accepts requests from
// the origins it was told to trust. VedMoulya treats that as an implementation
// detail: the user is told the true fact and given ONE recovery instruction —
// never asked to configure networking (OLLAMA_ORIGINS etc.).

/** True when the endpoint is a loopback address (a local runtime). */
export function isLoopbackEndpoint(endpointUrl: string): boolean {
  try {
    const host = new URL(endpointUrl).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  } catch {
    return false;
  }
}

/**
 * Classify a refusal by a local runtime's origin policy. Ollama answers such
 * requests with HTTP 403 and a body mentioning origins; without a browser there
 * is nothing else a 403 on a local runtime can mean.
 */
export function classifyLocalRuntimeRefusal(
  status: number,
  bodyText: string,
  endpointUrl: string,
): ProviderConnectionErrorKind | undefined {
  if (status !== 401 && status !== 403) return undefined;
  if (isLoopbackEndpoint(endpointUrl)) {
    return /origin/i.test(bodyText) ? 'browser_origin_blocked' : 'unauthorized';
  }
  return status === 401 ? 'invalid_api_key' : 'unauthorized';
}

/** Readable labels for success messages (never a secret). */
const PROVIDER_LABELS: Record<TestableProviderFamily, string> = {
  google: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  deepseek: 'DeepSeek',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
  'openai-compatible': 'the endpoint',
};

/**
 * A credential-verification call that must SUCCEED before a family's discovery
 * response is trusted.
 *
 * Why this exists: some providers serve their model CATALOG to anonymous
 * callers. OpenRouter's `GET /api/v1/models` is public — it answers 200 for a
 * missing, malformed or revoked key, so probing the catalog reported
 * `connected: true` for an invalid credential (the deployment's generation
 * validation was the only thing that ever caught it). A family whose catalog is
 * public therefore declares a SEPARATE authenticated call plus a predicate that
 * proves the response really carried the credential's own record, because an
 * HTTP 200 status is not the same thing as a confirmed credential.
 *
 * SECURITY CONTRACT: the headers carry the resolved credential for THIS request
 * only; the response body is used solely by `confirmsCredential` and is never
 * logged, echoed or returned.
 */
interface ProbeAuthCheck {
  url: string;
  headers: Record<string, string>;
  /** True when the body really carries the provider's credential record. */
  confirmsCredential: (body: unknown) => boolean;
}

interface ProbePlan {
  url: string;
  headers: Record<string, string>;
  /**
   * Present ONLY for families whose catalog endpoint is anonymous (see
   * `ProbeAuthCheck`). A family declared here must authenticate before its
   * discovered models are reported as a connection.
   */
  authCheck?: ProbeAuthCheck;
  parse: (body: unknown) => DiscoveredProviderModel[];
}

/**
 * OpenRouter credential confirmation — the provider answered `GET /key` with a
 * `data` record describing the key itself. Read defensively (unknown shape) and
 * never interpret a missing/error envelope as success.
 */
export function confirmsOpenRouterCredential(body: unknown): boolean {
  if (body === null || typeof body !== 'object') return false;
  const data = (body as { data?: unknown }).data;
  // `data` must be the key's RECORD — an array (the catalog's shape) or a
  // missing field proves nothing about the credential.
  return data !== null && typeof data === 'object' && !Array.isArray(data);
}

/**
 * Run ONE family's authenticated credential check.
 *
 * Returns `undefined` when the provider really confirmed the credential, or the
 * friendly failure (`message` + `errorKind`) when it did not. A provider refusal
 * is mapped through the SAME taxonomy as discovery, so an invalid key, a rate
 * limit and an outage read identically wherever they happen; an unreadable or
 * record-less 200 is reported as `unavailable` rather than as a connection.
 */
async function runCredentialCheck(
  check: ProbeAuthCheck,
  fetchFn: typeof fetch,
  timeoutMs: number,
): Promise<{ message: string; errorKind: ProviderConnectionErrorKind } | undefined> {
  let response: Response;
  try {
    response = await fetchFn(check.url, {
      method: 'GET',
      headers: check.headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return mapNetworkError(error, timeoutMs);
  }
  if (!response.ok) {
    // Same 429 distinction as discovery: the provider's own token decides
    // whether this is a throttle or an unfunded account. Read through the
    // shared allow-list reader, which never touches the raw body text.
    const providerStatusReason = await readSafeProviderStatusReason(response);
    return mapHttpFailure(response.status, response.statusText, providerStatusReason);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // A 200 with an unreadable body confirms nothing.
    body = undefined;
  }
  if (!check.confirmsCredential(body)) {
    return {
      message:
        'The provider accepted the request but did not confirm this credential — try again shortly.',
      errorKind: 'unavailable',
    };
  }
  return undefined;
}

function probeFor(
  input: TestProviderConnectionInput,
  apiKey: string | undefined,
  env: Record<string, string | undefined>,
): ProbePlan {
  switch (input.family) {
    case 'google':
      return {
        url: `${GOOGLE_GEMINI_ENDPOINT}/v1beta/models`,
        headers: apiKey
          ? { 'x-goog-api-key': apiKey, Accept: 'application/json' }
          : { Accept: 'application/json' },
        parse: parseGeminiModels,
      };
    case 'openai':
      return {
        url: `${OPENAI_ENDPOINT}/models`,
        headers: { Authorization: `Bearer ${apiKey ?? ''}`, Accept: 'application/json' },
        parse: parseOpenAIModels,
      };
    case 'deepseek':
      return {
        url: `${DEEPSEEK_ENDPOINT}/models`,
        headers: { Authorization: `Bearer ${apiKey ?? ''}`, Accept: 'application/json' },
        parse: parseOpenAIModels,
      };
    case 'openrouter': {
      const headers = { Authorization: `Bearer ${apiKey ?? ''}`, Accept: 'application/json' };
      return {
        // OpenRouter exposes its real catalog at GET /api/v1/models — but that
        // endpoint is PUBLIC, so it is only ever used for discovery, never as
        // proof of a credential.
        url: `${OPENROUTER_ENDPOINT}/models`,
        headers,
        // The credential is verified separately against the provider's own key
        // endpoint, which is the only call that rejects an invalid key.
        authCheck: {
          url: OPENROUTER_KEY_ENDPOINT,
          headers,
          confirmsCredential: confirmsOpenRouterCredential,
        },
        parse: parseOpenAIModels,
      };
    }
    case 'anthropic':
      return {
        url: `${ANTHROPIC_ENDPOINT}/v1/models`,
        headers: {
          'x-api-key': apiKey ?? '',
          'anthropic-version': '2023-06-01',
          Accept: 'application/json',
        },
        parse: parseAnthropicModels,
      };
    case 'ollama': {
      const base = (
        input.endpointUrl?.trim() ||
        env.AI_OLLAMA_BASE_URL?.trim() ||
        OLLAMA_DEFAULT_ENDPOINT
      ).replace(/\/+$/, '');
      return {
        url: `${base}/api/tags`,
        headers: { Accept: 'application/json' },
        parse: parseOllamaModels,
      };
    }
    case 'openai-compatible':
    default: {
      const base = (input.endpointUrl?.trim() ?? '').replace(/\/+$/, '');
      return {
        url: `${base}/models`,
        headers: { Authorization: `Bearer ${apiKey ?? ''}`, Accept: 'application/json' },
        parse: parseOpenAIModels,
      };
    }
  }
}

/**
 * Probe ONE provider family. On success the result carries the provider's
 * REAL models; on failure it carries a friendly, redacted message.
 */
export async function testProviderConnection(
  input: TestProviderConnectionInput,
): Promise<ProviderConnectionTestResult> {
  const env = input.env ?? process.env;
  const fetchFn = input.fetchFn ?? globalThis.fetch;
  const timeoutMs = input.timeoutMs ?? envTimeoutMs(env) ?? DEFAULT_PROBE_TIMEOUT_MS;
  const testedAt = new Date().toISOString();
  const runtime = runtimeStateFor(input.family, env);

  // ── Credential resolution: user → platform → none (PROVIDER-01 Decision 4) ─
  // An already-resolved credential (from the server-side credential service)
  // wins outright, so the probe can never authenticate with a different source
  // than the resolver chose. Otherwise a user-supplied key is used, and only
  // then does THIS deployment's own key answer.
  const explicit = input.credential;
  const explicitSecret = explicit?.secret.trim() || undefined;
  const userKey =
    explicit !== undefined
      ? explicit.source === 'USER'
        ? explicitSecret
        : undefined
      : input.apiKey?.trim() || undefined;
  const apiKey = userKey ?? explicitSecret ?? resolvePlatformCredential(input.family, env);
  const credentialSource: ProviderCredentialSource =
    userKey !== undefined ? 'USER' : apiKey !== undefined ? 'PLATFORM' : 'NONE';
  // True when the probe authenticated with THIS deployment's own key.
  const serverManagedKey = credentialSource === 'PLATFORM';

  const missingCredential =
    input.family !== 'ollama' &&
    input.family !== 'openai-compatible' &&
    credentialSource === 'NONE';
  if (missingCredential) {
    return {
      connected: false,
      status: 'failed',
      message:
        input.family === 'google'
          ? 'No Gemini key available — paste your Google AI Studio key, or ask the deployment operator to set AI_GOOGLE_API_KEY.'
          : 'An API key is required to test this provider.',
      errorKind: 'no_credential',
      testedAt,
      credentialSource,
      serverManagedKey: false,
      ...runtime,
    };
  }

  const { url, headers, authCheck, parse } = probeFor(input, apiKey, env);
  const startedAt = Date.now();
  try {
    // ── Step 1: authenticate (families whose catalog is anonymous) ──────────
    // Runs BEFORE discovery and short-circuits on failure, so an invalid
    // credential can never be reported as a connection just because the public
    // catalog answered. `latencyMs` below therefore covers the WHOLE probe.
    if (authCheck !== undefined) {
      const authFailure = await runCredentialCheck(authCheck, fetchFn, timeoutMs);
      if (authFailure !== undefined) {
        return {
          connected: false,
          status: 'failed',
          message: redactKey(authFailure.message, apiKey),
          errorKind: authFailure.errorKind,
          latencyMs: Date.now() - startedAt,
          testedAt,
          credentialSource,
          serverManagedKey,
          ...runtime,
        };
      }
    }
    // ── Step 2: discover the provider's REAL models ─────────────────────────
    const response = await fetchFn(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      // G9 — a local runtime refusing the request because of its BROWSER origin
      // policy is classified as such (instead of "invalid API key", which
      // would be a lie for a keyless local server).
      const bodyText =
        response.status === 401 || response.status === 403
          ? await response
              .clone()
              .text()
              .catch(() => '')
          : '';
      const refusal = classifyLocalRuntimeRefusal(response.status, bodyText, url);
      if (refusal === 'browser_origin_blocked') {
        return {
          connected: false,
          status: 'failed',
          message:
            'VedMoulya can see your local AI, but browser access is blocked. Restart it and try again.',
          errorKind: refusal,
          latencyMs,
          testedAt,
          credentialSource,
          serverManagedKey,
          ...runtime,
        };
      }
      // Discovery keeps the same 429 distinction: an unfunded account must not
      // be reported as a throttle (nor the reverse) just because the probe hit a
      // different endpoint than the generation validation did.
      const providerStatusReason = await readSafeProviderStatusReason(response);
      const { message, errorKind } = mapHttpFailure(
        response.status,
        response.statusText,
        providerStatusReason,
      );
      return {
        connected: false,
        status: 'failed',
        message: redactKey(message, apiKey),
        errorKind,
        latencyMs,
        testedAt,
        credentialSource,
        serverManagedKey,
        ...runtime,
      };
    }
    const body = await response.json();
    const models = parse(body);
    const label = PROVIDER_LABELS[input.family];

    // BUGFIX (Ollama honesty) — the server ANSWERED, so it is installed and
    // running. An empty model list is its own state ("reachable, no models"),
    // never a connection failure: collapsing it into "unreachable" is what made
    // a working Ollama install render as "Ollama isn't running on this
    // computer". Only a local runtime with a genuinely empty catalog can be in
    // this state, so the check is scoped to it.
    const isLocalRuntime = input.family === 'ollama';
    if (isLocalRuntime && models.length === 0) {
      return {
        connected: false,
        status: 'failed',
        message: `${label} is running, but no models are installed.`,
        errorKind: 'no_models',
        latencyMs,
        modelCount: 0,
        models,
        testedAt,
        credentialSource,
        serverManagedKey,
        ...runtime,
      };
    }

    const suffix = `${models.length} model${models.length === 1 ? '' : 's'} available`;
    return {
      connected: true,
      status: 'connected',
      // The family label must follow the provider that actually answered. It was
      // hardcoded to "Google Gemini", so an OpenRouter/OpenAI/DeepSeek
      // credential authenticated by the deployment was reported as Gemini —
      // the UI named the wrong AI. `${label}` is already the family's name.
      message: serverManagedKey
        ? `Connected to ${label} via this server's configured credential — ${suffix}.`
        : `Connected successfully — ${suffix} on ${label}.`,
      latencyMs,
      modelCount: models.length,
      models,
      testedAt,
      credentialSource,
      serverManagedKey,
      ...runtime,
    };
  } catch (error) {
    const { message, errorKind } = mapNetworkError(error, timeoutMs);
    return {
      connected: false,
      status: 'failed',
      message: redactKey(message, apiKey),
      errorKind,
      latencyMs: Date.now() - startedAt,
      testedAt,
      credentialSource,
      serverManagedKey,
      ...runtime,
    };
  }
}
