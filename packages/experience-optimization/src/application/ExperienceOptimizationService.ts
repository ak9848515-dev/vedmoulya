// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Optimization: Application Service
//
//   VERIFIED EXECUTION → MEMORY → EXPERIENCE OPTIMIZATION → ADVISORY
//   STRATEGY RECOMMENDATION → PLANNING / ADAPTIVE DECISION → NORMAL
//   VALIDATION → GOVERNANCE → EXECUTION → VERIFICATION → MEASURED OUTCOME
//
// This service interprets verified memory evidence into advisory
// recommendations. It holds NO authority: it cannot authorize a tool,
// bypass ToolRuntime/AIOrchestrationService/governance/verification/
// budgets, widen capabilities, permissions or autonomy, or modify any
// executable system behavior. Current runtime truth always wins
// (Phase 18 hierarchy).
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import type { MemoryCategory } from '@vedmoulya/execution-memory';
import type {
  ExperienceMemoryPort,
  ExperienceOptimizationObserver,
  RecommendationOutcomeStore,
} from '../contracts/experience-optimization-ports.js';
import type {
  EvidenceLevel,
  OptimizationAuditRecord,
  OptimizationContext,
  OptimizationTarget,
  RecommendationEffectiveness,
  RecommendationOutcomeInput,
  RecommendationOutcomeKind,
  RecommendationOutcomeRecord,
  StrategyCandidate,
  StrategyComparison,
  StrategyEvidence,
  StrategyRecommendation,
} from '../types/experience-optimization-types.js';
import { extractEvidenceForTarget } from '../domain/strategy-evidence.js';
import {
  applyRuntimeTruth,
  boundCandidates,
  buildCandidates,
  buildRecommendation,
  satisfiesConstraint,
} from '../domain/strategy-scoring.js';
import { decideExploration } from '../domain/strategy-exploration.js';
import { compareStrategies } from '../domain/strategy-comparison.js';

export const MAX_CANDIDATES_CONSIDERED = 12;
export const MAX_ALTERNATIVES = 2;
/** Terminal recovery strategies are never "recommended" (they are loop decisions). */
export const RECOMMENDABLE_RECOVERY_STRATEGIES = [
  'retry',
  'alternate_tool',
  'alternate_model',
  'revise_step',
] as const;

export interface RoutingExperienceSignal {
  subject: string;
  provider?: string;
  model?: string;
  taskSuccessSignal: number;
  costEfficiencySignal?: number;
  verificationReliability: number;
  evidenceLevel: EvidenceLevel;
  recency: number;
  sampleCount: number;
  /** Advisory ONLY — the existing router remains authoritative. */
  advisory: true;
}

export interface ExperienceOptimizationServiceOptions {
  memory: ExperienceMemoryPort;
  outcomes: RecommendationOutcomeStore;
  observer?: ExperienceOptimizationObserver;
  clock?: () => string;
  random?: () => number;
}

export function categoryForTarget(target: OptimizationTarget): MemoryCategory | undefined {
  switch (target) {
    case 'TOOL_SELECTION':
      return 'TOOL_RELIABILITY';
    case 'PLAN_PATTERN':
      return 'PLAN_PATTERN';
    case 'RECOVERY_STRATEGY':
      return 'RECOVERY_PATTERN';
    case 'VERIFICATION_STRATEGY':
      return 'VERIFICATION_PATTERN';
    case 'ROUTING_SIGNAL':
      return 'ROUTING_SIGNAL';
    case 'EXECUTION_SEQUENCE':
      return 'TASK_PATTERN';
    default:
      return undefined;
  }
}

export class ExperienceOptimizationService {
  private readonly memory: ExperienceMemoryPort;
  private readonly outcomes: RecommendationOutcomeStore;
  private readonly observer?: ExperienceOptimizationObserver;
  private readonly clock: () => string;
  private readonly random: () => number;

  constructor(options: ExperienceOptimizationServiceOptions) {
    this.memory = options.memory;
    this.outcomes = options.outcomes;
    this.observer = options.observer;
    this.clock = options.clock ?? ((): string => new Date().toISOString());
    this.random = options.random ?? Math.random;
  }

  // ── Recommendations (advisory) ──────────────────────────────────

