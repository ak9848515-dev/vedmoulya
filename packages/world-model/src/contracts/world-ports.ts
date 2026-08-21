// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · narrow ports
// SPRINT-032 — the ONLY seams through which this package may reach the frozen
// estate. Implemented in the gateway over the real BrainApplicationService,
// the real ProactiveIntelligenceService, the real IntelligenceFabricService,
// the real control plane and the real stores. This package composes — it
// never re-implements any of them, and it owns NO authority (no approval,
// no spending, no execution, no memory promotion).
// ─────────────────────────────────────────────────────────────────────────────

import type { ActionClassDecision, BusinessOpportunityAssessment } from '@vedmoulya/proactive';
import type { StrategySelection } from '@vedmoulya/intelligence-fabric';
import type {
  BlueprintApprovalRequest,
  BusinessProblem,
  BusinessUnit,
  BusinessWorkflow,
  CustomerDiscoveryRecord,
  FounderObservation,
  OrchestrationPlan,
  OutcomeEvidence,
  RoleSpec,
  RevenueStream,
  WorldEntity,
  WorldEntityType,
  WorldRelation,
  WorldSignal,
  WorldSignalKind,
  WorldSignalSourceStatus,
} from '../types/world-types.js';

/** Brain surface: existing tasks + opportunities (owner-scoped by the
 *  implementor — the world model never touches another owner). */
export interface WorldBrainPort {
  listOpportunities(userId: string): {
    success: boolean;
    data?: Array<{
      id: string;
      category: string;
      title: string;
      description: string;
      evidence: string[];
      uncertainty: number;
      status: string;
      estimatedValue?: { label: string; status: string };
      cost?: { label: string; status: string };
      risk?: string;
      requiredCapabilities?: string[];
      recommendedNextAction?: string;
    }>;
    error?: string;
  };
  listTasks(userId: string): {
    success: boolean;
    data?: Array<{ id: string; objective: string; status: string; createdAt: string }>;
    error?: string;
  };
}

/** Proactive surface: the EXISTING opportunity assessor (research/score only
 *  — never spends, registers or commits). */
export interface WorldProactivePort {
  assessBusiness(
    userId: string,
    input: { title: string; description: string; requiredCapabilities: string[] },
  ): BusinessOpportunityAssessment;
}

/** Intelligence Fabric surface: advisory selection + bounded workflow
 *  validation + measured cost snapshot (never fabricated). */
export interface WorldFabricPort {
  selectStrategy(input: {
    strategy: 'CHEAP' | 'FAST' | 'QUALITY' | 'PRIVATE' | 'BALANCED';
    taskPrivacy: 'PUBLIC' | 'INTERNAL' | 'SENSITIVE' | 'PRIVATE';
    capability: string;
  }): Promise<StrategySelection>;
  validateWorkflow(plan: {
    taskCount: number;
    depth: number;
    maxParallelFanout: number;
    estimatedProviderCalls: number;
    estimatedCostUsd?: number;
    estimatedTimeMs?: number;
  }): { allowed: boolean; reason: string; exceeded?: string };
  costSnapshot(ownerId: string): { dailyUsd?: number; providerUsd?: number };
}

/** The EXISTING action-class authority (A/B/C/D over the frozen
 *  SENSITIVE_ACTIONS). The boundary labels classes — it never decides. */
export interface WorldActionPort {
  classify(action: string, opts?: { recurring?: boolean }): ActionClassDecision;
}

/** Control-plane surface: opportunity lifecycle records + autonomy settings
 *  (owner-scoped; the world model only READS posture, never changes it). */
export interface WorldControlPort {
  listOpportunities(userId: string): Array<{
    id: string;
    title: string;
    category: string;
    status: string;
    riskLevel: string;
    estimatedCost?: { label: string; status: string };
    estimatedValue?: { label: string; status: string };
    evidence: { label: string; status: string }[];
    recommendedWorkflow?: string[];
    /** SPRINT-035 — lifecycle timestamps (for the bounded timeline). */
    createdAt: string;
    updatedAt: string;
  }>;
  autonomyPosture(ownerId: string): {
    emergencyStopEngaged: boolean;
    autonomyLevel: number;
    settingsConfirmed: boolean;
  };
}

