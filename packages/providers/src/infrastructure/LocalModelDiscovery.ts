// ──────────────────────────────────────────────────────────────────
// VedMoulya — Local Model Discovery
// EPIC-012A — AI Provider Intelligence (Phase 10)
//
// Fail-safe adapters for local inference runtimes. Live discovery is an
// operator step: when an endpoint is unreachable or unconfigured, the
// adapter returns `discovered: false` with an honest statusMessage —
// it NEVER fabricates an installed-model list.
//
// The InMemoryLocalModelDiscovery adapter is the hermetic default for
// tests and for the case where no local runtime is running: it reports
// nothing discovered unless the operator declares models explicitly.
// ──────────────────────────────────────────────────────────────────

import type {
  LocalModelDiscoveryPort,
  LocalModelDiscoveryResult,
  LocalModelInfo,
} from '../types/intelligence-types.js';

const INFERRED_CAPABILITIES = ['reasoning', 'coding', 'chat', 'generation'];

/** Parse a size into GB: plain bytes (Ollama) or strings like "4.7GB". */
function parseSizeGb(raw: string | number | undefined): number | undefined {
  if (typeof raw === 'number') {
    if (raw <= 0) return undefined;
    // Ollama reports model size in raw bytes; large values are bytes.
    if (raw > 1_000_000_000) return Math.round((raw / 1_000_000_000) * 10) / 10;
    return raw;
  }
  if (!raw) return undefined;
  const match = raw.match(/([\d.]+)\s*GB/i);
  if (match) {
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * Ollama adapter — queries the Ollama API `/api/tags` endpoint. Model
 * capabilities are INFERRED from names/size heuristics (Ollama does not
 * declare capabilities), and are marked as such — never claimed verified.
 */
export class OllamaLocalModelDiscovery implements LocalModelDiscoveryPort {
  readonly runtime = 'ollama' as const;
  private readonly endpoint: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(
    endpoint = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
    options: { fetchFn?: typeof fetch; timeoutMs?: number } = {},
  ) {
    this.endpoint = endpoint.replace(/\/$/, '');
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 1500;
  }

  async discover(): Promise<LocalModelDiscoveryResult> {
    const retrievedAt = new Date().toISOString();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, this.timeoutMs);
      const response = await this.fetchFn(`${this.endpoint}/api/tags`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);
      if (!response.ok) {
        return {
          runtime: this.runtime,
          endpoint: this.endpoint,
          discovered: false,
          models: [],
          statusMessage: `Ollama responded with HTTP ${response.status}`,
          retrievedAt,
        };
      }
      const body = (await response.json()) as {
        models?: Array<{ name?: string; size?: number; details?: { quantization_level?: string } }>;
      };
      const models: LocalModelInfo[] = (body.models ?? []).map((m) => {
        const name = m.name ?? 'unknown';
        const sizeGb = parseSizeGb(m.size);
        return {
          id: name,
          name,
          sizeGb,
          quantization: m.details?.quantization_level,
          status: 'available',
          capabilities: [...INFERRED_CAPABILITIES],
          capabilitiesProvenance: 'INFERRED',
          runtime: this.runtime,
        };
      });
      return {
        runtime: this.runtime,
        endpoint: this.endpoint,
        discovered: true,
        models,
        statusMessage: `Discovered ${models.length} model(s) from ${this.endpoint}`,
        retrievedAt,
      };
    } catch (error) {
      return {
        runtime: this.runtime,
        endpoint: this.endpoint,
        discovered: false,
        models: [],
        statusMessage: `Ollama unreachable at ${this.endpoint} — no model list claimed`,
        retrievedAt,
        error: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
      };
    }
  }
}

/**
 * OpenAI-compatible adapter (LM Studio / llama.cpp server / custom
 * endpoints) — queries `/v1/models`. Capabilities are INFERRED (the
 * compatible API does not declare them).
 */
export class OpenAICompatibleModelDiscovery implements LocalModelDiscoveryPort {
  readonly runtime: 'lm-studio' | 'openai-compatible';
  private readonly endpoint: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(
    runtime: 'lm-studio' | 'openai-compatible' = 'lm-studio',
    endpoint = runtime === 'lm-studio'
      ? (process.env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234')
      : (process.env.LOCAL_OPENAI_BASE_URL ?? 'http://localhost:8000'),
    options: { fetchFn?: typeof fetch; timeoutMs?: number } = {},
  ) {
    this.runtime = runtime;
    this.endpoint = endpoint.replace(/\/$/, '');
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 1500;
  }

  async discover(): Promise<LocalModelDiscoveryResult> {
    const retrievedAt = new Date().toISOString();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, this.timeoutMs);
      const response = await this.fetchFn(`${this.endpoint}/v1/models`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);
      if (!response.ok) {
        return {
          runtime: this.runtime,
          endpoint: this.endpoint,
          discovered: false,
          models: [],
          statusMessage: `OpenAI-compatible endpoint responded with HTTP ${response.status}`,
          retrievedAt,
        };
      }
      const body = (await response.json()) as { data?: Array<{ id?: string }> };
      const models: LocalModelInfo[] = (body.data ?? []).map((m) => ({
        id: m.id ?? 'unknown',
        name: m.id ?? 'unknown',
        status: 'available',
        capabilities: [...INFERRED_CAPABILITIES],
        capabilitiesProvenance: 'INFERRED',
        runtime: this.runtime,
      }));
      return {
        runtime: this.runtime,
        endpoint: this.endpoint,
        discovered: true,
        models,
        statusMessage: `Discovered ${models.length} model(s) from ${this.endpoint}`,
        retrievedAt,
      };
    } catch (error) {
      return {
        runtime: this.runtime,
        endpoint: this.endpoint,
        discovered: false,
        models: [],
        statusMessage: `Local runtime unreachable at ${this.endpoint} — no model list claimed`,
        retrievedAt,
        error: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
      };
    }
  }
}

/**
 * Hermetic in-memory adapter — the safe default for tests and for when
 * no local runtime is running. Only reports models the operator declared
 * explicitly; never invents them.
 */
export class InMemoryLocalModelDiscovery implements LocalModelDiscoveryPort {
  readonly runtime: 'ollama' | 'lm-studio' | 'openai-compatible';
  private readonly declared: LocalModelInfo[];

  constructor(
    runtime: 'ollama' | 'lm-studio' | 'openai-compatible' = 'ollama',
    declared: LocalModelInfo[] = [],
  ) {
    this.runtime = runtime;
    this.declared = declared.map((m) => ({ ...m }));
  }

  discover(): Promise<LocalModelDiscoveryResult> {
    return Promise.resolve({
      runtime: this.runtime,
      endpoint: 'in-memory',
      discovered: this.declared.length > 0,
      models: this.declared.map((m) => ({ ...m })),
      statusMessage:
        this.declared.length > 0
          ? `${this.declared.length} declared local model(s)`
          : 'No local runtime declared — no model list claimed',
      retrievedAt: new Date().toISOString(),
    });
  }
}
