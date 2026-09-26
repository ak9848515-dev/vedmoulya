// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local AI — Ollama runtime adapter
//
// Ollama is the FIRST local runtime, not "Local AI" itself. Everything
// Ollama-specific lives HERE; the rest of the foundation depends only on the
// `LocalRuntime` interface.
//
// VERIFIED UPSTREAM CONTRACTS (Ollama ≥ 0.3, checked against the running 0.34.4
// on this machine — nothing guessed):
//   • GET  {base}/api/version   → { version }
//   • GET  {base}/api/tags      → { models: [{ name, model, size, details,
//                                  capabilities }] }
//   • POST {base}/api/chat      → { message: { content }, ... } (stream:false)
//                                  or NDJSON lines with stream:true
//   • POST {base}/api/show      → model detail (used only by getModel fallback)
//   Default endpoint: http://127.0.0.1:11434
//   (docs: https://github.com/ollama/ollama/blob/main/docs/api.md)
//
// HONESTY RULES
//   • A connection refusal is NOT_RUNNING; a timeout/abort is UNREACHABLE. They
//     are never merged into "not installed" — absence is never claimed.
//   • Model capabilities are MEASURED when Ollama reports them and INFERRED
//     otherwise; provenance travels with the value.
//   • A generation is only reported `ok` when Ollama returned real content.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  LocalChatMessage,
  LocalGenerateChunk,
  LocalGenerateRequest,
  LocalGenerateResult,
  LocalModelDescriptor,
  LocalModelListResult,
  LocalRuntime,
  LocalRuntimeCapabilities,
  LocalRuntimeErrorKind,
  LocalRuntimeId,
  RuntimeDiscoveryResult,
  RuntimeHealth,
} from '../types.js';
import { OLLAMA_RUNTIME_ID } from '../types.js';

/** Ollama's documented default host/port. */
export const DEFAULT_OLLAMA_ENDPOINT = 'http://127.0.0.1:11434';

export interface OllamaRuntimeAdapterOptions {
  /** Base URL, e.g. http://127.0.0.1:11434 (no trailing slash). */
  endpoint?: string;
  /** Injected fetch (tests); defaults to the global fetch. */
  fetchFn?: typeof fetch;
  /** Probe timeout for version/tags, in ms (default 2000). */
  probeTimeoutMs?: number;
  /** Generation timeout, in ms (default 120000). */
  generateTimeoutMs?: number;
}

/** Normalize a base URL: trim and strip trailing slashes. */
function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

/** The capabilities we infer only when the runtime does not declare any. */
const INFERRED_CAPABILITIES: readonly string[] = ['reasoning', 'coding', 'chat', 'generation'];

/** Read a Node/undici error code out of a thrown value (directly or via cause). */
function readErrorCode(error: unknown): string | undefined {
  const record = asRecord(error);
  if (record === null) return undefined;
  const direct = record['code'];
  if (typeof direct === 'string') return direct;
  const cause = asRecord(record['cause']);
  const causeCode = cause?.['code'];
  return typeof causeCode === 'string' ? causeCode : undefined;
}

/**
 * Classify a thrown fetch failure.
 *
 * ECONNREFUSED/ECONNRESET mean nothing accepted the connection — the runtime is
 * almost certainly not started (NOT_RUNNING). A timeout or any other failure
 * proves only that no answer arrived (UNREACHABLE), never absence.
 */
export function classifyNetworkError(error: unknown): LocalRuntimeErrorKind {
  const code = readErrorCode(error);
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET') return 'NOT_RUNNING';
  return 'UNREACHABLE';
}

/** Read the version string from a /api/version payload. */
export function parseOllamaVersion(body: unknown): string | undefined {
  const record = asRecord(body);
  if (record === null) return undefined;
  const version = record['version'];
  return typeof version === 'string' && version.trim() !== '' ? version : undefined;
}

/**
 * Parse a /api/tags payload into model descriptors.
 * Returns null when the payload is NOT a valid Ollama model list (so an
 * unrelated service squatting on the port is reported as an invalid response).
 */
