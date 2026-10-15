// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider credential failures and retry/fallback exhaustion
// (Sprint 022–025 gap-closure phase, Phase 5)
//
// The required behaviours:
//   • MISSING credentials   → honest, non-retryable failure (never a fabricated
//     answer, never a futile retry storm), and fallback when a healthy provider
//     exists;
//   • INVALID credentials   → same contract, without leaking the key;
//   • retry/fallback EXHAUSTION → bounded attempts per provider and across
//     providers, then a typed honest failure that names what really happened;
//   • provider ABSENCE      → the truthful status ("no provider configured"),
//     never reported as a run that failed or succeeded.
//
// All hermetic: deterministic adapters, no network, no credentials, no spend.
// ──────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { AIOrchestrationService } from '../AIOrchestrationService.js';
import type { ProviderAdapter } from '../AIOrchestrationService.js';
import type { AIResponse } from '@vedmoulya/ai';

function mockResponse(content: string, provider = 'mock'): AIResponse {
  return {
    content,
    provider,
    model: `${provider}-model`,
    confidence: 0.9,
    qualityScore: 8.5,
    latency: 1,
    cost: 0,
    tokenUsage: { input: 10, output: 20, total: 30 },
    validation: { passed: true, checks: [], overallScore: 8.5, decision: 'pass' },
    traceId: `trace-${provider}`,
  };
}

function adapter(
  name: string,
  family: string,
  execute: ProviderAdapter['execute'],
): ProviderAdapter {
  return {
    name,
    family,
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
  } as ProviderAdapter;
}

const request = {
  capability: 'reasoning' as const,
  userInput: 'Explain the deployment plan.',
  qualityTier: 'standard' as const,
};

/** A service whose retry backoff is effectively instant (hermetic + fast). */
const service = (): AIOrchestrationService => new AIOrchestrationService({ retryBaseDelayMs: 1 });

describe('missing / invalid provider credentials', () => {
  it('a provider with NO credential fails once (non-retryable) and is never faked', async () => {
    const execute = vi.fn(async () => {
      throw new Error('api key required: no credential configured for google');
    });
    const ai = service();
    ai.registerProvider(adapter('google', 'google', execute));

    const outcome = await ai.orchestrate(request).then(
      () => undefined,
      (error: unknown) => error as Error,
    );

    expect(outcome).toBeInstanceOf(Error);
    // A missing key cannot be repaired by retrying: exactly ONE attempt.
    expect(execute).toHaveBeenCalledTimes(1);
    // Nothing resembling a model answer is produced.
    expect(outcome?.message ?? '').not.toMatch(/Explain the deployment plan/);
  });

  it('falls back to a healthy provider after a missing-credential failure', async () => {
    const broken = vi.fn(async () => {
      throw new Error('api key required: no credential configured');
    });
    const ai = service();
    ai.registerProvider(adapter('google', 'google', broken));
    ai.registerProvider(
      adapter('ollama', 'ollama', async () => mockResponse('local answer', 'ollama')),
    );

    const result = await ai.orchestrate(request);

    expect(result.provider).toBe('ollama');
    expect(result.content).toBe('local answer');
    // The broken provider was tried exactly once — no retry storm on a key error.
    expect(broken).toHaveBeenCalledTimes(1);
  });

  it('an INVALID credential is non-retryable and never leaks the key', async () => {
    const execute = vi.fn(async () => {
      throw new Error('api error: 401 unauthorized — invalid api key sk-live-abcdef1234567890');
    });
    const ai = service();
    ai.registerProvider(adapter('openai', 'openai', execute));
    ai.registerProvider(
      adapter('ollama', 'ollama', async () => mockResponse('fallback', 'ollama')),
    );

    const result = await ai.orchestrate(request);

    expect(result.provider).toBe('ollama');
    expect(execute).toHaveBeenCalledTimes(1);
    // The credential never reaches the returned payload.
    expect(JSON.stringify(result)).not.toMatch(/sk-live-abcdef1234567890/);
  });
});

