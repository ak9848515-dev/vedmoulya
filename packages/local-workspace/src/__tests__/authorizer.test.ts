import { describe, expect, it } from 'vitest';
import { displayPathForRoot, labelForRoot, WorkspaceAuthorizer } from '../authorizer.js';
import type { WorkspaceHost } from '../filesystem.js';
import { FakeWorkspaceFileSystem } from './fake-fs.js';

function host(overrides: Partial<WorkspaceHost> = {}): WorkspaceHost {
  return {
    platform: 'linux',
    homedir: '/home/user',
    separator: '/',
    env: {},
    ...overrides,
  };
}

function build(
  setup: (fs: FakeWorkspaceFileSystem) => void,
  options: {
    host?: Partial<WorkspaceHost>;
    allowedRoots?: readonly string[];
    deniedRoots?: readonly string[];
  } = {},
): WorkspaceAuthorizer {
  const fs = new FakeWorkspaceFileSystem({ caseInsensitive: false });
  fs.addDirectory('/');
  fs.addDirectory('/home/user');
  setup(fs);
  return new WorkspaceAuthorizer({
    filesystem: fs,
    host: host(options.host),
    ...(options.allowedRoots !== undefined ? { allowedRoots: options.allowedRoots } : {}),
    ...(options.deniedRoots !== undefined ? { deniedRoots: options.deniedRoots } : {}),
  });
}

describe('WorkspaceAuthorizer', () => {
  it('authorizes an ordinary project directory', async () => {
    const authorizer = build((fs) => fs.addDirectory('/tmp/project'));
    const result = await authorizer.authorizeRoot('/tmp/project');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.rootReal).toBe('/tmp/project');
  });

  it.each([
    ['/', 'filesystem root'],
    ['/home/user', 'the user home directory'],
    ['/etc', 'a system directory'],
    ['/usr', 'a system directory'],
  ])('refuses %s (%s)', async (root) => {
    const authorizer = build((fs) => {
      fs.addDirectory('/etc');
      fs.addDirectory('/usr');
    });
    const result = await authorizer.authorizeRoot(root);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_NOT_ALLOWED');
  });

  it('refuses the Windows system root and Program Files', async () => {
    const fs = new FakeWorkspaceFileSystem({ caseInsensitive: true });
    fs.addDirectory('C:/');
    fs.addDirectory('C:/Windows');
    fs.addDirectory('C:/Program Files');
    const authorizer = new WorkspaceAuthorizer({
      filesystem: fs,
      host: host({
        platform: 'win32',
        separator: '\\',
        homedir: 'C:/Users/user',
        env: { SystemRoot: 'C:\\Windows', ProgramFiles: 'C:\\Program Files' },
      }),
    });
    expect((await authorizer.authorizeRoot('C:\\Windows')).ok).toBe(false);
    expect((await authorizer.authorizeRoot('C:\\Program Files')).ok).toBe(false);
  });

  it('refuses a missing root and a non-directory root', async () => {
    const authorizer = build((fs) => fs.addFile('/tmp/file.txt', 'x'));
    const missing = await authorizer.authorizeRoot('/tmp/missing');
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.kind).toBe('WORKSPACE_ROOT_UNAVAILABLE');

    const file = await authorizer.authorizeRoot('/tmp/file.txt');
    expect(file.ok).toBe(false);
    if (!file.ok) expect(file.error.kind).toBe('WORKSPACE_ROOT_UNAVAILABLE');
  });

  it('refuses a relative root and a blank root', async () => {
    const authorizer = build(() => undefined);
    expect((await authorizer.authorizeRoot('relative/path')).ok).toBe(false);
    expect((await authorizer.authorizeRoot('   ')).ok).toBe(false);
    expect((await authorizer.authorizeRoot(undefined)).ok).toBe(false);
    expect((await authorizer.authorizeRoot(42)).ok).toBe(false);
  });

  it('enforces VEDMOULYA_WORKSPACE_ROOTS when configured', async () => {
    const authorizer = build(
      (fs) => {
        fs.addDirectory('/allowed');
        fs.addDirectory('/allowed/app');
        fs.addDirectory('/tmp/project');
      },
      { allowedRoots: ['/allowed'] },
    );
    expect((await authorizer.authorizeRoot('/allowed/app')).ok).toBe(true);
    const outside = await authorizer.authorizeRoot('/tmp/project');
    expect(outside.ok).toBe(false);
    if (!outside.ok) expect(outside.error.kind).toBe('PATH_NOT_ALLOWED');
  });

  it('honors extra denied roots', async () => {
    const authorizer = build((fs) => fs.addDirectory('/tmp/project'), {
      deniedRoots: ['/tmp/project'],
    });
    expect((await authorizer.authorizeRoot('/tmp/project')).ok).toBe(false);
  });

  it('derives a label and a home-relative display path', () => {
    expect(labelForRoot('/home/user/projects/app')).toBe('app');
    expect(displayPathForRoot('/home/user/projects/app', '/home/user', false)).toBe(
      '~/projects/app',
    );
    expect(displayPathForRoot('/opt/data/app', '/home/user', false)).toContain('app');
    expect(displayPathForRoot('/opt/data/app', '/home/user', false).startsWith('/')).toBe(false);
  });
});
