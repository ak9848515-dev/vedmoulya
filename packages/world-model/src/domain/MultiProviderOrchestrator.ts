// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · MultiProviderOrchestrator (SPRINT-036)
//
// The composition seam that makes provider orchestration SAFE, DYNAMIC,
// COST-AWARE, PRIVACY-AWARE, CAPABILITY-AWARE, EXPLAINABLE and BOUNDED —
// WITHOUT a new engine. It composes ONLY the existing authorities:
//
//   • WorkflowFactory.decompose        → bounded decomposition proposal
//   • fabric.validateWorkflow          → the EXISTING WorkflowBounds
//   • fabric.selectStrategy            → advisory per-step provider selection
//   • action.classify                  → the EXISTING ActionClassPolicy (A/B/C/D)
//   • decideRetryPolicy (this file)    → a DETERMINISTIC bounded response table
//
// The produced OrchestrationPlan is a REPRESENTATION:
//   `executed:false` + `authorizationRequired:true` are structural — this
//   layer never calls a provider, never spends, never approves, never grants
//   authority. The runtime path remains the EXISTING execution bridge; the
//   plan only plans, explains and bounds.
//
// Provider health is never fabricated: the fabric reports UNKNOWN until real
// runtime evidence exists. Privacy overrides cost: a PRIVATE task is never
// silently fallen back to a public provider — the honest result is
// NO_SELECTION / STOP with the reason exposed.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  OrchestratedProviderState,
  OrchestratedStep,
  OrchestrationFailureMode,
  OrchestrationPlan,
  RetryPolicyDecision,
} from '../types/world-types.js';
import type { WorldActionPort, WorldFabricPort } from '../contracts/world-ports.js';
import { WorkflowFactory, planWithinBounds } from './WorkflowFactory.js';

export type SelectionStrategyKind = 'CHEAP' | 'FAST' | 'QUALITY' | 'PRIVATE' | 'BALANCED';
export type PrivacyClass = 'PUBLIC' | 'INTERNAL' | 'SENSITIVE' | 'PRIVATE';

export const MAX_ORCHESTRATION_RETRIES = 3;
export const ORCHESTRATION_STEPS_LIMIT = 24;

export interface OrchestrateInput {
  ownerId: string;
  goal: string;
  steps: Array<{
    id: string;
    label: string;
    capability?: string;
    roleName?: string;
    privacyClass?: PrivacyClass;
    verificationRequirement?: string;
  }>;
  strategy: SelectionStrategyKind;
  estimatedCostUsd?: number;
  estimatedTimeMs?: number;
  /** Bounded retries per step (never endless) — defaults to 2. */
  maxRetries?: number;
}

export type OrchestrateResult<T> =
  { success: true; data: T } | { success: false; error: string; code: string };

function ok<T>(data: T): OrchestrateResult<T> {
  return { success: true, data };
}
function err<T>(error: string, code = 'ORCHESTRATION_ERROR'): OrchestrateResult<T> {
  return { success: false, error, code };
}

/** Deterministic slug for stable keys. */
function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** Map the fabric's observed health state to the honest plan-level state. */
export function mapProviderState(
  healthState: 'UNKNOWN' | 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'MISCONFIGURED' | undefined,
): OrchestratedProviderState {
  switch (healthState) {
    case 'HEALTHY':
      return 'AVAILABLE';
    case 'DEGRADED':
      return 'DEGRADED';
    case 'UNAVAILABLE':
      return 'UNAVAILABLE';
    case 'MISCONFIGURED':
      return 'ERROR';
    default:
      return 'UNKNOWN';
  }
}

/**
 * The deterministic bounded response to one failure mode (SPRINT-036 §9-10).
 *
 *   • NEVER retried:        policy denial, cost rejection, malformed
 *                           permanent request (a retry cannot fix them).
 *   • CAREFULLY retried:    network timeout, temporary provider unavailable,
 *                           transient rate limit, provider error — bounded
 *                           (≤ maxRetries), then FALLBACK if the fallback is
 *                           privacy-safe and cost-safe, else STOP.
 *   • Quota exhausted:      never fixed by a retry → FALLBACK (privacy-safe)
 *                           or STOP.
 *   • Verification          NEEDS_REVIEW — a disagreement never auto-resolves
 *     disagreement:         by price; the existing verification authority
 *                           remains authoritative.
 *
 * Privacy is absolute: a PRIVATE/SENSITIVE step falls back ONLY to a
 * provider that respects the privacy class (local/PRIVATE candidate). With
 * no privacy-safe fallback the honest decision is STOP — never a silent
 * drop to a public cloud provider.
 */
