// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Bridge: Node Artifact Reader
// SPRINT-024 — REAL RUNTIME ARTIFACT VERIFICATION (Phase 1)
//
// The production implementation of ArtifactReaderPort over the real
// filesystem. HARD constraints:
//   - confined to an approved execution boundary root (absolute paths
//     and `..` traversal denied),
//   - symlink escape is denied (realpath containment check),
//   - reads are SIZE-BOUNDED (maxBytes cap),
//   - read-only — never executes commands, never mutates state,
//   - returns honest UNKNOWN (found-but-unreadable) vs definitive
//     FAIL (not found) so evidence is never fabricated.
// ──────────────────────────────────────────────────────────────────

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type {
  ArtifactExistence,
  ArtifactReaderPort,
  ArtifactReadResult,
} from '../contracts/artifact-ports.js';

/* eslint-disable security/detect-non-literal-fs-filename -- Heuristic rule
   false-positive: every fs call below targets `resolved`, which is derived by
   path.resolve(this.root, relativePath) AFTER isSafeRelative() rejected
   absolute / drive / `..` / backslash paths and isInside() verified the
   resolved target stays within the approved boundary root. The non-literal
   argument is therefore the boundary itself, never untrusted input. */

const DEFAULT_MAX_BYTES = 1024 * 1024; // 1 MiB bounded read

/** Reject absolute paths, drive letters, backslashes and `..` segments. */
function isSafeRelative(relativePath: string): boolean {
  if (typeof relativePath !== 'string' || relativePath.trim().length === 0) return false;
  if (path.isAbsolute(relativePath)) return false;
  if (/^[a-zA-Z]:/.test(relativePath)) return false;
  if (relativePath.includes('\\')) return false;
  const normalized = relativePath.replace(/\\/g, '/');
  const segments = normalized.split('/').filter((s) => s.length > 0 && s !== '.');
  return segments.length > 0 && segments.every((s) => s !== '..' && !s.includes('\0'));
}

function isInside(resolved: string, root: string): boolean {
  const rel = path.relative(root, resolved);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export class NodeArtifactReader implements ArtifactReaderPort {
  readonly root: string;
  readonly maxBytes: number;

  constructor(root: string, maxBytes: number = DEFAULT_MAX_BYTES) {
    this.root = path.resolve(root);
    this.maxBytes = maxBytes;
  }

  async read(relativePath: string): Promise<ArtifactReadResult> {
    if (!isSafeRelative(relativePath)) {
      return { found: false, denied: true, error: 'Unsafe path (absolute / traversal / drive).' };
    }
    const resolved = path.resolve(this.root, relativePath);
    if (!isInside(resolved, this.root)) {
      return { found: false, denied: true, error: 'Path outside the approved boundary.' };
    }

    try {
      const stat = await fs.stat(resolved); // follows symlinks
      if (!stat.isFile()) {
        return { found: false, error: 'Not a regular file.' };
      }
      // Symlink escape guard: the FINAL target must stay inside the root.
      const realTarget = await fs.realpath(resolved);
      if (!isInside(realTarget, this.root)) {
        return {
          found: false,
          denied: true,
          error: 'Symlink escapes the approved boundary (denied).',
        };
      }
      if (stat.size > this.maxBytes) {
        return {
          found: true,
          byteLength: stat.size,
          content: undefined,
          error: `Artifact exceeds the ${this.maxBytes}-byte read bound.`,
        };
      }
      const content = await fs.readFile(resolved, 'utf8');
      return { found: true, content, byteLength: Buffer.byteLength(content, 'utf8') };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        return { found: false, error: 'Not found.' };
      }
      // Found-but-unreadable (permission / I-O / race) → UNKNOWN evidence.
      return {
        found: true,
        content: undefined,
        error: 'Artifact present but evidence unavailable.',
      };
    }
  }

  async exists(relativePath: string): Promise<ArtifactExistence> {
    if (!isSafeRelative(relativePath)) {
      return { found: false, denied: true };
    }
    const resolved = path.resolve(this.root, relativePath);
    if (!isInside(resolved, this.root)) {
      return { found: false, denied: true };
    }
    try {
      const stat = await fs.stat(resolved);
      if (!stat.isFile()) return { found: false };
      const realTarget = await fs.realpath(resolved);
      if (!isInside(realTarget, this.root)) {
        return { found: false, denied: true };
      }
      return { found: true };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') return { found: false };
      return { found: false, denied: true };
    }
  }
}
