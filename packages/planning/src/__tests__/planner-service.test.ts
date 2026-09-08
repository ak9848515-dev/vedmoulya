// ──────────────────────────────────────────────────────────────────
// Planner Service — the full planning pass
// GOAL → UNDERSTANDING → GENERATION → VALIDATION → READINESS.
// Maps 1:1 to the sprint's required scenarios: valid plans, DAG
// preservation, capability preservation, BLOCKED reasons, untrusted AI
// output rejection, bounded recovery, honest AI failure handling.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { PlannerService } from '../domain/planner-service.js';
import { FakeClock, FakePlannerAi, FakeToolRegistry, validProposalJson } from './fixtures.js';

const clock = new FakeClock();

function planner(
  overrides: {
    ai?: FakePlannerAi;
    tools?: FakeToolRegistry;
    unroutable?: string[];
  } = {},
): PlannerService {
  return new PlannerService({
    ai: overrides.ai ?? new FakePlannerAi(),
    toolRegistry: overrides.tools,
    clock,
  });
}

describe('PlannerService — deterministic planning', () => {
  it('1. valid simple goal → valid READY plan', async () => {
    const service = planner();
    const { understanding, result } = await service.generatePlan({
      goal: 'Write a summary of the attached report',
    });
    expect(understanding.clarificationNeeded).toBeUndefined();
    expect(result.readiness.status).toBe('READY');
    expect(result.plan).toBeDefined();
    expect(result.plan?.steps.length).toBeGreaterThanOrEqual(1);
    expect(result.source).toBe('deterministic');
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('2. multi-step goal → dependency DAG (repository fix template)', async () => {
    const service = planner();
    const { result } = await service.generatePlan({
      goal: 'Analyze this repository and fix the failing tests',
    });
    expect(result.plan?.steps.length).toBe(7);
    const steps = result.plan?.steps ?? [];
    expect(steps[1]?.dependencies).toEqual(['step-1']);
    expect(steps[6]?.dependencies).toEqual(['step-6']);
    expect(result.readiness.status).toBe('READY');
    // Every meaningful step declares a verification policy + bounded recovery.
    for (const step of steps) {
      expect(step.verificationPolicy).toBeDefined();
      expect(step.recoveryPolicy?.maxAttempts).toBeLessThanOrEqual(3);
    }
  });

  it('3. multi-capability goal preserves ALL capabilities (never reduced)', async () => {
    const service = planner();
    const { understanding, result } = await service.generatePlan({
      goal: 'Write a summary and a report about the research findings',
    });
    // reasoning (research) + content_generation (write/report) + summarization.
    expect(understanding.requiredCapabilities.length).toBeGreaterThanOrEqual(2);
    const caps = new Set(result.selectedCapabilities);
    for (const required of understanding.requiredCapabilities) {
      expect(caps.has(required)).toBe(true);
    }
    // The generic template carries the FULL requirement set on the action —
    // multi-capability is never reduced to [primaryCapability].
    const deliverableAction = result.plan?.steps.find((s) => s.stepId === 'step-2')?.actions[0];
    expect(deliverableAction?.kind === 'ai').toBe(true);
    if (deliverableAction?.kind === 'ai') {
      expect(deliverableAction.requiredCapabilities?.length).toBe(
        understanding.requiredCapabilities.length,
      );
      expect(deliverableAction.requiredCapabilities).toContain('summarization');
    }
  });

  it('3b. uncovered inferred capabilities are recorded EXPLICITLY (never silently dropped)', async () => {
    // The repository-fix template is fixed-strategy; the goal's extra
    // summarization requirement is surfaced as a warning, not dropped.
    const service = planner();
    const { result } = await service.generatePlan({
      goal: 'Fix the failing tests and write a summary of the results',
    });
    expect(result.issues.some((i) => i.code === 'CAPABILITY_NOT_COVERED')).toBe(true);
    expect(result.readiness.status).toBe('READY');
  });

  it('asks for clarification instead of planning an underspecified goal', async () => {
    const service = planner();
    const { result } = await service.generatePlan({ goal: 'do stuff' });
    expect(result.readiness.status).toBe('BLOCKED');
    expect(result.readiness.blockedReasons.join(' ')).toContain('too short');
    expect(result.plan).toBeUndefined();
  });
});

describe('PlannerService — deterministic BLOCKED readiness', () => {
  it('10. budget violation → BLOCKED (deterministic estimate)', async () => {
    const service = planner();
    const { result } = await service.generatePlan({
      goal: 'Analyze this repository and fix the failing tests',
      constraints: { budget: { maxCostUsd: 0.0001 } },
    });
    expect(result.readiness.status).toBe('BLOCKED');
    expect(result.readiness.blockedReasons.join(' ')).toContain('cost budget');
  });

  it('15. recovery constraint caps are enforced (bounded recovery)', async () => {
    const service = planner();
    const { result } = await service.generatePlan({
      goal: 'Analyze this repository and fix the failing tests',
      constraints: { recovery: { maxAttempts: 1 } },
    });
    expect(result.readiness.status).toBe('BLOCKED');
    expect(result.readiness.blockedReasons.join(' ')).toContain('maxAttempts');
  });

  it('9. missing verification is EXPLICITLY flagged (never silent success)', async () => {
    const withoutVerification = JSON.parse(validProposalJson()) as {
      steps: Array<Record<string, unknown>>;
    };
    for (const step of withoutVerification.steps) {
      delete step.verification;
    }
    const service = planner({
      ai: new FakePlannerAi({ content: JSON.stringify(withoutVerification) }),
    });
    const { result } = await service.generatePlan({
      goal: 'Analyze this repository and fix the failing tests',
      mode: 'ai',
    });
    // Default policy: warning — the plan may proceed but steps are UNKNOWN.
    expect(result.source).toBe('ai');
    expect(result.readiness.status).toBe('READY');
    expect(
      result.issues.some(
        (i) => i.code === 'STEP_NO_VERIFICATION_POLICY' && i.severity === 'warning',
      ),
    ).toBe(true);
  });

  it('9b. requireVerification constraint upgrades missing verification to BLOCKED', async () => {
    const withoutVerification = JSON.parse(validProposalJson()) as {
      steps: Array<Record<string, unknown>>;
    };
    for (const step of withoutVerification.steps) {
      delete step.verification;
    }
    const service = planner({
      ai: new FakePlannerAi({ content: JSON.stringify(withoutVerification) }),
    });
    const { result } = await service.generatePlan({
      goal: 'Analyze this repository and fix the failing tests',
      mode: 'ai',
      constraints: { requireVerification: true },
    });
    expect(result.readiness.status).toBe('BLOCKED');
    expect(
      result.issues.some((i) => i.code === 'STEP_NO_VERIFICATION_POLICY' && i.severity === 'error'),
    ).toBe(true);
  });
});

describe('PlannerService — AI proposals (untrusted input)', () => {
  it('accepts a valid AI proposal through the full pipeline', async () => {
    const service = planner({ ai: new FakePlannerAi() });
    const { result } = await service.generatePlan({
      goal: 'Analyze this repository and fix the failing tests',
      mode: 'ai',
    });
    expect(result.source).toBe('ai');
    expect(result.readiness.status).toBe('READY');
    expect(result.plannerAi?.provider).toBe('mock');
    expect(result.plannerAi?.model).toBe('mock-v1');
    expect(result.plan?.steps.length).toBe(3);
  });

  it('4. unavailable capability → BLOCKED (CAPABILITY_NOT_ROUTABLE)', async () => {
    const visionProposal = JSON.parse(validProposalJson()) as {
      steps: Array<Record<string, unknown>>;
    };
    visionProposal.steps[1] = {
      ...visionProposal.steps[1],
      capability: 'vision',
      actions: [
        {
          kind: 'ai',
          capability: 'vision',
          instruction: 'Analyze the logo image and report what it contains.',
        },
      ],
    };
    const service = planner({
      ai: new FakePlannerAi({ content: JSON.stringify(visionProposal), unroutable: ['vision'] }),
    });
    const { result } = await service.generatePlan({
      goal: 'Analyze the logo image',
      mode: 'ai',
    });
    expect(result.readiness.status).toBe('BLOCKED');
    expect(result.readiness.blockedReasons.join(' ')).toContain('no eligible model');
  });

  it('5. unavailable tool → BLOCKED (TOOL_UNAVAILABLE, never fabricated)', async () => {
    const toolProposal = toolProposalJson('shell_exec');
    const service = planner({
      ai: new FakePlannerAi({ content: toolProposal }),
      tools: new FakeToolRegistry([{ toolName: 'calculator', permissionClass: 'EXECUTE' }]),
    });
    const { result } = await service.generatePlan({
      goal: 'Run a shell command in the repository',
      mode: 'ai',
    });
    expect(result.readiness.status).toBe('BLOCKED');
    expect(result.readiness.blockedReasons.join(' ')).toContain('not available on this platform');
  });

  it('12. unknown planner-generated tool → rejected (TOOL_UNAVAILABLE)', async () => {
    const service = planner({
      ai: new FakePlannerAi({ content: toolProposalJson('fabricated_tool') }),
      tools: new FakeToolRegistry([{ toolName: 'calculator', permissionClass: 'EXECUTE' }]),
    });
    const { result } = await service.generatePlan({
      goal: 'Execute the fabricated tool operation in the repository',
      mode: 'ai',
    });
    expect(result.readiness.status).toBe('BLOCKED');
    expect(result.readiness.blockedReasons.join(' ')).toContain('fabricated_tool');
  });

  it('6/11. unauthorized tool / permission escalation → BLOCKED (INSUFFICIENT_PERMISSION)', async () => {
    const service = planner({
      ai: new FakePlannerAi({ content: toolProposalJson('calculator') }),
      tools: new FakeToolRegistry([{ toolName: 'calculator', permissionClass: 'EXECUTE' }]),
    });
    const { result } = await service.generatePlan({
      goal: 'Calculate the total cost of the project correctly',
      mode: 'ai',
      constraints: { grantedPermissionClasses: ['READ'] },
    });
    expect(result.readiness.status).toBe('BLOCKED');
    expect(result.readiness.blockedReasons.join(' ')).toContain('NOT granted to this principal');
    expect(result.readiness.blockedReasons.join(' ')).toContain('cannot grant itself permission');
  });

  it('6b. permission escalation attempt via high-risk tool → BLOCKED', async () => {
    const service = planner({
      ai: new FakePlannerAi({ content: toolProposalJson('deploy') }),
      tools: new FakeToolRegistry([{ toolName: 'deploy', permissionClass: 'DEPLOYMENT' }]),
    });
    const { result } = await service.generatePlan({
      goal: 'Deploy the service to production safely',
      mode: 'ai',
    });
    expect(result.readiness.status).toBe('BLOCKED');
    expect(result.readiness.blockedReasons.join(' ')).toContain('permission class DEPLOYMENT');
    expect(result.readiness.blockedReasons.join(' ')).toContain('cannot grant itself permission');
  });

  it('7. invalid dependency → BLOCKED (DEPENDENCY_UNKNOWN)', async () => {
    const badDeps = JSON.parse(validProposalJson()) as { steps: Array<Record<string, unknown>> };
    badDeps.steps[1] = { ...badDeps.steps[1], dependencies: ['step-99'] };
    const service = planner({ ai: new FakePlannerAi({ content: JSON.stringify(badDeps) }) });
    const { result } = await service.generatePlan({
      goal: 'Complete the analysis and document the findings',
      mode: 'ai',
    });
    expect(result.readiness.status).toBe('BLOCKED');
    expect(result.readiness.blockedReasons.join(' ')).toContain('step-99');
  });

  it('8. circular dependency → BLOCKED (DEPENDENCY_CYCLE)', async () => {
    const base = JSON.parse(validProposalJson()) as { steps: Array<Record<string, unknown>> };
    base.steps[0] = { ...base.steps[0], dependencies: ['step-2'] };
    base.steps[1] = { ...base.steps[1], dependencies: ['step-1'] };
    const service = planner({ ai: new FakePlannerAi({ content: JSON.stringify(base) }) });
    const { result } = await service.generatePlan({
      goal: 'Complete the analysis and document the findings',
      mode: 'ai',
    });
    expect(result.readiness.status).toBe('BLOCKED');
    expect(result.readiness.blockedReasons.join(' ')).toContain('cycle');
  });

  it('13. planner cannot bypass routing (provider/model directives rejected)', async () => {
    const withProvider = JSON.parse(validProposalJson()) as Record<string, unknown>;
    withProvider.provider = 'gemini';
    withProvider.model = 'gemini-2.0-flash';
    const service = planner({ ai: new FakePlannerAi({ content: JSON.stringify(withProvider) }) });
    const { result } = await service.generatePlan({
      goal: 'Complete the analysis and document the findings',
      mode: 'ai',
    });
    // The proposal is rejected; the deterministic fallback carries no provider.
    expect(result.source).toBe('ai-fallback');
    expect(result.issues.some((i) => i.code === 'AI_PROPOSAL_REJECTED')).toBe(true);
    const serialized = JSON.stringify(result.plan);
    expect(serialized).not.toContain('gemini');
  });

  it('14. planner cannot bypass ToolRuntime (tool execution never happens in planning)', async () => {
    const service = planner({
      ai: new FakePlannerAi({ content: toolProposalJson('calculator') }),
      tools: new FakeToolRegistry([
        { toolName: 'calculator', permissionClass: 'EXECUTE', requiresApproval: false },
      ]),
    });
    const { result } = await service.generatePlan({
      goal: 'Calculate the total cost of the project correctly',
      mode: 'ai',
      constraints: { grantedPermissionClasses: ['READ', 'EXECUTE'] },
    });
    // The plan is READY and names the tool — but the planner only read the
    // registry; execution belongs to the frozen engine (see integration).
    expect(result.readiness.status).toBe('READY');
    expect(result.selectedTools).toEqual(['calculator']);
    // The registry port has no execute method by contract; assert the plan
    // is pure data (no tool results, no execution side effects).
    expect(result.plan?.steps[0]?.actions[0]?.kind).toBe('tool');
  });

  it('19. planner AI failure handled honestly (fallback + recorded reason)', async () => {
    const service = planner({ ai: new FakePlannerAi({ throwError: true }) });
    const { result } = await service.generatePlan({
      goal: 'Analyze this repository and fix the failing tests',
      mode: 'ai',
    });
    expect(result.source).toBe('ai-fallback');
    expect(result.plannerAi?.failed).toBe(true);
    expect(result.issues.some((i) => i.code === 'AI_PROPOSAL_REJECTED')).toBe(true);
    // The deterministic fallback is still a valid plan.
    expect(result.readiness.status).toBe('READY');
    expect(result.plan?.steps.length).toBe(7);
  });

  it('19b. evidence-first abstention handled honestly', async () => {
    const service = planner({ ai: new FakePlannerAi({ abstain: true }) });
    const { result } = await service.generatePlan({
      goal: 'Analyze this repository and fix the failing tests',
      mode: 'ai',
    });
    expect(result.source).toBe('ai-fallback');
    expect(result.plannerAi?.failureReason).toContain('abstained');
  });

  it('20. malformed AI planner output rejected safely', async () => {
    const service = planner({ ai: new FakePlannerAi({ content: 'totally not json' }) });
    const { result } = await service.generatePlan({
      goal: 'Analyze this repository and fix the failing tests',
      mode: 'ai',
    });
    expect(result.source).toBe('ai-fallback');
    expect(result.issues.some((i) => i.code === 'AI_PROPOSAL_REJECTED')).toBe(true);
    expect(result.issues.some((i) => i.message.includes('malformed AI proposal'))).toBe(true);
  });

  it('20b. AI proposal with unknown fields is rejected safely', async () => {
    const withJunk = JSON.parse(validProposalJson()) as { steps: Array<Record<string, unknown>> };
    (withJunk.steps[0] as Record<string, unknown>).executeNow = true;
    const service = planner({ ai: new FakePlannerAi({ content: JSON.stringify(withJunk) }) });
    const { result } = await service.generatePlan({
      goal: 'Complete the analysis and document the findings',
      mode: 'ai',
    });
    expect(result.source).toBe('ai-fallback');
    expect(result.issues.some((i) => i.message.includes('executeNow'))).toBe(true);
  });

  it('reports planner model/provider usage with sanitized failures', async () => {
    const service = planner({
      ai: new FakePlannerAi({ error: 'sk-abcdefghijklmnopqrstuvwxyz provider failure' }),
    });
    const { result } = await service.generatePlan({
      goal: 'Complete the analysis and document the findings',
      mode: 'ai',
    });
    expect(result.plannerAi?.failed).toBe(true);
    expect(result.plannerAi?.failureReason).not.toContain('sk-abcdefghijklmnopqrstuvwxyz');
  });
});

function toolProposalJson(toolName: string): string {
  return JSON.stringify({
    objective: `Use ${toolName}`,
    steps: [
      {
        stepId: 'step-1',
        objective: `Invoke ${toolName}`,
        capability: 'reasoning',
        allowedTools: [toolName],
        dependencies: [],
        actions: [{ kind: 'tool', toolName, arguments: { expression: '1+1' } }],
        verification: {
          kind: 'rule',
          description: 'tool ran',
          checks: [{ name: 'has-result', kind: 'minLength', length: 5 }],
        },
        recovery: { maxAttempts: 2, maxRevisions: 1 },
      },
    ],
    completionCriteria: ['done'],
  });
}
