// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Local Agent client boundary tests (stream + probe failures)
//
// Proves the browser distinguishes every boundary failure it can actually see:
// an absent agent, a refused HTTP status, a terminal stream error chunk and a
// blocked (CORS / Private Network Access) call. None of them may be reported as
// a plain "no reply".
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import {
  checkLocalAgent,
  DEFAULT_LOCAL_AGENT_URL,
  fetchLocalRuntimeStatus,
  streamLocalGeneration,
} from '../local-ai-agent.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Build a Response whose body is a real NDJSON stream. */
function ndjsonResponse(lines: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(`${line}\n`));
      controller.close();
    },
  });
  return new Response(stream, { status });
}

const AGENT = DEFAULT_LOCAL_AGENT_URL;

describe('checkLocalAgent — failure classification', () => {
  it('classifies a browser-blocked call as CORS/PNA-aware and says so', async () => {
    // The browser reports BOTH a CORS rejection and a refused connection as an
    // opaque TypeError; the classifier must not assert the wrong one.
    const fetchFn = vi.fn(() =>
      Promise.reject(new TypeError('Failed to fetch')),
    ) as unknown as typeof fetch;

    const result = await checkLocalAgent({ fetchFn });
    expect(result.reachable).toBe(false);
    expect(result.failure?.code).toBe('AGENT_UNAVAILABLE');
    expect(result.message).toMatch(/CORS|Private Network Access/i);
  });

  it('classifies a timeout as AGENT_UNAVAILABLE', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'TimeoutError' });
    const fetchFn = vi.fn(() => Promise.reject(abort)) as unknown as typeof fetch;

    const result = await checkLocalAgent({ fetchFn });
    expect(result.failure?.code).toBe('AGENT_UNAVAILABLE');
    expect(result.message).toMatch(/did not answer in time/i);
  });

  it('has no failure when the agent answers', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          status: 'RUNNING',
          version: '1.0.0',
          startedAt: '2026-01-01T00:00:00.000Z',
          runtimes: ['ollama'],
        }),
      ),
    ) as unknown as typeof fetch;

    const result = await checkLocalAgent({ fetchFn });
    expect(result.reachable).toBe(true);
    expect(result.failure).toBeUndefined();
  });
});

describe('fetchLocalRuntimeStatus — reports stay typed', () => {
  it('surfaces the runtime error a down runtime reported', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          runtime: 'ollama',
          displayName: 'Ollama',
          endpoint: 'http://127.0.0.1:11434',
          state: 'OLLAMA_NOT_RUNNING',
          label: 'Ollama not running',
          tone: 'warn',
          message: 'Nothing is listening on the Ollama address.',
          modelCount: 0,
          models: [],
          error: 'NOT_RUNNING',
        }),
      ),
    ) as unknown as typeof fetch;

    const status = await fetchLocalRuntimeStatus(AGENT, 'ollama', undefined, { fetchFn });
    expect(status?.state).toBe('OLLAMA_NOT_RUNNING');
    expect(status?.error).toBe('NOT_RUNNING');
  });
});