export function decideRetryPolicy(input: {
  failureMode: OrchestrationFailureMode;
  privacyClass: PrivacyClass;
  retriesSoFar: number;
  maxRetries: number;
  /** True when a fallback candidate exists on the fabric's ranked list. */
  fallbackAvailable: boolean;
  /** True when the fallback candidate respects the step's privacy class. */
  fallbackPrivacySafe: boolean;
  /** True when a fallback would exceed the workflow cost bound. */
  costCapped?: boolean;
}): RetryPolicyDecision {
  const retriesLeft = Math.max(input.maxRetries - input.retriesSoFar, 0);
  const privacySensitive = input.privacyClass === 'PRIVATE' || input.privacyClass === 'SENSITIVE';

  // Absolute rules — never retried.
  if (input.failureMode === 'POLICY_REJECTION' || input.failureMode === 'COST_REJECTION') {
    return {
      failureMode: input.failureMode,
      action: 'STOP',
      reason: 'A policy/cost denial is never retried — the existing authority said no.',
      retriesAllowed: 0,
      fallbackAllowed: false,
    };
  }
  if (input.failureMode === 'MALFORMED_RESPONSE' || input.failureMode === 'INVALID_JSON') {
    return {
      failureMode: input.failureMode,
      action: 'STOP',
      reason: 'A malformed permanent request is never retried — the input/response is invalid.',
      retriesAllowed: 0,
      fallbackAllowed: false,
    };
  }
  if (input.failureMode === 'VERIFICATION_DISAGREEMENT') {
    return {
      failureMode: input.failureMode,
      action: 'NEEDS_REVIEW',
      reason:
        'Providers disagreed — the result needs human/authority review, never auto-resolved by price.',
      retriesAllowed: 0,
      fallbackAllowed: false,
    };
  }

  // Transient failures — bounded retry, then privacy/cost-safe fallback.
  const transient = [
    'TIMEOUT',
    'NETWORK_FAILURE',
    'RATE_LIMIT',
    'PROVIDER_UNAVAILABLE',
    'PROVIDER_ERROR',
  ].includes(input.failureMode);

  if (input.failureMode === 'QUOTA_EXHAUSTED') {
    // A retry cannot restore quota — go straight to a safe fallback.
    if (input.costCapped) {
      return {
        failureMode: input.failureMode,
        action: 'STOP',
        reason: 'Quota exhausted and a fallback would exceed the workflow cost bound.',
        retriesAllowed: 0,
        fallbackAllowed: false,
        fallbackBlockedReason: 'cost bound',
      };
    }
    if (input.fallbackAvailable && (!privacySensitive || input.fallbackPrivacySafe)) {
      return {
        failureMode: input.failureMode,
        action: 'FALLBACK',
        reason:
          'Quota exhausted — falling back to an available, privacy-safe provider (retry cannot restore quota).',
        retriesAllowed: 0,
        fallbackAllowed: true,
      };
    }
    return {
      failureMode: input.failureMode,
      action: 'STOP',
      reason: privacySensitive
        ? 'Quota exhausted and no privacy-safe fallback exists — never silently dropping to a less-private provider.'
        : 'Quota exhausted and no fallback candidate exists.',
      retriesAllowed: 0,
      fallbackAllowed: false,
      fallbackBlockedReason: privacySensitive ? 'privacy' : 'no candidate',
    };
  }

  if (transient) {
    if (retriesLeft > 0) {
      return {
        failureMode: input.failureMode,
        action: 'RETRY',
        reason: `Transient failure — bounded retry (${retriesLeft} left, max ${input.maxRetries}).`,
        retriesAllowed: retriesLeft,
        fallbackAllowed: false,
      };
    }
    if (input.costCapped) {
      return {
        failureMode: input.failureMode,
        action: 'STOP',
        reason: 'Bounded retries exhausted and a fallback would exceed the workflow cost bound.',
        retriesAllowed: 0,
        fallbackAllowed: false,
        fallbackBlockedReason: 'cost bound',
      };
    }
    if (input.fallbackAvailable && (!privacySensitive || input.fallbackPrivacySafe)) {
      return {
        failureMode: input.failureMode,
        action: 'FALLBACK',
        reason: 'Bounded retries exhausted — falling back to an available, privacy-safe provider.',
        retriesAllowed: 0,
        fallbackAllowed: true,
      };
    }
    return {
      failureMode: input.failureMode,
      action: 'STOP',
      reason: privacySensitive
        ? 'Bounded retries exhausted and no privacy-safe fallback exists — never silently dropping to a less-private provider.'
        : 'Bounded retries exhausted and no fallback candidate exists.',
      retriesAllowed: 0,
      fallbackAllowed: false,
      fallbackBlockedReason: privacySensitive ? 'privacy' : 'no candidate',
    };
  }

  // Unknown failure mode — never invented behavior.
  return {
    failureMode: input.failureMode,
    action: 'STOP',
    reason: 'Unhandled failure mode — stopping honestly rather than guessing.',
    retriesAllowed: 0,
    fallbackAllowed: false,
  };
}

