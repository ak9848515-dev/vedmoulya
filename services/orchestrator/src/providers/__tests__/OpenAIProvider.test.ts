// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — OpenAIProvider unit tests (fetch mocked)
// ARC-005 — AI Orchestration
// ─────────────────────────────────────────────────────────────────────────────

import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAIProvider } from '../OpenAIProvider.js';

const OPENAI_CHAT_RESPONSE = {
  choices: [{ message: { content: 'Hello from OpenAI' } }],
  usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  model: 'gpt-4o',
};

describe('OpenAIProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exposes name, family, and capabilities', () => {
    const provider = new OpenAIProvider('sk-test');
    expect(provider.name).toBe('openai');
    expect(provider.family).toBe('openai');
    expect(provider.capabilities).toContain('reasoning');
    expect(provider.capabilities).toContain('general_conversation');
  });

  it('isHealthy returns true when the models endpoint responds ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    await expect(new OpenAIProvider('sk-test').isHealthy()).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.objectContaining({ headers: { Authorization: 'Bearer sk-test' } }),
    );
  });

  it('isHealthy returns false when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(new OpenAIProvider('sk-test').isHealthy()).resolves.toBe(false);
  });

  it('isHealthy returns false when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(new OpenAIProvider('sk-test').isHealthy()).resolves.toBe(false);
  });

  it('getHealth reports healthy status and zero error rate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const health = await new OpenAIProvider('sk-test').getHealth();
    expect(health.providerId).toBe('openai');
    expect(health.status).toBe('healthy');
    expect(health.errorRate).toBe(0);
    expect(health.latency).toBeGreaterThanOrEqual(0);
  });

  it('getHealth reports down status and error rate 1 when unhealthy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const health = await new OpenAIProvider('sk-test').getHealth();
    expect(health.status).toBe('down');
    expect(health.errorRate).toBe(1);
  });

  it('execute posts chat completions and maps the response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => OPENAI_CHAT_RESPONSE }),
    );
    const provider = new OpenAIProvider('sk-test');
    const response = await provider.execute({
      messages: [
        { role: 'system', content: 'be helpful' },
        { role: 'user', content: 'hi' },
      ],
      model: 'gpt-4o',
      maxTokens: 512,
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"max_tokens":512'),
      }),
    );
    expect(response.content).toBe('Hello from OpenAI');
    expect(response.provider).toBe('openai');
    expect(response.model).toBe('gpt-4o');
    expect(response.tokenUsage).toEqual({ input: 10, output: 20, total: 30 });
    expect(response.cost).toBeCloseTo(10 * 0.00001 + 20 * 0.00003, 10);
    expect(response.traceId).toMatch(/^openai-/);
    expect(response.metadata.contextUsed).toEqual(['system', 'user']);
  });

  it('execute defaults max_tokens to 1024 when not provided', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => OPENAI_CHAT_RESPONSE });
    vi.stubGlobal('fetch', mockFetch);
    await new OpenAIProvider('sk-test').execute({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'gpt-4o',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({ body: expect.stringContaining('"max_tokens":1024') }),
    );
  });

  it('execute maps an empty choices array to empty content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          model: 'gpt-4o',
        }),
      }),
    );
    const response = await new OpenAIProvider('sk-test').execute({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'gpt-4o',
    });
    expect(response.content).toBe('');
    expect(response.model).toBe('gpt-4o');
  });

  it('execute throws a descriptive error on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 429, statusText: 'Too Many Requests' }),
    );
    await expect(
      new OpenAIProvider('sk-test').execute({
        messages: [{ role: 'user', content: 'hi' }],
        model: 'gpt-4o',
      }),
    ).rejects.toThrow('OpenAI API error: 429 Too Many Requests');
  });

  it('execute aborts a hung request and reports a retryable timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: { signal?: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
          });
        });
      }),
    );
    const provider = new OpenAIProvider('sk-test', { timeoutMs: 15 });
    await expect(
      provider.execute({ messages: [{ role: 'user', content: 'hi' }], model: 'gpt-4o' }),
    ).rejects.toThrow('OpenAI request timed out after 15ms');
  });
});