/**
 * External world signal sources. The world model ships NO live source by
 * default — an operator configures adapters (SPRINT-034 LiveSignalAdapter)
 * implementing this port. With no source connected the honest status is
 * UNAVAILABLE (never SUCCESS, never fabricated signals). External content is
 * EVIDENCE only — it can never authorize, never trigger execution.
 */
export interface WorldSignalSourcePort {
  listSignals(kind: WorldSignalKind): Promise<{
    status: WorldSignalSourceStatus;
    signals: WorldSignal[];
    error?: string;
  }>;
  /** SPRINT-035 — honest per-source health (optional; adapters that do not
   *  implement it report UNAVAILABLE with no metadata — never fabricated). */
  health?: () => Array<{
    kind: WorldSignalKind;
    status: WorldSignalSourceStatus;
    lastSuccessAt?: string;
    lastErrorAt?: string;
    lastError?: string;
    configured: boolean;
  }>;
}

/** Cost evidence surface (SPRINT-034) — implemented in the gateway over the
 *  EXISTING CostLedger / CostPolicyGuard. The world model only READS measured
 *  cost; it never writes accounting. UNKNOWN stays UNKNOWN (never 0). */
export interface WorldCostPort {
  /** Measured cost evidence for one owner, optionally scoped to a stream/
   *  business unit (CostLedger aggregation). Absent evidence → undefined. */
  measuredCostUsd(
    ownerId: string,
    scope?: { streamId?: string; businessUnitId?: string },
  ): { value: number; evidence: string[] } | undefined;
}

/** The EXISTING approval authority (SPRINT-034) — implemented in the gateway
 *  over BrainApplicationService.approve/reject (the frozen authority). The
 *  world model NEVER approves anything itself: a blueprint approval request
 *  becomes APPROVED only when THIS port — the existing authority — says so. */
export interface WorldApprovalPort {
  /** Approve a sensitive action through the EXISTING authority. Returns the
   *  decision record exactly as the authority recorded it (never forged). */
  approve(input: { userId: string; taskId: string; action: string }): {
    success: boolean;
    data?: { grantedBy: string; grantedAt: string; scope: string };
    error?: string;
  };
  /** Reject a sensitive action through the EXISTING authority. */
  reject(input: { userId: string; taskId: string; action: string }): {
    success: boolean;
    error?: string;
  };
  /** Create the task + approval request THROUGH the existing Brain (the only
   *  place a sensitive action is registered for approval). Returns the real
   *  Brain task id so later decisions route through the same authority task. */
  requestApproval(input: { userId: string; taskId: string; action: string }): {
    success: boolean;
    data?: { taskId?: string };
    error?: string;
  };
}

