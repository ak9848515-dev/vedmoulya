// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local Workspace — Node filesystem implementation
//
// THE ONLY FILE IN THIS PACKAGE THAT MAY IMPORT `node:fs` / `node:path` /
// `node:os`. It implements the narrow read-only port. There is no write, delete,
// rename, watch, spawn or shell capability here.
//
// Windows hidden detection uses the FILE_ATTRIBUTE_HIDDEN bit via `fs.stat`'s
// numeric mode is not portable, so hidden is reported from the leading-dot
// convention only — deterministic on every platform, and the ignored-name
// policy already excludes dot-files from listings.
//
// LINT NOTE — `security/detect-non-literal-fs-filename` is disabled for THIS
// FILE ONLY. The rule fires on any `node:fs` call whose path argument is not a
// string literal, which is precisely this adapter's job: it is the single
// translation layer between the jail-checked path from `WorkspacePathResolver`
// and the real disk. Every path reaching these calls has already been proven
// contained inside an explicitly user-authorized root (see `path-resolver.ts`:
// absolute/UNC/drive-relative/`..`/NUL are refused, every component is lstat'd
// and symlinks are refused, and the target's realpath must stay inside the
// root's realpath). The heuristic cannot see that upstream proof, so it would
// otherwise flag every correct line. The rule stays enabled in every other file.
// ─────────────────────────────────────────────────────────────────────────────
/* eslint-disable security/detect-non-literal-fs-filename -- see LINT NOTE above */

import { readdir, lstat, realpath, open } from 'node:fs/promises';
import type { Stats } from 'node:fs';
import * as os from 'node:os';
import * as nodePath from 'node:path';
import type {
  WorkspaceDirEntry,
  WorkspaceFileStat,
  WorkspaceFileSystem,
  WorkspaceHost,
} from './filesystem.js';

/** Read the real host facts the containment policy needs. */
export function nodeHostFacts(
  env: Record<string, string | undefined> = process.env,
): WorkspaceHost {
  return {
    platform: process.platform,
    homedir: os.homedir(),
    separator: nodePath.sep,
    env,
  };
}

function kindOf(stats: Stats): WorkspaceFileStat['kind'] {
  if (stats.isSymbolicLink()) return 'symlink';
  if (stats.isDirectory()) return 'directory';
  if (stats.isFile()) return 'file';
  return 'other';
}

export class NodeWorkspaceFileSystem implements WorkspaceFileSystem {
  async lstat(path: string): Promise<WorkspaceFileStat | null> {
    try {
      const stats = await lstat(path);
      return {
        kind: kindOf(stats),
        sizeBytes: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        hidden: nodePath.basename(path).startsWith('.'),
      };
    } catch {
      return null;
    }
  }

  async realpath(path: string): Promise<string | null> {
    try {
      return await realpath(path);
    } catch {
      return null;
    }
  }

  async readdir(path: string): Promise<WorkspaceDirEntry[] | null> {
    try {
      const entries = await readdir(path, { withFileTypes: true });
      const mapped: WorkspaceDirEntry[] = [];
      for (const entry of entries) {
        const isSymlink = entry.isSymbolicLink();
        const kind: WorkspaceDirEntry['kind'] = isSymlink
          ? 'symlink'
          : entry.isDirectory()
            ? 'directory'
            : entry.isFile()
              ? 'file'
              : 'other';
        let sizeBytes: number | undefined;
        let modifiedAt: string | undefined;
        // Size/time need a stat; only do it for real files (bounded cost).
        if (kind === 'file') {
          try {
            const stats = await lstat(nodePath.join(path, entry.name));
            sizeBytes = stats.size;
            modifiedAt = stats.mtime.toISOString();
          } catch {
            // Metadata is optional — the entry itself is still reported.
          }
        }
        mapped.push({
          name: entry.name,
          kind,
          ...(sizeBytes !== undefined ? { sizeBytes } : {}),
          ...(modifiedAt !== undefined ? { modifiedAt } : {}),
        });
      }
      return mapped;
    } catch {
      return null;
    }
  }

  async readPrefix(path: string, maxBytes: number): Promise<Uint8Array | null> {
    let handle;
    try {
      handle = await open(path, 'r');
      const buffer = new Uint8Array(maxBytes);
      const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
      return buffer.subarray(0, bytesRead);
    } catch {
      return null;
    } finally {
      await handle?.close().catch(() => undefined);
    }
  }
}
