import type { MissionBudget, MissionBudgetUsage } from '../types/mission-types.js';

export function createDefaultBudget(overrides?: Partial<MissionBudget>): MissionBudget {
  return {
    maxObjectives: overrides?.maxObjectives ?? 10,
    maxActions: overrides?.maxActions ?? 100,
    maxToolCalls: overrides?.maxToolCalls ?? 200,
    maxRetries: overrides?.maxRetries ?? 3,
    maxReplans: overrides?.maxReplans ?? 2,
    maxRuntimeMs: overrides?.maxRuntimeMs ?? 3600000,
    maxTokens: overrides?.maxTokens ?? 1000000,
    maxCostUsd: overrides?.maxCostUsd ?? 10,
  };
}

export function createEmptyBudgetUsage(): MissionBudgetUsage {
  return {
    objectivesCompleted: 0,
    objectivesFailed: 0,
    actionsExecuted: 0,
    toolCallsExecuted: 0,
    retriesConsumed: 0,
    replansConsumed: 0,
    runtimeMs: 0,
    tokensConsumed: 0,
    costUsdConsumed: 0,
  };
}

export function isBudgetExhausted(budget: MissionBudget, usage: MissionBudgetUsage): boolean {
  return (
    usage.objectivesCompleted + usage.objectivesFailed >= budget.maxObjectives ||
    usage.actionsExecuted >= budget.maxActions ||
    (usage.retriesConsumed > 0 && usage.retriesConsumed >= budget.maxRetries) ||
    (usage.replansConsumed > 0 && usage.replansConsumed >= budget.maxReplans) ||
    usage.runtimeMs >= budget.maxRuntimeMs ||
    usage.tokensConsumed >= budget.maxTokens ||
    usage.costUsdConsumed >= budget.maxCostUsd
  );
}

export interface BudgetCheckResult {
  exhausted: boolean;
  reason?: string;
}

export function checkBudget(budget: MissionBudget, usage: MissionBudgetUsage): BudgetCheckResult {
  if (usage.objectivesCompleted + usage.objectivesFailed >= budget.maxObjectives)
    return { exhausted: true, reason: 'Maximum objectives reached' };
  if (usage.actionsExecuted >= budget.maxActions)
    return { exhausted: true, reason: 'Maximum actions reached' };
  if (usage.toolCallsExecuted >= budget.maxToolCalls)
    return { exhausted: true, reason: 'Maximum tool calls reached' };
  if (usage.retriesConsumed > 0 && usage.retriesConsumed >= budget.maxRetries)
    return { exhausted: true, reason: 'Maximum retries reached' };
  if (usage.replansConsumed > 0 && usage.replansConsumed >= budget.maxReplans)
    return { exhausted: true, reason: 'Maximum replans reached' };
  if (usage.runtimeMs >= budget.maxRuntimeMs)
    return { exhausted: true, reason: 'Maximum runtime reached' };
  if (usage.tokensConsumed >= budget.maxTokens)
    return { exhausted: true, reason: 'Maximum tokens reached' };
  if (usage.costUsdConsumed >= budget.maxCostUsd)
    return { exhausted: true, reason: 'Maximum cost reached' };
  return { exhausted: false };
}

export function updateBudgetUsage(
  current: MissionBudgetUsage,
  delta: Partial<MissionBudgetUsage>,
): MissionBudgetUsage {
  return {
    objectivesCompleted: current.objectivesCompleted + (delta.objectivesCompleted ?? 0),
    objectivesFailed: current.objectivesFailed + (delta.objectivesFailed ?? 0),
    actionsExecuted: current.actionsExecuted + (delta.actionsExecuted ?? 0),
    toolCallsExecuted: current.toolCallsExecuted + (delta.toolCallsExecuted ?? 0),
    retriesConsumed: current.retriesConsumed + (delta.retriesConsumed ?? 0),
    replansConsumed: current.replansConsumed + (delta.replansConsumed ?? 0),
    runtimeMs: current.runtimeMs + (delta.runtimeMs ?? 0),
    tokensConsumed: current.tokensConsumed + (delta.tokensConsumed ?? 0),
    costUsdConsumed:
      Math.round((current.costUsdConsumed + (delta.costUsdConsumed ?? 0)) * 10000) / 10000,
  };
}

export function remainingBudget(
  budget: MissionBudget,
  usage: MissionBudgetUsage,
): {
  objectives: number;
  actions: number;
  toolCalls: number;
  retries: number;
  replans: number;
  runtimeMs: number;
  tokens: number;
  costUsd: number;
} {
  return {
    objectives: budget.maxObjectives - (usage.objectivesCompleted + usage.objectivesFailed),
    actions: budget.maxActions - usage.actionsExecuted,
    toolCalls: budget.maxToolCalls - usage.toolCallsExecuted,
    retries: budget.maxRetries - usage.retriesConsumed,
    replans: budget.maxReplans - usage.replansConsumed,
    runtimeMs: budget.maxRuntimeMs - usage.runtimeMs,
    tokens: budget.maxTokens - usage.tokensConsumed,
    costUsd: Math.round((budget.maxCostUsd - usage.costUsdConsumed) * 10000) / 10000,
  };
}

export function checkBudgetForObjective(
  budget: MissionBudget,
  usage: MissionBudgetUsage,
): { allowed: boolean; reason?: string; dimension?: string } {
  if (usage.objectivesCompleted + usage.objectivesFailed >= budget.maxObjectives) {
    return { allowed: false, reason: 'Objective limit reached', dimension: 'maxObjectives' };
  }
  if (usage.actionsExecuted >= budget.maxActions) {
    return { allowed: false, reason: 'Action limit reached', dimension: 'maxActions' };
  }
  if (usage.toolCallsExecuted >= budget.maxToolCalls) {
    return { allowed: false, reason: 'Tool call limit reached', dimension: 'maxToolCalls' };
  }
  if (usage.runtimeMs >= budget.maxRuntimeMs) {
    return { allowed: false, reason: 'Runtime limit reached', dimension: 'maxRuntimeMs' };
  }
  return { allowed: true };
}
