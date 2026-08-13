// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: In-Memory Workspace
// EPIC-007 — Phase 14. Each generated application gets an ISOLATED
// workspace (VedMoulya/Applications/app-001-name) — cross-application
// file contamination is prevented by construction:
//   - paths are normalized and MUST stay inside the workspace root
//   - no absolute host paths, no `..` escapes, no backslashes tricks
//   - destructive operations capture rollback content BEFORE applying
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import type { ExecutionPolicy } from '../types/app-types.js';
import type {
  WorkspaceFileEntry,
  WorkspaceOperationInput,
  WorkspaceOperationResult,
  WorkspacePort,
} from '../contracts/factory-ports.js';
import { classifyFileOperation } from '../contracts/factory-ports.js';

export class InMemoryWorkspace implements WorkspacePort {
  private readonly files = new Map<string, string>();
  private readonly stack: Array<{
    kind: WorkspaceOperationInput['kind'];
    path: string;
    toPath?: string;
    previousContent?: string;
  }> = [];

  constructor(
    private readonly applicationId: string,
    private readonly policy: ExecutionPolicy,
    /** Default files seeded at creation (e.g. from a generator). */
    seed: Array<{ path: string; content: string }> = [],
  ) {
    for (const entry of seed) {
      const normalized = this.normalize(entry.path);
      this.files.set(normalized, entry.content);
    }
  }

  workspacePath(): string {
    return `Applications/${this.applicationId}`;
  }

