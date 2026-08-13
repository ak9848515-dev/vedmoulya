// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain Decision Service
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// The Brain's decision faculty. Given a goal and a snapshot of every
// consulted Enterprise Intelligence engine, this pure service derives
// the 14 decisions (goal priority, task priority, execution order,
// capability selection, provider selection, context strategy,
// execution strategy, budget strategy, quality thresholds, risk,
// retry, fallback, learning feedback, business objectives).
//
// The Brain DECIDES — it never executes, never calls an LLM, and
// never stores business logic that belongs to another engine. Every
// decision carries full explainability (why, evidence, confidence,
// trade-offs, alternatives, risks) via BrainExplainerService.
// ──────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   dynamic member access below indexes closed-union records (decision types,
   engine keys) — never attacker-controlled input. */

import type { GoalDTO, TaskDTO } from '@vedmoulya/goals';
import type {
  LearningDashboardDTO,
  LearningModelDTO,
  LearningRecommendationDTO,
} from '@vedmoulya/learning-intelligence';
import type { CapabilityDTO, CapabilityMarketplaceDTO } from '@vedmoulya/capabilities';
import type { ProviderMarketplaceDTO } from '@vedmoulya/providers';
import type { ContextRegistrySummaryDTO } from '@vedmoulya/context';
import type { StrategySummaryDTO } from '@vedmoulya/execution-strategy';
import type { OrchestratorSummaryDTO } from '@vedmoulya/execution-orchestrator';
import type {
  BrainDecision,
  BrainDecisionConfidence,
  BrainDecisionContext,
  BrainDecisionReason,
  BrainDecisionType,
  BrainRecommendation,
} from '../../types/brain-types.js';
import { createPlanDecisionId, generateAuditId } from '../value-objects/BrainDecisionId.js';
import { BrainExplainerService } from './BrainExplainerService.js';

// ── The engine snapshot the Brain decides from ──────────────────────────────

export interface BrainEngineSnapshot {
  goal?: GoalDTO;
  tasks: TaskDTO[];
  learning?: LearningDashboardDTO;
  learningRecommendations: LearningRecommendationDTO[];
  learningModels: LearningModelDTO[];
  capabilities?: CapabilityMarketplaceDTO;
  providers?: ProviderMarketplaceDTO;
  context?: ContextRegistrySummaryDTO;
  strategies?: StrategySummaryDTO;
  orchestrator?: OrchestratorSummaryDTO;
  /** Optional explicit budget envelope supplied by the operator. */
  budgetUsd?: number;
}

export interface DecisionServiceOptions {
  /** Budget envelope floor when nothing else constrains it (USD). */
  defaultBudgetMinUsd?: number;
  /** Budget envelope ceiling when nothing else constrains it (USD). */
  defaultBudgetMaxUsd?: number;
  /** Context token budget for assembly (default 20k). */
  maxContextTokens?: number;
  /** Score that maps to a 'high' confidence level (default 0.8). */
  highConfidenceAt?: number;
}

const DEFAULT_OPTIONS: Required<DecisionServiceOptions> = {
  defaultBudgetMinUsd: 0.5,
  defaultBudgetMaxUsd: 2,
  maxContextTokens: 20_000,
  highConfidenceAt: 0.8,
};

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Engines whose data feeds each decision type (used for the context trace). */
const TYPE_ENGINES: Record<BrainDecisionType, readonly string[]> = {
  goal_priority: ['goals'],
  task_priority: ['goals'],
  execution_order: ['goals'],
  capability_selection: ['goals', 'capabilities'],
  provider_selection: ['goals', 'learning', 'providers'],
  context_strategy: ['context'],
  execution_strategy: ['goals', 'learning', 'execution-strategy'],
  budget_strategy: ['goals', 'learning'],
  quality_threshold: ['goals'],
  risk_assessment: ['goals', 'learning'],
  retry_policy: ['learning'],
  fallback_policy: ['providers', 'learning'],
  learning_feedback: ['learning'],
  business_objectives: ['goals'],
};

export class BrainDecisionService {
  private readonly options: Required<DecisionServiceOptions>;
  private readonly explainer: BrainExplainerService;

  constructor(options: DecisionServiceOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.explainer = new BrainExplainerService();
  }

