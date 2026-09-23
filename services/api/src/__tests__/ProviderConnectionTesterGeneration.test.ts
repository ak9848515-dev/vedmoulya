// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — ProviderConnectionTester G9 branch coverage
//
// Complements `ProviderConnectionTester.test.ts` (probe/model discovery) with
// the G9-only surfaces:
//   - validateProviderGeneration() across ALL six families, both parse outcomes
//     and the full failure taxonomy (HTTP + network)
//   - discoverModelMetadata() (incl. Ollama's real context window, never guessed)
//   - the local-runtime browser-origin classification helpers
//   - the browser_origin_blocked probe outcome
//
// Deterministic test doubles only — no real provider credentials, no network.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import {
  validateProviderGeneration,
  discoverModelMetadata,
  isLoopbackEndpoint,
  classifyLocalRuntimeRefusal,
  testProviderConnection,
} from '../services/ProviderConnectionTester.js';

/** A fetch double returning `body` as JSON with the given HTTP status. */
function jsonFetch(body: unknown, status = 200, statusText = 'OK'): typeof fetch {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      statusText,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

function lastCall(fetchFn: typeof fetch): [string, RequestInit] {
  const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls;
  return calls[calls.length - 1] as [string, RequestInit];
}

function headersOf(fetchFn: typeof fetch): Record<string, string> {
  return lastCall(fetchFn)[1].headers as Record<string, string>;
}

describe('validateProviderGeneration (G9 — "does this provider really answer?")', () => {
  describe('input normalization', () => {
    it('refuses a blank model id without issuing any request', async () => {
      const fetchFn = jsonFetch({});
      const result = await validateProviderGeneration({
        family: 'openai',
        apiKey: 'k',
        modelId: '   ',
        env: {},
        fetchFn,
      });

      expect(result.ok).toBe(false);
      expect(result.modelId).toBe('');
      expect(result.latencyMs).toBe(0);
      expect(result.errorKind).toBe('no_credential');
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('falls back to process.env / global fetch when no doubles are injected', async () => {
      // The blank-model path returns before any request, so this exercises the
      // `input.env ?? process.env` / `input.fetchFn ?? globalThis.fetch`
      // defaults without touching the network.
      const result = await validateProviderGeneration({
        family: 'openai',
        apiKey: 'k',
        modelId: '',
      });

      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/no model was available/i);
    });
  });

  describe('google', () => {
    it('validates a real Gemini completion (generateContent, key in x-goog-api-key)', async () => {
      const fetchFn = jsonFetch({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] });
      const result = await validateProviderGeneration({
        family: 'google',
        apiKey: 'gem-key',
        modelId: 'gemini-2.5-flash',
        env: {},
        fetchFn,
      });

      expect(result.ok).toBe(true);
      expect(result.modelId).toBe('gemini-2.5-flash');
      expect(typeof result.latencyMs).toBe('number');

      const [url, init] = lastCall(fetchFn);
      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      );
      const headers = init.headers as Record<string, string>;
      expect(headers['x-goog-api-key']).toBe('gem-key');
      expect(headers['Content-Type']).toBe('application/json');
      // The tiny validation prompt, never a real generation.
      expect(JSON.parse(String(init.body))).toEqual({
        contents: [{ parts: [{ text: 'Reply with the single word: ok' }] }],
      });
    });

    it('omits the Gemini key header when no credential resolves', async () => {
      const fetchFn = jsonFetch({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] });
      const result = await validateProviderGeneration({
        family: 'google',
        modelId: 'gemini-2.5-flash',
        env: {},
        fetchFn,
      });

      expect(result.ok).toBe(true);
      expect(headersOf(fetchFn)['x-goog-api-key']).toBeUndefined();
      expect(headersOf(fetchFn)['Content-Type']).toBe('application/json');
    });

    it('reports a Gemini that listed models but produced no answer', async () => {
      const empty = await validateProviderGeneration({
        family: 'google',
        apiKey: 'k',
        modelId: 'gemini-2.5-flash',
        env: {},
        fetchFn: jsonFetch({ candidates: [] }),
      });
      expect(empty.ok).toBe(false);
      expect(empty.errorKind).toBe('unavailable');

      const noContent = await validateProviderGeneration({
        family: 'google',
        apiKey: 'k',
        modelId: 'gemini-2.5-flash',
        env: {},
        fetchFn: jsonFetch({ candidates: [{ content: { parts: [] } }] }),
      });
      expect(noContent.ok).toBe(false);

      // Non-string parts are skipped, the string part still counts.
      const mixed = await validateProviderGeneration({
        family: 'google',
        apiKey: 'k',
        modelId: 'gemini-2.5-flash',
        env: {},
        fetchFn: jsonFetch({ candidates: [{ content: { parts: [{}, { text: 'ok' }] } }] }),
      });
      expect(mixed.ok).toBe(true);
    });
  });

  describe('anthropic', () => {
    it('validates a real Messages completion', async () => {
      const fetchFn = jsonFetch({ content: [{ text: 'ok' }] });
      const result = await validateProviderGeneration({
        family: 'anthropic',
        apiKey: 'sk-ant',
        modelId: 'claude-sonnet-4',
        env: {},
        fetchFn,
      });

      expect(result.ok).toBe(true);
      const [url, init] = lastCall(fetchFn);
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      const headers = init.headers as Record<string, string>;
      expect(headers['x-api-key']).toBe('sk-ant');
      expect(headers['anthropic-version']).toBe('2023-06-01');
      expect(JSON.parse(String(init.body)).model).toBe('claude-sonnet-4');
    });

    it('sends an empty key header when no credential resolves', async () => {
      const fetchFn = jsonFetch({ content: [{ text: 'ok' }] });
      await validateProviderGeneration({
        family: 'anthropic',
        modelId: 'claude-sonnet-4',
        env: {},
        fetchFn,
      });
      expect(headersOf(fetchFn)['x-api-key']).toBe('');
    });

    it('reports an empty Messages response as no answer', async () => {
      const result = await validateProviderGeneration({
        family: 'anthropic',
        apiKey: 'k',
        modelId: 'claude-sonnet-4',
        env: {},
        fetchFn: jsonFetch({ content: [] }),
      });
      expect(result.ok).toBe(false);
      expect(result.errorKind).toBe('unavailable');
    });
  });

  describe('ollama', () => {
    it('validates a local completion on the user-supplied server URL', async () => {
      const fetchFn = jsonFetch({ message: { content: 'ok' } });
      const result = await validateProviderGeneration({
        family: 'ollama',
        modelId: 'llama3.2',
        endpointUrl: 'http://192.168.1.10:11434/',
        env: {},
        fetchFn,
      });

      expect(result.ok).toBe(true);
      const [url, init] = lastCall(fetchFn);
      expect(url).toBe('http://192.168.1.10:11434/api/chat');
      expect(JSON.parse(String(init.body))).toEqual({
        model: 'llama3.2',
        stream: false,
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
      });
    });

    it('falls back to the deployment URL, then to the localhost default', async () => {
      const fromEnv = jsonFetch({ message: { content: 'ok' } });
      await validateProviderGeneration({
        family: 'ollama',
        modelId: 'llama3.2',
        env: { AI_OLLAMA_BASE_URL: 'http://ollama.internal:11434' },
        fetchFn: fromEnv,
      });
      expect(lastCall(fromEnv)[0]).toBe('http://ollama.internal:11434/api/chat');

      const fromDefault = jsonFetch({ message: { content: 'ok' } });
      await validateProviderGeneration({
        family: 'ollama',
        modelId: 'llama3.2',
        env: {},
        fetchFn: fromDefault,
      });
      expect(lastCall(fromDefault)[0]).toBe('http://localhost:11434/api/chat');
    });

    it('reports a blank Ollama reply as no answer', async () => {
      const blank = await validateProviderGeneration({
        family: 'ollama',
        modelId: 'llama3.2',
        env: {},
        fetchFn: jsonFetch({ message: { content: '   ' } }),
      });
      expect(blank.ok).toBe(false);

      const missing = await validateProviderGeneration({
        family: 'ollama',
        modelId: 'llama3.2',
        env: {},
        fetchFn: jsonFetch({}),
      });
      expect(missing.ok).toBe(false);
    });
  });

  describe('openai / deepseek / openai-compatible', () => {
    it('validates a real OpenAI completion on the fixed endpoint', async () => {
      const fetchFn = jsonFetch({ choices: [{ message: { content: 'ok' } }] });
      const result = await validateProviderGeneration({
        family: 'openai',
        apiKey: 'sk-openai',
        modelId: 'gpt-4o-mini',
        env: {},
        fetchFn,
      });

      expect(result.ok).toBe(true);
      const [url, init] = lastCall(fetchFn);
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-openai');
    });

    it('validates a real DeepSeek completion on the fixed endpoint', async () => {
      const fetchFn = jsonFetch({ choices: [{ message: { content: 'ok' } }] });
      const result = await validateProviderGeneration({
        family: 'deepseek',
        apiKey: 'sk-ds',
        modelId: 'deepseek-chat',
        env: {},
        fetchFn,
      });

      expect(result.ok).toBe(true);
      expect(lastCall(fetchFn)[0]).toBe('https://api.deepseek.com/chat/completions');
    });

    it('validates an OpenAI-compatible endpoint (trailing slash stripped)', async () => {
      const fetchFn = jsonFetch({ choices: [{ message: { content: 'ok' } }] });
      const result = await validateProviderGeneration({
        family: 'openai-compatible',
        apiKey: 'k',
        modelId: 'my-model',
        endpointUrl: 'https://gw.example.com/v1/',
        env: {},
        fetchFn,
      });

      expect(result.ok).toBe(true);
      expect(lastCall(fetchFn)[0]).toBe('https://gw.example.com/v1/chat/completions');
    });

    it('tolerates a missing endpoint URL without inventing one', async () => {
      const fetchFn = jsonFetch({ choices: [{ message: { content: 'ok' } }] });
      const result = await validateProviderGeneration({
        family: 'openai-compatible',
        modelId: 'my-model',
        env: {},
        fetchFn,
      });

      expect(result.ok).toBe(true);
      expect(lastCall(fetchFn)[0]).toBe('/chat/completions');
    });

    it('accepts a reasoning model that answers with only a finish_reason', async () => {
      const result = await validateProviderGeneration({
        family: 'openai',
        apiKey: 'k',
        modelId: 'o4-mini',
        env: {},
        fetchFn: jsonFetch({ choices: [{ message: { content: '' }, finish_reason: 'stop' }] }),
      });
      expect(result.ok).toBe(true);
    });

    it('reports no answer for an empty/absent choices payload', async () => {
      const noChoices = await validateProviderGeneration({
        family: 'openai',
        apiKey: 'k',
        modelId: 'gpt-4o-mini',
        env: {},
        fetchFn: jsonFetch({}),
      });
      expect(noChoices.ok).toBe(false);
      expect(noChoices.errorKind).toBe('unavailable');

      const emptyMessage = await validateProviderGeneration({
        family: 'openai',
        apiKey: 'k',
        modelId: 'gpt-4o-mini',
        env: {},
        fetchFn: jsonFetch({ choices: [{ message: { content: '' } }] }),
      });
      expect(emptyMessage.ok).toBe(false);
    });
  });

  describe('failure taxonomy', () => {
    it('maps a malformed-request rejection to bad_request', async () => {
      const result = await validateProviderGeneration({
        family: 'openai',
        apiKey: 'k',
        modelId: 'gpt-4o-mini',
        env: {},
        fetchFn: jsonFetch({}, 400, 'Bad Request'),
      });

      expect(result.ok).toBe(false);
      expect(result.errorKind).toBe('bad_request');
      expect(result.message).toMatch(/malformed/i);
    });

    it('maps a rejected credential to invalid_api_key and never echoes the key', async () => {
      const secret = 'sk-generation-secret-1234';
      const result = await validateProviderGeneration({
        family: 'openai',
        apiKey: secret,
        modelId: 'gpt-4o-mini',
        env: {},
        fetchFn: jsonFetch({}, 401, 'Unauthorized'),
      });

      expect(result.errorKind).toBe('invalid_api_key');
      expect(result.message).not.toContain(secret);
    });

    it('maps an unreachable endpoint to unreachable', async () => {
      const fetchFn = vi
        .fn()
        .mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch;
      const result = await validateProviderGeneration({
        family: 'ollama',
        modelId: 'llama3.2',
        env: {},
        fetchFn,
      });

      expect(result.ok).toBe(false);
      expect(result.errorKind).toBe('unreachable');
      expect(result.message).toMatch(/unreachable/i);
    });

    it('maps a timeout to unreachable with the configured duration', async () => {
      const fetchFn = vi
        .fn()
        .mockRejectedValue(new DOMException('aborted', 'AbortError')) as unknown as typeof fetch;
      const result = await validateProviderGeneration({
        family: 'ollama',
        modelId: 'llama3.2',
        timeoutMs: 3000,
        env: {},
        fetchFn,
      });

      expect(result.errorKind).toBe('unreachable');
      expect(result.message).toContain('3s');
    });
  });

  describe('credential resolution', () => {
    it('uses an explicitly resolved USER credential above everything else', async () => {
      const fetchFn = jsonFetch({ choices: [{ message: { content: 'ok' } }] });
      const result = await validateProviderGeneration({
        family: 'openai',
        apiKey: 'ignored-user-key',
        credential: { source: 'USER', secret: 'stored-user-key' },
        modelId: 'gpt-4o-mini',
        env: { AI_OPENAI_API_KEY: 'server-key' },
        fetchFn,
      });

      expect(result.ok).toBe(true);
      expect(headersOf(fetchFn).Authorization).toBe('Bearer stored-user-key');
    });

    it('uses an explicitly resolved PLATFORM credential when no user key is given', async () => {
      const fetchFn = jsonFetch({ choices: [{ message: { content: 'ok' } }] });
      await validateProviderGeneration({
        family: 'openai',
        credential: { source: 'PLATFORM', secret: 'server-resolved-key' },
        modelId: 'gpt-4o-mini',
        env: {},
        fetchFn,
      });

      expect(headersOf(fetchFn).Authorization).toBe('Bearer server-resolved-key');
    });

    it('falls back to the deployment env credential when nothing is supplied', async () => {
      const fetchFn = jsonFetch({ choices: [{ message: { content: 'ok' } }] });
      await validateProviderGeneration({
        family: 'openai',
        modelId: 'gpt-4o-mini',
        env: { AI_OPENAI_API_KEY: 'env-key' },
        fetchFn,
      });

      expect(headersOf(fetchFn).Authorization).toBe('Bearer env-key');
    });
  });
});

