// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: Engine Tests
// Exercises the controlled loop end-to-end with deterministic ports:
// planning/validation → dependency order → capability propagation →
// action/observation → verification → bounded recovery → outcome →
// correlated sanitized traces.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { AgentExecutionEngine } from '../domain/AgentExecutionEngine.js';
import { buildExecutionTrace } from '../domain/trace.js';
import type { AgentExecutionRun, AgentPlanStep } from '../types/agent-execution-types.js';
import { DEFAULT_AGENT_RUN_BUDGET } from '../types/agent-execution-types.js';
import type { AgentEnginePorts } from '../domain/AgentExecutionEngine.js';
import {
  aiAction,
  FakeAiPort,
  FakeClock,
  FakeToolPort,
  FakeToolRegistry,
  includesRule,
  plan,
  rulePolicy,
  step,
  toolAction,
} from './fixtures.js';

function makeEngine(
  ai: FakeAiPort,
  options: {
    tools?: FakeToolPort;
    registry?: FakeToolRegistry;
    clock?: FakeClock;
  } = {},
): {
  engine: AgentExecutionEngine;
  ai: FakeAiPort;
  tools?: FakeToolPort;
  registry?: FakeToolRegistry;
  clock: FakeClock;
} {
  const clock = options.clock ?? new FakeClock();
  const ports: AgentEnginePorts = {
    ai,
    tools: options.tools,
    toolRegistry: options.registry,
    clock,
  };
  return {
    engine: new AgentExecutionEngine(ports),
    ai,
    tools: options.tools,
    registry: options.registry,
    clock,
  };
}

function newRun(goal: string, p: ReturnType<typeof plan>): AgentExecutionRun {
  const clock = new FakeClock();
  const run: AgentExecutionRun = {
    runId: `agent-run-test`,
    goalId: p.goalId,
    planId: p.planId,
    userId: 'user-1',
    goal,
    objective: p.objective,
    autonomyLevel: 'SUPERVISED',
    plan: p,
    budget: DEFAULT_AGENT_RUN_BUDGET,
    usage: { attempts: 0, revisions: 0, toolCalls: 0, tokensUsed: 0, costUsd: 0, latencyMs: 0 },
    state: 'PLANNING',
    stateHistory: ['PLANNING'],
    stepResults: [],
    approvals: [],
    approvalDecisions: [],
    validationIssues: [],
    outcomeReasons: [],
    createdAt: clock.now(),
    updatedAt: clock.now(),
  };
  return run;
}

function runHappyPlanSteps(): AgentPlanStep[] {
  return [
    step(
      'research',
      'research the topic',
      [aiAction('act-research', 'reasoning', 'Research {goal}')],
      {
        verificationPolicy: rulePolicy([includesRule('research', 'R1')]),
      },
    ),
    step(
      'analyze',
      'analyze the research',
      [aiAction('act-analyze', 'reasoning', 'Analyze {outputOf:research}')],
      {
        dependencies: ['research'],
        verificationPolicy: rulePolicy([includesRule('analyze', 'A1')]),
      },
    ),
    step(
      'final',
      'write the final answer',
      [aiAction('act-final', 'content_generation', 'Finalize')],
      {
        dependencies: ['analyze'],
        verificationPolicy: rulePolicy([includesRule('final', 'F1')]),
      },
    ),
  ];
}

