// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Strategy Domain Service: Strategy Service
// Orchestrates the full strategy build: capability plan → provider
// candidates → budgets → risk → fallback → validation. Produces the
// complete ExecutionStrategy. No execution.
// EI-004 — Enterprise Execution Strategy Engine
// ──────────────────────────────────────────────────────────────────

import type { QualityTier } from '@vedmoulya/ai';
import type {
  CapabilityPlan,
  CostBudget,
  ExecutionMode,
  ExecutionModePlan,
  ExecutionStrategy,
  LatencyBudget,
  ProviderCandidate,
  StrategyInput,
  TokenBudget,
} from '../../types/strategy-types.js';
import { CapabilityPlannerService } from './CapabilityPlannerService.js';
import { ProviderCandidateService } from './ProviderCandidateService.js';
import { BudgetEngineService } from './BudgetEngineService.js';
import { RiskEngineService } from './RiskEngineService.js';
import { FallbackEngineService } from './FallbackEngineService.js';
import { StrategyValidatorService } from './StrategyValidatorService.js';
import { generateStrategyId } from '../value-objects/StrategyId.js';

export class ExecutionStrategyService {
  private readonly planner: CapabilityPlannerService;
  private readonly candidates: ProviderCandidateService;
  private readonly budget: BudgetEngineService;
  private readonly risk: RiskEngineService;
  private readonly fallback: FallbackEngineService;
  private readonly validator: StrategyValidatorService;

  constructor() {
    this.planner = new CapabilityPlannerService();
    this.candidates = new ProviderCandidateService();
    this.budget = new BudgetEngineService();
    this.risk = new RiskEngineService();
    this.fallback = new FallbackEngineService();
    this.validator = new StrategyValidatorService();
  }

  /**
   * Build a complete execution strategy for a goal.
   */
  createStrategy(input: StrategyInput): ExecutionStrategy {
    const strategyId = generateStrategyId();
    const capabilityPlan = this.planner.plan(input.goal, input.business);
    const providerCandidates = this.candidates.rankCandidates(
      capabilityPlan.requiredCapabilities,
      input.availableProviders,
    );
    const tokenBudget = this.budget.estimateTokens(
      capabilityPlan,
      input.qualityTier,
      input.maxTokens,
    );
    const costBudget = this.budget.estimateCost(tokenBudget, providerCandidates, input.maxCostUsd);
    const latencyBudget = this.budget.estimateLatency(
      capabilityPlan,
      providerCandidates,
      input.maxLatencyMs,
    );
    const qualityTarget = this.budget.buildQualityTarget(input.qualityTier);
    const risk = this.risk.assess(providerCandidates, tokenBudget, costBudget, latencyBudget);
    const executionMode = this.determineMode(capabilityPlan);
    const modePlan = this.buildModePlan(capabilityPlan, executionMode, providerCandidates);
    const fallbackPlan = this.fallback.buildFallback(
      strategyId,
      providerCandidates.map((c) => c.family),
    );
    const retryPolicy = this.fallback.buildRetryPolicy();

    const strategy: ExecutionStrategy = {
      strategyId,
      goalId: input.goalId,
      goal: input.goal,
      business: input.business,
      capabilityPlan,
      providerCandidates,
      contextReference: {
        sources: [
          'conversation_memory',
          'enterprise_memory',
          'knowledge_base',
          'business_rules',
          'client_data',
          'project_data',
        ],
        maxContextTokens: tokenBudget.contextTokens,
        priorityCapabilities: capabilityPlan.requiredCapabilities,
        requiresAssembly: true,
      },
      executionMode,
      modePlan,
      priority: input.priority,
      risk,
      confidence: this.computeConfidence(providerCandidates, risk),
      tokenBudget,
      costBudget,
      latencyBudget,
      qualityTarget,
      fallbackPlan,
      retryPolicy,
      validation: { passed: false, checks: [], summary: 'Not yet validated', score: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
    };

    // Validate the assembled strategy.
    strategy.validation = this.validator.validate(strategy);
    return strategy;
  }

  /**
   * Validate an existing strategy (re-run the validator).
   */
  validateStrategy(strategy: ExecutionStrategy): ExecutionStrategy {
    return { ...strategy, validation: this.validator.validate(strategy) };
  }

  /**
   * Estimate tokens for a goal without building a full strategy.
   */
  estimateTokens(goal: string, tier: QualityTier, maxTokens?: number): TokenBudget {
    const plan = this.planner.plan(goal);
    return this.budget.estimateTokens(plan, tier, maxTokens);
  }

  /**
   * Estimate cost for a goal without building a full strategy.
   */
  estimateCost(goal: string, tier: QualityTier, maxCostUsd?: number): CostBudget {
    const plan = this.planner.plan(goal);
    const candidates = this.candidates.rankCandidates(plan.requiredCapabilities);
    const tokenBudget = this.budget.estimateTokens(plan, tier);
    return this.budget.estimateCost(tokenBudget, candidates, maxCostUsd);
  }

  /**
   * Estimate latency for a goal without building a full strategy.
   */
  estimateLatency(goal: string, tier: QualityTier, maxLatencyMs?: number): LatencyBudget {
    const plan = this.planner.plan(goal);
    const candidates = this.candidates.rankCandidates(plan.requiredCapabilities);
    return this.budget.estimateLatency(plan, candidates, maxLatencyMs);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private determineMode(plan: CapabilityPlan): ExecutionMode {
    const hasParallel = plan.steps.some(
      (s) => s.flowType === 'parallel' || s.children.some((c) => c.flowType === 'parallel'),
    );
    const hasConditional = plan.steps.some(
      (s) => s.flowType === 'conditional' || s.flowType === 'optional',
    );
    if (hasParallel && hasConditional) return 'hybrid';
    if (hasParallel) return 'parallel';
    if (hasConditional) return 'pipeline';
    return 'sequential';
  }

  private buildModePlan(
    plan: CapabilityPlan,
    mode: ExecutionMode,
    candidates: ProviderCandidate[],
  ): ExecutionModePlan {
    const order = plan.steps.map((s) => s.stepId);
    const perStep = candidates[0]?.latencyEstimateMs ?? 1000;
    const sequential: ExecutionModePlan['sequential'] = {
      order,
      failFast: mode === 'sequential',
      expectedTotalMs: Math.round(perStep * order.length),
    };
    const parallel: ExecutionModePlan['parallel'] = {
      groups: [order],
      maxConcurrency: Math.max(1, Math.min(4, order.length)),
      expectedTotalMs: Math.round(
        perStep * Math.ceil(order.length / Math.max(1, Math.min(4, order.length))),
      ),
    };
    const description = this.describeMode(mode, order.length);
    return { mode, sequential, parallel, description };
  }

  private describeMode(mode: ExecutionMode, stepCount: number): string {
    switch (mode) {
      case 'sequential':
        return `Execute ${String(stepCount)} steps in strict order`;
      case 'parallel':
        return `Execute ${String(stepCount)} steps concurrently where possible`;
      case 'hybrid':
        return `Mix of sequential and parallel steps (${String(stepCount)} total)`;
      case 'pipeline':
        return `Pipeline with optional/conditional stages (${String(stepCount)} total)`;
    }
  }

  private computeConfidence(
    candidates: ProviderCandidate[],
    risk: { overallRisk: number },
  ): number {
    if (candidates.length === 0) return 0.3;
    const avgQuality = candidates.reduce((s, c) => s + c.qualityEstimate, 0) / candidates.length;
    return Math.max(0, Math.min(1, 0.6 * avgQuality + 0.4 * (1 - risk.overallRisk)));
  }
}
