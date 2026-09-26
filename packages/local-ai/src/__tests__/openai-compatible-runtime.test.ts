import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_LM_STUDIO_ENDPOINT,
  OpenAICompatibleRuntimeAdapter,
  parseOpenAiChatContent,
  parseOpenAiModelIds,
  parseOpenAiStreamLine,
} from '../adapters/openai-compatible-runtime.js';
import { LocalAgent } from '../agent/agent.js';
import { LocalRuntimeRegistry } from '../registry.js';

const MODELS = {
  data: [
    { id: 'qwen2.5-coder-7b-instruct', object: 'model', owned_by: 'organization_owner' },
    { id: 'llama-3.2-3b-instruct', object: 'model', owned_by: 'organization_owner' },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function fetchDouble(routes: {
  models?: () => Promise<Response>;
  chat?: () => Promise<Response>;
}): typeof fetch {
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith('/v1/models'))
      return routes.models?.() ?? Promise.resolve(jsonResponse(MODELS));
    if (url.endsWith('/v1/chat/completions')) {
      return (
        routes.chat?.() ??
        Promise.resolve(jsonResponse({ choices: [{ message: { content: 'ok' } }] }))
      );
    }
    return Promise.resolve(jsonResponse({}, 404));
  }) as unknown as typeof fetch;
}

function networkError(code: string): Error {
  return Object.assign(new Error('connect failed'), { cause: { code } });
}

describe('parse helpers (OpenAI-compatible)', () => {
  it('parses model ids, chat content and stream lines', () => {
    expect(parseOpenAiModelIds(MODELS)).toEqual([
      'qwen2.5-coder-7b-instruct',
      'llama-3.2-3b-instruct',
    ]);
    expect(parseOpenAiModelIds({ data: 'nope' })).toBeNull();
    expect(parseOpenAiChatContent({ choices: [{ message: { content: 'hi' } }] })).toBe('hi');
    expect(parseOpenAiChatContent({ choices: [] })).toBeUndefined();
    expect(parseOpenAiStreamLine('data: {"choices":[{"delta":{"content":"he"}}]}')).toEqual({
      content: 'he',
      done: false,
    });
    expect(parseOpenAiStreamLine('data: [DONE]')).toEqual({ content: '', done: true });
    expect(parseOpenAiStreamLine(': keep-alive')).toBeUndefined();
  });
});

describe('OpenAICompatibleRuntimeAdapter — discovery and health', () => {
  it('defaults to LM Studio on its documented endpoint', () => {
    const adapter = new OpenAICompatibleRuntimeAdapter({ fetchFn: fetchDouble({}) });
    expect(adapter.id).toBe('lm-studio');
    expect(adapter.displayName).toBe('LM Studio');
    expect(adapter.baseEndpoint).toBe(DEFAULT_LM_STUDIO_ENDPOINT);
  });

  it('reports present for a valid OpenAI-compatible model list', async () => {
    const adapter = new OpenAICompatibleRuntimeAdapter({ fetchFn: fetchDouble({}) });
    const result = await adapter.discover();
    expect(result.present).toBe(true);
    // The API exposes no version — none is claimed.
    expect(result.version).toBeUndefined();
  });

  it('reports INVALID_RESPONSE when something else answers', async () => {
    const adapter = new OpenAICompatibleRuntimeAdapter({
      fetchFn: fetchDouble({ models: () => Promise.resolve(jsonResponse({ hello: 'world' })) }),
    });
    const result = await adapter.discover();
    expect(result.present).toBe(false);
    expect(result.error).toBe('INVALID_RESPONSE');
  });

  it('reports NOT_RUNNING on connection refusal (never "not installed")', async () => {
    const adapter = new OpenAICompatibleRuntimeAdapter({
      fetchFn: fetchDouble({ models: () => Promise.reject(networkError('ECONNREFUSED')) }),
    });
    const result = await adapter.discover();
    expect(result.error).toBe('NOT_RUNNING');
  });

  it('reports healthy with latency', async () => {
    const adapter = new OpenAICompatibleRuntimeAdapter({ fetchFn: fetchDouble({}) });
    const health = await adapter.health();
    expect(health.reachable).toBe(true);
    expect(health.healthy).toBe(true);
    expect(typeof health.latencyMs).toBe('number');
  });
});

