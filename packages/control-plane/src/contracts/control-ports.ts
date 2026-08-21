// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Control Plane · narrow ports
// SPRINT-031 — the ONLY seams through which the control plane reaches the
// frozen estate. Implemented in the gateway over the real Brain, the real
// proactive service, the real Intelligence Fabric and the real stores. This
// package composes — it never re-implements any of them.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AutonomySettings,
  EmergencyStopState,
  OpportunityLifecycleRecord,
} from '../types/control-types.js';

/** Brain surface: pending approvals + outcome memory (owner-scoped). */
export interface ControlBrainPort {
  /** Tasks that carry `approvalRequired` actions — the Approval Center data. */
  listTasksWithApprovals(userId: string): Array<{
    taskId: string;
    title: string;
    approvalRequired: string[];
  }>;
  /** Outcome-memory count (learning evidence). */
  outcomeCount(userId: string): number;
}

/** Proactive surface: refresh + list recommendations (never executes). */
export interface ControlProactivePort {
  refresh(userId: string, opts?: { runDiscovery?: boolean }): Promise<{ success: boolean }>;
  listRecommendations(userId: string): Array<{
    id: string;
    title: string;
    category: string;
    authorizationRequired: boolean;
    riskLevel: string;
  }>;
}

/** Intelligence Fabric surface: provider health + cost snapshot. */
export interface ControlFabricPort {
  allProviderHealth(): Array<{ providerId: string; state: string; observedCalls: number }>;
  costSnapshot(ownerId: string): { dailyUsd?: number; providerUsd?: number };
}

/** Settings + emergency stop + opportunity stores (owner-scoped). */
export interface ControlStores {
  settings: {
    get(ownerId: string): AutonomySettings | undefined;
    save(settings: AutonomySettings): void;
  };
  emergencyStop: {
    get(ownerId: string): EmergencyStopState | undefined;
    save(state: EmergencyStopState): void;
  };
  opportunities: {
    save(record: OpportunityLifecycleRecord): void;
    get(ownerId: string, id: string): OpportunityLifecycleRecord | undefined;
    getByKey(ownerId: string, stableKey: string): OpportunityLifecycleRecord | undefined;
    list(ownerId: string): OpportunityLifecycleRecord[];
  };
}
