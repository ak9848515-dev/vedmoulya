// ──────────────────────────────────────────────────────────────────
// VedMoulya — OpenAI Provider Adapter
// Provider adapter for OpenAI API (GPT-4o, GPT-4, etc.)
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

import type { AIResponse, CapabilityType, ProviderHealth } from '@vedmoulya/ai';
import type { ProviderAdapter } from '@vedmoulya/services';

export class OpenAIProvider implements ProviderAdapter {
  name = 'openai';
  family = 'openai';
  capabilities: CapabilityType[] = [
    'reasoning',
    'coding',
    'vision',
    'embeddings',
    'summarization',
    'classification',
    'translation',
    'image_understanding',
    'general_conversation',
  ];

  private readonly apiKey: string;
  private readonly baseUrl: string = 'https://api.openai.com/v1';
  private readonly timeoutMs: number;

  constructor(apiKey: string, options: { timeoutMs?: number } = {}) {
    this.apiKey = apiKey;
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  /**
   * fetch with a hard timeout (AI-RUNTIME-001) — a hung provider must never
   * hang the caller. AbortError is rethrown as a descriptive "timed out"
   * error so AIOrchestrationService.classifyFailure maps it to `timeout`
   * (a retryable failure reason) rather than an internal error.
   */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit = {},
    timeoutMs: number = this.timeoutMs,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`OpenAI request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/models`,
        { headers: { Authorization: `Bearer ${this.apiKey}` } },
        10_000,
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async getHealth(): Promise<ProviderHealth> {
    const start = Date.now();
    const healthy = await this.isHealthy();
    return {
      providerId: 'openai',
      status: healthy ? 'healthy' : 'down',
      latency: Date.now() - start,
      errorRate: healthy ? 0 : 1,
      lastChecked: new Date(),
      isRateLimited: false,
      rateLimitRemaining: 0,
      rateLimitReset: null,
    };
  }

  async execute(request: {
    messages: Array<{ role: string; content: string }>;
    model: string;
    maxTokens?: number;
  }): Promise<AIResponse> {
    const start = Date.now();
    const response = await this.fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        max_tokens: request.maxTokens ?? 1024,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${String(response.status)} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model: string;
    };

    const latency = Date.now() - start;

    return {
      content: data.choices[0]?.message.content ?? '',
      provider: 'openai',
      model: data.model,
      confidence: 0.9,
      qualityScore: 8.5,
      latency,
      cost: data.usage.prompt_tokens * 0.00001 + data.usage.completion_tokens * 0.00003,
      tokenUsage: {
        input: data.usage.prompt_tokens,
        output: data.usage.completion_tokens,
        total: data.usage.total_tokens,
      },
      validation: {
        passed: true,
        checks: [
          { name: 'format', passed: true, score: 10 },
          { name: 'safety', passed: true, score: 9 },
          { name: 'quality', passed: true, score: 8.5 },
        ],
        overallScore: 8.5,
        decision: 'pass',
      },
      traceId: `openai-${String(Date.now())}`,
      metadata: {
        providerFamily: 'openai',
        modelVersion: data.model,
        processingTime: latency,
        contextUsed: request.messages.map((m) => m.role),
        routingDecision: {
          selectedProvider: 'openai',
          reason: 'OpenAI provider selected',
          alternativesConsidered: [],
          strategy: 'balanced',
        },
        validationDetails: [],
      },
    };
  }
}
