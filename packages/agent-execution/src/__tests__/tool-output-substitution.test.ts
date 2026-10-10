// ──────────────────────────────────────────────────────────────────
// REVENUE-002A — governed tool actions may consume a prior step's output
//
// A plan may declare {outputOf:step-N} inside a tool action's arguments
// (and inside a command-verification call). The engine substitutes the
// REAL completed output of that step before the governed tool runs, so a
// real AI-produced artifact can be written and then deterministically
// read back. The security chain is untouched: the tool name and every
// literal argument still come from the plan.
// ──────────────────────────────────────────────────────────────────

import { writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AgentExecutionEngine } from '../domain/AgentExecutionEngine.js';
import type { AgentExecutionRun } from '../types/agent-execution-types.js';
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

const AUTHORED = 'REPORT-BODY-456';

function makeRun(p: ReturnType<typeof plan>): AgentExecutionRun {
  const clock = new FakeClock();
  return {
    runId: 'agent-run-subst',
    goalId: p.goalId,
    planId: p.planId,
    userId: 'user-1',
    goal: 'author and write the report',
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
}

function makeTools(): FakeToolPort {
  return new FakeToolPort({
    results: new Map([
      [
        'workspace_write',
        {
          ok: true,
          denied: false,
          outcome: 'success',
          data: { path: 'output/report.md', bytes: AUTHORED.length },
        },
      ],
      ['workspace_read', { ok: true, denied: false, outcome: 'success' }],
    ]),
  });
}

function makeRegistry(): FakeToolRegistry {
  return new FakeToolRegistry([
    { toolName: 'workspace_write', permissionClass: 'WRITE' },
    { toolName: 'workspace_read', permissionClass: 'READ' },
  ]);
}

function buildPlan(): ReturnType<typeof plan> {
  return plan('goal-subst', 'author and write the report', [
    step(
      'step-1',
      'author the report',
      [aiAction('act-author', 'reasoning', 'Author the report')],
      {
        verificationPolicy: rulePolicy([includesRule('authored', AUTHORED)]),
      },
    ),
    step(
      'step-2',
      'write the authored report through the governed tool',
      [
        toolAction('act-write', 'workspace_write', {
          relativePath: 'output/report.md',
          content: '{outputOf:step-1}',
        }),
      ],
      {
        dependencies: ['step-1'],
        allowedTools: ['workspace_write', 'workspace_read'],
        capability: 'coding',
        verificationPolicy: {
          kind: 'command',
          description: 'read-back equals the authored content',
          command: {
            toolName: 'workspace_read',
            arguments: { relativePath: 'output/report.md', expectedContent: '{outputOf:step-1}' },
            expect: 'ok',
          },
        },
      },
    ),
  ]);
}

describe('governed tool actions consume a prior step output', () => {
  it('substitutes {outputOf:step-N} in the write arguments before the governed call', async () => {
    const ai = new FakeAiPort({ contentFor: () => AUTHORED });
    const tools = makeTools();
    const engine = new AgentExecutionEngine({
      ai,
      tools,
      toolRegistry: makeRegistry(),
      clock: new FakeClock(),
    } satisfies AgentEnginePorts);

    const run = makeRun(buildPlan());
    // Reference the authored content in the FINAL verification too.
    run.plan.finalVerification = {
      kind: 'command',
      description: 'the file really holds the authored content',
      command: {
        toolName: 'workspace_read',
        arguments: { relativePath: 'output/report.md', expectedContent: '{outputOf:step-1}' },
        expect: 'ok',
      },
    };

    await engine.run(run);

    expect(run.state).toBe('COMPLETED');
    expect(run.outcome).toBe('ACHIEVED');

    const writeCall = tools.calls.find((call) => call.toolName === 'workspace_write');
    expect(writeCall?.arguments['content']).toBe(AUTHORED);

    // Every read-back (step verification + final verification) asserted the
    // substituted content, never the literal placeholder.
    const readCalls = tools.calls.filter((call) => call.toolName === 'workspace_read');
    expect(readCalls.length).toBeGreaterThan(0);
    for (const call of readCalls) {
      expect(call.arguments['expectedContent']).toBe(AUTHORED);
    }
  });

  it('publishes real tool data as the step output (not just the outcome enum)', async () => {
    const ai = new FakeAiPort({ contentFor: () => AUTHORED });
    const tools = makeTools();
    const engine = new AgentExecutionEngine({
      ai,
      tools,
      toolRegistry: makeRegistry(),
      clock: new FakeClock(),
    } satisfies AgentEnginePorts);

    const run = makeRun(buildPlan());
    await engine.run(run);

    const writeStep = run.stepResults.find((result) => result.stepId === 'step-2');
    expect(writeStep?.output ?? '').toContain('output/report.md');
  });

  it('resolves a WRITE step reference to the content it wrote, not its tool metadata', async () => {
    // The author step produces AUTHORED; the write step then reports tool
    // metadata ("success\n{"path":…,"bytes":…}"). Its STEP OUTPUT is that
    // metadata, so a plan-level read-back that referenced {outputOf:step-2}
    // used to compare the real file against tool METADATA and fail a job whose
    // artifact was correct. The consumed value must be the tool's real payload.
    const ai = new FakeAiPort({ contentFor: () => AUTHORED });
    const tools = new FakeToolPort({
      results: new Map([
        ['workspace_write', { ok: true, denied: false, outcome: 'success' }],
        // The read-back succeeds and reports the payload it actually read.
        ['workspace_read', { ok: true, denied: false, outcome: 'success' }],
      ]),
      // Real tool payloads: the read-back body is the file's real content.
      data: new Map<string, unknown>([
        ['workspace_write', { path: 'output/report.md' }],
        ['workspace_read', AUTHORED],
      ]),
    });
    const engine = new AgentExecutionEngine({
      ai,
      tools,
      toolRegistry: makeRegistry(),
      clock: new FakeClock(),
    } satisfies AgentEnginePorts);

    const authPlan = plan('goal-subst-data', 'author and write the report', [
      step(
        'step-1',
        'write the authored report via the governed tool',
        [
          toolAction('act-write', 'workspace_write', {
            relativePath: 'output/report.md',
            content: AUTHORED,
          }),
        ],
        {
          allowedTools: ['workspace_write'],
          capability: 'coding',
          verificationPolicy: rulePolicy([includesRule('write-step-ran', 'success')]),
        },
      ),
    ]);
    authPlan.finalVerification = {
      kind: 'command',
      description: 'the file on disk holds exactly the content that was written',
      command: {
        toolName: 'workspace_read',
        arguments: { relativePath: 'output/report.md', expectedContent: '{outputOf:step-1}' },
        expect: 'ok',
      },
    };

    const run = makeRun(authPlan);
    await engine.run(run);

    // The reference resolves to the content the step WROTE...
    const readCall = tools.calls.find((call) => call.toolName === 'workspace_read');
    const expected = readCall?.arguments['expectedContent'];
    expect(readCall).toBeDefined();
    expect(expected).toBe(AUTHORED);
    // ...not to the step's tool metadata (outcome + result json), which is what
    // the pre-fix resolver substituted and what a naive "latest observation
    // summary" resolver would substitute again.
    expect(String(expected)).not.toContain('success');
    expect(String(expected)).not.toContain('output/report.md');
  });
  it('chains references across multiple steps (write of a write resolves the original content)', async () => {
    const ai = new FakeAiPort({ contentFor: () => AUTHORED });
    const tools = new FakeToolPort({
      results: new Map([
        ['workspace_write', { ok: true, denied: false, outcome: 'success' }],
        ['workspace_read', { ok: true, denied: false, outcome: 'success' }],
      ]),
    });
    const engine = new AgentExecutionEngine({
      ai,
      tools,
      toolRegistry: makeRegistry(),
      clock: new FakeClock(),
    } satisfies AgentEnginePorts);

    const chained = plan('goal-subst-chain', 'author, copy, and verify the report', [
      step(
        'step-1',
        'author the report',
        [aiAction('act-author', 'reasoning', 'Author the report')],
        {
          verificationPolicy: rulePolicy([includesRule('authored', AUTHORED)]),
        },
      ),
      step(
        'step-2',
        'write the authored report',
        [
          toolAction('act-write', 'workspace_write', {
            relativePath: 'output/report.md',
            content: '{outputOf:step-1}',
          }),
        ],
        {
          dependencies: ['step-1'],
          allowedTools: ['workspace_write', 'workspace_read'],
          capability: 'coding',
          verificationPolicy: rulePolicy([includesRule('write-step-ran', 'success')]),
        },
      ),
      step(
        'step-3',
        'copy the written report to a second path',
        [
          toolAction('act-copy', 'workspace_write', {
            relativePath: 'output/report-copy.md',
            content: '{outputOf:step-2}',
          }),
        ],
        {
          dependencies: ['step-2'],
          allowedTools: ['workspace_write', 'workspace_read'],
          capability: 'coding',
          verificationPolicy: rulePolicy([includesRule('copy-step-ran', 'success')]),
        },
      ),
    ]);
    chained.finalVerification = {
      kind: 'command',
      description: 'the copy holds exactly the authored content',
      command: {
        toolName: 'workspace_read',
        arguments: { relativePath: 'output/report-copy.md', expectedContent: '{outputOf:step-3}' },
        expect: 'ok',
      },
    };

    const run = makeRun(chained);
    await engine.run(run);

    const writes = tools.calls.filter((call) => call.toolName === 'workspace_write');
    expect(writes).toHaveLength(2);
    expect(writes[0]?.arguments['content']).toBe(AUTHORED);
    // step-3 consumed step-2's WRITTEN content, not step-2's tool metadata.
    expect(writes[1]?.arguments['content']).toBe(AUTHORED);
    expect(String(writes[1]?.arguments['content'])).not.toContain('success');
    const readCall = tools.calls.find((call) => call.toolName === 'workspace_read');
    expect(readCall?.arguments['expectedContent']).toBe(AUTHORED);
  });
  it('leaves a self-referencing write literal instead of recursing forever', async () => {
    const ai = new FakeAiPort({ contentFor: () => AUTHORED });
    const tools = new FakeToolPort({
      results: new Map([['workspace_write', { ok: true, denied: false, outcome: 'success' }]]),
    });
    const engine = new AgentExecutionEngine({
      ai,
      tools,
      toolRegistry: makeRegistry(),
      clock: new FakeClock(),
    } satisfies AgentEnginePorts);

    const cyclic = plan('goal-subst-cycle', 'write with a self reference', [
      step(
        'step-1',
        'write a self-referencing payload',
        [
          toolAction('act-write', 'workspace_write', {
            relativePath: 'output/report.md',
            content: '{outputOf:step-1}',
          }),
        ],
        {
          allowedTools: ['workspace_write'],
          capability: 'coding',
          verificationPolicy: rulePolicy([includesRule('write-step-ran', 'success')]),
        },
      ),
    ]);

    const run = makeRun(cyclic);
    await engine.run(run);

    // Terminates: the unresolvable self-reference stays literal, nothing fabricated.
    const writeCall = tools.calls.find((call) => call.toolName === 'workspace_write');
    expect(writeCall?.arguments['content']).toBe('{outputOf:step-1}');
    expect(run.stepResults.find((result) => result.stepId === 'step-1')?.status).toBe('completed');
  });
  it('leaves missing or malformed references literal without fabricating output', async () => {
    const ai = new FakeAiPort({ contentFor: () => AUTHORED });
    const tools = new FakeToolPort({
      results: new Map([['workspace_write', { ok: true, denied: false, outcome: 'success' }]]),
    });
    const engine = new AgentExecutionEngine({
      ai,
      tools,
      toolRegistry: makeRegistry(),
      clock: new FakeClock(),
    } satisfies AgentEnginePorts);

    const malformed = plan('goal-subst-malformed', 'write with bad references', [
      step(
        'step-1',
        'author the report',
        [aiAction('act-author', 'reasoning', 'Author the report')],
        {
          verificationPolicy: rulePolicy([includesRule('authored', AUTHORED)]),
        },
      ),
      step(
        'step-2',
        'write with unresolvable references',
        [
          toolAction('act-write', 'workspace_write', {
            relativePath: 'output/report.md',
            content: 'before {outputOf:no-such-step} middle {outputOf:} after {outputOf:step-9}',
          }),
        ],
        {
          dependencies: ['step-1'],
          allowedTools: ['workspace_write'],
          capability: 'coding',
          verificationPolicy: rulePolicy([includesRule('write-step-ran', 'success')]),
        },
      ),
    ]);

    const run = makeRun(malformed);
    await engine.run(run);

    const writeCall = tools.calls.find((call) => call.toolName === 'workspace_write');
    expect(writeCall?.arguments['content']).toBe(
      'before {outputOf:no-such-step} middle {outputOf:} after {outputOf:step-9}',
    );
  });
  it('passes a read payload containing path-like text through verbatim', async () => {
    const PAYLOAD = 'see output/other.md and success for details';
    const ai = new FakeAiPort({ contentFor: () => AUTHORED });
    const tools = new FakeToolPort({
      results: new Map([
        ['workspace_write', { ok: true, denied: false, outcome: 'success' }],
        ['workspace_read', { ok: true, denied: false, outcome: 'success' }],
      ]),
      data: new Map<string, unknown>([['workspace_read', PAYLOAD]]),
    });
    const engine = new AgentExecutionEngine({
      ai,
      tools,
      toolRegistry: makeRegistry(),
      clock: new FakeClock(),
    } satisfies AgentEnginePorts);

    const passthrough = plan('goal-subst-payload', 'read then rewrite verbatim', [
      step(
        'step-1',
        'read the source file',
        [toolAction('act-read', 'workspace_read', { relativePath: 'input/source.md' })],
        {
          allowedTools: ['workspace_read'],
          capability: 'coding',
          verificationPolicy: rulePolicy([includesRule('read-step-ran', 'success')]),
        },
      ),
      step(
        'step-2',
        'rewrite the payload verbatim',
        [
          toolAction('act-write', 'workspace_write', {
            relativePath: 'output/report.md',
            content: '{outputOf:step-1}',
          }),
        ],
        {
          dependencies: ['step-1'],
          allowedTools: ['workspace_write', 'workspace_read'],
          capability: 'coding',
          verificationPolicy: rulePolicy([includesRule('write-step-ran', 'success')]),
        },
      ),
    ]);

    const run = makeRun(passthrough);
    await engine.run(run);

    // The consumed payload is verbatim (outcome line stripped by the resolver,
    // path-like words inside the payload preserved), while the full trace kept
    // the machine-readable outcome line for rule checks.
    const writeCall = tools.calls.find((call) => call.toolName === 'workspace_write');
    expect(writeCall?.arguments['content']).toBe(PAYLOAD);
    expect(run.stepResults.find((result) => result.stepId === 'step-1')?.output).toContain(
      'success',
    );
  });

  it('writes the FULL authored content when it exceeds the 1 200-char trace summary cap', async () => {
    // The observation summary is a bounded TRACE excerpt (1 200 chars + '…'),
    // so consuming it as {outputOf:step-1} silently wrote a TRUNCATED report.
    // The consumed value must be the full model content.
    const LONG = `REPORT-HEAD ${'x'.repeat(1_500)} REPORT-TAIL`;
    const ai = new FakeAiPort({ contentFor: () => LONG });
    const tools = new FakeToolPort({
      results: new Map([
        ['workspace_write', { ok: true, denied: false, outcome: 'success' }],
        ['workspace_read', { ok: true, denied: false, outcome: 'success' }],
      ]),
      data: new Map<string, unknown>([['workspace_read', LONG]]),
    });
    const engine = new AgentExecutionEngine({
      ai,
      tools,
      toolRegistry: makeRegistry(),
      clock: new FakeClock(),
    } satisfies AgentEnginePorts);

    const longPlan = plan('goal-subst-long', 'author and write a long report', [
      step(
        'step-1',
        'author the report',
        [aiAction('act-author', 'reasoning', 'Author the report')],
        {
          verificationPolicy: rulePolicy([includesRule('authored', 'REPORT-TAIL')]),
        },
      ),
      step(
        'step-2',
        'write the authored report',
        [
          toolAction('act-write', 'workspace_write', {
            relativePath: 'output/report.md',
            content: '{outputOf:step-1}',
          }),
        ],
        {
          dependencies: ['step-1'],
          allowedTools: ['workspace_write', 'workspace_read'],
          capability: 'coding',
          verificationPolicy: {
            kind: 'command',
            description: 'read-back equals the authored content',
            command: {
              toolName: 'workspace_read',
              arguments: {
                relativePath: 'output/report.md',
                expectedContent: '{outputOf:step-1}',
              },
              expect: 'ok',
            },
          },
        },
      ),
    ]);

    const run = makeRun(longPlan);
    await engine.run(run);
    expect(run.state).toBe('COMPLETED');

    const writeCall = tools.calls.find((call) => call.toolName === 'workspace_write');
    expect(writeCall?.arguments['content']).toBe(LONG);
    expect(String(writeCall?.arguments['content']).endsWith('REPORT-TAIL')).toBe(true);
    expect(String(writeCall?.arguments['content'])).not.toContain('…');
    const readCall = tools.calls.find((call) => call.toolName === 'workspace_read');
    expect(readCall?.arguments['expectedContent']).toBe(LONG);
  });
});
