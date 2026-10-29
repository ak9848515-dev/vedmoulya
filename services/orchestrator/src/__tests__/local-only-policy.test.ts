// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — B3 · LOCAL-ONLY PROVIDER EXECUTION POLICY
//
// WHY A POLICY AND NOT A PREFERENCE
// --------------------------------
// `AI_DEFAULT_PROVIDER` only SORTS registration, and the routing advisor's
// `preferredProviders` is a flat +0.15 score hint. Neither is a guarantee: a
// failed primary, an advisor fallback, a retry hop or a last-resort synthetic
// provider can all reach a CLOUD provider that the deployment explicitly must
// not use. For a mission that must never spend money, ranking is not enough —
// the policy has to be enforced at the EXECUTION BOUNDARY, where the candidate
// list is built.
//
// These tests therefore assert on ACTUAL CALLS (`execute`/`generateStructured`/
// `stream` invocations on the adapters), not on ranking output.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type { AIResponse, CapabilityType } from '@vedmoulya/ai';
import {
  AIOrchestrationService,
  LocalOnlyProviderUnavailableError,
  type ProviderAdapter,
} from '@vedmoulya/services';

/** A spy adapter: records every execution, returns a valid response. */
function makeAdapter(options: {
  name: string;
  family: string;
  capabilities?: CapabilityType[];
  /** Make the adapter fail (to exercise retry/fallback hops). */
  fails?: boolean;
  /** Make the adapter return empty content (to exercise B1). */
  emptyOutput?: boolean;
}): ProviderAdapter & { calls: string[] } {
  const calls: string[] = [];
  const build = (): AIResponse => ({
    content: options.emptyOutput === true ? '' : `${options.name} answer`,
    provider: options.name,
    model: `${options.name}-model`,
    confidence: 0.9,
    qualityScore: 9,
    latency: 5,
    cost: options.family === 'ollama' ? 0 : 0.01,
    tokenUsage: { input: 3, output: 2, total: 5 },
    validation: {
      passed: true,
      checks: [{ name: 'format', passed: true, score: 10 }],
      overallScore: 9,
      decision: 'pass',
    },
    traceId: `${options.name}-trace`,
    metadata: { providerFamily: options.family },
  });
  /** Structured output must be JSON when the request declares a schema. */
  const structured = (): AIResponse => ({ ...build(), content: JSON.stringify({ title: 'Doc' }) });

  const adapter = {
    name: options.name,
    family: options.family,
    capabilities: options.capabilities ?? (['content_generation'] as CapabilityType[]),
    calls,
    async isHealthy(): Promise<boolean> {
      return true;
    },
    async getHealth() {
      return {
        providerId: options.name,
        status: 'healthy' as const,
        latency: 5,
        errorRate: 0,
        lastChecked: new Date(),
        isRateLimited: false,
        rateLimitRemaining: 100,
        rateLimitReset: null,
      };
    },
    async execute(): Promise<AIResponse> {
      calls.push('execute');
      if (options.fails === true) throw new Error(`${options.name} exploded`);
      return build();
    },
    async generateStructured(): Promise<AIResponse> {
      calls.push('generateStructured');
      if (options.fails === true) throw new Error(`${options.name} exploded`);
      return structured();
    },
    async *stream() {
      calls.push('stream');
      if (options.fails === true) throw new Error(`${options.name} exploded`);
      yield { type: 'content', data: { text: `${options.name} answer` } };
      yield {
        type: 'done',
        data: {
          modelId: `${options.name}-model`,
          tokenUsage: { input: 3, output: 2, total: 5 },
          cost: options.family === 'ollama' ? 0 : 0.01,
        },
      };
    },
  } as unknown as ProviderAdapter & { calls: string[] };
  return adapter;
}

const request = {
  capability: 'content_generation' as CapabilityType,
  userInput: 'write a document',
  qualityTier: 'standard' as const,
};