  /** Derive all 14 decisions for one goal from the engine snapshot. */
  generateDecisions(
    planId: string,
    goal: GoalDTO | undefined,
    snapshot: BrainEngineSnapshot,
  ): BrainDecision[] {
    const now = new Date().toISOString();
    const generators: Array<() => BrainDecision> = [
      (): BrainDecision => this.goalPriority(planId, goal, now),
      (): BrainDecision => this.taskPriority(planId, goal, snapshot, now),
      (): BrainDecision => this.executionOrder(planId, goal, snapshot, now),
      (): BrainDecision => this.capabilitySelection(planId, goal, snapshot, now),
      (): BrainDecision => this.providerSelection(planId, goal, snapshot, now),
      (): BrainDecision => this.contextStrategy(planId, goal, snapshot, now),
      (): BrainDecision => this.executionStrategy(planId, goal, snapshot, now),
      (): BrainDecision => this.budgetStrategy(planId, goal, snapshot, now),
      (): BrainDecision => this.qualityThreshold(planId, goal, now),
      (): BrainDecision => this.riskAssessment(planId, goal, snapshot, now),
      (): BrainDecision => this.retryPolicy(planId, goal, snapshot, now),
      (): BrainDecision => this.fallbackPolicy(planId, goal, snapshot, now),
      (): BrainDecision => this.learningFeedback(planId, goal, snapshot, now),
      (): BrainDecision => this.businessObjectives(planId, goal, now),
    ];
    return generators.map((generate) => generate());
  }

  /** Which engines actually contributed data to a decision type. */
  enginesUsed(type: BrainDecisionType, snapshot: BrainEngineSnapshot): string[] {
    const has = {
      goals: snapshot.goal !== undefined || snapshot.tasks.length > 0,
      learning: snapshot.learning !== undefined || snapshot.learningModels.length > 0,
      capabilities: snapshot.capabilities !== undefined,
      providers: snapshot.providers !== undefined,
      context: snapshot.context !== undefined,
      'execution-strategy': snapshot.strategies !== undefined,
      orchestrator: snapshot.orchestrator !== undefined,
    } as Record<string, boolean>;
    return TYPE_ENGINES[type].filter((engine) => has[engine]);
  }

  // ── Generators ────────────────────────────────────────────────────────────

  private goalPriority(planId: string, goal: GoalDTO | undefined, now: string): BrainDecision {
    const priority = goal?.priority ?? 'medium';
    const score = goal?.goalScore ?? 0.5;
    const factors = [
      goal
        ? `Goal score ${round(score)} with confidence ${pct(goal.confidence)}`
        : 'No goal record — default priority applied',
      goal ? `Declared priority ${goal.priority}` : 'Received goal descriptor',
    ];
    const recommendation: BrainRecommendation = {
      entityType: 'goal',
      entityId: goal?.goalId ?? 'received_goal',
      entityLabel: goal?.title ?? 'Received goal',
      action: 'prioritize',
      params: {
        priority,
        goalScore: round(score),
        urgency: round(goal?.urgency ?? 0.5),
        importance: round(goal?.importance ?? 0.5),
      },
    };
    return this.build(
      planId,
      goal,
      'goal_priority',
      'Goal Priority',
      `Priority for "${goal?.title ?? 'the received goal'}": ${priority}.`,
      recommendation,
      this.confidence(0.5 + 0.3 * score + (goal ? 0.2 * goal.confidence : 0), factors),
      this.explainer.explain('goal_priority', goal, this.snapshotFor(goal), recommendation),
      now,
    );
  }