  /** Advisory recommendation for one optimization target (undefined when evidence is insufficient). */
  async recommend(
    target: OptimizationTarget,
    context: OptimizationContext = {},
  ): Promise<StrategyRecommendation | undefined> {
    return (await this.decide(target, context)).recommendation;
  }

  /**
   * One advisory decision: the recommendation (if any) plus its auditable
   * record (Phase 20) — optimization query, candidates considered, outcome.
   */
  private async decide(
    target: OptimizationTarget,
    context: OptimizationContext,
  ): Promise<{
    recommendation: StrategyRecommendation | undefined;
    audit: OptimizationAuditRecord;
  }> {
    const category = categoryForTarget(target);
    const entries =
      category === undefined
        ? []
        : await this.memory.entries({
            category,
            userId: context.userId,
            capability: context.constraints?.capability,
          });
    const evidence = extractEvidenceForTarget(entries, target);
    const preFiltered = buildCandidates(evidence).filter((c) =>
      satisfiesConstraint(c, context.constraints),
    );
    let candidates = applyRuntimeTruth(preFiltered, {
      runtimeTruth: context.runtimeTruth,
      explicitInstruction:
        context.explicitInstruction?.subject === target ? context.explicitInstruction : undefined,
      allowedSubjects: context.constraints?.allowedSubjects,
    });
    if (target === 'RECOVERY_STRATEGY' && context.constraints?.allowedSubjects === undefined) {
      candidates = candidates.filter((c) =>
        (RECOMMENDABLE_RECOVERY_STRATEGIES as readonly string[]).includes(c.subject),
      );
    }
    candidates = boundCandidates(candidates, MAX_CANDIDATES_CONSIDERED);

    const audit: OptimizationAuditRecord = {
      query: target,
      target,
      candidatesConsidered: candidates.length,
      decided: candidates.length < preFiltered.length ? 'conflict_resolved' : 'insufficient',
      at: this.clock(),
      advisory: true,
    };

    if (candidates.length === 0) {
      this.observer?.onRecommendation?.(target, undefined, 'INSUFFICIENT');
      return { recommendation: undefined, audit };
    }

    // Conservative exploration (Phase 15): may swap in the runner-up when
    // explicitly allowed, bounded, and never for high-risk subjects.
    const exploration = decideExploration(candidates, {
      allowExploration: context.constraints?.allowExploration,
      maxExplorationShare: context.constraints?.maxExplorationShare,
      random: this.random,
    });
    const exploredCandidate = exploration.candidate;
    const ordered =
      exploration.explored && exploredCandidate !== undefined
        ? [exploredCandidate, ...candidates.filter((c) => c.subject !== exploredCandidate.subject)]
        : candidates;

    const recommendation = buildRecommendation({
      target,
      candidates: ordered,
      maxAlternatives: MAX_ALTERNATIVES,
      createdAt: this.clock(),
      recommendationId: `rec-${generateId()}`,
    });
    if (recommendation === undefined) {
      this.observer?.onRecommendation?.(target, undefined, 'INSUFFICIENT');
      return { recommendation: undefined, audit };
    }
    audit.decided = 'recommended';
    audit.recommendation = {
      subject: recommendation.subject,
      level: recommendation.evidenceLevel,
      score: recommendation.score,
    };
    this.observer?.onRecommendation?.(target, recommendation.subject, recommendation.evidenceLevel);
    return { recommendation, audit };
  }

  /** Advisory recommendations + decision records for every optimization target in context. */
  async recommendAll(
    context: OptimizationContext = {},
  ): Promise<{ recommendations: StrategyRecommendation[]; decisions: OptimizationAuditRecord[] }> {
    const targets: OptimizationTarget[] = [
      'PLAN_PATTERN',
      'TOOL_SELECTION',
      'RECOVERY_STRATEGY',
      'VERIFICATION_STRATEGY',
      'ROUTING_SIGNAL',
      'EXECUTION_SEQUENCE',
    ];
    const cap = context.constraints?.maxRecommendations;
    const recommendations: StrategyRecommendation[] = [];
    const decisions: OptimizationAuditRecord[] = [];
    for (const target of targets) {
      const { recommendation, audit } = await this.decide(target, context);
      decisions.push(audit);
      if (recommendation === undefined) continue;
      recommendations.push(recommendation);
      if (cap !== undefined && recommendations.length >= cap) break;
    }
    return { recommendations, decisions };
  }