  listFiles(): WorkspaceFileEntry[] {
    return Array.from(this.files.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, content]) => ({ path, content, kind: this.kindOf(path) }));
  }

  readFile(path: string): string | undefined {
    const normalized = this.normalize(path);
    return this.files.get(normalized);
  }

  apply(input: WorkspaceOperationInput): WorkspaceOperationResult {
    let normalized: string;
    try {
      normalized = this.normalize(input.path);
    } catch (error) {
      return {
        ok: false,
        op: this.opRecord(
          input,
          'rejected',
          error instanceof Error ? error.message : 'invalid path',
        ),
        error: error instanceof Error ? error.message : 'invalid path',
      };
    }

    const { actionClass, allowed } = classifyFileOperation(input.kind, input.path, this.policy);

    // Hard containment + policy enforcement (Phase 9/14).
    if (!allowed) {
      return {
        ok: false,
        op: this.opRecord(input, 'rejected', `blocked by execution policy (${actionClass})`),
        error: `blocked by execution policy (${actionClass})`,
      };
    }

    switch (input.kind) {
      case 'create': {
        if (this.files.has(normalized)) {
          return {
            ok: false,
            op: this.opRecord(input, 'rejected', `file already exists: ${normalized}`),
            error: `file already exists: ${normalized}`,
          };
        }
        this.files.set(normalized, input.content ?? '');
        this.stack.push({ kind: 'create', path: normalized });
        return { ok: true, op: this.opRecord(input, 'applied') };
      }
      case 'modify': {
        const previous = this.files.get(normalized);
        if (previous === undefined) {
          return {
            ok: false,
            op: this.opRecord(input, 'rejected', `file does not exist: ${normalized}`),
            error: `file does not exist: ${normalized}`,
          };
        }
        this.files.set(normalized, input.content ?? '');
        this.stack.push({ kind: 'modify', path: normalized, previousContent: previous });
        return { ok: true, op: this.opRecord(input, 'applied', undefined, previous) };
      }
      case 'delete': {
        const previous = this.files.get(normalized);
        if (previous === undefined) {
          return {
            ok: false,
            op: this.opRecord(input, 'rejected', `file does not exist: ${normalized}`),
            error: `file does not exist: ${normalized}`,
          };
        }
        this.files.delete(normalized);
        this.stack.push({ kind: 'delete', path: normalized, previousContent: previous });
        return { ok: true, op: this.opRecord(input, 'applied', undefined, previous) };
      }
      case 'rename': {
        const previous = this.files.get(normalized);
        if (previous === undefined) {
          return {
            ok: false,
            op: this.opRecord(input, 'rejected', `file does not exist: ${normalized}`),
            error: `file does not exist: ${normalized}`,
          };
        }
        if (!input.toPath) {
          return {
            ok: false,
            op: this.opRecord(input, 'rejected', 'rename requires a destination path'),
            error: 'rename requires a destination path',
          };
        }
        let toNormalized: string;
        try {
          toNormalized = this.normalize(input.toPath);
        } catch (error) {
          return {
            ok: false,
            op: this.opRecord(
              input,
              'rejected',
              error instanceof Error ? error.message : 'invalid destination path',
            ),
            error: error instanceof Error ? error.message : 'invalid destination path',
          };
        }
        if (this.files.has(toNormalized)) {
          return {
            ok: false,
            op: this.opRecord(input, 'rejected', `destination already exists: ${toNormalized}`),
            error: `destination already exists: ${toNormalized}`,
          };
        }
        this.files.delete(normalized);
        this.files.set(toNormalized, previous);
        this.stack.push({
          kind: 'rename',
          path: normalized,
          toPath: toNormalized,
          previousContent: previous,
        });
        return { ok: true, op: this.opRecord(input, 'applied', undefined, previous, toNormalized) };
      }
      default:
        // input.kind is exhaustively narrowed to `never` here (create/modify/
        // delete/rename are the only FileOperationKind values) — keep the
        // message static so the unreachable branch stays lint-clean.
        return {
          ok: false,
          op: this.opRecord(input, 'rejected', 'unknown operation kind'),
          error: 'unknown operation kind',
        };
    }
  }

  rollbackLast(): WorkspaceOperationResult | undefined {
    const last = this.stack.pop();
    if (!last) return undefined;
    switch (last.kind) {
      case 'create':
        this.files.delete(last.path);
        break;
      case 'modify':
      case 'delete':
      case 'rename':
        if (last.toPath) this.files.delete(last.toPath);
        if (last.previousContent !== undefined) this.files.set(last.path, last.previousContent);
        break;
    }
    return {
      ok: true,
      op: this.opRecord(
        {
          kind: last.kind,
          path: last.path,
          toPath: last.toPath,
          reason: 'rollback',
          originatingTask: 'rollback',
        },
        'rolled_back',
      ),
    };
  }

  /** Normalize and contain a path — the security boundary of the workspace. */
  private normalize(path: string): string {
    if (!path || path.trim() === '') throw new Error('path is required');
    const cleaned = path.replaceAll('\\', '/').trim();
    if (cleaned.startsWith('/') || /^[a-zA-Z]:/.test(cleaned)) {
      throw new Error(`absolute paths are not allowed in the workspace: ${path}`);
    }
    const segments = cleaned.split('/').filter((s) => s !== '' && s !== '.');
    if (segments.some((s) => s === '..')) {
      throw new Error(`path traversal is not allowed: ${path}`);
    }
    return segments.join('/');
  }

  private kindOf(path: string): WorkspaceFileEntry['kind'] {
    if (/\.(test|spec)\.(ts|tsx|js)$/.test(path)) return 'test';
    if (/\.(sql)$/.test(path)) return 'schema';
    if (/\.(json|yaml|yml|toml|env)$/.test(path)) return 'config';
    if (/\.(md|txt)$/.test(path)) return 'docs';
    if (/\.(css|scss|svg|png|jpg)$/.test(path)) return 'asset';
    return 'source';
  }

  private opRecord(
    input: WorkspaceOperationInput,
    status: 'applied' | 'rejected' | 'rolled_back',
    error?: string,
    rollbackContent?: string,
    toPath?: string,
  ): WorkspaceOperationResult['op'] {
    const { actionClass } = classifyFileOperation(input.kind, input.path, this.policy);
    return {
      operationId: `op-${generateId()}`,
      kind: input.kind,
      path: input.path,
      toPath: toPath ?? input.toPath,
      content: input.content,
      reason: input.reason,
      originatingTask: input.originatingTask,
      actionClass,
      status,
      rollbackContent,
      validationStatus: 'untested',
      ...(error ? { error } : {}),
    };
  }
}
