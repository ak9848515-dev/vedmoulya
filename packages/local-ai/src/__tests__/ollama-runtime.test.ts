import { describe, it, expect, vi } from 'vitest';
import {
  classifyNetworkError,
  OllamaRuntimeAdapter,
  parseOllamaChatContent,
  parseOllamaModels,
  parseOllamaStreamLine,
  parseOllamaVersion,
} from '../adapters/ollama-runtime.js';

const TAGS = {
  models: [
    {
      name: 'qwen2.5-coder:7b-instruct',
      model: 'qwen2.5-coder:7b-instruct',
      size: 4_683_087_561,
      details: {
        family: 'qwen2',
        parameter_size: '7.6B',
        quantization_level: 'Q4_K_M',
        context_length: 32768,
      },
      capabilities: ['completion', 'tools', 'insert'],
    },
    {
      name: 'qwen2.5-coder:3b',
      model: 'qwen2.5-coder:3b',
      size: 1_929_912_626,
      details: {
        family: 'qwen2',
        parameter_size: '3.1B',
        quantization_level: 'Q4_K_M',
        context_length: 32768,
      },
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** A fetch double keyed by pathname (POST /api/chat handled by `chat`). */
function fetchDouble(routes: {
  version?: () => Promise<Response>;
  tags?: () => Promise<Response>;
  chat?: () => Promise<Response>;
}): typeof fetch {
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith('/api/version'))
      return routes.version?.() ?? Promise.resolve(jsonResponse({ version: '0.34.4' }));
    if (url.endsWith('/api/tags')) return routes.tags?.() ?? Promise.resolve(jsonResponse(TAGS));
    if (url.endsWith('/api/chat'))
      return routes.chat?.() ?? Promise.resolve(jsonResponse({ message: { content: 'ok' } }));
    return Promise.resolve(jsonResponse({}, 404));
  }) as unknown as typeof fetch;
}

function networkError(code: string): Error {
  return Object.assign(new Error('connect failed'), { cause: { code } });
}

describe('parse helpers', () => {
  it('parses version, chat content and stream lines', () => {
    expect(parseOllamaVersion({ version: '0.34.4' })).toBe('0.34.4');
    expect(parseOllamaVersion({})).toBeUndefined();
    expect(parseOllamaChatContent({ message: { content: 'hello' } })).toBe('hello');
    expect(parseOllamaChatContent({ message: {} })).toBeUndefined();
    expect(parseOllamaStreamLine('{"message":{"content":"a"},"done":false}')).toEqual({
      content: 'a',
      done: false,
    });
    expect(parseOllamaStreamLine('not json')).toBeUndefined();
  });

  it('marks declared capabilities MEASURED and undeclared ones INFERRED', () => {
    const models = parseOllamaModels(TAGS);
    expect(models).not.toBeNull();
    expect(models?.[0]?.capabilitiesProvenance).toBe('MEASURED');
    expect(models?.[0]?.capabilities).toEqual(['completion', 'tools', 'insert']);
    expect(models?.[1]?.capabilitiesProvenance).toBe('INFERRED');
    expect(models?.[0]?.roundedSizeGb).toBeCloseTo(4.7, 1);
    expect(models?.[0]?.contextLength).toBe(32768);
  });

  it('returns null for a payload that is not an Ollama model list', () => {
    expect(parseOllamaModels({ models: 'nope' })).toBeNull();
    expect(parseOllamaModels(null)).toBeNull();
  });

  it('classifies connection refusals as NOT_RUNNING and everything else as UNREACHABLE', () => {
    expect(classifyNetworkError(networkError('ECONNREFUSED'))).toBe('NOT_RUNNING');
    expect(classifyNetworkError(networkError('ECONNRESET'))).toBe('NOT_RUNNING');
    expect(classifyNetworkError(new Error('timeout'))).toBe('UNREACHABLE');
  });
});

describe('OllamaRuntimeAdapter — discovery and health', () => {
  it('reports the runtime present with a real version', async () => {
    const adapter = new OllamaRuntimeAdapter({ fetchFn: fetchDouble({}) });
    const result = await adapter.discover();
    expect(result.present).toBe(true);
    expect(result.version).toBe('0.34.4');
    expect(result.endpoint).toBe('http://127.0.0.1:11434');
  });

  it('reports an invalid response when something else answers', async () => {
    const adapter = new OllamaRuntimeAdapter({
      fetchFn: fetchDouble({ version: () => Promise.resolve(jsonResponse({ hello: 'world' })) }),
    });
    const result = await adapter.discover();
    expect(result.present).toBe(false);
    expect(result.error).toBe('INVALID_RESPONSE');
  });

  it('reports NOT_RUNNING on connection refusal (never "not installed")', async () => {
    const adapter = new OllamaRuntimeAdapter({
      fetchFn: fetchDouble({ version: () => Promise.reject(networkError('ECONNREFUSED')) }),
    });
    const result = await adapter.discover();
    expect(result.present).toBe(false);
    expect(result.error).toBe('NOT_RUNNING');
  });

  it('reports UNREACHABLE on a timeout/abort', async () => {
    const adapter = new OllamaRuntimeAdapter({
      fetchFn: fetchDouble({ version: () => Promise.reject(networkError('UND_ERR_ABORTED')) }),
    });
    const result = await adapter.discover();
    expect(result.error).toBe('UNREACHABLE');
  });

  it('reports healthy with latency when the version answers', async () => {
    const adapter = new OllamaRuntimeAdapter({ fetchFn: fetchDouble({}) });
    const health = await adapter.health();
    expect(health.reachable).toBe(true);
    expect(health.healthy).toBe(true);
    expect(typeof health.latencyMs).toBe('number');
  });

  it('reports not reachable on connection refusal', async () => {
    const adapter = new OllamaRuntimeAdapter({
      fetchFn: fetchDouble({ version: () => Promise.reject(networkError('ECONNREFUSED')) }),
    });
    const health = await adapter.health();
    expect(health.reachable).toBe(false);
    expect(health.error).toBe('NOT_RUNNING');
  });
});

