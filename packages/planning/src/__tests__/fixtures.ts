// ──────────────────────────────────────────────────────────────────
// VedMoulya — Autonomous Planning Intelligence: Deterministic Fixtures
// Fake ports keep every test hermetic (no network, no secrets, instant
// clock). Behaviors are scripted explicitly — never inferred.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType, QualityTier } from '@vedmoulya/ai';
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
import type {
  PlannerAiPort,
  PlannerAiProposalInput,
  PlannerAiProposalResult,
} from '../contracts/planning-ports.js';

// ── Clock ─────────────────────────────────────────────────────────

export class FakeClock implements AgentClockPort {
  private ms = 0;

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

// ── Planner AI port (untrusted proposal source) ───────────────────

export interface FakePlannerAiBehavior {
  /** Proposal text returned (default: a valid 3-step proposal). */
  content?: string;
  /** Throw a provider error for every call. */
  throwError?: boolean;
  /** Return a runtime error result. */
  error?: string;
  /** Return an evidence-first abstention. */
  abstain?: boolean;
  /** Capabilities that cannot be routed (readiness). */
  unroutable?: CapabilityType[];
}

/** A valid 3-step proposal with verification on every meaningful step. */
export function validProposalJson(): string {
  return JSON.stringify({
    objective: 'Analyze the repository and fix the failing tests',
    steps: [
      {
        stepId: 'step-1',
        objective: 'Inspect repository state',
        capability: 'reasoning',
        dependencies: [],
        allowedTools: [],
        actions: [
          {
            kind: 'ai',
            capability: 'reasoning',
            instruction: 'Inspect the repository and report its state.',
          },
        ],
        verification: {
          kind: 'rule',
          description: 'inspection reported',
          checks: [{ name: 'has-report', kind: 'minLength', length: 40 }],
        },
        recovery: { maxAttempts: 2, maxRevisions: 1 },
      },
      {
        stepId: 'step-2',
        objective: 'Implement the minimal fix',
        capability: 'coding',
        dependencies: ['step-1'],
        allowedTools: [],
        actions: [
          {
            kind: 'ai',
            capability: 'coding',
            instruction: 'Implement the minimal fix.',
          },
        ],
        verification: {
          kind: 'rule',
          description: 'fix described',
          checks: [{ name: 'has-fix', kind: 'includes', text: 'fix' }],
        },
        recovery: { maxAttempts: 2, maxRevisions: 1 },
      },
      {
        stepId: 'step-3',
        objective: 'Verify the final state',
        capability: 'reasoning',
        dependencies: ['step-2'],
        allowedTools: [],
        actions: [
          {
            kind: 'ai',
            capability: 'reasoning',
            instruction: 'Verify the final state.',
          },
        ],
        verification: {
          kind: 'rule',
          description: 'state verified',
          checks: [{ name: 'has-verified', kind: 'includes', text: 'verified' }],
        },
        recovery: { maxAttempts: 2, maxRevisions: 1 },
      },
    ],
    completionCriteria: ['tests pass'],
    finalVerification: {
      kind: 'rule',
      description: 'goal verified',
      checks: [{ name: 'goal-verified', kind: 'includes', text: 'verified' }],
    },
  });
}

export class FakePlannerAi implements PlannerAiPort {
  readonly calls: PlannerAiProposalInput[] = [];

  constructor(private readonly behavior: FakePlannerAiBehavior = {}) {}

  propose(input: PlannerAiProposalInput): Promise<PlannerAiProposalResult> {
    this.calls.push(input);
    if (this.behavior.throwError === true) {
      return Promise.reject(new Error('planner provider 503 unavailable'));
    }
    if (this.behavior.abstain === true) {
      return Promise.resolve({
        content: 'Not enough evidence to propose a plan.',
        provider: 'mock',
        model: 'mock-v1',
        tokens: { input: 10, output: 0, total: 10 },
        costUsd: 0,
        latencyMs: 1,
        abstained: true,
      });
    }
    if (this.behavior.error !== undefined) {
      return Promise.resolve({
        provider: 'mock',
        model: 'mock-v1',
        tokens: { input: 10, output: 0, total: 10 },
        costUsd: 0,
        latencyMs: 1,
        error: this.behavior.error,
      });
    }
    return Promise.resolve({
      content: this.behavior.content ?? validProposalJson(),
      provider: 'mock',
      model: 'mock-v1',
      tokens: { input: 120, output: 80, total: 200 },
      costUsd: 0.001,
      latencyMs: 3,
    });
  }

  canRoute(input: {
    capability: CapabilityType;
    requiredCapabilities?: CapabilityType[];
  }): Promise<{ ok: boolean; reason?: string }> {
    if ((this.behavior.unroutable ?? []).includes(input.capability)) {
      return Promise.resolve({ ok: false, reason: 'no eligible model for this capability today' });
    }
    return Promise.resolve({ ok: true });
  }
}

// ── Tool registry (authoritative registry view) ───────────────────

export class FakeToolRegistry implements AgentToolRegistryPort {
  private readonly tools = new Map<
    string,
    { permissionClass: ToolPermissionClass; requiresApproval?: boolean }
  >();

  constructor(
    tools: Array<{
      toolName: string;
      permissionClass: ToolPermissionClass;
      requiresApproval?: boolean;
    }>,
  ) {
    for (const tool of tools) {
      this.tools.set(tool.toolName, {
        permissionClass: tool.permissionClass,
        requiresApproval: tool.requiresApproval ?? false,
      });
    }
  }

  listAllowed(): string[] {
    return [...this.tools.keys()];
  }

  describe(toolName: string): AgentToolInfo | undefined {
    const tool = this.tools.get(toolName);
    if (!tool) return undefined;
    return {
      toolName,
      permissionClass: tool.permissionClass,
      requiresApproval: tool.requiresApproval,
    };
  }
}

// ── Executor ports (the frozen engine's contracts) ────────────────

export class FakeAiPort implements AgentAiExecutionPort {
  readonly calls: AgentAiActionInput[] = [];

  constructor(private readonly content: string = 'default output') {}

  execute(input: AgentAiActionInput): Promise<AgentAiActionResult> {
    this.calls.push(input);
    return Promise.resolve({
      content: this.content,
      provider: 'mock',
      model: 'mock-v1',
      tokens: { input: 10, output: this.content.length, total: 10 + this.content.length },
      costUsd: 0.001,
      latencyMs: 1,
    });
  }

  canRoute(): Promise<{ ok: boolean; reason?: string }> {
    return Promise.resolve({ ok: true });
  }
}

export class FakeToolPort implements AgentToolExecutionPort {
  readonly calls: Array<{ toolName: string; arguments: Record<string, unknown> }> = [];

  execute(input: {
    toolName: string;
    arguments: Record<string, unknown>;
    userId?: string;
  }): Promise<AgentToolActionResult> {
    this.calls.push({ toolName: input.toolName, arguments: input.arguments });
    return Promise.resolve({
      ok: true,
      denied: false,
      outcome: `${input.toolName} executed successfully`,
    });
  }

  listAllowed(): string[] {
    return ['calculator'];
  }
}

export const STANDARD_TIER: QualityTier = 'standard';
export { validProposalJson as proposalForMultiCapability };
