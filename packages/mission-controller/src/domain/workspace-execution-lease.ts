// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Controller: Workspace execution lease (WORKSPACE-01)
//
// THE GAP THIS CLOSES
// -------------------
// Objective leases are per OBJECTIVE (and `hasOtherLiveLease` refuses a second
// objective of the SAME mission). Nothing, however, prevents two different
// MISSIONS — created by different users, at different times — from pointing at
// the same authorized workspace and executing at the same time. Two agents
// writing files / running commands in one repository corrupt each other's work
// and neither result is trustworthy.
//
// This is a deliberately small, injectable LEASE keyed by the NORMALIZED
// workspace identity. It is not a scheduler, not a queue and not a second
// mission store: an attempt either holds the workspace or it does not execute.
//
// CONTRACT
//   • acquisition is atomic and owner-scoped by the objective's fencing token;
//   • a lease EXPIRES, so a process that dies while holding it cannot block the
//     workspace forever (the same recovery premise as the objective lease);
//   • renewal is optional; when a store can renew, the objective heartbeat
//     renews the workspace lease alongside it;
//   • release is best-effort and token-checked: a stale attempt can never
//     release the lease of the execution that replaced it.
//
// Stores that cannot provide this port may omit it; the controller then keeps
// the frozen single-mission behavior and reports (in the sprint notes) that
// cross-mission workspace exclusion is not enforced.
// ──────────────────────────────────────────────────────────────────

/** One attempt's claim on a workspace. `token` is the objective fencing token. */
export interface WorkspaceLeaseRequest {
  missionId: string;
  objectiveId: string;
  token: string;
  nowMs: number;
  expiresAt: string;
}

/** The identity a workspace lease is keyed by. */
export interface WorkspaceLeaseHolder {
  missionId: string;
  objectiveId: string;
  token: string;
  expiresAt: string;
}

export interface WorkspaceLeasePort {
  /**
   * Atomically claim `workspaceKey` for this attempt. Returns `true` only when
   * the caller now holds it (free, expired, or already held by this token).
   */
  acquire(workspaceKey: string, request: WorkspaceLeaseRequest): Promise<boolean>;
  /** Extend a lease this token already holds. Returns `false` when it is gone. */
  renew?(
    workspaceKey: string,
    renewal: { token: string; nowMs: number; expiresAt: string },
  ): Promise<boolean>;
  /** Release a lease only while this token still holds it (best effort). */
  release?(workspaceKey: string, token: string): Promise<void>;
  /** Whether this token still holds a live lease on the workspace. */
  held?(workspaceKey: string, token: string): Promise<boolean>;
}

/**
 * Normalize a workspace path into a stable lease key WITHOUT touching the
 * filesystem (the controller stays platform-agnostic and side-effect free).
 *
 * - empty/blank → `undefined` (nothing to isolate);
 * - Windows and POSIX separators collapse to `/`;
 * - duplicate and trailing separators are removed;
 * - a trailing `.` segment is dropped.
 *
 * Case is preserved deliberately: two paths differing only in case are treated
 * as different workspaces here, because folding case would silently merge
 * distinct directories on case-sensitive filesystems.
 */
export function normalizeWorkspaceKey(workspace: string | undefined): string | undefined {
  if (workspace === undefined) return undefined;
  const collapsed = workspace
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/');
  if (collapsed.length === 0) return undefined;
  const withoutTrailing = collapsed.replace(/\/+$/, '').replace(/\/\.$/, '');
  if (withoutTrailing.length === 0) return undefined;
  return withoutTrailing;
}

/**
 * Process-local workspace lease store — the deterministic implementation used
 * by tests and by single-process (development / local worker) execution.
 *
 * It enforces exactly the same rules as the durable store: one live holder per
 * workspace, expiry-based availability, token-checked renewal and release.
 */
export class InMemoryWorkspaceLeaseStore implements WorkspaceLeasePort {
  private readonly holders = new Map<string, WorkspaceLeaseHolder>();

  acquire(workspaceKey: string, request: WorkspaceLeaseRequest): Promise<boolean> {
    const current = this.holders.get(workspaceKey);
    if (current !== undefined && current.token !== request.token) {
      // A different attempt holds it — only an EXPIRED lease is reclaimable.
      if (Date.parse(current.expiresAt) > request.nowMs) return Promise.resolve(false);
    }
    this.holders.set(workspaceKey, {
      missionId: request.missionId,
      objectiveId: request.objectiveId,
      token: request.token,
      expiresAt: request.expiresAt,
    });
    return Promise.resolve(true);
  }

  renew(
    workspaceKey: string,
    renewal: { token: string; nowMs: number; expiresAt: string },
  ): Promise<boolean> {
    const current = this.holders.get(workspaceKey);
    if (current === undefined || current.token !== renewal.token) return Promise.resolve(false);
    if (Date.parse(current.expiresAt) <= renewal.nowMs) return Promise.resolve(false);
    this.holders.set(workspaceKey, { ...current, expiresAt: renewal.expiresAt });
    return Promise.resolve(true);
  }

  release(workspaceKey: string, token: string): Promise<void> {
    const current = this.holders.get(workspaceKey);
    if (current !== undefined && current.token === token) this.holders.delete(workspaceKey);
    return Promise.resolve();
  }

  held(workspaceKey: string, token: string): Promise<boolean> {
    const current = this.holders.get(workspaceKey);
    return Promise.resolve(current !== undefined && current.token === token);
  }

  /** Observability (tests / diagnostics): the current holder, if any. */
  holderOf(workspaceKey: string): WorkspaceLeaseHolder | undefined {
    return this.holders.get(workspaceKey);
  }
}
