// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: Deterministic Fixtures
// Fake ports keep every test hermetic (no network, no secrets, instant
// clock). Behaviors are scripted explicitly — never inferred.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType, QualityTier } from '@vedmoulya/ai';
import type {
  AgentAiActionInput,
  AgentAiActionResult,
  AgentAiExecutionPort,
  AgentClockPort,
  AgentModelVerifierPort,
  AgentToolActionResult,
  AgentToolExecutionPort,
  AgentToolInfo,
  AgentToolRegistryPort,
} from '../contracts/agent-execution-ports.js';
import type {
  AgentPlan,
  AgentPlanStep,
  AgentRuleCheck,
  AgentStepStatus,
  ToolPermissionClass,
  VerificationPolicy,
} from '../types/agent-execution-types.js';

/** Instant clock. `autoAdvanceMs` advances every timestampMs() read so
 *  wall-clock budget tests are deterministic. */
export class FakeClock implements AgentClockPort {
  private ms = 0;

  constructor(private readonly autoAdvanceMs = 0) {}

  now(): string {
    return new Date(this.ms).toISOString();
  }

  timestampMs(): number {
    const current = this.ms;
    if (this.autoAdvanceMs > 0) this.ms += this.autoAdvanceMs;
    return current;
  }

  advance(ms: number): void {
    this.ms += ms;
  }
}

// ── AI execution port ─────────────────────────────────────────────

export interface FakeAiBehavior {
  /** Custom content per action (default: action echo). */
  contentFor?: (input: AgentAiActionInput) => string;
  /** Throw a provider error for matching calls. */
  throwFor?: (input: AgentAiActionInput) => boolean;
  /** Return a runtime error result for matching calls. */
  failFor?: (input: AgentAiActionInput) => boolean;
  /** Abstain (evidence-first) for matching calls. */
  abstainFor?: (input: AgentAiActionInput) => boolean;
  /** Capabilities that cannot be routed (plan validation). */
  unroutable?: CapabilityType[];
  /** Tokens reported per successful call. */
  tokensPerCall?: number;
  /** Cost reported per successful call. */
  costPerCall?: number;
}

export class FakeAiPort implements AgentAiExecutionPort {
  readonly calls: AgentAiActionInput[] = [];

  constructor(private readonly behavior: FakeAiBehavior = {}) {}

  execute(input: AgentAiActionInput): Promise<AgentAiActionResult> {
    this.calls.push(input);
    if (this.behavior.throwFor?.(input) === true) {
      return Promise.reject(new Error('provider 503 unavailable'));
    }
    if (this.behavior.abstainFor?.(input) === true) {
      return Promise.resolve({
        content: 'Abstained: not enough evidence to answer confidently.',
        provider: 'mock',
        model: 'mock-v1',
        tokens: { input: 10, output: 0, total: 10 },
        costUsd: 0,
        latencyMs: 1,
        abstained: true,
      });
    }
    if (this.behavior.failFor?.(input) === true) {
      return Promise.resolve({
        content: undefined,
        provider: 'mock',
        model: 'mock-v1',
        error: 'runtime validation failed',
        tokens: { input: 10, output: 0, total: 10 },
        costUsd: 0,
        latencyMs: 1,
      });
    }
    const content =
      this.behavior.contentFor?.(input) ??
      `Output for ${input.actionId}: ${input.instruction.slice(0, 60)}`;
    return Promise.resolve({
      content,
      provider: 'mock',
      model: 'mock-v1',
      tokens: {
        input: 10,
        output: content.length,
        total: 10 + content.length,
      },
      costUsd: this.behavior.costPerCall ?? 0.001,
      latencyMs: 1,
      selectionExplanation: 'mock/mock-v1 selected (deterministic test fixture)',
    });
  }

  canRoute(input: {
    capability: CapabilityType;
    requiredCapabilities?: CapabilityType[];
  }): Promise<{ ok: boolean; reason?: string }> {
    if ((this.behavior.unroutable ?? []).includes(input.capability)) {
      return Promise.resolve({ ok: false, reason: 'no model supports vision on this platform' });
    }
    return Promise.resolve({ ok: true });
  }
}

// ── Tool execution + registry ─────────────────────────────────────

export interface FakeToolBehavior {
  /** Per-tool results (Map avoids computed member access). */
  results: Map<string, AgentToolActionResult>;
  /** Tool execution latency. */
  latencyMs?: number;
}

export class FakeToolPort implements AgentToolExecutionPort {
  readonly calls: Array<{ toolName: string; arguments: Record<string, unknown> }> = [];
  private readonly results: Map<string, AgentToolActionResult>;

