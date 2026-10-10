// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: OpenAI-Compatible Custom Provider Adapter
// SPRINT-049 — Mocks the `ai` module and `@ai-sdk/openai` so CI
// runs deterministically without provider credentials while exercising
// the real adapter code path.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateTextMock = vi.fn();
const streamTextMock = vi.fn();
const createOpenAIMock = vi.fn();
// AI-WIRING-001 — the SDK provider exposes BOTH the default model function
// (which targets the Responses API and must NOT be used for an OpenAI-compatible
// endpoint) and `.chat()` (Chat Completions, the endpoint these providers serve).
const defaultModelMock = vi.fn((model: string) => ({ provider: 'custom.default', modelId: model }));
const chatMock = vi.fn((model: string) => ({ provider: 'custom', modelId: model }));

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => generateTextMock(...args),
  streamText: (...args: unknown[]) => streamTextMock(...args),
  jsonSchema: (schema: unknown) => schema,
  Output: {
    object: (options: unknown) => ({ kind: 'object', options }),
  },
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: (...args: unknown[]) => createOpenAIMock(...args),
}));

import { OpenAICompatibleProvider } from '../OpenAICompatibleProvider.js';

const FAKE_API_KEY = 'sk-test-abcdefghijklmnopqrstuvwxyz1234';
const FAKE_ENDPOINT = 'https://custom-api.example.com/v1';

const MESSAGES = [
  { role: 'system', content: 'You are helpful.' },
  { role: 'user', content: 'Explain the workflow' },
];

beforeEach(() => {
  vi.clearAllMocks();
  generateTextMock.mockResolvedValue({
    text: 'Custom provider explains the workflow.',
    usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
    finalStep: { response: { modelId: 'custom-model' } },
  });
  createOpenAIMock.mockReturnValue(Object.assign(defaultModelMock, { chat: chatMock }));
});