describe('AgentExecutionEngine — planning + execution', () => {
  it('executes a multi-step dependency plan to COMPLETED + ACHIEVED with verified steps', async () => {
    const ai = new FakeAiPort({
      contentFor: (input) => {
        if (input.actionId === 'act-research') return 'Research: R1';
        if (input.actionId === 'act-analyze') return 'Analysis: A1';
        return 'Final: F1';
      },
    });
    const { engine, clock } = makeEngine(ai);
    const p = plan(
      'g1',
      'research then write',
      runHappyPlanSteps(),
      rulePolicy([includesRule('final', 'F1')]),
    );
    const run = newRun('Build the report.', p);
    const finished = await engine.run(run);

    expect(finished.state).toBe('COMPLETED');
    expect(finished.outcome).toBe('ACHIEVED');
    expect(
      finished.outcomeReasons.some((r) => r.includes('final goal verification VERIFIED')),
    ).toBe(true);
    expect(finished.usage.attempts).toBe(3);

    // Dependency order enforced (research before analyze before final).
    expect(ai.calls.map((c) => c.actionId)).toEqual(['act-research', 'act-analyze', 'act-final']);
    // Dependency output substitution reached the dependent step.
    expect(ai.calls[1]?.instruction).toContain('Research: R1');

    for (const stepId of ['research', 'analyze', 'final']) {
      const sr = finished.stepResults.find((s) => s.stepId === stepId);
      expect(sr?.status).toBe('completed');
      expect(sr?.verified).toBe(true);
      expect(sr?.verdict).toBe('VERIFIED');
      expect(sr?.actions).toHaveLength(1);
      expect(sr?.observations).toHaveLength(1);
      expect(sr?.observations[0]?.status).toBe('succeeded');
    }

    // Explicit state machine history.
    expect(finished.stateHistory).toContain('PLANNING');
    expect(finished.stateHistory).toContain('READY');
    expect(finished.stateHistory).toContain('EXECUTING');
    expect(finished.stateHistory).toContain('VERIFYING');
    expect(finished.stateHistory).toContain('COMPLETED');
    void clock;
  });

  it('preserves requiredCapabilities in FULL through the execution path', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'code that compiles' });
    const { engine } = makeEngine(ai);
    const p = plan('g2', 'implement', [
      step(
        'code',
        'write code',
        [aiAction('act-code', 'coding', 'Write code', ['coding', 'reasoning'])],
        {
          verificationPolicy: rulePolicy([includesRule('compiles', 'compiles')]),
        },
      ),
    ]);
    const run = newRun('Implement feature.', p);
    await engine.run(run);
    expect(ai.calls[0]?.requiredCapabilities).toEqual(['coding', 'reasoning']);
    expect(ai.calls[0]?.capability).toBe('coding');
  });

  it('blocks structural validation failures BEFORE any execution (no calls at all)', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'x' });
    const { engine } = makeEngine(ai);
    const p = plan('g3', 'bad plan', [
      step('x', 'tool step', [toolAction('t1', 'fs.read')], { allowedTools: [] }), // outside allowlist
    ]);
    const run = newRun('Do the thing.', p);
    const finished = await engine.run(run);
    expect(finished.state).toBe('BLOCKED');
    expect(finished.outcome).toBe('BLOCKED');
    expect(finished.validationIssues.some((i) => i.code === 'TOOL_NOT_ALLOWED')).toBe(true);
    expect(ai.calls).toHaveLength(0);
  });

  it('identifies an impossible capability up front and blocks only that step', async () => {
    const p = plan('g4', 'mixed', [
      step('think', 'reason', [aiAction('act-think', 'reasoning', 'Think')], {
        verificationPolicy: rulePolicy([includesRule('ok', 'ok')]),
      }),
      step('see', 'describe image', [aiAction('act-see', 'vision', 'Describe the image')], {
        dependencies: ['think'],
        verificationPolicy: rulePolicy([includesRule('described', 'described')]),
      }),
    ]);
    // Use an AI port whose canRoute rejects vision. The think step must
    // PASS its own 'ok' verification so only the vision step is blocked.
    const visionAi = new FakeAiPort({
      contentFor: (input) => (input.actionId === 'act-think' ? 'okay' : 'described'),
      unroutable: ['vision'],
    });
    const { engine: engine2 } = makeEngine(visionAi);
    const run2 = newRun('Mixed goal.', p);
    const finished = await engine2.run(run2);

    expect(finished.state).toBe('BLOCKED');
    expect(finished.outcome).toBe('BLOCKED');
    const seeStep = finished.stepResults.find((s) => s.stepId === 'see');
    expect(seeStep?.status).toBe('blocked');
    expect(seeStep?.error).toContain('CAPABILITY_NOT_ROUTABLE'.slice(0, 8));
    const thinkStep = finished.stepResults.find((s) => s.stepId === 'think');
    expect(thinkStep?.status).toBe('completed');
    // Only the feasible step executed.
    expect(visionAi.calls.map((c) => c.actionId)).toEqual(['act-think']);
  });

  it('blocks an unavailable tool step but lets independent steps run honestly', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'analysis A1' });
    const registry = new FakeToolRegistry([{ toolName: 'fs.read', permissionClass: 'READ' }]);
    const { engine } = makeEngine(ai, { registry });
    const p = plan('g5', 'tool goal', [
      step('a', 'ai step', [aiAction('act-a', 'reasoning', 'analyze')], {
        verificationPolicy: rulePolicy([includesRule('A1', 'A1')]),
      }),
      step('b', 'github step', [toolAction('act-b', 'gh')], {
        allowedTools: ['gh'],
        dependencies: ['a'],
      }),
    ]);
    const run = newRun('Tool goal.', p);
    const finished = await engine.run(run);
    expect(finished.state).toBe('BLOCKED');
    expect(finished.outcome).toBe('BLOCKED');
    const a = finished.stepResults.find((s) => s.stepId === 'a');
    expect(a?.status).toBe('completed');
    const b = finished.stepResults.find((s) => s.stepId === 'b');
    expect(b?.status).toBe('blocked');
    expect(b?.error).toContain('not available');
    expect(finished.validationIssues.some((i) => i.code === 'TOOL_UNAVAILABLE')).toBe(true);
  });
});

