// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway · OrchestrationPlanSource (SPRINT-037)
//
// THE SPRINT-037 COMPOSITION SEAM: connects an APPROVED world-model
// OrchestrationPlan (SPRINT-036 — MultiProviderOrchestrator) to the EXISTING
// execution bridge (EPIC-014 — ExecutionRunService) WITHOUT a new engine and
// WITHOUT a new runtime path.
//
//   ApprovedPlan ──► OrchestrationPlanSource.getPlan ──► FactoryCapabilityPlan
//                                                          │
//                                                          ▼
//                                    existing ExecutionRunService (the ONLY runtime)
//
// Structural gates (fail-closed, never bypassed):
//   • ONLY `status === 'APPROVED'` plans adapt — a PLANNED / REJECTED /
//     CANCELLED plan returns undefined (the bridge honestly reports the plan
//     as not runnable; it never sees an unauthorized plan).
//   • `executed:false` is structural on the plan and is NEVER flipped here —
//     the adapter only REPRESENTS the approved plan; the bridge performs the
//     execution, the Brain remains the approval authority.
//   • Capability mapping is a CLOSED vocabulary: orchestration capabilities
//     map only to the bridge's CapabilityId vocabulary. An unmapped
//     capability makes the whole plan non-adaptable (honest refusal — the
//     runtime is never asked to execute a capability it cannot represent).
//     'verification' maps to QUALITY_EVALUATION which has NO runtime path —
//     the resolver honestly reports the step UNAVAILABLE (verification is
//     performed deterministically by the run's StepVerifier, not a provider
//     call). Provider output can never change any of this.
//
// The plan source is composed BEFORE the ExecutionRunService: it first tries
// the world model's orchestration plans, then falls back to the existing
// capability-marketplace plan source (both families run through the SAME
// bridge — no alternate execution pathway exists).
// ─────────────────────────────────────────────────────────────────────────────

import type { CapabilityId } from '@vedmoulya/capability-marketplace';
import type {
  FactoryCapabilityPlan,
  PlanStep,
  CapabilityCandidate,
} from '@vedmoulya/capability-marketplace';
import type { PlanSource } from '@vedmoulya/execution-bridge';
import type { OrchestrationPlan, OrchestratedStep } from '@vedmoulya/world-model';
import type { WorldModelService } from '@vedmoulya/world-model';

/**
 * Closed orchestration → bridge capability vocabulary. Only capabilities the
 * runtime can represent are mapped. NEVER extended ad hoc — an unknown
 * capability makes the plan non-adaptable (honest refusal, never a guess).
 */
const ORCHESTRATION_CAPABILITY_MAP: Readonly<Record<string, CapabilityId>> = {
  research: 'RESEARCH',
  reasoning: 'REASONING',
  'economic-analysis': 'REASONING',
  analysis: 'REASONING',
  verification: 'QUALITY_EVALUATION',
  summarization: 'TEXT_GENERATION',
  coding: 'CODING',
  translation: 'TRANSLATION',
  embeddings: 'EMBEDDINGS',
  vision: 'VISION',
  'image-understanding': 'VISION',
  'text-to-speech': 'TEXT_TO_SPEECH',
  'speech-to-text': 'SPEECH_TO_TEXT',
  speech: 'TEXT_TO_SPEECH',
};

/** Map an orchestration capability to the bridge vocabulary — undefined for
 *  capabilities the runtime cannot represent (never fabricated). */
export function mapOrchestrationCapability(capability: string): CapabilityId | undefined {
  // eslint-disable-next-line security/detect-object-injection -- Closed constant record keyed by a fixed orchestration vocabulary (never user-controlled input).
  return ORCHESTRATION_CAPABILITY_MAP[capability];
}

/** Whether an approved plan can be represented on the bridge — every step's
 *  capability must map. Exposed so the gateway procedure can give an honest
 *  error BEFORE calling the bridge (belt-and-braces). */
export function canAdaptOrchestrationPlan(plan: OrchestrationPlan): {
  adaptable: boolean;
  unmapped?: string[];
} {
  const unmapped = plan.steps
    .filter((step) => !mapOrchestrationCapability(step.capability))
    .map((step) => step.label);
  return unmapped.length === 0 ? { adaptable: true } : { adaptable: false, unmapped };
}

/** Honest provider-state → candidate classification (from the fabric's
 *  evidence-only health ledger — never "healthy because configured"). */
function candidateClass(
  state: OrchestratedStep['providerState'],
): 'READY' | 'CONFIGURE' | 'UNAVAILABLE' {
  switch (state) {
    case 'AVAILABLE':
      return 'READY';
    case 'DEGRADED':
    case 'UNKNOWN':
      // DEGRADED/UNKNOWN = no READY runtime evidence — a configure-first
      // hand-off is honest; the runtime path is never assumed.
      return 'CONFIGURE';
    case 'UNAVAILABLE':
    case 'ERROR':
      return 'UNAVAILABLE';
    default:
      return 'UNAVAILABLE';
  }
}

