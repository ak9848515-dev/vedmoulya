import { afterEach, describe, expect, it } from 'vitest';
import { LocalAgent } from '../agent/agent.js';
import { LocalRuntimeRegistry } from '../registry.js';
import { startLocalAgentServer, type StartedLocalAgent } from '../agent/server.js';
import { OllamaRuntimeAdapter } from '../adapters/ollama-runtime.js';
import { LocalWorkspaceService } from '@vedmoulya/local-workspace';
import { FakeWorkspaceFileSystem } from '../../../local-workspace/src/__tests__/fake-fs.js';

const TAGS = {
  models: [{ name: 'qwen2.5-coder:7b', model: 'qwen2.5-coder:7b', capabilities: [] }],
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

function agent(): LocalAgent {
  const registry = new LocalRuntimeRegistry().register(
    new OllamaRuntimeAdapter({ fetchFn: fakeFetch() }),
  );
  return new LocalAgent({ registry });
}

function workspace(): LocalWorkspaceService {
  const fs = new FakeWorkspaceFileSystem();
  fs.addDirectory('/ws');
  fs.addFile('/ws/README.md', '# hi');
  fs.addDirectory('/ws/src');
  fs.addFile('/ws/src/index.ts', 'export {};');
  return new LocalWorkspaceService({
    filesystem: fs,
    host: { platform: 'linux', homedir: '/home/u', separator: '/', env: {} },
    randomId: () => 'ws-1',
  });
}

let started: StartedLocalAgent | undefined;

async function start(withWorkspace: boolean): Promise<StartedLocalAgent> {
  started = await startLocalAgentServer({
    agent: agent(),
    ...(withWorkspace ? { workspace: workspace() } : {}),
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

async function authorize(server: StartedLocalAgent): Promise<string> {
  const response = await fetch(`${server.url}/workspaces`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ root: '/ws' }),
  });
  const body = (await response.json()) as { workspace: { id: string } };
  return body.workspace.id;
}

describe('Local Agent — workspace capability', () => {
  it('advertises the workspace capability additively in health', async () => {
    const withWs = (await (await fetch(`${(await start(true)).url}/health`)).json()) as {
      status: string;
      capabilities: string[];
    };
    expect(withWs.status).toBe('RUNNING');
    expect(withWs.capabilities).toEqual(['runtime', 'workspace']);

    const withoutWs = (await (await fetch(`${(await start(false)).url}/health`)).json()) as {
      capabilities: string[];
    };
    expect(withoutWs.capabilities).toEqual(['runtime']);
  });

  it('reports capabilities and limits', async () => {
    const server = await start(true);
    const body = (await (await fetch(`${server.url}/workspaces/capabilities`)).json()) as {
      available: boolean;
      capabilities: { write: boolean; exec: boolean };
    };
    expect(body.available).toBe(true);
    expect(body.capabilities.write).toBe(false);
    expect(body.capabilities.exec).toBe(false);
  });

  it('reports unavailable when no workspace capability is configured', async () => {
    const server = await start(false);
    const caps = (await (await fetch(`${server.url}/workspaces/capabilities`)).json()) as {
      available: boolean;
    };
    expect(caps.available).toBe(false);
    const list = await fetch(`${server.url}/workspaces`);
    expect(list.status).toBe(503);
  });

  it('authorizes, lists, reads and assembles context over HTTP', async () => {
    const server = await start(true);
    const id = await authorize(server);

    const listBody = (await (await fetch(`${server.url}/workspaces`)).json()) as {
      workspaces: Array<{ id: string; label: string }>;
    };
    expect(listBody.workspaces[0]?.id).toBe(id);
    expect(listBody.workspaces[0]?.label).toBe('ws');

    const one = await fetch(`${server.url}/workspaces/${id}`);
    expect(one.status).toBe(200);

    const entries = (await (
      await fetch(`${server.url}/workspaces/${id}/entries?depth=1`)
    ).json()) as { entries: Array<{ path: string }> };
    expect(entries.entries.map((entry) => entry.path)).toContain('README.md');

    const file = (await (
      await fetch(`${server.url}/workspaces/${id}/file?path=README.md`)
    ).json()) as { content: string; encoding: string };
    expect(file.encoding).toBe('utf8');
    expect(file.content).toBe('# hi');

    const context = (await (
      await fetch(`${server.url}/workspaces/${id}/context`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ focus: ['src/index.ts'] }),
      })
    ).json()) as { files: Array<{ path: string }> };
    expect(context.files.map((entry) => entry.path)).toContain('src/index.ts');
  });

  it('never leaks an absolute path in a workspace response', async () => {
    const server = await start(true);
    const id = await authorize(server);
    const raw = await (await fetch(`${server.url}/workspaces/${id}`)).text();
    expect(raw).not.toContain('"/ws"');
    expect(raw).not.toContain('/ws/');
    const entriesRaw = await (await fetch(`${server.url}/workspaces/${id}/entries`)).text();
    expect(entriesRaw).not.toContain('"/ws"');
  });

  it('revokes a workspace and reports the revocation', async () => {
    const server = await start(true);
    const id = await authorize(server);
    const revoked = await fetch(`${server.url}/workspaces/${id}`, { method: 'DELETE' });
    expect(revoked.status).toBe(200);

    const after = await fetch(`${server.url}/workspaces/${id}/entries`);
    expect(after.status).toBe(404);
    const body = (await after.json()) as { error: { kind: string } };
    expect(body.error.kind).toBe('WORKSPACE_REVOKED');
  });

  it('rejects traversal, unknown workspaces, malformed bodies and unknown routes', async () => {
    const server = await start(true);
    const id = await authorize(server);

    const traversal = await fetch(`${server.url}/workspaces/${id}/file?path=../../etc/passwd`);
    expect(traversal.status).toBe(403);
    const traversalBody = (await traversal.json()) as { error: { kind: string } };
    expect(traversalBody.error.kind).toBe('PATH_NOT_ALLOWED');

    const unknown = await fetch(`${server.url}/workspaces/nope/entries`);
    expect(unknown.status).toBe(404);

    const malformed = await fetch(`${server.url}/workspaces`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nope: true }),
    });
    expect(malformed.status).toBe(400);

    const notFound = await fetch(`${server.url}/workspaces/${id}/nope`);
    expect(notFound.status).toBe(404);

    const missing = await fetch(`${server.url}/workspaces/${id}/file?path=missing.txt`);
    expect(missing.status).toBe(404);
  });

  it('answers CORS preflight for an allowed origin and omits it for an unknown one', async () => {
    const server = await start(true);
    const allowed = await fetch(`${server.url}/workspaces`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:3000' },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');

    const denied = await fetch(`${server.url}/workspaces`, {
      headers: { Origin: 'https://evil.example' },
    });
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('leaves runtime routes working independently of the workspace', async () => {
    const server = await start(true);
    const status = (await (await fetch(`${server.url}/runtimes/ollama/status`)).json()) as {
      state: string;
    };
    expect(status.state).toBe('OLLAMA_MODELS_FOUND');
  });
});
