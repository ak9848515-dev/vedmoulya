// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local AI — streamed failure honesty tests
//
// A streamed generation that CANNOT START must report a typed terminal error
// chunk. Before this, a stopped runtime and a missing model both produced an
// empty stream, which the UI could only describe as "no reply" — indistinguishable
// from a slow model. These tests pin the honest behaviour.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { OllamaRuntimeAdapter } from '../adapters/ollama-runtime.js';
import { OpenAICompatibleRuntimeAdapter } from '../adapters/openai-compatible-runtime.js';
import type { LocalGenerateChunk } from '../types.js';

/** Collect a stream into an array (AsyncIterable → Array). */
async function collect(iterable: AsyncIterable<LocalGenerateChunk>): Promise<LocalGenerateChunk[]> {
  const chunks: LocalGenerateChunk[] = [];
  for await (const chunk of iterable) chunks.push(chunk);
  return chunks;
}

/**
 * A connection refusal as Node/undici really throws it. `classifyNetworkError`
 * reads `code` (or `cause.code`), so a plain `new Error()` would only prove
 * "no answer" (UNREACHABLE) — it is NOT a refusal.
 */
function connectionRefused(): Error {
  return Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:11434'), {
    code: 'ECONNREFUSED',
  });
}

const TAGS = {
  models: [
    {
      name: 'qwen2.5-coder:3b',
      model: 'qwen2.5-coder:3b',
      size: 1_929_912_626,
      details: { family: 'qwen2', quantization_level: 'Q4_K_M' },
      capabilities: ['completion'],
    },
  ],
};

interface OllamaFetchOptions {
  version?: boolean;
  tags?: boolean;
  chatStatus?: number;
}

function ollamaFetch(options: OllamaFetchOptions): typeof fetch {
  return ((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith('/api/version')) {
      return options.version === false
        ? Promise.reject(connectionRefused())
        : Promise.resolve(new Response(JSON.stringify({ version: '0.34.4' }), { status: 200 }));
    }
    if (url.endsWith('/api/tags')) {
      return options.tags === false
        ? Promise.reject(connectionRefused())
        : Promise.resolve(new Response(JSON.stringify(TAGS), { status: 200 }));
    }
    if (url.endsWith('/api/chat')) {
      const status = options.chatStatus ?? 200;
      if (status !== 200) return Promise.resolve(new Response('nope', { status }));
      return Promise.resolve(
        new Response('{"message":{"content":"ok"},"done":true}\n', { status: 200 }),
      );
    }
    return Promise.resolve(new Response('{}', { status: 404 }));
  }) as unknown as typeof fetch;
}

describe('OllamaRuntimeAdapter.stream — typed terminal failures', () => {
  it('reports MODEL_UNAVAILABLE instead of silently ending for a missing model', async () => {
    const adapter = new OllamaRuntimeAdapter({ fetchFn: ollamaFetch({}) });
    const chunks = await collect(adapter.stream({ modelId: 'ghost:latest', messages: [] }));

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.error).toBe('MODEL_UNAVAILABLE');
    expect(chunks[0]?.done).toBe(true);
    expect(chunks[0]?.content).toBe('');
    expect(chunks[0]?.message).toContain('ghost:latest');
    expect(chunks[0]?.modelId).toBe('ghost:latest');
  });

  it('reports NOT_RUNNING when the runtime refuses the connection', async () => {
    const adapter = new OllamaRuntimeAdapter({
      fetchFn: ollamaFetch({ version: false, tags: false }),
    });
    const chunks = await collect(adapter.stream({ modelId: 'qwen2.5-coder:3b', messages: [] }));

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.error).toBe('NOT_RUNNING');
    expect(chunks[0]?.done).toBe(true);
  });

  it('reports NO_MODELS when the runtime is up with an empty catalog', async () => {
    const fetchFn = (() =>
      Promise.resolve(
        new Response(JSON.stringify({ models: [] }), { status: 200 }),
      )) as unknown as typeof fetch;
    const adapter = new OllamaRuntimeAdapter({ fetchFn });
    const chunks = await collect(adapter.stream({ messages: [] }));

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.error).toBe('NO_MODELS');
  });

  it('reports GENERATION_FAILED when the runtime refuses the streaming request', async () => {
    const adapter = new OllamaRuntimeAdapter({ fetchFn: ollamaFetch({ chatStatus: 500 }) });
    const chunks = await collect(adapter.stream({ modelId: 'qwen2.5-coder:3b', messages: [] }));

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.error).toBe('GENERATION_FAILED');
    expect(chunks[0]?.message).toContain('500');
  });

  it('reports MODEL_UNAVAILABLE on a 404 from the chat endpoint', async () => {
    const adapter = new OllamaRuntimeAdapter({ fetchFn: ollamaFetch({ chatStatus: 404 }) });
    const chunks = await collect(adapter.stream({ modelId: 'qwen2.5-coder:3b', messages: [] }));

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.error).toBe('MODEL_UNAVAILABLE');
  });

  it('does NOT emit an error chunk on a successful stream', async () => {
    const adapter = new OllamaRuntimeAdapter({ fetchFn: ollamaFetch({}) });
    const chunks = await collect(adapter.stream({ modelId: 'qwen2.5-coder:3b', messages: [] }));

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((chunk) => chunk.error === undefined)).toBe(true);
  });
});

interface LmStudioFetchOptions {
  ok?: boolean;
}

function lmStudioFetch(options: LmStudioFetchOptions): typeof fetch {
  return ((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith('/v1/models')) {
      return options.ok === false
        ? Promise.reject(connectionRefused())
        : Promise.resolve(
            new Response(JSON.stringify({ data: [{ id: 'local-model' }] }), { status: 200 }),
          );
    }
    return Promise.resolve(
      new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }),
    );
  }) as unknown as typeof fetch;
}

describe('OpenAICompatibleRuntimeAdapter.stream — typed terminal failures', () => {
  it('reports MODEL_UNAVAILABLE for a missing model instead of ending silently', async () => {
    const adapter = new OpenAICompatibleRuntimeAdapter({
      id: 'lm-studio',
      displayName: 'LM Studio',
      fetchFn: lmStudioFetch({}),
    });
    const chunks = await collect(adapter.stream({ modelId: 'ghost', messages: [] }));

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.error).toBe('MODEL_UNAVAILABLE');
    expect(chunks[0]?.message).toContain('LM Studio');
  });

  it('reports a runtime failure when the server is not running', async () => {
    const adapter = new OpenAICompatibleRuntimeAdapter({
      id: 'lm-studio',
      displayName: 'LM Studio',
      fetchFn: lmStudioFetch({ ok: false }),
    });
    const chunks = await collect(adapter.stream({ modelId: 'local-model', messages: [] }));

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.error).toBe('NOT_RUNNING');
  });
});
