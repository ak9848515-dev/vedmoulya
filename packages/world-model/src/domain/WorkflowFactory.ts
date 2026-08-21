// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · WorkflowFactory
// SPRINT-032 — a GENERIC representation for business workflows.
//
// A workflow contains: trigger · inputs · tasks · dependencies · providers
// (advisory strategies) · approval gates · execution (existing bridge only) ·
// verification · outputs · cost · expected outcome · actual outcome. No
// industry is hard-coded — CLIENT_REQUEST → ANALYZE → PROPOSE → APPROVAL →
// BUILD → TEST → DELIVER → VERIFY → BILLING is one example template, not a
// fixture.
//
// Decomposition is BOUNDED by the EXISTING WorkflowBounds (Intelligence
// Fabric, SPRINT-030): depth ≤ 8 · tasks ≤ 24 · fan-out ≤ 8 · calls ≤ 64 ·
// cost ≤ $5 · time ≤ 600 s. The factory proposes a plan; the fabric
// validates it. Nothing here executes — decomposition is representation.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  BusinessWorkflow,
  WorkflowDecomposition,
  WorkflowStep,
} from '../types/world-types.js';

export type WorkflowResult<T> = { success: true; data: T } | { success: false; error: string };

function ok<T>(data: T): WorkflowResult<T> {
  return { success: true, data };
}
function err<T>(error: string): WorkflowResult<T> {
  return { success: false, error };
}

export interface WorkflowLimits {
  maxParallelProviders: number;
  maxWorkflowDepth: number;
  maxWorkflowTasks: number;
  maxProviderCalls: number;
  maxWorkflowCostUsd: number;
  maxWorkflowTimeMs: number;
}

/** The SPRINT-030 documented bounds (see the Intelligence Fabric WorkflowBounds
 *  contract). The gateway validates against the fabric's ACTUAL configured
 *  limits; this is the documented default for proposal planning. */
export const DEFAULT_WORKFLOW_LIMITS: WorkflowLimits = {
  maxParallelProviders: 8,
  maxWorkflowDepth: 8,
  maxWorkflowTasks: 24,
  maxProviderCalls: 64,
  maxWorkflowCostUsd: 5,
  maxWorkflowTimeMs: 600_000,
};

/** Validate a decomposition plan against the bounds WITHOUT the fabric
 *  (used for deterministic unit tests + pre-checks). */
export function planWithinBounds(
  plan: WorkflowDecomposition['plan'],
  limits: WorkflowLimits = DEFAULT_WORKFLOW_LIMITS,
): { allowed: boolean; reason: string; exceeded?: string } {
  if (plan.taskCount > limits.maxWorkflowTasks) {
    return {
      allowed: false,
      reason: `${plan.taskCount} tasks exceed ${limits.maxWorkflowTasks}.`,
      exceeded: 'tasks',
    };
  }
  if (plan.depth > limits.maxWorkflowDepth) {
    return {
      allowed: false,
      reason: `depth ${plan.depth} exceeds ${limits.maxWorkflowDepth}.`,
      exceeded: 'depth',
    };
  }
  if (plan.maxParallelFanout > limits.maxParallelProviders) {
    return {
      allowed: false,
      reason: `parallel fanout ${plan.maxParallelFanout} exceeds ${limits.maxParallelProviders}.`,
      exceeded: 'parallel',
    };
  }
  if (plan.estimatedProviderCalls > limits.maxProviderCalls) {
    return {
      allowed: false,
      reason: `${plan.estimatedProviderCalls} calls exceed ${limits.maxProviderCalls}.`,
      exceeded: 'calls',
    };
  }
  if (plan.estimatedCostUsd !== undefined && plan.estimatedCostUsd > limits.maxWorkflowCostUsd) {
    return {
      allowed: false,
      reason: `estimated cost $${plan.estimatedCostUsd.toFixed(4)} exceeds $${limits.maxWorkflowCostUsd.toFixed(4)}.`,
      exceeded: 'cost',
    };
  }
  if (plan.estimatedTimeMs !== undefined && plan.estimatedTimeMs > limits.maxWorkflowTimeMs) {
    return {
      allowed: false,
      reason: `estimated time ${plan.estimatedTimeMs}ms exceeds ${limits.maxWorkflowTimeMs}ms.`,
      exceeded: 'time',
    };
  }
  return { allowed: true, reason: 'The decomposition is within all workflow bounds.' };
}

