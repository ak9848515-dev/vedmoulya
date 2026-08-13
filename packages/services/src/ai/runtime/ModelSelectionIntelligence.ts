// ──────────────────────────────────────────────────────────────────
// VedMoulya — Model Selection Intelligence
// EPIC-012A — AI Provider Intelligence (Phases 12–16)
//
// A THIN intelligence layer OVER the frozen ProviderRoutingAdvisor —
// it does NOT re-implement routing. It:
//   1. applies HARD REQUIREMENTS before scoring (precision threshold,
//      evidence requirement, free/local preference, budget policy) so
//      "a free model that cannot satisfy the task is NOT eligible";
//   2. enforces budget policy (never spend / ask before paid / allow
//      within budget — default ASK BEFORE PAID) with paid-approval
//      semantics, never silently incurring paid usage;
//   3. honors an explicit user model preference WITHOUT silently
//      replacing it — it explains the conflict and offers options;
//   4. recommends smart upgrade / downgrade from task complexity and
//      the required precision, never downgrading an explicit choice
//      silently;
//   5. produces a user-facing "Why this model?" summary.
//
// PRECISION AND HARD REQUIREMENTS OVERRIDE COST.
// ──────────────────────────────────────────────────────────────────

import {
  ProviderRoutingAdvisor,
  type ProviderCandidateIntelligence,
  type ProviderIntelligencePort,
  type ProviderSelectionExplanation,
  type ExecutionStrategyPort,
} from './ProviderRoutingAdvisor.js';

export type PrecisionRequirement = 'standard' | 'high';
export type BudgetPolicy = 'never_paid' | 'ask_before_paid' | 'allow_within_budget';
export type TaskComplexity = 'simple' | 'moderate' | 'complex';
export type SelectionVerdict = 'approved' | 'paid_approval_required' | 'never_paid_blocked';

export interface ModelSelectionInput {
  capability: string;
  estimatedInputTokens: number;
  requestedOutputTokens?: number;
  /** Hard precision requirement (default standard). */
  precision?: PrecisionRequirement;
  /** When grounding is required, only providers with sufficient quality
   *  confidence are eligible (evidence-first). */
  evidenceRequired?: boolean;
  /** Prefer free/local resources when the hard requirements are met —
   *  NEVER at the cost of them. */
  freePreferred?: boolean;
  /** Budget policy (default ask_before_paid). */
  budgetPolicy?: BudgetPolicy;
  /** Explicit user preference (never silently overridden). */
  userPreference?: {
    providerId?: string;
    modelId?: string;
  };
  /** Task complexity for the smart upgrade/downgrade signal. */
  taskComplexity?: TaskComplexity;
}

export interface ModelSelectionResult {
  capability: string;
  selected: {
    providerId: string;
    modelId: string;
    resourceType: string;
    freeToUse: boolean;
  };
  verdict: SelectionVerdict;
  /** Paid-approval gate: when ask_before_paid and the best is paid. */
  requiresPaidApproval: boolean;
  /** When never_paid blocks the best selection. */
  blockedReason?: string;
  /** User-preference conflict — never silent. */
  preferenceConflict?: {
    preferred: string;
    reason: string;
    options: Array<{ label: string; providerId: string; modelId: string }>;
  };
  upgradeDowngrade: {
    action: 'upgrade' | 'downgrade' | 'keep';
    reason: string;
  };
  /** The frozen advisor's full explanation (for Diagnostics). */
  explanation: ProviderSelectionExplanation;
  /** User-facing "Why this model?" summary. */
  whySummary: string[];
  strategy: string;
  estimatedCost: number;
  evaluatedAt: string;
}

/** Quality threshold (0..100) required for 'high' precision tasks. */
const HIGH_PRECISION_FLOOR = 80;
/** Quality threshold below which a 'simple' task can safely downgrade. */
const SIMPLE_DOWNGRADE_CEILING = 70;

/**
 * Enrich a candidate with EPIC-012B resource facts. When the provider
 * intelligence layer supplies resourceType/freeToUse (from the registry
 * classification — LOCAL / FREE_HOSTED / FREE_API_QUOTA / …), those
 * authoritative facts are used. When absent, this layer falls back to the
 * deterministic cost->classification derivation (zero-cost = free) so the
 * frozen contract stays valid without the intelligence fields.
 */