describe('OllamaRuntimeAdapter — models', () => {
  it('lists the real models with descriptors', async () => {
    const adapter = new OllamaRuntimeAdapter({ fetchFn: fetchDouble({}) });
    const listing = await adapter.listModels();
    expect(listing.ok).toBe(true);
    expect(listing.models.map((model) => model.id)).toEqual([
      'qwen2.5-coder:7b-instruct',
      'qwen2.5-coder:3b',
    ]);
  });

  it('reports NO_MODELS for an empty catalog without claiming a failure', async () => {
    const adapter = new OllamaRuntimeAdapter({
      fetchFn: fetchDouble({ tags: () => Promise.resolve(jsonResponse({ models: [] })) }),
    });
    const listing = await adapter.listModels();
    expect(listing.ok).toBe(true);
    expect(listing.error).toBe('NO_MODELS');
    expect(listing.models).toEqual([]);
  });

  it('reports INVALID_RESPONSE when the catalog is unreadable', async () => {
    const adapter = new OllamaRuntimeAdapter({
      fetchFn: fetchDouble({ tags: () => Promise.resolve(jsonResponse({ models: 'nope' })) }),
    });
    const listing = await adapter.listModels();
    expect(listing.ok).toBe(false);
    expect(listing.error).toBe('INVALID_RESPONSE');
  });

  it('resolves a single model by id or name, and null when absent', async () => {
    const adapter = new OllamaRuntimeAdapter({ fetchFn: fetchDouble({}) });
    expect((await adapter.getModel('qwen2.5-coder:3b'))?.name).toBe('qwen2.5-coder:3b');
    expect(await adapter.getModel('ghost:latest')).toBeNull();
  });
});

describe('OllamaRuntimeAdapter — generation', () => {
  it('runs a real generation and returns the content', async () => {
    const adapter = new OllamaRuntimeAdapter({ fetchFn: fetchDouble({}) });
    const result = await adapter.generate({ messages: [{ role: 'user', content: 'hi' }] });
    expect(result.ok).toBe(true);
    expect(result.content).toBe('ok');
    expect(result.modelId).toBe('qwen2.5-coder:7b-instruct');
  });

  it('reports MODEL_UNAVAILABLE on HTTP 404', async () => {
    const adapter = new OllamaRuntimeAdapter({
      fetchFn: fetchDouble({
        chat: () => Promise.resolve(jsonResponse({ error: 'not found' }, 404)),
      }),
    });
    const result = await adapter.generate({
      modelId: 'qwen2.5-coder:7b-instruct',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('MODEL_UNAVAILABLE');
  });

  it('reports MODEL_UNAVAILABLE for a model that is not installed', async () => {
    const adapter = new OllamaRuntimeAdapter({ fetchFn: fetchDouble({}) });
    const result = await adapter.generate({
      modelId: 'ghost:latest',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('MODEL_UNAVAILABLE');
  });

  it('reports GENERATION_FAILED when the reply is empty', async () => {
    const adapter = new OllamaRuntimeAdapter({
      fetchFn: fetchDouble({
        chat: () => Promise.resolve(jsonResponse({ message: { content: '' } })),
      }),
    });
    const result = await adapter.generate({ messages: [{ role: 'user', content: 'hi' }] });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('GENERATION_FAILED');
  });

  it('reports NO_MODELS when the runtime has nothing to run', async () => {
    const adapter = new OllamaRuntimeAdapter({
      fetchFn: fetchDouble({ tags: () => Promise.resolve(jsonResponse({ models: [] })) }),
    });
    const result = await adapter.generate({ messages: [{ role: 'user', content: 'hi' }] });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('NO_MODELS');
  });

  it('streams NDJSON chunks from a real chat stream', async () => {
    const ndjson = [
      '{"message":{"content":"he"},"done":false}',
      '{"message":{"content":"llo"},"done":false}',
      '{"message":{"content":""},"done":true}',
    ].join('\n');
    const adapter = new OllamaRuntimeAdapter({
      fetchFn: ((input: RequestInfo | URL) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.endsWith('/api/version'))
          return Promise.resolve(jsonResponse({ version: '0.34.4' }));
        if (url.endsWith('/api/tags')) return Promise.resolve(jsonResponse(TAGS));
        return Promise.resolve(new Response(ndjson, { status: 200 }));
      }) as unknown as typeof fetch,
    });
    const chunks: string[] = [];
    let done = false;
    for await (const chunk of adapter.stream({ messages: [{ role: 'user', content: 'hi' }] })) {
      chunks.push(chunk.content);
      if (chunk.done) done = true;
    }
    expect(chunks.join('')).toBe('hello');
    expect(done).toBe(true);
  });
});
