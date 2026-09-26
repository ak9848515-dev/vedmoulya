import { describe, expect, it } from 'vitest';
import { WorkspacePathResolver } from '../path-resolver.js';
import { WorkspaceReader, type WorkspaceTarget } from '../reader.js';
import { DEFAULT_WORKSPACE_LIMITS } from '../types.js';
import { FakeWorkspaceFileSystem } from './fake-fs.js';

function makeTarget(
  build: (fs: FakeWorkspaceFileSystem) => void,
  limitOverrides: Partial<typeof DEFAULT_WORKSPACE_LIMITS> = {},
): { fs: FakeWorkspaceFileSystem; reader: WorkspaceReader; target: WorkspaceTarget } {
  const fs = new FakeWorkspaceFileSystem();
  fs.addDirectory('/ws');
  build(fs);
  const resolver = new WorkspacePathResolver(fs, { separator: '/', caseInsensitive: false });
  const reader = new WorkspaceReader(fs, resolver);
  const target: WorkspaceTarget = {
    id: 'ws-1',
    root: '/ws',
    rootReal: '/ws',
    limits: { ...DEFAULT_WORKSPACE_LIMITS, ...limitOverrides },
  };
  return { fs, reader, target };
}

describe('WorkspaceReader.list', () => {
  it('lists one level with sizes and kinds', async () => {
    const { reader, target } = makeTarget((fs) => {
      fs.addDirectory('/ws/src');
      fs.addFile('/ws/README.md', 'hello');
    });
    const result = await reader.list(target);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.workspaceId).toBe('ws-1');
      expect(result.value.entries.map((entry) => entry.name).sort()).toEqual(['README.md', 'src']);
      const readme = result.value.entries.find((entry) => entry.name === 'README.md');
      expect(readme?.sizeBytes).toBe(5);
    }
  });

  it('ignores dotfiles and build/vendor directories, counting them', async () => {
    const { reader, target } = makeTarget((fs) => {
      fs.addFile('/ws/.env', 'SECRET=1');
      fs.addDirectory('/ws/node_modules');
      fs.addFile('/ws/node_modules/pkg.js', 'x');
      fs.addDirectory('/ws/dist');
      fs.addFile('/ws/index.ts', 'export {};');
    });
    const result = await reader.list(target);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries.map((entry) => entry.name)).toEqual(['index.ts']);
      expect(result.value.ignoredCount).toBe(3);
    }
  });

  it('caps entries and reports truncation', async () => {
    const { reader, target } = makeTarget(
      (fs) => {
        for (let index = 0; index < 10; index += 1) {
          fs.addFile(`/ws/file-${index}.txt`, 'x');
        }
      },
      { maxListEntries: 4 },
    );
    const result = await reader.list(target);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries).toHaveLength(4);
      expect(result.value.truncated).toBe(true);
    }
  });

  it('recurses up to the requested depth and clamps to maxDepth', async () => {
    const { reader, target } = makeTarget(
      (fs) => {
        fs.addDirectory('/ws/a');
        fs.addDirectory('/ws/a/b');
        fs.addFile('/ws/a/b/deep.txt', 'x');
      },
      { maxDepth: 2 },
    );
    const shallow = await reader.list(target, { depth: 1 });
    expect(shallow.ok && shallow.value.entries.map((entry) => entry.path)).toEqual(['a']);

    const deep = await reader.list(target, { depth: 8 });
    expect(deep.ok).toBe(true);
    if (deep.ok) {
      expect(deep.value.entries.map((entry) => entry.path)).toContain('a/b');
      expect(deep.value.depthLimited).toBe(true);
    }
  });

  it('reports a symlink entry but never traverses it', async () => {
    const { reader, target } = makeTarget((fs) => {
      fs.addSymlink('/ws/link', '/outside');
    });
    const result = await reader.list(target);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries).toHaveLength(1);
      expect(result.value.entries[0]?.kind).toBe('symlink');
    }
  });

  it('rejects a listing on a file path', async () => {
    const { reader, target } = makeTarget((fs) => fs.addFile('/ws/file.txt', 'x'));
    const result = await reader.list(target, { path: 'file.txt' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_IS_NOT_DIRECTORY');
  });

  it('rejects invalid bounds', async () => {
    const { reader, target } = makeTarget(() => undefined);
    expect((await reader.list(target, { depth: 0 })).ok).toBe(false);
    expect((await reader.list(target, { max: -1 })).ok).toBe(false);
  });
});

describe('WorkspaceReader.read', () => {
  it('reads UTF-8 text', async () => {
    const { reader, target } = makeTarget((fs) => fs.addFile('/ws/a.txt', 'hello world'));
    const result = await reader.read(target, { path: 'a.txt' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.encoding).toBe('utf8');
      expect(result.value.content).toBe('hello world');
      expect(result.value.truncated).toBe(false);
    }
  });

  it('truncates at the byte budget and flags it', async () => {
    const { reader, target } = makeTarget((fs) => fs.addFile('/ws/big.txt', 'abcdefghij'));
    const result = await reader.read(target, { path: 'big.txt', maxBytes: 4 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.content).toBe('abcd');
      expect(result.value.truncated).toBe(true);
    }
  });

  it('returns metadata only for a binary extension', async () => {
    const { reader, target } = makeTarget((fs) =>
      fs.addFile('/ws/image.png', new Uint8Array([1, 2, 3, 4])),
    );
    const result = await reader.read(target, { path: 'image.png' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.encoding).toBe('binary');
      expect(result.value.content).toBeUndefined();
      expect(result.value.contentOmittedReason).toBe('binary');
      expect(result.value.bytes).toBe(4);
    }
  });

  it('detects a NUL byte even without a binary extension', async () => {
    const { reader, target } = makeTarget((fs) =>
      fs.addFile('/ws/data.txt', new Uint8Array([65, 0, 66])),
    );
    const result = await reader.read(target, { path: 'data.txt' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.encoding).toBe('binary');
  });

  it('treats invalid UTF-8 as binary', async () => {
    const { reader, target } = makeTarget((fs) =>
      fs.addFile('/ws/bad.txt', new Uint8Array([0xff, 0xfe, 0x41])),
    );
    const result = await reader.read(target, { path: 'bad.txt' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.encoding).toBe('binary');
  });

  it('reports a directory as PATH_IS_NOT_DIRECTORY', async () => {
    const { reader, target } = makeTarget((fs) => fs.addDirectory('/ws/sub'));
    const result = await reader.read(target, { path: 'sub' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_IS_NOT_DIRECTORY');
  });

  it('refuses to read a symlink', async () => {
    const { reader, target } = makeTarget((fs) => fs.addSymlink('/ws/link.txt', '/etc/passwd'));
    const result = await reader.read(target, { path: 'link.txt' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_NOT_ALLOWED');
  });

  it('reports a missing file as PATH_NOT_FOUND', async () => {
    const { reader, target } = makeTarget(() => undefined);
    const result = await reader.read(target, { path: 'missing.txt' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_NOT_FOUND');
  });

  it('rejects an empty path and a bad byte budget', async () => {
    const { reader, target } = makeTarget((fs) => fs.addFile('/ws/a.txt', 'x'));
    expect((await reader.read(target, { path: '' })).ok).toBe(false);
    expect((await reader.read(target, { path: 'a.txt', maxBytes: 0 })).ok).toBe(false);
  });
});