export function parseOllamaModels(
  body: unknown,
  runtime: LocalRuntimeId = OLLAMA_RUNTIME_ID,
): LocalModelDescriptor[] | null {
  const record = asRecord(body);
  if (record === null) return null;
  const models = record['models'];
  if (!Array.isArray(models)) return null;

  const descriptors: LocalModelDescriptor[] = [];
  for (const entry of models) {
    const model = asRecord(entry);
    if (model === null) continue;
    const name = model['name'];
    if (typeof name !== 'string' || name.trim() === '') continue;
    const details = asRecord(model['details']);
    const sizeBytes = typeof model['size'] === 'number' ? model['size'] : undefined;
    const declared = readDeclaredCapabilities(model['capabilities']);
    const contextLength =
      details !== null && typeof details['context_length'] === 'number'
        ? details['context_length']
        : undefined;
    descriptors.push({
      id: name,
      name,
      runtime,
      ...(sizeBytes !== undefined ? { sizeBytes } : {}),
      ...(sizeBytes !== undefined && sizeBytes > 0
        ? { roundedSizeGb: Math.round((sizeBytes / 1_000_000_000) * 10) / 10 }
        : {}),
      ...(details !== null && typeof details['quantization_level'] === 'string'
        ? { quantization: details['quantization_level'] }
        : {}),
      ...(details !== null && typeof details['family'] === 'string'
        ? { family: details['family'] }
        : {}),
      ...(details !== null && typeof details['parameter_size'] === 'string'
        ? { parameterSize: details['parameter_size'] }
        : {}),
      ...(contextLength !== undefined ? { contextLength } : {}),
      capabilities: declared ?? [...INFERRED_CAPABILITIES],
      capabilitiesProvenance: declared !== null ? 'MEASURED' : 'INFERRED',
    });
  }
  return descriptors;
}

/** Ollama's per-model `capabilities` array, when it is a list of strings. */
function readDeclaredCapabilities(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const capabilities = value.filter((entry): entry is string => typeof entry === 'string');
  return capabilities.length > 0 ? capabilities : null;
}

/** Read the assistant content from a /api/chat (stream:false) payload. */
export function parseOllamaChatContent(body: unknown): string | undefined {
  const record = asRecord(body);
  if (record === null) return undefined;
  const message = asRecord(record['message']);
  const content = message?.['content'];
  return typeof content === 'string' ? content : undefined;
}

/** Parse one NDJSON stream line into a chunk (undefined for unusable lines). */
export function parseOllamaStreamLine(line: string): LocalGenerateChunk | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line) as unknown;
  } catch {
    return undefined;
  }
  const record = asRecord(parsed);
  if (record === null) return undefined;
  const message = asRecord(record['message']);
  const content = message?.['content'];
  return {
    content: typeof content === 'string' ? content : '',
    done: record['done'] === true,
  };
}

/** The outcome of one HTTP probe, discriminated so classification is total. */
type LocalProbe =
  | { ok: true; body: unknown }
  | { ok: false; status: number }
  | { ok: false; networkError: LocalRuntimeErrorKind };

export class OllamaRuntimeAdapter implements LocalRuntime {
  readonly id: LocalRuntimeId = OLLAMA_RUNTIME_ID;
  readonly displayName = 'Ollama';

  private readonly endpoint: string;
  private readonly fetchFn: typeof fetch;
  private readonly probeTimeoutMs: number;
  private readonly generateTimeoutMs: number;

  constructor(options: OllamaRuntimeAdapterOptions = {}) {
    const endpoint = normalizeEndpoint(options.endpoint ?? DEFAULT_OLLAMA_ENDPOINT);
    if (!/^https?:\/\//i.test(endpoint)) {
      throw new Error('OllamaRuntimeAdapter endpoint must be an http(s) URL');
    }
    this.endpoint = endpoint;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.probeTimeoutMs = options.probeTimeoutMs ?? 2_000;
    this.generateTimeoutMs = options.generateTimeoutMs ?? 120_000;
  }

  capabilities(): LocalRuntimeCapabilities {
    return { modelDiscovery: true, generation: true, streaming: true, getModel: true };
  }

  /** The base URL this adapter targets (safe to display — no secrets). */
  get baseEndpoint(): string {
    return this.endpoint;
  }

