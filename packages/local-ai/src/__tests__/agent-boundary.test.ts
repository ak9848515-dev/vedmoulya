// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local AI — Local Agent HTTP boundary tests (production origins)
//
// The agent is called from a PUBLIC HTTPS page on the user's machine, which the
// browser gates twice: the CORS allow-list AND Chrome's Private Network Access.
// These tests pin the exact production contract — including that the streaming
// endpoint forwards a typed failure instead of an empty, "successful" stream.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, afterEach } from 'vitest';
import { LocalAgent } from '../agent/agent.js';
import { LocalRuntimeRegistry } from '../registry.js';
import {
  DEFAULT_ALLOWED_ORIGINS,
  startLocalAgentServer,
  type StartedLocalAgent,
} from '../agent/server.js';
import type {
  LocalGenerateChunk,
  LocalGenerateRequest,
  LocalModelDescriptor,
  LocalRuntime,
  LocalRuntimeId,
} from '../types.js';

let started: StartedLocalAgent | undefined;

afterEach(async () => {
  if (started !== undefined) {
    await started.close();
    started = undefined;
  }
});

/** A runtime whose endpoint answers nothing — the "Ollama is not running" case. */
function downRuntime(): LocalRuntime {
  const id: LocalRuntimeId = 'ollama';
  return {
    id,
    displayName: 'Ollama',
    capabilities: () => ({
      modelDiscovery: true,
      generation: true,
      streaming: true,
      getModel: true,
    }),
    discover: () =>
      Promise.resolve({
        runtime: id,
        endpoint: 'http://127.0.0.1:11434',
        present: false,
        error: 'NOT_RUNNING' as const,
        message: 'Nothing is listening on the Ollama address.',
      }),
    health: () =>
      Promise.resolve({
        runtime: id,
        endpoint: 'http://127.0.0.1:11434',
        reachable: false,
        healthy: false,
        latencyMs: 1,
        error: 'NOT_RUNNING' as const,
        message: 'down',
      }),
    listModels: () =>
      Promise.resolve({
        runtime: id,
        endpoint: 'http://127.0.0.1:11434',
        ok: false,
        models: [],
        error: 'NOT_RUNNING' as const,
        message: 'down',
      }),
    getModel: () => Promise.resolve(null),
    generate: () =>
      Promise.resolve({
        runtime: id,
        ok: false,
        modelId: '',
        content: '',
        latencyMs: 0,
        error: 'NOT_RUNNING' as const,
        message: 'down',
      }),
    // Mirrors the real adapters: an unstartable stream reports a TERMINAL chunk.
    stream: async function* (): AsyncGenerator<LocalGenerateChunk> {
      yield { content: '', done: true, error: 'NOT_RUNNING', message: 'Ollama is not running.' };
    },
  };
}

/** A healthy runtime with one model. */
function upRuntime(): LocalRuntime {
  const declared: LocalModelDescriptor[] = [
    {
      id: 'qwen2.5-coder:3b',
      name: 'qwen2.5-coder:3b',
      runtime: 'ollama',
      capabilities: ['completion'],
      capabilitiesProvenance: 'MEASURED',
    },
  ];
  return {
    id: 'ollama',
    displayName: 'Ollama',
    capabilities: () => ({
      modelDiscovery: true,
      generation: true,
      streaming: true,
      getModel: true,
    }),
    discover: () =>
      Promise.resolve({
        runtime: 'ollama',
        endpoint: 'http://127.0.0.1:11434',
        present: true,
        version: '0.34.4',
        message: 'ok',
      }),
    health: () =>
      Promise.resolve({
        runtime: 'ollama',
        endpoint: 'http://127.0.0.1:11434',
        reachable: true,
        healthy: true,
        latencyMs: 1,
        message: 'ok',
      }),
    listModels: () =>
      Promise.resolve({
        runtime: 'ollama',
        endpoint: 'http://127.0.0.1:11434',
        ok: true,
        models: declared,
        message: 'listing',
      }),
    getModel: (modelId: string) => Promise.resolve(declared.find((m) => m.id === modelId) ?? null),
    generate: (request: LocalGenerateRequest) =>
      Promise.resolve({
        runtime: 'ollama',
        ok: true,
        modelId: request.modelId ?? '',
        content: 'ok',
        latencyMs: 5,
        message: 'answered',
      }),
    stream: async function* (request: LocalGenerateRequest): AsyncGenerator<LocalGenerateChunk> {
      yield { content: `echo:${request.modelId ?? ''}`, done: true };
    },
  };
}

async function start(runtime: LocalRuntime): Promise<StartedLocalAgent> {
  const agent = new LocalAgent({
    registry: new LocalRuntimeRegistry().register(runtime),
  });
  started = await startLocalAgentServer({ agent, port: 0 });
  return started;
}