const ALL_FAILURE_MODES: OrchestrationFailureMode[] = [
  'TIMEOUT',
  'RATE_LIMIT',
  'QUOTA_EXHAUSTED',
  'PROVIDER_UNAVAILABLE',
  'MALFORMED_RESPONSE',
  'INVALID_JSON',
  'PROVIDER_ERROR',
  'NETWORK_FAILURE',
  'POLICY_REJECTION',
  'COST_REJECTION',
  'VERIFICATION_DISAGREEMENT',
];

export interface MultiProviderOrchestratorOptions {
  fabric: WorldFabricPort;
  action: WorldActionPort;
  now?: () => string;
}

/**
 * Produces a bounded, owner-scoped, EXPLAINABLE multi-provider orchestration
 * plan by composing the existing authorities. The plan is a REPRESENTATION —
 * it never executes, never spends, never approves.
 */
export class MultiProviderOrchestrator {
  private readonly fabric: WorldFabricPort;
  private readonly action: WorldActionPort;
  private readonly factory: WorkflowFactory;
  private readonly now: () => string;

  constructor(options: MultiProviderOrchestratorOptions) {
    this.fabric = options.fabric;
    this.action = options.action;
    this.factory = new WorkflowFactory();
    this.now = options.now ?? ((): string => new Date().toISOString());
  }

