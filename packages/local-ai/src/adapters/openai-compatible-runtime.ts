// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local AI — OpenAI-compatible runtime adapter (LM Studio and friends)
//
// The FIRST runtime installed was Ollama, but the Local Runtime interface is
// deliberately not Ollama-shaped. This adapter proves it: LM Studio (and any
// other OpenAI-compatible local server: llama.cpp server, vLLM, Jan, …) is
// added by implementing the SAME interface — the agent, the HTTP server and the
// web contract are untouched.
//
// VERIFIED UPSTREAM CONTRACTS (OpenAI-compatible HTTP API):
//   • GET  {base}/v1/models              → { data: [{ id, object, owned_by }] }
//   • POST {base}/v1/chat/completions    → { choices: [{ message: { content } }] }
//   • POST {base}/v1/chat/completions    with stream:true → Server-Sent Events
//                                          ("data: {…}" lines, then "data: [DONE]")
//   LM Studio's default endpoint: http://127.0.0.1:1234
//
// HONESTY RULES (identical to the Ollama adapter)
//   • A connection refusal is NOT_RUNNING; a timeout/abort is UNREACHABLE.
//   • This API does not expose a version or declared capabilities, so no version
//     is claimed and model capabilities are INFERRED — never presented as
//     verified facts.
//   • A generation is only `ok` when real assistant content came back.
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
import { asRecord, classifyNetworkError } from './http.js';

/** LM Studio's documented default host/port. */
export const DEFAULT_LM_STUDIO_ENDPOINT = 'http://127.0.0.1:1234';

/** The capabilities inferred for an OpenAI-compatible model (the API declares none). */
const INFERRED_CAPABILITIES: readonly string[] = ['reasoning', 'coding', 'chat', 'generation'];

export interface OpenAICompatibleRuntimeOptions {
  /** Base URL, e.g. http://127.0.0.1:1234 (no trailing slash). */
  endpoint?: string;
  /** Runtime id this adapter presents as (default 'lm-studio'). */
  id?: LocalRuntimeId;
  /** Human name shown in the UI (default 'LM Studio'). */
  displayName?: string;
  /** Injected fetch (tests); defaults to the global fetch. */
  fetchFn?: typeof fetch;
  /** Probe timeout for /v1/models, in ms (default 2000). */
  probeTimeoutMs?: number;
  /** Generation timeout, in ms (default 120000). */
  generateTimeoutMs?: number;
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '');
}

/** Parse `{ data: [{ id }] }` into model ids (null when the shape is invalid). */
export function parseOpenAiModelIds(body: unknown): string[] | null {
  const record = asRecord(body);
  if (record === null) return null;
  const data = record['data'];
  if (!Array.isArray(data)) return null;
  const ids: string[] = [];
  for (const entry of data) {
    const model = asRecord(entry);
    if (model === null) continue;
    const id = model['id'];
    if (typeof id === 'string' && id.trim() !== '') ids.push(id);
  }
  return ids;
}

/** Read the assistant content from a chat-completions payload. */
export function parseOpenAiChatContent(body: unknown): string | undefined {
  const record = asRecord(body);
  if (record === null) return undefined;
  const choices = record['choices'];
  if (!Array.isArray(choices)) return undefined;
  const first = asRecord(choices[0]);
  const message = asRecord(first?.['message']);
  const content = message?.['content'];
  return typeof content === 'string' ? content : undefined;
}

/**
 * Parse one SSE line into a streamed chunk.
 * Returns undefined for lines that carry no data; a `[DONE]` sentinel becomes a
 * terminal chunk.
 */
export function parseOpenAiStreamLine(line: string): LocalGenerateChunk | undefined {
  const trimmed = line.trim();
  if (trimmed === '' || !trimmed.startsWith('data:')) return undefined;
  const payload = trimmed.slice('data:'.length).trim();
  if (payload === '') return undefined;
  if (payload === '[DONE]') return { content: '', done: true };
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload) as unknown;
  } catch {
    return undefined;
  }
  const record = asRecord(parsed);
  if (record === null) return undefined;
  const choices = record['choices'];
  if (!Array.isArray(choices)) return undefined;
  const first = asRecord(choices[0]);
  const delta = asRecord(first?.['delta']);
  const content = delta?.['content'];
  const done = first?.['finish_reason'] !== undefined && first['finish_reason'] !== null;
  return { content: typeof content === 'string' ? content : '', done };
}

