// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local Workspace — result + error helpers
//
// One tiny place builds the total `WorkspaceResult` shape so every component
// reports failures identically. Messages are intentionally generic: raw OS
// error text and absolute paths never leave this package.
// ─────────────────────────────────────────────────────────────────────────────

import type { WorkspaceError, WorkspaceErrorKind, WorkspaceResult } from './types.js';

/** A successful result. */
export function ok<T>(value: T): WorkspaceResult<T> {
  return { ok: true, value };
}

/** A typed failure. `path`, when present, is workspace-relative only. */
export function fail<T = never>(
  kind: WorkspaceErrorKind,
  message: string,
  path?: string,
): WorkspaceResult<T> {
  const error: WorkspaceError = { kind, message };
  if (path !== undefined) error.path = path;
  return { ok: false, error };
}

/** The default human-readable message for a kind (never OS text). */
export function defaultMessage(kind: WorkspaceErrorKind): string {
  switch (kind) {
    case 'INVALID_REQUEST':
      return 'The workspace request was malformed.';
    case 'WORKSPACE_NOT_AUTHORIZED':
      return 'That workspace is not authorized on this computer.';
    case 'WORKSPACE_REVOKED':
      return 'That workspace has been revoked.';
    case 'WORKSPACE_ROOT_UNAVAILABLE':
      return 'The authorized workspace folder is no longer available.';
    case 'PATH_NOT_ALLOWED':
      return 'That path is outside the authorized workspace.';
    case 'PATH_NOT_FOUND':
      return 'That path does not exist in the workspace.';
    case 'PATH_IS_NOT_DIRECTORY':
      return 'That path is not a directory.';
    case 'FILE_TOO_LARGE':
      return 'That file is larger than the workspace limit.';
    case 'BINARY_FILE':
      return 'That file is binary and its contents are not returned.';
    case 'LIMIT_EXCEEDED':
      return 'That workspace operation exceeded its limit.';
    case 'IO_ERROR':
      return 'The workspace could not be read.';
    default:
      return 'The workspace operation failed.';
  }
}
