// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local Workspace — domain types
// PHASE 2 — User-Authorized Local Workspace Foundation
//
// WHAT THIS IS
//   A workspace is an EXPLICITLY user-authorized, READ-ONLY local directory the
//   Local Agent may list and read. It is a SEPARATE capability from the runtime
//   capability (Ollama / LM Studio):
//
//     Browser → Local Agent ─┬─ Runtime capability   → LocalRuntime → Ollama
//                            └─ Workspace capability → @vedmoulya/local-workspace
//
//   Runtime and workspace never depend on each other. This package owns ALL
//   filesystem access; runtime adapters must never import it.
//
// HONESTY RULES
//   • Every operation is TOTAL: it returns a `WorkspaceResult`, never throws
//     across the domain boundary.
//   • Errors carry a typed `kind` and a RELATIVE `path` — never an absolute
//     filesystem path and never raw OS error text.
//   • Nothing here writes, renames, deletes, executes or watches files.
//   • There is no default workspace and `process.cwd()` is never a workspace.
// ─────────────────────────────────────────────────────────────────────────────

/** An opaque, randomly generated workspace handle. Never derived from the path. */
export type WorkspaceId = string;

/** What a workspace may do. Phase 2 is read-only by construction. */
export interface WorkspaceCapabilities {
  list: boolean;
  read: boolean;
  write: boolean;
  exec: boolean;
}

/** The fixed Phase 2 capabilities — write/exec are structurally absent. */
export const WORKSPACE_CAPABILITIES: WorkspaceCapabilities = {
  list: true,
  read: true,
  write: false,
  exec: false,
};

/** The bounded resource budget of a workspace operation. */
export interface WorkspaceLimits {
  maxFileBytes: number;
  maxListEntries: number;
  maxDepth: number;
  maxContextFiles: number;
  maxContextBytes: number;
  timeoutMs: number;
}

/** Default limits applied to an authorized workspace. */
export const DEFAULT_WORKSPACE_LIMITS: WorkspaceLimits = {
  maxFileBytes: 1_048_576,
  maxListEntries: 500,
  maxDepth: 4,
  maxContextFiles: 20,
  maxContextBytes: 1_048_576,
  timeoutMs: 10_000,
};

/** Hard caps a caller can never exceed, whatever it asks for. */
export const HARD_WORKSPACE_LIMITS = {
  maxFileBytes: 8_388_608,
  maxListEntries: 2_000,
  maxDepth: 8,
} as const;

/** The public, path-free description of an authorized workspace. */
export interface WorkspaceSummary {
  id: WorkspaceId;
  label: string;
  /** An abbreviated, human-friendly path — NEVER the full absolute root. */
  displayPath: string;
  authorizedAt: string;
  capabilities: WorkspaceCapabilities;
  limits: WorkspaceLimits;
}

export type WorkspaceEntryKind = 'file' | 'directory' | 'symlink' | 'other';

export interface WorkspaceEntry {
  name: string;
  /** Workspace-relative path using `/` separators. Never absolute. */
  path: string;
  kind: WorkspaceEntryKind;
  sizeBytes?: number;
  modifiedAt?: string;
  hidden: boolean;
}

export interface WorkspaceListing {
  workspaceId: WorkspaceId;
  /** Workspace-relative directory path ('' means the workspace root). */
  path: string;
  entries: WorkspaceEntry[];
  truncated: boolean;
  ignoredCount: number;
  depthLimited: boolean;
}

export type FileEncoding = 'utf8' | 'binary';

export interface WorkspaceFileContent {
  workspaceId: WorkspaceId;
  /** Workspace-relative file path. */
  path: string;
  /** Bytes actually returned (for text) or the file size (for binary). */
  bytes: number;
  truncated: boolean;
  encoding: FileEncoding;
  /** Present only for `utf8`. */
  content?: string;
  /** Present only when content is omitted, e.g. `binary`. */
  contentOmittedReason?: string;
}

export interface WorkspaceContextFile {
  /** Workspace-relative path. */
  path: string;
  bytes: number;
  excerpt: string;
  truncated: boolean;
}

export interface WorkspaceContext {
  workspaceId: WorkspaceId;
  label: string;
  generatedAt: string;
  files: WorkspaceContextFile[];
  omittedCount: number;
  notes: string[];
}

/** The typed failure vocabulary. Every value is a distinct, actionable state. */
export type WorkspaceErrorKind =
  | 'INVALID_REQUEST'
  | 'WORKSPACE_NOT_AUTHORIZED'
  | 'WORKSPACE_REVOKED'
  | 'WORKSPACE_ROOT_UNAVAILABLE'
  | 'PATH_NOT_ALLOWED'
  | 'PATH_NOT_FOUND'
  | 'PATH_IS_NOT_DIRECTORY'
  | 'FILE_TOO_LARGE'
  | 'BINARY_FILE'
  | 'LIMIT_EXCEEDED'
  | 'IO_ERROR';

export interface WorkspaceError {
  kind: WorkspaceErrorKind;
  message: string;
  /** A workspace-RELATIVE path only — absolute paths are never included. */
  path?: string;
}

/** Every workspace operation returns this — success or a typed failure. */
export type WorkspaceResult<T> = { ok: true; value: T } | { ok: false; error: WorkspaceError };

/** Client-facing options; roots are never accepted on a read. */
export interface WorkspaceListOptions {
  /** Workspace-relative directory path. Empty/omitted means the root. */
  path?: string;
  /** 1 = a single directory level; higher values recurse (bounded by limits). */
  depth?: number;
  max?: number;
}

export interface WorkspaceReadOptions {
  path: string;
  /** Requested byte budget; clamped to the workspace/hard limit. */
  maxBytes?: number;
}

export interface WorkspaceContextOptions {
  /** Explicit workspace-relative files/directories to prioritize. */
  focus?: string[];
  /** Optional max number of files (clamped by the workspace limit). */
  maxFiles?: number;
}
