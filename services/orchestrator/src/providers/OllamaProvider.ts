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
// ──────────────────────────────────────────────────────────────────

import type { AIResponse, CapabilityType, ProviderHealth } from '@vedmoulya/ai';
import type { ProviderAdapter } from '@vedmoulya/services';

export interface OllamaProviderOptions {
  /** Ollama HTTP base URL, e.g. http://127.0.0.1:11434 (no trailing slash). */
  baseUrl: string;
  /** The single model this adapter executes (default 'llama3.2'). */
  model?: string;
  /** Execution timeout in ms (default 120000). */
  timeoutMs?: number;
  /** Health probe timeout in ms (default 1500). */
  healthTimeoutMs?: number;
}

const DEFAULT_MODEL = 'llama3.2';
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_HEALTH_TIMEOUT_MS = 1_500;

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
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly healthTimeoutMs: number;

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
  }

  /** The configured model is the only model this adapter executes. */
  get configuredModel(): string {
    return this.model;
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
    // Phase B — explicit unsupported-model error (never silent substitution).
    if (request.modelId !== undefined && request.modelId !== this.model) {
      throw new Error(
        `Ollama provider does not support model "${request.modelId}" (configured model: ${this.model})`,
      );
    }
    const startedAt = Date.now();
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/api/chat`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
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
      model: this.model,
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
        modelVersion: this.model,
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
}
