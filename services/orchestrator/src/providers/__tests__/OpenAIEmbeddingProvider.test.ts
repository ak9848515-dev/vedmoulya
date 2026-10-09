// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: OpenAI Embedding Provider (Vercel AI SDK)
// Mocks `embedMany` so CI runs deterministically. AI-RUNTIME-002.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';

const embedManyMock = vi.fn();
const createOpenAIMock = vi.fn();

vi.mock('ai', () => ({
  embedMany: (...args: unknown[]) => embedManyMock(...args),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: (...args: unknown[]) => createOpenAIMock(...args),
}));

import { OpenAIEmbeddingProvider } from '../OpenAIEmbeddingProvider.js';

beforeEach(() => {
  vi.clearAllMocks();
  createOpenAIMock.mockReturnValue(
    Object.assign((model: string) => ({ provider: 'openai', modelId: model }), {
      embedding: (model: string) => ({ provider: 'openai', modelId: `embedding:${model}` }),
    }),
  );
  embedManyMock.mockResolvedValue({
    embeddings: [
      [0.1, 0.2],
      [0.3, 0.4],
    ],
  });
});

describe('OpenAIEmbeddingProvider', () => {
  it('AI-WIRING-001: binds the injected credential to the embedding client', async () => {
    const provider = new OpenAIEmbeddingProvider('sk-test');
    await provider.embed(['x']);
    // The bare `openai.embedding(...)` export ignored this key and read
    // process.env.OPENAI_API_KEY, so a canonical-only deployment could not embed.
    expect(createOpenAIMock).toHaveBeenCalledWith({ apiKey: 'sk-test' });
  });

  it('embeds texts through the SDK and reports the vector dimension', async () => {
    const provider = new OpenAIEmbeddingProvider('sk-test');
    expect(provider.dimension).toBe(1536);
    expect(provider.model).toBe('text-embedding-3-small');

    const vectors = await provider.embed(['first', 'second']);
    expect(embedManyMock).toHaveBeenCalledTimes(1);
    expect(vectors).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });

  it('returns an empty array for no input without calling the SDK', async () => {
    const provider = new OpenAIEmbeddingProvider('sk-test');
    await expect(provider.embed([])).resolves.toEqual([]);
    expect(embedManyMock).not.toHaveBeenCalled();
  });

  it('maps a 429 to a rate-limit error', async () => {
    embedManyMock.mockRejectedValue({ statusCode: 429 });
    const provider = new OpenAIEmbeddingProvider('sk-test');
    await expect(provider.embed(['x'])).rejects.toThrow('rate limited (429)');
  });

  it('maps an abort to a timeout error', async () => {
    embedManyMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const provider = new OpenAIEmbeddingProvider('sk-test', { timeoutMs: 5 });
    await expect(provider.embed(['x'])).rejects.toThrow('timed out after 5ms');
  });

  it('re-throws a plain Error from the SDK unchanged', async () => {
    embedManyMock.mockRejectedValue(new Error('embedding server exploded'));
    const provider = new OpenAIEmbeddingProvider('sk-test');
    await expect(provider.embed(['x'])).rejects.toThrow('embedding server exploded');
  });

  it('wraps a non-Error SDK rejection in a descriptive Error', async () => {
    embedManyMock.mockRejectedValue('unexpected failure');
    const provider = new OpenAIEmbeddingProvider('sk-test');
    await expect(provider.embed(['x'])).rejects.toThrow('unexpected failure');
  });
});