  private taskPriority(
    planId: string,
    goal: GoalDTO | undefined,
    snapshot: BrainEngineSnapshot,
    now: string,
  ): BrainDecision {
    const ranked = this.rankTasks(snapshot.tasks);
    const top = ranked.slice(0, 3);
    const lead = top[0];
    const recommendation: BrainRecommendation = lead
      ? {
          entityType: 'task',
          entityId: lead.taskId,
          entityLabel: lead.title,
          action: 'prioritize',
          params: { order: top.map((t) => t.taskId), topTaskIds: top.map((t) => t.taskId) },
        }
      : {
          entityType: 'task',
          entityId: goal?.goalId ?? 'received_goal',
          entityLabel: 'Deferred until tasks exist',
          action: 'defer',
          params: { reason: 'No tasks generated yet' },
        };
    return this.build(
      planId,
      goal,
      'task_priority',
      'Task Priority',
      lead
        ? `Lead task: "${lead.title}". Next: ${
            top
              .slice(1)
              .map((t) => t.title)
              .join(', ') || 'none'
          }.`
        : 'Deferred — the Goal Engine has not generated tasks yet.',
      recommendation,
      this.confidence(0.55 + 0.05 * Math.min(snapshot.tasks.length, 5), [
        'Task queue derived from priority, urgency, importance, and criticality',
      ]),
      this.explainer.explain('task_priority', goal, snapshot, recommendation),
      now,
    );
  }

  private executionOrder(
    planId: string,
    goal: GoalDTO | undefined,
    snapshot: BrainEngineSnapshot,
    now: string,
  ): BrainDecision {
    const sorted = this.rankTasks(snapshot.tasks);
    const order: string[] = [];
    const placed = new Set<string>();
    for (const task of sorted) {
      for (const dep of task.dependencies) {
        if (!placed.has(dep) && snapshot.tasks.some((t) => t.taskId === dep)) {
          order.push(dep);
          placed.add(dep);
        }
      }
      if (!placed.has(task.taskId)) {
        order.push(task.taskId);
        placed.add(task.taskId);
      }
    }
    const recommendation: BrainRecommendation = {
      entityType: 'execution',
      entityId: 'execution_order',
      entityLabel:
        order.length > 0
          ? `${order.length}-step dependency-safe order`
          : 'Deferred until tasks exist',
      action: 'order',
      params: { order, parallelEligible: snapshot.tasks.some((t) => t.parallelEligible) },
    };
    return this.build(
      planId,
      goal,
      'execution_order',
      'Execution Order',
      order.length > 0
        ? `Dependency-safe order: ${order.slice(0, 6).join(' → ')}${order.length > 6 ? '…' : ''}.`
        : 'Deferred — no tasks to order yet.',
      recommendation,
      this.confidence(
        snapshot.tasks.length > 0 ? 0.6 + 0.05 * Math.min(snapshot.tasks.length, 5) : 0.4,
        ['Dependency-safe topological ordering', 'Parallel batches enabled where eligible'],
      ),
      this.explainer.explain('execution_order', goal, snapshot, recommendation),
      now,
    );
  }

  private capabilitySelection(
    planId: string,
    goal: GoalDTO | undefined,
    snapshot: BrainEngineSnapshot,
    now: string,
  ): BrainDecision {
    const required = (
      goal?.classification?.requiredCapabilities ??
      goal?.analysis?.capabilityHints ??
      []
    ).slice(0, 5);
    const registry = snapshot.capabilities;
    let selected: CapabilityDTO | undefined;
    if (registry) {
      const active = registry.capabilities.filter((c) => c.status === 'active');
      const matched =
        required.length > 0
          ? active.find((c) =>
              required.some((r) => c.id === r || c.name.toLowerCase().includes(r.toLowerCase())),
            )
          : undefined;
      selected = matched ?? [...active].sort((a, b) => b.confidence - a.confidence)[0];
    }
    const recommendation: BrainRecommendation = selected
      ? {
          entityType: 'capability',
          entityId: selected.id,
          entityLabel: selected.name,
          action: 'use',
          params: {
            requiredCapabilities: required,
            estimatedCostUsd: selected.estimatedCostUsd,
            confidence: selected.confidence,
          },
        }
      : {
          entityType: 'capability',
          entityId: goal?.goalId ?? 'received_goal',
          entityLabel: 'Deferred until the registry is available',
          action: 'defer',
          params: { requiredCapabilities: required },
        };
    return this.build(
      planId,
      goal,
      'capability_selection',
      'Capability Selection',
      selected
        ? `Use "${selected.name}" (${selected.status}, confidence ${pct(selected.confidence)}).`
        : 'No active capability selected — registry unavailable.',
      recommendation,
      this.confidence(selected && required.length > 0 ? 0.85 : selected ? 0.7 : 0.5, [
        selected ? `Registry match "${selected.name}"` : 'Registry unavailable',
      ]),
      this.explainer.explain('capability_selection', goal, snapshot, recommendation),
      now,
    );
  }