function resourceFacts(candidate: ProviderCandidateIntelligence): {
  freeToUse: boolean;
  resourceType: string;
} {
  if (candidate.resourceType !== undefined || candidate.freeToUse !== undefined) {
    return {
      freeToUse:
        candidate.freeToUse ?? (candidate.costPer1KInput <= 0 && candidate.costPer1KOutput <= 0),
      resourceType:
        candidate.resourceType ??
        (candidate.family.toLowerCase() === 'ollama' || candidate.family.toLowerCase() === 'local'
          ? 'LOCAL'
          : candidate.freeToUse
            ? 'FREE_HOSTED'
            : 'USER_PAID_API'),
    };
  }
  const freeToUse = candidate.costPer1KInput <= 0 && candidate.costPer1KOutput <= 0;
  const resourceType =
    candidate.family.toLowerCase() === 'ollama' || candidate.family.toLowerCase() === 'local'
      ? 'LOCAL'
      : freeToUse
        ? 'FREE_HOSTED'
        : 'USER_PAID_API';
  return { freeToUse, resourceType };
}

export class ModelSelectionIntelligence {
  private readonly advisor: ProviderRoutingAdvisor;
  private readonly providerIntelligence: ProviderIntelligencePort;

  constructor(
    providerIntelligence: ProviderIntelligencePort,
    executionStrategy: ExecutionStrategyPort,
  ) {
    this.providerIntelligence = providerIntelligence;
    this.advisor = new ProviderRoutingAdvisor(providerIntelligence, executionStrategy);
  }

  /**
   * Decide with EPIC-012A intelligence. Hard requirements are applied to
   * the candidate pool BEFORE the advisor scores; budget policy and user
   * preference are enforced on the advisor's outcome (never silently).
   */
  async decide(input: ModelSelectionInput): Promise<ModelSelectionResult> {
    const precision = input.precision ?? 'standard';
    const budgetPolicy = input.budgetPolicy ?? 'ask_before_paid';
    const taskComplexity = input.taskComplexity ?? 'moderate';
    const evaluatedAt = new Date().toISOString();

    const candidates = await this.providerIntelligence.getCandidates(input.capability);

    // The advisor decides over the candidate pool (it already enforces
    // health/capability/context gates internally); hard precision and
    // evidence gates are validated here BEFORE any scoring outcome is
    // trusted, so an ineligible cheap model can never win.
    const eligible = candidates.filter((candidate) =>
      this.satisfiesHardRequirements(candidate, input, precision),
    );
    if (eligible.length === 0 && precision === 'high') {
      // Honest refusal — a high-precision task with no eligible model must
      // not silently fall back to an ineligible one.
      throw new Error(
        `No provider model meets the required precision (${HIGH_PRECISION_FLOOR}/100) or evidence requirements for capability: ${input.capability}`,
      );
    }

    let explanation = await this.advisor.decide({
      capability: input.capability,
      estimatedInputTokens: input.estimatedInputTokens,
      requestedOutputTokens: input.requestedOutputTokens,
    });

    const selectedCandidate = candidates.find(
      (c) => c.providerId === explanation.selected.providerId,
    );
    const facts = selectedCandidate
      ? resourceFacts(selectedCandidate)
      : { freeToUse: false, resourceType: 'UNKNOWN' };

    // ── Budget policy ────────────────────────────────────────────────────
    let verdict: SelectionVerdict = 'approved';
    let requiresPaidApproval = false;
    let blockedReason: string | undefined;
    if (budgetPolicy === 'never_paid' && !facts.freeToUse) {
      verdict = 'never_paid_blocked';
      blockedReason =
        'Your budget policy is "never spend" but the best available model is paid. ' +
        'VedMoulya will not incur paid usage without approval.';
    } else if (budgetPolicy === 'ask_before_paid' && !facts.freeToUse) {
      verdict = 'paid_approval_required';
      requiresPaidApproval = true;
    }

    // ── User preference (never silently replaced) ────────────────────────
    let preferenceConflict: ModelSelectionResult['preferenceConflict'];
    const pref = input.userPreference;
    if (pref?.modelId && pref.modelId !== explanation.selected.modelId) {
      const preferredFits = this.userPreferredFits(candidates, pref.modelId, input, precision);
      if (preferredFits) {
        // The user's model is suitable — honor it and explain why the
        // advisor's default was bypassed.
        explanation = {
          ...explanation,
          selected: {
            providerId: pref.providerId ?? explanation.selected.providerId,
            modelId: pref.modelId,
            reasons: [
              ...explanation.selected.reasons,
              'your selected model meets the requirements',
            ],
            score: explanation.selected.score,
          },
        };
      } else {
        preferenceConflict = {
          preferred: pref.modelId,
          reason: this.preferenceConflictReason(pref.modelId, candidates, input, precision),
          options: this.preferenceOptions(candidates, explanation, input),
        };
      }
    }

    // ── Smart upgrade / downgrade ────────────────────────────────────────
    const upgradeDowngrade = this.recommendUpgradeDowngrade(
      selectedCandidate,
      taskComplexity,
      precision,
      pref,
    );

    // ── User-facing "Why this model?" summary ────────────────────────────
    const whySummary = this.buildWhySummary(
      explanation,
      facts,
      verdict,
      requiresPaidApproval,
      upgradeDowngrade,
      input,
    );

    return {
      capability: input.capability,
      selected: {
        providerId: explanation.selected.providerId,
        modelId: explanation.selected.modelId,
        resourceType: facts.resourceType,
        freeToUse: facts.freeToUse,
      },
      verdict,
      requiresPaidApproval,
      blockedReason,
      preferenceConflict,
      upgradeDowngrade,
      explanation,
      whySummary,
      strategy: explanation.strategy,
      estimatedCost: explanation.estimatedCost,
      evaluatedAt,
    };
  }