  async plan(input: OrchestrateInput): Promise<OrchestrateResult<OrchestrationPlan>> {
    const goal = input.goal.trim();
    if (goal.length === 0) return err('An orchestration plan needs a goal.');
    if (input.steps.length === 0) return err('An orchestration plan needs at least one step.');
    if (input.steps.length > ORCHESTRATION_STEPS_LIMIT) {
      return err(
        `An orchestration plan cannot exceed ${ORCHESTRATION_STEPS_LIMIT} steps (SPRINT-030 bound).`,
      );
    }
    const maxRetries = Math.min(Math.max(input.maxRetries ?? 2, 0), MAX_ORCHESTRATION_RETRIES);

    // 1. Bounded decomposition through the EXISTING factory.
    const decomposed = this.factory.decompose({
      ownerId: input.ownerId,
      goal,
      steps: input.steps.map((s) => ({
        label: s.label,
        capability: s.capability,
        roleName: s.roleName,
      })),
      estimatedCostUsd: input.estimatedCostUsd,
      estimatedTimeMs: input.estimatedTimeMs,
    });
    if (!decomposed.success) return err(decomposed.error);

    // 2. Bounds through the EXISTING fabric WorkflowBounds (authoritative).
    const fabricDecision = this.fabric.validateWorkflow(decomposed.data.plan);
    const localDecision = planWithinBounds(decomposed.data.plan);
    const allowed = fabricDecision.allowed && localDecision.allowed;
    const exceeded = fabricDecision.exceeded ?? localDecision.exceeded;

    // 3. Per-step advisory selection through the EXISTING fabric strategy.
    const orchestrated: OrchestratedStep[] = [];
    let estimatedTotalUsd = 0;
    let estimatedCount = 0;
    const providers = new Set<string>();

    for (const step of input.steps) {
      if (!step.capability) continue; // non-AI step — human/manual, out of scope
      const privacyClass =
        step.privacyClass ?? (input.strategy === 'PRIVATE' ? 'PRIVATE' : 'INTERNAL');
      let selection;
      try {
        selection = await this.fabric.selectStrategy({
          strategy: input.strategy,
          taskPrivacy: privacyClass,
          capability: step.capability,
        });
      } catch {
        return err(
          'The intelligence fabric is unavailable — no orchestration can be advised.',
          'FABRIC_UNAVAILABLE',
        );
      }
      const selected = selection.selected;
      if (selected) providers.add(selected.providerId);

      // Privacy-safe fallback check: for PRIVATE/SENSITIVE steps a fallback is
      // only allowed to a local/PRIVATE-ranked candidate — never a public one.
      const privacySensitive = privacyClass === 'PRIVATE' || privacyClass === 'SENSITIVE';
      const fallbackCandidate = selection.ranked.find((c) => c.providerId !== selected?.providerId);
      const fallbackAvailable = fallbackCandidate !== undefined;
      const fallbackPrivacySafe = privacySensitive
        ? fallbackCandidate?.privacyClass === 'PRIVATE' ||
          fallbackCandidate?.localAvailability === 'yes'
        : true;
      const fallbackProviderId =
        fallbackAvailable && fallbackPrivacySafe ? fallbackCandidate.providerId : undefined;

      const policy = ALL_FAILURE_MODES.map((failureMode) =>
        decideRetryPolicy({
          failureMode,
          privacyClass,
          retriesSoFar: 0,
          maxRetries,
          fallbackAvailable,
          fallbackPrivacySafe,
        }),
      );

      const expectedCostUsd = selected?.estimatedCostUsd;
      if (expectedCostUsd !== undefined) {
        estimatedTotalUsd += expectedCostUsd;
        estimatedCount += 1;
      }

      // The EXISTING ActionClassPolicy decides the class — provider output can
      // never change it (structural).
      let actionClass: 'A' | 'B' | 'C' | 'D' = 'A';
      try {
        const classified = this.action.classify(step.label);
        actionClass = classified.actionClass;
      } catch {
        // The authority is unavailable — the step stays at the safest default.
        actionClass = 'D';
      }

      orchestrated.push({
        stepId: step.id,
        label: step.label,
        capability: step.capability,
        roleName: step.roleName,
        providerId: selected?.providerId,
        modelId: selected?.modelId,
        fallbackProviderId,
        strategy: selection.strategy,
        reasons: selection.reasons.slice(0, 4),
        expectedCostUsd,
        actionClass,
        privacyClass,
        providerState: selected ? mapProviderState(selected.healthState) : 'UNAVAILABLE',
        retryPolicy: policy,
        verificationRequirement: step.verificationRequirement,
      });
    }

    if (orchestrated.length === 0) {
      return err('None of the steps are AI-served — nothing to orchestrate.', 'NO_AI_STEPS');
    }

    const ts = this.now();
    const plan: OrchestrationPlan = {
      id: `orchestration-${Math.random().toString(36).slice(2, 10)}`,
      ownerId: input.ownerId,
      stableKey: `${input.ownerId}:orchestration:${slug(goal)}:${input.strategy.toLowerCase()}`,
      goal: goal.slice(0, 300),
      strategy: input.strategy,
      steps: orchestrated,
      bounds: {
        allowed,
        reason: allowed
          ? 'The orchestration is within all workflow bounds.'
          : fabricDecision.exceeded
            ? fabricDecision.reason
            : localDecision.reason,
        exceeded,
      },
      // Evidence-only sum: UNKNOWN costs are excluded (never treated as 0).
      estimatedCostUsd: estimatedCount > 0 ? round4(estimatedTotalUsd) : undefined,
      estimatedTimeMs: decomposed.data.plan.estimatedTimeMs,
      providerCount: providers.size,
      costPolicy: {
        allowed,
        reason: allowed
          ? 'Within the workflow cost bound; per-call enforcement stays with the existing CostPolicyGuard / RunBudgetGuard at execution.'
          : fabricDecision.exceeded === 'cost'
            ? 'Estimated cost exceeds the workflow bound.'
            : 'Bounds decision applies.',
      },
      status: 'PLANNED',
      executed: false,
      authorizationRequired: true,
      createdAt: ts,
      updatedAt: ts,
    };
    return ok(plan);
  }
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