  private providerSelection(
    planId: string,
    goal: GoalDTO | undefined,
    snapshot: BrainEngineSnapshot,
    now: string,
  ): BrainDecision {
    const learned = snapshot.learningRecommendations.find((r) => r.type === 'best_provider');
    const marketplace = snapshot.providers;
    let recommendation: BrainRecommendation;
    if (learned) {
      recommendation = {
        entityType: 'provider',
        entityId: learned.targetEntity.entityId,
        entityLabel: learned.targetEntity.entityLabel,
        action: 'use',
        params: {
          source: 'learning',
          value: round(learned.value),
          confidence: learned.confidence,
          sampleCount: learned.sampleCount,
        },
      };
    } else if (marketplace) {
      const healthy = marketplace.providers
        .filter((p) => p.health.status === 'healthy' || p.lifecycleStatus === 'active')
        .sort(
          (a, b) =>
            b.bestQuality - a.bestQuality || a.inputPerMillionTokens - b.inputPerMillionTokens,
        );
      const best = healthy[0];
      recommendation = best
        ? {
            entityType: 'provider',
            entityId: best.id,
            entityLabel: best.name,
            action: 'use',
            params: {
              source: 'registry',
              healthScore: round(best.health.healthScore),
              bestQuality: best.bestQuality,
            },
          }
        : {
            entityType: 'provider',
            entityId: 'no_provider',
            entityLabel: 'No healthy provider found',
            action: 'escalate',
            params: { reason: 'Provider Registry reported no healthy provider' },
          };
    } else {
      recommendation = {
        entityType: 'provider',
        entityId: 'no_provider',
        entityLabel: 'Deferred until registries respond',
        action: 'defer',
        params: { reason: 'Neither Learning nor Provider Registry available' },
      };
    }
    return this.build(
      planId,
      goal,
      'provider_selection',
      'Provider Selection',
      `Run "${goal?.title ?? 'the goal'}" on "${recommendation.entityLabel}".`,
      recommendation,
      this.confidence(learned ? 0.85 : marketplace ? 0.7 : 0.45, [
        learned
          ? 'Learned from observed outcomes (EI-007)'
          : marketplace
            ? 'From live registry health (EI-002)'
            : 'No provider data available',
      ]),
      this.explainer.explain('provider_selection', goal, snapshot, recommendation),
      now,
    );
  }

  private contextStrategy(
    planId: string,
    goal: GoalDTO | undefined,
    snapshot: BrainEngineSnapshot,
    now: string,
  ): BrainDecision {
    const summary = snapshot.context;
    const heavy = (summary?.totalTokens ?? 0) > 30_000;
    const strategyLabel = summary
      ? heavy
        ? 'Hybrid compression (critical first + threshold)'
        : 'Threshold compression'
      : 'Minimal critical context';
    const priorities = summary
      ? Object.entries(summary.countByPriority)
          .filter(([, count]) => count > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([key]) => key)
      : [];
    const recommendation: BrainRecommendation = {
      entityType: 'context',
      entityId: 'context_strategy_standard',
      entityLabel: strategyLabel,
      action: 'assemble',
      params: {
        priorityCategories: priorities,
        compression: heavy ? 'hybrid' : 'threshold',
        maxContextTokens: this.options.maxContextTokens,
      },
    };
    return this.build(
      planId,
      goal,
      'context_strategy',
      'Context Strategy',
      `Assemble context with ${strategyLabel} (${summary ? `${summary.total} items · ${summary.totalTokens} tokens` : 'registry unavailable'}).`,
      recommendation,
      this.confidence(summary ? 0.75 : 0.5, [
        summary
          ? `Context registry summary available (${summary.total} items)`
          : 'Context registry unavailable',
      ]),
      this.explainer.explain('context_strategy', goal, snapshot, recommendation),
      now,
    );
  }

