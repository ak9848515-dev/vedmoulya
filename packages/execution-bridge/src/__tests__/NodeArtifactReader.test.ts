// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Bridge: NodeArtifactReader tests
// SPRINT-024 — real filesystem reader: root-confined, symlink-safe,
// size-bounded, honest UNKNOWN vs definitive FAIL.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { NodeArtifactReader } from '../infrastructure/NodeArtifactReader.js';

async function makeBoundary(): Promise<{
  dir: string;
  root: string;
  cleanup: () => Promise<void>;
}> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nar-test-'));
  const root = path.join(dir, 'approved');
  await fs.mkdir(root);
  return {
    dir,
    root,
    cleanup: () => fs.rm(dir, { recursive: true, force: true }),
  };
}

describe('NodeArtifactReader — path safety', () => {
  it('denies unsafe relative paths without touching the fs', async () => {
    const { root, cleanup } = await makeBoundary();
    try {
      const reader = new NodeArtifactReader(root);
      for (const p of [
        '',
        '   ',
        '/etc/passwd',
        'C:\\\\x',
        'a\\\\b',
        '../escape',
        'a/../../b',
        'a\\0b',
      ]) {
        const result = await reader.read(p);
        expect(result.denied).toBe(true);
        expect(result.found).toBe(false);
      }
    } finally {
      await cleanup();
    }
  });

  it('denies a resolved path outside the boundary even when the relative path is safe', async () => {
    const { dir, root, cleanup } = await makeBoundary();
    try {
      // Create a sibling dir and write a file; the root is NOT the parent.
      const sibling = path.join(dir, 'sibling');
      await fs.mkdir(sibling);
      await fs.writeFile(path.join(sibling, 'leak.txt'), 'secret', 'utf8');
      const reader = new NodeArtifactReader(root);
      const result = await reader.read('../sibling/leak.txt');
      expect(result.denied).toBe(true);
    } finally {
      await cleanup();
    }
  });
});

describe('NodeArtifactReader — reads, size bounds, symlinks, errors', () => {
  it('reads a real file and reports byte length', async () => {
    const { root, cleanup } = await makeBoundary();
    try {
      await fs.writeFile(path.join(root, 'a.json'), '{"ok":true}', 'utf8');
      const reader = new NodeArtifactReader(root);
      const result = await reader.read('a.json');
      expect(result.found).toBe(true);
      expect(result.content).toBe('{"ok":true}');
      expect(result.byteLength).toBe(11);
      expect(await reader.exists('a.json')).toEqual({ found: true });
    } finally {
      await cleanup();
    }
  });

  it('reports honest FAIL when the file is missing', async () => {
    const { root, cleanup } = await makeBoundary();
    try {
      const reader = new NodeArtifactReader(root);
      const result = await reader.read('missing.txt');
      expect(result.found).toBe(false);
      expect(result.error).toBe('Not found.');
      expect(await reader.exists('missing.txt')).toEqual({ found: false });
    } finally {
      await cleanup();
    }
  });

  it('reports a directory as not-a-file', async () => {
    const { root, cleanup } = await makeBoundary();
    try {
      await fs.mkdir(path.join(root, 'sub'));
      const reader = new NodeArtifactReader(root);
      const result = await reader.read('sub');
      expect(result.found).toBe(false);
      expect(result.error).toMatch(/not a regular file/i);
      expect(await reader.exists('sub')).toEqual({ found: false });
    } finally {
      await cleanup();
    }
  });

  it('denies a symlink that escapes the boundary', async () => {
    const { dir, root, cleanup } = await makeBoundary();
    try {
      await fs.writeFile(path.join(dir, 'outside.txt'), 'secret', 'utf8');
      const link = path.join(root, 'escape.txt');
      try {
        await fs.symlink(path.join(dir, 'outside.txt'), link);
      } catch {
        return; // symlinks unavailable on this platform — skip
      }
      const reader = new NodeArtifactReader(root);
      const read = await reader.read('escape.txt');
      expect(read.denied).toBe(true);
      expect(read.error).toMatch(/symlink/i);
      const exists = await reader.exists('escape.txt');
      expect(exists.denied).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it('allows a symlink that stays inside the boundary', async () => {
    const { root, cleanup } = await makeBoundary();
    try {
      await fs.writeFile(path.join(root, 'real.txt'), 'content', 'utf8');
      const link = path.join(root, 'alias.txt');
      try {
        await fs.symlink(path.join(root, 'real.txt'), link);
      } catch {
        return; // symlinks unavailable — skip
      }
      const reader = new NodeArtifactReader(root);
      const result = await reader.read('alias.txt');
      expect(result.found).toBe(true);
      expect(result.content).toBe('content');
    } finally {
      await cleanup();
    }
  });

  it('bounds the read size and returns honest found-but-unreadable', async () => {
    const { root, cleanup } = await makeBoundary();
    try {
      await fs.writeFile(path.join(root, 'big.txt'), 'x'.repeat(500), 'utf8');
      const reader = new NodeArtifactReader(root, 64);
      const result = await reader.read('big.txt');
      expect(result.found).toBe(true);
      expect(result.content).toBeUndefined();
      expect(result.error).toContain('bound');
      expect(result.byteLength).toBe(500);
    } finally {
      await cleanup();
    }
  });
});
