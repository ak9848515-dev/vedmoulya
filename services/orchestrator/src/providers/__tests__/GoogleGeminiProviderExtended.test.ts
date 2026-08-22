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
const MESSAGES = [{ role: 'user', content: 'test' }];

beforeEach(() => {
  vi.clearAllMocks();
  generateTextMock.mockResolvedValue({
    text: 'ok',
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    finalStep: { response: { modelId: 'gemini-2.5-flash' } },
  });
  createGoogleGenerativeAIMock.mockReturnValue((model: string) => ({
    provider: 'google',
    modelId: model,
  }));
});

describe('GoogleGeminiProvider — stream edge cases', () => {
  it('handles an empty text stream (no chunks)', async () => {
    async function* emptyStream(): AsyncGenerator<string> {
      // yield nothing
    }
    streamTextMock.mockReturnValue({
      textStream: emptyStream(),
      usage: Promise.resolve({ inputTokens: 1, outputTokens: 0, totalTokens: 1 }),
    });

    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    const events: unknown[] = [];
    for await (const event of provider.stream({ messages: MESSAGES, model: 'gemini' })) {
      events.push(event);
    }

    // Only the done event (no content events)
    expect(events).toHaveLength(1);
    expect((events[0] as { type: string }).type).toBe('done');
    const doneData = (events[0] as { data: Record<string, unknown> }).data;
    const tokenUsage = doneData.tokenUsage as Record<string, number>;
    expect(tokenUsage.input).toBe(1);
    expect(tokenUsage.output).toBe(0);
  });

  it('normalises errors thrown by the stream text SDK', async () => {
    streamTextMock.mockReturnValue({
      textStream: {
        [Symbol.asyncIterator]: () => {
          return {
            next: () => Promise.reject({ statusCode: 429, message: 'rate limited' }),
            return: () => Promise.resolve({ done: true, value: undefined }),
          };
        },
      },
      usage: Promise.resolve({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
    });

    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    const gen = provider.stream({ messages: MESSAGES, model: 'gemini' });
    await expect(gen.next()).rejects.toThrow('rate limited (429)');
  });

  it('normalises 5xx errors in stream', async () => {
    streamTextMock.mockReturnValue({
      textStream: {
        [Symbol.asyncIterator]: () => {
          return {
            next: () => Promise.reject({ statusCode: 502, message: 'bad gateway' }),
            return: () => Promise.resolve({ done: true, value: undefined }),
          };
        },
      },
      usage: Promise.resolve({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
    });

    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    const gen = provider.stream({ messages: MESSAGES, model: 'gemini' });
    await expect(gen.next()).rejects.toThrow('api error: 502');
  });

  it('normalises abort errors in stream', async () => {
    streamTextMock.mockReturnValue({
      textStream: {
        [Symbol.asyncIterator]: () => {
          return {
            next: () => Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
            return: () => Promise.resolve({ done: true, value: undefined }),
          };
        },
      },
      usage: Promise.resolve({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
    });

    const provider = new GoogleGeminiProvider(FAKE_API_KEY, { timeoutMs: 5 });
    const gen = provider.stream({ messages: MESSAGES, model: 'gemini' });
    await expect(gen.next()).rejects.toThrow('timed out after 5ms');
  });

  it('normalises 401 errors in stream', async () => {
    streamTextMock.mockReturnValue({
      textStream: {
        [Symbol.asyncIterator]: () => {
          return {
            next: () => Promise.reject({ statusCode: 401, message: 'unauthorized' }),
            return: () => Promise.resolve({ done: true, value: undefined }),
          };
        },
      },
      usage: Promise.resolve({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
    });

    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    const gen = provider.stream({ messages: MESSAGES, model: 'gemini' });
    await expect(gen.next()).rejects.toThrow('authentication failed (401/403)');
  });

  it('wraps non-Error stream rejections', async () => {
    streamTextMock.mockReturnValue({
      textStream: {
        [Symbol.asyncIterator]: () => {
          return {
            next: () => Promise.reject('connection reset'),
            return: () => Promise.resolve({ done: true, value: undefined }),
          };
        },
      },
      usage: Promise.resolve({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
    });

    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    const gen = provider.stream({ messages: MESSAGES, model: 'gemini' });
    await expect(gen.next()).rejects.toThrow('connection reset');
  });

  it('handles stream with missing usage token fields (nullish coalescing)', async () => {
    async function* partialStream(): AsyncGenerator<string> {
      yield 'data';
    }
    streamTextMock.mockReturnValue({
      textStream: partialStream(),
      usage: Promise.resolve({ inputTokens: null, outputTokens: null, totalTokens: null }),
    });

    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    const events: unknown[] = [];
    for await (const event of provider.stream({ messages: MESSAGES, model: 'gemini' })) {
      events.push(event);
    }

    const doneEvent = events.find((e) => (e as { type: string }).type === 'done') as {
      data: { tokenUsage: Record<string, number> };
    };
    expect(doneEvent.data.tokenUsage.input).toBe(0);
    expect(doneEvent.data.tokenUsage.output).toBe(0);
    expect(doneEvent.data.tokenUsage.total).toBe(0);
  });
});

describe('GoogleGeminiProvider — generateStructured edge cases', () => {
  it('normalises errors in generateStructured', async () => {
    generateTextMock.mockRejectedValue({ statusCode: 429, message: 'rate limited' });
    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    await expect(
      provider.generateStructured({
        messages: MESSAGES,
        model: 'gemini',
        schema: { type: 'object' },
      }),
    ).rejects.toThrow('rate limited (429)');
  });

  it('normalises 5xx errors in generateStructured', async () => {
    generateTextMock.mockRejectedValue({ statusCode: 500, message: 'internal error' });
    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    await expect(
      provider.generateStructured({
        messages: MESSAGES,
        model: 'gemini',
        schema: { type: 'object' },
      }),
    ).rejects.toThrow('api error: 500');
  });

  it('normalises abort in generateStructured', async () => {
    generateTextMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const provider = new GoogleGeminiProvider(FAKE_API_KEY, { timeoutMs: 5 });
    await expect(
      provider.generateStructured({
        messages: MESSAGES,
        model: 'gemini',
        schema: { type: 'object' },
      }),
    ).rejects.toThrow('timed out after 5ms');
  });

  it('wraps non-Error rejections in generateStructured', async () => {
    generateTextMock.mockRejectedValue('something broke');
    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    await expect(
      provider.generateStructured({
        messages: MESSAGES,
        model: 'gemini',
        schema: { type: 'object' },
      }),
    ).rejects.toThrow('something broke');
  });

  it('handles generateStructured with missing usage tokens', async () => {
    generateTextMock.mockResolvedValue({
      output: Promise.resolve({ result: 'ok' }),
      usage: { inputTokens: null, outputTokens: null, totalTokens: null },
      finalStep: { response: { modelId: 'gemini-2.5-flash' } },
    });

    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    const response = await provider.generateStructured({
      messages: MESSAGES,
      model: 'gemini',
      schema: { type: 'object' },
    });
    expect(response.tokenUsage.input).toBe(0);
    expect(response.tokenUsage.output).toBe(0);
    expect(response.tokenUsage.total).toBe(0);
  });
});

describe('GoogleGeminiProvider — execute edge cases', () => {
  it('handles execute with missing usage token fields', async () => {
    generateTextMock.mockResolvedValue({
      text: 'result',
      usage: { inputTokens: null, outputTokens: null, totalTokens: null },
      finalStep: { response: { modelId: 'gemini-2.5-flash' } },
    });

    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    const response = await provider.execute({ messages: MESSAGES, model: 'gemini' });
    expect(response.tokenUsage.input).toBe(0);
    expect(response.tokenUsage.output).toBe(0);
    expect(response.tokenUsage.total).toBe(0);
  });

  it('handles non-Error exceptions in execute', async () => {
    generateTextMock.mockRejectedValue('something went wrong');
    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    await expect(provider.execute({ messages: MESSAGES, model: 'gemini' })).rejects.toThrow(
      'something went wrong',
    );
  });

  it('handles 5xx error with various codes in execute', async () => {
    generateTextMock.mockRejectedValue({ statusCode: 500, message: 'internal' });
    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    await expect(provider.execute({ messages: MESSAGES, model: 'gemini' })).rejects.toThrow(
      'api error: 500',
    );
  });

  it('handles 4xx errors that are not 401/403/429', async () => {
    generateTextMock.mockRejectedValue({ statusCode: 400, message: 'bad request' });
    const provider = new GoogleGeminiProvider(FAKE_API_KEY);
    // 400 doesn't match any specific case, so it falls through to the Error check
    // If it's not an Error instance but has a message, it wraps as non-Error
    // But statusCode 400 is a number, so it checks: !== 429, < 500, !== 401/403 → falls to Error check
    // If it's not an instanceof Error, it falls to the final `return new Error(String(error))`
    await expect(provider.execute({ messages: MESSAGES, model: 'gemini' })).rejects.toThrow();
  });
});
