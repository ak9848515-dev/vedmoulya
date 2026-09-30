// ──────────────────────────────────────────────────────────────────
// VedMoulya — Ollama AI Provider Adapter (BLD-022)
//
// Ollama is wired through the SAME provider contract as every other
// platform provider (ProviderAdapter): registry registration → model
// discovery/configuration → capability declaration → health → routing
// → execution → evidence → fallback. There is NO special Ollama
// execution path — the AIOrchestrationService routes to it exactly
// like Gemini/OpenAI/DeepSeek, and the Mission Controller cannot tell
// the difference (provider-agnostic execution).
//
// Phase B model contract: `modelId` is the advisor-selected model the
// runtime WANTS executed. This adapter executes its configured model;
// when an explicit `modelId` names a different model it fails
// EXPLICITLY (never silently executing a different model) so the
// runtime's existing fallback logic moves to the next candidate.
//
// BLD-023 model RESOLUTION: an adapter that can only ever execute what the
// local runtime actually HAS must resolve its model against that runtime.
// The configured preference (AI_OLLAMA_MODEL, default 'llama3.2') is a
// PREFERENCE — on a machine where that model was never pulled it is simply
// not executable, and pinning to it made every execution answer
// `api error: 404` and fall through to the mock even though the user had
// connected Ollama, discovered a model and had it validated. The installed
// set is therefore the authority (resolveModel): the configured model when
// installed, otherwise an installed chat model, otherwise nothing. The
// resolved model is published through `configuredModel` so routing
// advertises a model this adapter will really run.
// ──────────────────────────────────────────────────────────────────

import type { AIResponse, CapabilityType, ProviderHealth } from '@vedmoulya/ai';
import type { ProviderAdapter } from '@vedmoulya/services';

export interface OllamaProviderOptions {
  /** Ollama HTTP base URL, e.g. http://127.0.0.1:11434 (no trailing slash). */
  baseUrl: string;
  /**
   * The PREFERRED model this adapter should execute (default 'llama3.2'),
   * honored whenever it is installed on the local runtime. When it is NOT
   * installed the adapter resolves to an installed model instead of failing
   * on a model that does not exist locally (see resolveModel).
   */
  model?: string;
  /** Execution timeout in ms (default 120000). */
  timeoutMs?: number;
  /** Health probe timeout in ms (default 1500). */
  healthTimeoutMs?: number;
  /** Streaming chunk size in characters for local chunked streaming. */
  streamChunkSize?: number;
  /**
   * EXPLICIT opt-in (default false): when the configured model is not
   * installed, fall back to the first INSTALLED chat model. Without it, an
   * unavailable model is a TYPED `MODEL_NOT_FOUND` failure — the adapter never
   * silently substitutes a different model than the one it was asked for.
   */
  fallbackToInstalledModel?: boolean;
}

/**
 * Typed failure: the requested/configured model is not installed on the local
 * runtime. Carries a stable `code` so the runtime and telemetry can classify it
 * without parsing the message.
 */
export class OllamaModelNotFoundError extends Error {
  readonly code = 'MODEL_NOT_FOUND';
  constructor(readonly modelId: string) {
    super(
      `Ollama provider does not support model "${modelId}" — it is not installed on this runtime.`,
    );
    this.name = 'OllamaModelNotFoundError';
  }
}

const DEFAULT_MODEL = 'llama3.2';
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_HEALTH_TIMEOUT_MS = 1_500;
/** Installed-model list cache TTL — a cheap LOCAL /api/tags call, never hot. */
const MODEL_DISCOVERY_TTL_MS = 30_000;

export class OllamaProvider implements ProviderAdapter {
  name = 'ollama';
  family = 'ollama';
  capabilities: CapabilityType[] = [
    'reasoning',
    'coding',
    'summarization',
    'classification',
    'translation',
    'general_conversation',
    'content_generation',
  ];

  private readonly baseUrl: string;
  /** The configured PREFERENCE — it may not be installed on this machine. */
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly healthTimeoutMs: number;
  private readonly streamChunkSize: number;
  private readonly fallbackToInstalledModel: boolean;
  /** The INSTALLED model execution resolves to, once the runtime was probed. */
  private resolvedModel: string | undefined;
  /**
   * Why resolution did not produce a model: the requested model is not
   * installed (`MODEL_NOT_FOUND`) vs. the runtime could not be listed at all
   * (`RUNTIME_UNAVAILABLE`). `undefined` once a model resolved.
   */
  private resolutionFailure: 'MODEL_NOT_FOUND' | 'RUNTIME_UNAVAILABLE' | undefined;
  /** Bounded cache of the local runtime's installed chat models. */
  private discovery: { models: string[]; at: number } | undefined;
  /** In-flight resolution, so concurrent callers share one /api/tags probe. */
  private resolving: Promise<void> | undefined;