describe('AgentExecutionEngine — actions + observations + combined steps', () => {
  it('executes an AI + tool step (AI output then tool artifact) with observation correlation', async () => {
    const ai = new FakeAiPort({
      contentFor: () => 'generated implementation with header',
    });
    const tools = new FakeToolPort({
      results: new Map([
        [
          'fs.write',
          {
            ok: true,
            denied: false,
            outcome: 'wrote implementation.ts',
            artifacts: [{ name: 'implementation.ts', type: 'file' }],
          },
        ],
      ]),
    });
    const { engine } = makeEngine(ai, { tools });
    const p = plan('g6', 'code + save', [
      step(
        'build',
        'generate and save the file',
        [
          aiAction('act-gen', 'coding', 'Generate implementation'),
          toolAction('act-save', 'fs.write', { path: 'implementation.ts' }),
        ],
        {
          allowedTools: ['fs.write'],
          verificationPolicy: {
            kind: 'artifact',
            description: 'file exists',
            artifact: { name: 'implementation.ts', type: 'file' },
          },
        },
      ),
    ]);
    const run = newRun('Build a file.', p);
    const finished = await engine.run(run);
    expect(finished.state).toBe('COMPLETED');
    expect(finished.outcome).toBe('ACHIEVED');
    const sr = finished.stepResults[0];
    expect(sr?.actions.map((a) => a.kind)).toEqual(['ai', 'tool']);
    expect(sr?.observations).toHaveLength(2);
    const toolObs = sr?.observations.find((o) => o.actionId === 'act-save');
    expect(toolObs?.artifacts).toEqual([{ name: 'implementation.ts', type: 'file' }]);
    const action = sr?.actions.find((a) => a.actionId === 'act-save');
    expect(action?.observationId).toBe(toolObs?.observationId);
    expect(sr?.verification?.verdict).toBe('VERIFIED');
  });

  it('a tool denied by the security chain blocks the step — never bypassed', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'x' });
    const tools = new FakeToolPort({
      results: new Map([
        [
          'shell.rm',
          { ok: false, denied: true, outcome: 'denied by policy', error: 'not permitted' },
        ],
      ]),
    });
    const { engine } = makeEngine(ai, { tools });
    const p = plan('g7', 'delete', [
      step('rm', 'remove temp files', [toolAction('act-rm', 'shell.rm')], {
        allowedTools: ['shell.rm'],
      }),
    ]);
    const run = newRun('Clean temp.', p);
    const finished = await engine.run(run);
    expect(finished.state).toBe('BLOCKED');
    expect(finished.outcome).toBe('BLOCKED');
    const sr = finished.stepResults[0];
    expect(sr?.status).toBe('blocked');
    expect(sr?.error).toContain('denied');
    expect(sr?.observations[0]?.status).toBe('denied');
    expect(finished.outcomeReasons.join(' ')).toContain('never bypassed');
  });

  it('records structured observations and action records for every execution', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'answer DONE' });
    const { engine } = makeEngine(ai);
    const p = plan('g8', 'single', [
      step('one', 'answer', [aiAction('act-answer', 'reasoning', 'Answer')], {
        verificationPolicy: rulePolicy([includesRule('DONE', 'DONE')]),
      }),
    ]);
    const run = newRun('Answer.', p);
    const finished = await engine.run(run);
    const sr = finished.stepResults[0];
    expect(sr?.observations[0]).toMatchObject({
      runId: run.runId,
      stepId: 'one',
      actionId: 'act-answer',
      status: 'succeeded',
    });
    expect(sr?.actions[0]).toMatchObject({
      provider: 'mock',
      model: 'mock-v1',
      status: 'succeeded',
      tokensUsed: expect.any(Number),
      costUsd: 0.001,
    });
  });
});

