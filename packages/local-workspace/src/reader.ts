// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local Workspace — bounded reader
//
// LIST a directory (one level by default, recursing up to a bounded depth) and
// READ a single text file. Both operations are bounded by the workspace limits
// and both are read-only: there is no write, rename, delete or execute path.
//
// Symlinks are reported as entries but never traversed or read (the path
// resolver refuses them). Binary files are described by metadata only; their
// bytes are never returned.
// ─────────────────────────────────────────────────────────────────────────────

import type { WorkspaceFileSystem } from './filesystem.js';
import { clampDepth, clampFileBytes, clampListEntries } from './limits.js';
import { hasInvalidUtf8, isBinaryExtension, isIgnoredName, looksBinary } from './policy.js';
import type { WorkspacePathResolver } from './path-resolver.js';
import { fail, ok } from './result.js';
import type {
  FileEncoding,
  WorkspaceEntry,
  WorkspaceFileContent,
  WorkspaceLimits,
  WorkspaceListOptions,
  WorkspaceListing,
  WorkspaceReadOptions,
  WorkspaceResult,
} from './types.js';

/** Everything the reader needs about an authorized workspace. */
export interface WorkspaceTarget {
  id: string;
  root: string;
  rootReal: string;
  limits: WorkspaceLimits;
}

export class WorkspaceReader {
  private readonly fs: WorkspaceFileSystem;
  private readonly resolver: WorkspacePathResolver;

  constructor(fs: WorkspaceFileSystem, resolver: WorkspacePathResolver) {
    this.fs = fs;
    this.resolver = resolver;
  }

  /** List a directory, bounded by entry count and depth. */
  async list(
    target: WorkspaceTarget,
    options: WorkspaceListOptions = {},
  ): Promise<WorkspaceResult<WorkspaceListing>> {
    const requestedDepth = options.depth ?? 1;
    const requestedMax = options.max;
    if (
      !Number.isFinite(requestedDepth) ||
      requestedDepth < 1 ||
      (requestedMax !== undefined && (!Number.isFinite(requestedMax) || requestedMax < 1))
    ) {
      return fail('INVALID_REQUEST', 'The listing bounds are invalid.');
    }
    const depth = clampDepth(requestedDepth, target.limits);
    const max = clampListEntries(requestedMax, target.limits);

    const resolved = await this.resolver.resolveInside(target.root, target.rootReal, options.path, {
      expect: 'directory',
    });
    if (!resolved.ok) return resolved;

    const entries: WorkspaceEntry[] = [];
    let ignoredCount = 0;
    let truncated = false;
    const depthLimited = Math.floor(requestedDepth) > depth;

    // Breadth-first walk so shallow entries are returned first (deterministic).
    const queue: Array<{ absolute: string; relative: string; level: number }> = [
      { absolute: resolved.value.absolute, relative: resolved.value.relative, level: 1 },
    ];

    while (queue.length > 0) {
      if (entries.length >= max) {
        truncated = true;
        break;
      }
      const current = queue.shift();
      if (current === undefined) break;
      const children = await this.fs.readdir(current.absolute);
      if (children === null) {
        if (current.relative === resolved.value.relative) {
          return fail('IO_ERROR', 'That folder could not be read.', current.relative);
        }
        continue;
      }
      const sorted = [...children].sort((a, b) => a.name.localeCompare(b.name));
      for (const child of sorted) {
        if (entries.length >= max) {
          truncated = true;
          break;
        }
        if (isIgnoredName(child.name)) {
          ignoredCount += 1;
          continue;
        }
        const relativePath =
          current.relative === '' ? child.name : `${current.relative}/${child.name}`;
        entries.push({
          name: child.name,
          path: relativePath,
          kind: child.kind,
          hidden: false,
          ...(child.sizeBytes !== undefined ? { sizeBytes: child.sizeBytes } : {}),
          ...(child.modifiedAt !== undefined ? { modifiedAt: child.modifiedAt } : {}),
        });
        if (child.kind === 'directory' && current.level < depth) {
          queue.push({
            absolute: this.joinAbsolute(target, relativePath),
            relative: relativePath,
            level: current.level + 1,
          });
        }
      }
    }

    return ok({
      workspaceId: target.id,
      path: resolved.value.relative,
      entries,
      truncated,
      ignoredCount,
      depthLimited,
    });
  }

  /** Read one file, returning text for UTF-8 content and metadata for binary. */
  async read(
    target: WorkspaceTarget,
    options: WorkspaceReadOptions,
  ): Promise<WorkspaceResult<WorkspaceFileContent>> {
    if (typeof options.path !== 'string' || options.path.trim() === '') {
      return fail('INVALID_REQUEST', 'A workspace file path is required.');
    }
    if (
      options.maxBytes !== undefined &&
      (!Number.isFinite(options.maxBytes) || options.maxBytes < 1)
    ) {
      return fail('INVALID_REQUEST', 'The byte budget is invalid.');
    }

    const resolved = await this.resolver.resolveInside(target.root, target.rootReal, options.path, {
      expect: 'file',
    });
    if (!resolved.ok) return resolved;

    const relative = resolved.value.relative;
    const stat = await this.fs.lstat(resolved.value.absolute);
    if (stat === null) {
      return fail('PATH_NOT_FOUND', 'That file does not exist in the workspace.', relative);
    }
    const size = stat.sizeBytes;
    const budget = clampFileBytes(options.maxBytes, target.limits);

    // Extension-proven binary → metadata only, no read.
    if (isBinaryExtension(relative)) {
      return ok({
        workspaceId: target.id,
        path: relative,
        bytes: size,
        truncated: false,
        encoding: 'binary',
        contentOmittedReason: 'binary',
      });
    }

    const readLength = Math.min(size, budget);
    const prefix = await this.fs.readPrefix(resolved.value.absolute, readLength);
    if (prefix === null) {
      return fail('IO_ERROR', 'That file could not be read.', relative);
    }

    // Sniff for NUL bytes → binary, regardless of extension.
    if (looksBinary(prefix)) {
      return ok({
        workspaceId: target.id,
        path: relative,
        bytes: size,
        truncated: false,
        encoding: 'binary',
        contentOmittedReason: 'binary',
      });
    }

    const decoded = new TextDecoder('utf-8').decode(prefix);
    if (hasInvalidUtf8(decoded)) {
      return ok({
        workspaceId: target.id,
        path: relative,
        bytes: size,
        truncated: false,
        encoding: 'binary',
        contentOmittedReason: 'binary',
      });
    }

    const encoding: FileEncoding = 'utf8';
    return ok({
      workspaceId: target.id,
      path: relative,
      bytes: prefix.length,
      truncated: size > prefix.length,
      encoding,
      content: decoded,
    });
  }

  private joinAbsolute(target: WorkspaceTarget, relative: string): string {
    const separator = target.root.includes('\\') ? '\\' : '/';
    return relative === '' ? target.root : [target.root, ...relative.split('/')].join(separator);
  }
}
