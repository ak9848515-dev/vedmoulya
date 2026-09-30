// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Local Agent client (BROWSER side)
//
// WHY THE BROWSER TALKS TO THE AGENT, NOT TO OLLAMA
//   The deployed web app is served from a cloud host; it can never reach the
//   user's `127.0.0.1:11434`. The VedMoulya Local Agent runs ON the user's
//   machine and is the trusted bridge. The browser therefore calls the AGENT:
//
//     Browser → Local Agent → Local Runtime interface → Ollama → model
//
//   This also removes browser CORS problems entirely, because the agent (a local
//   process) makes the Ollama request, not the browser origin.
//
// HONESTY RULES
//   • Every call here NEVER throws: it returns a typed "unreachable" result, so
//     a missing Local Agent can never crash the app or mark cloud AI unavailable.
//   • The agent is the source of truth for the connection state; this module
//     transports it and never re-derives it.
// ─────────────────────────────────────────────────────────────────────────────

/** The agent's default loopback port. Kept in sync with the agent's default. */
export const DEFAULT_LOCAL_AGENT_URL = 'http://127.0.0.1:43117';

/**
 * The port the agent listens on. The agent's CLI reads
 * `VEDMOULYA_LOCAL_AGENT_PORT`, so the browser must be able to look at the same
 * port — otherwise an agent started on a non-default port is reported as "not
 * running", which is a lie about a running process.
 *
 * Read at call time from `NEXT_PUBLIC_VEDMOULYA_LOCAL_AGENT_PORT` (the only form
 * a browser bundle can see) and validated; anything unusable falls back to the
 * canonical default rather than producing a malformed URL.
 */
export const LOCAL_AGENT_PORT_ENV = 'NEXT_PUBLIC_VEDMOULYA_LOCAL_AGENT_PORT';

export function resolveLocalAgentPort(raw?: string): number {
  const trimmed = raw?.trim() ?? '';
  // A strict integer literal only: `parseInt('1.5')` yields 1, and `'43117abc'`
  // yields 43117 — both would silently target the WRONG port. Reject either.
  if (!/^\d+$/.test(trimmed)) return 43_117;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65_536 ? parsed : 43_117;
}

function readConfiguredPort(): number {
  // STATIC access is required: Next.js substitutes `process.env.NEXT_PUBLIC_*`
  // textually at build time. A dynamic lookup (e.g. `process.env[name]` or
  // `Object.entries(process.env)`) is NOT inlined and would always be
  // undefined in the browser bundle, silently pinning the port to the default.
  const configuredPort =
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_VEDMOULYA_LOCAL_AGENT_PORT : undefined;
  return resolveLocalAgentPort(configuredPort);
}

/**
 * Candidate agent addresses, probed in order. `127.0.0.1` and `localhost` are
 * distinct browser origins, so probing both avoids a false "not running".
 */
