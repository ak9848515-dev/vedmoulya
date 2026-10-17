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
  confirmsOpenRouterCredential,
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

/**
 * Route-aware fetch double: answers each probed URL with the body THAT provider
 * really returns, so a multi-step probe (authenticate → discover) is
 * observable and its call ORDER can be asserted. An unexpected URL throws with
 * the URL, so a drifted probe fails loudly instead of silently passing.
 */
function routedFetch(routes: Record<string, unknown>): typeof fetch {
  return vi.fn().mockImplementation(async (url: string | URL | Request) => {
    const href = typeof url === 'string' ? url : String(url);
    if (!(href in routes)) throw new Error(`unexpected fetch: ${href}`);
    return new Response(JSON.stringify(routes[href]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

/** The URLs a fetch double was actually called with, in order. */
function calledUrls(fetchFn: typeof fetch): string[] {
  return ((fetchFn as ReturnType<typeof vi.fn>).mock.calls as [string | URL | Request][]).map(
    (call) => String(call[0]),
  );
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

    // BUGFIX (quota vs. throttle) — a 429 is the SAME status for "you are too
    // fast" and "your account cannot pay", and the provider's own error token is
    // the only thing that separates them. The live OpenAI account in this
    // repository answers exactly this envelope (type `insufficient_quota`, code
    // `credit_balance_exhausted`), and reading it as a throttle is what told an
    // out-of-credit user to "try again" forever.
    it('maps a 429 that names an exhausted balance to the funding verdict, not a rate limit', async () => {
      const fetchFn = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              message: 'You have no credits remaining.',
              type: 'insufficient_quota',
              code: 'credit_balance_exhausted',
            },
          }),
          { status: 429, headers: { 'content-type': 'application/json' } },
        ),
      ) as unknown as typeof fetch;
      const result = await run({ family: 'openai', apiKey: 'k', fetchFn });

      expect(result.connected).toBe(false);
      expect(result.errorKind).toBe('quota_exhausted');
      expect(result.message).toMatch(/no remaining credits/i);
      // The transient wording must be gone: waiting cannot fund an account.
      expect(result.message).not.toMatch(/wait a moment/i);
    });

    it('keeps a genuine throttle a rate limit when the provider says so', async () => {
      const fetchFn = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { type: 'rate_limit_error' } }), {
          status: 429,
          headers: { 'content-type': 'application/json' },
        }),
      ) as unknown as typeof fetch;
      const result = await run({ family: 'openai', apiKey: 'k', fetchFn });

      expect(result.errorKind).toBe('rate_limited');
      expect(result.message).toMatch(/rate limit or quota/i);
    });

    it('keeps the conservative rate-limit reading when a 429 body cannot be read', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValue(
          new Response('<html>too many requests</html>', { status: 429 }),
        ) as unknown as typeof fetch;
      const result = await run({ family: 'openai', apiKey: 'k', fetchFn });

      // An unreadable body proves nothing about funding, so nothing is claimed.
      expect(result.errorKind).toBe('rate_limited');
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
      // An empty cloud catalog is still an authenticated connection: the probe
      // authenticated successfully and reports zero models honestly rather than
      // inventing any (only a LOCAL runtime treats "no models" as its own state).
      expect(ok.connected).toBe(true);
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

    it('names the ACTUAL family for a platform credential (never hardcodes Gemini)', async () => {
      // Regression: a deployment OpenRouter credential was reported as
      // "Connected to Google Gemini via this server's configured credential".
      // The probe now authenticates against OpenRouter's key endpoint first, so
      // the double answers both steps of the probe.
      const result = await testProviderConnection({
        family: 'openrouter',
        fetchFn: routedFetch({
          'https://openrouter.ai/api/v1/key': { data: { label: 'server-key' } },
          'https://openrouter.ai/api/v1/models': { data: [{ id: 'openrouter/model-x' }] },
        }),
        env: { AI_OPENROUTER_API_KEY: 'server-key' },
      });

      expect(result.connected).toBe(true);
      expect(result.serverManagedKey).toBe(true);
      expect(result.credentialSource).toBe('PLATFORM');
      expect(result.message).toContain('OpenRouter');
      expect(result.message).not.toContain('Google Gemini');
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

    it('ACTUALLY sends the deployment key when no user key is given (PATH A)', async () => {
      // Regression: the server-managed path previously reported success without
      // ever sending the key, so a real deployment got a 401 and first-login
      // Gemini could never reach READY.
      const fetchFn = okFetch({ models: [{ name: 'models/gemini-2.5-flash' }] });
      const result = await testProviderConnection({
        family: 'google',
        fetchFn,
        env: { AI_GOOGLE_API_KEY: 'server-key' },
      });

      const headers = (
        (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
      )[1].headers as Record<string, string>;
      expect(headers['x-goog-api-key']).toBe('server-key');
      expect(headers['Authorization']).toBeUndefined();
      expect(result.credentialSource).toBe('PLATFORM');
      expect(result.serverManagedKey).toBe(true);
    });

    it('reports the credential source the probe really used', async () => {
      const fetchFn = okFetch({ models: [] });
      const userProbed = await run({ family: 'google', apiKey: 'user-key', fetchFn });
      expect(userProbed.credentialSource).toBe('USER');

      const platformProbed = await testProviderConnection({
        family: 'google',
        env: { AI_GOOGLE_API_KEY: 'server-key' },
        fetchFn: okFetch({ models: [] }),
      });
      expect(platformProbed.credentialSource).toBe('PLATFORM');

      const none = await run({ family: 'google', fetchFn: okFetch({ models: [] }) });
      expect(none.credentialSource).toBe('NONE');
      expect(none.connected).toBe(false);
    });

    it('an explicitly resolved credential wins and keeps its source', async () => {
      const fetchFn = okFetch({ models: [] });
      const result = await testProviderConnection({
        family: 'google',
        fetchFn,
        // The server-side credential service resolved a stored USER credential
        // even though the deployment also has one — the two never mix.
        credential: { source: 'USER', secret: 'stored-user-key' },
        env: { AI_GOOGLE_API_KEY: 'server-key' },
      });

      const headers = (
        (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
      )[1].headers as Record<string, string>;
      expect(headers['x-goog-api-key']).toBe('stored-user-key');
      expect(result.credentialSource).toBe('USER');
      expect(result.serverManagedKey).toBe(false);
    });

    it('never reads a prototype-named env member as a credential', async () => {
      const result = await testProviderConnection({
        family: 'openai',
        fetchFn: okFetch({ data: [] }),
        env: { toString: 'sneaky', AI_OPENAI_API_KEY: '  ' },
      });
      expect(result.credentialSource).toBe('NONE');
      expect(result.errorKind).toBe('no_credential');
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
// ─────────────────────────────────────────────────────────────────────────────
// BUGFIX (OpenRouter credential verification)
//
// The reported defect: `testProviderConnection('openrouter')` returned
// `connected: true` for an INVALID credential. `GET /api/v1/models` is a PUBLIC
// catalog — it answers 200 for a missing, malformed or revoked key — so the
// probe authenticated nothing; the deployment's generation validation was the
// only thing that ever caught a bad key.
//
// The fix authenticates against the provider's own credential endpoint
// (`GET /api/v1/key`, which returns the key's record and answers 401 for an
// invalid key) BEFORE discovery, and refuses to report a connection when that
// call does not confirm the credential.
// ─────────────────────────────────────────────────────────────────────────────

describe('ProviderConnectionTester — OpenRouter credential verification (BUGFIX)', () => {
  const KEY_URL = 'https://openrouter.ai/api/v1/key';
  const MODELS_URL = 'https://openrouter.ai/api/v1/models';

  it('rejects an INVALID key although the public catalog answers 200', async () => {
    // Regression: this is exactly the shape that used to be reported as
    // `connected: true` — the public catalog answers 200 for a revoked key.
    const fetchFn = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const href = String(url);
      if (href === KEY_URL) {
        return new Response(
          JSON.stringify({ error: { code: 401, message: 'No auth credentials found' } }),
          { status: 401 },
        );
      }
      if (href === MODELS_URL) {
        return new Response(JSON.stringify({ data: [{ id: 'openai/gpt-4o-mini' }] }), {
          status: 200,
        });
      }
      throw new Error(`unexpected fetch: ${href}`);
    }) as unknown as typeof fetch;

    const result = await run({ family: 'openrouter', apiKey: 'sk-or-revoked', fetchFn });

    expect(result.connected).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.errorKind).toBe('invalid_api_key');
    expect(result.message).toMatch(/invalid api key/i);
    expect(result.message).not.toContain('sk-or-revoked');
    // The public catalog is never consulted once the credential is refused, so
    // a false "connected" is structurally impossible.
    expect(calledUrls(fetchFn)).toEqual([KEY_URL]);
  });

  it('does not treat a 200 without the key record as a confirmed credential', async () => {
    const fetchFn = routedFetch({
      [KEY_URL]: { error: { message: 'no auth credentials found' } },
      [MODELS_URL]: { data: [{ id: 'openai/gpt-4o-mini' }] },
    });

    const result = await run({ family: 'openrouter', apiKey: 'sk-or-x', fetchFn });

    expect(result.connected).toBe(false);
    expect(result.errorKind).toBe('unavailable');
    expect(result.message).toMatch(/did not confirm this credential/i);
    expect(calledUrls(fetchFn)).toEqual([KEY_URL]);
  });

  it('authenticates FIRST, then discovers the real models (order + Bearer header)', async () => {
    const fetchFn = routedFetch({
      [KEY_URL]: { data: { label: 'sk-or-...abc', limit: null, usage: 0 } },
      [MODELS_URL]: {
        data: [{ id: 'openai/gpt-4o-mini' }, { id: 'google/gemini-2.0-flash-001' }],
      },
    });

    const result = await run({ family: 'openrouter', apiKey: 'sk-or-good-key', fetchFn });

    expect(result.connected).toBe(true);
    expect(result.errorKind).toBeUndefined();
    expect(result.modelCount).toBe(2);
    expect(result.models?.map((m) => m.id)).toEqual([
      'openai/gpt-4o-mini',
      'google/gemini-2.0-flash-001',
    ]);

    const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][];
    expect(calls.map((c) => c[0])).toEqual([KEY_URL, MODELS_URL]);
    // The credential is sent to the provider on BOTH calls, because the key's
    // own endpoint is the one that must receive it.
    expect((calls[0][1].headers as Record<string, string>).Authorization).toBe(
      'Bearer sk-or-good-key',
    );
    expect((calls[1][1].headers as Record<string, string>).Authorization).toBe(
      'Bearer sk-or-good-key',
    );
    // ...and is never handed back to the caller.
    expect(JSON.stringify(result)).not.toContain('sk-or-good-key');
  });

  it('still reports latency over the WHOLE probe (both calls), never zero', async () => {
    const fetchFn = routedFetch({
      [KEY_URL]: { data: { label: 'k' } },
      [MODELS_URL]: { data: [{ id: 'openai/gpt-4o-mini' }] },
    });

    const result = await run({ family: 'openrouter', apiKey: 'sk-or-k', fetchFn });

    expect(typeof result.latencyMs).toBe('number');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('maps a rate-limited credential check with the shared taxonomy', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        new Response('{"error":{"message":"slow down"}}', { status: 429 }),
      ) as unknown as typeof fetch;

    const result = await run({ family: 'openrouter', apiKey: 'sk-or-k', fetchFn });

    expect(result.connected).toBe(false);
    expect(result.errorKind).toBe('rate_limited');
    expect(result.message).toMatch(/rate limit/i);
    expect(calledUrls(fetchFn)).toEqual([KEY_URL]);
  });

  it('maps an unreachable credential endpoint as unreachable (not as a connection)', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch;

    const result = await run({ family: 'openrouter', apiKey: 'sk-or-k', fetchFn });

    expect(result.connected).toBe(false);
    expect(result.errorKind).toBe('unreachable');
    expect(calledUrls(fetchFn)).toEqual([KEY_URL]);
  });

  it('treats a 200 with an unreadable body as unconfirmed (never connected)', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response('not json', { status: 200 })) as unknown as typeof fetch;

    const result = await run({ family: 'openrouter', apiKey: 'sk-or-k', fetchFn });

    expect(result.connected).toBe(false);
    expect(result.errorKind).toBe('unavailable');
  });

  it('refuses to probe at all without a credential (never an anonymous catalog call)', async () => {
    const fetchFn = routedFetch({ [MODELS_URL]: { data: [{ id: 'openai/gpt-4o-mini' }] } });

    const result = await run({ family: 'openrouter', fetchFn });

    expect(result.connected).toBe(false);
    expect(result.errorKind).toBe('no_credential');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('confirms a credential only from a key RECORD, never from a catalog shape', () => {
    expect(confirmsOpenRouterCredential({ data: { label: 'k', limit: null } })).toBe(true);
    // A catalog body (`data` is an array) proves nothing about a credential.
    expect(confirmsOpenRouterCredential({ data: [{ id: 'openai/gpt-4o-mini' }] })).toBe(false);
    expect(confirmsOpenRouterCredential({ data: null })).toBe(false);
    expect(confirmsOpenRouterCredential({ error: { message: 'nope' } })).toBe(false);
    expect(confirmsOpenRouterCredential(undefined)).toBe(false);
    expect(confirmsOpenRouterCredential('ok')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BUGFIX (Ollama honesty) — the tester must distinguish measured states
//
// The reported defect: a user WITH Ollama installed saw "Ollama isn't running on
// this computer. Install it from ollama.com". The cause was that every
// non-2xx/network outcome collapsed into `unreachable`, so a REACHABLE but empty
// Ollama (and a reachable-but-model-less generation) were reported as absence.
// ─────────────────────────────────────────────────────────────────────────────

describe('ProviderConnectionTester — Ollama honesty (BUGFIX)', () => {
  it('a REACHABLE Ollama with zero models is `no_models`, never `unreachable`', async () => {
    // /api/tags answered 200 with an empty catalog → Ollama IS installed and up.
    const result = await run({ family: 'ollama', fetchFn: okFetch({ models: [] }) });

    expect(result.connected).toBe(false);
    expect(result.errorKind).toBe('no_models');
    expect(result.modelCount).toBe(0);
    expect(result.models ?? []).toEqual([]);
    // The message must describe the real state and never assert absence.
    expect(result.message).toMatch(/is running/);
    expect(result.message).not.toMatch(/not installed/i);
    expect(result.message).not.toMatch(/unreachable/i);
  });

  it('a reachable Ollama WITH models still connects and reports real ids', async () => {
    const result = await run({
      family: 'ollama',
      fetchFn: okFetch({
        models: [{ name: 'qwen2.5-coder:7b-instruct' }, { name: 'llama3.2:latest' }],
      }),
    });

    expect(result.connected).toBe(true);
    expect(result.models?.map((m) => m.id)).toEqual([
      'qwen2.5-coder:7b-instruct',
      'llama3.2:latest',
    ]);
  });

  it('a genuine network failure stays `unreachable` (absence of evidence only)', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await run({ family: 'ollama', fetchFn: fetchFn as unknown as typeof fetch });

    expect(result.connected).toBe(false);
    expect(result.errorKind).toBe('unreachable');
    // The tester states the technical fact; the UI owns the honest wording.
    expect(result.message).not.toMatch(/not installed/i);
  });

  it('a timeout is classified as unreachable, not as a missing install', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));
    const result = await run({ family: 'ollama', fetchFn: fetchFn as unknown as typeof fetch });

    expect(result.errorKind).toBe('unreachable');
    expect(result.message).not.toMatch(/not installed/i);
  });

  it('a browser-origin refusal on a loopback Ollama is `browser_origin_blocked`', async () => {
    // Ollama answers 403 mentioning origins — it is UP; the browser is refused.
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'origin not allowed' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await run({
      family: 'ollama',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.connected).toBe(false);
    expect(result.errorKind).toBe('browser_origin_blocked');
    // Never reported as a missing credential or a missing install.
    expect(result.message).not.toMatch(/not installed/i);
  });

  it('an invalid endpoint (HTTP 404) is `not_found`, distinct from unreachable', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await run({
      family: 'ollama',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // A 404 on /api/tags means something answered at that address but is not
    // serving the Ollama tags API — an ADDRESS problem, not a missing install
    // and not an unreachable host. It must stay its own classified state.
    expect(result.connected).toBe(false);
    expect(result.errorKind).toBe('not_found');
  });

  it('never reports a connection without a real model list (no fake ids)', async () => {
    const result = await run({ family: 'ollama', fetchFn: okFetch({ models: 'garbage' }) });

    // A malformed catalog is NOT a connection, and no model id may be invented
    // from it. The probe reports the failure it actually measured (the catalog
    // could not be read), and never echoes the unparsable payload.
    expect(result.connected).toBe(false);
    expect(result.models ?? []).toEqual([]);
  });
});
