// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local Workspace — filesystem boundary (interface)
//
// ALL filesystem access flows through this interface so the security logic
// (containment, symlink refusal, limits) can be tested WITHOUT touching the real
// disk. Exactly one implementation — `NodeWorkspaceFileSystem` — may import
// `node:fs` / `node:path`; everything else depends on this port.
//
// The port is deliberately narrow and read-only: there is no write, delete,
// rename, watch, spawn or shell method — and there never will be in Phase 2.
// ─────────────────────────────────────────────────────────────────────────────

/** lstat facts about one path. A symlink is REPORTED, never followed. */
export interface WorkspaceFileStat {
  kind: 'file' | 'directory' | 'symlink' | 'other';
  sizeBytes: number;
  modifiedAt: string;
  hidden: boolean;
}

/** One directory entry, produced from a single `readdir(withFileTypes)`. */
export interface WorkspaceDirEntry {
  name: string;
  kind: 'file' | 'directory' | 'symlink' | 'other';
  sizeBytes?: number;
  modifiedAt?: string;
}

/** Host facts the containment policy needs, injected for testability. */
export interface WorkspaceHost {
  /** `process.platform` in production; `'win32'` etc. in tests. */
  platform: string;
  /** The user's home directory (a DENIED root). */
  homedir: string;
  /** `path.sep` — used for the containment comparison. */
  separator: string;
  /** Environment, for Windows-denied roots (SystemRoot / windir / ProgramFiles). */
  env: Record<string, string | undefined>;
}

export interface WorkspaceFileSystem {
  /** lstat a path — NEVER follows a symlink. `null` when absent/unreadable. */
  lstat(path: string): Promise<WorkspaceFileStat | null>;
  /** realpath a path — resolves symlinks/junctions. `null` when unavailable. */
  realpath(path: string): Promise<string | null>;
  /** Read one directory level. `null` when it cannot be read. */
  readdir(path: string): Promise<WorkspaceDirEntry[] | null>;
  /** Read at most `maxBytes` from the start of a file. `null` when unreadable. */
  readPrefix(path: string, maxBytes: number): Promise<Uint8Array | null>;
}
