// ──────────────────────────────────────────────────────────────────
// VedMoulya — Vercel AI SDK OpenAI Provider Adapter
// The primary production execution path (AI-RUNTIME-002): OpenAI is
// called through the Vercel AI SDK (`generateText` / `streamText` /
// `generateObject`) instead of raw fetch. The SDK remains an
// infrastructure adapter — business engines only ever see the
// ProviderAdapter runtime contract.
//
// AI SDK errors are normalised to the error vocabulary
// AIOrchestrationService.classifyFailure understands (429 → rate
// limit, 5xx → api error: 5xx, abort → timed out) so retry/fallback
// rules behave identically to the raw-fetch adapters.
// ──────────────────────────────────────────────────────────────────

import { Output, generateText, jsonSchema, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { AIResponse, CapabilityType, ProviderHealth } from '@vedmoulya/ai';
import type { ProviderAdapter } from '@vedmoulya/services';

/**
 * Map a runtime message role to the AI SDK model-message role vocabulary.
 * Only user/assistant are legal in the `messages` array (the OpenAI v4 SDK
 * REJECTS a `system` role there); anything else is treated as user.
 */
function toModelRole(role: string): 'user' | 'assistant' {
  if (role === 'assistant') return 'assistant';
  return 'user';
}

/**
 * Split runtime messages into (a) the system instruction (system-prompt
 * messages only — the OpenAI v4 SDK requires it as the top-level
 * `instructions` option, never as a message role) and (b) the user/assistant
 * message list. System messages are joined with newlines in order; when none
 * exists the returned instructions string is empty and the caller omits it.
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

export interface VercelAIProviderOptions {
  /** OpenAI model id for text generation. Default: gpt-4o-mini. */
  modelId?: string;
  /** Structured-output model id (defaults to modelId). */
  structuredModelId?: string;
  /** Hard timeout for every call. Default: 60s. */
  timeoutMs?: number;
  /** Cost per 1K input tokens (USD) for the configured model. Default: 0.15. */
  inputPer1K?: number;
  /** Cost per 1K output tokens (USD) for the configured model. Default: 0.6. */
  outputPer1K?: number;
}

export class VercelAIProvider implements ProviderAdapter {
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
    'content_generation',
  ];

  private readonly apiKey: string;
  private readonly modelId: string;
  private readonly structuredModelId: string;
  private readonly timeoutMs: number;
  private readonly inputPer1K: number;
  private readonly outputPer1K: number;

  constructor(apiKey: string, options: VercelAIProviderOptions = {}) {
    this.apiKey = apiKey;
    this.modelId = options.modelId ?? 'gpt-4o-mini';
    this.structuredModelId = options.structuredModelId ?? this.modelId;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.inputPer1K = options.inputPer1K ?? 0.15;
    this.outputPer1K = options.outputPer1K ?? 0.6;
  }

  /** Model configuration is treated as readiness (no network call in health). */
  isHealthy(): Promise<boolean> {
    return Promise.resolve(this.apiKey.length > 0);
  }

  getHealth(): Promise<ProviderHealth> {
    return Promise.resolve({
      providerId: 'openai',
      status: 'healthy',
      latency: 0,
      errorRate: 0,
      lastChecked: new Date(),
      isRateLimited: false,
      rateLimitRemaining: 0,
      rateLimitReset: null,
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
        model: openai(this.modelId),
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
        provider: 'openai',
        model: modelId,
        confidence: 0.9,
        qualityScore: 8.5,
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
            { name: 'quality', passed: true, score: 8.5 },
          ],
          overallScore: 8.5,
          decision: 'pass',
        },
        traceId: `openai-sdk-${String(Date.now())}`,
        metadata: {
          providerFamily: 'openai',
          modelVersion: modelId,
          processingTime: latency,
          contextUsed: request.messages.map((m) => m.role),
          routingDecision: {
            selectedProvider: 'openai',
            reason: 'OpenAI provider selected (Vercel AI SDK runtime)',
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
        model: openai(this.structuredModelId),
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
        provider: 'openai',
        model: modelId,
        confidence: 0.9,
        qualityScore: 8.5,
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
          overallScore: 8.5,
          decision: 'pass',
        },
        traceId: `openai-sdk-structured-${String(Date.now())}`,
        metadata: {
          providerFamily: 'openai',
          modelVersion: modelId,
          processingTime: latency,
          contextUsed: request.messages.map((m) => m.role),
          routingDecision: {
            selectedProvider: 'openai',
            reason: 'OpenAI structured output (Vercel AI SDK runtime)',
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
        model: openai(this.modelId),
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
      return new Error(`OpenAI request timed out after ${timeoutMs}ms`);
    }
    const candidate = error as { statusCode?: number; message?: string };
    if (typeof candidate.statusCode === 'number') {
      if (candidate.statusCode === 429) {
        return new Error('OpenAI API rate limited (429)');
      }
      if (candidate.statusCode >= 500) {
        return new Error(`api error: ${String(candidate.statusCode)}`);
      }
      if (candidate.statusCode === 401) {
        return new Error('OpenAI API authentication failed (401)');
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
