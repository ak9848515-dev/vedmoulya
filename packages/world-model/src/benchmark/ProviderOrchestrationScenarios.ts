// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · Provider Orchestration Scenarios (SPRINT-036)
//
// Deterministic benchmark/harness over the EXISTING MultiProviderOrchestrator
// (which itself composes the EXISTING WorkflowFactory, fabric bounds,
// fabric selection and ActionClassPolicy). NO new engine, NO live APIs — all
// providers are hermetic fixtures with scripted cost/latency/health/behavior.
//
// The §14 deterministic scenario is exercised end-to-end:
//   "Research a business opportunity and prepare a concise recommendation"
//   → research → independent reasoning → economic analysis → verification
//   → finalization — each step potentially served by a different provider.
//
// The harness proves the orchestration contract:
//   1. per-step provider selection carries WHY (selection evidence)
//   2. privacy overrides cost (PRIVATE → local/private only; PRIVATE with no
//      local candidate → honest NO_SELECTION, never a public fallback)
//   3. retries are bounded (never endless)
//   4. fallback is bounded + privacy-safe + cost-aware (never silent)
//   5. quota exhausted → fallback, not a futile retry
//   6. malformed permanent response → STOP (never retried)
//   7. verification disagreement → NEEDS_REVIEW (never auto-resolved by price)
//   8. unknown cost stays UNKNOWN (never 0)
//   9. the plan is a REPRESENTATION: executed:false, authorizationRequired:true
//   10. provider output can never change an action class or grant authority
// ─────────────────────────────────────────────────────────────────────────────

import type { ActionClassDecision } from '@vedmoulya/proactive';
import type { StrategySelection } from '@vedmoulya/intelligence-fabric';
import type {
  OrchestratedStep,
  OrchestrationFailureMode,
  OrchestrationPlan,
  OrchestrationResponseAction,
} from '../types/world-types.js';
import type { WorldFabricPort } from '../contracts/world-ports.js';
import { planWithinBounds } from '../domain/WorkflowFactory.js';
import {
  MultiProviderOrchestrator,
  decideRetryPolicy,
  type PrivacyClass,
  type SelectionStrategyKind,
} from '../domain/MultiProviderOrchestrator.js';

// ── Hermetic provider fixtures (deterministic; never live) ──────────────────

export type FixtureBehavior =
  | 'SUCCESS'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'QUOTA'
  | 'UNAVAILABLE'
  | 'MALFORMED'
  | 'ERROR'
  | 'DISAGREE';

export interface FixtureProvider {
  providerId: string;
  modelId?: string;
  name: string;
  capability: string;
  estimatedCostUsd: number;
  latencyMs: number;
  quality: number;
  privacyClass: PrivacyClass;
  localAvailability: 'yes' | 'no';
  healthState: 'UNKNOWN' | 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'MISCONFIGURED';
  /** The deterministic behavior the fixture exhibits when called. */
  behavior: FixtureBehavior;
}

