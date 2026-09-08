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
});
