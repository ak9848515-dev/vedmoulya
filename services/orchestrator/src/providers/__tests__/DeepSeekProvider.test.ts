// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: DeepSeek Provider Adapter
// Mocks the `ai` module and `createOpenAI` so CI runs deterministically
// without provider credentials while exercising the real adapter code
// path (message mapping, OpenAI-compatible client wiring, usage
// accounting, timeout, error normalisation).
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

import { DeepSeekProvider, DEEPSEEK_BASE_URL } from '../DeepSeekProvider.js';

const MESSAGES = [
  { role: 'system', content: 'You are helpful.' },
  { role: 'user', content: 'Explain the workflow' },
];

beforeEach(() => {
  vi.clearAllMocks();
  generateTextMock.mockResolvedValue({
    text: 'DeepSeek explains the workflow.',
    usage: { inputTokens: 12, outputTokens: 9, totalTokens: 21 },
    finalStep: { response: { modelId: 'deepseek-chat' } },
  });
  // Default mock client: a callable that returns the model descriptor.
  createOpenAIMock.mockReturnValue((model: string) => ({ provider: 'deepseek', modelId: model }));
});

describe('DeepSeekProvider', () => {
  it('is named and family-scoped as deepseek with catalog-accurate capabilities', () => {
    const provider = new DeepSeekProvider('sk-test');
    expect(provider.name).toBe('deepseek');
    expect(provider.family).toBe('deepseek');
    // Honest boundary: no vision / embeddings / speech.
    expect(provider.capabilities).toContain('reasoning');
    expect(provider.capabilities).toContain('coding');
    expect(provider.capabilities).not.toContain('vision');
    expect(provider.capabilities).not.toContain('embeddings');
    expect(provider.capabilities).not.toContain('speech');
  });

  it('executes text generation through the SDK with usage accounting', async () => {
    const provider = new DeepSeekProvider('sk-test');
    const response = await provider.execute({
      messages: MESSAGES,
      model: 'deepseek',
      maxTokens: 64,
    });

    expect(createOpenAIMock).toHaveBeenCalledWith({
      baseURL: DEEPSEEK_BASE_URL,
      apiKey: 'sk-test',
    });
    const call = generateTextMock.mock.calls[0][0] as {
      maxOutputTokens: number;
      messages: Array<{ role: string }>;
      instructions?: string;
      abortSignal: unknown;
    };
    expect(call.maxOutputTokens).toBe(64);
    // System prompt must ride the top-level `instructions` option — the SDK
    // rejects a `system` role inside the messages array.
    expect(call.messages).toHaveLength(1);
    expect(call.messages[0].role).toBe('user');
    expect(call.instructions).toBe('You are helpful.');
    expect(call.abortSignal).toBeDefined();

    expect(response.provider).toBe('deepseek');
    expect(response.model).toBe('deepseek-chat');
    expect(response.content).toContain('workflow');
    expect(response.tokenUsage.input).toBe(12);
    expect(response.tokenUsage.total).toBe(21);
    expect(response.metadata?.providerFamily).toBe('deepseek');
  });

  it('omits instructions when no system prompt exists and keeps assistant turns', async () => {
    const provider = new DeepSeekProvider('sk-test');
    await provider.execute({
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
        { role: 'user', content: 'again' },
      ],
      model: 'deepseek',
    });
    const call = generateTextMock.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
      instructions?: string;
    };
    expect(call.instructions).toBeUndefined();
    expect(call.messages).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'again' },
    ]);
  });

  it('passes instructions through generateStructured and stream', async () => {
    generateTextMock.mockResolvedValue({
      output: Promise.resolve({ ok: true }),
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      finalStep: { response: { modelId: 'deepseek-chat' } },
    });
    const provider = new DeepSeekProvider('sk-test');
    await provider.generateStructured({
      messages: MESSAGES,
      model: 'deepseek',
      schema: { type: 'object' },
    });
    const structuredCall = generateTextMock.mock.calls[0][0] as {
      instructions?: string;
      messages: Array<{ role: string }>;
    };
    expect(structuredCall.instructions).toBe('You are helpful.');
    expect(structuredCall.messages).toHaveLength(1);
    expect(structuredCall.messages[0].role).toBe('user');

    async function* textStream(): AsyncGenerator<string> {
      yield 'x';
    }
    streamTextMock.mockReturnValue({
      textStream: textStream(),
      usage: Promise.resolve({ inputTokens: 1, outputTokens: 1, totalTokens: 2 }),
    });
    const events: unknown[] = [];
    for await (const event of provider.stream({ messages: MESSAGES, model: 'deepseek' })) {
      events.push(event);
    }
    const streamCall = streamTextMock.mock.calls[0][0] as {
      instructions?: string;
      messages: Array<{ role: string }>;
    };
    expect(streamCall.instructions).toBe('You are helpful.');
    expect(streamCall.messages).toHaveLength(1);
  });

  it('normalises a 429 SDK error into a rate-limit error', async () => {
    generateTextMock.mockRejectedValue({ statusCode: 429, message: 'rate limited' });
    const provider = new DeepSeekProvider('sk-test');
    await expect(provider.execute({ messages: MESSAGES, model: 'deepseek' })).rejects.toThrow(
      'rate limited (429)',
    );
  });

  it('normalises a 5xx SDK error for provider_unavailable classification', async () => {
    generateTextMock.mockRejectedValue({ statusCode: 503, message: 'service unavailable' });
    const provider = new DeepSeekProvider('sk-test');
    await expect(provider.execute({ messages: MESSAGES, model: 'deepseek' })).rejects.toThrow(
      'api error: 503',
    );
  });

  it('maps an abort to a timeout error', async () => {
    generateTextMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const provider = new DeepSeekProvider('sk-test', { timeoutMs: 5 });
    await expect(provider.execute({ messages: MESSAGES, model: 'deepseek' })).rejects.toThrow(
      'timed out after 5ms',
    );
  });

  it('produces schema-validated structured output via Output.object', async () => {
    generateTextMock.mockResolvedValue({
      output: Promise.resolve({ summary: 'ok', score: 9 }),
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      finalStep: { response: { modelId: 'deepseek-chat' } },
    });
    const provider = new DeepSeekProvider('sk-test');
    const response = await provider.generateStructured({
      messages: MESSAGES,
      model: 'deepseek',
      schema: { type: 'object' },
    });
    const call = generateTextMock.mock.calls[0][0] as {
      output: { kind: string; options: unknown };
    };
    expect(call.output).toMatchObject({ kind: 'object' });
    expect(JSON.parse(response.content)).toEqual({ summary: 'ok', score: 9 });
    expect(response.tokenUsage.total).toBe(15);
  });

  it('streams content and done events through the SDK text stream', async () => {
    async function* textStream(): AsyncGenerator<string> {
      yield 'Hello ';
      yield 'world';
    }
    streamTextMock.mockReturnValue({
      textStream: textStream(),
      usage: Promise.resolve({ inputTokens: 5, outputTokens: 2, totalTokens: 7 }),
    });

    const provider = new DeepSeekProvider('sk-test');
    const events: Array<Record<string, unknown>> = [];
    for await (const event of provider.stream({ messages: MESSAGES, model: 'deepseek' })) {
      events.push(event as Record<string, unknown>);
    }

    expect(events[0]).toMatchObject({ type: 'content' });
    expect((events[0].data as { text: string }).text).toBe('Hello ');
    expect(events[events.length - 1].type).toBe('done');
  });

  it('reports healthy deterministically without network calls', async () => {
    const provider = new DeepSeekProvider('sk-test');
    await expect(provider.isHealthy()).resolves.toBe(true);
    const health = await provider.getHealth();
    expect(health.providerId).toBe('deepseek');
    expect(health.status).toBe('healthy');
    expect(health.isRateLimited).toBe(false);
  });

  it('honours explicit input/output per-1K pricing options', async () => {
    const provider = new DeepSeekProvider('sk-test', {
      inputPer1K: 0.01,
      outputPer1K: 0.02,
      modelId: 'deepseek-reasoner',
    });
    const response = await provider.execute({ messages: MESSAGES, model: 'deepseek' });
    expect(response.model).toBe('deepseek-chat');
    // 12 input tokens at $0.01/1K + 9 output tokens at $0.02/1K = 0.00012 + 0.00018 = 0.0003.
    expect(response.cost).toBeCloseTo(0.0003, 7);
  });

  it('defaults to registry-estimate pricing for deepseek-chat', async () => {
    const provider = new DeepSeekProvider('sk-test');
    const response = await provider.execute({ messages: MESSAGES, model: 'deepseek' });
    // 12 input × $0.00027/1K + 9 output × $0.0011/1K = 0.00000324 + 0.0000099 = 0.00001314.
    expect(response.cost).toBeCloseTo(0.00001314, 10);
  });

  it('normalises a 401 SDK error as an authentication failure', async () => {
    generateTextMock.mockRejectedValue({ statusCode: 401, message: 'unauthorized' });
    const provider = new DeepSeekProvider('sk-test');
    await expect(provider.execute({ messages: MESSAGES, model: 'deepseek' })).rejects.toThrow(
      'authentication failed (401)',
    );
  });

  it('wraps non-Error SDK rejections in a descriptive Error', async () => {
    generateTextMock.mockRejectedValue('connection reset');
    const provider = new DeepSeekProvider('sk-test');
    await expect(provider.execute({ messages: MESSAGES, model: 'deepseek' })).rejects.toThrow(
      'connection reset',
    );
  });

  it('honours an explicit baseURL override', async () => {
    const provider = new DeepSeekProvider('sk-test', { baseURL: 'https://proxy.example.com' });
    await provider.execute({ messages: MESSAGES, model: 'deepseek' });
    expect(createOpenAIMock).toHaveBeenCalledWith({
      baseURL: 'https://proxy.example.com',
      apiKey: 'sk-test',
    });
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
      const provider = new DeepSeekProvider('sk-test', { timeoutMs: 100 });
      const promise = provider.execute({ messages: MESSAGES, model: 'deepseek' });
      const expectation = expect(promise).rejects.toThrow('timed out after 100ms');
      await vi.advanceTimersByTimeAsync(200);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });
});