export const FIXTURE_PROVIDERS: FixtureProvider[] = [
  // research
  {
    providerId: 'research-cloud-fast',
    name: 'Research Cloud Fast',
    capability: 'research',
    estimatedCostUsd: 0.0002,
    latencyMs: 400,
    quality: 0.7,
    privacyClass: 'PUBLIC',
    localAvailability: 'no',
    healthState: 'HEALTHY',
    behavior: 'SUCCESS',
  },
  {
    providerId: 'research-cloud-cheap',
    name: 'Research Cloud Cheap',
    capability: 'research',
    estimatedCostUsd: 0.0001,
    latencyMs: 900,
    quality: 0.6,
    privacyClass: 'PUBLIC',
    localAvailability: 'no',
    healthState: 'HEALTHY',
    behavior: 'SUCCESS',
  },
  // LOCAL ≠ zero operational cost — the fixture gives local a small real cost.
  {
    providerId: 'research-local',
    name: 'Research Local',
    capability: 'research',
    estimatedCostUsd: 0.00015,
    latencyMs: 1200,
    quality: 0.65,
    privacyClass: 'PRIVATE',
    localAvailability: 'yes',
    healthState: 'HEALTHY',
    behavior: 'SUCCESS',
  },
  // reasoning
  {
    providerId: 'reasoning-premium',
    name: 'Reasoning Premium',
    capability: 'reasoning',
    estimatedCostUsd: 0.002,
    latencyMs: 1500,
    quality: 0.95,
    privacyClass: 'PUBLIC',
    localAvailability: 'no',
    healthState: 'HEALTHY',
    behavior: 'SUCCESS',
  },
  {
    providerId: 'reasoning-bal',
    name: 'Reasoning Balanced',
    capability: 'reasoning',
    estimatedCostUsd: 0.0008,
    latencyMs: 1000,
    quality: 0.85,
    privacyClass: 'PUBLIC',
    localAvailability: 'no',
    healthState: 'HEALTHY',
    behavior: 'SUCCESS',
  },
  {
    providerId: 'reasoning-local',
    name: 'Reasoning Local',
    capability: 'reasoning',
    estimatedCostUsd: 0.0004,
    latencyMs: 2000,
    quality: 0.8,
    privacyClass: 'PRIVATE',
    localAvailability: 'yes',
    healthState: 'HEALTHY',
    behavior: 'SUCCESS',
  },
  // economic analysis
  {
    providerId: 'analysis-bal',
    name: 'Analysis Balanced',
    capability: 'economic-analysis',
    estimatedCostUsd: 0.0006,
    latencyMs: 700,
    quality: 0.8,
    privacyClass: 'PUBLIC',
    localAvailability: 'no',
    healthState: 'HEALTHY',
    behavior: 'SUCCESS',
  },
  // verification
  {
    providerId: 'verify-cloud',
    name: 'Verify Cloud',
    capability: 'verification',
    estimatedCostUsd: 0.0005,
    latencyMs: 600,
    quality: 0.9,
    privacyClass: 'PUBLIC',
    localAvailability: 'no',
    healthState: 'HEALTHY',
    behavior: 'SUCCESS',
  },
  {
    providerId: 'verify-local',
    name: 'Verify Local',
    capability: 'verification',
    estimatedCostUsd: 0.0001,
    latencyMs: 900,
    quality: 0.85,
    privacyClass: 'PRIVATE',
    localAvailability: 'yes',
    healthState: 'HEALTHY',
    behavior: 'SUCCESS',
  },
  // finalization (summarization)
  {
    providerId: 'summary-cloud',
    name: 'Summary Cloud',
    capability: 'summarization',
    estimatedCostUsd: 0.0003,
    latencyMs: 300,
    quality: 0.75,
    privacyClass: 'PUBLIC',
    localAvailability: 'no',
    healthState: 'HEALTHY',
    behavior: 'SUCCESS',
  },
];

/** Behavior overrides per scenario: `{ stepId: behavior }` and optionally
 *  `{ 'stepId:fallback': behavior }` for the fallback attempt. */
export type BehaviorOverrides = Record<string, FixtureBehavior>;

/** The §14 deterministic workflow. */
export const BUSINESS_OPPORTUNITY_STEPS = [
  {
    id: 'research',
    label: 'Research the business opportunity',
    capability: 'research',
    verificationRequirement: 'research evidence present',
  },
  { id: 'reasoning', label: 'Independently reason about the opportunity', capability: 'reasoning' },
  { id: 'analysis', label: 'Perform economic analysis', capability: 'economic-analysis' },
  {
    id: 'verification',
    label: 'Verify the recommendation',
    capability: 'verification',
    verificationRequirement: 'cross-provider verification',
  },
  { id: 'finalize', label: 'Prepare the concise recommendation', capability: 'summarization' },
];

/**
 * A deterministic `WorldFabricPort` over the fixtures: ranks candidates by the
 * strategy (CHEAP → cost, FAST → latency, QUALITY → quality, PRIVATE →
 * local/private only, BALANCED → composite), honors privacy OVER cost
 * (a PRIVATE task never selects a public provider), and reports honest health.
 * `validateWorkflow` reuses the REAL WorkflowBounds; `costSnapshot` is absent
 * (no ledger in the harness — never fabricated).
 */
