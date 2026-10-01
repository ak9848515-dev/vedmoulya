// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Ask VedMoulya: a streamed run must fall back across providers
// REGRESSION TEST for the proven production failure.
//
// PROVEN ROOT CAUSE
//   AICompanion.tsx answers every conversation turn through `ai.stream`
//   (API client -> tRPC -> AIRouter.stream -> user-scoped runtime ->
//   AIOrchestrationService.stream). `orchestrate` — the path Mission uses —
//   executes through executeWithRetryAndFallback, which iterates the whole
//   candidate list. `stream` did not: it streamed `candidates[0]` and rethrew
//   on the first failure. One exhausted provider (an OpenAI key with no
//   remaining credit, a provider answering 401, a 5xx) therefore failed the
//   ENTIRE request while a registered fallback could have answered — which is
//   exactly why Ask VedMoulya returned "I could not complete that request
//   right now" while Mission kept working.
//
// WHAT THIS SUITE PINS
//   1. a failed first candidate falls through to a registered candidate;
//   2. the already-failed provider is NOT attempted again (retry budget intact);
//   3. partial output that already reached the consumer is never duplicated;
//   4. with no other candidate the original provider error still propagates;
//   5. when every candidate fails the REAL last error propagates.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { AIOrchestrationService } from '../AIOrchestrationService.js';
import type { ProviderAdapter } from '../AIOrchestrationService.js';
import type { AIResponse } from '@vedmoulya/ai';
import type { OrchestrateRequestDTO } from '../AIDTO.js';

const request: OrchestrateRequestDTO = {
  capability: 'reasoning',
  userInput: 'Reply with exactly: VEDMOULYA_OK',
  qualityTier: 'standard',
  userId: 'ask-regression-user',
};

function adapterResponse(provider: string, content: string): AIResponse {
  return {
    content,
    provider,
    model: `${provider}-model`,
    confidence: 0.9,
    qualityScore: 8,
    latency: 5,
    cost: 0,
    tokenUsage: { input: 10, output: 5, total: 15 },
    validation: { passed: true, checks: [], overallScore: 8, decision: 'pass' },
    traceId: `trace-${provider}`,
  } as AIResponse;
}

function healthyExecute(name: string, content: string) {
  return vi.fn(async () => adapterResponse(name, content));
}

/** A registered adapter that advertises streaming and can be made to fail. */
function streamingAdapter(
  name: string,
  options: {
    family?: string;
    execute?: () => Promise<AIResponse>;
    stream?: () => AsyncGenerator<unknown>;
  } = {},
): ProviderAdapter {
  const execute = options.execute ?? healthyExecute(name, `answer from ${name}`);
  return {
    name,
    family: options.family ?? name,
    capabilities: ['reasoning'],
    isHealthy: async () => true,
    getHealth: async () => ({
      providerId: name,
      status: 'healthy',
      latency: 1,
      errorRate: 0,
      lastChecked: new Date(),
      isRateLimited: false,
      rateLimitRemaining: 0,
      rateLimitReset: null,
    }),
    execute,
    stream:
      options.stream ??
      (async function* () {
        yield { type: 'content', data: { text: `streamed by ${name}` } };
        yield { type: 'done', data: { tokenUsage: { input: 10, output: 5, total: 15 } } };
      })(),
  } as ProviderAdapter;
}

describe('Ask VedMoulya — streamed runs fall back across providers', () => {
  it('falls through to a registered candidate when the first provider stream fails', async () => {
    const svc = new AIOrchestrationService({ retryBaseDelayMs: 1 });
    // `openai` stands in for the exhausted first-choice provider.
    const failingExecute = healthyExecute('openai', 'unreachable');
    const exhausted = streamingAdapter('openai', {
      family: 'openai',
      execute: failingExecute,
      stream: async function* () {
        throw new Error('AI_NoOutputGeneratedError: No output generated. Check the stream.');
      },
    });
    const healthyExecuteSpy = healthyExecute('google', 'answer from google');
    const healthy = streamingAdapter('google', {
      family: 'google',
      execute: healthyExecuteSpy,
    });

    svc.registerProvider(exhausted);
    svc.registerProvider(healthy);

    const run = await svc.stream(request);

    expect(run.final.provider).toBe('google');
    expect(run.final.content).toBe('answer from google');
    // The already-failed provider is never attempted again: the runtime's
    // retry budget must not grow just because fallback exists.
    expect(failingExecute).not.toHaveBeenCalled();
    // The fallback answer still reaches the consumer as a content event.
    expect(run.events.some((e) => e.type === 'content' && e.content === 'answer from google')).toBe(
      true,
    );
    expect(run.events.some((e) => e.type === 'done')).toBe(true);
  });

  it('never duplicates an answer when content already streamed before the failure', async () => {
    const svc = new AIOrchestrationService({ retryBaseDelayMs: 1 });
    const partial = streamingAdapter('openai', {
      family: 'openai',
      stream: async function* () {
        yield { type: 'content', data: { text: 'partial answer' } };
        throw new Error('stream connection reset');
      },
    });
    const healthyExecuteSpy = healthyExecute('google', 'answer from google');
    const healthy = streamingAdapter('google', {
      family: 'google',
      execute: healthyExecuteSpy,
    });

    svc.registerProvider(partial);
    svc.registerProvider(healthy);

    await expect(svc.stream(request)).rejects.toThrow(/stream connection reset/i);
    expect(healthyExecuteSpy).not.toHaveBeenCalled();
  });

  it('still surfaces the provider error when it is the only candidate', async () => {
    const svc = new AIOrchestrationService({ retryBaseDelayMs: 1 });
    svc.registerProvider(
      streamingAdapter('openai', {
        family: 'openai',
        stream: async function* () {
          throw new Error('You have no credits remaining.');
        },
      }),
    );

    await expect(svc.stream(request)).rejects.toThrow(/no credits remaining/i);
  });

  it('propagates the real last error when every candidate fails', async () => {
    const svc = new AIOrchestrationService({ retryBaseDelayMs: 1 });
    svc.registerProvider(
      streamingAdapter('openai', {
        family: 'openai',
        stream: async function* () {
          throw new Error('primary provider unavailable');
        },
        execute: async () => {
          throw new Error('openai execute failed');
        },
      }),
    );
    svc.registerProvider(
      streamingAdapter('google', {
        family: 'google',
        execute: async () => {
          throw new Error('google execute failed');
        },
      }),
    );

    // The genuine downstream failure is NOT replaced by a generic message.
    await expect(svc.stream(request)).rejects.toThrow(/google execute failed/i);
  });
});