describe('B3 · local-only policy is enforced at the execution boundary', () => {
  it('calls ONLY Ollama when a healthy cloud provider is also registered', async () => {
    const ollama = makeAdapter({ name: 'ollama', family: 'ollama' });
    const openai = makeAdapter({ name: 'openai', family: 'openai' });

    const orchestrator = new AIOrchestrationService({ localOnlyProviders: ['ollama'] });
    orchestrator.registerProvider(openai);
    orchestrator.registerProvider(ollama);

    const response = await orchestrator.orchestrate(request);

    expect(response.provider).toBe('ollama');
    expect(ollama.calls).toHaveLength(1);
    // THE ASSERTION THAT MATTERS: the cloud adapter was never invoked.
    expect(openai.calls).toEqual([]);
  });

  it('fails closed — never calls the cloud provider — when Ollama is unavailable', async () => {
    const openai = makeAdapter({ name: 'openai', family: 'openai' });
    const anthropic = makeAdapter({ name: 'anthropic', family: 'anthropic' });

    const orchestrator = new AIOrchestrationService({ localOnlyProviders: ['ollama'] });
    orchestrator.registerProvider(openai);
    orchestrator.registerProvider(anthropic);

    await expect(orchestrator.orchestrate(request)).rejects.toBeInstanceOf(
      LocalOnlyProviderUnavailableError,
    );
    await expect(orchestrator.orchestrate(request)).rejects.toMatchObject({
      code: 'LOCAL_ONLY_PROVIDER_UNAVAILABLE',
      capability: 'content_generation',
      allowedFamilies: ['ollama'],
    });
    expect(openai.calls).toEqual([]);
    expect(anthropic.calls).toEqual([]);
  });

  it('the typed error message names the policy and states cloud was not used', async () => {
    const orchestrator = new AIOrchestrationService({ localOnlyProviders: ['ollama'] });
    orchestrator.registerProvider(makeAdapter({ name: 'openai', family: 'openai' }));
    await expect(orchestrator.orchestrate(request)).rejects.toThrow(
      /Local-only policy is active.*Cloud providers were NOT used/s,
    );
  });

  it('a FAILING local provider cannot fall through to a cloud provider', async () => {
    const ollama = makeAdapter({ name: 'ollama', family: 'ollama', fails: true });
    const openai = makeAdapter({ name: 'openai', family: 'openai' });

    const orchestrator = new AIOrchestrationService({
      localOnlyProviders: ['ollama'],
      retryBaseDelayMs: 1,
    });
    orchestrator.registerProvider(openai);
    orchestrator.registerProvider(ollama);

    await expect(orchestrator.orchestrate(request)).rejects.toThrow();
    expect(ollama.calls.length).toBeGreaterThan(0); // retries happened, locally
    expect(openai.calls).toEqual([]); // but never left the machine
  });

  it('the synthetic mock cannot be used as a last resort in local-only mode', async () => {
    const mock = makeAdapter({ name: 'mock', family: 'mock' });
    const orchestrator = new AIOrchestrationService({ localOnlyProviders: ['ollama'] });
    orchestrator.registerProvider(mock);

    await expect(orchestrator.orchestrate(request)).rejects.toBeInstanceOf(
      LocalOnlyProviderUnavailableError,
    );
    expect(mock.calls).toEqual([]);
  });

  it('the structured-output path obeys the policy too', async () => {
    const ollama = makeAdapter({ name: 'ollama', family: 'ollama' });
    const openai = makeAdapter({ name: 'openai', family: 'openai' });

    const orchestrator = new AIOrchestrationService({ localOnlyProviders: ['ollama'] });
    orchestrator.registerProvider(openai);
    orchestrator.registerProvider(ollama);

    const response = await orchestrator.orchestrate({
      ...request,
      structuredSchema: {
        type: 'object',
        properties: { title: { type: 'string' } },
        required: ['title'],
      },
    });
    expect(response.provider).toBe('ollama');
    expect(openai.calls).toEqual([]);
  });

  it('the streaming path obeys the policy too', async () => {
    const ollama = makeAdapter({ name: 'ollama', family: 'ollama' });
    const openai = makeAdapter({ name: 'openai', family: 'openai' });

    const orchestrator = new AIOrchestrationService({ localOnlyProviders: ['ollama'] });
    orchestrator.registerProvider(openai);
    orchestrator.registerProvider(ollama);

    const run = await orchestrator.stream(request);

    // The streamed content came from Ollama's chunks, and OpenAI was never touched.
    const content = run.events
      .filter((event) => event.type === 'content')
      .map((event) => event.content ?? '')
      .join('');
    expect(content).toContain('ollama answer');
    expect(run.final.provider).toBe('ollama');
    expect(ollama.calls).toContain('stream');
    expect(openai.calls).toEqual([]);
  });

  it('canServe() reports not-ready instead of silently offering a cloud provider', () => {
    const orchestrator = new AIOrchestrationService({ localOnlyProviders: ['ollama'] });
    orchestrator.registerProvider(makeAdapter({ name: 'openai', family: 'openai' }));

    const result = orchestrator.canServe('content_generation');
    expect(result.ok).toBe(false);
    expect(result.providers).toEqual([]);
  });

  it('canServe() reports ready when an allowed local provider exists', () => {
    const orchestrator = new AIOrchestrationService({ localOnlyProviders: ['ollama'] });
    orchestrator.registerProvider(makeAdapter({ name: 'openai', family: 'openai' }));
    orchestrator.registerProvider(makeAdapter({ name: 'ollama', family: 'ollama' }));

    const result = orchestrator.canServe('content_generation');
    expect(result.ok).toBe(true);
    expect(result.providers).toEqual(['ollama']);
  });
});