describe('AgentExecutionEngine — verification semantics', () => {
  it('a step WITHOUT a policy is UNKNOWN — never success; recovery fails it honestly', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'here is an answer' });
    const { engine } = makeEngine(ai);
    const p = plan('g9', 'unverified', [
      step('one', 'answer', [aiAction('act-answer', 'reasoning', 'Answer')], {}),
    ]);
    const run = newRun('Answer.', p);
    const finished = await engine.run(run);
    expect(finished.state).toBe('FAILED_FINAL');
    expect(finished.outcome).toBe('FAILED');
    const sr = finished.stepResults[0];
    expect(sr?.status).toBe('failed');
    expect(sr?.verdict).toBe('UNKNOWN');
    expect(sr?.verified).toBe(false);
    expect(sr?.recoveries.map((r) => r.strategy)).toEqual(['revise_step', 'fail_step']);
  });

  it('acceptUnknown is an EXPLICIT opt-in — UNKNOWN completes but can never ACHIEVE', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'an answer' });
    const { engine } = makeEngine(ai);
    const p = plan('g10', 'unverified', [
      step('one', 'answer', [aiAction('act-answer', 'reasoning', 'Answer')], {
        recoveryPolicy: { acceptUnknown: true },
      }),
    ]);
    const run = newRun('Answer.', p);
    const finished = await engine.run(run);
    expect(finished.state).toBe('COMPLETED');
    expect(finished.outcome).toBe('PARTIALLY_ACHIEVED');
    const sr = finished.stepResults[0];
    expect(sr?.status).toBe('completed');
    expect(sr?.verified).toBe(false);
    expect(sr?.verdict).toBe('UNKNOWN');
    expect(finished.outcomeReasons.join(' ')).toContain('not VERIFIED');
  });

  it('GOAL outcome is distinct from step success: steps verified, final goal check FAILED', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'implementation ready' });
    const { engine } = makeEngine(ai);
    const p = plan(
      'g11',
      'build + deploy',
      [
        step('code', 'write code', [aiAction('act-code', 'coding', 'Write')], {
          verificationPolicy: rulePolicy([includesRule('ready', 'ready')]),
        }),
      ],
      // Goal-level check fails: nothing was actually deployed.
      rulePolicy([includesRule('deployed', 'DEPLOYED')]),
    );
    const run = newRun('Build and deploy.', p);
    const finished = await engine.run(run);
    expect(finished.state).toBe('FAILED_FINAL');
    expect(finished.outcome).toBe('FAILED');
    const sr = finished.stepResults[0];
    expect(sr?.status).toBe('completed');
    expect(sr?.verified).toBe(true);
    expect(finished.outcomeReasons.join(' ')).toContain('final goal verification FAILED');
  });

  it('verification failure triggers a bounded revised step that then passes', async () => {
    const ai = new FakeAiPort({
      contentFor: (input) => (input.revision > 0 ? 'the real answer DONE' : 'a vague answer'),
    });
    const { engine } = makeEngine(ai);
    const p = plan('g12', 'answer', [
      step('one', 'answer', [aiAction('act-answer', 'reasoning', 'Answer')], {
        verificationPolicy: rulePolicy([includesRule('DONE', 'DONE')]),
      }),
    ]);
    const run = newRun('Answer precisely.', p);
    const finished = await engine.run(run);
    expect(finished.outcome).toBe('ACHIEVED');
    const sr = finished.stepResults[0];
    expect(sr?.status).toBe('completed');
    expect(sr?.verified).toBe(true);
    expect(sr?.revisions).toBe(1);
    expect(sr?.recoveries.map((r) => r.strategy)).toContain('revise_step');
    expect(sr?.recoveries.map((r) => r.failureClass)).toContain('VERIFICATION_FAILED');
    // The revised instruction reached the model (approach changed).
    expect(ai.calls[1]?.instruction).toContain('[Revision 1');
  });

  it('verification failure with revision budget exhausted fails the step (bounded)', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'still wrong' });
    const { engine } = makeEngine(ai);
    const p = plan('g13', 'answer', [
      step('one', 'answer', [aiAction('act-answer', 'reasoning', 'Answer')], {
        verificationPolicy: rulePolicy([includesRule('DONE', 'DONE')]),
        recoveryPolicy: { maxAttempts: 2, maxRevisions: 1 },
      }),
    ]);
    const run = newRun('Answer precisely.', p);
    const finished = await engine.run(run);
    expect(finished.state).toBe('FAILED_FINAL');
    expect(finished.outcome).toBe('FAILED');
    const sr = finished.stepResults[0];
    expect(sr?.status).toBe('failed');
    expect(sr?.attempts).toBe(2);
    expect(sr?.recoveries.map((r) => r.strategy)).toEqual(['revise_step', 'fail_step']);
  });
});