  // ── Routing advisory (Phase 11 — advisory ONLY) ─────────────────

  /** Advisory provider/model signal for the EXISTING router. Never authoritative. */
  async routingSignal(
    context: OptimizationContext = {},
  ): Promise<RoutingExperienceSignal | undefined> {
    const category = categoryForTarget('ROUTING_SIGNAL');
    const entries = category === undefined ? [] : await this.memory.entries({ category });
    const evidence = extractEvidenceForTarget(entries, 'ROUTING_SIGNAL');
    let candidates = buildCandidates(evidence);
    candidates = applyRuntimeTruth(candidates, {
      runtimeTruth: context.runtimeTruth,
      allowedSubjects: context.constraints?.allowedSubjects,
    });
    const top = candidates[0];
    if (top === undefined || top.evidence.evidenceLevel === 'INSUFFICIENT') return undefined;
    const providerMatch = top.subject.match(/^provider:([^/]+)(?:\/model:(.+))?$/);
    return {
      subject: top.subject,
      provider: providerMatch?.[1],
      model: providerMatch?.[2],
      taskSuccessSignal: top.evidence.verificationSuccessRate,
      costEfficiencySignal: top.evidence.hasPerformanceData
        ? 1 - top.evidence.averageCostUsd
        : undefined,
      verificationReliability: top.evidence.verificationSuccessRate,
      evidenceLevel: top.evidence.evidenceLevel,
      recency: top.evidence.recency,
      sampleCount: top.evidence.sampleCount,
      advisory: true,
    };
  }

  // ── Feedback loop (Phase 21) ────────────────────────────────────

  /** Record what happened after a recommendation was accepted/rejected. */
  async recordOutcome(input: RecommendationOutcomeInput): Promise<void> {
    const record: RecommendationOutcomeRecord = {
      recommendationId: input.recommendationId,
      decision: input.decision,
      outcome: input.outcome,
      executionId: input.executionId,
      recordedAt: this.clock(),
    };
    await this.outcomes.save(record);
    this.observer?.onOutcome?.(record);
  }

  /** Effectiveness analytics for one recommendation (measures uplift, Phase 21). */
  async effectiveness(recommendationId: string): Promise<RecommendationEffectiveness> {
    const records = await this.outcomes.list();
    const own = records.filter((r) => r.recommendationId === recommendationId);
    const accepted = own.filter((r) => r.decision === 'accepted').length;
    const rejected = own.filter((r) => r.decision === 'rejected').length;
    const byOutcome = (k: RecommendationOutcomeKind): number =>
      own.filter((r) => r.outcome === k).length;
    const verifiedSuccess = byOutcome('verified_success');
    const failures = byOutcome('failure');
    const blocked = byOutcome('blocked');
    const unverified = byOutcome('unverified');
    const accuracy =
      accepted + rejected === 0
        ? undefined
        : verifiedSuccess / Math.max(1, verifiedSuccess + failures);
    return {
      recommendationId,
      accepted,
      rejected,
      verifiedSuccess,
      failures,
      blocked,
      unverified,
      accuracy,
    };
  }

  // ── Conservative comparison (Phase 22) ──────────────────────────

  /** Deterministic A/B comparison; never an LLM-declared significance. */
  async compare(
    aSubject: string,
    bSubject: string,
    target: OptimizationTarget,
  ): Promise<StrategyComparison | undefined> {
    const category = categoryForTarget(target);
    const entries = category === undefined ? [] : await this.memory.entries({ category });
    const evidence = extractEvidenceForTarget(entries, target);
    const a = evidence.find((e) => e.subject === aSubject);
    const b = evidence.find((e) => e.subject === bSubject);
    if (a === undefined || b === undefined) return undefined;
    return compareStrategies(a, b);
  }

  // ── Internal (test/observability helpers) ───────────────────────

  /** Exposed for deterministic tests: candidate ranking before recommendation. */
  async rankCandidates(target: OptimizationTarget): Promise<StrategyCandidate[]> {
    const category = categoryForTarget(target);
    const entries = category === undefined ? [] : await this.memory.entries({ category });
    const evidence: StrategyEvidence[] = extractEvidenceForTarget(entries, target);
    return buildCandidates(evidence);
  }
}