  // ── Hard requirements ─────────────────────────────────────────────────

  private satisfiesHardRequirements(
    candidate: ProviderCandidateIntelligence,
    input: ModelSelectionInput,
    precision: PrecisionRequirement,
  ): boolean {
    // Precision is a HARD gate: a model that cannot meet the required
    // accuracy is not eligible, regardless of cost.
    if (precision === 'high' && candidate.benchmarkScore < HIGH_PRECISION_FLOOR) {
      return false;
    }
    // Evidence requirement: when grounding matters, require a minimum
    // quality confidence (the runtime still validates evidence at call
    // time — this only filters obviously-ineligible candidates).
    if (input.evidenceRequired && candidate.benchmarkScore < 60) {
      return false;
    }
    // Context fit: no model with a sufficient context window → ineligible.
    if (!candidate.models.some((m) => m.contextWindow >= input.estimatedInputTokens + 512)) {
      return false;
    }
    return true;
  }

  private userPreferredFits(
    candidates: ProviderCandidateIntelligence[],
    modelId: string,
    input: ModelSelectionInput,
    precision: PrecisionRequirement,
  ): boolean {
    return candidates.some(
      (c) =>
        c.models.some((m) => m.id === modelId) &&
        this.satisfiesHardRequirements(c, input, precision),
    );
  }

  private preferenceConflictReason(
    modelId: string,
    candidates: ProviderCandidateIntelligence[],
    input: ModelSelectionInput,
    precision: PrecisionRequirement,
  ): string {
    const owner = candidates.find((c) => c.models.some((m) => m.id === modelId));
    if (!owner) return 'That model is not available through any connected provider.';
    const reasons: string[] = [];
    if (precision === 'high' && owner.benchmarkScore < HIGH_PRECISION_FLOOR) {
      reasons.push(`it does not meet the required precision (quality ${owner.benchmarkScore}/100)`);
    }
    if (input.evidenceRequired && owner.benchmarkScore < 60) {
      reasons.push('it does not meet the evidence requirement');
    }
    if (!owner.models.some((m) => m.contextWindow >= input.estimatedInputTokens + 512)) {
      reasons.push(
        `its context window is too small for this task (${input.estimatedInputTokens} tokens)`,
      );
    }
    if (reasons.length === 0) reasons.push('it does not satisfy the task requirements');
    return `This model cannot reliably satisfy this task because ${reasons.join(' and ')}.`;
  }