describe('AgentExecutionEngine — bounded recovery', () => {
  it('retries a transient AI failure via alternate_model and recovers (fallback flagged)', async () => {
    const ai = new FakeAiPort({
      contentFor: () => 'working answer DONE',
      throwFor: (input) => input.attempt === 1,
    });
    const { engine } = makeEngine(ai);
    const p = plan('g14', 'answer', [
      step('one', 'answer', [aiAction('act-answer', 'reasoning', 'Answer')], {
        verificationPolicy: rulePolicy([includesRule('DONE', 'DONE')]),
      }),
    ]);
    const run = newRun('Answer.', p);
    const finished = await engine.run(run);
    expect(finished.outcome).toBe('ACHIEVED');
    const sr = finished.stepResults[0];
    expect(sr?.attempts).toBe(2);
    expect(sr?.recoveries.map((r) => r.strategy)).toEqual(['alternate_model']);
    expect(sr?.actions[1]?.fallbackUsed).toBe(true);
    expect(sr?.actions[0]?.status).toBe('failed');
    expect(sr?.actions[1]?.status).toBe('succeeded');
  });

  it('never retries forever — transient exhaustion fails the step', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'x', throwFor: () => true });
    const { engine } = makeEngine(ai);
    const p = plan('g15', 'answer', [
      step('one', 'answer', [aiAction('act-answer', 'reasoning', 'Answer')], {
        verificationPolicy: rulePolicy([includesRule('DONE', 'DONE')]),
        recoveryPolicy: { maxAttempts: 2, maxRevisions: 0 },
      }),
    ]);
    const run = newRun('Answer.', p);
    const finished = await engine.run(run);
    expect(finished.state).toBe('FAILED_FINAL');
    expect(finished.outcome).toBe('FAILED');
    const sr = finished.stepResults[0];
    expect(sr?.attempts).toBe(2);
    expect(sr?.recoveries.map((r) => r.strategy)).toEqual(['alternate_model', 'fail_step']);
    expect(sr?.actions).toHaveLength(2);
  });

  it('switches to a declared alternate tool after verification failure', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'x' });
    const tools = new FakeToolPort({
      results: new Map([
        ['readerA', { ok: true, denied: false, outcome: 'nothing useful' }],
        ['readerB', { ok: true, denied: false, outcome: 'DATA found' }],
      ]),
    });
    const { engine } = makeEngine(ai, { tools });
    const p = plan('g16', 'read', [
      step('read', 'read the file', [toolAction('act-read', 'readerA')], {
        allowedTools: ['readerA', 'readerB'],
        verificationPolicy: rulePolicy([includesRule('DATA', 'DATA')]),
        recoveryPolicy: { alternateTools: ['readerB'], maxAttempts: 2 },
      }),
    ]);
    const run = newRun('Read data.', p);
    const finished = await engine.run(run);
    expect(finished.outcome).toBe('ACHIEVED');
    const sr = finished.stepResults[0];
    expect(sr?.recoveries.map((r) => r.strategy)).toContain('alternate_tool');
    expect(sr?.actions[1]?.toolName).toBe('readerB');
    expect(sr?.verified).toBe(true);
  });

  it('fails closed when a hard token budget is exceeded', async () => {
    const ai = new FakeAiPort({
      contentFor: () => 'x'.repeat(300),
      tokensPerCall: 400,
    });
    const { engine } = makeEngine(ai);
    const p = plan('g17', 'expensive', [
      step('one', 'generate a lot', [aiAction('act-gen', 'content_generation', 'Generate')], {
        verificationPolicy: rulePolicy([includesRule('x', 'xxx')]),
      }),
    ]);
    const run = newRun('Expensive goal.', p);
    run.budget = { ...DEFAULT_AGENT_RUN_BUDGET, maxTokens: 100 };
    const finished = await engine.run(run);
    expect(finished.state).toBe('BLOCKED');
    expect(finished.outcome).toBe('BLOCKED');
    expect(finished.outcomeReasons.join(' ')).toContain('budget');
  });

  it('fails closed when the tool-call budget is exhausted', async () => {
    void 0;
    const ai = new FakeAiPort({ contentFor: () => 'x' });
    const tools = new FakeToolPort({
      results: new Map([
        ['reader', { ok: true, denied: false, outcome: 'DATA one' }],
        ['writer', { ok: true, denied: false, outcome: 'DATA two' }],
      ]),
    });
    const { engine } = makeEngine(ai, { tools });
    const p = plan('g18', 'two tools', [
      step('first', 'read', [toolAction('act-r', 'reader')], {
        allowedTools: ['reader'],
        verificationPolicy: rulePolicy([includesRule('DATA', 'one')]),
      }),
      step('second', 'write', [toolAction('act-w', 'writer')], {
        allowedTools: ['writer'],
        dependencies: ['first'],
        verificationPolicy: rulePolicy([includesRule('DATA', 'two')]),
      }),
    ]);
    const run = newRun('Two tools.', p);
    run.budget = { ...DEFAULT_AGENT_RUN_BUDGET, maxToolCalls: 1 };
    const finished = await engine.run(run);
    expect(finished.state).toBe('BLOCKED');
    expect(finished.outcome).toBe('BLOCKED');
    const first = finished.stepResults.find((s) => s.stepId === 'first');
    expect(first?.status).toBe('completed');
    const second = finished.stepResults.find((s) => s.stepId === 'second');
    expect(second?.status).toBe('blocked');
    expect(second?.error).toContain('budget');
  });

  it('fails closed when the wall-clock budget is exceeded', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'DONE' });
    // Every clock read advances 2s — the first attempt exceeds the 1s cap.
    const clock = new FakeClock(2_000);
    const { engine } = makeEngine(ai, { clock });
    const p = plan('g19', 'timed', [
      step('one', 'answer', [aiAction('act-answer', 'reasoning', 'Answer')], {
        verificationPolicy: rulePolicy([includesRule('DONE', 'DONE')]),
      }),
    ]);
    const run = newRun('Answer.', p);
    run.budget = { ...DEFAULT_AGENT_RUN_BUDGET, maxLatencyMs: 1_000 };
    const finished = await engine.run(run);
    expect(finished.state).toBe('BLOCKED');
    expect(finished.outcome).toBe('BLOCKED');
    expect(finished.outcomeReasons.join(' ')).toContain('wall-clock');
  });
});

