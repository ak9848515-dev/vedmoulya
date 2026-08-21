// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · AIWorkforce
// SPRINT-032 — provider-neutral AI workforce abstraction.
//
// The "100 employees" concept is an ARCHITECTURE, not 100 fake agents:
//
//     ROLE → RESPONSIBILITY → CAPABILITY → WORKFLOW → AUTHORITY
//
// ROLE ≠ MODEL ≠ PROVIDER ≠ AGENT. A role is a typed responsibility any
// capable provider/model can fulfill — CONTENT_RESEARCHER may run on Gemini,
// OpenAI, Claude, DeepSeek, a local model or a future provider without
// changing the business workflow. Business logic names roles, never provider
// ids; provider binding is an ADVISORY suggestion produced through the
// Intelligence Fabric.
//
// Security invariants (structural):
//   • a worker can never carry more authority than its role
//   • a worker can never create another worker with greater authority
//   • a worker never executes/spends/approves — it is a recommendation
// ─────────────────────────────────────────────────────────────────────────────

import type { RoleSpec, WorkerSpec } from '../types/world-types.js';

export type WorkforceResult<T> = { success: true; data: T } | { success: false; error: string };

function ok<T>(data: T): WorkforceResult<T> {
  return { success: true, data };
}
function err<T>(error: string): WorkforceResult<T> {
  return { success: false, error };
}

function authorityRank(authority: 'A' | 'B' | 'C' | 'D'): number {
  switch (authority) {
    case 'A':
      return 1;
    case 'B':
      return 2;
    case 'C':
      return 3;
    case 'D':
      return 4;
  }
}

/** Deterministic slug for stable keys — strips punctuation, keeps letters. */
function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** A role can never escalate its own authority (single-step, deterministic).
 *  The only legal moves are DOWN (toward A) or UNCHANGED. */
export function canEscalate(current: 'A' | 'B' | 'C' | 'D', next: 'A' | 'B' | 'C' | 'D'): boolean {
  return authorityRank(next) <= authorityRank(current);
}

export class AIWorkforce {
  /** Register a role (validated, owner-scoped, stable-keyed). */
  registerRole(input: {
    ownerId: string;
    id?: string;
    name: string;
    responsibilities: string[];
    capabilities: string[];
    providerStrategies?: RoleSpec['providerStrategies'];
    modelRequirements?: string[];
    costConstraintsUsd?: number;
    privacyRequirement?: 'PRIVATE' | 'STANDARD';
    authorityClass?: 'A' | 'B' | 'C' | 'D';
    inputContract?: string;
    outputContract?: string;
    verificationRequirement?: string;
  }): WorkforceResult<RoleSpec> {
    const name = input.name.trim();
    if (name.length === 0) return err('A role needs a name.');
    if (name.length > 80) return err('Role name is too long.');
    if (input.responsibilities.length === 0)
      return err('A role needs at least one responsibility.');
    if (input.capabilities.length === 0) return err('A role needs at least one capability.');
    const ts = new Date().toISOString();
    return ok({
      id: input.id ?? `role-${Math.random().toString(36).slice(2, 10)}`,
      ownerId: input.ownerId,
      stableKey: `${input.ownerId}:role:${slug(name)}`,
      name,
      responsibilities: input.responsibilities.slice(0, 20),
      capabilities: input.capabilities.slice(0, 30),
      providerStrategies: input.providerStrategies?.slice(0, 8) ?? ['LOW_COST', 'FREE'],
      modelRequirements: input.modelRequirements?.slice(0, 10),
      costConstraintsUsd: input.costConstraintsUsd,
      privacyRequirement: input.privacyRequirement ?? 'STANDARD',
      authorityClass: input.authorityClass ?? 'B',
      inputContract: input.inputContract?.slice(0, 500),
      outputContract: input.outputContract?.slice(0, 500),
      verificationRequirement: input.verificationRequirement?.slice(0, 300),
      status: 'ACTIVE',
      createdAt: ts,
      updatedAt: ts,
    });
  }

  /**
   * Suggest an ADVISORY worker (role + provider/model binding) for a role.
   * The provider comes from the EXISTING Intelligence Fabric selection
   * strategy (privacy overrides cost; PRIVATE with no local candidate →
   * honest no-selection). The worker's authority NEVER exceeds the role's.
   */
  suggestWorker(input: {
    ownerId: string;
    role: RoleSpec;
    selection: {
      strategy: WorkerSpec['strategy'];
      selected?: { providerId: string; modelId?: string };
      reasons: string[];
    };
  }): WorkforceResult<WorkerSpec> {
    const worker: WorkerSpec = {
      id: `worker-${Math.random().toString(36).slice(2, 10)}`,
      ownerId: input.ownerId,
      roleId: input.role.id,
      roleName: input.role.name,
      providerId: input.selection.selected?.providerId,
      modelId: input.selection.selected?.modelId,
      strategy: input.selection.strategy,
      reasons: input.selection.reasons.slice(0, 5),
      authorityClass: input.role.authorityClass,
      advisory: true,
    };
    return ok(worker);
  }

  /** A worker can NEVER create another worker with greater authority.
   *  Structural: the new worker's class must be ≤ the creating role's. */
  canDelegate(creator: RoleSpec, targetClass: 'A' | 'B' | 'C' | 'D'): boolean {
    return canEscalate(creator.authorityClass, targetClass);
  }
}