describe('Local Agent — production origin (https://app.vedmoulya.com)', () => {
  it('lists the canonical production origin in the default allow-list', () => {
    expect(DEFAULT_ALLOWED_ORIGINS).toContain('https://app.vedmoulya.com');
    expect(DEFAULT_ALLOWED_ORIGINS).toContain('https://vedmoulya-web.vercel.app');
  });

  it('answers a simple GET for the production origin with its CORS header', async () => {
    const server = await start(upRuntime());
    const response = await fetch(`${server.url}/health`, {
      headers: { Origin: 'https://app.vedmoulya.com' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.vedmoulya.com');
    expect(response.headers.get('vary')).toBe('Origin');
  });

  it('grants the private-network header to the production origin on preflight', async () => {
    const server = await start(upRuntime());
    const response = await fetch(`${server.url}/runtimes/ollama/status`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://app.vedmoulya.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Private-Network': 'true',
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.vedmoulya.com');
    expect(response.headers.get('access-control-allow-private-network')).toBe('true');
  });

  it('answers a real generation for the production origin', async () => {
    const server = await start(upRuntime());
    const response = await fetch(`${server.url}/runtimes/ollama/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Origin: 'https://app.vedmoulya.com' },
      body: JSON.stringify({
        modelId: 'qwen2.5-coder:3b',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.vedmoulya.com');
  });

  it.each([
    'https://app.vedmoulya.com',
    'https://vedmoulya-web.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ])('allows the approved origin %s', async (origin) => {
    const server = await start(upRuntime());
    const response = await fetch(`${server.url}/health`, { headers: { Origin: origin } });
    expect(response.headers.get('access-control-allow-origin')).toBe(origin);
  });

  it.each([
    'https://unknown-origin.example',
    'https://evil.example',
    'http://localhost:9999',
    'https://app.vedmoulya.com.evil.example',
  ])('rejects the unknown origin %s (no CORS header at all)', async (origin) => {
    const server = await start(upRuntime());
    const response = await fetch(`${server.url}/health`, { headers: { Origin: origin } });
    expect(response.headers.get('access-control-allow-origin')).toBeNull();

    // And the preflight must not leak private-network access either.
    const preflight = await fetch(`${server.url}/health`, {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Private-Network': 'true' },
    });
    expect(preflight.headers.get('access-control-allow-private-network')).toBeNull();
    expect(preflight.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('omits CORS headers entirely for a request with no Origin', async () => {
    const server = await start(upRuntime());
    const response = await fetch(`${server.url}/health`);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('Local Agent — availability states over HTTP', () => {
  it('reports the agent RUNNING while the runtime is down, as separate facts', async () => {
    const server = await start(downRuntime());

    const health = (await (await fetch(`${server.url}/health`)).json()) as { status: string };
    expect(health.status).toBe('RUNNING');

    const status = (await (await fetch(`${server.url}/runtimes/ollama/status`)).json()) as {
      state: string;
      modelCount: number;
    };
    // The agent answered; the RUNTIME did not. These are never merged.
    expect(status.state).not.toBe('OLLAMA_CONNECTED');
    expect(status.modelCount).toBe(0);
  });

  it('does not report CONNECTED on verify when the runtime is down', async () => {
    const server = await start(downRuntime());
    const body = (await (
      await fetch(`${server.url}/runtimes/ollama/verify`, { method: 'POST' })
    ).json()) as { connected: boolean; state: string };
    expect(body.connected).toBe(false);
    expect(body.state).not.toBe('OLLAMA_CONNECTED');
  });

  it('carries the requested model through the verify endpoint', async () => {
    const server = await start(upRuntime());
    const body = (await (
      await fetch(`${server.url}/runtimes/ollama/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ modelId: 'qwen2.5-coder:3b' }),
      })
    ).json()) as { selectedModelId?: string; connected: boolean };
    expect(body.selectedModelId).toBe('qwen2.5-coder:3b');
    expect(body.connected).toBe(true);
  });
});

describe('Local Agent — streamed generation over HTTP', () => {
  it('forwards a typed terminal error chunk when the runtime is down', async () => {
    const server = await start(downRuntime());
    const response = await fetch(`${server.url}/runtimes/ollama/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    expect(response.status).toBe(200);
    const lines = (await response.text())
      .trim()
      .split('\n')
      .filter((line) => line !== '');
    expect(lines).toHaveLength(1);
    const chunk = JSON.parse(lines[0] ?? '{}') as { error?: string; done: boolean };
    // The browser can now distinguish "runtime down" from "model produced nothing".
    expect(chunk.error).toBe('NOT_RUNNING');
    expect(chunk.done).toBe(true);
  });

  it('streams real content for a healthy runtime and uses the requested model', async () => {
    const server = await start(upRuntime());
    const response = await fetch(`${server.url}/runtimes/ollama/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        modelId: 'qwen2.5-coder:3b',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    const text = await response.text();
    const chunk = JSON.parse(text.trim().split('\n')[0] ?? '{}') as {
      content?: string;
      error?: string;
    };
    expect(chunk.error).toBeUndefined();
    // Proves the SELECTED model reached the runtime's stream, not a default.
    expect(chunk.content).toBe('echo:qwen2.5-coder:3b');
  });

  it('rejects a malformed generation body with 400', async () => {
    const server = await start(upRuntime());
    const response = await fetch(`${server.url}/runtimes/ollama/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'nope', content: 5 }] }),
    });
    expect(response.status).toBe(400);
  });

  it('returns 404 for an unknown runtime', async () => {
    const server = await start(upRuntime());
    const response = await fetch(`${server.url}/runtimes/vllm/status`);
    expect(response.status).toBe(404);
  });
});