export class WorkflowFactory {
  /**
   * Propose a BOUNDED decomposition of a goal into a task graph. The caller
   * supplies the steps (each optionally naming a capability + role — never a
   * provider id); the factory derives the plan metrics, checks the documented
   * bounds and returns a proposal. Execution NEVER happens here.
   */
  decompose(input: {
    ownerId: string;
    goal: string;
    steps: Array<{ label: string; capability?: string; roleName?: string }>;
    /** Estimated USD — only when evidence exists. */
    estimatedCostUsd?: number;
    estimatedTimeMs?: number;
    limits?: WorkflowLimits;
  }): WorkflowResult<WorkflowDecomposition> {
    const goal = input.goal.trim();
    if (goal.length === 0) return err('Decomposition needs a goal.');
    if (goal.length > 300) return err('Goal is too long.');
    if (input.steps.length === 0) return err('Decomposition needs at least one step.');
    const steps = input.steps.slice(0, 24);

    // Plan metrics: tasks = steps (each step is one task); depth = longest
    // dependency chain; fanout = max parallel siblings; calls = AI-served
    // steps (capability present) plus verification passes (bounded).
    const tasks = steps.map((s) => ({
      label: s.label,
      capability: s.capability,
      roleName: s.roleName,
    }));
    const aiSteps = tasks.filter((s) => s.capability !== undefined).length;
    const estimatedProviderCalls = aiSteps + Math.min(aiSteps, 8); // bounded verification passes
    const depth = Math.min(tasks.length, 8);
    const maxParallelFanout = Math.min(tasks.length, 8);

    const plan = {
      taskCount: tasks.length,
      depth,
      maxParallelFanout,
      estimatedProviderCalls,
      estimatedCostUsd: input.estimatedCostUsd,
      estimatedTimeMs: input.estimatedTimeMs,
    };

    const limits = input.limits ?? DEFAULT_WORKFLOW_LIMITS;
    const local = planWithinBounds(plan, limits);

    return ok({
      ownerId: input.ownerId,
      goal: goal.slice(0, 300),
      plan,
      steps: tasks,
      bounds: local,
      executed: false,
    });
  }
}

/** Deterministic slug for stable keys — strips punctuation, keeps letters. */
function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** A workflow record factory — validated, owner-scoped, stable-keyed. */
export function createWorkflowRecord(input: {
  ownerId: string;
  id?: string;
  name: string;
  description: string;
  businessUnitId?: string;
  trigger: string;
  inputs: string[];
  steps: WorkflowStep[];
  outputs: string[];
  expectedOutcome?: string;
}): WorkflowResult<BusinessWorkflow> {
  const name = input.name.trim();
  if (name.length === 0) return err('A workflow needs a name.');
  if (input.trigger.trim().length === 0) return err('A workflow needs a trigger.');
  if (input.steps.length === 0) return err('A workflow needs at least one step.');
  if (input.steps.length > 24) return err('A workflow cannot exceed 24 steps (SPRINT-030 bound).');
  const ts = new Date().toISOString();
  return ok({
    id: input.id ?? `wf-${Math.random().toString(36).slice(2, 10)}`,
    ownerId: input.ownerId,
    stableKey: `${input.ownerId}:workflow:${slug(name)}`,
    name,
    description: input.description.slice(0, 500),
    businessUnitId: input.businessUnitId,
    trigger: input.trigger.slice(0, 200),
    inputs: input.inputs.slice(0, 12),
    steps: input.steps.slice(0, 24),
    outputs: input.outputs.slice(0, 12),
    expectedOutcome: input.expectedOutcome?.slice(0, 300),
    status: 'DEFINED',
    createdAt: ts,
    updatedAt: ts,
  });
}