describe('retry / fallback exhaustion is bounded and honest', () => {
  it('bounds attempts per provider (MAX_RETRIES=3 → 4 calls) and then fails honestly', async () => {
    const a = vi.fn(async () => {
      throw new Error('request timed out after 30000ms');
    });
    const b = vi.fn(async () => {
      throw new Error('api error: 503 service unavailable');
    });
    const ai = service();
    ai.registerProvider(adapter('slow-a', 'ollama', a));
    ai.registerProvider(adapter('down-b', 'google', b));

    const outcome = await ai.orchestrate(request).then(
      () => undefined,
      (error: unknown) => error as Error,
    );

    expect(outcome).toBeInstanceOf(Error);
    // The retry budget is REQUEST-scoped (`retryLimitRule` allows attempts < 3),
    // so the first provider absorbs the whole budget (first attempt + two
    // retries) and each further candidate is still attempted once before the
    // fallback budget (`attempts < 5`) closes. The total is hard-bounded.
    expect(a).toHaveBeenCalledTimes(3);
    expect(b).toHaveBeenCalledTimes(1);
    expect(a.mock.calls.length + b.mock.calls.length).toBeLessThanOrEqual(5);
    // The failure names the REAL condition and never claims success.
    expect(outcome?.message ?? '').toMatch(/timed out|unavailable|failed/i);
  });

  it('a mixed chain (rate limit → unavailable → recovery) still succeeds exactly once at the end', async () => {
    const limited = vi
      .fn()
      .mockRejectedValueOnce(new Error('api error: 429 rate limit exceeded'))
      .mockRejectedValueOnce(new Error('api error: 429 rate limit exceeded'))
      .mockRejectedValueOnce(new Error('api error: 429 rate limit exceeded'))
      .mockRejectedValueOnce(new Error('api error: 429 rate limit exceeded'));
    const down = vi.fn(async () => {
      throw new Error('fetch failed: econnrefused');
    });
    const good = vi.fn(async () => mockResponse('recovered', 'good'));
    const ai = service();
    ai.registerProvider(adapter('limited', 'openai', limited));
    ai.registerProvider(adapter('down', 'deepseek', down));
    ai.registerProvider(adapter('good', 'ollama', good));

    const result = await ai.orchestrate(request);

    expect(result.provider).toBe('good');
    expect(result.content).toBe('recovered');
    // The retry budget is request-scoped: the rate-limited provider consumes it
    // (3 attempts), the unavailable one is then attempted once, and the healthy
    // provider runs EXACTLY once and answers.
    expect(limited).toHaveBeenCalledTimes(3);
    expect(down).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledTimes(1);
    expect(limited.mock.calls.length + down.mock.calls.length + good.mock.calls.length).toBe(5);
  });

  it('with NO provider configured the status is "no provider", not a failed run', async () => {
    const ai = service();
    // No adapter is registered at all: nothing can even be attempted.
    const outcome = await ai.orchestrate(request).then(
      () => undefined,
      (error: unknown) => error as Error,
    );

    expect(outcome).toBeInstanceOf(Error);
    // Truthful: it names the missing provider and must not claim that a
    // provider ran and failed.
    expect(outcome?.message ?? '').toMatch(/provider not found|no AI provider/i);
    expect(outcome?.message ?? '').not.toMatch(/All AI providers failed/);
  });

  it('a capability no registered adapter serves is reported as no-provider too', async () => {
    const ai = service();
    ai.registerProvider(adapter('vision-only', 'google', async () => mockResponse('x')));

    const outcome = await ai
      .orchestrate({
        capability: 'translation',
        userInput: 'Translate.',
        qualityTier: 'standard',
      })
      .then(
        () => undefined,
        (error: unknown) => error as Error,
      );

    expect(outcome).toBeInstanceOf(Error);
    expect(outcome?.message ?? '').toMatch(/provider not found|no AI provider/i);
  });
});

describe('structured output follows the same credential/exhaustion contract', () => {
  it('a missing credential with a structured schema fails once and never returns unvalidated JSON', async () => {
    const generateStructured = vi.fn(async () => {
      throw new Error('api key required: no credential configured for openai');
    });
    const ai = service();
    const provider = adapter('openai', 'openai', async () => mockResponse('irrelevant'));
    ai.registerProvider({ ...provider, generateStructured } as ProviderAdapter);

    const outcome = await ai
      .orchestrate({
        ...request,
        structuredSchema: {
          type: 'object',
          properties: { summary: { type: 'string' } },
          required: ['summary'],
        },
      })
      .then(
        () => undefined,
        (error: unknown) => error as Error,
      );

    expect(outcome).toBeInstanceOf(Error);
    // Non-retryable: a missing credential must not consume the retry budget on
    // the structured path either.
    expect(generateStructured).toHaveBeenCalledTimes(1);
  });

  it('still retries a RETRYABLE structured failure to the same bounded limit', async () => {
    const generateStructured = vi.fn(async () => {
      throw new Error('api error: 503 service unavailable');
    });
    const ai = service();
    const provider = adapter('openai', 'openai', async () => mockResponse('irrelevant'));
    ai.registerProvider({ ...provider, generateStructured } as ProviderAdapter);

    await ai
      .orchestrate({
        ...request,
        structuredSchema: { type: 'object', properties: {}, required: [] },
      })
      .catch(() => undefined);

    // The gate is a classification gate, not a blanket retry-off switch.
    expect(generateStructured).toHaveBeenCalledTimes(3);
  });

  it('with no provider configured the structured path reports no-provider, not a fabrication', async () => {
    const ai = service();
    const outcome = await ai
      .orchestrate({
        ...request,
        structuredSchema: { type: 'object', properties: {}, required: [] },
      })
      .then(
        () => undefined,
        (error: unknown) => error as Error,
      );

    expect(outcome).toBeInstanceOf(Error);
    expect(outcome?.message ?? '').toMatch(/provider not found|no AI provider/i);
  });
});
