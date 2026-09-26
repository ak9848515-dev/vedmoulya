// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local Workspace — path containment resolver
//
// THE PATH JAIL. Order matters and is deliberate:
//   1. reject absolute paths, Windows drive-absolute (`C:\`), UNC (`\\host`),
//      drive-relative (`C:foo`), NUL bytes and ANY raw `..` segment
//   2. join the remaining segments onto the authorized root
//   3. re-assert containment (case-insensitive on Windows) — fail closed
//   4. lstat EVERY relative component and refuse any symlink/junction/reparse
//      point along the way (symlinks are never traversed)
//   5. realpath the target and require it to stay inside the realpath'd root,
//      which catches a symlinked INTERMEDIATE directory
//
// Any violation returns PATH_NOT_ALLOWED. OS error text is never surfaced.
// This module imports no filesystem primitives — only the injected port.
// ─────────────────────────────────────────────────────────────────────────────

import type { WorkspaceFileSystem } from './filesystem.js';
import { fail, ok } from './result.js';
import type { WorkspaceResult } from './types.js';

export interface ResolvedInside {
  /** Workspace-relative path with `/` separators (`''` for the root). */
  relative: string;
  /** The absolute filesystem path (never leaves this package). */
  absolute: string;
}

export interface WorkspacePathResolverOptions {
  /** `path.sep` of the host, e.g. `\\` on Windows. Defaults to `/`. */
  separator?: string;
  /** Compare containment case-insensitively (true on Windows). */
  caseInsensitive?: boolean;
  /**
   * Allow symlinked components (default FALSE — Phase 2 is fail-closed). Only a
   * test that needs to observe the realpath containment backstop turns this on.
   * Even when enabled, the realpath check still refuses any escape of the root.
   */
  allowSymlinks?: boolean;
}

/** Normalize a path string for comparison: `/` separators, optional lower-case. */
export function normalizeForCompare(value: string, caseInsensitive: boolean): string {
  const normalized = value.replace(/\\/g, '/');
  return caseInsensitive ? normalized.toLowerCase() : normalized;
}

/** True when `child` is `parent` itself or lies inside it (fail-closed). */
export function isContained(child: string, parent: string, caseInsensitive: boolean): boolean {
  const c = normalizeForCompare(child, caseInsensitive);
  const p = normalizeForCompare(parent, caseInsensitive);
  if (c === p) return true;
  // The filesystem root contains everything, so matching it by prefix would
  // deny every path. It only ever matches exactly (handled above).
  if (p === '/') return false;
  const prefix = p.endsWith('/') ? p : `${p}/`;
  return c.startsWith(prefix);
}

/** Reject anything that is not a safe, relative, forward path. */
export function rejectionForRawPath(raw: string, caseInsensitive: boolean): string | null {
  if (raw.includes('\0')) return 'The path is not valid.';
  // Absolute POSIX path.
  if (raw.startsWith('/')) return 'The path is not allowed.';
  // UNC path (`\\host\share`, `//host/share`).
  if (raw.startsWith('\\\\') || raw.startsWith('//')) return 'The path is not allowed.';
  // Windows drive-absolute (`C:\`, `C:/`).
  if (/^[a-zA-Z]:[\\/]/.test(raw)) return 'The path is not allowed.';
  // Windows drive-relative (`C:foo`) — resolved against a per-drive cwd.
  if (/^[a-zA-Z]:/.test(raw)) return 'The path is not allowed.';
  for (const segment of raw.split(/[\\/]/)) {
    if (segment === '..') return 'The path is not allowed.';
    if (caseInsensitive) {
      // Windows strips trailing dots/spaces at the API level, which could turn
      // `.. ` into `..`. Refuse such segments outright.
      if (segment.length > 0 && /[. ]$/.test(segment)) return 'The path is not allowed.';
    }
  }
  return null;
}

export class WorkspacePathResolver {
  private readonly fs: WorkspaceFileSystem;
  private readonly separator: string;
  private readonly caseInsensitive: boolean;
  private readonly allowSymlinks: boolean;

  constructor(fs: WorkspaceFileSystem, options: WorkspacePathResolverOptions = {}) {
    this.fs = fs;
    this.separator = options.separator ?? '/';
    this.caseInsensitive = options.caseInsensitive ?? false;
    this.allowSymlinks = options.allowSymlinks ?? false;
  }