describe('streamLocalGeneration — every boundary is distinguishable', () => {
  it('preserves a terminal runtime error chunk as OLLAMA_UNAVAILABLE', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(
        ndjsonResponse([
          '{"content":"","done":true,"error":"NOT_RUNNING","message":"Ollama is not running."}',
        ]),
      ),
    ) as unknown as typeof fetch;

    const result = await streamLocalGeneration(AGENT, [{ role: 'user', content: 'hi' }], {
      fetchFn,
    });
    expect(result.ok).toBe(false);
    expect(result.failure?.code).toBe('OLLAMA_UNAVAILABLE');
    expect(result.message).toBe('Ollama is not running.');
    expect(result.text).toBe('');
  });

  it('maps a terminal MODEL_UNAVAILABLE chunk onto MODEL_NOT_FOUND', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(
        ndjsonResponse([
          '{"content":"","done":true,"error":"MODEL_UNAVAILABLE","message":"Ollama does not have the model ghost."}',
        ]),
      ),
    ) as unknown as typeof fetch;

    const result = await streamLocalGeneration(AGENT, [{ role: 'user', content: 'hi' }], {
      modelId: 'ghost',
      fetchFn,
    });
    expect(result.ok).toBe(false);
    expect(result.failure?.code).toBe('MODEL_NOT_FOUND');
  });

  it('keeps the partial text but still reports a terminal generation failure', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(
        ndjsonResponse([
          '{"content":"hel","done":false}',
          '{"content":"","done":true,"error":"GENERATION_FAILED","message":"stream died"}',
        ]),
      ),
    ) as unknown as typeof fetch;

    const result = await streamLocalGeneration(AGENT, [{ role: 'user', content: 'hi' }], {
      fetchFn,
    });
    expect(result.ok).toBe(false);
    expect(result.failure?.code).toBe('GENERATION_FAILED');
    expect(result.text).toBe('hel');
  });

  it('classifies an unreachable agent as AGENT_UNAVAILABLE', async () => {
    const fetchFn = vi.fn(() =>
      Promise.reject(new TypeError('Failed to fetch')),
    ) as unknown as typeof fetch;

    const result = await streamLocalGeneration(AGENT, [{ role: 'user', content: 'hi' }], {
      fetchFn,
    });
    expect(result.ok).toBe(false);
    expect(result.failure?.code).toBe('AGENT_UNAVAILABLE');
  });

  it('classifies a 403 as a CORS/PNA rejection, not a generation failure', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(new Response('forbidden', { status: 403 })),
    ) as unknown as typeof fetch;

    const result = await streamLocalGeneration(AGENT, [{ role: 'user', content: 'hi' }], {
      fetchFn,
    });
    expect(result.ok).toBe(false);
    expect(result.failure?.code).toBe('CORS_PNA_FAILURE');
  });

  it('never reports a non-OK status as success', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(new Response('boom', { status: 500 })),
    ) as unknown as typeof fetch;

    const result = await streamLocalGeneration(AGENT, [{ role: 'user', content: 'hi' }], {
      fetchFn,
    });
    expect(result.ok).toBe(false);
    expect(result.failure).toBeDefined();
    expect(result.message).toContain('500');
  });

  it('reports a successful stream with no failure attached', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(ndjsonResponse(['{"content":"ok","done":true}'])),
    ) as unknown as typeof fetch;

    const result = await streamLocalGeneration(AGENT, [{ role: 'user', content: 'hi' }], {
      fetchFn,
    });
    expect(result.ok).toBe(true);
    expect(result.text).toBe('ok');
    expect(result.failure).toBeUndefined();
  });

  it('surfaces REAL runtime usage from the terminal chunk (and forwards it onChunk)', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(
        ndjsonResponse([
          '{"content":"hi","done":false}',
          '{"content":"","done":true,"usage":{"input":12,"output":5,"total":17}}',
        ]),
      ),
    ) as unknown as typeof fetch;

    const seen: Array<{ input: number; output: number; total: number }> = [];
    const result = await streamLocalGeneration(AGENT, [{ role: 'user', content: 'hi' }], {
      fetchFn,
      onChunk: (chunk) => {
        if (chunk.usage) seen.push(chunk.usage);
      },
    });
    expect(result.ok).toBe(true);
    expect(result.usage).toEqual({ input: 12, output: 5, total: 17 });
    expect(seen).toEqual([{ input: 12, output: 5, total: 17 }]);
  });

  it('does NOT attach usage when the runtime reported none', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(ndjsonResponse(['{"content":"ok","done":true}'])),
    ) as unknown as typeof fetch;
    const result = await streamLocalGeneration(AGENT, [{ role: 'user', content: 'hi' }], {
      fetchFn,
    });
    expect(result.ok).toBe(true);
    expect(result.usage).toBeUndefined();
  });

  it('carries the selected model id on the wire', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(ndjsonResponse(['{"content":"ok","done":true}'])),
    ) as unknown as typeof fetch;

    await streamLocalGeneration(AGENT, [{ role: 'user', content: 'hi' }], {
      modelId: 'qwen2.5-coder:3b',
      fetchFn,
    });

    const init = fetchFn.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(init?.body))).toEqual({
      messages: [{ role: 'user', content: 'hi' }],
      modelId: 'qwen2.5-coder:3b',
    });
  });
});
