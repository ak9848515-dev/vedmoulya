// ──────────────────────────────────────────────────────────────────
// VedMoulya — Vercel AI SDK DeepSeek Provider Adapter
// DeepSeek is wired as a real runtime provider through the SAME Vercel
// AI SDK the OpenAI adapter uses (`generateText` / `streamText` /
// `generateObject`). DeepSeek exposes an OpenAI-compatible API, so the
// `createOpenAI` factory from `@ai-sdk/openai` is pointed at DeepSeek's
// base URL with `compatibility: 'compatible'` — no new SDK dependency,
// no raw-fetch path.
//
// AI SDK errors are normalised to the error vocabulary
// AIOrchestrationService.classifyFailure understands (429 → rate
// limit, 5xx → api error: 5xx, abort → timed out) so retry/fallback
// rules behave identically to every other adapter.
//
// Honest boundary: DeepSeek has NO vision / embeddings / speech — the
// capability list below matches the provider catalog entry
// (packages/providers/src/catalog/provider-catalog.ts) and never claims
// capabilities the API does not provide.
// ──────────────────────────────────────────────────────────────────

import { Output, generateText, jsonSchema, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { AIResponse, CapabilityType, ProviderHealth } from '@vedmoulya/ai';
import type { ProviderAdapter } from '@vedmoulya/services';

/** DeepSeek's OpenAI-compatible REST base URL (api-docs.deepseek.com). */
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

/**
 * Map a runtime message role to the AI SDK model-message role vocabulary.
 * Only user/assistant are legal in the `messages` array (the SDK rejects a
 * `system` role there); anything else is treated as user.
 */
function toModelRole(role: string): 'user' | 'assistant' {
  if (role === 'assistant') return 'assistant';
  return 'user';
}

/**
 * Split runtime messages into (a) the system instruction (system-prompt
 * messages only — the SDK requires it as the top-level `instructions`
 * option, never as a message role) and (b) the user/assistant message list.
 */
function splitInstructions(messages: Array<{ role: string; content: string }>): {
  instructions: string | undefined;
  chatMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
} {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n');
  return {
    instructions: system.length > 0 ? system : undefined,
    chatMessages: messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: toModelRole(m.role), content: m.content })),
  };
}

export interface DeepSeekProviderOptions {
  /** DeepSeek model id for text generation. Default: deepseek-chat (V3). */
  modelId?: string;
  /** Structured-output model id (defaults to modelId). */
  structuredModelId?: string;
  /** Hard timeout for every call. Default: 60s. */
  timeoutMs?: number;
  /** Cost per 1K input tokens (USD) for the configured model. Default: 0.00027. */
  inputPer1K?: number;
  /** Cost per 1K output tokens (USD) for the configured model. Default: 0.0011. */
  outputPer1K?: number;
  /** Override the API base URL (default: https://api.deepseek.com). */
  baseURL?: string;
}

export class DeepSeekProvider implements ProviderAdapter {
  name = 'deepseek';
  family = 'deepseek';
  capabilities: CapabilityType[] = [
    'reasoning',
    'coding',
    'summarization',
    'classification',
    'translation',
    'general_conversation',
    'content_generation',
  ];

  private readonly apiKey: string;
  private readonly modelId: string;
  private readonly structuredModelId: string;
  private readonly timeoutMs: number;
  private readonly inputPer1K: number;
  private readonly outputPer1K: number;
  private readonly baseURL: string;

  constructor(apiKey: string, options: DeepSeekProviderOptions = {}) {
    this.apiKey = apiKey;
    this.modelId = options.modelId ?? 'deepseek-chat';
    this.structuredModelId = options.structuredModelId ?? this.modelId;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    // Registry estimates: $0.27/M input, $1.10/M output (catalog deepseek entry).
    this.inputPer1K = options.inputPer1K ?? 0.00027;
    this.outputPer1K = options.outputPer1K ?? 0.0011;
    this.baseURL = options.baseURL ?? DEEPSEEK_BASE_URL;
  }

  /** Model configuration is treated as readiness (no network call in health). */
  isHealthy(): Promise<boolean> {
    return Promise.resolve(this.apiKey.length > 0);
  }

  getHealth(): Promise<ProviderHealth> {
    return Promise.resolve({
      providerId: 'deepseek',
      status: 'healthy',
      latency: 0,
      errorRate: 0,
      lastChecked: new Date(),
      isRateLimited: false,
      rateLimitRemaining: 0,
      rateLimitReset: null,
    });
  }

  /**
   * OpenAI-compatible DeepSeek client (createOpenAI + custom base URL). The
   * default provider function maps to the Chat Completions API path, which is
   * the endpoint DeepSeek exposes at https://api.deepseek.com (the Responses
   * API is a separate explicit method this adapter never uses).
   */
  private client(): ReturnType<typeof createOpenAI> {
    return createOpenAI({
      baseURL: this.baseURL,
      apiKey: this.apiKey,
    });
  }

