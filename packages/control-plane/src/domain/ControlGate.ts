// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Control Plane · ControlGate
// SPRINT-031 — ONE fail-closed gate that composes the EXISTING authorities
// into a single decision. It owns no authority — it only combines:
//
//   1. EmergencyStop (SPRINT-031, audited)
//   2. User autonomy settings (SPRINT-031, explicit + confirmed)
//   3. AutonomyPolicy (SPRINT-030 — A/B/C/D over frozen SENSITIVE_ACTIONS)
//   4. CostPolicyGuard (SPRINT-030 — measure-only caps)
//
// The verdict vocabulary is explicit: ALLOWED / WAITING_FOR_APPROVAL /
// BLOCKED_BY_POLICY / BLOCKED_BY_BUDGET / EMERGENCY_STOP / NEEDS_REVIEW.
// NEVER does a gate output authorize execution: a class C action that passes
// every check still returns WAITING_FOR_APPROVAL (the existing approval
// authority decides); class D is always blocked. The gate is deterministic —
// same inputs, same verdict.
// ─────────────────────────────────────────────────────────────────────────────

import type { AutonomyLevel } from '@vedmoulya/intelligence-fabric';
import { AutonomyPolicy, CostPolicyGuard } from '@vedmoulya/intelligence-fabric';
import type { AutonomySettings, GateDecision } from '../types/control-types.js';
import type { EmergencyStop } from './EmergencyStop.js';

export interface ControlGateOptions {
  autonomy?: AutonomyPolicy;
  costGuard?: CostPolicyGuard;
  now?: () => string;
}

export interface GateActionInput {
  ownerId: string;
  /** The action text (classified by the existing ActionClassPolicy). */
  action: string;
  /** The recommendation category the action belongs to. */
  category: string;
  /** The user's explicit, persisted autonomy settings. */
  settings: AutonomySettings | undefined;
  /** Emergency stop controller (fail-closed). */
  emergencyStop: EmergencyStop;
  /** Whether the emergency stop is engaged for this owner. */
  emergencyStopEngaged: boolean;
  /** Current spend snapshot for cost checks (from the existing CostLedger). */
  cost?: { dailyUsd?: number; taskUsd?: number; providerUsd?: number };
  /** Estimated additional cost (undefined = UNKNOWN — honest handling). */
  additionalUsd?: number;
  /** Provider the action would use (for provider restrictions). */
  providerId?: string;
  /** Explicit user-authorization record for class B (REQUIRED for B). */
  userAuthorization?: { id: string; grantedAt: string; scope: string };
  /** Current autonomy level (defaults to the settings level). */
  currentLevel?: AutonomyLevel;
}

export class ControlGate {
  private readonly autonomy: AutonomyPolicy;
  private readonly costGuard: CostPolicyGuard;
  private readonly now: () => string;

  constructor(options: ControlGateOptions = {}) {
    this.autonomy = options.autonomy ?? new AutonomyPolicy();
    this.costGuard = options.costGuard ?? new CostPolicyGuard();
    this.now = options.now ?? ((): string => new Date().toISOString());
  }

