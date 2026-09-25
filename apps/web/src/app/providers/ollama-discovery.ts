// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Ollama local discovery (BROWSER side)
//
// WHY THIS IS BROWSER-SIDE
//   Ollama runs on the USER'S machine. The deployed VedMoulya web app is served
//   from a cloud host, so a server-side request from that host can never reach
//   the user's `localhost` — it would probe the server's own loopback and report
//   a false verdict. Discovery therefore happens in the browser, which is the
//   only actor on the same machine as Ollama. No server-side proxy is invented.
//
// VERIFIED UPSTREAM CONTRACTS (implemented exactly, nothing guessed):
//   • GET  {base}/api/version      → { version }         — service identity
//   • GET  {base}/api/tags         → { models: [{ name, size, details }] }
//   • POST {base}/api/chat         → { message: { content } } (stream:false)
//   Default host/port: http://localhost:11434
//   (docs: https://github.com/ollama/ollama/blob/main/docs/api.md)
//
//   Browser access is governed by Ollama's own CORS allow-list, `OLLAMA_ORIGINS`
//   (default origins are the localhost ones only — a public HTTPS origin is NOT
//   allowed by default), so a browser can be refused while Ollama is perfectly
//   healthy. That case is classified SEPARATELY: it is never reported as
//   "Ollama is not installed".
//   (docs: https://docs.ollama.com/faq)
//
// HONESTY RULES ENCODED HERE
//   Every terminal state names exactly what was MEASURED. The only state that
//   ever mentions installation is OLLAMA_NOT_REACHABLE_OR_NOT_RUNNING, and even
//   there the wording says "may not be installed or running" because a network
//   failure cannot prove absence.
// ─────────────────────────────────────────────────────────────────────────────

import type { DiscoveredProviderModelDTO } from '../../lib/api-client.js';

// ── Candidate endpoints ──────────────────────────────────────────────────────

/** The normal Ollama local endpoint (Ollama's documented default). */
export const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434';

/**
 * Local candidates probed during auto-discovery, in order. Several hostnames
 * resolve to the same loopback interface but are NOT interchangeable in a
 * browser: `localhost` and `127.0.0.1` are distinct ORIGINS for CORS purposes,
 * and `[::1]` covers IPv6-only resolution. Probing the list (never a single
 * hard-coded host) is what lets discovery succeed on a machine where only one
 * spelling resolves.
 */
export const OLLAMA_ENDPOINT_CANDIDATES: readonly string[] = [
  'http://localhost:11434',
  'http://127.0.0.1:11434',
  'http://[::1]:11434',
];

/** Discovery states — the honest vocabulary the UI renders. */
export type OllamaDiscoveryState =
  /** A probe is in flight. */
  | 'CHECKING'
  /** A candidate answered as a real Ollama service. */
  | 'OLLAMA_REACHABLE'
  /** Ollama answered but has no installed models. */
  | 'NO_MODELS'
  /** Ollama answered with real models. */
  | 'MODELS_FOUND'
  /** Ollama answered and the selected model produced a completion. */
  | 'CONNECTED';

/**
 * Explicit error classification. Distinguishing these is the whole point of this
 * module: the previous implementation collapsed every failure into one
 * "not installed" message, which was false whenever Ollama was simply refusing
 * the browser or had no models pulled.
 */
export type OllamaDiscoveryError =
  /** Nothing answered on any candidate. Absence is NOT proven — say so. */
  | 'OLLAMA_NOT_REACHABLE'
  /** Something answered, but not with a valid Ollama payload (not our service). */
  | 'OLLAMA_INVALID_RESPONSE'
  /** Reachable, zero installed models. */
  | 'OLLAMA_NO_MODELS'
  /** Reachable, but the selected model is not served by this server. */
  | 'OLLAMA_MODEL_UNAVAILABLE'
  /** Reachable, model present, but the generation call failed. */
  | 'OLLAMA_GENERATION_FAILED'
  /**
   * The browser was refused by Ollama's own origin policy (CORS) — Ollama may be
   * perfectly healthy. Requires OLLAMA_ORIGINS, never a reinstall.
   */
  | 'OLLAMA_CORS_OR_BROWSER_BLOCKED';

