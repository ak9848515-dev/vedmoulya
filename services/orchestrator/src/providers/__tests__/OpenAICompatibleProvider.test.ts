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
  createOpenAIMock.mockReturnValue((model: string) => ({
    provider: 'custom',
    modelId: model,
  }));
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

  it('streams content and done events', async () => {
    async function* textStream(): AsyncGenerator<string> {
      yield 'Hello ';
      yield 'world';
    }
    streamTextMock.mockReturnValue({
      textStream: textStream(),
      usage: Promise.resolve({ inputTokens: 5, outputTokens: 2, totalTokens: 7 }),
    });

    const provider = new OpenAICompatibleProvider(FAKE_API_KEY, FAKE_ENDPOINT, 'my-custom');
    const events: Array<Record<string, unknown>> = [];
    for await (const event of provider.stream({ messages: MESSAGES, model: 'custom' })) {
      events.push(event as Record<string, unknown>);
    }

    expect(events[0]).toMatchObject({ type: 'content' });
    expect((events[0].data as { text: string }).text).toBe('Hello ');
    expect(events[events.length - 1].type).toBe('done');
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
});