  private executionStrategy(
    planId: string,
    goal: GoalDTO | undefined,
    snapshot: BrainEngineSnapshot,
    now: string,
  ): BrainDecision {
    const learned = snapshot.learningRecommendations.find((r) => r.type === 'best_strategy');
    const summary = snapshot.strategies;
    let mode = 'sequential';
    if (summary) {
      const entries = Object.entries(summary.countByExecutionMode).sort((a, b) => b[1] - a[1]);
      const best = entries[0];
      if (best) mode = best[0];
    }
    const recommendation: BrainRecommendation = {
      entityType: 'strategy',
      entityId: learned?.targetEntity.entityId ?? 'auto_strategy',
      entityLabel: learned?.targetEntity.entityLabel ?? `Auto ${mode} strategy`,
      action: 'apply',
      params: { mode, strategyId: learned?.targetEntity.entityId ?? null },
    };
    return this.build(
      planId,
      goal,
      'execution_strategy',
      'Execution Strategy',
      `Execute in ${mode} mode${learned ? ` using the learned "${learned.targetEntity.entityLabel}" strategy` : ''}.`,
      recommendation,
      this.confidence(learned ? 0.8 : summary ? 0.65 : 0.5, [
        learned
          ? 'Learned best strategy (EI-007)'
          : summary
            ? 'From the strategy registry (EI-004)'
            : 'Default mode applied',
      ]),
      this.explainer.explain('execution_strategy', goal, snapshot, recommendation),
      now,
    );
  }

  private budgetStrategy(
    planId: string,
    goal: GoalDTO | undefined,
    snapshot: BrainEngineSnapshot,
    now: string,
  ): BrainDecision {
    const range = goal?.classification?.estimatedCostRangeUsd;
    const min = snapshot.budgetUsd ?? range?.min ?? this.options.defaultBudgetMinUsd;
    const max = snapshot.budgetUsd ?? range?.max ?? this.options.defaultBudgetMaxUsd;
    const budgetModel = snapshot.learningModels.find((m) => m.category === 'budget');
    const perRun = budgetModel?.avgCostUsd ?? max / 10;
    const recommendation: BrainRecommendation = {
      entityType: 'budget',
      entityId: 'budget_envelope',
      entityLabel: `$${round(min)}–$${round(max)} envelope ($${round(perRun)}/run)`,
      action: 'allocate',
      params: {
        budgetMinUsd: round(min),
        budgetMaxUsd: round(max),
        perRunUsd: round(perRun),
        currency: 'USD',
      },
    };
    return this.build(
      planId,
      goal,
      'budget_strategy',
      'Budget Strategy',
      `Allocate $${round(min)}–$${round(max)}${perRun ? ` (~$${round(perRun)} per run)` : ''} for "${goal?.title ?? 'the goal'}".`,
      recommendation,
      this.confidence(budgetModel ? 0.8 : range ? 0.7 : 0.5, [
        budgetModel
          ? 'Learned budget average (EI-007)'
          : range
            ? 'From the goal cost classification'
            : 'Default envelope applied',
      ]),
      this.explainer.explain('budget_strategy', goal, snapshot, recommendation),
      now,
    );
  }

  private qualityThreshold(planId: string, goal: GoalDTO | undefined, now: string): BrainDecision {
    const strict = goal?.priority === 'high' || goal?.priority === 'critical';
    const threshold = strict ? 0.9 : 0.75;
    const recommendation: BrainRecommendation = {
      entityType: 'quality',
      entityId: strict ? 'quality_strict' : 'quality_standard',
      entityLabel: `${pct(threshold)} quality gate`,
      action: 'enforce',
      params: { qualityThreshold: threshold, qualityMinimum: round(threshold - 0.15) },
    };
    return this.build(
      planId,
      goal,
      'quality_threshold',
      'Quality Thresholds',
      `Enforce a ${pct(threshold)} quality gate${strict ? ' (strict — high-priority goal)' : ''}.`,
      recommendation,
      this.confidence(goal ? 0.8 : 0.6, [
        goal ? `Derived from goal priority ${goal.priority}` : 'Standard gate applied',
      ]),
      this.explainer.explain(
        'quality_threshold',
        goal,
        { tasks: [], learningRecommendations: [], learningModels: [] },
        recommendation,
      ),
      now,
    );
  }