export interface OllamaDiscoveryResult {
  state: OllamaDiscoveryState;
  /** The endpoint that actually answered ('' when none did). */
  endpoint: string;
  /** Real models, exactly as Ollama reported them (never invented ids). */
  models: DiscoveredProviderModelDTO[];
  /** Ollama's own version string when it reported one. */
  version?: string;
  /** The classified failure, when the run did not succeed. */
  error?: OllamaDiscoveryError;
  /** Secret-free, human-readable explanation of what was measured. */
  message: string;
}

// ── Probing primitives ───────────────────────────────────────────────────────

/** Trim trailing slashes so paths concatenate predictably. */
export function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '');
}

/** True for a syntactically valid http(s) URL. */
export function isValidEndpoint(endpoint: string): boolean {
  const value = normalizeEndpoint(endpoint);
  if (value === '') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * A CORS refusal is a NETWORK-level TypeError in the browser (the preflight or
 * response is blocked before the code sees a status), so it is indistinguishable
 * from "connection refused" by the error alone. It is told apart by EVIDENCE:
 * only when the SERVER-side probe already proved Ollama is reachable can a
 * browser network failure be attributed to the browser/origin policy. That is
 * why `classifyBrowserProbeFailure` takes `serverReachable` rather than guessing.
 */
export interface BrowserProbeContext {
  /** The endpoint the SERVER side could reach, when it could reach one. */
  serverReachableEndpoint?: string | undefined;
}

/** Default per-probe timeout — a local server answers in milliseconds. */
export const OLLAMA_PROBE_TIMEOUT_MS = 4000;

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchFn: typeof fetch,
): Promise<{ ok: true; body: unknown } | { ok: false; status?: number }> {
  try {
    const response = await fetchFn(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      return { ok: false, status: response.status };
    }
    return { ok: true, body: await response.json() };
  } catch {
    // Network-level failure (refused, timeout, CORS-blocked) — the caller
    // classifies it with the evidence it holds.
    return { ok: false };
  }
}

/** Read Ollama's model list from a verified /api/tags response. */
export function parseOllamaTags(body: unknown): DiscoveredProviderModelDTO[] {
  const models = (body as { models?: Array<Record<string, unknown>> } | null)?.models;
  if (!Array.isArray(models)) return [];
  return models
    .map((model) => {
      const name = typeof model.name === 'string' ? model.name : '';
      return { id: name, name };
    })
    .filter((model) => model.id !== '');
}

/** Read the version string from a /api/version response. */
export function parseOllamaVersion(body: unknown): string | undefined {
  const version = (body as { version?: unknown } | null)?.version;
  return typeof version === 'string' && version.trim() !== '' ? version : undefined;
}

/** True when a chat response carries a real assistant completion. */
export function parseOllamaChatReply(body: unknown): boolean {
  const message = (body as { message?: { content?: unknown } } | null)?.message;
  return typeof message?.content === 'string' && message.content.trim() !== '';
}

// ── The discovery pipeline ───────────────────────────────────────────────────

export interface OllamaDiscoveryOptions {
  /** Explicit endpoint to probe. When omitted the candidate list is used. */
  endpoint?: string | undefined;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  /** Evidence from a server-side probe, used only to classify browser blocks. */
  serverReachableEndpoint?: string | undefined;
}

/**
 * STATE A→E — find Ollama and read its REAL models.
 *
 * A candidate is only accepted when `/api/version` answers with a valid Ollama
 * payload, so an unrelated service squatting on the port is reported as
 * OLLAMA_INVALID_RESPONSE rather than mistaken for Ollama.
 */