describe('AgentExecutionEngine — traces and security', () => {
  it('produces correlated trace records and NEVER exposes secrets or prompts', async () => {
    const SECRET_KEY = 'sk-abcdefghijklmnopqrstuvwxyz1234567890';
    const ai = new FakeAiPort({
      contentFor: () => `answer DONE with api_key=${SECRET_KEY}`,
    });
    const { engine } = makeEngine(ai);
    const p = plan('g20', 'trace', [
      step('one', 'answer', [aiAction('act-answer', 'reasoning', 'Answer')], {
        verificationPolicy: rulePolicy([includesRule('DONE', 'DONE')]),
      }),
    ]);
    const run = newRun('Answer.', p);
    const finished = await engine.run(run);
    const trace = buildExecutionTrace(finished);
    const traceText = JSON.stringify(trace);

    // Correlation ids everywhere.
    for (const record of trace) {
      expect(record.runId).toBe(finished.runId);
      expect(record.goalId).toBe('g20');
      expect(record.planId).toBe(p.planId);
    }
    // Action → observation → verification → outcome phases present.
    const phases = trace.map((r) => r.phase);
    expect(phases).toContain('action');
    expect(phases).toContain('observation');
    expect(phases).toContain('verification');
    expect(phases).toContain('outcome');
    const outcome = trace.find((r) => r.phase === 'outcome');
    expect(outcome?.status).toBe('COMPLETED');
    expect(outcome?.message).toContain('ACHIEVED');

    // No secrets, no raw instruction text.
    expect(traceText).not.toContain(SECRET_KEY);
    expect(traceText).not.toContain('Answer the question with extreme detail');
    expect(traceText).toContain('[REDACTED]');
    const observationRecord = trace.find((r) => r.phase === 'observation');
    expect(observationRecord?.message).not.toContain(SECRET_KEY);

    // The persisted step output is also sanitized.
    expect(finished.stepResults[0]?.output).not.toContain(SECRET_KEY);
    expect(finished.stepResults[0]?.observations[0]?.resultSummary).not.toContain(SECRET_KEY);
  });

  it('trace outcome distinguishes PARTIALLY_ACHIEVED (completed but unverified)', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'answer text' });
    const { engine } = makeEngine(ai);
    const p = plan('g21', 'unverified', [
      step('one', 'answer', [aiAction('act-answer', 'reasoning', 'Answer')], {
        recoveryPolicy: { acceptUnknown: true },
      }),
    ]);
    const run = newRun('Answer.', p);
    const finished = await engine.run(run);
    const trace = buildExecutionTrace(finished);
    expect(trace.find((r) => r.phase === 'outcome')?.message).toContain('PARTIALLY_ACHIEVED');
  });
});
