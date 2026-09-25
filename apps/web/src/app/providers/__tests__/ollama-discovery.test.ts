// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Browser-side Ollama discovery tests (BUGFIX: Ollama honesty)
//
// Proves the ONE behavioural change that matters: a failed request is NEVER
// flattened into "Ollama is not installed". Each state is driven by what the
// probe actually MEASURED, and the model list only ever contains ids Ollama
// really returned.
//
// Upstream contracts exercised here are the VERIFIED ones:
//   GET  {base}/api/version  → { version }
//   GET  {base}/api/tags     → { models: [{ name, size, details }] }
//   POST {base}/api/chat     → { message: { content } }
// (https://github.com/ollama/ollama/blob/main/docs/api.md)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_OLLAMA_ENDPOINT,
  OLLAMA_ENDPOINT_CANDIDATES,
  classifyBrowserProbeFailure,
  discoverOllama,
  isValidEndpoint,
  normalizeEndpoint,
  parseOllamaChatReply,
  parseOllamaTags,
  parseOllamaVersion,
  testOllamaGeneration,
} from '../ollama-discovery.js';

/** A fetch double that answers by URL suffix, so candidates can differ. */
function fakeFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response> | never,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    return handler(String(input), init);
  }) as unknown as typeof fetch;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ollama discovery — endpoint candidates', () => {
  it('lists several loopback candidates with the normal Ollama endpoint first', () => {
    // A single hard-coded hostname is what made discovery fail on machines
    // where only a different spelling resolves.
    expect(OLLAMA_ENDPOINT_CANDIDATES[0]).toBe(DEFAULT_OLLAMA_ENDPOINT);
    expect(OLLAMA_ENDPOINT_CANDIDATES).toContain('http://127.0.0.1:11434');
    expect(OLLAMA_ENDPOINT_CANDIDATES.length).toBeGreaterThan(1);
  });

  it('probes 127.0.0.1 when localhost does not answer', async () => {
    const attempts: string[] = [];
    const fetchFn = fakeFetch((url) => {
      attempts.push(url);
      if (url.includes('localhost:11434')) throw new TypeError('Failed to fetch');
      if (url.endsWith('/api/version')) return json({ version: '0.5.1' });
      return json({ models: [{ name: 'llama3.2' }] });
    });

    const result = await discoverOllama({ fetchFn });

    expect(result.state).toBe('MODELS_FOUND');
    expect(result.endpoint).toBe('http://127.0.0.1:11434');
    expect(attempts.some((u) => u.includes('localhost'))).toBe(true);
  });

  it('normalizes trailing slashes and validates URLs', () => {
    expect(normalizeEndpoint('http://localhost:11434/')).toBe('http://localhost:11434');
    expect(isValidEndpoint('http://localhost:11434')).toBe(true);
    expect(isValidEndpoint('not a url')).toBe(false);
    expect(isValidEndpoint('ftp://localhost')).toBe(false);
  });

  it('reports an invalid endpoint as such instead of silently probing defaults', async () => {
    const fetchFn = fakeFetch(() => json({ version: '0.5.1' }));
    const result = await discoverOllama({ endpoint: 'nonsense', fetchFn });

    expect(result.error).toBe('OLLAMA_INVALID_RESPONSE');
    expect(result.message).toMatch(/not a valid address/);
  });
});