  constructor(behavior: Partial<FakeToolBehavior> = {}) {
    this.results = behavior.results ?? new Map();
  }

  execute(input: {
    toolName: string;
    arguments: Record<string, unknown>;
    userId?: string;
  }): Promise<AgentToolActionResult> {
    this.calls.push({ toolName: input.toolName, arguments: input.arguments });
    const override = this.results.get(input.toolName);
    if (override) {
      return Promise.resolve(override);
    }
    return Promise.resolve({
      ok: true,
      denied: false,
      outcome: `${input.toolName} executed successfully`,
    });
  }

  listAllowed(): string[] {
    return [...this.results.keys()];
  }
}

export class FakeToolRegistry implements AgentToolRegistryPort {
  private readonly tools = new Map<string, AgentToolInfo>();

  constructor(
    tools: Array<{
      toolName: string;
      permissionClass: ToolPermissionClass;
      requiresApproval?: boolean;
    }>,
  ) {
    for (const tool of tools) {
      this.tools.set(tool.toolName, {
        toolName: tool.toolName,
        permissionClass: tool.permissionClass,
        requiresApproval: tool.requiresApproval ?? false,
      });
    }
  }

  listAllowed(): string[] {
    return [...this.tools.keys()];
  }

  describe(toolName: string): AgentToolInfo | undefined {
    return this.tools.get(toolName);
  }
}

// ── Model verifier (only used when deterministic verification is impossible) ─

export interface FakeModelVerifierBehavior {
  verify?: (input: { stepId: string; output: string; criteria: string[] }) => {
    passed: boolean;
    checks: Array<{ name: string; passed: boolean; detail: string }>;
  };
}

export class FakeModelVerifier implements AgentModelVerifierPort {
  readonly calls: Array<{ output: string; criteria: string[] }> = [];

  constructor(private readonly behavior: FakeModelVerifierBehavior = {}) {}

  verify(input: { stepId: string; output: string; criteria: string[] }): Promise<{
    passed: boolean;
    checks: Array<{ name: string; passed: boolean; detail: string }>;
  }> {
    this.calls.push({ output: input.output, criteria: input.criteria });
    const result = this.behavior.verify?.(input) ?? {
      passed: true,
      checks: input.criteria.map((c) => ({ name: c, passed: true, detail: 'model says pass' })),
    };
    return Promise.resolve(result);
  }
}

// ── Plan / policy builders ────────────────────────────────────────

export function rulePolicy(
  checks: AgentRuleCheck[],
  description = 'rule-based verification',
): VerificationPolicy {
  return { kind: 'rule', description, checks };
}

export function includesRule(name: string, text: string): AgentRuleCheck {
  return { name, kind: 'includes', text };
}

export function aiAction(
  actionId: string,
  capability: CapabilityType,
  instruction: string,
  requiredCapabilities?: CapabilityType[],
): AgentPlanStep['actions'][number] {
  return { actionId, kind: 'ai', capability, requiredCapabilities, instruction };
}

export function toolAction(
  actionId: string,
  toolName: string,
  args?: Record<string, unknown>,
): AgentPlanStep['actions'][number] {
  return { actionId, kind: 'tool', toolName, arguments: args };
}

export interface StepOverrides {
  dependencies?: string[];
  allowedTools?: string[];
  verificationPolicy?: VerificationPolicy;
  recoveryPolicy?: AgentPlanStep['recoveryPolicy'];
  approvalRequired?: boolean;
  capability?: CapabilityType;
  requiredCapabilities?: CapabilityType[];
}

export function step(
  stepId: string,
  objective: string,
  actions: AgentPlanStep['actions'],
  overrides: StepOverrides = {},
): AgentPlanStep {
  return {
    stepId,
    objective,
    actions,
    allowedTools: overrides.allowedTools ?? [],
    dependencies: overrides.dependencies ?? [],
    capability: overrides.capability,
    requiredCapabilities: overrides.requiredCapabilities,
    verificationPolicy: overrides.verificationPolicy,
    recoveryPolicy: overrides.recoveryPolicy,
    approvalRequired: overrides.approvalRequired,
  };
}

export function plan(
  goalId: string,
  objective: string,
  steps: AgentPlanStep[],
  finalVerification?: VerificationPolicy,
  completionCriteria?: string[],
): AgentPlan {
  return {
    planId: `plan-test-${goalId}`,
    goalId,
    objective,
    steps,
    finalVerification,
    completionCriteria,
  };
}

export const QUALITY_TIER: QualityTier = 'standard';

/** Statuses that mean a step finished without executing (for assertions). */
export const NON_VERIFIED_STATUSES: readonly AgentStepStatus[] = ['failed', 'blocked'];