/** The outcome of one HTTP probe, discriminated so classification is total. */
type LocalProbe =
  | { ok: true; body: unknown }
  | { ok: false; status: number }
  | { ok: false; networkError: LocalRuntimeErrorKind };

export class OpenAICompatibleRuntimeAdapter implements LocalRuntime {
  readonly id: LocalRuntimeId;
  readonly displayName: string;

  private readonly endpoint: string;
  private readonly fetchFn: typeof fetch;
  private readonly probeTimeoutMs: number;
  private readonly generateTimeoutMs: number;

  constructor(options: OpenAICompatibleRuntimeOptions = {}) {
    const endpoint = normalizeEndpoint(options.endpoint ?? DEFAULT_LM_STUDIO_ENDPOINT);
    if (!/^https?:\/\//i.test(endpoint)) {
      throw new Error('OpenAICompatibleRuntimeAdapter endpoint must be an http(s) URL');
    }
    this.endpoint = endpoint;
    this.id = options.id ?? 'lm-studio';
    this.displayName = options.displayName ?? 'LM Studio';
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

  private describeFailure(probe: LocalProbe & { ok: false }): {
    error: LocalRuntimeErrorKind;
    message: string;
  } {
    if ('networkError' in probe) {
      return {
        error: probe.networkError,
        message:
          probe.networkError === 'NOT_RUNNING'
            ? `Nothing answered on the ${this.displayName} address.`
            : `The ${this.displayName} address did not answer in time.`,
      };
    }
    return {
      error: 'INVALID_RESPONSE',
      message: `Something answered on the ${this.displayName} address with HTTP ${probe.status}.`,
    };
  }

  async discover(): Promise<RuntimeDiscoveryResult> {
    const base = { runtime: this.id, endpoint: this.endpoint };
    const probe = await this.probe(
      '/v1/models',
      { method: 'GET', headers: { Accept: 'application/json' } },
      this.probeTimeoutMs,
    );
    if (!probe.ok) {
      const failure = this.describeFailure(probe);
      return { ...base, present: false, error: failure.error, message: failure.message };
    }
    if (parseOpenAiModelIds(probe.body) === null) {
      return {
        ...base,
        present: false,
        error: 'INVALID_RESPONSE',
        message: `Something answered on the ${this.displayName} address, but it was not an OpenAI-compatible service.`,
      };
    }
    // This API exposes no version — none is claimed.
    return { ...base, present: true, message: `${this.displayName} is running.` };
  }

  async health(): Promise<RuntimeHealth> {
    const base = { runtime: this.id, endpoint: this.endpoint };
    const startedAt = Date.now();
    const probe = await this.probe(
      '/v1/models',
      { method: 'GET', headers: { Accept: 'application/json' } },
      this.probeTimeoutMs,
    );
    const latencyMs = Date.now() - startedAt;
    if (!probe.ok) {
      const failure = this.describeFailure(probe);
      return {
        ...base,
        reachable: 'status' in probe,
        healthy: false,
        latencyMs,
        error: failure.error,
        message: failure.message,
      };
    }
    if (parseOpenAiModelIds(probe.body) === null) {
      return {
        ...base,
        reachable: true,
        healthy: false,
        latencyMs,
        error: 'INVALID_RESPONSE',
        message: `An unexpected response was returned on the ${this.displayName} address.`,
      };
    }
    return {
      ...base,
      reachable: true,
      healthy: true,
      latencyMs,
      message: `${this.displayName} is healthy.`,
    };
  }

  async listModels(): Promise<LocalModelListResult> {
    const base = { runtime: this.id, endpoint: this.endpoint };
    const probe = await this.probe(
      '/v1/models',
      { method: 'GET', headers: { Accept: 'application/json' } },
      this.probeTimeoutMs,
    );
    if (!probe.ok) {
      const failure = this.describeFailure(probe);
      return { ...base, ok: false, models: [], error: failure.error, message: failure.message };
    }
    const ids = parseOpenAiModelIds(probe.body);
    if (ids === null) {
      return {
        ...base,
        ok: false,
        models: [],
        error: 'INVALID_RESPONSE',
        message: `The ${this.displayName} model list could not be read.`,
      };
    }
    const models: LocalModelDescriptor[] = ids.map((id) => ({
      id,
      name: id,
      runtime: this.id,
      capabilities: [...INFERRED_CAPABILITIES],
      capabilitiesProvenance: 'INFERRED',
    }));
    if (models.length === 0) {
      return {
        ...base,
        ok: true,
        models: [],
        error: 'NO_MODELS',
        message: `${this.displayName} is running, but no models are loaded.`,
      };
    }
    return {
      ...base,
      ok: true,
      models,
      message: `${this.displayName} reported ${models.length} model${models.length === 1 ? '' : 's'}.`,
    };
  }

  async getModel(modelId: string): Promise<LocalModelDescriptor | null> {
    const target = modelId.trim();
    if (target === '') return null;
    const listing = await this.listModels();
    if (!listing.ok) return null;
    return listing.models.find((model) => model.id === target || model.name === target) ?? null;
  }

  private async resolveModel(
    requested?: string,
  ): Promise<{ modelId: string } | { error: LocalRuntimeErrorKind; message: string }> {
    const listing = await this.listModels();
    if (!listing.ok) {
      return { error: listing.error ?? 'INVALID_RESPONSE', message: listing.message };
    }
    const target = requested?.trim() ?? '';
    if (target !== '') {
      const found = listing.models.find((model) => model.id === target || model.name === target);
      if (found === undefined) {
        return {
          error: 'MODEL_UNAVAILABLE',
          message: `${this.displayName} does not have the model "${target}".`,
        };
      }
      return { modelId: found.id };
    }
    const first = listing.models[0];
    if (first === undefined) {
      return { error: 'NO_MODELS', message: `${this.displayName} reported no usable model.` };
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
      response = await this.fetchFn(`${this.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          model: modelId,
          messages: toWireMessages(request.messages),
          stream: false,
          ...(request.maxTokens !== undefined ? { max_tokens: request.maxTokens } : {}),
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
        message: `The generation could not reach ${this.displayName}. Check that it is still running.`,
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
        message: `${this.displayName} does not have the model "${modelId}".`,
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
        message: `${this.displayName} refused the request (HTTP ${response.status}).`,
      };
    }
    const body = await response.json();
    const content = parseOpenAiChatContent(body);
    if (content === undefined || content.trim() === '') {
      return {
        runtime: this.id,
        modelId,
        ok: false,
        content: '',
        latencyMs,
        error: 'GENERATION_FAILED',
        message: `${this.displayName} answered but produced no reply.`,
      };
    }
    return {
      runtime: this.id,
      modelId,
      ok: true,
      content,
      latencyMs,
      message: `${this.displayName} answered on ${modelId}.`,
    };
  }

  async *stream(request: LocalGenerateRequest): AsyncGenerator<LocalGenerateChunk> {
    const resolved = await this.resolveModel(request.modelId);
    if ('error' in resolved) return;
    const modelId = resolved.modelId;
    let response: Response;
    try {
      response = await this.fetchFn(`${this.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          model: modelId,
          messages: toWireMessages(request.messages),
          stream: true,
          ...(request.maxTokens !== undefined ? { max_tokens: request.maxTokens } : {}),
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
    const emit = (line: string): LocalGenerateChunk | undefined => parseOpenAiStreamLine(line);
    try {
      for (;;) {
        const read = (await reader.read()) as { done: boolean; value?: Uint8Array };
        if (read.done) break;
        buffer += decoder.decode(read.value, { stream: true });
        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          const chunk = emit(line);
          if (chunk !== undefined) yield chunk;
          newlineIndex = buffer.indexOf('\n');
        }
      }
      const tail = emit(buffer);
      if (tail !== undefined) yield tail;
    } finally {
      reader.releaseLock();
    }
  }
}

function toWireMessages(
  messages: readonly LocalChatMessage[],
): Array<{ role: string; content: string }> {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}