/** Owner-scoped stores for the world representation (in-memory + Postgres). */
export interface WorldStores {
  entities: {
    save(entity: WorldEntity): void;
    get(ownerId: string, id: string): WorldEntity | undefined;
    getByKey(ownerId: string, stableKey: string): WorldEntity | undefined;
    list(ownerId: string): WorldEntity[];
    listByType(ownerId: string, type: string): WorldEntity[];
    count(ownerId: string): number;
    countByType(ownerId: string): { type: WorldEntityType; count: number }[];
    remove(ownerId: string, id: string): void;
  };
  relations: {
    save(relation: WorldRelation): void;
    getByKey(ownerId: string, stableKey: string): WorldRelation | undefined;
    list(ownerId: string): WorldRelation[];
    count(ownerId: string): number;
    remove(ownerId: string, id: string): void;
  };
  businessUnits: {
    save(unit: BusinessUnit): void;
    get(ownerId: string, id: string): BusinessUnit | undefined;
    getByKey(ownerId: string, stableKey: string): BusinessUnit | undefined;
    list(ownerId: string): BusinessUnit[];
    remove(ownerId: string, id: string): void;
  };
  roles: {
    save(role: RoleSpec): void;
    get(ownerId: string, id: string): RoleSpec | undefined;
    getByKey(ownerId: string, stableKey: string): RoleSpec | undefined;
    list(ownerId: string): RoleSpec[];
  };
  workflows: {
    save(workflow: BusinessWorkflow): void;
    get(ownerId: string, id: string): BusinessWorkflow | undefined;
    getByKey(ownerId: string, stableKey: string): BusinessWorkflow | undefined;
    list(ownerId: string): BusinessWorkflow[];
  };
  /** Revenue streams (SPRINT-033 Part F) — evidence-carrying, owner-scoped,
   *  optionally business-unit-linked. Never secrets. */
  revenueStreams: {
    save(stream: RevenueStream): void;
    get(ownerId: string, id: string): RevenueStream | undefined;
    getByKey(ownerId: string, stableKey: string): RevenueStream | undefined;
    list(ownerId: string): RevenueStream[];
    remove(ownerId: string, id: string): void;
  };
  /** Verified-only outcome evidence (SPRINT-034) — the ONLY path by which
   *  actual outcomes may influence future scoring. Owner-scoped. */
  outcomeEvidence: {
    save(evidence: OutcomeEvidence): void;
    get(ownerId: string, id: string): OutcomeEvidence | undefined;
    getByKey(ownerId: string, stableKey: string): OutcomeEvidence | undefined;
    list(ownerId: string): OutcomeEvidence[];
    listByKind(ownerId: string, kind: string): OutcomeEvidence[];
    remove(ownerId: string, id: string): void;
  };
  /** Blueprint approval requests (SPRINT-034) — owner-scoped; decisions are
   *  recorded ONLY through the existing approval authority. */
  blueprintApprovals: {
    save(request: BlueprintApprovalRequest): void;
    get(ownerId: string, id: string): BlueprintApprovalRequest | undefined;
    getByKey(ownerId: string, stableKey: string): BlueprintApprovalRequest | undefined;
    list(ownerId: string): BlueprintApprovalRequest[];
    remove(ownerId: string, id: string): void;
  };
  /** Multi-provider orchestration plans (SPRINT-036) — owner-scoped,
   *  stable-keyed (goal + strategy), REPRESENTATIONS only (`executed:false`
   *  is structural). Never secrets, never provider credentials. */
  orchestrationPlans: {
    save(plan: OrchestrationPlan): void;
    get(ownerId: string, id: string): OrchestrationPlan | undefined;
    getByKey(ownerId: string, stableKey: string): OrchestrationPlan | undefined;
    list(ownerId: string): OrchestrationPlan[];
    remove(ownerId: string, id: string): void;
  };
  /** Practical business problems + evidence (SPRINT-038) — owner-scoped,
   *  evidence/provenance-REQUIRED (never fabricated customers/revenue),
   *  stable-keyed (owner + problem statement). Revenue evidence lives ON the
   *  problem (verified payments are evidence records, never claims). */
  problems: {
    save(problem: BusinessProblem): void;
    get(ownerId: string, id: string): BusinessProblem | undefined;
    getByKey(ownerId: string, stableKey: string): BusinessProblem | undefined;
    list(ownerId: string): BusinessProblem[];
    remove(ownerId: string, id: string): void;
  };
  /** Founder observations (SPRINT-039 Part B) — bounded owner-scoped evidence
   *  records with EXPLICIT evidence states; provenance MANDATORY. Never
   *  fabricated; never promoted to memory. */
  observations: {
    save(observation: FounderObservation): void;
    get(ownerId: string, id: string): FounderObservation | undefined;
    list(ownerId: string): FounderObservation[];
    listByProblem(ownerId: string, problemId: string): FounderObservation[];
    remove(ownerId: string, id: string): void;
  };
  /** Customer-discovery ledger (SPRINT-039 Part C) — the MINIMUM evidence-
   *  oriented representation (NOT a CRM). Discovery ≠ validation. */
  prospects: {
    save(record: CustomerDiscoveryRecord): void;
    get(ownerId: string, id: string): CustomerDiscoveryRecord | undefined;
    list(ownerId: string): CustomerDiscoveryRecord[];
    listByProblem(ownerId: string, problemId: string): CustomerDiscoveryRecord[];
    remove(ownerId: string, id: string): void;
  };
}