  gate(input: GateActionInput): GateDecision {
    const reasons: string[] = [];
    const authorities: string[] = [];

    // 1. Emergency stop — fail-closed: engaged → everything blocked.
    if (input.emergencyStopEngaged) {
      return {
        verdict: 'EMERGENCY_STOP',
        allowed: false,
        reasons: ['Emergency stop is ENGAGED for this owner — autonomous pathways are halted.'],
        authorities: ['EMERGENCY_STOP'],
        approvalRequired: false,
      };
    }

    // 2. Settings must exist and be confirmed — missing/unconfirmed = no grant.
    const settings = input.settings;
    if (!settings || !settings.userConfirmed) {
      return {
        verdict: 'BLOCKED_BY_POLICY',
        allowed: false,
        reasons: [
          'Autonomy settings are missing or unconfirmed — no autonomy is granted without explicit user confirmation.',
        ],
        authorities: ['AUTONOMY_SETTINGS'],
        approvalRequired: false,
      };
    }

    // 3. Prohibited categories — hard policy, never overridden.
    if ((settings.prohibitedCategories ?? []).includes(input.category)) {
      return {
        verdict: 'BLOCKED_BY_POLICY',
        allowed: false,
        reasons: [`Category ${input.category} is prohibited by the user's autonomy settings.`],
        authorities: ['AUTONOMY_SETTINGS'],
        approvalRequired: false,
      };
    }
    // Allowed categories (when configured) — an action outside them is blocked.
    const allowed = settings.allowedCategories ?? [];
    if (allowed.length > 0 && !allowed.includes(input.category)) {
      return {
        verdict: 'BLOCKED_BY_POLICY',
        allowed: false,
        reasons: [`Category ${input.category} is not in the user's allowed categories.`],
        authorities: ['AUTONOMY_SETTINGS'],
        approvalRequired: false,
      };
    }

    // 4. Provider restrictions.
    const prohibitedProviders = settings.prohibitedProviders ?? [];
    if (input.providerId && prohibitedProviders.includes(input.providerId)) {
      return {
        verdict: 'BLOCKED_BY_POLICY',
        allowed: false,
        reasons: [`Provider ${input.providerId} is prohibited by the user's autonomy settings.`],
        authorities: ['AUTONOMY_SETTINGS'],
        approvalRequired: false,
      };
    }
    const allowedProviders = settings.allowedProviders ?? [];
    if (
      input.providerId &&
      allowedProviders.length > 0 &&
      !allowedProviders.includes(input.providerId)
    ) {
      return {
        verdict: 'BLOCKED_BY_POLICY',
        allowed: false,
        reasons: [`Provider ${input.providerId} is not in the user's allowed providers.`],
        authorities: ['AUTONOMY_SETTINGS'],
        approvalRequired: false,
      };
    }

    // 5. Privacy-first: private-only settings forbid any external provider use.
    if (
      settings.privateOnly &&
      input.providerId &&
      !input.providerId.toLowerCase().includes('local')
    ) {
      return {
        verdict: 'BLOCKED_BY_POLICY',
        allowed: false,
        reasons: ['privateOnly is enabled — remote provider use is blocked.'],
        authorities: ['AUTONOMY_SETTINGS'],
        approvalRequired: false,
      };
    }

    // 6. Cost caps (fail-closed, measure-only).
    const currentLevel = input.currentLevel ?? settings.autonomyLevel;
    const costDecision = this.costGuard.check({
      additionalUsd: input.additionalUsd,
      providerId: input.providerId,
      limits: {
        maxDailyCostUsd: settings.maxDailyCostUsd,
        maxTaskCostUsd: settings.maxTaskCostUsd,
      },
      current: input.cost ?? {},
    });
    if (!costDecision.allowed) {
      return {
        verdict: 'BLOCKED_BY_BUDGET',
        allowed: false,
        reasons: [costDecision.reason],
        authorities: ['COST_POLICY_GUARD'],
        approvalRequired: false,
      };
    }
    reasons.push(costDecision.reason);

    // 7. The EXISTING autonomy policy (A/B/C/D classification + level gate).
    const autonomyDecision = this.autonomy.gate({
      currentLevel,
      action: input.action,
      userAuthorization: input.userAuthorization,
    });
    authorities.push(autonomyDecision.authority);
    if (!autonomyDecision.allowed) {
      return {
        verdict: 'BLOCKED_BY_POLICY',
        actionClass: autonomyDecision.actionClass,
        allowed: false,
        reasons: autonomyDecision.reasons,
        authorities,
        approvalRequired: autonomyDecision.actionClass === 'C',
      };
    }
    reasons.push(...autonomyDecision.reasons);

    // 8. Class C always requires the EXISTING approval authority.
    if (autonomyDecision.actionClass === 'C') {
      return {
        verdict: 'WAITING_FOR_APPROVAL',
        actionClass: 'C',
        allowed: false,
        reasons: [
          ...reasons,
          'Class C action — execution requires the existing approval authority; this gate only ASKS.',
        ],
        authorities,
        approvalRequired: true,
      };
    }

    return {
      verdict: 'ALLOWED',
      actionClass: autonomyDecision.actionClass,
      allowed: true,
      reasons,
      authorities,
      approvalRequired: autonomyDecision.actionClass === 'B',
    };
  }
}