describe('discoverModelMetadata (G9 — deterministic default selection)', () => {
  it('projects id/name for every non-Ollama family', () => {
    expect(
      discoverModelMetadata('google', { models: [{ name: 'models/gemini-2.5-flash' }] }),
    ).toEqual([{ id: 'gemini-2.5-flash', name: 'gemini-2.5-flash' }]);
    expect(discoverModelMetadata('openai', { data: [{ id: 'gpt-4o' }] })).toEqual([
      { id: 'gpt-4o', name: 'gpt-4o' },
    ]);
    expect(
      discoverModelMetadata('anthropic', {
        data: [{ id: 'claude-sonnet-4', display_name: 'Sonnet' }],
      }),
    ).toEqual([{ id: 'claude-sonnet-4', name: 'Sonnet' }]);
    expect(discoverModelMetadata('deepseek', { data: [{ id: 'deepseek-chat' }] })).toEqual([
      { id: 'deepseek-chat', name: 'deepseek-chat' },
    ]);
    expect(discoverModelMetadata('openai-compatible', { data: [{ id: 'my-model' }] })).toEqual([
      { id: 'my-model', name: 'my-model' },
    ]);
  });

  it('reads Ollama’s real served context window, never guessing one', () => {
    expect(
      discoverModelMetadata('ollama', {
        models: [
          { name: 'llama3.2', details: { context_length: 131072 } },
          { name: 'qwen2.5:7b' },
          { name: 42 },
        ],
      }),
    ).toEqual([
      { id: 'llama3.2', name: 'llama3.2', contextLength: 131072 },
      { id: 'qwen2.5:7b', name: 'qwen2.5:7b' },
    ]);
  });

  it('ignores a non-numeric or absent context length and an absent model list', () => {
    expect(
      discoverModelMetadata('ollama', {
        models: [{ name: 'llama3.2', details: { context_length: 'big' } }],
      }),
    ).toEqual([{ id: 'llama3.2', name: 'llama3.2' }]);
    expect(discoverModelMetadata('ollama', {})).toEqual([]);
  });
});