  private riskAssessment(
    planId: string,
    goal: GoalDTO | undefined,
    snapshot: BrainEngineSnapshot,
    now: string,
  ): BrainDecision {
    const classification = goal?.classification;
    const riskScore = classification?.riskScore ?? 0.5;
    const riskLevel = classification?.riskLevel ?? 'medium';
    const failures = snapshot.learning?.totals.failures ?? 0;
    const risks = [
      failures > 0
        ? `Observed platform failures: ${failures}`
        : 'No observed platform failures yet',
      classification
        ? `Classification complexity: ${classification.complexity}`
        : 'Complexity unclassified',
      'Provider availability can degrade mid-execution',
      'Budget and quality constraints can conflict',
    ];
    const recommendation: BrainRecommendation = {
      entityType: 'goal',
      entityId: goal?.goalId ?? 'received_goal',
      entityLabel: `${riskLevel} risk posture`,
      action: 'mitigate',
      params: { riskScore: round(riskScore), riskLevel, risks },
    };
    return this.build(
      planId,
      goal,
      'risk_assessment',
      'Risk Assessment',
      `Risk posture: ${riskLevel} (score ${round(riskScore)}). Mitigations are baked into the plan.`,
      recommendation,
      this.confidence(classification ? 0.75 : 0.55, [
        classification ? 'From the goal classification' : 'From goal descriptors only',
      ]),
      this.explainer.explain('risk_assessment', goal, snapshot, recommendation),
      now,
    );
  }

  private retryPolicy(
    planId: string,
    goal: GoalDTO | undefined,
    snapshot: BrainEngineSnapshot,
    now: string,
  ): BrainDecision {
    const learning = snapshot.learning;
    const failureRate =
      learning && learning.totals.events > 0
        ? learning.totals.failures / learning.totals.events
        : 0;
    const maxRetries = failureRate > 0.3 ? 4 : failureRate > 0.1 ? 3 : 2;
    const recommendation: BrainRecommendation = {
      entityType: 'retry',
      entityId: `retry_${maxRetries}`,
      entityLabel: `max ${maxRetries} retries`,
      action: 'configure',
      params: {
        maxRetries,
        retryDelayMs: 1000,
        retryableFailures: ['timeout', 'rate_limit', 'transient_error'],
      },
    };
    return this.build(
      planId,
      goal,
      'retry_policy',
      'Retry Policy',
      `Configure up to ${maxRetries} retries (${pct(failureRate)} observed failure rate).`,
      recommendation,
      this.confidence(learning ? 0.75 : 0.5, [
        learning
          ? `Derived from ${learning.totals.events} observed events`
          : 'Default retry policy applied',
      ]),
      this.explainer.explain('retry_policy', goal, snapshot, recommendation),
      now,
    );
  }

  private fallbackPolicy(
    planId: string,
    goal: GoalDTO | undefined,
    snapshot: BrainEngineSnapshot,
    now: string,
  ): BrainDecision {
    const marketplace = snapshot.providers;
    const fallbackOrder = marketplace
      ? marketplace.providers
          .filter((p) => p.health.status === 'healthy' || p.lifecycleStatus === 'active')
          .sort((a, b) => b.bestQuality - a.bestQuality)
          .slice(0, 3)
          .map((p) => p.id)
      : [];
    const chain = fallbackOrder.length > 0 ? fallbackOrder : ['default_fallback'];
    const recommendation: BrainRecommendation = {
      entityType: 'fallback',
      entityId: 'fallback_chain',
      entityLabel: chain.join(' → '),
      action: 'configure',
      params: { fallbackOrder: chain, strategy: 'next_healthy' },
    };
    return this.build(
      planId,
      goal,
      'fallback_policy',
      'Fallback Policy',
      `Fallback chain: ${chain.join(' → ')}.`,
      recommendation,
      this.confidence(marketplace ? 0.7 : 0.45, [
        marketplace ? 'From provider fleet health (EI-002)' : 'Default fallback applied',
      ]),
      this.explainer.explain('fallback_policy', goal, snapshot, recommendation),
      now,
    );
  }