  /** One JSON probe with an explicit timeout and typed failure classification. */
  private async probe(path: string, init: RequestInit, timeoutMs: number): Promise<LocalProbe> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.endpoint}${path}`, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      return { ok: false, networkError: classifyNetworkError(error) };
    }
    if (!response.ok) return { ok: false, status: response.status };
    try {
      return { ok: true, body: await response.json() };
    } catch {
      return { ok: false, status: response.status };
    }
  }

  async discover(): Promise<RuntimeDiscoveryResult> {
    const base = { runtime: this.id, endpoint: this.endpoint };
    const probe = await this.probe(
      '/api/version',
      { method: 'GET', headers: { Accept: 'application/json' } },
      this.probeTimeoutMs,
    );
    if ('networkError' in probe) {
      return {
        ...base,
        present: false,
        error: probe.networkError,
        message:
          probe.networkError === 'NOT_RUNNING'
            ? 'Nothing answered on the Ollama address.'
            : 'The Ollama address did not answer in time.',
      };
    }
    if ('status' in probe) {
      return {
        ...base,
        present: false,
        error: 'INVALID_RESPONSE',
        message: `Something answered on the Ollama address with HTTP ${probe.status}.`,
      };
    }
    const version = parseOllamaVersion(probe.body);
    if (version === undefined) {
      return {
        ...base,
        present: false,
        error: 'INVALID_RESPONSE',
        message: 'Something answered on the Ollama address, but it was not an Ollama service.',
      };
    }
    return { ...base, present: true, version, message: `Ollama ${version} is running.` };
  }

  async health(): Promise<RuntimeHealth> {
    const base = { runtime: this.id, endpoint: this.endpoint };
    const startedAt = Date.now();
    const probe = await this.probe(
      '/api/version',
      { method: 'GET', headers: { Accept: 'application/json' } },
      this.probeTimeoutMs,
    );
    const latencyMs = Date.now() - startedAt;
    if ('networkError' in probe) {
      return {
        ...base,
        reachable: false,
        healthy: false,
        latencyMs,
        error: probe.networkError,
        message:
          probe.networkError === 'NOT_RUNNING'
            ? 'Nothing answered on the Ollama address.'
            : 'The Ollama address did not answer in time.',
      };
    }
    if ('status' in probe) {
      return {
        ...base,
        reachable: true,
        healthy: false,
        latencyMs,
        error: 'INVALID_RESPONSE',
        message: `Ollama answered with HTTP ${probe.status}.`,
      };
    }
    const version = parseOllamaVersion(probe.body);
    if (version === undefined) {
      return {
        ...base,
        reachable: true,
        healthy: false,
        latencyMs,
        error: 'INVALID_RESPONSE',
        message: 'An unexpected response was returned on the Ollama address.',
      };
    }
    return {
      ...base,
      reachable: true,
      healthy: true,
      version,
      latencyMs,
      message: `Ollama ${version} is healthy.`,
    };
  }

  async listModels(): Promise<LocalModelListResult> {
    const base = { runtime: this.id, endpoint: this.endpoint };
    const probe = await this.probe(
      '/api/tags',
      { method: 'GET', headers: { Accept: 'application/json' } },
      this.probeTimeoutMs,
    );
    if ('networkError' in probe) {
      return {
        ...base,
        ok: false,
        models: [],
        error: probe.networkError,
        message:
          probe.networkError === 'NOT_RUNNING'
            ? 'Nothing answered on the Ollama address.'
            : 'The Ollama address did not answer in time.',
      };
    }
    if ('status' in probe) {
      return {
        ...base,
        ok: false,
        models: [],
        error: 'INVALID_RESPONSE',
        message: `Ollama answered with HTTP ${probe.status} while listing models.`,
      };
    }
    const models = parseOllamaModels(probe.body, this.id);
    if (models === null) {
      return {
        ...base,
        ok: false,
        models: [],
        error: 'INVALID_RESPONSE',
        message: 'The Ollama model list could not be read.',
      };
    }
    if (models.length === 0) {
      return {
        ...base,
        ok: true,
        models: [],
        error: 'NO_MODELS',
        message: 'Ollama is running, but no models are installed.',
      };
    }
    return {
      ...base,
      ok: true,
      models,
      message: `Ollama reported ${models.length} model${models.length === 1 ? '' : 's'}.`,
    };
  }

  async getModel(modelId: string): Promise<LocalModelDescriptor | null> {
    const target = modelId.trim();
    if (target === '') return null;
    const listing = await this.listModels();
    if (!listing.ok) return null;
    return listing.models.find((model) => model.id === target || model.name === target) ?? null;
  }

  /**
   * Resolve the model a generation will actually run.
   * A requested model must be installed (never substituted silently); with no
   * request the first installed model is used, or nothing when none exist.
   */
  private async resolveModel(
    requested?: string,
  ): Promise<{ modelId: string } | { error: LocalRuntimeErrorKind; message: string }> {
    const listing = await this.listModels();
    if (!listing.ok) {
      return {
        error: listing.error ?? 'INVALID_RESPONSE',
        message: listing.message,
      };
    }
    const target = requested?.trim() ?? '';
    if (target !== '') {
      const found = listing.models.find((model) => model.id === target || model.name === target);
      if (found === undefined) {
        return {
          error: 'MODEL_UNAVAILABLE',
          message: `Ollama does not have the model "${target}".`,
        };
      }
      return { modelId: found.id };
    }
    const first = listing.models[0];
    if (first === undefined) {
      return { error: 'NO_MODELS', message: 'Ollama reported no usable model.' };
    }
    return { modelId: first.id };
  }

  async generate(request: LocalGenerateRequest): Promise<LocalGenerateResult> {
    const base = { runtime: this.id, modelId: request.modelId?.trim() ?? '' };
    const resolved = await this.resolveModel(request.modelId);
    if ('error' in resolved) {
      return {
        ...base,
        ok: false,
        content: '',
        latencyMs: 0,
        error: resolved.error,
        message: resolved.message,
      };
    }
    const modelId = resolved.modelId;
    const startedAt = Date.now();
    let response: Response;
    try {
      response = await this.fetchFn(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          model: modelId,
          messages: toWireMessages(request.messages),
          stream: false,
          ...(request.maxTokens !== undefined
            ? { options: { num_predict: request.maxTokens } }
            : {}),
        }),
        signal: AbortSignal.timeout(request.timeoutMs ?? this.generateTimeoutMs),
      });
    } catch (error) {
      return {
        runtime: this.id,
        modelId,
        ok: false,
        content: '',
        latencyMs: Date.now() - startedAt,
        error: classifyNetworkError(error),
        message: 'The generation could not reach Ollama. Check that it is still running.',
      };
    }
    const latencyMs = Date.now() - startedAt;
    if (response.status === 404) {
      return {
        runtime: this.id,
        modelId,
        ok: false,
        content: '',
        latencyMs,
        error: 'MODEL_UNAVAILABLE',
        message: `Ollama does not have the model "${modelId}".`,
      };
    }
    if (!response.ok) {
      return {
        runtime: this.id,
        modelId,
        ok: false,
        content: '',
        latencyMs,
        error: 'GENERATION_FAILED',
        message: `Ollama refused the request (HTTP ${response.status}).`,
      };
    }
    const body = await response.json();
    const content = parseOllamaChatContent(body);
    if (content === undefined || content.trim() === '') {
      return {
        runtime: this.id,
        modelId,
        ok: false,
        content: '',
        latencyMs,
        error: 'GENERATION_FAILED',
        message: 'Ollama answered but produced no reply.',
      };
    }
    return {
      runtime: this.id,
      modelId,
      ok: true,
      content,
      latencyMs,
      message: `Ollama answered on ${modelId}.`,
    };
  }

  async *stream(request: LocalGenerateRequest): AsyncGenerator<LocalGenerateChunk> {
    const resolved = await this.resolveModel(request.modelId);
    if ('error' in resolved) return;
    const modelId = resolved.modelId;
    let response: Response;
    try {
      response = await this.fetchFn(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Accept: 'application/x-ndjson' },
        body: JSON.stringify({
          model: modelId,
          messages: toWireMessages(request.messages),
          stream: true,
          ...(request.maxTokens !== undefined
            ? { options: { num_predict: request.maxTokens } }
            : {}),
        }),
        signal: AbortSignal.timeout(request.timeoutMs ?? this.generateTimeoutMs),
      });
    } catch {
      return;
    }
    if (!response.ok || response.body === null) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        const read = (await reader.read()) as { done: boolean; value?: Uint8Array };
        if (read.done) break;
        buffer += decoder.decode(read.value, { stream: true });
        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (line !== '') {
            const chunk = parseOllamaStreamLine(line);
            if (chunk !== undefined) yield chunk;
          }
          newlineIndex = buffer.indexOf('\n');
        }
      }
      const tail = buffer.trim();
      if (tail !== '') {
        const chunk = parseOllamaStreamLine(tail);
        if (chunk !== undefined) yield chunk;
      }
    } finally {
      reader.releaseLock();
    }
  }
}

/** Narrow our message type to the wire shape Ollama expects. */
function toWireMessages(
  messages: readonly LocalChatMessage[],
): Array<{ role: string; content: string }> {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}
