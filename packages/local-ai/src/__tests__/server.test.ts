import { describe, it, expect, afterEach } from 'vitest';
import { LocalAgent } from '../agent/agent.js';
import { LocalRuntimeRegistry } from '../registry.js';
import { startLocalAgentServer, type StartedLocalAgent } from '../agent/server.js';
import { OllamaRuntimeAdapter } from '../adapters/ollama-runtime.js';

const TAGS = {
  models: [
    {
      name: 'qwen2.5-coder:7b-instruct',
      model: 'qwen2.5-coder:7b-instruct',
      size: 4_683_087_561,
      details: { family: 'qwen2', quantization_level: 'Q4_K_M' },
      capabilities: ['completion', 'tools'],
    },
  ],
};

function fakeFetch(): typeof fetch {
  return ((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith('/api/version')) {
      return Promise.resolve(new Response(JSON.stringify({ version: '0.34.4' }), { status: 200 }));
    }
    if (url.endsWith('/api/tags')) {
      return Promise.resolve(new Response(JSON.stringify(TAGS), { status: 200 }));
    }
    return Promise.resolve(
      new Response(JSON.stringify({ message: { content: 'ok' } }), { status: 200 }),
    );
  }) as unknown as typeof fetch;
}

let started: StartedLocalAgent | undefined;

async function start(agent: LocalAgent): Promise<StartedLocalAgent> {
  started = await startLocalAgentServer({
    agent,
    port: 0,
    allowedOrigins: ['http://localhost:3000'],
  });
  return started;
}

afterEach(async () => {
  if (started !== undefined) {
    await started.close();
    started = undefined;
  }
});

function agent(): LocalAgent {
  const registry = new LocalRuntimeRegistry().register(
    new OllamaRuntimeAdapter({ fetchFn: fakeFetch() }),
  );
  return new LocalAgent({ registry });
}

describe('Local Agent HTTP server', () => {
  it('answers health on a real loopback socket', async () => {
    const server = await start(agent());
    const response = await fetch(`${server.url}/health`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; runtimes: string[] };
    expect(body.status).toBe('RUNNING');
    expect(body.runtimes).toEqual(['ollama']);
  });

  it('lists the registered runtimes with capabilities', async () => {
    const server = await start(agent());
    const body = (await (await fetch(`${server.url}/runtimes`)).json()) as {
      runtimes: Array<{ id: string; capabilities: { streaming: boolean } }>;
    };
    expect(body.runtimes[0]?.id).toBe('ollama');
    expect(body.runtimes[0]?.capabilities.streaming).toBe(true);
  });

  it('returns the derived status and the real models', async () => {
    const server = await start(agent());
    const status = (await (await fetch(`${server.url}/runtimes/ollama/status`)).json()) as {
      state: string;
      models: unknown[];
    };
    expect(status.state).toBe('OLLAMA_MODELS_FOUND');
    const models = (await (await fetch(`${server.url}/runtimes/ollama/models`)).json()) as {
      models: unknown[];
    };
    expect(models.models).toHaveLength(1);
  });

  it('verifies end to end through the agent and reports checks', async () => {
    const server = await start(agent());
    const response = await fetch(`${server.url}/runtimes/ollama/verify`, { method: 'POST' });
    const body = (await response.json()) as {
      connected: boolean;
      state: string;
      checks: Array<{ ok: boolean }>;
    };
    expect(body.connected).toBe(true);
    expect(body.state).toBe('OLLAMA_CONNECTED');
    expect(body.checks.every((check) => check.ok)).toBe(true);
  });

  it('generates through the agent', async () => {
    const server = await start(agent());
    const response = await fetch(`${server.url}/runtimes/ollama/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });
    const body = (await response.json()) as { ok: boolean; content: string };
    expect(body.ok).toBe(true);
    expect(body.content).toBe('ok');
  });

  it('rejects an invalid generation body and an unknown runtime honestly', async () => {
    const server = await start(agent());
    const bad = await fetch(`${server.url}/runtimes/ollama/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: 'nope' }),
    });
    expect(bad.status).toBe(400);

    const unknown = await fetch(`${server.url}/runtimes/vllm/status`);
    expect(unknown.status).toBe(404);

    const missing = await fetch(`${server.url}/nope`);
    expect(missing.status).toBe(404);
  });

  it('answers CORS preflight for an allowed origin and omits it for an unknown one', async () => {
    const server = await start(agent());
    const allowed = await fetch(`${server.url}/health`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:3000' },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');

    const denied = await fetch(`${server.url}/health`, {
      headers: { Origin: 'https://evil.example' },
    });
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
  });
});