  /** Split a raw path into clean segments, or return null when rejected. */
  private segmentsFor(raw: string): { segments: string[] } | { rejection: string } {
    const rejection = rejectionForRawPath(raw, this.caseInsensitive);
    if (rejection !== null) return { rejection };
    const segments = raw.split(/[\\/]/).filter((segment) => segment !== '' && segment !== '.');
    return { segments };
  }

  /**
   * The realpath of a path (used only when symlinks are explicitly allowed).
   * Falls back to the path itself when it cannot be resolved.
   */
  private async resolveLinkTarget(path: string): Promise<string> {
    return (await this.fs.realpath(path)) ?? path;
  }

  /**
   * Resolve a client-supplied relative path inside an authorized root and
   * prove it is contained. `root`/`rootReal` come from the grant, never from the
   * request. Symlinks are refused; the returned target is guaranteed inside.
   */
  async resolveInside(
    root: string,
    rootReal: string,
    rawPath: string | undefined,
    options: { expect?: 'file' | 'directory' | 'any' } = {},
  ): Promise<WorkspaceResult<ResolvedInside>> {
    const raw = rawPath ?? '';
    if (typeof raw !== 'string') return fail('INVALID_REQUEST', 'The path must be a string.');

    const split = this.segmentsFor(raw);
    if ('rejection' in split) return fail('PATH_NOT_ALLOWED', split.rejection);

    const { segments } = split;
    const relative = segments.join('/');
    const absolute = segments.length === 0 ? root : [root, ...segments].join(this.separator);

    // Re-assert containment on the constructed absolute path.
    if (!isContained(absolute, root, this.caseInsensitive)) {
      return fail('PATH_NOT_ALLOWED', 'The path is outside the authorized workspace.');
    }

    // Walk every relative component, refusing symlinks/junctions along the way.
    const expect = options.expect ?? 'any';
    for (let index = 0; index < segments.length; index += 1) {
      const prefix = [root, ...segments.slice(0, index + 1)].join(this.separator);
      const stat = await this.fs.lstat(prefix);
      if (stat === null) {
        return fail(
          'PATH_NOT_FOUND',
          'That path does not exist in the workspace.',
          segments.slice(0, index + 1).join('/'),
        );
      }
      const isLast = index === segments.length - 1;
      let kind = stat.kind;
      if (kind === 'symlink') {
        if (!this.allowSymlinks) {
          return fail(
            'PATH_NOT_ALLOWED',
            'Symlinks are not followed inside a workspace.',
            segments.slice(0, index + 1).join('/'),
          );
        }
        // Symlinks explicitly permitted (hardening test only). The realpath check
        // below is the backstop that proves the target stays inside the root, so
        // here we only need the TARGET's kind for the traversal/expect checks.
        const targetStat = await this.fs.lstat(await this.resolveLinkTarget(prefix));
        if (targetStat === null) {
          return fail(
            'PATH_NOT_FOUND',
            'That path does not exist in the workspace.',
            segments.slice(0, index + 1).join('/'),
          );
        }
        kind = targetStat.kind;
      }
      if (!isLast && kind !== 'directory') {
        return fail(
          'PATH_NOT_FOUND',
          'That path does not exist in the workspace.',
          segments.slice(0, index + 1).join('/'),
        );
      }
      if (isLast) {
        if (expect === 'directory' && kind !== 'directory') {
          return fail('PATH_IS_NOT_DIRECTORY', 'That path is not a directory.', relative);
        }
        if (expect === 'file' && kind !== 'file') {
          if (kind === 'directory') {
            return fail('PATH_IS_NOT_DIRECTORY', 'That path is a directory, not a file.', relative);
          }
          return fail('PATH_NOT_ALLOWED', 'That path is not a regular file.', relative);
        }
      }
    }

    // Realpath hardening: an intermediate symlink would land outside rootReal.
    const targetReal = await this.fs.realpath(absolute);
    if (targetReal === null) {
      return fail('IO_ERROR', 'The workspace path could not be resolved.', relative);
    }
    if (!isContained(targetReal, rootReal, this.caseInsensitive)) {
      return fail(
        'PATH_NOT_ALLOWED',
        'The path resolves outside the authorized workspace.',
        relative,
      );
    }

    return ok({ relative, absolute });
  }
}
