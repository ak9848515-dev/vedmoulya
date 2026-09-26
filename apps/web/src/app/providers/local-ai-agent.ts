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
 * Candidate agent addresses, probed in order. `127.0.0.1` and `localhost` are
 * distinct browser origins, so probing both avoids a false "not running".
 */
export const LOCAL_AGENT_URL_CANDIDATES: readonly string[] = [
  'http://127.0.0.1:43117',
  'http://localhost:43117',
];

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
}

export interface LocalRuntimeVerifyDTO extends LocalRuntimeStatusDTO {
  connected: boolean;
  checks: Array<{ key: string; label: string; ok: boolean }>;
  generation?: { ok: boolean; modelId: string; latencyMs: number; message: string };
}

/** What the panel receives after probing for the Local Agent. */
export interface LocalAgentCheck {
  reachable: boolean;
  url: string;
  health?: LocalAgentHealthDTO;
  message: string;
}

export interface LocalAgentClientOptions {
  urls?: readonly string[];
  timeoutMs?: number;
  fetchFn?: typeof fetch;
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
  const urls = options.urls ?? LOCAL_AGENT_URL_CANDIDATES;
  const timeoutMs = options.timeoutMs ?? LOCAL_AGENT_PROBE_TIMEOUT_MS;
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  let lastError = '';

  for (const url of urls) {
    try {
      const response = await fetchFn(`${url}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: timeoutSignal(timeoutMs),
      });
      if (!response.ok) {
        lastError = `The Local Agent answered with HTTP ${response.status}.`;
        continue;
      }
      const body = await readJson(response);
      if (!isRunningHealth(body)) {
        lastError = 'Something answered, but it was not the VedMoulya Local Agent.';
        continue;
      }
      return { reachable: true, url, health: body, message: 'Local Agent connected.' };
    } catch {
      lastError = 'The Local Agent is not running on this computer.';
    }
  }

  return {
    reachable: false,
    url: urls[0] ?? DEFAULT_LOCAL_AGENT_URL,
    message: lastError === '' ? 'The Local Agent is not running on this computer.' : lastError,
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