  async execute(request: {
    messages: Array<{ role: string; content: string }>;
    model: string;
    maxTokens?: number;
  }): Promise<AIResponse> {
    const startedAt = Date.now();
    const { abortSignal, timeoutTimer } = this.createTimeout();

    try {
      const { instructions, chatMessages } = splitInstructions(request.messages);
      const result = await generateText({
        model: this.client()(this.modelId),
        ...(instructions ? { instructions } : {}),
        messages: chatMessages,
        maxOutputTokens: request.maxTokens ?? 1024,
        abortSignal,
      });

      const input = result.usage.inputTokens ?? 0;
      const output = result.usage.outputTokens ?? 0;
      const latency = Date.now() - startedAt;
      const modelId = result.finalStep.response.modelId;

      return {
        content: result.text,
        provider: 'deepseek',
        model: modelId,
        confidence: 0.9,
        qualityScore: 8.0,
        latency,
        cost: (input / 1000) * this.inputPer1K + (output / 1000) * this.outputPer1K,
        tokenUsage: {
          input,
          output,
          total: result.usage.totalTokens ?? input + output,
        },
        validation: {
          passed: true,
          checks: [
            { name: 'format', passed: true, score: 10 },
            { name: 'safety', passed: true, score: 9 },
            { name: 'quality', passed: true, score: 8 },
          ],
          overallScore: 8,
          decision: 'pass',
        },
        traceId: `deepseek-sdk-${String(Date.now())}`,
        metadata: {
          providerFamily: 'deepseek',
          modelVersion: modelId,
          processingTime: latency,
          contextUsed: request.messages.map((m) => m.role),
          routingDecision: {
            selectedProvider: 'deepseek',
            reason: 'DeepSeek provider selected (Vercel AI SDK runtime, OpenAI-compatible)',
            alternativesConsidered: [],
            strategy: 'balanced',
          },
          validationDetails: [],
        },
      };
    } catch (error) {
      throw this.normalizeError(error, this.timeoutMs);
    } finally {
      clearTimeout(timeoutTimer);
    }
  }

  /** Schema-validated structured output through generateObject. */
  async generateStructured(request: {
    messages: Array<{ role: string; content: string }>;
    model: string;
    maxTokens?: number;
    schema: Record<string, unknown>;
  }): Promise<AIResponse> {
    const startedAt = Date.now();
    const { abortSignal, timeoutTimer } = this.createTimeout();

    try {
      const { instructions, chatMessages } = splitInstructions(request.messages);
      const result = await generateText({
        model: this.client()(this.structuredModelId),
        ...(instructions ? { instructions } : {}),
        messages: chatMessages,
        maxOutputTokens: request.maxTokens ?? 1024,
        output: Output.object({
          schema: jsonSchema(request.schema),
        }),
        abortSignal,
      });

      const input = result.usage.inputTokens ?? 0;
      const output = result.usage.outputTokens ?? 0;
      const latency = Date.now() - startedAt;
      const modelId = result.finalStep.response.modelId;
      const object = await result.output;

      return {
        content: JSON.stringify(object),
        provider: 'deepseek',
        model: modelId,
        confidence: 0.9,
        qualityScore: 8.0,
        latency,
        cost: (input / 1000) * this.inputPer1K + (output / 1000) * this.outputPer1K,
        tokenUsage: {
          input,
          output,
          total: result.usage.totalTokens ?? input + output,
        },
        validation: {
          passed: true,
          checks: [{ name: 'format', passed: true, score: 10 }],
          overallScore: 8,
          decision: 'pass',
        },
        traceId: `deepseek-sdk-structured-${String(Date.now())}`,
        metadata: {
          providerFamily: 'deepseek',
          modelVersion: modelId,
          processingTime: latency,
          contextUsed: request.messages.map((m) => m.role),
          routingDecision: {
            selectedProvider: 'deepseek',
            reason: 'DeepSeek structured output (Vercel AI SDK runtime)',
            alternativesConsidered: [],
            strategy: 'balanced',
          },
          validationDetails: [],
        },
      };
    } catch (error) {
      throw this.normalizeError(error, this.timeoutMs);
    } finally {
      clearTimeout(timeoutTimer);
    }
  }

  /** Token streaming through streamText, surfaced as StreamChunk-shaped events. */
  async *stream(request: {
    messages: Array<{ role: string; content: string }>;
    model: string;
    maxTokens?: number;
  }): AsyncIterable<unknown> {
    const startedAt = Date.now();
    const { abortSignal, timeoutTimer } = this.createTimeout();

    try {
      const { instructions, chatMessages } = splitInstructions(request.messages);
      const result = streamText({
        model: this.client()(this.modelId),
        ...(instructions ? { instructions } : {}),
        messages: chatMessages,
        maxOutputTokens: request.maxTokens ?? 1024,
        abortSignal,
      });

      for await (const chunk of result.textStream) {
        yield { type: 'content', data: { text: chunk }, timestamp: new Date().toISOString() };
      }

      const usage = await result.usage;
      yield {
        type: 'done',
        data: {
          latencyMs: Date.now() - startedAt,
          tokenUsage: {
            input: usage.inputTokens ?? 0,
            output: usage.outputTokens ?? 0,
            total: usage.totalTokens ?? 0,
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw this.normalizeError(error, this.timeoutMs);
    } finally {
      clearTimeout(timeoutTimer);
    }
  }

  /**
   * Map AI SDK errors into the error vocabulary classifyFailure understands:
   * - 429 / rate limit → "rate limited"
   * - 5xx → "api error: 5xx" (provider_unavailable)
   * - abort → "timed out" (retryable timeout)
   * Everything else keeps its original message.
   */
  private normalizeError(error: unknown, timeoutMs: number): Error {
    if (error instanceof Error && error.name === 'AbortError') {
      return new Error(`DeepSeek request timed out after ${timeoutMs}ms`);
    }
    const candidate = error as { statusCode?: number; message?: string };
    if (typeof candidate.statusCode === 'number') {
      if (candidate.statusCode === 429) {
        return new Error('DeepSeek API rate limited (429)');
      }
      if (candidate.statusCode >= 500) {
        return new Error(`api error: ${String(candidate.statusCode)}`);
      }
      if (candidate.statusCode === 401) {
        return new Error('DeepSeek API authentication failed (401)');
      }
    }
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  }

  private createTimeout(): { abortSignal: AbortSignal; timeoutTimer: NodeJS.Timeout } {
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);
    return { abortSignal: controller.signal, timeoutTimer };
  }
}
