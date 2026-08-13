// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: File Operation Layer
// EPIC-007 — Phases 5–6. The controlled file/patch model:
//   READ → PLAN → PATCH → TEST → REVIEW   (never rewrite-the-repo)
//
// Supports create / modify / delete / rename with safeguards:
//   - every change records path, operation, reason, originating task,
//     validation status (Phase 5)
//   - destructive operations detect affected files, validate ownership,
//     require explicit policy approval, and capture rollback content
//     (Phase 6)
//   - generated code is typed, structured, repository-aware, testable,
//     lintable and buildable (Phase 5) — enforced by ValidationPipeline
// ──────────────────────────────────────────────────────────────────

import { generateId, NotFoundError, ConflictError } from '@vedmoulya/core';
import type { ExecutionPolicy, FileOperation } from '../types/app-types.js';
import { classifyFileOperation } from '../contracts/factory-ports.js';
import type { WorkspacePort } from '../contracts/factory-ports.js';

export interface FileChangeInput {
  kind: FileOperation['kind'];
  path: string;
  toPath?: string;
  content?: string;
  reason: string;
  originatingTask: string;
}

export interface PlannedChange extends FileChangeInput {
  operationId: string;
  actionClass: FileOperation['actionClass'];
  allowed: boolean;
  requiresApproval: boolean;
}

export class FileOperationLayer {
  private readonly operations: FileOperation[] = [];

  constructor(
    private readonly workspace: WorkspacePort,
    private readonly policy: ExecutionPolicy,
  ) {}

  /**
   * PLAN a change (Phase 6: READ → PLAN): classify it, detect affected
   * files and ownership. No write happens here.
   */
  plan(input: FileChangeInput): PlannedChange {
    const { actionClass, allowed, requiresApproval } = classifyFileOperation(
      input.kind,
      input.path,
      this.policy,
    );
    return { ...input, operationId: `op-${generateId()}`, actionClass, allowed, requiresApproval };
  }

  /** Whether the change may be applied under the current policy. */
  canApply(planned: PlannedChange): boolean {
    return planned.allowed && !planned.requiresApproval;
  }

  /**
   * PATCH: apply a planned change through the workspace (which enforces
   * root containment + rollback capture). Records the operation and its
   * validation status.
   */
  apply(planned: PlannedChange): FileOperation {
    const result = this.workspace.apply({
      kind: planned.kind,
      path: planned.path,
      toPath: planned.toPath,
      content: planned.content,
      reason: planned.reason,
      originatingTask: planned.originatingTask,
    });
    if (!result.ok) {
      throw new ConflictError(`file operation rejected: ${result.error ?? 'unknown reason'}`);
    }
    this.operations.push(result.op);
    return result.op;
  }

  /**
   * Apply a change only when explicitly authorized (destructive ops and
   * secret access). Callers must have obtained user authorization first:
   * the action class is granted on the shared policy before the workspace
   * applies the change (the grant IS the recorded authorization decision).
   */
  applyAuthorized(planned: PlannedChange): FileOperation {
    if (planned.requiresApproval && !planned.allowed) {
      // Grant the class on the shared policy object so the workspace (which
      // validates the same policy) accepts the change.
      this.policy.grants = { ...this.policy.grants, [planned.actionClass]: true };
    }
    return this.apply(planned);
  }

  /** Mark a change's validation status after tests run (Phase 5). */
  markValidation(operationId: string, status: FileOperation['validationStatus']): void {
    const op = this.operations.find((o) => o.operationId === operationId);
    if (!op) throw new NotFoundError('FileOperation', operationId);
    op.validationStatus = status;
  }

  /** Roll back the most recent applied operation (Phase 6). */
  rollback(): FileOperation | undefined {
    const rolled = this.workspace.rollbackLast();
    if (!rolled?.ok) return undefined;
    rolled.op.status = 'rolled_back';
    return rolled.op;
  }

  /** Every recorded operation (the full patch history). */
  history(): FileOperation[] {
    return [...this.operations];
  }

  /** Effective file listing: the workspace contents after applied ops. */
  files(): Array<{ path: string; content: string }> {
    return this.workspace.listFiles();
  }
}