/** Adapt ONE approved orchestration step into a bridge PlanStep. */
function adaptStep(step: OrchestratedStep, index: number): PlanStep {
  const capability = mapOrchestrationCapability(step.capability);
  // canAdaptOrchestrationPlan guarantees a mapping for every step — this is
  // a structural invariant, never a silent fallback.
  const mapped: CapabilityId = capability as CapabilityId;
  const candidate: CapabilityCandidate = {
    id: `orchestrated-${step.stepId}-${step.providerId ?? 'unbound'}`,
    kind: 'provider',
    name: step.providerId ?? 'Unbound step',
    providerFamily: step.providerId,
    modelId: step.modelId,
    capability: mapped,
    integrationType: 'DIRECT_PROVIDER',
    classification: candidateClass(step.providerState),
    freeAvailability: 'UNKNOWN',
    localAvailability: 'UNKNOWN',
    quality: undefined,
    evidence: step.reasons.map((reason, i) => ({
      claim: reason,
      source: `orchestration-plan:${step.stepId}:${i}`,
      confidence: 'INFERRED' as const,
    })),
    reasons: step.reasons,
    configurable: false,
    apiAvailable: 'UNKNOWN',
    estimatedCostUsd: step.expectedCostUsd,
  };
  // ActionClassPolicy classification carried from the plan (A/B/C/D): C/D
  // steps are irreversible → the bridge's own ApprovalRuntime pauses them
  // (belt-and-braces on top of the plan-level Brain approval).
  const sensitive = step.actionClass === 'C' || step.actionClass === 'D';
  return {
    id: step.stepId || `step-${index + 1}`,
    title: step.label,
    capability: mapped,
    purpose: step.label,
    candidates: [candidate],
    selectedCandidateId: candidate.id,
    automation: sensitive ? 'HUMAN_APPROVAL' : 'FULLY_AUTOMATED',
    irreversible: sensitive,
    reasons: step.reasons,
  };
}

/** Adapt an APPROVED OrchestrationPlan into the bridge's plan shape. The
 *  adapter ONLY represents — it never executes, never approves, never spends. */
export function adaptOrchestrationPlan(plan: OrchestrationPlan): FactoryCapabilityPlan {
  const steps = plan.steps.map(adaptStep);
  const sensitiveCount = steps.filter((s) => s.irreversible).length;
  return {
    id: plan.id,
    requestedOutcome: plan.goal,
    createdAt: plan.createdAt,
    requiredCapabilities: [...new Set(steps.map((s) => s.capability))],
    candidates: steps.flatMap((s) => s.candidates),
    steps,
    automationLevel: sensitiveCount > 0 ? 'HUMAN_APPROVAL' : 'FULLY_AUTOMATED',
    automationPercent:
      steps.length === 0 ? 0 : Math.round(((steps.length - sensitiveCount) / steps.length) * 100),
    estimatedCostUsd: plan.estimatedCostUsd,
    evidence: steps.flatMap((s) => s.candidates.flatMap((c) => c.evidence)),
    risks: plan.bounds.allowed
      ? []
      : [`The orchestration exceeds workflow bounds: ${plan.bounds.reason}`],
    humanApprovalPoints: steps.filter((s) => s.irreversible),
    unavailableCapabilities: [],
    recommendations: [],
  };
}

/**
 * The composite plan source: orchestration plans first (APPROVED only),
 * then the existing capability-marketplace plans. BOTH families run through
 * the SAME ExecutionRunService — there is exactly ONE execution pathway.
 * `getWorld` is lazy because the world service is constructed AFTER the
 * execution run service in ApiApplicationService.
 */
export function createOrchestrationAwarePlanSource(
  getWorld: () => WorldModelService | undefined,
  base: PlanSource,
): PlanSource {
  return {
    getPlan: async (ownerId, planId): Promise<FactoryCapabilityPlan | undefined> => {
      const world = getWorld();
      if (world) {
        const found = world.getOrchestrationPlan(ownerId, planId);
        if (found.success) {
          // STRUCTURAL GATE: only an APPROVED plan becomes runnable. A plan
          // that is PLANNED / REJECTED / CANCELLED (or not adaptable) is
          // honestly not runnable — the bridge never sees it.
          if (found.data.status !== 'APPROVED') return undefined;
          if (!canAdaptOrchestrationPlan(found.data).adaptable) return undefined;
          return adaptOrchestrationPlan(found.data);
        }
      }
      // Fall back to the existing capability-marketplace plan family.
      return base.getPlan(ownerId, planId);
    },
  };
}
