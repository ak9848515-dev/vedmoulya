// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — ProviderConnectionTester Tests (FINAL-02)
//
// Covers the friendly provider UX backend contract:
//   - REAL model discovery per family (Gemini/OpenAI/DeepSeek/Anthropic/
//     Ollama/OpenAI-compatible) — never invented model ids
//   - friendly, actionable failure taxonomy (invalid key, unreachable,
//     rate limited, provider unavailable, malformed request)
//   - server-managed Gemini (AI_GOOGLE_API_KEY) with honest runtime notes
//   - credential redaction: the user's key NEVER appears in any message
//   - deterministic test doubles (injected fetchFn/env) — CI needs no
//     real provider credentials
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import {
  testProviderConnection,
  type TestProviderConnectionInput,
} from '../services/ProviderConnectionTester.js';

function okFetch(body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

const ENV_EMPTY: Record<string, string | undefined> = {};

function run(
  input: Omit<TestProviderConnectionInput, 'env'>,
): ReturnType<typeof testProviderConnection> {
  return testProviderConnection({ ...input, env: ENV_EMPTY });
}

describe('ProviderConnectionTester (FINAL-02 — connection + model discovery)', () => {
  // ── Real model discovery ────────────────────────────────────────────────
  describe('model discovery (real ids only)', () => {
    it('discovers real Gemini models from v1beta/models (generateContent only)', async () => {
      const fetchFn = okFetch({
        models: [
          {
            name: 'models/gemini-2.5-flash',
            displayName: 'Gemini 2.5 Flash',
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/gemini-2.5-pro',
            displayName: 'Gemini 2.5 Pro',
            supportedGenerationMethods: ['generateContent'],
          },
          // embedding-only models are filtered out
          {
            name: 'models/text-embedding-004',
            displayName: 'Text Embedding',
            supportedGenerationMethods: ['embedContent'],
          },
        ],
      });
      const result = await run({ family: 'google', apiKey: 'k', fetchFn });

      expect(result.connected).toBe(true);
      expect(result.models?.map((m) => m.id)).toEqual(['gemini-2.5-flash', 'gemini-2.5-pro']);
      expect(result.modelCount).toBe(2);
      expect(result.message).toContain('2 models available');
    });

    it('discovers real OpenAI models from /v1/models', async () => {
      const fetchFn = okFetch({ data: [{ id: 'gpt-4o-mini' }, { id: 'gpt-4o' }] });
      const result = await run({ family: 'openai', apiKey: 'k', fetchFn });

      expect(result.connected).toBe(true);
      expect(result.models?.map((m) => m.id)).toEqual(['gpt-4o-mini', 'gpt-4o']);
      expect(result.message).toContain('OpenAI');
    });

    it('discovers real DeepSeek models', async () => {
      const fetchFn = okFetch({ data: [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }] });
      const result = await run({ family: 'deepseek', apiKey: 'k', fetchFn });

      expect(result.connected).toBe(true);
      expect(result.models?.map((m) => m.id)).toEqual(['deepseek-chat', 'deepseek-reasoner']);
    });

    it('discovers real Anthropic models with display names', async () => {
      const fetchFn = okFetch({
        data: [{ id: 'claude-sonnet-4', display_name: 'Claude Sonnet 4' }],
      });
      const result = await run({ family: 'anthropic', apiKey: 'k', fetchFn });

      expect(result.connected).toBe(true);
      expect(result.models?.[0]).toEqual({ id: 'claude-sonnet-4', name: 'Claude Sonnet 4' });
    });

    it('discovers installed Ollama tags and probes the user-supplied server URL', async () => {
      const fetchFn = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ models: [{ name: 'llama3.2' }, { name: 'qwen2.5:7b' }] }), {
          status: 200,
        }),
      ) as unknown as typeof fetch;
      const result = await run({
        family: 'ollama',
        endpointUrl: 'http://192.168.1.10:11434/',
        fetchFn,
      });

      expect(result.connected).toBe(true);
      expect(result.models?.map((m) => m.id)).toEqual(['llama3.2', 'qwen2.5:7b']);
      // Trailing slash stripped; the user's URL is used for the probe.
      expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe(
        'http://192.168.1.10:11434/api/tags',
      );
    });

    it('probes the user-supplied OpenAI-compatible endpoint', async () => {
      const fetchFn = okFetch({ data: [{ id: 'my-model' }] });
      const result = await run({
        family: 'openai-compatible',
        endpointUrl: 'https://gw.example.com/v1',
        apiKey: 'k',
        fetchFn,
      });

      expect(result.connected).toBe(true);
      expect(result.models?.map((m) => m.id)).toEqual(['my-model']);
      expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe(
        'https://gw.example.com/v1/models',
      );
    });

    it('sends the Gemini key in the x-goog-api-key header (never a Bearer token)', async () => {
      const fetchFn = okFetch({ models: [] });
      await run({ family: 'google', apiKey: 'gem-key', fetchFn });

      const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models');
      expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('gem-key');
      expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
    });
  });

  // ── Friendly failure taxonomy ───────────────────────────────────────────
  describe('friendly connection errors', () => {
    it('maps 401 to an actionable invalid-key message', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValue(new Response('denied', { status: 401 })) as unknown as typeof fetch;
      const result = await run({ family: 'openai', apiKey: 'k', fetchFn });

      expect(result.connected).toBe(false);
      expect(result.errorKind).toBe('invalid_api_key');
      expect(result.message).toMatch(/invalid api key/i);
    });

    it('maps 429 to a rate-limit message', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValue(new Response('slow down', { status: 429 })) as unknown as typeof fetch;
      const result = await run({ family: 'openai', apiKey: 'k', fetchFn });

      expect(result.errorKind).toBe('rate_limited');
      expect(result.message).toMatch(/rate limit or quota/i);
    });

    it('maps 5xx to a provider-unavailable message', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValue(new Response('boom', { status: 503 })) as unknown as typeof fetch;
      const result = await run({ family: 'openai', apiKey: 'k', fetchFn });

      expect(result.errorKind).toBe('unavailable');
      expect(result.message).toMatch(/temporarily unavailable/i);
    });

    it('maps 404 to an endpoint-not-found message', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValue(new Response('nope', { status: 404 })) as unknown as typeof fetch;
      const result = await run({
        family: 'openai-compatible',
        endpointUrl: 'https://x.example.com/v1',
        apiKey: 'k',
        fetchFn,
      });

      expect(result.errorKind).toBe('not_found');
      expect(result.message).toMatch(/not found/i);
    });

    it('maps network failure to an unreachable message', async () => {
      const fetchFn = vi
        .fn()
        .mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch;
      const result = await run({
        family: 'ollama',
        endpointUrl: 'http://localhost:11434',
        fetchFn,
      });

      expect(result.connected).toBe(false);
      expect(result.errorKind).toBe('unreachable');
      expect(result.message).toMatch(/unreachable/i);
    });

    it('maps a timeout to an unreachable message with the timeout duration', async () => {
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      const fetchFn = vi.fn().mockRejectedValue(abortError) as unknown as typeof fetch;
      const result = await run({
        family: 'ollama',
        endpointUrl: 'http://localhost:11434',
        timeoutMs: 5000,
        fetchFn,
      });

      expect(result.errorKind).toBe('unreachable');
      expect(result.message).toContain('5s');
    });

    it('reports latency on both success and failure', async () => {
      const ok = await run({ family: 'openai', apiKey: 'k', fetchFn: okFetch({ data: [] }) });
      expect(typeof ok.latencyMs).toBe('number');
      expect(ok.message).toContain('0 models available');

      const fail = await run({
        family: 'openai',
        apiKey: 'k',
        fetchFn: vi
          .fn()
          .mockResolvedValue(new Response('x', { status: 401 })) as unknown as typeof fetch,
      });
      expect(typeof fail.latencyMs).toBe('number');
    });
  });

  // ── Credential requirements ─────────────────────────────────────────────
  describe('credential requirements', () => {
    it('refuses to probe a cloud provider without any credential', async () => {
      const result = await run({ family: 'openai' });

      expect(result.connected).toBe(false);
      expect(result.errorKind).toBe('no_credential');
      expect(result.message).toMatch(/api key is required/i);
    });

    it('explains the Gemini no-credential state honestly (server key or personal key)', async () => {
      const result = await run({ family: 'google' });

      expect(result.errorKind).toBe('no_credential');
      expect(result.message).toMatch(/AI Studio key|AI_GOOGLE_API_KEY/i);
    });

    it('allows Ollama without a credential (local server, no key)', async () => {
      const result = await run({
        family: 'ollama',
        fetchFn: okFetch({ models: [{ name: 'llama3.2' }] }),
      });

      expect(result.connected).toBe(true);
      expect(result.message).toContain('Ollama');
    });

    it('openai-compatible without a key still probes (endpoint decides auth)', async () => {
      const result = await run({
        family: 'openai-compatible',
        endpointUrl: 'https://open.example.com/v1',
        fetchFn: okFetch({ data: [] }),
      });

      expect(result.connected).toBe(true);
    });
  });

  // ── Server-managed Gemini + runtime truth ───────────────────────────────
  describe('server-managed Gemini + runtime truth', () => {
    it('uses the deployment key when no user key is given and AI_GOOGLE_API_KEY is set', async () => {
      const fetchFn = okFetch({
        models: [{ name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' }],
      });
      const result = await testProviderConnection({
        family: 'google',
        fetchFn,
        env: { AI_GOOGLE_API_KEY: 'server-key' },
      });

      expect(result.connected).toBe(true);
      expect(result.serverManagedKey).toBe(true);
      expect(result.runtimeConfigured).toBe(true);
      expect(result.message).toMatch(/server's configured credential/i);
      expect(result.runtimeNote).toMatch(/AI execution is live/);
    });

    it('with a server key present, a user key still takes precedence', async () => {
      const fetchFn = okFetch({ models: [] });
      const result = await testProviderConnection({
        family: 'google',
        apiKey: 'user-key',
        fetchFn,
        env: { AI_GOOGLE_API_KEY: 'server-key' },
      });

      expect(result.serverManagedKey).toBe(false);
      const headers = (
        (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
      )[1].headers as Record<string, string>;
      expect(headers['x-goog-api-key']).toBe('user-key');
    });

    it('honestly reports when the deployment has NO runtime credential', async () => {
      const result = await run({ family: 'openai', apiKey: 'k', fetchFn: okFetch({ data: [] }) });

      expect(result.runtimeConfigured).toBe(false);
      expect(result.runtimeNote).toMatch(/AI_OPENAI_API_KEY server-side/i);
    });

    it('reports Anthropic as catalog-only (no execution adapter in this build)', async () => {
      const result = await run({
        family: 'anthropic',
        apiKey: 'k',
        fetchFn: okFetch({ data: [] }),
      });

      expect(result.runtimeConfigured).toBe(false);
      expect(result.runtimeNote).toMatch(/no Anthropic execution adapter/i);
    });

    it('reports Ollama runtime registration truthfully', async () => {
      const registered = await testProviderConnection({
        family: 'ollama',
        endpointUrl: 'http://localhost:11434',
        fetchFn: okFetch({ models: [] }),
        env: { AI_OLLAMA_BASE_URL: 'http://localhost:11434' },
      });
      expect(registered.runtimeConfigured).toBe(true);

      const notRegistered = await run({
        family: 'ollama',
        endpointUrl: 'http://localhost:11434',
        fetchFn: okFetch({ models: [] }),
      });
      expect(notRegistered.runtimeConfigured).toBe(false);
      expect(notRegistered.runtimeNote).toMatch(/AI_OLLAMA_BASE_URL/i);
    });
  });

  // ── Security: redaction ─────────────────────────────────────────────────
  describe('credential redaction (security)', () => {
    it('never echoes a real API key in a failure message', async () => {
      const secret = 'sk-super-secret-value-12345';
      const fetchFn = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: `bad key ${secret}` }), { status: 401 }),
        ) as unknown as typeof fetch;
      const result = await run({ family: 'openai', apiKey: secret, fetchFn });

      expect(result.connected).toBe(false);
      expect(result.message).not.toContain(secret);
      expect(result.message).toMatch(/invalid api key/i);
    });

    it('does not mangle the friendly message for trivially-short inputs', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValue(new Response('x', { status: 401 })) as unknown as typeof fetch;
      const result = await run({ family: 'openai', apiKey: 'k', fetchFn });

      expect(result.message).toBe(
        'Invalid API key — the provider rejected this credential. Check the key and try again.',
      );
    });

    it('never echoes the API key when a network error carries it', async () => {
      const secret = 'sk-network-leak-999';
      const fetchFn = vi
        .fn()
        .mockRejectedValue(new Error(`failed for ${secret}`)) as unknown as typeof fetch;
      const result = await run({ family: 'openai', apiKey: secret, fetchFn });

      expect(result.message).not.toContain(secret);
    });

    it('never includes any key material in a success payload', async () => {
      const result = await run({
        family: 'google',
        apiKey: 'gem-secret',
        fetchFn: okFetch({ models: [{ name: 'models/gemini-2.5-flash' }] }),
      });
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('gem-secret');
    });
  });

  // ── Trailing whitespace / empty key handling ────────────────────────────
  describe('input normalization', () => {
    it('treats a whitespace-only key as absent (falls through to no_credential)', async () => {
      const result = await run({ family: 'openai', apiKey: '   ' });

      expect(result.errorKind).toBe('no_credential');
    });

    it('normalizes the Ollama base URL from the deployment env when the user omits it', async () => {
      const fetchFn = okFetch({ models: [] });
      await testProviderConnection({
        family: 'ollama',
        fetchFn,
        env: { AI_OLLAMA_BASE_URL: 'http://ollama.internal:11434' },
      });

      const url = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(url).toBe('http://ollama.internal:11434/api/tags');
    });
  });
});
