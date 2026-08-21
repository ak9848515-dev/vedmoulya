// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Control Plane · ActiveIntelligenceControlPlane
// SPRINT-031 — the ONLY composition seam. Coordinates the existing estate into
// a CONTROLLED continuous-intelligence lifecycle:
//
//   OBSERVE → DISCOVER → ASSESS → PRIORITIZE → PROPOSE → GATE
//   (→ REQUEST AUTHORIZATION WHEN REQUIRED → EXECUTE THROUGH EXISTING AUTHORITY
//    → VERIFY → RECORD OUTCOME → LEARN — all via existing authorities)
//
// The cycle is BOUNDED and NEVER executes: `cycle()` returns gated proposals
// only; `executedNothing: true` is a structural guarantee. Emergency stop,
// budget, autonomy policy and user settings are enforced by the ControlGate.
// Nothing here is an engine — no discovery, no selection, no approval, no
// execution, no memory, no learning.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AutonomySettings,
  CycleOutcome,
  EmergencyStopState,
  GateDecision,
  ObservationSnapshot,
  OpportunityLifecycleRecord,
  OpportunityStatus,
} from '../types/control-types.js';
import type {
  ControlBrainPort,
  ControlFabricPort,
  ControlProactivePort,
  ControlStores,
} from '../contracts/control-ports.js';
import { ControlGate, type GateActionInput } from '../domain/ControlGate.js';
import { EmergencyStop } from '../domain/EmergencyStop.js';
import { OpportunityLifecycle, type TransitionResult } from '../domain/OpportunityLifecycle.js';
import { AutonomySettingsValidator } from '../domain/AutonomySettingsValidator.js';

export type ControlResult<T> =
  { success: true; data: T } | { success: false; error: string; code: string };

function ok<T>(data: T): ControlResult<T> {
  return { success: true, data };
}
function err<T>(error: string, code: string): ControlResult<T> {
  return { success: false, error, code };
}

export interface ControlPlaneOptions {
  brain: ControlBrainPort;
  proactive: ControlProactivePort;
  fabric: ControlFabricPort;
  stores: ControlStores;
  gate?: ControlGate;
  now?: () => string;
}

/** Hard cycle bounds — one bounded pass, deterministic termination. */
const MAX_CYCLE_RECOMMENDATIONS = 25;

export class ActiveIntelligenceControlPlane {
  readonly emergencyStop: EmergencyStop;
  readonly opportunities: OpportunityLifecycle;
  readonly validator: AutonomySettingsValidator;
  readonly gate: ControlGate;
  private readonly brain: ControlBrainPort;
  private readonly proactive: ControlProactivePort;
  private readonly fabric: ControlFabricPort;
  private readonly stores: ControlStores;
  private readonly now: () => string;

