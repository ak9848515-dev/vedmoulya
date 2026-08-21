// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Google Gemini Provider Adapter
// SPRINT-049 — Mocks the `ai` module and `@ai-sdk/google` so CI
// runs deterministically without provider credentials while exercising
// the real adapter code path (message mapping, client wiring, usage
// accounting, timeout, error normalisation).
//
// AUTHENTICATION BOUNDARY: these tests use a FAKE API key. Google
// OAuth credentials are NEVER used as Gemini API keys — they are
// architecturally independent systems.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateTextMock = vi.fn();
const streamTextMock = vi.fn();
const createGoogleGenerativeAIMock = vi.fn();

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => generateTextMock(...args),
  streamText: (...args: unknown[]) => streamTextMock(...args),
  jsonSchema: (schema: unknown) => schema,
  Output: {
    object: (options: unknown) => ({ kind: 'object', options }),
  },
}));

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: (...args: unknown[]) => createGoogleGenerativeAIMock(...args),
}));

import { GoogleGeminiProvider } from '../GoogleGeminiProvider.js';

const FAKE_API_KEY = 'AIzaSy-abcdefghijklmnopqrstuvwxyz1234567890';

const MESSAGES = [
  { role: 'system', content: 'You are helpful.' },
  { role: 'user', content: 'Explain the workflow' },
];

beforeEach(() => {
  vi.clearAllMocks();
  generateTextMock.mockResolvedValue({
    text: 'Gemini explains the workflow.',
    usage: { inputTokens: 15, outputTokens: 12, totalTokens: 27 },
    finalStep: { response: { modelId: 'gemini-2.5-flash' } },
  });
  // Default mock client: a callable that returns the model descriptor.
  createGoogleGenerativeAIMock.mockReturnValue((model: string) => ({
    provider: 'google',
    modelId: model,
  }));
});

