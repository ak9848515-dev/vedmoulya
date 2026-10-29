// ──────────────────────────────────────────────────────────────────
// VedMoulya — Ollama Provider Adapter Tests (BLD-022)
// Proves Ollama participates through the SAME ProviderAdapter contract:
// health, capability declaration, explicit unsupported-model error,
// execution, and registry registration — no special execution path.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, afterEach, vi } from 'vitest';
import { AIOrchestrationService } from '@vedmoulya/services';
import { OllamaProvider } from '../OllamaProvider.js';
import { registerPlatformProviders } from '../../index.js';

const healthyTagsResponse = (): Response =>
  new Response(JSON.stringify({ models: [{ name: 'llama3.2' }] }), { status: 200 });

const chatResponse = (content: string): Response =>
  new Response(
    JSON.stringify({
      model: 'llama3.2',
      message: { role: 'assistant', content },
      prompt_eval_count: 11,
      eval_count: 7,
    }),
    { status: 200 },
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OllamaProvider (same provider contract as every other provider)', () => {
  it('rejects an empty or non-http baseUrl at construction', () => {
    expect(() => new OllamaProvider({ baseUrl: '' })).toThrow(/baseUrl/);
    expect(() => new OllamaProvider({ baseUrl: 'not-a-url' })).toThrow(/http/);
  });

  it('reports healthy when /api/tags responds ok', async () => {
    const fetchMock = vi.fn(async () => healthyTagsResponse());
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434' });
    expect(await provider.isHealthy()).toBe(true);
    const health = await provider.getHealth();
    expect(health.providerId).toBe('ollama');
    expect(health.status).toBe('healthy');
    expect(health.errorRate).toBe(0);
  });

  it('reports down when Ollama is unreachable — never throws', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434' });
    expect(await provider.isHealthy()).toBe(false);
    const health = await provider.getHealth();
    expect(health.status).toBe('down');
    expect(health.errorRate).toBe(1);
  });

  it('executes chat requests through the shared contract with real usage and zero local cost', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe('http://127.0.0.1:11434/api/chat');
      return chatResponse('local model answer');
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434' });
    const response = await provider.execute({
      messages: [{ role: 'user', content: 'hello' }],
      model: 'ollama',
    });
    expect(response.content).toBe('local model answer');
    expect(response.provider).toBe('ollama');
    expect(response.model).toBe('llama3.2');
    expect(response.cost).toBe(0);
    expect(response.tokenUsage).toEqual({ input: 11, output: 7, total: 18 });
    expect(response.validation.passed).toBe(true);
  });

  it('fails EXPLICITLY on an unsupported advisor-selected modelId (Phase B contract)', async () => {
    const fetchMock = vi.fn(async () => chatResponse('should not be reached'));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2' });
    await expect(
      provider.execute({
        messages: [{ role: 'user', content: 'x' }],
        model: 'ollama',
        modelId: 'qwen2',
      }),
    ).rejects.toThrow(/does not support model "qwen2"/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('propagates a non-ok chat response as a classified provider error (5xx)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 503 })),
    );
    const provider = new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434' });
    await expect(
      provider.execute({ messages: [{ role: 'user', content: 'x' }], model: 'ollama' }),
    ).rejects.toThrow(/api error: 503/);
  });

  // ── BLD-023 — model RESOLUTION against what is actually installed ───────
  // The adapter used to be pinned to its configured preference, so a machine
  // that never pulled that model failed every execution with `api error: 404`
  // and the runtime fell through to the mock — even though installed models
  // HAD been discovered and validated. These lock the resolution contract.

  it('executes an INSTALLED model when the configured preference was never pulled', async () => {
    const calls: Array<{ url: string; body?: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const href = String(url);
        calls.push({ url: href, ...(typeof init?.body === 'string' ? { body: init.body } : {}) });
        if (href.endsWith('/api/tags')) {
          return new Response(
            JSON.stringify({
              models: [
                { name: 'qwen2.5-coder:7b-instruct', capabilities: ['completion', 'tools'] },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            model: 'qwen2.5-coder:7b-instruct',
            message: { role: 'assistant', content: 'installed model answer' },
            prompt_eval_count: 5,
            eval_count: 2,
          }),
          { status: 200 },
        );
      }),
    );
    // 'llama3.2' is the default preference and is NOT in the installed set.
    // Falling back to an installed model is an EXPLICIT opt-in.
    const provider = new OllamaProvider({
      baseUrl: 'http://127.0.0.1:11434',
      fallbackToInstalledModel: true,
    });
    const response = await provider.execute({
      messages: [{ role: 'user', content: 'hello' }],
      model: 'ollama',
    });

    const chat = calls.find((call) => call.url.endsWith('/api/chat'));
    expect(chat).toBeDefined();
    expect(JSON.parse(chat?.body ?? '{}').model).toBe('qwen2.5-coder:7b-instruct');
    // The model that ACTUALLY ran is what the runtime records — never the
    // stale preference.
    expect(response.model).toBe('qwen2.5-coder:7b-instruct');
    expect(response.metadata?.modelVersion).toBe('qwen2.5-coder:7b-instruct');
    expect(response.content).toBe('installed model answer');
  });

  it('prefers the configured model when it IS installed', async () => {
    const chatBodies: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const href = String(url);
        if (href.endsWith('/api/tags')) {
          return new Response(
            JSON.stringify({
              models: [
                { name: 'qwen2.5-coder:7b-instruct', capabilities: ['completion'] },
                { name: 'llama3.2', capabilities: ['completion'] },
              ],
            }),
            { status: 200 },
          );
        }
        if (typeof init?.body === 'string') chatBodies.push(init.body);
        return chatResponse('configured model answer');
      }),
    );
    const provider = new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2' });
    const response = await provider.execute({
      messages: [{ role: 'user', content: 'hello' }],
      model: 'ollama',
    });
    expect(JSON.parse(chatBodies[0] ?? '{}').model).toBe('llama3.2');
    expect(response.model).toBe('llama3.2');
  });

  it('never selects an embedding-only model when the runtime declares capabilities', async () => {
    const chatBodies: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const href = String(url);
        if (href.endsWith('/api/tags')) {
          return new Response(
            JSON.stringify({
              models: [
                { name: 'nomic-embed-text', capabilities: ['embedding'] },
                { name: 'qwen2.5-coder:3b', capabilities: ['completion', 'insert'] },
              ],
            }),
            { status: 200 },
          );
        }
        if (typeof init?.body === 'string') chatBodies.push(init.body);
        return chatResponse('chat model answer');
      }),
    );
    const provider = new OllamaProvider({
      baseUrl: 'http://127.0.0.1:11434',
      fallbackToInstalledModel: true,
    });
    await provider.execute({ messages: [{ role: 'user', content: 'hi' }], model: 'ollama' });
    // The embedding model is listed first but must never be chosen for chat.
    expect(JSON.parse(chatBodies[0] ?? '{}').model).toBe('qwen2.5-coder:3b');
  });

  it('publishes the INSTALLED model through configuredModel once health was probed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              models: [{ name: 'qwen2.5-coder:7b-instruct', capabilities: ['completion'] }],
            }),
            { status: 200 },
          ),
      ),
    );
    const provider = new OllamaProvider({
      baseUrl: 'http://127.0.0.1:11434',
      fallbackToInstalledModel: true,
    });
    // Before the probe the configured preference is what routing would see.
    expect(provider.configuredModel).toBe('llama3.2');
    await provider.getHealth();
    // After the probe routing advertises a model the adapter can really run.
    expect(provider.configuredModel).toBe('qwen2.5-coder:7b-instruct');
  });

  it('keeps the configured model when the runtime cannot be listed (never invents one)', async () => {
    const chatBodies: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const href = String(url);
        if (href.endsWith('/api/tags')) throw new Error('ECONNREFUSED');
        if (typeof init?.body === 'string') chatBodies.push(init.body);
        return chatResponse('answer');
      }),
    );
    const provider = new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434' });
    await provider.execute({ messages: [{ role: 'user', content: 'hi' }], model: 'ollama' });
    expect(JSON.parse(chatBodies[0] ?? '{}').model).toBe('llama3.2');
    expect(provider.configuredModel).toBe('llama3.2');
  });

  it('registers through registerPlatformProviders when configured — indistinguishable from any other provider', () => {
    const orchestrator = new AIOrchestrationService();
    registerPlatformProviders(orchestrator, {
      providers: { ollama: { baseUrl: 'http://127.0.0.1:11434' } },
    });
    const listed = orchestrator.listProviders().providers.map((p) => p.id);
    expect(listed).toContain('ollama');
    // Same registry surface as every other adapter: capabilities declared.
    const ollama = orchestrator.getProvider('ollama');
    expect(ollama?.capabilities).toContain('coding');
    expect(ollama?.capabilities).toContain('reasoning');
  });

  it('never chooses the development mock while a REAL adapter can serve (PRODUCT-001)', async () => {
    // PRODUCT-001 — mock is a last-resort provider, not a peer. When a real
    // adapter is registered for the same capability the runtime must execute
    // it, never the deterministic mock — otherwise a mission can "succeed"
    // while running fake intelligence.
    const SAVED = {
      openai: process.env.OPENAI_API_KEY,
      aiOpenai: process.env.AI_OPENAI_API_KEY,
      deepseek: process.env.AI_DEEPSEEK_API_KEY,
      google: process.env.AI_GOOGLE_API_KEY,
    };
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_OPENAI_API_KEY;
    delete process.env.AI_DEEPSEEK_API_KEY;
    delete process.env.AI_GOOGLE_API_KEY;
    try {
      const calls: string[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string | URL | Request) => {
          const href = String(url);
          calls.push(href);
          return href.endsWith('/api/tags')
            ? healthyTagsResponse()
            : chatResponse('real local answer');
        }),
      );

      const orchestrator = new AIOrchestrationService();
      registerPlatformProviders(orchestrator, {
        providers: { ollama: { baseUrl: 'http://127.0.0.1:11434' }, enableMock: true },
      });
      // The mock is STILL registered (development fallback + EPIC-019 agreement).
      expect(orchestrator.getProvider('mock')).toBeDefined();

      const result = await orchestrator.orchestrate({
        capability: 'reasoning',
        userInput: 'hello',
        qualityTier: 'standard',
      });

      // The REAL adapter executed — the local HTTP chat endpoint was called.
      expect(result.provider).toBe('ollama');
      expect(calls.some((call) => call.endsWith('/api/chat'))).toBe(true);
    } finally {
      if (SAVED.openai === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = SAVED.openai;
      if (SAVED.aiOpenai === undefined) delete process.env.AI_OPENAI_API_KEY;
      else process.env.AI_OPENAI_API_KEY = SAVED.aiOpenai;
      if (SAVED.deepseek === undefined) delete process.env.AI_DEEPSEEK_API_KEY;
      else process.env.AI_DEEPSEEK_API_KEY = SAVED.deepseek;
      if (SAVED.google === undefined) delete process.env.AI_GOOGLE_API_KEY;
      else process.env.AI_GOOGLE_API_KEY = SAVED.google;
    }
  });

  // ── Item 6 — no SILENT substitution when a model is unavailable ──────────

  it('refuses with a TYPED MODEL_NOT_FOUND when the configured model is not installed (no substitution)', async () => {
    const chatBodies: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        if (String(url).endsWith('/api/tags')) {
          return new Response(
            JSON.stringify({
              models: [{ name: 'qwen2.5-coder:3b', capabilities: ['completion'] }],
            }),
            { status: 200 },
          );
        }
        if (typeof init?.body === 'string') chatBodies.push(init.body);
        return chatResponse('should not run');
      }),
    );
    const provider = new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434' });
    await expect(
      provider.execute({ messages: [{ role: 'user', content: 'x' }], model: 'ollama' }),
    ).rejects.toMatchObject({ code: 'MODEL_NOT_FOUND' });
    // No other installed model was silently run.
    expect(chatBodies).toHaveLength(0);
  });

  it('reports the typed MODEL_NOT_FOUND code on an explicitly requested unavailable modelId', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => chatResponse('nope')),
    );
    const provider = new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2' });
    await expect(
      provider.execute({
        messages: [{ role: 'user', content: 'x' }],
        model: 'ollama',
        modelId: 'qwen2',
      }),
    ).rejects.toMatchObject({ code: 'MODEL_NOT_FOUND' });
  });

  it('streams a typed MODEL_NOT_FOUND failure instead of silently re-targeting a model', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) =>
        String(url).endsWith('/api/tags')
          ? new Response(
              JSON.stringify({
                models: [{ name: 'qwen2.5-coder:3b', capabilities: ['completion'] }],
              }),
              { status: 200 },
            )
          : chatResponse('nope'),
      ),
    );
    const provider = new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434' });
    await expect(
      (async (): Promise<void> => {
        for await (const chunk of provider.stream({
          messages: [{ role: 'user', content: 'x' }],
          model: 'ollama',
        })) {
          void chunk;
        }
      })(),
    ).rejects.toMatchObject({ code: 'MODEL_NOT_FOUND' });
  });

  it('executes normally when the configured model IS installed (no fallback needed)', async () => {
    const chatBodies: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        if (String(url).endsWith('/api/tags')) {
          return new Response(
            JSON.stringify({ models: [{ name: 'llama3.2', capabilities: ['completion'] }] }),
            { status: 200 },
          );
        }
        if (typeof init?.body === 'string') chatBodies.push(init.body);
        return chatResponse('ok');
      }),
    );
    const provider = new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434' });
    const response = await provider.execute({
      messages: [{ role: 'user', content: 'x' }],
      model: 'ollama',
    });
    expect(response.model).toBe('llama3.2');
    expect(JSON.parse(chatBodies[0] ?? '{}').model).toBe('llama3.2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B1 — HTTP 200 IS NOT PROOF OF VALID CONTENT
//
// A small local model can answer 200 with no `message`, no `content`, a
// non-string `content`, or blank whitespace. Every such body used to become a
// response with `validation.passed: true` — an empty draft recorded as a
// successful generation. These lock the rejection contract.
// ─────────────────────────────────────────────────────────────────────────────

describe('OllamaProvider · B1 rejects invalid output (HTTP 200 ≠ valid content)', () => {
  /** A raw 200 body, bypassing the `chatResponse` helper on purpose. */
  const rawBody = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });

  const provider = (): OllamaProvider =>
    new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2' });

  /** Serve /api/tags listing llama3.2, then the given chat body. */
  const withChatBody = (body: unknown): void => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        if (String(url).endsWith('/api/tags')) {
          return new Response(
            JSON.stringify({ models: [{ name: 'llama3.2', capabilities: ['completion'] }] }),
            { status: 200 },
          );
        }
        return rawBody(body);
      }),
    );
  };

  const expectInvalidOutput = async (
    body: unknown,
    reason: string,
    outputFormat?: 'text' | 'json',
  ): Promise<void> => {
    withChatBody(body);
    const subject = provider();
    await expect(
      subject.execute({
        messages: [{ role: 'user', content: 'write the document' }],
        model: 'ollama',
        ...(outputFormat ? { outputFormat } : {}),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_OUTPUT', reason });
  };

  it('rejects empty content', async () => {
    await expectInvalidOutput(
      { message: { role: 'assistant', content: '' }, prompt_eval_count: 5, eval_count: 0 },
      'empty_content',
    );
  });

  it('rejects a missing message', async () => {
    await expectInvalidOutput({ prompt_eval_count: 5, eval_count: 0 }, 'missing_content');
  });

  it('rejects a message without content', async () => {
    await expectInvalidOutput({ message: { role: 'assistant' } }, 'missing_content');
  });

  it('rejects null content', async () => {
    await expectInvalidOutput({ message: { role: 'assistant', content: null } }, 'missing_content');
  });

  it('rejects non-string content (number, object, array)', async () => {
    for (const content of [42, { text: 'hi' }, ['a', 'b'], true]) {
      await expectInvalidOutput({ message: { role: 'assistant', content } }, 'non_string_content');
    }
  });

  it('rejects whitespace-only content (spaces, tabs, newlines)', async () => {
    for (const content of ['   ', '\n\n', '\t \r\n ', ' \u00a0 ']) {
      await expectInvalidOutput({ message: { role: 'assistant', content } }, 'empty_content');
    }
  });

  it('rejects malformed JSON when the request requires JSON', async () => {
    await expectInvalidOutput(
      { message: { role: 'assistant', content: 'Sure! Here is your JSON: { not json' } },
      'invalid_json',
      'json',
    );
  });

  it('rejects plain prose when the request requires JSON', async () => {
    await expectInvalidOutput(
      { message: { role: 'assistant', content: 'The document is ready.' } },
      'invalid_json',
      'json',
    );
  });

  it('never reports validation.passed: true for any invalid body', async () => {
    const bodies: unknown[] = [
      { message: { content: '' } },
      { message: {} },
      {},
      { message: { content: 123 } },
      { message: { content: '   ' } },
    ];
    for (const body of bodies) {
      withChatBody(body);
      let result: unknown;
      try {
        result = await provider().execute({
          messages: [{ role: 'user', content: 'x' }],
          model: 'ollama',
        });
      } catch {
        result = undefined;
      }
      // Either it threw (required) or — never — a passed response came back.
      expect(result).toBeUndefined();
    }
  });

  it('keeps valid ordinary text working (text is NOT forced to be JSON)', async () => {
    withChatBody({
      message: { role: 'assistant', content: 'A perfectly ordinary prose answer.' },
      prompt_eval_count: 9,
      eval_count: 4,
    });
    const response = await provider().execute({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'ollama',
    });
    expect(response.content).toBe('A perfectly ordinary prose answer.');
    expect(response.validation.passed).toBe(true);
  });

  it('keeps valid structured JSON working, including a fenced json block', async () => {
    for (const content of ['{"title":"Doc","body":"Text"}', '```json\n{"title":"Doc"}\n```']) {
      withChatBody({ message: { role: 'assistant', content } });
      const response = await provider().execute({
        messages: [{ role: 'user', content: 'return json' }],
        model: 'ollama',
        outputFormat: 'json',
      });
      expect(response.content).toBe(content);
      expect(response.validation.passed).toBe(true);
    }
  });

  it('generateStructured requires JSON (it asks for JSON explicitly)', async () => {
    withChatBody({ message: { role: 'assistant', content: 'not json at all' } });
    await expect(
      provider().generateStructured({
        messages: [{ role: 'user', content: 'return json' }],
        model: 'ollama',
        schema: { type: 'object' },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_OUTPUT', reason: 'invalid_json' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B2 — AN UNRECOVERABLE MEMORY ERROR IS NOT RETRIED
// ─────────────────────────────────────────────────────────────────────────────

describe('OllamaProvider · B2 model that does not fit is not re-attempted', () => {
  /** Serve /api/tags with the given installed models; OOM the named ones. */
  const withModels = (
    installed: string[],
    behaviour: (model: string) => { status: number; body: unknown },
  ): { fetchMock: ReturnType<typeof vi.fn>; chatCalls: string[] } => {
    const chatCalls: string[] = [];
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith('/api/tags')) {
        return new Response(
          JSON.stringify({
            models: installed.map((name) => ({ name, capabilities: ['completion'] })),
          }),
          { status: 200 },
        );
      }
      const body = JSON.parse(String(init?.body ?? '{}')) as { model: string };
      chatCalls.push(body.model);
      const outcome = behaviour(body.model);
      return new Response(JSON.stringify(outcome.body), { status: outcome.status });
    });
    vi.stubGlobal('fetch', fetchMock);
    return { fetchMock, chatCalls };
  };

  const OOM = {
    status: 500,
    body: {
      error: 'model requires more system memory (5.2 GiB) than is available (3.1 GiB)',
    },
  };

  it('reports a typed, non-retryable memory failure for the failing model', async () => {
    withModels(['llama3.2'], () => OOM);
    const subject = new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2' });
    await expect(
      subject.execute({ messages: [{ role: 'user', content: 'x' }], model: 'ollama' }),
    ).rejects.toMatchObject({ code: 'MODEL_OUT_OF_MEMORY' });
  });

  it('makes EXACTLY ONE attempt for the failing model when fallback is off', async () => {
    const { chatCalls } = withModels(['llama3.2'], () => OOM);
    const subject = new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2' });
    await expect(
      subject.execute({ messages: [{ role: 'user', content: 'x' }], model: 'ollama' }),
    ).rejects.toThrow();
    expect(chatCalls.filter((model) => model === 'llama3.2')).toHaveLength(1);
  });

  it('attempts a configured SMALLER installed model when fallback is enabled', async () => {
    const { chatCalls } = withModels(['llama3.2', 'qwen2.5-coder:3b'], (model) =>
      model === 'llama3.2'
        ? OOM
        : {
            status: 200,
            body: { message: { role: 'assistant', content: 'small model answer' }, eval_count: 3 },
          },
    );
    const subject = new OllamaProvider({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'llama3.2',
      fallbackToInstalledModel: true,
    });
    const response = await subject.execute({
      messages: [{ role: 'user', content: 'x' }],
      model: 'ollama',
    });
    // The failing model was tried once; the smaller installed model served.
    expect(chatCalls.filter((model) => model === 'llama3.2')).toHaveLength(1);
    expect(response.model).toBe('qwen2.5-coder:3b');
    expect(response.content).toBe('small model answer');
  });

  it('recognizes the other documented allocation phrasings', async () => {
    const phrasings = [
      'failed to allocate CUDA0 buffer of size 1234567',
      'out of memory',
      'insufficient memory for model',
      'not enough VRAM available',
      'unable to allocate tensor',
      'ggml_backend_cuda_buffer_type_alloc_buffer: creating buffer failed',
    ];
    for (const error of phrasings) {
      withModels(['llama3.2'], () => ({ status: 500, body: { error } }));
      const subject = new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2' });
      await expect(
        subject.execute({ messages: [{ role: 'user', content: 'x' }], model: 'ollama' }),
      ).rejects.toMatchObject({ code: 'MODEL_OUT_OF_MEMORY' });
    }
  });

  it('keeps UNRELATED 5xx server errors as ordinary retryable failures', async () => {
    withModels(['llama3.2'], () => ({ status: 503, body: { error: 'service starting up' } }));
    const subject = new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2' });
    await expect(
      subject.execute({ messages: [{ role: 'user', content: 'x' }], model: 'ollama' }),
    ).rejects.toThrow(/api error: 503/);
    // Not misclassified as a memory failure.
    await expect(
      subject.execute({ messages: [{ role: 'user', content: 'x' }], model: 'ollama' }),
    ).rejects.not.toMatchObject({ code: 'MODEL_OUT_OF_MEMORY' });
  });

  it('an explicit per-request modelId is never substituted, even on OOM', async () => {
    const { chatCalls } = withModels(['llama3.2', 'qwen2.5-coder:3b'], () => OOM);
    const subject = new OllamaProvider({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'llama3.2',
      fallbackToInstalledModel: true,
    });
    await expect(
      subject.execute({
        messages: [{ role: 'user', content: 'x' }],
        model: 'ollama',
        modelId: 'llama3.2',
      }),
    ).rejects.toMatchObject({ code: 'MODEL_OUT_OF_MEMORY' });
    expect(chatCalls).toEqual(['llama3.2']);
  });

  it('a missing model keeps its documented typed semantics (MODEL_NOT_FOUND)', async () => {
    withModels(['qwen2.5-coder:3b'], () => ({ status: 200, body: { message: { content: 'x' } } }));
    const subject = new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2' });
    await expect(
      subject.execute({ messages: [{ role: 'user', content: 'x' }], model: 'ollama' }),
    ).rejects.toMatchObject({ code: 'MODEL_NOT_FOUND' });
  });
});
