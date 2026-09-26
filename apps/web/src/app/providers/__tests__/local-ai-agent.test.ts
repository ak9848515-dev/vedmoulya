// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Local Agent browser client tests
//
// Proves the client NEVER throws, classifies an absent agent honestly, and
// transports the agent's resolved state without re-deriving it.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import {
  checkLocalAgent,
  DEFAULT_LOCAL_AGENT_URL,
  fetchLocalRuntimeStatus,
  verifyLocalRuntime,
  LOCAL_AGENT_URL_CANDIDATES,
} from '../local-ai-agent.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const HEALTH = {
  status: 'RUNNING',
  version: '1.0.0',
  startedAt: '2026-01-01T00:00:00.000Z',
  runtimes: ['ollama'],
};

describe('checkLocalAgent', () => {
  it('reports the agent reachable when /health answers as the agent', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(jsonResponse(HEALTH))) as unknown as typeof fetch;
    const result = await checkLocalAgent({ fetchFn });
    expect(result.reachable).toBe(true);
    expect(result.url).toBe(DEFAULT_LOCAL_AGENT_URL);
    expect(result.health?.runtimes).toEqual(['ollama']);
  });

  it('reports not reachable when nothing is listening (never throws)', async () => {
    const fetchFn = vi.fn(() =>
      Promise.reject(new Error('ECONNREFUSED')),
    ) as unknown as typeof fetch;
    const result = await checkLocalAgent({ fetchFn });
    expect(result.reachable).toBe(false);
    expect(result.message).toMatch(/not running/i);
  });

  it('rejects a response that is not the agent', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(jsonResponse({ hello: 'world' })),
    ) as unknown as typeof fetch;
    const result = await checkLocalAgent({ fetchFn });
    expect(result.reachable).toBe(false);
  });

  it('probes the candidate list in order', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(jsonResponse(HEALTH))) as unknown as typeof fetch;
    await checkLocalAgent({ fetchFn });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(String(fetchFn.mock.calls[0]?.[0])).toContain(LOCAL_AGENT_URL_CANDIDATES[0] ?? '');
  });
});

describe('fetchLocalRuntimeStatus', () => {
  it('parses a resolved status and never throws on failure', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          runtime: 'ollama',
          displayName: 'Ollama',
          endpoint: 'http://127.0.0.1:11434',
          state: 'OLLAMA_MODELS_FOUND',
          label: 'Models found',
          tone: 'ok',
          message: 'Ollama reported 1 model.',
          modelCount: 1,
          models: [{ id: 'qwen2.5-coder:7b-instruct', name: 'qwen2.5-coder:7b-instruct' }],
          selectedModelId: 'qwen2.5-coder:7b-instruct',
        }),
      ),
    ) as unknown as typeof fetch;

    const status = await fetchLocalRuntimeStatus(DEFAULT_LOCAL_AGENT_URL, 'ollama', undefined, {
      fetchFn,
    });
    expect(status?.state).toBe('OLLAMA_MODELS_FOUND');
    expect(status?.models[0]?.id).toBe('qwen2.5-coder:7b-instruct');

    const failing = vi.fn(() => Promise.reject(new Error('down'))) as unknown as typeof fetch;
    expect(
      await fetchLocalRuntimeStatus(DEFAULT_LOCAL_AGENT_URL, 'ollama', undefined, {
        fetchFn: failing,
      }),
    ).toBeNull();
  });
});

describe('verifyLocalRuntime', () => {
  it('transports the agent CONNECTED verdict and its checks', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          runtime: 'ollama',
          displayName: 'Ollama',
          endpoint: 'http://127.0.0.1:11434',
          state: 'OLLAMA_CONNECTED',
          label: 'Connected',
          tone: 'ok',
          message: 'Ollama answered on qwen2.5-coder:7b-instruct.',
          modelCount: 1,
          models: [],
          selectedModelId: 'qwen2.5-coder:7b-instruct',
          connected: true,
          checks: [{ key: 'generation', label: 'Real generation succeeded', ok: true }],
        }),
      ),
    ) as unknown as typeof fetch;

    const report = await verifyLocalRuntime(DEFAULT_LOCAL_AGENT_URL, 'ollama', undefined, {
      fetchFn,
    });
    expect(report?.connected).toBe(true);
    expect(report?.checks[0]?.ok).toBe(true);
  });

  it('returns null instead of throwing when the agent is gone', async () => {
    const fetchFn = vi.fn(() => Promise.reject(new Error('down'))) as unknown as typeof fetch;
    expect(
      await verifyLocalRuntime(DEFAULT_LOCAL_AGENT_URL, 'ollama', undefined, { fetchFn }),
    ).toBeNull();
  });
});