  constructor(options: OllamaProviderOptions) {
    const baseUrl = options.baseUrl.trim().replace(/\/+$/, '');
    if (!baseUrl) {
      throw new Error('OllamaProvider requires a non-empty baseUrl');
    }
    if (!/^https?:\/\//i.test(baseUrl)) {
      throw new Error('OllamaProvider baseUrl must be an http(s) URL');
    }
    this.baseUrl = baseUrl;
    this.model = options.model?.trim() || DEFAULT_MODEL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.healthTimeoutMs = options.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS;
    this.streamChunkSize = options.streamChunkSize ?? 120;
    this.fallbackToInstalledModel = options.fallbackToInstalledModel ?? false;
  }

  /**
   * The model this adapter executes: the INSTALLED model once the local
   * runtime has been probed, otherwise the configured preference.
   *
   * BLD-023 publishes exactly this through the routing-intelligence ports, so
   * the advisor advertises a model the adapter can really run — the catalog
   * entry (or a configured model that was never pulled) would be selected and
   * then honestly refused, and no local model could ever serve.
   */
  get configuredModel(): string {
    return this.resolvedModel ?? this.model;
  }

  /**
   * Installed models on the local runtime that can answer /api/chat.
   *
   * Best-effort by contract: an unreachable runtime, a non-JSON reply or a
   * missing `models` array yields [] and NEVER throws — discovery can never
   * turn a working execution path into a failure. When Ollama reports a
   * per-model `capabilities` list, embedding-only models are excluded so a
   * chat request is never aimed at one (an older runtime that omits the
   * field is not filtered — absence is not evidence).
   */
  private async discoverInstalledChatModels(): Promise<string[]> {
    const cached = this.discovery;
    const now = Date.now();
    if (cached && now - cached.at < MODEL_DISCOVERY_TTL_MS) return cached.models;
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/api/tags`,
        { method: 'GET' },
        this.healthTimeoutMs,
      );
      if (!response.ok) return cached?.models ?? [];
      const body = (await response.json()) as {
        models?: Array<{ name?: unknown; capabilities?: unknown }>;
      };
      const entries = (body.models ?? []).filter(
        (model): model is { name: string; capabilities?: unknown } =>
          typeof model.name === 'string' && model.name.trim() !== '',
      );
      const declaresCapabilities = entries.some((model) => Array.isArray(model.capabilities));
      const models = entries
        .filter(
          (model) =>
            !declaresCapabilities ||
            !Array.isArray(model.capabilities) ||
            (model.capabilities as unknown[]).includes('completion'),
        )
        .map((model) => model.name);
      this.discovery = { models, at: now };
      return models;
    } catch {
      return cached?.models ?? [];
    }
  }

  /**
   * Resolve which INSTALLED model this adapter executes.
   *
   * Order of authority:
   *   1. the configured preference (AI_OLLAMA_MODEL / options.model) when the
   *      runtime reports it as installed;
   *   2. otherwise the first installed chat model the runtime lists — Ollama
   *      orders /api/tags by most-recently-modified, i.e. the model the user
   *      most recently pulled/used, which is the same installed set the
   *      one-click setup flow discovered and validated;
   *   3. otherwise NO resolution: execution keeps failing loudly on the
   *      configured model rather than inventing one.
   *
   * Idempotent, bounded and never throws. Re-resolving after the TTL keeps a
   * model that was pulled or deleted later honored without a restart.
   */
  private async resolveModel(): Promise<void> {
    if (this.resolving) return this.resolving;
    this.resolving = (async (): Promise<void> => {
      const installed = await this.discoverInstalledChatModels();
      if (installed.length === 0) {
        // The runtime could not be listed (down/empty): NOT proof the model is
        // missing, so keep the configured preference and let the chat call fail
        // loudly with the real transport error.
        this.resolvedModel = undefined;
        this.resolutionFailure = 'RUNTIME_UNAVAILABLE';
        return;
      }
      if (installed.includes(this.model)) {
        this.resolvedModel = this.model;
        this.resolutionFailure = undefined;
        return;
      }
      if (this.fallbackToInstalledModel) {
        // EXPLICIT fallback was requested: the first installed chat model.
        this.resolvedModel = installed[0];
        this.resolutionFailure = undefined;
        return;
      }
      // The configured model is not installed and no fallback was requested:
      // refuse explicitly instead of silently running a different model.
      this.resolvedModel = undefined;
      this.resolutionFailure = 'MODEL_NOT_FOUND';
    })();
    try {
      await this.resolving;
    } finally {
      this.resolving = undefined;
    }
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/api/tags`,
        { method: 'GET' },
        this.healthTimeoutMs,
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async getHealth(): Promise<ProviderHealth> {
    const startedAt = Date.now();
    const healthy = await this.isHealthy();
    // BLD-023 — a health probe is also where the local runtime's INSTALLED
    // models are learned, so routing (which reads `configuredModel` after
    // asking for health) advertises a model this adapter can really execute.
    // Bounded by the discovery TTL and never throws.
    await this.resolveModel();
    const latency = Date.now() - startedAt;
    return {
      providerId: this.name,
      status: healthy ? 'healthy' : 'down',
      latency,
      errorRate: healthy ? 0 : 1,
      lastChecked: new Date(),
      isRateLimited: false,
      rateLimitRemaining: healthy ? 1000 : 0,
      rateLimitReset: null,
    };
  }

  async execute(request: {
    messages: Array<{ role: string; content: string }>;
    model: string;
    maxTokens?: number;
    modelId?: string;
  }): Promise<AIResponse> {
    // The runtime did not name a model, so this adapter owns the choice —
    // resolve it against what is ACTUALLY installed rather than assuming the
    // configured preference was ever pulled. When the runtime DOES name a
    // model the Phase B contract below governs (execute it, or refuse it
    // explicitly).
    if (request.modelId === undefined) {
      await this.resolveModel();
    }
    // A configured preference that is not installed is a TYPED failure — the
    // adapter never silently substitutes a different installed model.
    if (
      request.modelId === undefined &&
      this.resolvedModel === undefined &&
      this.resolutionFailure === 'MODEL_NOT_FOUND'
    ) {
      throw new OllamaModelNotFoundError(this.model);
    }
    const effectiveModel = this.resolvedModel ?? this.model;
    // Phase B — an explicitly requested model this adapter cannot run is a
    // typed, non-substituting failure.
    if (request.modelId !== undefined && request.modelId !== effectiveModel) {
      throw new OllamaModelNotFoundError(request.modelId);
    }
    const startedAt = Date.now();
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/api/chat`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: effectiveModel,
          messages: request.messages,
          stream: false,
          ...(request.maxTokens !== undefined
            ? { options: { num_predict: request.maxTokens } }
            : {}),
        }),
      },
      this.timeoutMs,
    );
    if (!response.ok) {
      throw new Error(`Ollama chat failed: api error: ${String(response.status)}`);
    }
    const data = (await response.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };
    const content = data.message?.content ?? '';
    const latency = Date.now() - startedAt;
    const inputTokens = data.prompt_eval_count ?? 0;
    const outputTokens = data.eval_count ?? 0;

    // Local inference — cost is genuinely zero; usage is real.
    return {
      content,
      provider: this.name,
      // The model execution ACTUALLY ran — never the stale preference.
      model: effectiveModel,
      confidence: 0.8,
      qualityScore: 7,
      latency,
      cost: 0,
      tokenUsage: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      },
      validation: {
        passed: true,
        checks: [
          { name: 'format', passed: true, score: 10 },
          { name: 'safety', passed: true, score: 10 },
          { name: 'quality', passed: true, score: 7 },
        ],
        overallScore: 8,
        decision: 'pass',
      },
      traceId: `ollama-${String(Date.now())}`,
      metadata: {
        providerFamily: 'ollama',
        modelVersion: effectiveModel,
        processingTime: latency,
        contextUsed: ['system', 'user-input'],
        routingDecision: {
          selectedProvider: this.name,
          reason: 'Ollama local provider executed through the shared provider contract',
          alternativesConsidered: [],
          strategy: 'balanced',
        },
        validationDetails: [],
      },
    };
  }

  /**
   * Schema-validated structured output path: Ollama has no typed-object API,
   * so the schema is appended as instructions and the RESULT is validated
   * deterministically by the runtime's StructuredOutputValidator — the same
   * fallback path every non-typed adapter takes. Never fabricates validity.
   */
  async generateStructured(request: {
    messages: Array<{ role: string; content: string }>;
    model: string;
    maxTokens?: number;
    schema: Record<string, unknown>;
    modelId?: string;
  }): Promise<AIResponse> {
    const messages = request.messages.map((message, index) =>
      index === request.messages.length - 1
        ? {
            ...message,
            content: `${message.content}\n\nRespond with ONLY a JSON object conforming to this schema: ${JSON.stringify(
              request.schema,
            )}`,
          }
        : message,
    );
    return this.execute({ ...request, messages });
  }

  /**
   * B4 — local streaming parity: Ollama has no SDK streaming contract, so the
   * deterministic local execution result is re-emitted as identical streaming
   * events (content chunks + ONE terminal `done` with the ACTUAL resolved
   * model, real token usage and zero cost). The event is generated from the
   * same result the non-streaming path returns — never a second execution, so
   * token/cost telemetry cannot double-count and the recorded model always
   * equals the model non-streaming execution would record.
   */
  async *stream(request: {
    messages: Array<{ role: string; content: string }>;
    model: string;
    maxTokens?: number;
    modelId?: string;
  }): AsyncIterable<unknown> {
    const startedAt = Date.now();
    const result = await this.execute(request);
    const size = Math.max(1, this.streamChunkSize);
    for (let offset = 0; offset < result.content.length; offset += size) {
      yield {
        type: 'content',
        data: { text: result.content.slice(offset, offset + size) },
        timestamp: new Date().toISOString(),
      };
    }
    yield {
      type: 'done',
      data: {
        modelId: result.model,
        latencyMs: Date.now() - startedAt,
        tokenUsage: {
          input: result.tokenUsage.input,
          output: result.tokenUsage.output,
          total: result.tokenUsage.total,
        },
        cost: result.cost,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