describe('GoogleGeminiProvider', () => {
  it('is named and family-scoped as google with catalog-accurate capabilities', () => {
    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    expect(provider.name).toBe('google');
    expect(provider.family).toBe('google');
    // Catalog entry capabilities: reasoning, coding, vision, speech, etc.
    expect(provider.capabilities).toContain('reasoning');
    expect(provider.capabilities).toContain('coding');
    expect(provider.capabilities).toContain('vision');
    expect(provider.capabilities).toContain('speech');
    expect(provider.capabilities).toContain('general_conversation');
    expect(provider.capabilities).toContain('content_generation');
  });

  it('executes text generation through the SDK with usage accounting', async () => {
    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    const response = await provider.execute({
      messages: MESSAGES,
      model: 'gemini',
      maxTokens: 64,
    });

    expect(createGoogleGenerativeAIMock).toHaveBeenCalledWith({
      apiKey: FAKE_API_KEY,
    });
    const call = generateTextMock.mock.calls[0][0] as {
      maxOutputTokens: number;
      messages: Array<{ role: string }>;
      instructions?: string;
      abortSignal: unknown;
    };
    expect(call.maxOutputTokens).toBe(64);
    // System prompt must ride the top-level `instructions` option.
    expect(call.messages).toHaveLength(1);
    expect(call.messages[0].role).toBe('user');
    expect(call.instructions).toBe('You are helpful.');
    expect(call.abortSignal).toBeDefined();

    expect(response.provider).toBe('google');
    expect(response.model).toBe('gemini-2.5-flash');
    expect(response.content).toContain('workflow');
    expect(response.tokenUsage.input).toBe(15);
    expect(response.tokenUsage.total).toBe(27);
    expect(response.metadata?.providerFamily).toBe('google');
  });

  it('omits instructions when no system prompt exists and keeps assistant turns', async () => {
    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    await provider.execute({
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
        { role: 'user', content: 'again' },
      ],
      model: 'gemini',
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
      finalStep: { response: { modelId: 'gemini-2.5-flash' } },
    });
    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    await provider.generateStructured({
      messages: MESSAGES,
      model: 'gemini',
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
    for await (const event of provider.stream({ messages: MESSAGES, model: 'gemini' })) {
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
    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    await expect(provider.execute({ messages: MESSAGES, model: 'gemini' })).rejects.toThrow(
      'rate limited (429)',
    );
  });

  it('normalises a 5xx SDK error for provider_unavailable classification', async () => {
    generateTextMock.mockRejectedValue({ statusCode: 503, message: 'service unavailable' });
    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    await expect(provider.execute({ messages: MESSAGES, model: 'gemini' })).rejects.toThrow(
      'api error: 503',
    );
  });

  it('maps an abort to a timeout error', async () => {
    generateTextMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const provider = new GoogleGeminiProvider(FAKE_API_KEY, { timeoutMs: 5 });
    await expect(provider.execute({ messages: MESSAGES, model: 'gemini' })).rejects.toThrow(
      'timed out after 5ms',
    );
  });

  it('produces schema-validated structured output via Output.object', async () => {
    generateTextMock.mockResolvedValue({
      output: Promise.resolve({ summary: 'ok', score: 9 }),
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      finalStep: { response: { modelId: 'gemini-2.5-flash' } },
    });
    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    const response = await provider.generateStructured({
      messages: MESSAGES,
      model: 'gemini',
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

    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    const events: Array<Record<string, unknown>> = [];
    for await (const event of provider.stream({ messages: MESSAGES, model: 'gemini' })) {
      events.push(event as Record<string, unknown>);
    }

    expect(events[0]).toMatchObject({ type: 'content' });
    expect((events[0].data as { text: string }).text).toBe('Hello ');
    expect(events[events.length - 1].type).toBe('done');
  });

  it('reports healthy deterministically without network calls', async () => {
    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    await expect(provider.isHealthy()).resolves.toBe(true);
    const health = await provider.getHealth();
    expect(health.providerId).toBe('google');
    expect(health.status).toBe('healthy');
    expect(health.isRateLimited).toBe(false);
  });

  it('reports unhealthy when API key is empty', async () => {
    const provider = new GoogleGeminiProvider('');
    await expect(provider.isHealthy()).resolves.toBe(false);
  });

  it('honours explicit input/output per-1K pricing options', async () => {
    const provider = new GoogleGeminiProvider(FAKE_API_KEY, {
      inputPer1K: 0.01,
      outputPer1K: 0.02,
      modelId: 'gemini-2.5-pro',
    });
    const response = await provider.execute({ messages: MESSAGES, model: 'gemini' });
    expect(response.model).toBe('gemini-2.5-flash');
    // 15 input tokens at $0.01/1K + 12 output tokens at $0.02/1K = 0.00015 + 0.00024 = 0.00039.
    expect(response.cost).toBeCloseTo(0.00039, 7);
  });

  it('defaults to registry-estimate pricing for gemini-2.5-flash', async () => {
    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    const response = await provider.execute({ messages: MESSAGES, model: 'gemini' });
    // 15 input × $0.00125/1K + 12 output × $0.01/1K = 0.00001875 + 0.00012 = 0.00013875.
    expect(response.cost).toBeCloseTo(0.00013875, 10);
  });

  it('normalises a 401 SDK error as an authentication failure', async () => {
    generateTextMock.mockRejectedValue({ statusCode: 401, message: 'unauthorized' });
    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    await expect(provider.execute({ messages: MESSAGES, model: 'gemini' })).rejects.toThrow(
      'authentication failed (401/403)',
    );
  });

  it('normalises a 403 SDK error as an authentication failure', async () => {
    generateTextMock.mockRejectedValue({ statusCode: 403, message: 'forbidden' });
    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    await expect(provider.execute({ messages: MESSAGES, model: 'gemini' })).rejects.toThrow(
      'authentication failed (401/403)',
    );
  });

  it('wraps non-Error SDK rejections in a descriptive Error', async () => {
    generateTextMock.mockRejectedValue('connection reset');
    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    await expect(provider.execute({ messages: MESSAGES, model: 'gemini' })).rejects.toThrow(
      'connection reset',
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
      const provider = new GoogleGeminiProvider(FAKE_API_KEY, { timeoutMs: 100 });
      const promise = provider.execute({ messages: MESSAGES, model: 'gemini' });
      const expectation = expect(promise).rejects.toThrow('timed out after 100ms');
      await vi.advanceTimersByTimeAsync(200);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });

  it('never exposes the API key in output or metadata', async () => {
    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    const response = await provider.execute({ messages: MESSAGES, model: 'gemini' });
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain(FAKE_API_KEY);
    expect(response.traceId).not.toContain(FAKE_API_KEY);
  });

  it('defaults to gemini-2.5-flash model', () => {
    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    expect(provider['modelId']).toBe('gemini-2.5-flash');
  });

  it('accepts custom model id', () => {
    const provider = new GoogleGeminiProvider(FAKE_API_KEY, {
      modelId: 'gemini-2.5-pro',
    });
    expect(provider['modelId']).toBe('gemini-2.5-pro');
  });
});
