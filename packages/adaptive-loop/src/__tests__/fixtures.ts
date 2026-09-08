// Deterministic fixtures for the adaptive loop — fake ports, plans, runs.

import type { AgentPlan, AgentPlanStep } from '@vedmoulya/agent-execution';
import type {
  AgentAiActionInput,
  AgentAiActionResult,
  AgentAiExecutionPort,
  AgentClockPort,
  AgentToolActionResult,
  AgentToolExecutionPort,
  AgentToolInfo,
  AgentToolRegistryPort,
  ToolPermissionClass,
} from '@vedmoulya/agent-execution';
import type { CapabilityType } from '@vedmoulya/ai';
import type {
  AdaptivePlannerPort,
  AgentDecisionModelPort,
  DecisionContext,
  DecisionProposalResult,
} from '../contracts/adaptive-loop-ports.js';
import type { AdaptiveLoopBudgets, AdaptiveRun } from '../types/adaptive-loop-types.js';
import { InMemoryAdaptiveApprovalStore } from '../infrastructure/InMemoryAdaptiveApprovalStore.js';
import {
  AdaptiveEngine,
  type AdaptiveEngine as AdaptiveEngineType,
} from '../domain/adaptive-engine.js';

// ── Deterministic clock ────────────────────────────────────────────

export class FakeClock implements AgentClockPort {
  private ms = 1_700_000_000_000;
  now(): string {
    return new Date(this.ms).toISOString();
  }
  timestampMs(): number {
    return this.ms;
  }
  advance(ms: number): void {
    this.ms += ms;
  }
}

// ── Fake AI execution port (routing-backed) ───────────────────────

