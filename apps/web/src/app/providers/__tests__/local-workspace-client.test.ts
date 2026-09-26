import { describe, expect, it, vi } from 'vitest';
import {
  assembleWorkspaceContext,
  authorizeWorkspace,
  fetchWorkspaceCapabilities,
  fetchWorkspaceEntries,
  fetchWorkspaces,
  readWorkspaceFile,
  revokeWorkspace,
} from '../local-workspace-client.js';

const AGENT = 'http://127.0.0.1:43117';

function jsonFetch(payload: unknown, status = 200): typeof fetch {
  return vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(payload), { status })),
  ) as unknown as typeof fetch;
}

describe('local-workspace-client', () => {
  it('reads workspace capabilities', async () => {
    const fetchFn = jsonFetch({
      available: true,
      capabilities: { list: true, read: true, write: false, exec: false },
    });
    const result = await fetchWorkspaceCapabilities(AGENT, { fetchFn });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.available).toBe(true);
      expect(result.value.capabilities.write).toBe(false);
    }
  });

  it('authorizes a folder and returns the summary', async () => {
    const fetchFn = jsonFetch({
      workspace: {
        id: 'ws-1',
        label: 'project',
        displayPath: '~/project',
        authorizedAt: '2024-01-01T00:00:00.000Z',
        capabilities: { list: true, read: true, write: false, exec: false },
        limits: {
          maxFileBytes: 1048576,
          maxListEntries: 500,
          maxDepth: 4,
          maxContextFiles: 20,
          maxContextBytes: 1048576,
          timeoutMs: 10000,
        },
      },
    });
    const result = await authorizeWorkspace(AGENT, '/home/me/project', { fetchFn });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.id).toBe('ws-1');
  });

  it('maps a refused folder to a typed error', async () => {
    const fetchFn = jsonFetch(
      { error: { kind: 'PATH_NOT_ALLOWED', message: 'That folder is too broad to authorize.' } },
      403,
    );
    const result = await authorizeWorkspace(AGENT, '/', { fetchFn });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_NOT_ALLOWED');
  });

  it('lists workspaces, entries, files and context', async () => {
    const workspaces = await fetchWorkspaces(AGENT, {
      fetchFn: jsonFetch({ workspaces: [{ id: 'ws-1' }] }),
    });
    expect(workspaces.ok && workspaces.value).toHaveLength(1);

    const entries = await fetchWorkspaceEntries(AGENT, 'ws-1', {
      depth: 2,
      fetchFn: jsonFetch({
        workspaceId: 'ws-1',
        path: '',
        entries: [{ name: 'src', path: 'src', kind: 'directory', hidden: false }],
        truncated: false,
        ignoredCount: 0,
        depthLimited: false,
      }),
    });
    expect(entries.ok).toBe(true);

    const file = await readWorkspaceFile(AGENT, 'ws-1', 'README.md', {
      fetchFn: jsonFetch({
        workspaceId: 'ws-1',
        path: 'README.md',
        bytes: 5,
        truncated: false,
        encoding: 'utf8',
        content: 'hello',
      }),
    });
    expect(file.ok && file.value.content).toBe('hello');

    const context = await assembleWorkspaceContext(AGENT, 'ws-1', {
      focus: ['src/index.ts'],
      fetchFn: jsonFetch({
        workspaceId: 'ws-1',
        label: 'ws-1',
        generatedAt: '2024-01-01T00:00:00.000Z',
        files: [],
        omittedCount: 0,
        notes: [],
      }),
    });
    expect(context.ok).toBe(true);
  });

  it('never throws when the agent is unreachable', async () => {
    const fetchFn = vi.fn(() => Promise.reject(new Error('down'))) as unknown as typeof fetch;
    const result = await fetchWorkspaceCapabilities(AGENT, { fetchFn });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('AGENT_UNAVAILABLE');
  });

  it('revokes a workspace', async () => {
    const result = await revokeWorkspace(AGENT, 'ws-1', {
      fetchFn: jsonFetch({ revoked: 'ws-1' }),
    });
    expect(result.ok && result.value).toBe('ws-1');
  });
});