describe('ollama discovery — measured states (never "not installed" by default)', () => {
  it('STATE C/E: a running Ollama with models reports the REAL model list', async () => {
    const fetchFn = fakeFetch((url) => {
      if (url.endsWith('/api/version')) return json({ version: '0.6.0' });
      return json({
        models: [
          { name: 'qwen2.5-coder:7b-instruct', size: 4_700_000_000 },
          { name: 'llama3.2:latest', size: 2_000_000_000 },
        ],
      });
    });

    const result = await discoverOllama({ fetchFn });

    expect(result.state).toBe('MODELS_FOUND');
    expect(result.version).toBe('0.6.0');
    // Exactly what Ollama returned — nothing invented, nothing dropped.
    expect(result.models.map((m) => m.id)).toEqual([
      'qwen2.5-coder:7b-instruct',
      'llama3.2:latest',
    ]);
    expect(result.error).toBeUndefined();
  });

  it('STATE D: reachable with ZERO models is NO_MODELS, never "not installed"', async () => {
    const fetchFn = fakeFetch((url) =>
      url.endsWith('/api/version') ? json({ version: '0.6.0' }) : json({ models: [] }),
    );

    const result = await discoverOllama({ fetchFn });

    expect(result.state).toBe('NO_MODELS');
    expect(result.error).toBe('OLLAMA_NO_MODELS');
    expect(result.message).toMatch(/Ollama is running, but no models are installed/);
    // The reported message must never claim Ollama is absent.
    expect(result.message).not.toMatch(/not installed/i);
    expect(result.message).not.toMatch(/isn't running/i);
  });

  it('STATE B: nothing answers → NOT_REACHABLE, worded without asserting absence', async () => {
    const fetchFn = fakeFetch(() => {
      throw new TypeError('Failed to fetch');
    });

    const result = await discoverOllama({ fetchFn });

    expect(result.error).toBe('OLLAMA_NOT_REACHABLE');
    expect(result.message).toBe('VedMoulya could not reach Ollama on this computer.');
    // The critical regression: the old copy told installed users to reinstall.
    expect(result.message).not.toMatch(/not installed/i);
    expect(result.message).not.toMatch(/install it from/i);
  });

  it('a non-Ollama service on the port is INVALID_RESPONSE, not "unreachable"', async () => {
    const fetchFn = fakeFetch(() => json({ hello: 'i am something else' }));

    const result = await discoverOllama({ fetchFn });

    expect(result.error).toBe('OLLAMA_INVALID_RESPONSE');
    expect(result.message).toMatch(/was not an Ollama service/);
  });

  it('an HTTP error from the address is INVALID_RESPONSE (something IS listening)', async () => {
    const fetchFn = fakeFetch(() => json({ error: 'nope' }, 500));

    const result = await discoverOllama({ fetchFn });

    expect(result.error).toBe('OLLAMA_INVALID_RESPONSE');
  });

  it('a reachable Ollama whose model list cannot be read stays OLLAMA_REACHABLE', async () => {
    const fetchFn = fakeFetch((url) =>
      url.endsWith('/api/version') ? json({ version: '0.6.0' }) : json({ error: 'boom' }, 500),
    );

    const result = await discoverOllama({ fetchFn });

    expect(result.state).toBe('OLLAMA_REACHABLE');
    expect(result.error).toBe('OLLAMA_INVALID_RESPONSE');
    expect(result.message).toMatch(/is running/);
  });

  it('a timeout is treated as unreachable, not as a missing install', async () => {
    const fetchFn = fakeFetch(() => {
      const error = new Error('The operation was aborted');
      error.name = 'TimeoutError';
      throw error;
    });

    const result = await discoverOllama({ fetchFn, timeoutMs: 10 });

    expect(result.error).toBe('OLLAMA_NOT_REACHABLE');
    expect(result.message).not.toMatch(/not installed/i);
  });
});

describe('ollama discovery — browser/CORS vs nothing-there', () => {
  it('attributes a browser failure to CORS ONLY when the server proved Ollama is up', () => {
    // Evidence-based: the same browser failure means different things depending
    // on whether the server could reach the service.
    expect(classifyBrowserProbeFailure('http://localhost:11434')).toBe(
      'OLLAMA_CORS_OR_BROWSER_BLOCKED',
    );
    expect(classifyBrowserProbeFailure(undefined)).toBe('OLLAMA_NOT_REACHABLE');
    // An invalid payload still proves something is listening.
    expect(classifyBrowserProbeFailure(undefined, true)).toBe('OLLAMA_INVALID_RESPONSE');
  });

  it('reports the browser-blocked state with an OLLAMA_ORIGINS instruction, not a reinstall', async () => {
    const fetchFn = fakeFetch(() => {
      throw new TypeError('Failed to fetch');
    });

    const result = await discoverOllama({
      fetchFn,
      serverReachableEndpoint: 'http://localhost:11434',
    });

    expect(result.error).toBe('OLLAMA_CORS_OR_BROWSER_BLOCKED');
    expect(result.message).toMatch(/this browser cannot access it/);
    expect(result.message).toMatch(/Allow VedMoulya to connect/);
    // The user must never be told to install Ollama while it is provably running.
    expect(result.message).not.toMatch(/install/i);
  });
});

describe('ollama parsing — real upstream shapes only', () => {
  it('parses /api/tags and drops entries with no name', () => {
    expect(
      parseOllamaTags({ models: [{ name: 'a' }, { size: 1 }, { name: '' }, { name: 'b' }] }),
    ).toEqual([
      { id: 'a', name: 'a' },
      { id: 'b', name: 'b' },
    ]);
    expect(parseOllamaTags({})).toEqual([]);
    expect(parseOllamaTags(null)).toEqual([]);
  });

  it('parses /api/version and rejects a blank one', () => {
    expect(parseOllamaVersion({ version: '0.6.0' })).toBe('0.6.0');
    expect(parseOllamaVersion({ version: '   ' })).toBeUndefined();
    expect(parseOllamaVersion({})).toBeUndefined();
  });

  it('recognises a real chat completion and rejects an empty one', () => {
    expect(parseOllamaChatReply({ message: { content: 'ok' } })).toBe(true);
    expect(parseOllamaChatReply({ message: { content: '  ' } })).toBe(false);
    expect(parseOllamaChatReply({})).toBe(false);
  });
});

describe('ollama STATE F — a real completion is required before CONNECTED', () => {
  it('reports CONNECTED only when the model actually answers', async () => {
    const fetchFn = fakeFetch(() => json({ message: { content: 'ok' } }));

    const result = await testOllamaGeneration('http://localhost:11434', 'llama3.2', { fetchFn });

    expect(result.state).toBe('CONNECTED');
    expect(result.error).toBeUndefined();
  });

  it('sends the documented non-streaming chat request shape', async () => {
    let seenBody: unknown = null;
    const fetchFn = fakeFetch((url, init) => {
      expect(url).toBe('http://localhost:11434/api/chat');
      seenBody = JSON.parse(String(init?.body));
      return json({ message: { content: 'ok' } });
    });

    await testOllamaGeneration('http://localhost:11434/', 'llama3.2', { fetchFn });

    expect(seenBody).toMatchObject({ model: 'llama3.2', stream: false });
  });

  it('a missing model is MODEL_UNAVAILABLE — the server is fine (HTTP 404)', async () => {
    const fetchFn = fakeFetch(() => json({ error: 'model not found' }, 404));

    const result = await testOllamaGeneration('http://localhost:11434', 'ghost:1b', { fetchFn });

    expect(result.error).toBe('OLLAMA_MODEL_UNAVAILABLE');
    expect(result.message).toMatch(/does not have the model/);
  });

  it('an empty completion is GENERATION_FAILED, not CONNECTED', async () => {
    const fetchFn = fakeFetch(() => json({ message: { content: '' } }));

    const result = await testOllamaGeneration('http://localhost:11434', 'llama3.2', { fetchFn });

    expect(result.state).toBe('MODELS_FOUND');
    expect(result.error).toBe('OLLAMA_GENERATION_FAILED');
  });

  it('a failed generation never yields CONNECTED', async () => {
    const fetchFn = fakeFetch(() => {
      throw new Error('connection reset');
    });

    const result = await testOllamaGeneration('http://localhost:11434', 'llama3.2', { fetchFn });

    expect(result.state).not.toBe('CONNECTED');
    expect(result.error).toBe('OLLAMA_GENERATION_FAILED');
  });

  it('requires a model to be chosen before testing', async () => {
    const fetchFn = fakeFetch(() => json({ message: { content: 'ok' } }));

    const result = await testOllamaGeneration('http://localhost:11434', '   ', { fetchFn });

    expect(result.error).toBe('OLLAMA_MODEL_UNAVAILABLE');
  });
});

describe('ollama discovery — no secrets and no invented ids', () => {
  it('never fabricates model ids when the payload is malformed', async () => {
    const fetchFn = fakeFetch((url) =>
      url.endsWith('/api/version') ? json({ version: '0.6.0' }) : json({ models: 'nope' }),
    );

    const result = await discoverOllama({ fetchFn });

    expect(result.models).toEqual([]);
    expect(result.state).not.toBe('MODELS_FOUND');
  });

  it('does not log fetched payloads', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const fetchFn = fakeFetch((url) =>
      url.endsWith('/api/version')
        ? json({ version: '0.6.0' })
        : json({ models: [{ name: 'llama3.2' }] }),
    );

    await discoverOllama({ fetchFn });

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