export class FakeAiPort implements AgentAiExecutionPort {
  public calls: AgentAiActionInput[] = [];
  constructor(
    private readonly options: {
      content?: string;
      /** Per-call content sequence (each call shifts one; last is repeated). */
      contents?: string[];
      abstain?: boolean;
      error?: string;
      provider?: string;
      model?: string;
    } = {},
  ) {}
  async execute(input: AgentAiActionInput): Promise<AgentAiActionResult> {
    this.calls.push(input);
    if (this.options.abstain === true) {
      return { abstained: true, provider: 'mock', model: 'mock-1' };
    }
    if (this.options.error !== undefined) {
      return { error: this.options.error, provider: 'mock', model: 'mock-1' };
    }
    let content: string;
    if (this.options.contents !== undefined && this.options.contents.length > 0) {
      const next = this.options.contents.shift();
      content =
        next ??
        this.options.contents[this.options.contents.length - 1] ??
        `answer for ${input.instruction}`;
    } else {
      content = this.options.content ?? `answer for ${input.instruction}`;
    }
    return {
      content,
      provider: this.options.provider ?? 'mock',
      model: this.options.model ?? 'mock-1',
      tokens: { input: 10, output: 5, total: 15 },
      costUsd: 0.00001,
      latencyMs: 1,
    };
  }
  async canRoute(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}

// ── Fake tool ports (the frozen ToolRuntime security chain) ────────

export interface FakeToolSpec {
  permissionClass: ToolPermissionClass;
  requiresApproval?: boolean;
  denied?: boolean;
  outcome?: string;
  error?: string;
}

export class FakeToolRegistry implements AgentToolRegistryPort {
  constructor(private readonly tools: Record<string, FakeToolSpec> = {}) {}
  listAllowed(): string[] {
    return Object.keys(this.tools);
  }
  describe(toolName: string): AgentToolInfo | undefined {
    const spec = this.tools[toolName];
    if (spec === undefined) return undefined;
    return {
      toolName,
      permissionClass: spec.permissionClass,
      requiresApproval: spec.requiresApproval,
    };
  }
}

export class FakeToolPort implements AgentToolExecutionPort {
  public calls: Array<{ toolName: string; arguments: Record<string, unknown> }> = [];
  constructor(private readonly spec: FakeToolSpec) {}
  async execute(input: {
    toolName: string;
    arguments: Record<string, unknown>;
  }): Promise<AgentToolActionResult> {
    this.calls.push({ toolName: input.toolName, arguments: input.arguments });
    if (this.spec.denied === true) {
      return { ok: false, denied: true, outcome: '', error: 'denied by security policy' };
    }
    if (this.spec.error !== undefined) {
      return { ok: false, denied: false, outcome: '', error: this.spec.error };
    }
    return {
      ok: true,
      denied: false,
      outcome: this.spec.outcome ?? `ok from ${input.toolName}`,
      artifacts: [{ name: `${input.toolName}.out`, type: 'text' }],
      latencyMs: 1,
    };
  }
  listAllowed(): string[] {
    return [this.spec.permissionClass === undefined ? 'tool' : 'read.tool'];
  }
}

export function makeToolRegistry(tools: Record<string, FakeToolSpec>): FakeToolRegistry {
  return new FakeToolRegistry(tools);
}

// ── Scripted decision model (the model's output is UNTRUSTED) ─────

export class ScriptedDecisionModel implements AgentDecisionModelPort {
  private readonly queue: DecisionProposalResult[];
  public contexts: DecisionContext[] = [];
  constructor(...responses: DecisionProposalResult[]) {
    this.queue = [...responses];
  }
  async decide(input: DecisionContext): Promise<DecisionProposalResult> {
    this.contexts.push(input);
    const next = this.queue.shift();
    if (next === undefined) {
      // Deterministic default once the script is exhausted: continue the plan.
      return { content: JSON.stringify({ kind: 'CONTINUE', rationale: 'script exhausted' }) };
    }
    return next;
  }
}

export function jsonDecision(decision: Record<string, unknown>): DecisionProposalResult {
  return { content: JSON.stringify(decision) };
}

export const CONTINUE = (): DecisionProposalResult =>
  jsonDecision({ kind: 'CONTINUE', rationale: 'proceed' });
export const VERIFY = (): DecisionProposalResult =>
  jsonDecision({ kind: 'VERIFY', rationale: 'verify now' });
export const COMPLETE = (): DecisionProposalResult =>
  jsonDecision({ kind: 'COMPLETE', rationale: 'goal achieved' });
export const ABSTAIN = (reason = 'not enough evidence'): DecisionProposalResult =>
  jsonDecision({ kind: 'ABSTAIN', rationale: reason, abstainReason: reason });
export const FAIL = (reason = 'cannot finish'): DecisionProposalResult =>
  jsonDecision({ kind: 'FAIL', rationale: reason, failReason: reason });
export const REQUEST_APPROVAL = (): DecisionProposalResult =>
  jsonDecision({
    kind: 'REQUEST_APPROVAL',
    rationale: 'needs a human',
    approvalReason: 'review required',
  });
export const TOOL_CALL = (
  tool: string,
  arguments_: Record<string, unknown> = {},
  capability?: string,
): DecisionProposalResult =>
  jsonDecision({
    kind: 'TOOL_CALL',
    rationale: `call ${tool}`,
    tool,
    ...(Object.keys(arguments_).length > 0 ? { arguments: arguments_ } : {}),
    ...(capability !== undefined ? { capability } : {}),
  });
export const AI_ACTION = (
  capability: string,
  requiredCapabilities?: string[],
): DecisionProposalResult =>
  jsonDecision({
    kind: 'AI_ACTION',
    rationale: `ai ${capability}`,
    capability,
    ...(requiredCapabilities !== undefined ? { requiredCapabilities } : {}),
  });
export const REVISE_STEP = (instruction?: string): DecisionProposalResult =>
  jsonDecision({ kind: 'REVISE_STEP', rationale: 'revise', reviseInstruction: instruction });
export const REPLAN = (reason = 'plan is stuck'): DecisionProposalResult =>
  jsonDecision({ kind: 'REPLAN', rationale: reason, replanReason: reason });
export const MALFORMED = (): DecisionProposalResult => ({ content: 'this is not json {' });

// ── Fake planner (bounded replan through the frozen planning boundary) ─

export class FakePlanner implements AdaptivePlannerPort {
  constructor(
    private readonly result?: { plan?: AgentPlan; ready: boolean; blockedReasons?: string[] },
  ) {}
  async replan(): Promise<import('../contracts/adaptive-loop-ports.js').AdaptiveReplanResult> {
    if (this.result === undefined || this.result.plan === undefined || !this.result.ready) {
      const blockedReasons = this.result?.blockedReasons ?? ['fake planner has no plan'];
      return {
        readiness: {
          status: 'BLOCKED',
          issues: blockedReasons.map((reason) => ({ code: 'FAKE_PLANNER', reason })),
          blockedReasons,
        },
        issues: [],
      };
    }
    return {
      plan: this.result.plan,
      readiness: { status: 'READY', issues: [], blockedReasons: [] },
      issues: [],
    };
  }
}

// ── Plan builders ─────────────────────────────────────────────────

export function aiStep(
  stepId: string,
  options: {
    objective?: string;
    capability?: CapabilityType;
    requiredCapabilities?: CapabilityType[];
    instruction?: string;
    verification?: 'includes-pass' | 'schema-ok' | 'none' | 'includes-verified';
    dependencies?: string[];
    allowedTools?: string[];
    acceptUnknown?: boolean;
  } = {},
): AgentPlanStep {
  const capability = options.capability ?? 'reasoning';
  return {
    stepId,
    objective: options.objective ?? `Do ${stepId}`,
    capability,
    requiredCapabilities: options.requiredCapabilities,
    dependencies: options.dependencies ?? [],
    allowedTools: options.allowedTools ?? [],
    actions: [
      {
        actionId: `${stepId}-a1`,
        kind: 'ai',
        capability,
        instruction: options.instruction ?? `Perform ${stepId} for {goal}`,
        expectedOutcome: 'a result',
      },
    ],
    verificationPolicy:
      options.verification === 'includes-pass'
        ? {
            kind: 'rule',
            description: 'output includes pass',
            checks: [{ name: 'has-pass', kind: 'includes', text: 'pass' }],
          }
        : options.verification === 'includes-verified'
          ? {
              kind: 'rule',
              description: 'output includes verified',
              checks: [{ name: 'has-verified', kind: 'includes', text: 'verified' }],
            }
          : options.verification === 'schema-ok'
            ? { kind: 'schema', description: 'schema ok', requiredKeys: ['result'] }
            : undefined,
    recoveryPolicy:
      options.verification !== 'none' || options.acceptUnknown === true
        ? { maxAttempts: 2, maxRevisions: 1, acceptUnknown: options.acceptUnknown === true }
        : undefined,
  };
}

export function toolStep(
  stepId: string,
  options: {
    objective?: string;
    toolName: string;
    permissionClass?: ToolPermissionClass;
    dependencies?: string[];
    allowedTools?: string[];
    verification?: 'artifact' | 'command-ok' | 'none';
  },
): AgentPlanStep {
  return {
    stepId,
    objective: options.objective ?? `Run ${options.toolName}`,
    capability: 'reasoning',
    dependencies: options.dependencies ?? [],
    allowedTools: options.allowedTools ?? [options.toolName],
    actions: [
      {
        actionId: `${stepId}-t1`,
        kind: 'tool',
        toolName: options.toolName,
        arguments: {},
      },
    ],
    verificationPolicy:
      options.verification === 'artifact'
        ? {
            kind: 'artifact',
            description: `${options.toolName} produces artifact`,
            artifact: { name: `${options.toolName}.out`, mustExist: true },
          }
        : options.verification === 'command-ok'
          ? {
              kind: 'command',
              description: 'command ok',
              command: { toolName: options.toolName, expect: 'ok' },
            }
          : undefined,
    recoveryPolicy:
      options.verification === 'none' ? undefined : { maxAttempts: 2, maxRevisions: 1 },
  };
}

export function simplePlan(
  options: {
    goal?: string;
    steps?: AgentPlanStep[];
    finalVerification?: AgentPlanStep['verificationPolicy'];
  } = {},
): AgentPlan {
  return {
    planId: 'plan-test-1',
    goalId: 'goal-test-1',
    objective: options.goal ?? 'Complete the repository task',
    steps: options.steps ?? [aiStep('step-1', { verification: 'includes-pass' })],
    finalVerification: options.finalVerification,
  };
}

// ── Approval store ────────────────────────────────────────────────

export function makeApprovalStore(): InMemoryAdaptiveApprovalStore {
  return new InMemoryAdaptiveApprovalStore();
}

// ── Engine deps builder ───────────────────────────────────────────

export interface EngineHarnessOptions {
  plan: AgentPlan;
  goal?: string;
  ai?: FakeAiPort;
  tools?: FakeToolPort;
  toolRegistry?: FakeToolRegistry;
  decisionModel?: ScriptedDecisionModel;
  planner?: FakePlanner;
  clock?: FakeClock;
  autonomyLevel?: 'ASSISTED' | 'SUPERVISED' | 'CONTROLLED_AUTONOMOUS';
  allowedTools?: string[];
  grantedPermissionClasses?: ToolPermissionClass[];
  approvals?: InMemoryAdaptiveApprovalStore;
  loopBudgets?: Partial<AdaptiveLoopBudgets>;
}

export function buildAdaptiveRun(options: EngineHarnessOptions): {
  run: AdaptiveRun;
  engine: AdaptiveEngine;
  approvals: InMemoryAdaptiveApprovalStore;
  clock: FakeClock;
  ai: FakeAiPort | undefined;
  tools: FakeToolPort | undefined;
} {
  const clock = options.clock ?? new FakeClock();
  const approvals = options.approvals ?? makeApprovalStore();
  const engine = new AdaptiveEngine({
    ai: options.ai,
    tools: options.tools,
    toolRegistry: options.toolRegistry,
    decisionModel: options.decisionModel,
    planner: options.planner,
    approvals,
    clock,
  });
  const run = engine.createRun({
    userId: 'user-1',
    goal: options.goal ?? options.plan.objective,
    plan: options.plan,
    goalId: options.plan.goalId,
    planId: options.plan.planId,
    autonomyLevel: options.autonomyLevel ?? 'SUPERVISED',
    allowedTools: options.allowedTools ?? options.toolRegistry?.listAllowed() ?? [],
    grantedPermissionClasses: options.grantedPermissionClasses ?? ['READ'],
    loopBudgets: options.loopBudgets,
  });
  return { run, engine, approvals, clock, ai: options.ai, tools: options.tools };
}

export type { AdaptiveRun };
export type { AdaptiveEngineType };