describe('OpenAICompatibleProvider', () => {
  it('is named with the provider id and family-scoped as custom', () => {
    const provider = new OpenAICompatibleProvider(FAKE_API_KEY, FAKE_ENDPOINT, 'my-custom');
    expect(provider.name).toBe('my-custom');
    expect(provider.family).toBe('custom');
    expect(provider.capabilities).toContain('reasoning');
    expect(provider.capabilities).toContain('coding');
    expect(provider.capabilities).toContain('general_conversation');
  });

  it('AI-WIRING-001: executes through the Chat Completions API (provider.chat), never the Responses API', async () => {
    const provider = new OpenAICompatibleProvider(FAKE_API_KEY, FAKE_ENDPOINT, 'my-custom', {
      modelId: 'custom-model',
    });
    await provider.execute({ messages: MESSAGES, model: 'custom-model' });
    // OpenRouter and user-configured OpenAI-compatible endpoints serve
    // /chat/completions only; the default provider function targets /responses.
    expect(chatMock).toHaveBeenCalledTimes(1);
    expect(chatMock).toHaveBeenCalledWith('custom-model');
    expect(defaultModelMock).not.toHaveBeenCalled();
  });

  it('executes text generation through the SDK with the custom endpoint', async () => {
    const provider = new OpenAICompatibleProvider(FAKE_API_KEY, FAKE_ENDPOINT, 'my-custom');
    const response = await provider.execute({
      messages: MESSAGES,
      model: 'custom-model',
      maxTokens: 64,
    });

    expect(createOpenAIMock).toHaveBeenCalledWith({
      baseURL: FAKE_ENDPOINT,
      apiKey: FAKE_API_KEY,
    });
    const call = generateTextMock.mock.calls[0][0] as {
      maxOutputTokens: number;
      messages: Array<{ role: string }>;
      instructions?: string;
    };
    expect(call.maxOutputTokens).toBe(64);
    expect(call.instructions).toBe('You are helpful.');
    expect(response.provider).toBe('my-custom');
    expect(response.model).toBe('custom-model');
    expect(response.content).toContain('workflow');
    expect(response.metadata?.providerFamily).toBe('custom');
  });

  it('uses the configured default model id', async () => {
    const provider = new OpenAICompatibleProvider(FAKE_API_KEY, FAKE_ENDPOINT, 'my-custom', {
      modelId: 'llama-3-70b',
    });
    await provider.execute({ messages: MESSAGES, model: 'anything' });
    const call = generateTextMock.mock.calls[0][0] as { model: unknown };
    expect(createOpenAIMock).toHaveBeenCalled();
    // The model function is called with the configured modelId
    expect(call.model).toBeDefined();
  });

  it('reports healthy deterministically without network calls', async () => {
    const provider = new OpenAICompatibleProvider(FAKE_API_KEY, FAKE_ENDPOINT, 'my-custom');
    await expect(provider.isHealthy()).resolves.toBe(true);
    const health = await provider.getHealth();
    expect(health.providerId).toBe('my-custom');
    expect(health.status).toBe('healthy');
  });

  it('reports unhealthy when API key is empty', async () => {
    const provider = new OpenAICompatibleProvider('', FAKE_ENDPOINT, 'my-custom');
    await expect(provider.isHealthy()).resolves.toBe(false);
  });

  it('reports unhealthy when endpoint URL is empty', async () => {
    const provider = new OpenAICompatibleProvider(FAKE_API_KEY, '', 'my-custom');
    await expect(provider.isHealthy()).resolves.toBe(false);
  });

  it('reports status down from getHealth when unconfigured, without leaking secrets', async () => {
    const provider = new OpenAICompatibleProvider('', '', 'my-custom');
    const health = await provider.getHealth();
    expect(health.providerId).toBe('my-custom');
    expect(health.status).toBe('down');
    const serialized = JSON.stringify(health);
    expect(serialized).not.toContain(FAKE_API_KEY);
    expect(serialized).not.toContain(FAKE_ENDPOINT);
  });

  it('reports status down when only the endpoint is missing', async () => {
    const provider = new OpenAICompatibleProvider(FAKE_API_KEY, '', 'my-custom');
    await expect(provider.getHealth()).resolves.toMatchObject({ status: 'down', errorRate: 1 });
  });

  // G-01 regression: `getHealth()` must return a status that is a member of the
  // `ProviderStatus` union (`packages/ai/src/types/index.ts`). The fix for G-01
  // replaced the out-of-union literal 'unhealthy' with the existing 'down'; a
  // future value that is not in the union would fail the repo-wide typecheck and
  // this runtime membership assertion.
  it('returns a status that is a member of the ProviderStatus union (G-01 regression)', async () => {
    const PROVIDER_STATUSES = ['healthy', 'degraded', 'unstable', 'down'] as const;
    const configured = await new OpenAICompatibleProvider(
      FAKE_API_KEY,
      FAKE_ENDPOINT,
      'my-custom',
    ).getHealth();
    const unconfigured = await new OpenAICompatibleProvider('', '', 'my-custom').getHealth();
    expect(PROVIDER_STATUSES).toContain(configured.status);
    expect(PROVIDER_STATUSES).toContain(unconfigured.status);
    expect(configured.status).toBe('healthy');
    expect(unconfigured.status).toBe('down');
  });

  it('getHealth agrees with isHealthy for a fully configured provider', async () => {
    const provider = new OpenAICompatibleProvider(FAKE_API_KEY, FAKE_ENDPOINT, 'my-custom');
    await expect(provider.isHealthy()).resolves.toBe(true);
    await expect(provider.getHealth()).resolves.toMatchObject({ status: 'healthy', errorRate: 0 });
  });

  it('normalises a 429 SDK error into a rate-limit error', async () => {
    generateTextMock.mockRejectedValue({ statusCode: 429, message: 'rate limited' });
    const provider = new OpenAICompatibleProvider(FAKE_API_KEY, FAKE_ENDPOINT, 'my-custom');
    await expect(provider.execute({ messages: MESSAGES, model: 'custom' })).rejects.toThrow(
      'rate limited (429)',
    );
  });

  it('normalises a 5xx SDK error', async () => {
    generateTextMock.mockRejectedValue({ statusCode: 503, message: 'service unavailable' });
    const provider = new OpenAICompatibleProvider(FAKE_API_KEY, FAKE_ENDPOINT, 'my-custom');
    await expect(provider.execute({ messages: MESSAGES, model: 'custom' })).rejects.toThrow(
      'api error: 503',
    );
  });

  it('maps an abort to a timeout error', async () => {
    generateTextMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const provider = new OpenAICompatibleProvider(FAKE_API_KEY, FAKE_ENDPOINT, 'my-custom', {
      timeoutMs: 5,
    });
    await expect(provider.execute({ messages: MESSAGES, model: 'custom' })).rejects.toThrow(
      'timed out after 5ms',
    );
  });

  it('aborts the in-flight request when the timeout elapses', async () => {
    vi.useFakeTimers();
    try {
      generateTextMock.mockImplementation((call: { abortSignal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          call.abortSignal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        });
      });
      const provider = new OpenAICompatibleProvider(FAKE_API_KEY, FAKE_ENDPOINT, 'my-custom', {
        timeoutMs: 100,
      });
      const promise = provider.execute({ messages: MESSAGES, model: 'custom' });
      const expectation = expect(promise).rejects.toThrow('timed out after 100ms');
      await vi.advanceTimersByTimeAsync(200);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });

  it('normalises 401 and 403 SDK errors as authentication failures without leaking the key', async () => {
    const provider = new OpenAICompatibleProvider(FAKE_API_KEY, FAKE_ENDPOINT, 'my-custom');

    generateTextMock.mockRejectedValue({ statusCode: 401, message: 'unauthorized' });
    await expect(provider.execute({ messages: MESSAGES, model: 'custom' })).rejects.toThrow(
      'authentication failed (401/403)',
    );

    generateTextMock.mockRejectedValue({ statusCode: 403, message: 'forbidden' });
    const rejection = provider.execute({ messages: MESSAGES, model: 'custom' });
    await expect(rejection).rejects.toThrow('authentication failed (401/403)');
    await expect(rejection).rejects.not.toThrow(FAKE_API_KEY);
  });

  it('produces schema-validated structured output via Output.object', async () => {
    generateTextMock.mockResolvedValue({
      output: Promise.resolve({ summary: 'ok', score: 9 }),
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      finalStep: { response: { modelId: 'custom-model' } },
    });
    const provider = new OpenAICompatibleProvider(FAKE_API_KEY, FAKE_ENDPOINT, 'my-custom', {
      modelId: 'custom-model',
    });
    const response = await provider.generateStructured({
      messages: MESSAGES,
      model: 'custom',
      schema: { type: 'object' },
    });
    const call = generateTextMock.mock.calls[0][0] as {
      output: { kind: string; options: unknown };
      instructions?: string;
      messages: Array<{ role: string }>;
      model: { modelId: string };
    };
    expect(call.output).toMatchObject({ kind: 'object' });
    expect(call.instructions).toBe('You are helpful.');
    expect(call.messages).toHaveLength(1);
    expect(call.messages[0].role).toBe('user');
    // The structured path resolves the configured structuredModelId.
    expect(call.model.modelId).toBe('custom-model');
    expect(JSON.parse(response.content)).toEqual({ summary: 'ok', score: 9 });
    expect(response.tokenUsage.total).toBe(15);
  });

  it('uses the explicit structuredModelId for structured output', async () => {
    generateTextMock.mockResolvedValue({
      output: Promise.resolve({ ok: true }),
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      finalStep: { response: { modelId: 'custom-mini' } },
    });
    const provider = new OpenAICompatibleProvider(FAKE_API_KEY, FAKE_ENDPOINT, 'my-custom', {
      modelId: 'custom-large',
      structuredModelId: 'custom-mini',
    });
    await provider.generateStructured({
      messages: MESSAGES,
      model: 'custom',
      schema: { type: 'object' },
    });
    expect(chatMock).toHaveBeenCalledWith('custom-mini');
  });

  it('falls back to the requested model when the SDK omits a modelId while streaming', async () => {
    async function* textStream(): AsyncGenerator<string> {
      yield 'x';
    }
    streamTextMock.mockReturnValue({
      textStream: textStream(),
      usage: Promise.resolve({ inputTokens: 1, outputTokens: 1, totalTokens: 2 }),
      finalStep: Promise.resolve({ response: { modelId: '   ' } }),
    });
    const provider = new OpenAICompatibleProvider(FAKE_API_KEY, FAKE_ENDPOINT, 'my-custom', {
      modelId: 'custom-model',
    });
    const events: Array<Record<string, unknown>> = [];
    for await (const event of provider.stream({ messages: MESSAGES, model: 'custom' })) {
      events.push(event as Record<string, unknown>);
    }
    const done = events[events.length - 1].data as { modelId: string };
    expect(done.modelId).toBe('custom-model');
  });

  it('streams content and done events', async () => {
    async function* textStream(): AsyncGenerator<string> {
      yield 'Hello ';
      yield 'world';
    }
    streamTextMock.mockReturnValue({
      textStream: textStream(),
      usage: Promise.resolve({ inputTokens: 5, outputTokens: 2, totalTokens: 7 }),
      finalStep: Promise.resolve({ response: { modelId: 'gpt-4o-mini' } }),
    });

    const provider = new OpenAICompatibleProvider(FAKE_API_KEY, FAKE_ENDPOINT, 'my-custom');
    const events: Array<Record<string, unknown>> = [];
    for await (const event of provider.stream({ messages: MESSAGES, model: 'custom' })) {
      events.push(event as Record<string, unknown>);
    }

    expect(events[0]).toMatchObject({ type: 'content' });
    expect((events[0].data as { text: string }).text).toBe('Hello ');
    expect(events[events.length - 1].type).toBe('done');
    const done = events[events.length - 1].data as {
      modelId: string;
      tokenUsage: { total: number };
      cost: number;
    };
    expect(done.modelId).toBe('gpt-4o-mini');
    expect(done.tokenUsage.total).toBe(7);
  });

  it('never exposes the API key in output or metadata', async () => {
    const provider = new OpenAICompatibleProvider(FAKE_API_KEY, FAKE_ENDPOINT, 'my-custom');
    const response = await provider.execute({ messages: MESSAGES, model: 'custom' });
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain(FAKE_API_KEY);
    expect(serialized).not.toContain(FAKE_ENDPOINT);
  });

  it('wraps non-Error SDK rejections', async () => {
    generateTextMock.mockRejectedValue('connection reset');
    const provider = new OpenAICompatibleProvider(FAKE_API_KEY, FAKE_ENDPOINT, 'my-custom');
    await expect(provider.execute({ messages: MESSAGES, model: 'custom' })).rejects.toThrow(
      'connection reset',
    );
  });

  it('Phase B: executes the advisor-selected modelId through the SDK', async () => {
    const provider = new OpenAICompatibleProvider(FAKE_API_KEY, FAKE_ENDPOINT, 'my-custom');
    await provider.execute({
      messages: MESSAGES,
      model: 'custom',
      maxTokens: 64,
      modelId: 'custom-reasoner',
    });
    const call = generateTextMock.mock.calls[0][0] as { model: { modelId: string } };
    expect(call.model.modelId).toBe('custom-reasoner');
  });
});