describe('OpenAICompatibleRuntimeAdapter — models and generation', () => {
  it('lists models with INFERRED capabilities (the API declares none)', async () => {
    const adapter = new OpenAICompatibleRuntimeAdapter({ fetchFn: fetchDouble({}) });
    const listing = await adapter.listModels();
    expect(listing.ok).toBe(true);
    expect(listing.models.map((model) => model.id)).toEqual([
      'qwen2.5-coder-7b-instruct',
      'llama-3.2-3b-instruct',
    ]);
    expect(listing.models[0]?.capabilitiesProvenance).toBe('INFERRED');
  });

  it('reports NO_MODELS for an empty catalog', async () => {
    const adapter = new OpenAICompatibleRuntimeAdapter({
      fetchFn: fetchDouble({ models: () => Promise.resolve(jsonResponse({ data: [] })) }),
    });
    const listing = await adapter.listModels();
    expect(listing.error).toBe('NO_MODELS');
  });

  it('resolves a model by id and null when absent', async () => {
    const adapter = new OpenAICompatibleRuntimeAdapter({ fetchFn: fetchDouble({}) });
    expect((await adapter.getModel('llama-3.2-3b-instruct'))?.name).toBe('llama-3.2-3b-instruct');
    expect(await adapter.getModel('ghost')).toBeNull();
  });

  it('runs a real generation and returns the content', async () => {
    const adapter = new OpenAICompatibleRuntimeAdapter({ fetchFn: fetchDouble({}) });
    const result = await adapter.generate({ messages: [{ role: 'user', content: 'hi' }] });
    expect(result.ok).toBe(true);
    expect(result.content).toBe('ok');
    expect(result.modelId).toBe('qwen2.5-coder-7b-instruct');
  });

  it('reports MODEL_UNAVAILABLE for a model that is not loaded', async () => {
    const adapter = new OpenAICompatibleRuntimeAdapter({ fetchFn: fetchDouble({}) });
    const result = await adapter.generate({
      modelId: 'ghost',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(result.error).toBe('MODEL_UNAVAILABLE');
  });

  it('reports GENERATION_FAILED when the reply is empty', async () => {
    const adapter = new OpenAICompatibleRuntimeAdapter({
      fetchFn: fetchDouble({
        chat: () => Promise.resolve(jsonResponse({ choices: [{ message: { content: '' } }] })),
      }),
    });
    const result = await adapter.generate({ messages: [{ role: 'user', content: 'hi' }] });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('GENERATION_FAILED');
  });

  it('streams SSE chunks and terminates on [DONE]', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"he"}}]}',
      'data: {"choices":[{"delta":{"content":"llo"}}]}',
      'data: [DONE]',
    ].join('\n\n');
    const adapter = new OpenAICompatibleRuntimeAdapter({
      fetchFn: ((input: RequestInfo | URL) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.endsWith('/v1/models')) return Promise.resolve(jsonResponse(MODELS));
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(`${sse}\n\n`));
            controller.close();
          },
        });
        return Promise.resolve(new Response(stream, { status: 200 }));
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

describe('OpenAICompatibleRuntimeAdapter — through the Local Agent', () => {
  it('derives the state with a RUNTIME-AWARE label (never "Ollama")', async () => {
    const registry = new LocalRuntimeRegistry().register(
      new OpenAICompatibleRuntimeAdapter({
        fetchFn: fetchDouble({ models: () => Promise.reject(networkError('ECONNREFUSED')) }),
      }),
    );
    const agent = new LocalAgent({ registry });
    const status = await agent.status('lm-studio');
    expect(status.displayName).toBe('LM Studio');
    expect(status.state).toBe('OLLAMA_NOT_RUNNING');
    expect(status.label).toBe('LM Studio not running');
  });

  it('verifies CONNECTED through the same interface', async () => {
    const registry = new LocalRuntimeRegistry().register(
      new OpenAICompatibleRuntimeAdapter({ fetchFn: fetchDouble({}) }),
    );
    const agent = new LocalAgent({ registry });
    const report = await agent.verify('lm-studio');
    expect(report.connected).toBe(true);
    expect(report.state).toBe('OLLAMA_CONNECTED');
    expect(report.label).toBe('Connected');
    expect(report.checks.every((check) => check.ok)).toBe(true);
  });
});