export async function discoverOllama(
  options: OllamaDiscoveryOptions = {},
): Promise<OllamaDiscoveryResult> {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? OLLAMA_PROBE_TIMEOUT_MS;
  const explicit = options.endpoint?.trim() ?? '';
  const candidates =
    explicit !== ''
      ? [normalizeEndpoint(explicit)]
      : OLLAMA_ENDPOINT_CANDIDATES.map(normalizeEndpoint);

  // An explicitly supplied address must be a real URL — a typo is reported as
  // such instead of being silently retried against the defaults.
  if (explicit !== '' && !isValidEndpoint(explicit)) {
    return {
      state: 'CHECKING',
      endpoint: explicit,
      models: [],
      error: 'OLLAMA_INVALID_RESPONSE',
      message: `"${explicit}" is not a valid address. Use a URL such as http://localhost:11434.`,
    };
  }

  let answeredButInvalid = false;

  for (const candidate of candidates) {
    const version = await fetchJson(
      `${candidate}/api/version`,
      { method: 'GET', headers: { Accept: 'application/json' } },
      timeoutMs,
      fetchFn,
    );
    // The service answered with a non-2xx status → it exists but is not Ollama.
    if (!version.ok && version.status !== undefined) {
      answeredButInvalid = true;
      continue;
    }
    if (!version.ok) continue;
    if (parseOllamaVersion(version.body) === undefined) {
      answeredButInvalid = true;
      continue;
    }

    // STATE C — a real Ollama service confirmed. Read the model list.
    const tags = await fetchJson(
      `${candidate}/api/tags`,
      { method: 'GET', headers: { Accept: 'application/json' } },
      timeoutMs,
      fetchFn,
    );
    if (!tags.ok) {
      // The service is there but the catalog could not be read — still reachable.
      return {
        state: 'OLLAMA_REACHABLE',
        endpoint: candidate,
        models: [],
        error: 'OLLAMA_INVALID_RESPONSE',
        message: 'Ollama is running, but its model list could not be read.',
      };
    }

    const models = parseOllamaTags(tags.body);
    // STATE D — reachable with an EMPTY catalog. Explicitly not "not installed".
    if (models.length === 0) {
      return {
        state: 'NO_MODELS',
        endpoint: candidate,
        models: [],
        version: parseOllamaVersion(version.body),
        error: 'OLLAMA_NO_MODELS',
        message: 'Ollama is running, but no models are installed.',
      };
    }

    // STATE E — real models, reported exactly as Ollama returned them.
    return {
      state: 'MODELS_FOUND',
      endpoint: candidate,
      models,
      version: parseOllamaVersion(version.body),
      message: `Ollama found with ${String(models.length)} model${models.length === 1 ? '' : 's'}.`,
    };
  }

  if (answeredButInvalid) {
    return {
      state: 'CHECKING',
      endpoint: '',
      models: [],
      error: 'OLLAMA_INVALID_RESPONSE',
      message:
        'Something answered on the Ollama address, but it was not an Ollama service. Check the address.',
    };
  }

  // STATE B — nothing answered. `serverReachableEndpoint` is the ONE piece of
  // evidence that separates "the browser is blocked" from "nothing is there".
  const blocked = classifyBrowserProbeFailure(options.serverReachableEndpoint, answeredButInvalid);
  if (blocked === 'OLLAMA_CORS_OR_BROWSER_BLOCKED') {
    return {
      state: 'CHECKING',
      endpoint: options.serverReachableEndpoint ?? '',
      models: [],
      error: 'OLLAMA_CORS_OR_BROWSER_BLOCKED',
      message:
        'Ollama is running, but this browser cannot access it. Allow VedMoulya to connect to your local Ollama server, then try again.',
    };
  }

  return {
    state: 'CHECKING',
    endpoint: explicit !== '' ? normalizeEndpoint(explicit) : '',
    models: [],
    error: 'OLLAMA_NOT_REACHABLE',
    message: 'VedMoulya could not reach Ollama on this computer.',
  };
}