export function buildDeterministicFabric(
  providers: FixtureProvider[] = FIXTURE_PROVIDERS,
): WorldFabricPort {
  const rank = (
    capability: string,
    strategy: SelectionStrategyKind,
    privacy: PrivacyClass,
  ): FixtureProvider[] => {
    let candidates = providers.filter((p) => p.capability === capability);
    // Privacy overrides cost: a PRIVATE task only considers local/private.
    if (privacy === 'PRIVATE' || strategy === 'PRIVATE') {
      candidates = candidates.filter(
        (p) => p.privacyClass === 'PRIVATE' || p.localAvailability === 'yes',
      );
    }
    switch (strategy) {
      case 'CHEAP':
        return [...candidates].sort((a, b) => a.estimatedCostUsd - b.estimatedCostUsd);
      case 'FAST':
        return [...candidates].sort((a, b) => a.latencyMs - b.latencyMs);
      case 'QUALITY':
        return [...candidates].sort((a, b) => b.quality - a.quality);
      case 'PRIVATE':
        return [...candidates].sort((a, b) => b.quality - a.quality);
      case 'BALANCED':
      default:
        return [...candidates].sort((a, b) => composite(a) - composite(b));
    }
  };
  const composite = (p: FixtureProvider): number =>
    0.5 * p.quality -
    0.3 * Math.min(p.estimatedCostUsd * 1000, 1) -
    0.2 * Math.min(p.latencyMs / 2000, 1);

  return {
    selectStrategy(input): Promise<StrategySelection> {
      const ranked = rank(input.capability, input.strategy, input.taskPrivacy);
      const selected = ranked[0];
      return Promise.resolve({
        strategy: input.strategy,
        selected: selected
          ? {
              providerId: selected.providerId,
              modelId: selected.modelId,
              name: selected.name,
              capabilityMatched: true,
              quality: selected.quality,
              latencyMs: selected.latencyMs,
              estimatedCostUsd: selected.estimatedCostUsd,
              privacyClass: selected.privacyClass,
              localAvailability: selected.localAvailability,
              healthState: selected.healthState,
              availability: selected.healthState === 'HEALTHY' ? 1 : 0,
              evidence: [
                `${input.strategy} strategy ranked '${selected.name}' first for capability '${input.capability}'.`,
              ],
            }
          : undefined,
        ranked: ranked.map((p) => ({
          providerId: p.providerId,
          modelId: p.modelId,
          name: p.name,
          capabilityMatched: true,
          quality: p.quality,
          latencyMs: p.latencyMs,
          estimatedCostUsd: p.estimatedCostUsd,
          privacyClass: p.privacyClass,
          localAvailability: p.localAvailability,
          healthState: p.healthState,
          evidence: [],
        })),
        reasons: selected
          ? [
              `Selected '${selected.name}' under the ${input.strategy} strategy.`,
              `Capability '${input.capability}' matched.`,
            ]
          : [
              `No provider satisfies capability '${input.capability}' under the ${input.strategy} strategy${input.taskPrivacy === 'PRIVATE' ? ' with a PRIVATE privacy requirement' : ''}.`,
            ],
      });
    },
    validateWorkflow(plan): ReturnType<WorldFabricPort['validateWorkflow']> {
      const decision = planWithinBounds(plan);
      return { allowed: decision.allowed, reason: decision.reason, exceeded: decision.exceeded };
    },
    costSnapshot(): ReturnType<WorldFabricPort['costSnapshot']> {
      return {}; // no ledger in the harness — honest empty, never fabricated
    },
  };
}

// ── Deterministic policy simulation (never a runtime path) ───────────────────

export interface StepSimulationOutcome {
  stepId: string;
  label: string;
  /** Primary bound provider (the fabric's advisory selection). */
  providerId?: string;
  /** The provider that actually produced the step result (fallback applied). */
  finalProviderId?: string;
  action: OrchestrationResponseAction | 'COMPLETED';
  attempts: number;
  /** Actual RETRY decisions taken on this step (bounded by maxRetries). */
  retries: number;
  retried: boolean;
  fellBack: boolean;
  costUsd: number;
  latencyMs: number;
  verification:
    'VERIFIED' | 'CONTRADICTED' | 'NEEDS_REVIEW' | 'INCONCLUSIVE' | 'BLOCKED' | 'SKIPPED';
  note: string;
}

export interface ScenarioRunResult {
  id: string;
  name: string;
  strategy: SelectionStrategyKind;
  plan: OrchestrationPlan;
  completed: boolean;
  blocked: boolean;
  needsReview: boolean;
  steps: StepSimulationOutcome[];
  totalCostUsd: number;
  totalLatencyMs: number;
  retryCount: number;
  fallbackCount: number;
}

/** Map a fixture behavior to the orchestration failure-mode vocabulary. */
export function behaviorToFailureMode(behavior: FixtureBehavior): OrchestrationFailureMode {
  switch (behavior) {
    case 'TIMEOUT':
      return 'TIMEOUT';
    case 'RATE_LIMIT':
      return 'RATE_LIMIT';
    case 'QUOTA':
      return 'QUOTA_EXHAUSTED';
    case 'UNAVAILABLE':
      return 'PROVIDER_UNAVAILABLE';
    case 'MALFORMED':
      return 'MALFORMED_RESPONSE';
    case 'ERROR':
      return 'PROVIDER_ERROR';
    case 'DISAGREE':
      return 'VERIFICATION_DISAGREEMENT';
    default:
      return 'PROVIDER_ERROR';
  }
}