describe('B3 · non-local-only configuration keeps existing behaviour', () => {
  it('without the policy, a registered cloud provider is still used', async () => {
    const openai = makeAdapter({ name: 'openai', family: 'openai' });
    const orchestrator = new AIOrchestrationService();
    orchestrator.registerProvider(openai);

    const response = await orchestrator.orchestrate(request);
    expect(response.provider).toBe('openai');
    expect(openai.calls).toHaveLength(1);
  });

  it('without the policy, fallback from a failing provider still works', async () => {
    const failing = makeAdapter({ name: 'openai', family: 'openai', fails: true });
    const backup = makeAdapter({ name: 'anthropic', family: 'anthropic' });
    const orchestrator = new AIOrchestrationService({ retryBaseDelayMs: 1 });
    orchestrator.registerProvider(failing);
    orchestrator.registerProvider(backup);

    const response = await orchestrator.orchestrate(request);
    expect(response.provider).toBe('anthropic');
  });

  it('an EMPTY allowlist means no policy (identical behaviour)', async () => {
    const openai = makeAdapter({ name: 'openai', family: 'openai' });
    const orchestrator = new AIOrchestrationService({ localOnlyProviders: [] });
    orchestrator.registerProvider(openai);
    const response = await orchestrator.orchestrate(request);
    expect(response.provider).toBe('openai');
  });

  it('an allowlist may permit several families (e.g. local + a self-hosted endpoint)', async () => {
    const ollama = makeAdapter({ name: 'ollama', family: 'ollama', fails: true });
    const selfHosted = makeAdapter({ name: 'my-vllm', family: 'my-vllm' });
    const openai = makeAdapter({ name: 'openai', family: 'openai' });
    const orchestrator = new AIOrchestrationService({
      localOnlyProviders: ['ollama', 'my-vllm'],
      retryBaseDelayMs: 1,
    });
    orchestrator.registerProvider(ollama);
    orchestrator.registerProvider(selfHosted);
    orchestrator.registerProvider(openai);

    const response = await orchestrator.orchestrate(request);
    expect(response.provider).toBe('my-vllm');
    expect(openai.calls).toEqual([]);
  });
});