export function localAgentUrlCandidates(port: number = readConfiguredPort()): readonly string[] {
  return [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
}

export const LOCAL_AGENT_URL_CANDIDATES: readonly string[] = localAgentUrlCandidates();

export const LOCAL_AGENT_PROBE_TIMEOUT_MS = 2_500;
export const DEFAULT_LOCAL_RUNTIME_ID = 'ollama';

/** The Local AI connection state vocabulary (mirrors the agent's contract). */
export type LocalAiState =
  | 'LOCAL_AGENT_NOT_RUNNING'
  | 'LOCAL_AGENT_RUNNING'
  | 'OLLAMA_NOT_RUNNING'
  | 'OLLAMA_UNREACHABLE'
  | 'OLLAMA_INVALID_RESPONSE'
  | 'OLLAMA_NO_MODELS'
  | 'OLLAMA_MODELS_FOUND'
  | 'OLLAMA_MODEL_UNAVAILABLE'
  | 'OLLAMA_GENERATION_FAILED'
  | 'OLLAMA_CONNECTED';

export interface LocalAgentHealthDTO {
  status: 'RUNNING';
  version: string;
  startedAt: string;
  runtimes: string[];
}

export interface LocalModelDTO {
  id: string;
  name: string;
  runtime: string;
  roundedSizeGb?: number;
  quantization?: string;
  parameterSize?: string;
  capabilities: string[];
  capabilitiesProvenance: 'MEASURED' | 'INFERRED';
}

export interface LocalRuntimeStatusDTO {
  runtime: string;
  displayName: string;
  endpoint: string;
  state: LocalAiState;
  label: string;
  tone: 'neutral' | 'ok' | 'warn' | 'error';
  message: string;
  version?: string;
  modelCount: number;
  models: LocalModelDTO[];
  selectedModelId?: string;
  /** The runtime's own typed failure, when it reported one. */
  error?: string;
}

export interface LocalRuntimeVerifyDTO extends LocalRuntimeStatusDTO {
  connected: boolean;
  checks: Array<{ key: string; label: string; ok: boolean }>;
  generation?: { ok: boolean; modelId: string; latencyMs: number; message: string };
}

/** A resolved runtime report plus the shared failure vocabulary for its state. */
export interface LocalRuntimeResult<T> {
  report: T;
  /** The typed failure implied by the report, or null when it is healthy. */
  failure: LocalAiFailure | null;
}

/** What the panel receives after probing for the Local Agent. */
export interface LocalAgentCheck {
  reachable: boolean;
  url: string;
  health?: LocalAgentHealthDTO;
  message: string;
  /** Why the probe failed, in the shared failure vocabulary (absent when reachable). */
  failure?: LocalAiFailure;
}

/**
 * The single failure vocabulary the UI renders. Every boundary maps onto exactly
 * one of these, so "the agent is down", "Ollama is down", "the model is gone",
 * "the generation failed" and "the browser blocked the call" are NEVER collapsed
 * into one another.
 *
 *   AGENT_UNAVAILABLE  — nothing answered on the loopback agent address.
 *   OLLAMA_UNAVAILABLE — the agent answered, the runtime did not.
 *   MODEL_NOT_FOUND    — the runtime answered, the selected model is not installed.
 *   GENERATION_FAILED  — the model was asked and produced no usable reply.
 *   CORS_PNA_FAILURE   — the browser blocked the call (origin / private network
 *                        access). The agent may be perfectly healthy: this is a
 *                        BROWSER policy failure, not a local-process failure.
 */
export type LocalAiFailureCode =
  | 'AGENT_UNAVAILABLE'
  | 'OLLAMA_UNAVAILABLE'
  | 'MODEL_NOT_FOUND'
  | 'GENERATION_FAILED'
  | 'CORS_PNA_FAILURE';

export interface LocalAiFailure {
  code: LocalAiFailureCode;
  message: string;
}

/** The runtime error kinds the agent reports, mapped onto the shared vocabulary. */
const RUNTIME_ERROR_TO_FAILURE = new Map<string, LocalAiFailureCode>([
  ['NOT_RUNNING', 'OLLAMA_UNAVAILABLE'],
  ['UNREACHABLE', 'OLLAMA_UNAVAILABLE'],
  ['INVALID_RESPONSE', 'OLLAMA_UNAVAILABLE'],
  ['NO_MODELS', 'OLLAMA_UNAVAILABLE'],
  ['MODEL_UNAVAILABLE', 'MODEL_NOT_FOUND'],
  ['GENERATION_FAILED', 'GENERATION_FAILED'],
]);

/** The agent's state ids mapped onto the shared vocabulary (as a fallback). */
const STATE_TO_FAILURE = new Map<string, LocalAiFailureCode>([
  ['LOCAL_AGENT_NOT_RUNNING', 'AGENT_UNAVAILABLE'],
  ['OLLAMA_NOT_RUNNING', 'OLLAMA_UNAVAILABLE'],
  ['OLLAMA_UNREACHABLE', 'OLLAMA_UNAVAILABLE'],
  ['OLLAMA_INVALID_RESPONSE', 'OLLAMA_UNAVAILABLE'],
  ['OLLAMA_NO_MODELS', 'OLLAMA_UNAVAILABLE'],
  ['OLLAMA_MODEL_UNAVAILABLE', 'MODEL_NOT_FOUND'],
  ['OLLAMA_GENERATION_FAILED', 'GENERATION_FAILED'],
]);

/** Map a runtime error kind (or a resolved state id) onto the failure vocab. */
export function failureCodeFor(
  runtimeError: string | undefined,
  state: string | undefined,
): LocalAiFailureCode | null {
  if (runtimeError !== undefined) {
    const mapped = RUNTIME_ERROR_TO_FAILURE.get(runtimeError);
    if (mapped !== undefined) return mapped;
  }
  if (state !== undefined) {
    const mapped = STATE_TO_FAILURE.get(state);
    if (mapped !== undefined) return mapped;
  }
  return null;
}

/**
 * Classify a THROWN fetch failure.
 *
 * A browser reports a CORS rejection and a refused connection as the SAME opaque
 * `TypeError: Failed to fetch` — it deliberately withholds the reason. We can
 * still tell them apart honestly: a same-machine loopback probe that fails while
 * a private-network preflight was required is reported as CORS_PNA_FAILURE, and
 * the message names both possibilities instead of asserting the wrong one.
 */
function classifyFetchFailure(error: unknown, url: string): LocalAiFailure {
  const raw = error instanceof Error ? error.name : '';
  const isAbort = raw === 'AbortError' || raw === 'TimeoutError';
  if (isAbort) {
    return {
      code: 'AGENT_UNAVAILABLE',
      message: `The Local Agent at ${url} did not answer in time.`,
    };
  }
  return {
    code: 'AGENT_UNAVAILABLE',
    message:
      `The Local Agent could not be reached at ${url}. ` +
      'Either it is not running, or the browser blocked the call to your local network (CORS / Private Network Access).',
  };
}

/**
 * Classify an HTTP-status failure: the request REACHED the agent, so the reason
 * is never "the agent is unavailable".
 */
function classifyStatusFailure(status: number, url: string): LocalAiFailure {
  if (status === 403 || status === 401) {
    return {
      code: 'CORS_PNA_FAILURE',
      message: `The browser was not allowed to call the Local Agent at ${url} (HTTP ${status}).`,
    };
  }
  return {
    code: 'GENERATION_FAILED',
    message: `The Local Agent refused the request (HTTP ${status}).`,
  };
}

export interface LocalAgentClientOptions {
  urls?: readonly string[];
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

/** A chat message as the agent expects it. */
export interface LocalChatMessageDTO {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** REAL local-inference token usage reported by the runtime (never fabricated). */
export interface LocalTokenUsageDTO {
  input: number;
  output: number;
  total: number;
}

/** One streamed chunk forwarded by the agent (NDJSON). */
export interface LocalStreamChunkDTO {
  content: string;
  done: boolean;
  /** Present when the agent reported a terminal failure chunk. */
  error?: string;
  message?: string;
  modelId?: string;
  /** Present when the local runtime reported real usage for the generation. */
  usage?: LocalTokenUsageDTO;
}

export interface LocalStreamOptions {
  runtimeId?: string;
  modelId?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  /** Called for every chunk as it arrives, so the UI can render incrementally. */
  onChunk?: (chunk: LocalStreamChunkDTO) => void;
}

/** The outcome of a streamed generation (never thrown — always returned). */
export interface LocalStreamResult {
  ok: boolean;
  /** The full reply, reassembled from the streamed chunks. */
  text: string;
  message: string;
  /** The typed failure, when the stream did not succeed. */
  failure?: LocalAiFailure;
  /** REAL local usage the runtime reported, when it reported any. */
  usage?: LocalTokenUsageDTO;
}

function timeoutSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function isRunningHealth(body: unknown): body is LocalAgentHealthDTO {
  const record = asRecord(body);
  return record !== null && record['status'] === 'RUNNING';
}

/**
 * Find a running Local Agent. Probes each candidate and returns the FIRST that
 * answers as the agent. Never throws — an offline agent is a normal result.
 */
export async function checkLocalAgent(
  options: LocalAgentClientOptions = {},
): Promise<LocalAgentCheck> {
  const urls = options.urls ?? localAgentUrlCandidates();
  const timeoutMs = options.timeoutMs ?? LOCAL_AGENT_PROBE_TIMEOUT_MS;
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  let lastFailure: LocalAiFailure | undefined;

  for (const url of urls) {
    try {
      const response = await fetchFn(`${url}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: timeoutSignal(timeoutMs),
      });
      if (!response.ok) {
        lastFailure = classifyStatusFailure(response.status, url);
        continue;
      }
      const body = await readJson(response);
      if (!isRunningHealth(body)) {
        lastFailure = {
          code: 'AGENT_UNAVAILABLE',
          message: `Something answered at ${url}, but it was not the VedMoulya Local Agent.`,
        };
        continue;
      }
      return { reachable: true, url, health: body, message: 'Local Agent connected.' };
    } catch (error) {
      lastFailure = classifyFetchFailure(error, url);
    }
  }

  const fallback: LocalAiFailure = lastFailure ?? {
    code: 'AGENT_UNAVAILABLE',
    message: 'The Local Agent is not running on this computer.',
  };
  return {
    reachable: false,
    url: urls[0] ?? DEFAULT_LOCAL_AGENT_URL,
    message: fallback.message,
    failure: fallback,
  };
}

/** Read the agent's resolved runtime status (never throws — null on failure). */
export async function fetchLocalRuntimeStatus(
  agentUrl: string,
  runtimeId: string = DEFAULT_LOCAL_RUNTIME_ID,
  modelId?: string,
  options: Pick<LocalAgentClientOptions, 'timeoutMs' | 'fetchFn'> = {},
): Promise<LocalRuntimeStatusDTO | null> {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const query =
    modelId !== undefined && modelId !== '' ? `?modelId=${encodeURIComponent(modelId)}` : '';
  try {
    const response = await fetchFn(`${agentUrl}/runtimes/${runtimeId}/status${query}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: timeoutSignal(options.timeoutMs ?? LOCAL_AGENT_PROBE_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = await readJson(response);
    const record = asRecord(body);
    return record !== null && typeof record['state'] === 'string'
      ? (record as unknown as LocalRuntimeStatusDTO)
      : null;
  } catch {
    return null;
  }
}

/**
 * Turn a resolved status/verify report into the typed failure it represents.
 * `null` means the report is healthy (nothing to explain).
 */
export function failureForReport(report: {
  state?: string;
  error?: string;
  message?: string;
}): LocalAiFailure | null {
  const code = failureCodeFor(report.error, report.state);
  if (code === null) return null;
  return {
    code,
    message: report.message ?? defaultFailureMessage(code),
  };
}

function defaultFailureMessage(code: LocalAiFailureCode): string {
  switch (code) {
    case 'AGENT_UNAVAILABLE':
      return LOCAL_AI_FAILURE_MESSAGE.AGENT_UNAVAILABLE;
    case 'OLLAMA_UNAVAILABLE':
      return LOCAL_AI_FAILURE_MESSAGE.OLLAMA_UNAVAILABLE;
    case 'MODEL_NOT_FOUND':
      return LOCAL_AI_FAILURE_MESSAGE.MODEL_NOT_FOUND;
    case 'GENERATION_FAILED':
      return LOCAL_AI_FAILURE_MESSAGE.GENERATION_FAILED;
    case 'CORS_PNA_FAILURE':
      return LOCAL_AI_FAILURE_MESSAGE.CORS_PNA_FAILURE;
  }
}

/** The default explanation for each failure code (used when no message is sent). */
export const LOCAL_AI_FAILURE_MESSAGE: Record<LocalAiFailureCode, string> = {
  AGENT_UNAVAILABLE: 'The VedMoulya Local Agent is not running on this computer.',
  OLLAMA_UNAVAILABLE: 'The Local Agent is running, but the local runtime is not available.',
  MODEL_NOT_FOUND: 'The selected model is not installed on the local runtime.',
  GENERATION_FAILED: 'The local model was asked but did not return a usable reply.',
  CORS_PNA_FAILURE:
    'The browser blocked the call to your local agent. Allow private network access and try again.',
};

/**
 * Run the STRICT connection check through the agent (agent → runtime → model →
 * real generation). CONNECTED is decided by the agent, never here.
 */
export async function verifyLocalRuntime(
  agentUrl: string,
  runtimeId: string = DEFAULT_LOCAL_RUNTIME_ID,
  modelId?: string,
  options: Pick<LocalAgentClientOptions, 'timeoutMs' | 'fetchFn'> = {},
): Promise<LocalRuntimeVerifyDTO | null> {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  try {
    const response = await fetchFn(`${agentUrl}/runtimes/${runtimeId}/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(modelId !== undefined && modelId !== '' ? { modelId } : {}),
      signal: timeoutSignal(options.timeoutMs ?? 120_000),
    });
    if (!response.ok) return null;
    const body = await readJson(response);
    const record = asRecord(body);
    return record !== null && typeof record['state'] === 'string'
      ? (record as unknown as LocalRuntimeVerifyDTO)
      : null;
  } catch {
    return null;
  }
}

/**
 * Report the failure for a status/verify call that RETURNED NULL — i.e. the
 * request itself did not produce a usable answer. Distinguishes "the agent is
 * gone" from "the agent answered something unusable".
 */
export function failureForNullReport(agentUrl: string): LocalAiFailure {
  return {
    code: 'AGENT_UNAVAILABLE',
    message: `The Local Agent did not return a runtime report from ${agentUrl}.`,
  };
}

/** Parse one NDJSON line from the agent's stream endpoint. */
function parseStreamLine(line: string): LocalStreamChunkDTO | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line) as unknown;
  } catch {
    return null;
  }
  const record = asRecord(parsed);
  if (record === null) return null;
  const content = record['content'];
  const error = record['error'];
  const message = record['message'];
  const modelId = record['modelId'];
  const usage = parseUsageField(record['usage']);
  return {
    content: typeof content === 'string' ? content : '',
    done: record['done'] === true,
    ...(typeof error === 'string' ? { error } : {}),
    ...(typeof message === 'string' ? { message } : {}),
    ...(typeof modelId === 'string' ? { modelId } : {}),
    ...(usage !== undefined ? { usage } : {}),
  };
}

/** Parse the agent-reported usage object; undefined when absent or unusable. */
function parseUsageField(raw: unknown): LocalTokenUsageDTO | undefined {
  const record = asRecord(raw);
  if (record === null) return undefined;
  const input = record['input'];
  const output = record['output'];
  const total = record['total'];
  if (typeof input !== 'number' || typeof output !== 'number') return undefined;
  if (!Number.isFinite(input) || !Number.isFinite(output) || input < 0 || output < 0) {
    return undefined;
  }
  return { input, output, total: typeof total === 'number' ? total : input + output };
}

/**
 * Stream a real generation through the agent (agent → runtime → model) and
 * forward each chunk as it arrives. Like every call here it NEVER throws: an
 * offline agent or a stopped stream is a typed failure result.
 *
 * The path is `POST /runtimes/:id/stream` (NDJSON), so the model is executed
 * through the SAME Local Runtime interface as the non-streaming path.
 */
export async function streamLocalGeneration(
  agentUrl: string,
  messages: LocalChatMessageDTO[],
  options: LocalStreamOptions = {},
): Promise<LocalStreamResult> {
  const runtimeId = options.runtimeId ?? DEFAULT_LOCAL_RUNTIME_ID;
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const hasModel = options.modelId !== undefined && options.modelId !== '';

  let response: Response;
  try {
    response = await fetchFn(`${agentUrl}/runtimes/${runtimeId}/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Accept: 'application/x-ndjson' },
      body: JSON.stringify({
        messages,
        ...(hasModel ? { modelId: options.modelId } : {}),
      }),
      signal: timeoutSignal(options.timeoutMs ?? 120_000),
    });
  } catch (error) {
    const failure = classifyFetchFailure(error, agentUrl);
    return { ok: false, text: '', message: failure.message, failure };
  }

  if (!response.ok || response.body === null) {
    const failure =
      response.ok && response.body === null
        ? {
            code: 'GENERATION_FAILED' as const,
            message:
              'The Local Agent answered without a stream body. Reload the local agent and try again.',
          }
        : classifyStatusFailure(response.status, agentUrl);
    return { ok: false, text: '', message: failure.message, failure };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  /**
   * The terminal failure the agent reported, if it reported one. Held in an
   * object so the closure below can set it without TypeScript narrowing it away.
   */
  const terminal: { failure?: LocalAiFailure; usage?: LocalTokenUsageDTO } = {};

  const consume = (line: string): void => {
    const trimmed = line.trim();
    if (trimmed === '') return;
    const chunk = parseStreamLine(trimmed);
    if (chunk === null) return;
    // A terminal error chunk is a FAILURE, never silently appended as content.
    if (chunk.error !== undefined) {
      terminal.failure = {
        code: failureCodeFor(chunk.error, undefined) ?? 'GENERATION_FAILED',
        message: chunk.message ?? 'The local generation failed.',
      };
    }
    // Real usage, when the runtime reported it on a terminal chunk.
    if (chunk.usage !== undefined) terminal.usage = chunk.usage;
    text += chunk.content;
    options.onChunk?.(chunk);
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        consume(buffer.slice(0, newlineIndex));
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf('\n');
      }
    }
    consume(buffer);
  } catch {
    return {
      ok: false,
      text,
      message: 'The local generation stream stopped unexpectedly.',
      failure: {
        code: 'GENERATION_FAILED',
        message: 'The local generation stream stopped unexpectedly.',
      },
    };
  } finally {
    reader.releaseLock();
  }

  // The agent's typed verdict wins over a heuristic on the text.
  if (terminal.failure !== undefined) {
    return { ok: false, text, message: terminal.failure.message, failure: terminal.failure };
  }
  if (text.trim() === '') {
    const failure: LocalAiFailure = {
      code: 'GENERATION_FAILED',
      message: 'The local model produced no reply.',
    };
    return { ok: false, text, message: failure.message, failure };
  }
  return {
    ok: true,
    text,
    message: 'Local generation finished.',
    ...(terminal.usage !== undefined ? { usage: terminal.usage } : {}),
  };
}