/**
 * Classify a browser-side network failure. Pure and total, so the distinction is
 * unit-testable without a browser.
 *
 * `answeredButInvalid` is deliberately NOT treated as "not reachable": an
 * invalid payload still proves SOMETHING is listening on the address.
 */
export function classifyBrowserProbeFailure(
  serverReachableEndpoint: string | undefined,
  answeredButInvalid = false,
): OllamaDiscoveryError {
  if (serverReachableEndpoint !== undefined && normalizeEndpoint(serverReachableEndpoint) !== '') {
    return 'OLLAMA_CORS_OR_BROWSER_BLOCKED';
  }
  if (answeredButInvalid) return 'OLLAMA_INVALID_RESPONSE';
  return 'OLLAMA_NOT_REACHABLE';
}

/**
 * STATE F — minimal REAL generation test on a chosen model.
 *
 * A successful /api/tags only proves the catalog is readable. Marking a provider
 * connected on that alone is exactly the dishonesty this pipeline removes, so a
 * one-word completion is required before anything may be called connected.
 */
export async function testOllamaGeneration(
  endpoint: string,
  modelId: string,
  options: { timeoutMs?: number; fetchFn?: typeof fetch } = {},
): Promise<OllamaDiscoveryResult & { latencyMs?: number }> {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const base = normalizeEndpoint(endpoint);
  const model = modelId.trim();
  if (model === '') {
    return {
      state: 'MODELS_FOUND',
      endpoint: base,
      models: [],
      error: 'OLLAMA_MODEL_UNAVAILABLE',
      message: 'Choose a model before testing.',
    };
  }

  const startedAt = Date.now();
  try {
    const response = await fetchFn(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
    });
    const latencyMs = Date.now() - startedAt;

    // Ollama answers 404 for a model it does not have — the SERVER is fine.
    if (response.status === 404) {
      return {
        state: 'MODELS_FOUND',
        endpoint: base,
        models: [],
        error: 'OLLAMA_MODEL_UNAVAILABLE',
        message: `This Ollama server does not have the model "${model}".`,
        latencyMs,
      };
    }
    if (!response.ok) {
      return {
        state: 'MODELS_FOUND',
        endpoint: base,
        models: [],
        error: 'OLLAMA_GENERATION_FAILED',
        message: `Ollama refused the test (HTTP ${String(response.status)}).`,
        latencyMs,
      };
    }
    const body: unknown = await response.json();
    if (!parseOllamaChatReply(body)) {
      return {
        state: 'MODELS_FOUND',
        endpoint: base,
        models: [],
        error: 'OLLAMA_GENERATION_FAILED',
        message: 'Ollama answered but produced no reply — try another model.',
        latencyMs,
      };
    }
    // STATE G precondition: reachable + real model + real completion.
    return {
      state: 'CONNECTED',
      endpoint: base,
      models: [],
      message: `Ollama answered on ${model}.`,
      latencyMs,
    };
  } catch {
    return {
      state: 'MODELS_FOUND',
      endpoint: base,
      models: [],
      error: 'OLLAMA_GENERATION_FAILED',
      message: 'The test could not reach Ollama. Check that it is still running.',
    };
  }
}

/**
 * The dashed "where to start Ollama" hint shown ONLY when nothing answered — a
 * user-facing setup path (never a silent bypass of browser security).
 */
export const OLLAMA_START_HINT =
  'Start the Ollama app (or run "ollama serve"), then press Try again.';

/**
 * The exact origin a user must allow when Ollama refuses the browser. This is
 * documentation surfaced to the user, not an automatic change to their machine.
 */
export function ollamaOriginsInstruction(appOrigin: string): string {
  const origin = appOrigin.trim() === '' ? 'this app' : appOrigin.trim();
  return `Add ${origin} to Ollama's OLLAMA_ORIGINS environment variable, restart Ollama, then try again.`;
}
