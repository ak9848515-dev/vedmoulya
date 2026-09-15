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

// Google Gemini generativelanguage API (same host @ai-sdk/google uses).
const GOOGLE_GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com';
const OPENAI_ENDPOINT = 'https://api.openai.com/v1';
// Same constant DeepSeekProvider uses (api-docs.deepseek.com).
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com';
const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com';
// Same default OllamaProvider/OllamaLocalModelDiscovery use.
const OLLAMA_DEFAULT_ENDPOINT = 'http://localhost:11434';

/** Families this tester can probe (openai-compatible = user-supplied endpoint). */
export type TestableProviderFamily =
  'google' | 'openai' | 'anthropic' | 'deepseek' | 'ollama' | 'openai-compatible';

/** Friendly failure taxonomy for the UI (rendered with a readable message). */
export type ProviderConnectionErrorKind =
  | 'invalid_api_key'
  | 'unauthorized'
  | 'unreachable'
  | 'rate_limited'
  | 'unavailable'
  | 'not_found'
  | 'bad_request'
  | 'no_credential';

export interface DiscoveredProviderModel {
  /** The provider's real model id (e.g. "models/gemini-2.5-flash" → id). */
  id: string;
  /** Human name when the provider reports one; falls back to the id. */
  name: string;
}

export interface ProviderConnectionTestResult {
  connected: boolean;
  status: 'connected' | 'failed';
  message: string;
  errorKind?: ProviderConnectionErrorKind;
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

export interface TestProviderConnectionInput {
  family: TestableProviderFamily;
  /** User-supplied key — used for THIS probe only, never stored or logged. */
  apiKey?: string;
  /** User-supplied endpoint (ollama / openai-compatible). */
  endpointUrl?: string;
  /** Test doubles only. */
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  /** Env source (tests inject; production = process.env). */
  env?: Record<string, string | undefined>;
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

function mapHttpFailure(
  status: number,
  statusText: string,
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
  const set = (name: string): boolean => (env[name] ?? '').trim() !== '';
  switch (family) {
    case 'google':
      return {
        runtimeConfigured: set('AI_GOOGLE_API_KEY'),
        runtimeNote: set('AI_GOOGLE_API_KEY')
          ? 'This deployment has a server-managed Gemini credential (AI_GOOGLE_API_KEY) — AI execution is live.'
          : 'No Gemini credential is configured for this deployment — set AI_GOOGLE_API_KEY server-side to activate AI execution.',
      };
    case 'openai': {
      const configured = set('AI_OPENAI_API_KEY') || set('OPENAI_API_KEY');
      return {
        runtimeConfigured: configured,
        runtimeNote: configured
          ? 'This deployment has a server-managed OpenAI credential — AI execution is live.'
          : 'No OpenAI credential is configured for this deployment — set AI_OPENAI_API_KEY server-side to activate AI execution.',
      };
    }
    case 'deepseek':
      return {
        runtimeConfigured: set('AI_DEEPSEEK_API_KEY'),
        runtimeNote: set('AI_DEEPSEEK_API_KEY')
          ? 'This deployment has a server-managed DeepSeek credential — AI execution is live.'
          : 'No DeepSeek credential is configured for this deployment — set AI_DEEPSEEK_API_KEY server-side to activate AI execution.',
      };
    case 'ollama':
      return {
        runtimeConfigured: set('AI_OLLAMA_BASE_URL'),
        runtimeNote: set('AI_OLLAMA_BASE_URL')
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

/** Readable labels for success messages (never a secret). */
const PROVIDER_LABELS: Record<TestableProviderFamily, string> = {
  google: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  deepseek: 'DeepSeek',
  ollama: 'Ollama',
  'openai-compatible': 'the endpoint',
};

interface ProbePlan {
  url: string;
  headers: Record<string, string>;
  parse: (body: unknown) => DiscoveredProviderModel[];
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
  const timeoutMs = input.timeoutMs ?? 10_000;
  const testedAt = new Date().toISOString();
  const runtime = runtimeStateFor(input.family, env);

  // Server-managed Gemini: the deployment's own key (never user-supplied).
  const serverManagedKey = input.family === 'google' && !input.apiKey && runtime.runtimeConfigured;
  const apiKey = input.apiKey?.trim() || undefined;

  const missingCredential =
    input.family !== 'ollama' &&
    input.family !== 'openai-compatible' &&
    !apiKey &&
    !serverManagedKey;
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
      serverManagedKey: false,
      ...runtime,
    };
  }

  const { url, headers, parse } = probeFor(input, apiKey, env);
  const startedAt = Date.now();
  try {
    const response = await fetchFn(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      const { message, errorKind } = mapHttpFailure(response.status, response.statusText);
      return {
        connected: false,
        status: 'failed',
        message: redactKey(message, apiKey),
        errorKind,
        latencyMs,
        testedAt,
        serverManagedKey,
        ...runtime,
      };
    }
    const body = await response.json();
    const models = parse(body);
    const label = PROVIDER_LABELS[input.family];
    const suffix = `${models.length} model${models.length === 1 ? '' : 's'} available`;
    return {
      connected: true,
      status: 'connected',
      message: serverManagedKey
        ? `Connected to Google Gemini via this server's configured credential — ${suffix}.`
        : `Connected successfully — ${suffix} on ${label}.`,
      latencyMs,
      modelCount: models.length,
      models,
      testedAt,
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
      serverManagedKey,
      ...runtime,
    };
  }
}