  private learningFeedback(
    planId: string,
    goal: GoalDTO | undefined,
    snapshot: BrainEngineSnapshot,
    now: string,
  ): BrainDecision {
    const learning = snapshot.learning;
    const categories = ['provider', 'context', 'capability', 'execution'];
    const recommendation: BrainRecommendation = {
      entityType: 'learning',
      entityId: 'learning_feedback_goal',
      entityLabel: 'provider · context · capability · execution',
      action: 'record',
      params: { categories, sourceType: 'goal', goalId: goal?.goalId ?? 'received_goal' },
    };
    return this.build(
      planId,
      goal,
      'learning_feedback',
      'Learning Feedback',
      `Record ${categories.join(', ')} signals for this goal when it runs (EI-007).`,
      recommendation,
      this.confidence(learning ? 0.8 : 0.6, [
        learning
          ? `Learning platform live (${learning.totals.events} events)`
          : 'Learning platform not yet consulted',
      ]),
      this.explainer.explain('learning_feedback', goal, snapshot, recommendation),
      now,
    );
  }

  private businessObjectives(
    planId: string,
    goal: GoalDTO | undefined,
    now: string,
  ): BrainDecision {
    const category = goal?.category ?? 'custom';
    const objectives =
      category === 'revenue'
        ? ['Revenue growth', 'Client acquisition']
        : category === 'learning'
          ? ['Skill growth', 'Knowledge depth']
          : category === 'career'
            ? ['Career advancement', 'Portfolio growth']
            : category === 'business'
              ? [...(goal?.business ?? []), 'Operational impact']
              : ['Visibility', 'Portfolio growth'];
    const recommendation: BrainRecommendation = {
      entityType: 'objective',
      entityId: 'business_objectives',
      entityLabel: objectives.join(', '),
      action: 'track',
      params: { objectives, kpis: ['outcome_met', 'revenue_impact'] },
    };
    return this.build(
      planId,
      goal,
      'business_objectives',
      'Business Objectives',
      `Advance: ${objectives.join(', ')}.`,
      recommendation,
      this.confidence(goal ? 0.75 : 0.5, [
        goal ? `Mapped from goal category ${goal.category}` : 'Inferred from the received goal',
      ]),
      this.explainer.explain(
        'business_objectives',
        goal,
        { tasks: [], learningRecommendations: [], learningModels: [] },
        recommendation,
      ),
      now,
    );
  }

  // ── Shared builders ───────────────────────────────────────────────────────

  private rankTasks(tasks: TaskDTO[]): TaskDTO[] {
    return [...tasks].sort(
      (a, b) =>
        b.priority - a.priority ||
        b.urgency - a.urgency ||
        b.importance - a.importance ||
        Number(b.critical) - Number(a.critical) ||
        a.order - b.order,
    );
  }

  private confidence(score: number, factors: string[]): BrainDecisionConfidence {
    const clamped = Math.max(0, Math.min(1, round(score)));
    const level =
      clamped >= this.options.highConfidenceAt ? 'high' : clamped >= 0.5 ? 'medium' : 'low';
    return { score: clamped, level, factors };
  }

  /** Snapshot shim for decisions that only read the goal (keeps explainers uniform). */
  private snapshotFor(goal: GoalDTO | undefined): BrainEngineSnapshot {
    return { goal, tasks: [], learningRecommendations: [], learningModels: [] };
  }

  private build(
    planId: string,
    goal: GoalDTO | undefined,
    type: BrainDecisionType,
    title: string,
    description: string,
    recommendation: BrainRecommendation,
    confidence: BrainDecisionConfidence,
    reason: BrainDecisionReason,
    now: string,
  ): BrainDecision {
    const goalId = goal?.goalId ?? 'received_goal';
    const context: BrainDecisionContext = {
      goalId,
      goalTitle: goal?.title ?? 'Received goal',
      goalCategory: goal?.category ?? 'unknown',
      goalPriority: goal?.priority ?? 'medium',
      business: goal?.business ?? [],
      budgetUsd: goal?.classification?.estimatedCostRangeUsd.max,
      engineSources: TYPE_ENGINES[type].filter((engine) => engine !== 'orchestrator'),
      observedAt: now,
    };
    return {
      decisionId: createPlanDecisionId(planId, type),
      planId,
      goalId,
      type,
      title,
      description,
      recommendation,
      confidence,
      reason,
      context,
      status: 'proposed',
      version: 1,
      actor: 'enterprise-brain',
      history: [
        {
          auditId: generateAuditId(),
          action: 'created',
          version: 1,
          actor: 'enterprise-brain',
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
  }
}
