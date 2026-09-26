import { describe, expect, it } from 'vitest';
import { WorkspacePathResolver, isContained } from '../path-resolver.js';
import { FakeWorkspaceFileSystem } from './fake-fs.js';

const ROOT = '/ws';
const ROOT_REAL = '/ws';

function setup(
  build: (fs: FakeWorkspaceFileSystem) => void,
  options: { separator?: string; caseInsensitive?: boolean } = {},
): { fs: FakeWorkspaceFileSystem; resolver: WorkspacePathResolver } {
  const fs = new FakeWorkspaceFileSystem();
  fs.addDirectory('/ws');
  fs.addDirectory('/etc');
  fs.addFile('/etc/secret.txt', 'top secret');
  fs.addDirectory('/other');
  fs.addFile('/other/outside.txt', 'outside');
  build(fs);
  const resolver = new WorkspacePathResolver(fs, {
    separator: options.separator ?? '/',
    caseInsensitive: options.caseInsensitive ?? false,
  });
  return { fs, resolver };
}

describe('WorkspacePathResolver — containment', () => {
  it('resolves a normal relative file inside the root', async () => {
    const { resolver } = setup((fs) => {
      fs.addDirectory('/ws/src');
      fs.addFile('/ws/src/index.ts', 'export {};');
    });
    const result = await resolver.resolveInside(ROOT, ROOT_REAL, 'src/index.ts', {
      expect: 'file',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.relative).toBe('src/index.ts');
      expect(result.value.absolute).toBe('/ws/src/index.ts');
    }
  });

  it('treats an empty/undefined path as the workspace root', async () => {
    const { resolver } = setup(() => undefined);
    const result = await resolver.resolveInside(ROOT, ROOT_REAL, undefined, {
      expect: 'directory',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.relative).toBe('');
  });

  it.each([
    ['../etc/secret.txt', 'parent traversal'],
    ['src/../../etc/secret.txt', 'nested traversal'],
    ['..', 'bare parent'],
    ['/etc/passwd', 'absolute posix'],
    ['\\\\server\\share\\x', 'UNC path'],
    ['//server/share/x', 'UNC path (slashes)'],
    ['C:\\Windows\\System32', 'windows absolute'],
    ['C:/Windows', 'windows absolute (slashes)'],
    ['C:foo', 'windows drive-relative'],
    ['src/..\\..\\etc', 'mixed separators'],
  ])('rejects %s (%s)', async (path) => {
    const { resolver } = setup((fs) => {
      fs.addDirectory('/ws/src');
    });
    const result = await resolver.resolveInside(ROOT, ROOT_REAL, path, { expect: 'any' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_NOT_ALLOWED');
  });

  it('rejects NUL bytes in a path', async () => {
    const { resolver } = setup(() => undefined);
    const result = await resolver.resolveInside(ROOT, ROOT_REAL, 'a\0b', { expect: 'any' });
    expect(result.ok).toBe(false);
  });

  it('refuses a symlink component (never traversed)', async () => {
    const { resolver } = setup((fs) => {
      fs.addSymlink('/ws/link', '/etc');
    });
    const result = await resolver.resolveInside(ROOT, ROOT_REAL, 'link/secret.txt', {
      expect: 'file',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_NOT_ALLOWED');
  });

  it('refuses a symlink leaf itself', async () => {
    const { resolver } = setup((fs) => {
      fs.addFile('/ws/real.txt', 'ok');
      fs.addSymlink('/ws/fake.txt', '/other/outside.txt');
    });
    const result = await resolver.resolveInside(ROOT, ROOT_REAL, 'fake.txt', { expect: 'file' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_NOT_ALLOWED');
  });

  it('fails closed when realpath escapes the root', async () => {
    const { resolver } = setup((fs) => {
      fs.addFile('/ws/data.txt', 'ok');
    });
    // Simulate a root whose realpath differs and does not contain the target.
    const result = await resolver.resolveInside('/ws', '/somewhere-else', 'data.txt', {
      expect: 'file',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_NOT_ALLOWED');
  });

  it('reports a missing path as PATH_NOT_FOUND', async () => {
    const { resolver } = setup(() => undefined);
    const result = await resolver.resolveInside(ROOT, ROOT_REAL, 'nope.txt', { expect: 'file' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_NOT_FOUND');
  });

  it('reports a directory read as PATH_IS_NOT_DIRECTORY', async () => {
    const { resolver } = setup((fs) => {
      fs.addFile('/ws/file.txt', 'x');
    });
    const result = await resolver.resolveInside(ROOT, ROOT_REAL, 'file.txt', {
      expect: 'directory',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_IS_NOT_DIRECTORY');
  });

  it('rejects trailing dot/space segments on a case-insensitive host', async () => {
    const fs = new FakeWorkspaceFileSystem({ caseInsensitive: true });
    fs.addDirectory('/ws');
    const resolver = new WorkspacePathResolver(fs, {
      separator: '\\',
      caseInsensitive: true,
    });
    const result = await resolver.resolveInside('/ws', '/ws', 'src/.. ', { expect: 'any' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_NOT_ALLOWED');
  });

  it('compares containment case-insensitively when asked', () => {
    expect(isContained('/WS/Src/A.ts', '/ws', true)).toBe(true);
    expect(isContained('/WS/Src/A.ts', '/ws', false)).toBe(false);
  });

  it('never exposes OS filesystem error text', async () => {
    const { resolver } = setup(() => undefined);
    const result = await resolver.resolveInside(ROOT, ROOT_REAL, '../etc', { expect: 'any' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).not.toMatch(/ENOENT|EPERM|EACCES|\\/);
    }
  });
});
