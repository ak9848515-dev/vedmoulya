import { describe, expect, it } from 'vitest';
import type { WorkspaceDirEntry, WorkspaceFileSystem } from '../filesystem.js';
import { LocalWorkspaceService } from '../service.js';
import { FakeWorkspaceFileSystem } from './fake-fs.js';

const HOST = { platform: 'linux', homedir: '/home/user', separator: '/', env: {} };

function service(
  build: (fs: FakeWorkspaceFileSystem) => void,
  limits: Record<string, number> = {},
): { service: LocalWorkspaceService; fs: FakeWorkspaceFileSystem } {
  const fs = new FakeWorkspaceFileSystem();
  fs.addDirectory('/');
  fs.addDirectory('/home/user');
  fs.addDirectory('/ws');
  build(fs);
  return {
    fs,
    service: new LocalWorkspaceService({
      filesystem: fs,
      host: HOST,
      limits,
      now: () => new Date('2024-05-05T00:00:00.000Z'),
      randomId: () => 'ws-1',
    }),
  };
}

describe('LocalWorkspaceService', () => {
  it('reports read-only capabilities and limits', () => {
    const { service: svc } = service(() => undefined);
    expect(svc.capabilities()).toEqual({ list: true, read: true, write: false, exec: false });
    expect(svc.limitsSnapshot().maxFileBytes).toBe(1_048_576);
  });

  it('authorizes a root and returns a path-free summary', async () => {
    const { service: svc } = service((fs) => fs.addFile('/ws/README.md', 'hi'));
    const result = await svc.authorize('/ws');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('ws-1');
      expect(result.value.label).toBe('ws');
      expect(JSON.stringify(result.value)).not.toContain('/ws/');
      expect(JSON.stringify(result.value)).not.toContain('"/ws"');
      expect(result.value.capabilities.write).toBe(false);
    }
    expect(svc.list()).toHaveLength(1);
  });

  it('lists and reads through the service', async () => {
    const { service: svc } = service((fs) => fs.addFile('/ws/README.md', 'hello'));
    const authorized = await svc.authorize('/ws');
    expect(authorized.ok).toBe(true);
    if (!authorized.ok) return;

    const entries = await svc.entries(authorized.value.id);
    expect(entries.ok).toBe(true);

    const read = await svc.readFile(authorized.value.id, { path: 'README.md' });
    expect(read.ok && read.value.content).toBe('hello');

    const context = await svc.context(authorized.value.id);
    expect(context.ok).toBe(true);
  });

  it('rejects an unknown workspace honestly', async () => {
    const { service: svc } = service(() => undefined);
    const result = await svc.entries('does-not-exist');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('WORKSPACE_NOT_AUTHORIZED');
  });

  it('revokes a workspace and reports the revocation afterwards', async () => {
    const { service: svc } = service(() => undefined);
    const authorized = await svc.authorize('/ws');
    expect(authorized.ok).toBe(true);
    if (!authorized.ok) return;

    const revoked = svc.revoke(authorized.value.id);
    expect(revoked.ok).toBe(true);
    expect(svc.list()).toHaveLength(0);

    const after = await svc.readFile(authorized.value.id, { path: 'a.txt' });
    expect(after.ok).toBe(false);
    if (!after.ok) expect(after.error.kind).toBe('WORKSPACE_REVOKED');

    const again = svc.revoke(authorized.value.id);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.kind).toBe('WORKSPACE_REVOKED');
  });

  it('rejects an invalid id and an invalid revoke', () => {
    const { service: svc } = service(() => undefined);
    expect(svc.get('').ok).toBe(false);
    expect(svc.revoke(undefined).ok).toBe(false);
  });

  it('times out a slow operation without throwing', async () => {
    const fs = new FakeWorkspaceFileSystem();
    fs.addDirectory('/');
    fs.addDirectory('/home/user');
    fs.addDirectory('/ws');
    const hanging: WorkspaceFileSystem = {
      lstat: (path) => fs.lstat(path),
      realpath: (path) => fs.realpath(path),
      readdir: (): Promise<WorkspaceDirEntry[] | null> => new Promise(() => undefined),
      readPrefix: (path, maxBytes) => fs.readPrefix(path, maxBytes),
    };
    const svc = new LocalWorkspaceService({
      filesystem: hanging,
      host: HOST,
      limits: { timeoutMs: 20 },
      randomId: () => 'ws-1',
    });
    const authorized = await svc.authorize('/ws');
    expect(authorized.ok).toBe(true);
    if (!authorized.ok) return;
    const result = await svc.entries(authorized.value.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('LIMIT_EXCEEDED');
  });
});
