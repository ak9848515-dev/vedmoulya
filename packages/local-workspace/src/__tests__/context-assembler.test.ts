import { describe, expect, it } from 'vitest';
import { WorkspaceContextAssembler } from '../context-assembler.js';
import { WorkspacePathResolver } from '../path-resolver.js';
import { WorkspaceReader, type WorkspaceTarget } from '../reader.js';
import { DEFAULT_WORKSPACE_LIMITS } from '../types.js';
import { FakeWorkspaceFileSystem } from './fake-fs.js';

function make(
  build: (fs: FakeWorkspaceFileSystem) => void,
  limitOverrides: Partial<typeof DEFAULT_WORKSPACE_LIMITS> = {},
): { assembler: WorkspaceContextAssembler; target: WorkspaceTarget } {
  const fs = new FakeWorkspaceFileSystem();
  fs.addDirectory('/ws');
  build(fs);
  const resolver = new WorkspacePathResolver(fs, { separator: '/', caseInsensitive: false });
  const reader = new WorkspaceReader(fs, resolver);
  const assembler = new WorkspaceContextAssembler({
    fs,
    resolver,
    reader,
    now: () => new Date('2024-05-05T00:00:00.000Z'),
  });
  return {
    assembler,
    target: {
      id: 'ws-1',
      root: '/ws',
      rootReal: '/ws',
      limits: { ...DEFAULT_WORKSPACE_LIMITS, ...limitOverrides },
    },
  };
}

describe('WorkspaceContextAssembler', () => {
  it('selects well-known files deterministically', async () => {
    const { assembler, target } = make((fs) => {
      fs.addFile('/ws/README.md', '# Project');
      fs.addFile('/ws/package.json', '{"name":"x"}');
      fs.addFile('/ws/random.txt', 'ignored');
    });
    const result = await assembler.assemble(target);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.files.map((file) => file.path)).toEqual(['README.md', 'package.json']);
      expect(result.value.workspaceId).toBe('ws-1');
      expect(result.value.generatedAt).toBe('2024-05-05T00:00:00.000Z');
      expect(result.value.notes.length).toBeGreaterThan(0);
    }
  });

  it('includes explicit focus paths', async () => {
    const { assembler, target } = make((fs) => {
      fs.addFile('/ws/README.md', '# Project');
      fs.addDirectory('/ws/src');
      fs.addFile('/ws/src/app.ts', 'export {};');
    });
    const result = await assembler.assemble(target, { focus: ['src/app.ts'] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.files.map((file) => file.path)).toContain('src/app.ts');
    }
  });

  it('respects the file-count cap', async () => {
    const { assembler, target } = make((fs) => {
      fs.addFile('/ws/README.md', '# a');
      fs.addFile('/ws/package.json', '{}');
      fs.addFile('/ws/go.mod', 'module x');
    });
    const result = await assembler.assemble(target, { maxFiles: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.files).toHaveLength(1);
      expect(result.value.omittedCount).toBeGreaterThan(0);
    }
  });

  it('omits binary candidates instead of returning bytes', async () => {
    const { assembler, target } = make((fs) => {
      fs.addFile('/ws/README.md', '# Project');
      fs.addFile('/ws/logo.png', new Uint8Array([1, 2, 3]));
    });
    const withBinary = await assembler.assemble(target, { focus: ['logo.png'] });
    expect(withBinary.ok).toBe(true);
    if (withBinary.ok) {
      expect(withBinary.value.files.map((file) => file.path)).not.toContain('logo.png');
    }
  });

  it('truncates excerpts to the per-file and context budget', async () => {
    const { assembler, target } = make((fs) => fs.addFile('/ws/README.md', 'x'.repeat(50_000)), {
      maxContextBytes: 20_000,
    });
    const result = await assembler.assemble(target);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.files[0]?.truncated).toBe(true);
      expect(result.value.files[0]?.excerpt.length ?? 0).toBeLessThan(50_000);
    }
  });
});