describe('local-runtime classification (G9 — browser origin policy)', () => {
  it('recognizes loopback endpoints only', () => {
    expect(isLoopbackEndpoint('http://localhost:11434')).toBe(true);
    expect(isLoopbackEndpoint('http://127.0.0.1:11434')).toBe(true);
    expect(isLoopbackEndpoint('http://[::1]:11434')).toBe(true);
    expect(isLoopbackEndpoint('http://192.168.1.10:11434')).toBe(false);
    expect(isLoopbackEndpoint('not-a-url')).toBe(false);
  });

  it('classifies a loopback origin refusal as browser_origin_blocked', () => {
    expect(classifyLocalRuntimeRefusal(403, 'origin not allowed', 'http://localhost:11434')).toBe(
      'browser_origin_blocked',
    );
  });

  it('falls back to unauthorized for a loopback refusal without an origin hint', () => {
    expect(classifyLocalRuntimeRefusal(403, 'forbidden', 'http://localhost:11434')).toBe(
      'unauthorized',
    );
    expect(classifyLocalRuntimeRefusal(401, 'nope', 'http://127.0.0.1:11434')).toBe('unauthorized');
  });

  it('keeps the remote-provider taxonomy for non-loopback endpoints', () => {
    expect(classifyLocalRuntimeRefusal(401, 'bad key', 'https://api.openai.com/v1')).toBe(
      'invalid_api_key',
    );
    expect(classifyLocalRuntimeRefusal(403, 'forbidden', 'https://api.openai.com/v1')).toBe(
      'unauthorized',
    );
  });

  it('ignores statuses that are not 401/403', () => {
    expect(classifyLocalRuntimeRefusal(200, '', 'http://localhost:11434')).toBeUndefined();
    expect(classifyLocalRuntimeRefusal(500, 'boom', 'http://localhost:11434')).toBeUndefined();
  });

  it('surfaces the browser_origin_blocked outcome from a real probe', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        new Response('Origin is not allowed by the policy', { status: 403 }),
      ) as unknown as typeof fetch;

    const result = await testProviderConnection({
      family: 'ollama',
      endpointUrl: 'http://localhost:11434',
      env: {},
      fetchFn,
    });

    expect(result.connected).toBe(false);
    expect(result.errorKind).toBe('browser_origin_blocked');
    expect(result.message).toMatch(/browser access is blocked/i);
    expect(result.message).not.toMatch(/api key/i);
  });
});