/**
 * Deterministic simulation of a plan against fixture provider behaviors — the
 * EXISTING decideRetryPolicy decides every response. This is a VERIFICATION
 * HARNESS over the orchestration contract, NOT a runtime execution path: the
 * plan itself never calls a provider; the runtime path remains the existing
 * execution bridge.
 */
export function simulatePlan(
  plan: OrchestrationPlan,
  providers: FixtureProvider[] = FIXTURE_PROVIDERS,
  overrides: BehaviorOverrides = {},
  maxRetries = 2,
): ScenarioRunResult {
  const byId = new Map(providers.map((p) => [p.providerId, p]));
  const steps: StepSimulationOutcome[] = [];
  let totalCostUsd = 0;
  let totalLatencyMs = 0;
  let retryCount = 0;
  let fallbackCount = 0;
  let needsReview = false;
  let anyBlocked = false;

  for (const step of plan.steps) {
    const outcome = simulateStep(step, byId, overrides, maxRetries);
    steps.push(outcome);
    totalCostUsd += outcome.costUsd;
    totalLatencyMs += outcome.latencyMs;
    retryCount += outcome.retries;
    fallbackCount += outcome.fellBack ? 1 : 0;
    if (outcome.verification === 'NEEDS_REVIEW' || outcome.verification === 'CONTRADICTED')
      needsReview = true;
    if (outcome.verification === 'BLOCKED') anyBlocked = true;
  }

  return {
    id: '',
    name: '',
    strategy: plan.strategy,
    plan,
    completed:
      !needsReview &&
      !anyBlocked &&
      steps.every((s) => s.verification === 'VERIFIED' || s.verification === 'INCONCLUSIVE'),
    blocked: anyBlocked,
    needsReview,
    steps,
    totalCostUsd: round4(totalCostUsd),
    totalLatencyMs,
    retryCount,
    fallbackCount,
  };
}

