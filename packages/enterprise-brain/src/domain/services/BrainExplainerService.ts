// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain Explainer
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// Explainability is a hard requirement: every decision must include
// WHY, EVIDENCE, CONFIDENCE, TRADE-OFFS, ALTERNATIVES, and RISKS.
// This pure service derives the `BrainDecisionReason` for each of the
// 14 decision types from the engine snapshot (gracefully degrading
// when an engine was unavailable). Deterministic — no I/O, fully
// unit-testable.
// ──────────────────────────────────────────────────────────────────

import type { GoalDTO } from '@vedmoulya/goals';
import type { BrainDecisionReason, BrainDecisionType } from '../../types/brain-types.js';
import type { BrainEngineSnapshot } from './BrainDecisionService.js';

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export class BrainExplainerService {
  /**
   * Build the full explanation for one decision type. `recommendation`
   * carries the chosen entity + params; `snapshot` carries the consulted
   * engine data used as evidence and risk sources.
   */
  explain(
    type: BrainDecisionType,
    goal: GoalDTO | undefined,
    snapshot: BrainEngineSnapshot,
    recommendation: { entityLabel: string; params: Record<string, unknown> },
  ): BrainDecisionReason {
    const label = recommendation.entityLabel || 'the recommended option';
    const goalTitle = goal?.title ?? 'the goal';
    switch (type) {
      case 'goal_priority':
        return this.explainGoalPriority(goal, label, goalTitle);
      case 'task_priority':
        return this.explainTaskPriority(snapshot, label, goalTitle);
      case 'execution_order':
        return this.explainExecutionOrder(snapshot, label, goalTitle);
      case 'capability_selection':
        return this.explainCapabilitySelection(snapshot, label, goalTitle);
      case 'provider_selection':
        return this.explainProviderSelection(snapshot, label, goalTitle);
      case 'context_strategy':
        return this.explainContextStrategy(snapshot, label, goalTitle);
      case 'execution_strategy':
        return this.explainExecutionStrategy(snapshot, label, goalTitle);
      case 'budget_strategy':
        return this.explainBudgetStrategy(snapshot, goal, label, goalTitle);
      case 'quality_threshold':
        return this.explainQualityThreshold(goal, label, goalTitle);
      case 'risk_assessment':
        return this.explainRiskAssessment(goal, snapshot, label, goalTitle);
      case 'retry_policy':
        return this.explainRetryPolicy(snapshot, label, goalTitle);
      case 'fallback_policy':
        return this.explainFallbackPolicy(snapshot, label, goalTitle);
      case 'learning_feedback':
        return this.explainLearningFeedback(snapshot, label, goalTitle);
      case 'business_objectives':
        return this.explainBusinessObjectives(goal, label, goalTitle);
    }
  }

  // ── Per-type explanations ─────────────────────────────────────────────────

  private explainGoalPriority(
    goal: GoalDTO | undefined,
    label: string,
    goalTitle: string,
  ): BrainDecisionReason {
    const score = goal?.goalScore;
    return {
      why: `Decide how "${goalTitle}" ranks against the portfolio based on its score, priority, urgency, and importance.`,
      evidence: [
        goal
          ? `Goal scores ${score !== undefined ? round(score) : 'n/a'} (0–1) with confidence ${pct(goal.confidence)}.`
          : 'No goal record was available — decided from the received goal descriptor.',
        goal
          ? `Declared priority: ${goal.priority}; urgency ${round(goal.urgency)}, importance ${round(goal.importance)}.`
          : 'Goal descriptor provided no scoring data.',
      ],
      tradeoffs: [
        'Prioritizing this goal defers lower-value work and may starve concurrent goals.',
        'High-urgency goals can crowd out strategic, high-importance work.',
      ],
      alternatives: [
        'Re-balance toward importance (strategic value) instead of urgency.',
        'Let the Goal Engine re-score after more context accrues.',
      ],
      risks: [
        'Stale goal scores produce mis-prioritized execution.',
        'Overlapping priorities with other active goals reduce focus.',
      ],
    };
  }

  private explainTaskPriority(
    snapshot: BrainEngineSnapshot,
    label: string,
    goalTitle: string,
  ): BrainDecisionReason {
    const count = snapshot.tasks.length;
    return {
      why: `Order the tasks of "${goalTitle}" so high-priority, high-value, critical work executes first.`,
      evidence: [
        count > 0
          ? `${count} task(s) ranked by priority, urgency, importance, and criticality — "${label}" leads the queue.`
          : 'No tasks exist yet — the Brain defers task prioritization until the Goal Engine generates tasks.',
      ],
      tradeoffs: [
        'Critical tasks jump the queue and can block parallelizable low-risk work.',
        'Reordering tasks changes the execution-order contract for the orchestrator.',
      ],
      alternatives: [
        'Prioritize by estimated cost first (cheapest wins).',
        'Prioritize by dependency depth (deepest first).',
      ],
      risks: [
        'A task with many unresolved dependencies can stall the queue.',
        'Priority churn from frequent re-decisions.',
      ],
    };
  }

  private explainExecutionOrder(
    snapshot: BrainEngineSnapshot,
    label: string,
    goalTitle: string,
  ): BrainDecisionReason {
    const hasTasks = snapshot.tasks.length > 0;
    return {
      why: `Define the execution order for "${goalTitle}" — a safe sequence the Execution Orchestrator can turn into a graph without the Brain executing anything.`,
      evidence: [
        hasTasks
          ? `Ordered ${snapshot.tasks.length} task(s) respecting dependencies; ${snapshot.tasks.filter((t) => t.parallelEligible).length} are parallel-eligible.`
          : 'No tasks available — order is deferred until tasks exist.',
        'Order is dependency-safe: prerequisites always precede dependents.',
      ],
      tradeoffs: [
        'Sequential execution minimizes risk but maximizes latency.',
        'Parallel batches cut latency but raise coordination and cost risk.',
      ],
      alternatives: [
        'Fully sequential execution for maximum determinism.',
        'Fully parallel execution when dependencies are shallow.',
      ],
      risks: [
        'Hidden cross-task dependencies can invalidate the order.',
        'Long chains risk timeouts and budget overspend.',
      ],
    };
  }

  private explainCapabilitySelection(
    snapshot: BrainEngineSnapshot,
    label: string,
    goalTitle: string,
  ): BrainDecisionReason {
    const registry = snapshot.capabilities;
    const required = (
      snapshot.goal?.classification?.requiredCapabilities ??
      snapshot.goal?.analysis?.capabilityHints ??
      []
    ).slice(0, 5);
    return {
      why: `Pick the capability that best serves "${goalTitle}" from the Enterprise Capability Registry.`,
      evidence: [
        registry
          ? `Capability Registry consulted: ${registry.total} capability(ies), ${registry.activeCount} active.`
          : 'Capability Registry unavailable — decided from the goal classification hints.',
        required.length > 0
          ? `Goal requires: ${required.join(', ')}.`
          : 'No explicit capability hints — picked the best-fit active capability.',
        `Selected: "${label}".`,
      ],
      tradeoffs: [
        'Broad capabilities cover more goals but cost more per run.',
        'Narrow capabilities are cheaper and faster but less reusable.',
      ],
      alternatives:
        required.length > 0
          ? required
          : ['A composition of smaller capabilities', 'A lower-cost substitute'],
      risks: [
        'Registry staleness can select a capability past its quality minimum.',
        'Capability drift changes expected cost and latency.',
      ],
    };
  }

  private explainProviderSelection(
    snapshot: BrainEngineSnapshot,
    label: string,
    goalTitle: string,
  ): BrainDecisionReason {
    const marketplace = snapshot.providers;
    const learned = snapshot.learningRecommendations.find((r) => r.type === 'best_provider');
    return {
      why: `Choose the provider for "${goalTitle}" using learned outcomes (EI-007) and live fleet health (EI-002).`,
      evidence: [
        learned
          ? `Learning Intelligence recommends "${learned.targetEntity.entityLabel}" (value ${round(learned.value)}, ${pct(learned.confidence)} confidence, ${learned.sampleCount} samples).`
          : 'No learned provider recommendation yet.',
        marketplace
          ? `Provider Registry consulted: ${marketplace.providers.length} provider(s), ${marketplace.healthyCount} healthy.`
          : 'Provider Registry unavailable — fell back to learned data only.',
        `Selected: "${label}".`,
      ],
      tradeoffs: [
        'Premium providers raise quality but multiply cost.',
        'Economy providers cut cost but risk quality thresholds.',
      ],
      alternatives: marketplace
        ? marketplace.providers.slice(0, 3).map((p) => p.name)
        : ['Next-healthy fallback provider'],
      risks: [
        'Provider outages invalidate the selection mid-execution.',
        'Learned success rates can lag recent provider degradation.',
      ],
    };
  }

  private explainContextStrategy(
    snapshot: BrainEngineSnapshot,
    label: string,
    goalTitle: string,
  ): BrainDecisionReason {
    const summary = snapshot.context;
    return {
      why: `Define how "${goalTitle}" assembles context — which knowledge to surface and how to compress it.`,
      evidence: [
        summary
          ? `Context Registry consulted: ${summary.total} item(s), ${summary.totalTokens} token(s).`
          : 'Context Registry unavailable — defaulted to a conservative context strategy.',
        `High-priority context: ${summary?.countByPriority.high ?? 0} item(s), critical: ${summary?.countByPriority.critical ?? 0}.`,
        `Strategy: "${label}".`,
      ],
      tradeoffs: [
        'Richer context improves quality but grows cost and latency.',
        'Aggressive compression protects budgets but can drop decisive facts.',
      ],
      alternatives: ['Minimal context (only critical items)', 'Full context with no compression'],
      risks: ['Stale context misleads decisions.', 'Context bloat blows the token budget.'],
    };
  }

  private explainExecutionStrategy(
    snapshot: BrainEngineSnapshot,
    label: string,
    goalTitle: string,
  ): BrainDecisionReason {
    const summary = snapshot.strategies;
    const learned = snapshot.learningRecommendations.find((r) => r.type === 'best_strategy');
    return {
      why: `Select the execution strategy for "${goalTitle}" (mode + budget + quality envelope) from the Execution Strategy Engine.`,
      evidence: [
        summary
          ? `Execution Strategy Engine consulted: ${summary.total} strategy(ies), avg confidence ${pct(summary.averageConfidence)}.`
          : 'Execution Strategy Engine unavailable — decided from goal constraints.',
        learned
          ? `Learning Intelligence prefers the "${learned.targetEntity.entityLabel}" strategy.`
          : 'No learned strategy yet.',
        `Strategy: "${label}".`,
      ],
      tradeoffs: [
        'Pipeline mode maximizes throughput but is harder to debug.',
        'Sequential mode is simplest but slowest.',
      ],
      alternatives: [
        'Hybrid mode (parallel batches with sequential gates)',
        'Parallel mode for latency-critical goals',
      ],
      risks: [
        'Strategy budgets can be exceeded by provider cost drift.',
        'Mode mismatches can stall on dependent steps.',
      ],
    };
  }

  private explainBudgetStrategy(
    snapshot: BrainEngineSnapshot,
    goal: GoalDTO | undefined,
    label: string,
    goalTitle: string,
  ): BrainDecisionReason {
    const learned = snapshot.learningRecommendations.find((r) => r.type === 'best_budget');
    const range = goal?.classification?.estimatedCostRangeUsd;
    return {
      why: `Set the budget envelope for "${goalTitle}" so execution stays within cost without sacrificing quality.`,
      evidence: [
        range
          ? `Goal classification estimates $${round(range.min)}–$${round(range.max)} per execution.`
          : 'No cost estimate from the goal classification.',
        learned
          ? `Learning Intelligence observed ~$${round(learned.targetEntity.entityLabel === 'Budget' ? Number(learned.targetEntity.entityId.replace(/[^0-9.]/g, '') || 0) : 0)} per run for the best budget.`
          : 'No learned budget yet.',
        `Envelope: ${label}.`,
      ],
      tradeoffs: [
        'Tight budgets force cheaper providers and lower quality.',
        'Loose budgets protect quality but erode margins.',
      ],
      alternatives: [
        'Raise the envelope for premium quality goals',
        'Lower the envelope for experiment goals',
      ],
      risks: [
        'Provider cost drift breaks the envelope mid-run.',
        'Quality thresholds can conflict with the budget floor.',
      ],
    };
  }

  private explainQualityThreshold(
    goal: GoalDTO | undefined,
    label: string,
    goalTitle: string,
  ): BrainDecisionReason {
    const high = goal?.priority === 'high' || goal?.priority === 'critical';
    return {
      why: `Set the quality gate for "${goalTitle}" — the minimum score a run must meet before it is accepted.`,
      evidence: [
        goal
          ? `Goal priority ${goal.priority} → ${high ? 'strict' : 'standard'} quality gate.`
          : 'No goal record — applied the standard quality gate.',
        `Threshold: ${label}.`,
      ],
      tradeoffs: [
        'A strict gate rejects low-quality output but increases retries and cost.',
        'A lenient gate accepts more output but weakens the brand standard.',
      ],
      alternatives: [
        'Strict gate (0.9+) for client-facing work',
        'Standard gate (0.75) for internal drafts',
      ],
      risks: [
        'An unachievable gate blocks delivery entirely.',
        'A drifting gate (too lenient) lets poor quality through.',
      ],
    };
  }

  private explainRiskAssessment(
    goal: GoalDTO | undefined,
    snapshot: BrainEngineSnapshot,
    label: string,
    goalTitle: string,
  ): BrainDecisionReason {
    const classification = goal?.classification;
    const learnedFailures = snapshot.learning?.totals.failures ?? 0;
    const riskLevel = classification?.riskLevel ?? 'medium';
    return {
      why: `Assess the risk posture of "${goalTitle}" from its classification and observed failures across the platform.`,
      evidence: [
        classification
          ? `Classification risk ${round(classification.riskScore)} (${classification.riskLevel}); complexity ${classification.complexity}.`
          : 'No classification — risk assessed from goal descriptors only.',
        learnedFailures > 0
          ? `Learning Intelligence recorded ${learnedFailures} recent failure(s) platform-wide.`
          : 'No failures observed yet.',
        `Posture: ${riskLevel}.`,
      ],
      tradeoffs: [
        'Aggressive risk posture speeds delivery but raises exposure.',
        'Conservative posture protects quality at the cost of speed.',
      ],
      alternatives: [
        'Re-run classification after more context accrues',
        'Adopt the recommended mitigations',
      ],
      risks: [
        'Unmodeled dependencies surface as execution failures.',
        'Risk posture can become stale as conditions change.',
      ],
    };
  }

  private explainRetryPolicy(
    snapshot: BrainEngineSnapshot,
    label: string,
    goalTitle: string,
  ): BrainDecisionReason {
    const learned = snapshot.learningRecommendations.find(
      (r) => r.type === 'best_execution_pattern',
    );
    const params = label;
    return {
      why: `Define how many times a step of "${goalTitle}" may retry before the orchestrator escalates to fallback.`,
      evidence: [
        learned
          ? `Learning observed the "${learned.targetEntity.entityLabel}" execution pattern (${learned.sampleCount} samples).`
          : 'No learned pattern yet — applied the default retry policy.',
        `Policy: ${params}.`,
      ],
      tradeoffs: [
        'Generous retries recover transient failures but multiply cost and latency.',
        'Sparse retries cut cost but fail on flaky providers.',
      ],
      alternatives: ['Exponential backoff (2× per retry)', 'No retries — fail fast to fallback'],
      risks: [
        'Retry storms amplify provider outages.',
        'Long retry delays push past latency budgets.',
      ],
    };
  }

  private explainFallbackPolicy(
    snapshot: BrainEngineSnapshot,
    label: string,
    goalTitle: string,
  ): BrainDecisionReason {
    const marketplace = snapshot.providers;
    return {
      why: `Define the fallback chain for "${goalTitle}" so a failing provider never blocks delivery.`,
      evidence: [
        marketplace
          ? `Fallback order derived from the ${marketplace.healthyCount} healthy provider(s) in the registry.`
          : 'Provider Registry unavailable — fallback uses the learned provider ranking.',
        `Chain: ${label}.`,
      ],
      tradeoffs: [
        'Long fallback chains maximize resilience but can hide systemic provider issues.',
        'Short chains fail fast but reduce resilience.',
      ],
      alternatives: [
        'Same-family fallback first (cheaper switch)',
        'Cross-family fallback first (independent failure modes)',
      ],
      risks: [
        'Fallback selection can exceed the budget envelope.',
        'A correlated outage takes down the whole chain.',
      ],
    };
  }

  private explainLearningFeedback(
    snapshot: BrainEngineSnapshot,
    label: string,
    goalTitle: string,
  ): BrainDecisionReason {
    const learning = snapshot.learning;
    return {
      why: `Close the loop for "${goalTitle}" — the signals the Learning Intelligence Platform should record when this goal runs.`,
      evidence: [
        learning
          ? `Learning Intelligence currently holds ${learning.totals.events} event(s), ${learning.totals.models} model(s).`
          : 'Learning Intelligence unavailable — feedback scope uses defaults.',
        `Signals: ${label}.`,
      ],
      tradeoffs: [
        'Rich feedback improves future decisions but adds instrumentation overhead.',
        'Minimal feedback keeps runs lean but slows learning convergence.',
      ],
      alternatives: [
        'Record only provider + capability outcomes',
        'Record quality + feedback + business outcomes too',
      ],
      risks: [
        'Unrecorded runs leave blind spots in future decisions.',
        'Noisy signals can distort learned models.',
      ],
    };
  }

  private explainBusinessObjectives(
    goal: GoalDTO | undefined,
    label: string,
    goalTitle: string,
  ): BrainDecisionReason {
    return {
      why: `Map "${goalTitle}" to the business objectives it advances, so execution impact is measurable.`,
      evidence: [
        goal
          ? `Goal category ${goal.category}; business tags: ${goal.business.join(', ') || 'none'}.`
          : 'No goal record — objectives inferred from the received goal descriptor.',
        `Objectives: ${label}.`,
      ],
      tradeoffs: [
        'Chasing many objectives dilutes focus.',
        'Fewer objectives sharpen focus but may miss adjacent value.',
      ],
      alternatives: ['Pursue only the primary objective', 'Add a measurable KPI per objective'],
      risks: [
        'Business context can drift before the goal completes.',
        'Objectives without KPIs cannot be measured.',
      ],
    };
  }
}