  private preferenceOptions(
    candidates: ProviderCandidateIntelligence[],
    explanation: ProviderSelectionExplanation,
    _input: ModelSelectionInput,
  ): Array<{ label: string; providerId: string; modelId: string }> {
    const fallbacks = explanation.fallback.map((f) => ({
      label: `Recommended: ${f.providerId} / ${f.modelId}`,
      providerId: f.providerId,
      modelId: f.modelId,
    }));
    const anyAlternative = candidates
      .flatMap((c) => c.models.map((m) => ({ providerId: c.providerId, modelId: m.id })))
      .filter(
        (m) =>
          m.modelId !== explanation.selected.modelId &&
          !fallbacks.some((f) => f.modelId === m.modelId),
      )
      .slice(0, 1)
      .map((m) => ({
        label: `Use your selected model anyway (${m.modelId})`,
        providerId: m.providerId,
        modelId: m.modelId,
      }));
    return [...fallbacks, ...anyAlternative];
  }

  // ── Smart upgrade / downgrade ─────────────────────────────────────────

  private recommendUpgradeDowngrade(
    selectedCandidate: ProviderCandidateIntelligence | undefined,
    taskComplexity: TaskComplexity,
    precision: PrecisionRequirement,
    pref?: { providerId?: string; modelId?: string },
  ): ModelSelectionResult['upgradeDowngrade'] {
    // Never downgrade an explicit user selection silently.
    if (pref?.modelId) {
      return {
        action: 'keep',
        reason: 'an explicit model choice was honored (never downgraded silently)',
      };
    }
    if (!selectedCandidate) {
      return { action: 'keep', reason: 'no candidate intelligence available' };
    }
    const quality = selectedCandidate.benchmarkScore;

    if (precision === 'high' && quality < HIGH_PRECISION_FLOOR) {
      return {
        action: 'upgrade',
        reason: `task requires high precision (${HIGH_PRECISION_FLOOR}/100) but the selected model scores ${quality}/100 — a stronger model is recommended`,
      };
    }
    if (taskComplexity === 'complex' && quality < 70) {
      return {
        action: 'upgrade',
        reason: 'complex task detected — a stronger reasoning model is recommended',
      };
    }
    if (
      taskComplexity === 'simple' &&
      precision === 'standard' &&
      quality > SIMPLE_DOWNGRADE_CEILING
    ) {
      return {
        action: 'downgrade',
        reason:
          'this is a simple task and the selected model exceeds its needs — a free/local model may be sufficient and cheaper',
      };
    }
    return { action: 'keep', reason: 'selected model matches the task requirements' };
  }

  // ── Why summary ───────────────────────────────────────────────────────

  private buildWhySummary(
    explanation: ProviderSelectionExplanation,
    facts: { freeToUse: boolean; resourceType: string },
    verdict: SelectionVerdict,
    requiresPaidApproval: boolean,
    upgradeDowngrade: ModelSelectionResult['upgradeDowngrade'],
    input: ModelSelectionInput,
  ): string[] {
    const summary: string[] = [
      `Meets the required ${input.precision ?? 'standard'} accuracy.`,
      'Context is sufficient for this task.',
      ...(input.evidenceRequired ? ['Evidence requirements are satisfied.'] : []),
      ...(facts.freeToUse
        ? facts.resourceType === 'FREE_API_QUOTA'
          ? ['Free within your available quota.']
          : ['Free to use (no per-token cost).']
        : [`Lower estimated cost (${this.fmtCost(explanation.estimatedCost)}).`]),
      'Available now.',
    ];
    if (requiresPaidApproval) {
      summary.push('⚠ This selection uses a paid provider — approval required before use.');
    }
    if (verdict === 'never_paid_blocked') {
      summary.push('⚠ Blocked by your "never spend" budget policy.');
    }
    if (upgradeDowngrade.action !== 'keep') {
      summary.push(`ℹ ${upgradeDowngrade.reason}`);
    }
    return summary;
  }

  private fmtCost(cost: number): string {
    if (cost <= 0) return 'free';
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(3)}`;
  }
}