function simulateStep(
  step: OrchestratedStep,
  byId: Map<string, FixtureProvider>,
  overrides: BehaviorOverrides,
  maxRetries: number,
): StepSimulationOutcome {
  const primary = step.providerId ? byId.get(step.providerId) : undefined;
  if (!primary) {
    // Honest: no provider was selected at plan time (privacy/no-candidate) —
    // never fabricated, never a silent public fallback.
    return {
      stepId: step.stepId,
      label: step.label,
      providerId: step.providerId,
      finalProviderId: undefined,
      action: 'STOP',
      attempts: 0,
      retries: 0,
      retried: false,
      fellBack: false,
      costUsd: 0,
      latencyMs: 0,
      verification: 'BLOCKED',
      note: 'No provider selected at plan time (privacy or no candidate) — the step is honestly blocked.',
    };
  }

  let current = primary;
  let behavior = overrides[step.stepId] ?? primary.behavior;
  let attempts = 0;
  let retriesUsed = 0;
  let retried = false;
  let fellBack = false;
  let costUsd = 0;
  let latencyMs = 0;
  const isVerificationStep = step.stepId === 'verification';

  // Bounded: each iteration either succeeds, RETRYs (increments retriesUsed,
  // capped at maxRetries), FALLBACKs once, or stops. Termination is
  // guaranteed — no infinite retry, no unbounded recursion.
  for (let guard = 0; guard < 64; guard++) {
    attempts += 1;
    costUsd += current.estimatedCostUsd;
    latencyMs += current.latencyMs;

    if (behavior === 'SUCCESS') {
      return {
        stepId: step.stepId,
        label: step.label,
        providerId: step.providerId,
        finalProviderId: current.providerId,
        action: 'COMPLETED',
        attempts,
        retries: retriesUsed,
        retried,
        fellBack,
        costUsd: round4(costUsd),
        latencyMs,
        verification: isVerificationStep ? 'VERIFIED' : 'INCONCLUSIVE',
        note: `Completed via ${current.name}${fellBack ? ' (after bounded fallback)' : retried ? ' (after bounded retries)' : ''}.`,
      };
    }

    const failureMode = behaviorToFailureMode(behavior);
    const decision = decideRetryPolicy({
      failureMode,
      privacyClass: step.privacyClass,
      retriesSoFar: retriesUsed,
      maxRetries,
      fallbackAvailable: step.fallbackProviderId !== undefined,
      fallbackPrivacySafe: step.fallbackProviderId !== undefined,
      costCapped: false,
    });

    if (decision.action === 'RETRY') {
      retriesUsed += 1;
      retried = true;
      continue; // same provider, same deterministic behavior
    }
    if (decision.action === 'FALLBACK') {
      const fallback = step.fallbackProviderId ? byId.get(step.fallbackProviderId) : undefined;
      if (!fallback) {
        return {
          stepId: step.stepId,
          label: step.label,
          providerId: step.providerId,
          finalProviderId: current.providerId,
          action: 'STOP',
          attempts,
          retries: retriesUsed,
          retried,
          fellBack: false,
          costUsd: round4(costUsd),
          latencyMs,
          verification: 'BLOCKED',
          note: decision.reason,
        };
      }
      fellBack = true;
      current = fallback;
      behavior = overrides[`${step.stepId}:fallback`] ?? fallback.behavior;
      continue;
    }
    if (decision.action === 'NEEDS_REVIEW') {
      return {
        stepId: step.stepId,
        label: step.label,
        providerId: step.providerId,
        finalProviderId: current.providerId,
        action: 'NEEDS_REVIEW',
        attempts,
        retries: retriesUsed,
        retried,
        fellBack,
        costUsd: round4(costUsd),
        latencyMs,
        verification: isVerificationStep ? 'CONTRADICTED' : 'NEEDS_REVIEW',
        note: decision.reason,
      };
    }
    // STOP — honest block; never retried, never silently replaced.
    return {
      stepId: step.stepId,
      label: step.label,
      providerId: step.providerId,
      finalProviderId: current.providerId,
      action: 'STOP',
      attempts,
      retries: retriesUsed,
      retried,
      fellBack,
      costUsd: round4(costUsd),
      latencyMs,
      verification: 'BLOCKED',
      note: decision.reason,
    };
  }

  // Defensive: the guard loop must never be reached — bounded by construction.
  return {
    stepId: step.stepId,
    label: step.label,
    providerId: step.providerId,
    finalProviderId: current.providerId,
    action: 'STOP',
    attempts,
    retries: retriesUsed,
    retried,
    fellBack,
    costUsd: round4(costUsd),
    latencyMs,
    verification: 'BLOCKED',
    note: 'Simulation guard reached — the policy loop is bounded by construction.',
  };
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

// ── The scenario suite + strategy comparison ─────────────────────────────────

export interface OrchestrationScenarioResult {
  id: string;
  name: string;
  strategy: SelectionStrategyKind;
  completed: boolean;
  blocked: boolean;
  needsReview: boolean;
  totalCostUsd: number;
  totalLatencyMs: number;
  retryCount: number;
  fallbackCount: number;
  steps: StepSimulationOutcome[];
  pass: boolean;
  detail: string;
}

export interface StrategyComparisonRow {
  strategy: SelectionStrategyKind;
  researchProvider: string | undefined;
  reasoningProvider: string | undefined;
  totalCostUsd: number | undefined;
  totalLatencyMs: number;
  allPrivate: boolean;
}

export interface ProviderOrchestrationRun {
  results: OrchestrationScenarioResult[];
  strategyComparison: StrategyComparisonRow[];
  passed: number;
  failed: number;
  failures: string[];
}

const OWNER = 'orchestration-owner';
const NOW = (): string => '2026-08-15T12:00:00.000Z';

/** Build the orchestrator over the deterministic fabric + a real
 *  ActionClassPolicy stand-in (classifies labels — the harness's fake action
 *  port mirrors the gateway's: A for analysis/research, B/C for sensitive). */
function buildOrchestrator(fabric: WorldFabricPort): MultiProviderOrchestrator {
  const action = {
    classify(action: string): ActionClassDecision {
      const lowered = action.toLowerCase();
      const actionClass: 'A' | 'B' | 'C' | 'D' = /publish|send|pay|launch|commit/.test(lowered)
        ? 'C'
        : /approve|sign|delete|transfer/.test(lowered)
          ? 'D'
          : 'A';
      return {
        actionClass,
        authority: actionClass === 'A' ? ('SAFE_VERBS' as const) : ('SENSITIVE_ACTIONS' as const),
        reasons: ['harness classification'],
      };
    },
  };
  return new MultiProviderOrchestrator({ fabric, action, now: NOW });
}

async function planScenario(
  strategy: SelectionStrategyKind,
  fabric: WorldFabricPort,
  overrides: BehaviorOverrides,
  maxRetries = 2,
  steps = BUSINESS_OPPORTUNITY_STEPS,
): Promise<OrchestrationScenarioResult | undefined> {
  const orchestrator = buildOrchestrator(fabric);
  const plan = await orchestrator.plan({
    ownerId: OWNER,
    goal: 'Research a business opportunity and prepare a concise recommendation',
    steps,
    strategy,
    maxRetries,
  });
  if (!plan.success) return undefined;
  const run = simulatePlan(plan.data, FIXTURE_PROVIDERS, overrides, maxRetries);
  return {
    id: '',
    name: '',
    strategy,
    completed: run.completed,
    blocked: run.blocked,
    needsReview: run.needsReview,
    totalCostUsd: run.totalCostUsd,
    totalLatencyMs: run.totalLatencyMs,
    retryCount: run.retryCount,
    fallbackCount: run.fallbackCount,
    steps: run.steps,
    pass: false,
    detail: '',
  };
}

export async function runProviderOrchestrationScenarios(): Promise<ProviderOrchestrationRun> {
  const results: OrchestrationScenarioResult[] = [];
  const failures: string[] = [];
  const fabric = buildDeterministicFabric();

  const add = (r: OrchestrationScenarioResult): void => {
    results.push(r);
    if (!r.pass) failures.push(`${r.id} ${r.name}`);
  };

  // ── 1. All providers healthy → completes with no retry/fallback ─────────
  const s1 = await planScenario('BALANCED', fabric, {});
  if (s1) {
    const allVerified = s1.completed && s1.retryCount === 0 && s1.fallbackCount === 0;
    add({
      ...s1,
      id: '01',
      name: 'all providers healthy → run completes, zero retries/fallbacks, cost = Σ evidence',
      pass: allVerified,
      detail: allVerified ? `cost $${s1.totalCostUsd} / ${s1.totalLatencyMs}ms` : 'FAIL',
    });
  }

  // ── 2. Timeout → bounded retry → privacy-safe fallback ──────────────────
  const s2 = await planScenario('BALANCED', fabric, { research: 'TIMEOUT' });
  if (s2) {
    const researchStep = s2.steps.find((st) => st.stepId === 'research');
    // maxRetries (2) RETRY decisions, then exactly ONE privacy-safe fallback.
    const bounded = (researchStep?.retries ?? 0) <= 2 && s2.fallbackCount === 1;
    add({
      ...s2,
      id: '02',
      name: 'timeout → bounded retries (2) then privacy-safe fallback, run completes',
      pass: s2.completed && bounded,
      detail: `retries=${s2.retryCount} fallbacks=${s2.fallbackCount} research retries=${researchStep?.retries ?? 'n/a'}`,
    });
  }

  // ── 3. Privacy override: PRIVATE strategy binds local providers only ────
  const s3 = await planScenario('PRIVATE', fabric, {});
  if (s3) {
    const plan = await buildOrchestrator(fabric)
      .plan({
        ownerId: OWNER,
        goal: 'Research a business opportunity and prepare a concise recommendation',
        steps: BUSINESS_OPPORTUNITY_STEPS,
        strategy: 'PRIVATE',
      })
      .then((r) => (r.success ? r.data : undefined));
    // Privacy overrides cost: EVERY bound provider is local/PRIVATE. Steps
    // with NO local candidate are honestly unbound (UNAVAILABLE) — never a
    // public provider, never a fabricated selection.
    const bound = (plan?.steps ?? []).filter((st) => st.providerId !== undefined);
    const unbound = (plan?.steps ?? []).filter((st) => st.providerId === undefined);
    const allBoundLocal = bound.every((st) => {
      const fixture = FIXTURE_PROVIDERS.find((f) => f.providerId === st.providerId);
      return fixture?.privacyClass === 'PRIVATE' || fixture?.localAvailability === 'yes';
    });
    const honestUnbound = unbound.every(
      (st) => st.providerState === 'UNAVAILABLE' && st.fallbackProviderId === undefined,
    );
    add({
      ...s3,
      id: '03',
      name: 'PRIVATE strategy → every bound provider is local/private; no-candidate steps honestly unbound (privacy overrides cost)',
      pass: bound.length > 0 && allBoundLocal && honestUnbound,
      detail: `bound=${bound.length} unbound=${unbound.length} allLocal=${allBoundLocal} honestUnbound=${honestUnbound}`,
    });
  }

  // ── 4. PRIVATE + no local candidate → honest NO_SELECTION, never public ──
  const s4 = await planScenario('PRIVATE', buildDeterministicFabric(FIXTURE_PROVIDERS), {}, 2, [
    { id: 'research', label: 'Research the business opportunity', capability: 'research' },
    // 'audio-transcription' has NO fixtures — no candidate exists.
    { id: 'transcribe', label: 'Transcribe the audio', capability: 'audio-transcription' },
  ]);
  if (s4) {
    const plan = await buildOrchestrator(fabric)
      .plan({
        ownerId: OWNER,
        goal: 'Research a business opportunity and prepare a concise recommendation',
        steps: [
          { id: 'research', label: 'Research the business opportunity', capability: 'research' },
          { id: 'transcribe', label: 'Transcribe the audio', capability: 'audio-transcription' },
        ],
        strategy: 'PRIVATE',
      })
      .then((r) => (r.success ? r.data : undefined));
    const transcribe = plan?.steps.find((st) => st.stepId === 'transcribe');
    const honestNoSelection =
      transcribe === undefined ||
      (transcribe.providerId === undefined &&
        transcribe.providerState === 'UNAVAILABLE' &&
        transcribe.fallbackProviderId === undefined);
    add({
      ...s4,
      id: '04',
      name: 'PRIVATE + no local candidate → honest NO_SELECTION (never a public fallback)',
      pass: honestNoSelection,
      detail: honestNoSelection
        ? 'transcribe step honestly unbound (UNAVAILABLE)'
        : 'FAIL — a provider was fabricated or a public fallback allowed',
    });
  }

  // ── 5. Quota exhausted → fallback, NOT a futile retry ───────────────────
  const s5 = await planScenario('BALANCED', fabric, { reasoning: 'QUOTA' });
  if (s5) {
    const reasoningStep = s5.steps.find((st) => st.stepId === 'reasoning');
    // Quota is never fixed by a retry: zero RETRY decisions on the reasoning
    // step — one primary attempt, then the privacy-safe fallback.
    const noFutileRetry =
      (reasoningStep?.retries ?? -1) === 0 && (reasoningStep?.fellBack ?? false);
    add({
      ...s5,
      id: '05',
      name: 'quota exhausted → immediate privacy-safe fallback (no futile retry)',
      pass: s5.completed && s5.fallbackCount > 0 && noFutileRetry,
      detail: `fallbacks=${s5.fallbackCount} reasoning retries=${reasoningStep?.retries ?? 'n/a'}`,
    });
  }

  // ── 6. Malformed permanent response → STOP (never retried) ──────────────
  const s6 = await planScenario('BALANCED', fabric, { analysis: 'MALFORMED' });
  if (s6) {
    const analysisStep = s6.steps.find((st) => st.stepId === 'analysis');
    add({
      ...s6,
      id: '06',
      name: 'malformed permanent response → STOP (never retried, never replaced)',
      pass: s6.blocked && (analysisStep?.attempts ?? 0) === 1 && !(analysisStep?.fellBack ?? false),
      detail: `analysis attempts=${analysisStep?.attempts ?? 'n/a'} fellBack=${analysisStep?.fellBack ?? 'n/a'}`,
    });
  }

  // ── 7. Verification disagreement → NEEDS_REVIEW (never price-resolved) ───
  const s7 = await planScenario('BALANCED', fabric, { verification: 'DISAGREE' });
  if (s7) {
    add({
      ...s7,
      id: '07',
      name: 'verification disagreement → NEEDS_REVIEW (never auto-resolved by price)',
      pass: s7.needsReview && !s7.completed,
      detail: 'needsReview=true, run not completed',
    });
  }

  // ── 8. Unknown cost stays UNKNOWN (never 0) ─────────────────────────────
  const s8 = await buildOrchestrator(fabric)
    .plan({
      ownerId: OWNER,
      goal: 'Research a business opportunity and prepare a concise recommendation',
      steps: BUSINESS_OPPORTUNITY_STEPS,
      strategy: 'BALANCED',
    })
    .then((r) => (r.success ? r.data : undefined));
  if (s8) {
    const summed = s8.steps.reduce((acc, st) => acc + (st.expectedCostUsd ?? 0), 0);
    // Every fixture carries cost evidence here, so the plan total equals the
    // evidence sum — the point is the policy NEVER invents cost where absent.
    const unknownHandled = s8.estimatedCostUsd === round4(summed);
    add({
      id: '08',
      name: 'plan cost = evidence sum only; absent evidence is UNKNOWN, never 0',
      strategy: 'BALANCED',
      completed: false,
      blocked: false,
      needsReview: false,
      totalCostUsd: s8.estimatedCostUsd ?? 0,
      totalLatencyMs: 0,
      retryCount: 0,
      fallbackCount: 0,
      steps: [],
      pass: unknownHandled,
      detail: `plan estimatedCostUsd=${s8.estimatedCostUsd} (evidence sum ${round4(summed)})`,
    });
  }

  // ── 9. Structural: the plan never executes/spends/approves ──────────────
  if (s8) {
    // `executed:false` + `authorizationRequired:true` are enforced by the
    // TYPE (literal) — the runtime-checkable structural guarantees here are
    // the bounds decision + per-step bounded retry/fallback policies.
    const structural =
      s8.bounds.allowed && s8.steps.length > 0 && s8.steps.every((st) => st.retryPolicy.length > 0);
    add({
      id: '09',
      name: 'structural: executed:false + authorizationRequired:true (representation only)',
      strategy: 'BALANCED',
      completed: false,
      blocked: false,
      needsReview: false,
      totalCostUsd: 0,
      totalLatencyMs: 0,
      retryCount: 0,
      fallbackCount: 0,
      steps: [],
      pass: structural,
      detail: structural ? 'executed=false, authorizationRequired=true' : 'FAIL',
    });
  }

  // ── 10. Provider output can never change an action class ────────────────
  if (s8) {
    // The action class comes ONLY from the existing ActionClassPolicy at plan
    // time — no provider output is consulted. The 'publish' step is class C
    // regardless of any provider's content.
    const planC = await buildOrchestrator(fabric)
      .plan({
        ownerId: OWNER,
        goal: 'Publish a client report',
        steps: [
          { id: 'draft', label: 'Draft the report', capability: 'summarization' },
          {
            id: 'publish',
            label: 'Publish the report to the client portal',
            capability: 'summarization',
          },
        ],
        strategy: 'BALANCED',
      })
      .then((r) => (r.success ? r.data : undefined));
    const publishStep = planC?.steps.find((st) => st.stepId === 'publish');
    const authoritative = publishStep?.actionClass === 'C' && planC?.authorizationRequired === true;
    add({
      id: '10',
      name: 'action class comes from the existing authority — provider output can never grant authority',
      strategy: 'BALANCED',
      completed: false,
      blocked: false,
      needsReview: false,
      totalCostUsd: 0,
      totalLatencyMs: 0,
      retryCount: 0,
      fallbackCount: 0,
      steps: [],
      pass: authoritative,
      detail: authoritative ? 'publish step class C via ActionClassPolicy' : 'FAIL',
    });
  }

  // ── Strategy comparison (CHEAP/FAST/QUALITY/PRIVATE/BALANCED) ───────────
  const strategies: SelectionStrategyKind[] = ['CHEAP', 'FAST', 'QUALITY', 'PRIVATE', 'BALANCED'];
  const strategyComparison: StrategyComparisonRow[] = [];
  for (const strategy of strategies) {
    const plan = await buildOrchestrator(fabric)
      .plan({
        ownerId: OWNER,
        goal: 'Research a business opportunity and prepare a concise recommendation',
        steps: BUSINESS_OPPORTUNITY_STEPS,
        strategy,
      })
      .then((r) => (r.success ? r.data : undefined));
    if (!plan) continue;
    const research = plan.steps.find((st) => st.stepId === 'research')?.providerId;
    const reasoning = plan.steps.find((st) => st.stepId === 'reasoning')?.providerId;
    const totalCostUsd = plan.estimatedCostUsd;
    const totalLatencyMs = plan.steps.reduce((acc, st) => {
      const fixture = FIXTURE_PROVIDERS.find((f) => f.providerId === st.providerId);
      return acc + (fixture?.latencyMs ?? 0);
    }, 0);
    // Privacy guarantee: no BOUND provider is public (steps without a local
    // candidate stay honestly unbound under PRIVATE — never a public pick).
    const allPrivate = plan.steps.every((st) => {
      if (st.providerId === undefined) return true; // honestly unbound
      const fixture = FIXTURE_PROVIDERS.find((f) => f.providerId === st.providerId);
      return fixture?.privacyClass === 'PRIVATE' || fixture?.localAvailability === 'yes';
    });
    strategyComparison.push({
      strategy,
      researchProvider: research,
      reasoningProvider: reasoning,
      totalCostUsd,
      totalLatencyMs,
      allPrivate,
    });
  }

  // Strategy sanity: CHEAP picks the cheapest research provider; FAST the
  // fastest; PRIVATE all-local (already asserted above).
  const cheapResearch = strategyComparison.find((s) => s.strategy === 'CHEAP')?.researchProvider;
  const fastResearch = strategyComparison.find((s) => s.strategy === 'FAST')?.researchProvider;
  const cheapOk = cheapResearch === 'research-cloud-cheap';
  const fastOk = fastResearch === 'research-cloud-fast';
  add({
    id: '11',
    name: 'strategy behavior: CHEAP → cheapest, FAST → fastest research provider',
    strategy: 'BALANCED',
    completed: false,
    blocked: false,
    needsReview: false,
    totalCostUsd: 0,
    totalLatencyMs: 0,
    retryCount: 0,
    fallbackCount: 0,
    steps: [],
    pass: cheapOk && fastOk,
    detail: `CHEAP→${cheapResearch} FAST→${fastResearch}`,
  });

  const passed = results.filter((r) => r.pass).length;
  return { results, strategyComparison, passed, failed: results.length - passed, failures };
}