  constructor(opts: ControlPlaneOptions) {
    this.brain = opts.brain;
    this.proactive = opts.proactive;
    this.fabric = opts.fabric;
    this.stores = opts.stores;
    this.emergencyStop = new EmergencyStop(
      {
        get: (ownerId): EmergencyStopState | undefined => opts.stores.emergencyStop.get(ownerId),
        save: (state): void => {
          opts.stores.emergencyStop.save(state);
        },
      },
      opts.now,
    );
    this.opportunities = new OpportunityLifecycle(
      {
        save: (record): void => {
          opts.stores.opportunities.save(record);
        },
        get: (ownerId, id): OpportunityLifecycleRecord | undefined =>
          opts.stores.opportunities.get(ownerId, id),
        getByKey: (ownerId, key): OpportunityLifecycleRecord | undefined =>
          opts.stores.opportunities.getByKey(ownerId, key),
        list: (ownerId): OpportunityLifecycleRecord[] => opts.stores.opportunities.list(ownerId),
      },
      opts.now,
    );
    this.validator = new AutonomySettingsValidator();
    this.gate = opts.gate ?? new ControlGate();
    this.now = opts.now ?? ((): string => new Date().toISOString());
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  getSettings(ownerId: string): AutonomySettings | undefined {
    return this.stores.settings.get(ownerId);
  }

  /** Update settings — validated + explicit-confirmation-gated (fail-closed). */
  updateSettings(input: {
    ownerId: string;
    autonomyLevel: number;
    allowedCategories?: string[];
    prohibitedCategories?: string[];
    maxDailyCostUsd?: number;
    maxTaskCostUsd?: number;
    allowedProviders?: string[];
    prohibitedProviders?: string[];
    privateOnly?: boolean;
    userConfirmed?: boolean;
    notificationPreference?: 'all' | 'briefing-only' | 'none';
    quietHours?: { start?: string; end?: string };
    automationPermissions?: string[];
    updatedBy: string;
  }): ControlResult<AutonomySettings> {
    const validated = this.validator.validate({ ...input, ownerId: input.ownerId });
    if (!validated.success) return err(validated.error, 'INVALID_SETTINGS');
    this.stores.settings.save(validated.settings);
    return ok(validated.settings);
  }

  // ── Emergency stop (audited, narrow, never destructive) ──────────────────

  engageStop(input: {
    ownerId: string;
    actor: string;
    reason: string;
    source: 'user' | 'system' | 'operator';
  }): { success: true; state: EmergencyStopState } {
    return this.emergencyStop.engage(input);
  }

  releaseStop(input: {
    ownerId: string;
    actor: string;
    reason: string;
    source: 'user' | 'system' | 'operator';
  }): { success: true; state: EmergencyStopState } {
    return this.emergencyStop.release(input);
  }

  stopStatus(ownerId: string): {
    engaged: boolean;
    state?: { engagedAt?: string; engagedBy?: string; reason?: string };
  } {
    return {
      engaged: this.emergencyStop.isEngaged(ownerId),
      state: this.stores.emergencyStop.get(ownerId),
    };
  }

  // ── Observation (read-only composition) ───────────────────────────────────

  observe(ownerId: string): ObservationSnapshot {
    return {
      ownerId,
      observedAt: this.now(),
      providerHealth: this.fabric.allProviderHealth(),
      cost: this.fabric.costSnapshot(ownerId),
      pendingApprovals: this.brain.listTasksWithApprovals(ownerId),
      activeRecommendations: this.proactive.listRecommendations(ownerId).length,
      outcomeCount: this.brain.outcomeCount(ownerId),
      emergencyStopEngaged: this.emergencyStop.isEngaged(ownerId),
    };
  }

  // ── Gate (one decision composing existing authorities) ────────────────────

  gateAction(input: GateActionInput): GateDecision {
    return this.gate.gate(input);
  }

  // ── Bounded cycle: observe → refresh → propose → gate. NEVER executes. ────

  async cycle(
    ownerId: string,
    opts?: { runDiscovery?: boolean },
  ): Promise<ControlResult<CycleOutcome>> {
    const observed = this.observe(ownerId);
    if (observed.emergencyStopEngaged) {
      return ok({
        ownerId,
        ranAt: this.now(),
        observed,
        proposed: [],
        blockedByPolicy: 0,
        blockedByBudget: 0,
        waitingForApproval: 0,
        emergencyStopped: true,
        executedNothing: true,
      });
    }

    const settings = this.stores.settings.get(ownerId);
    // Refresh existing recommendations (bounded, idempotent, no discovery
    // unless explicitly requested — SPRINT-030 cadence discipline).
    await this.proactive.refresh(ownerId, { runDiscovery: opts?.runDiscovery ?? false });
    const recommendations = this.proactive
      .listRecommendations(ownerId)
      .slice(0, MAX_CYCLE_RECOMMENDATIONS);

    let blockedByPolicy = 0;
    let blockedByBudget = 0;
    let waitingForApproval = 0;
    const proposed: CycleOutcome['proposed'] = [];

    for (const rec of recommendations) {
      const decision = this.gate.gate({
        ownerId,
        action: rec.title,
        category: rec.category,
        settings,
        emergencyStop: this.emergencyStop,
        emergencyStopEngaged: false,
        cost: observed.cost,
      });
      if (decision.verdict === 'BLOCKED_BY_POLICY') blockedByPolicy += 1;
      if (decision.verdict === 'BLOCKED_BY_BUDGET') blockedByBudget += 1;
      if (decision.verdict === 'WAITING_FOR_APPROVAL') waitingForApproval += 1;
      proposed.push({
        id: rec.id,
        title: rec.title,
        category: rec.category,
        verdict: decision.verdict,
      });
    }

    return ok({
      ownerId,
      ranAt: this.now(),
      observed,
      proposed,
      blockedByPolicy,
      blockedByBudget,
      waitingForApproval,
      emergencyStopped: false,
      executedNothing: true,
    });
  }

  // ── Opportunity lifecycle ─────────────────────────────────────────────────

  listOpportunities(ownerId: string): OpportunityLifecycleRecord[] {
    return this.opportunities.list(ownerId);
  }

  discoverOpportunity(input: {
    ownerId: string;
    title: string;
    description: string;
    category: string;
    evidence: Array<{ label: string; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' }>;
    confidence?: number;
    estimatedValue?: { label: string; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' };
    estimatedCost?: { label: string; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' };
    estimatedEffort?: { label: string; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' };
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
    automationPotential: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
    recommendedWorkflow?: string[];
  }): OpportunityLifecycleRecord {
    return this.opportunities.discover(input);
  }

  transitionOpportunity(input: {
    ownerId: string;
    id: string;
    to: OpportunityStatus;
    note: string;
    approval?: { id: string; grantedBy: string; grantedAt: string; scope: string };
    execution?: { id: string; completedAt: string; verified: boolean };
  }): TransitionResult {
    return this.opportunities.transition(input);
  }

  // ── TODAY briefing (composed, no-spam) ────────────────────────────────────

  todayBriefing(ownerId: string): {
    date: string;
    emergencyStopEngaged: boolean;
    settingsConfirmed: boolean;
    autonomyLevel: number;
    pendingApprovals: Array<{ taskId: string; title: string; approvalRequired: string[] }>;
    opportunities: Array<{ title: string; status: string; category: string }>;
    providerHealth: Array<{ providerId: string; state: string }>;
    cost: { dailyUsd?: number; providerUsd?: number };
    outcomes: number;
    recommendedNextAction: string;
    hasContent: boolean;
  } {
    const observed = this.observe(ownerId);
    const settings = this.stores.settings.get(ownerId);
    const opportunities = this.opportunities
      .list(ownerId)
      .filter((o) => o.status !== 'REJECTED' && o.status !== 'COMPLETED')
      .slice(0, 5);
    const contentLines: string[] = [];
    if (observed.pendingApprovals.length > 0) contentLines.push('pending approvals');
    if (opportunities.length > 0) contentLines.push('active opportunities');
    if (
      observed.providerHealth.some((h) => h.state === 'UNAVAILABLE' || h.state === 'MISCONFIGURED')
    ) {
      contentLines.push('provider health attention');
    }
    const hasContent = contentLines.length > 0;

    return {
      date: this.now(),
      emergencyStopEngaged: observed.emergencyStopEngaged,
      settingsConfirmed: settings?.userConfirmed ?? false,
      autonomyLevel: settings?.autonomyLevel ?? 0,
      pendingApprovals: observed.pendingApprovals,
      opportunities: opportunities.map((o) => ({
        title: o.title,
        status: o.status,
        category: o.category,
      })),
      providerHealth: observed.providerHealth,
      cost: observed.cost,
      outcomes: observed.outcomeCount,
      recommendedNextAction: hasContent
        ? `Review ${contentLines.join(' · ')}`
        : 'Nothing requires attention right now.',
      hasContent,
    };
  }
}
