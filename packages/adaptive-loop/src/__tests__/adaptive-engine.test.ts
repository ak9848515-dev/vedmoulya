// ──────────────────────────────────────────────────────────────────
// Adaptive Engine integration + safety tests (PHASE 20/21).
//
// PHASE 21 full execution chain, proven against the REAL planning
// boundary (PlannerService) where possible:
//
//   USER GOAL → GOAL UNDERSTANDING → PLAN GENERATION → VALIDATION →
//   READINESS → EXECUTION → OBSERVATION → MODEL DECISION → VALIDATION →
//   AUTHORIZATION → ACTION → OBSERVATION → VERIFICATION → ACHIEVED
//
// Security-boundary proofs (malicious/invalid model decisions can never
// bypass): capabilities, permissions, ToolRuntime, AIOrchestrationService
// (via ports), governance, verification, budgets.
//
// The model NEVER becomes the security boundary: every executed action
// flows through the frozen AgentAiExecutionPort / AgentToolExecutionPort,
// and every rejected proposal leaves the execution ports untouched.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { PlannerService } from '@vedmoulya/planning';
import type { AgentPlan } from '@vedmoulya/agent-execution';
import {
  buildAdaptiveRun,
  FakeAiPort,
  FakeToolPort,
  makeToolRegistry,
  ScriptedDecisionModel,
  FakePlanner,
  aiStep,
  simplePlan,
  toolStep,
  jsonDecision,
  CONTINUE,
  VERIFY,
  COMPLETE,
  ABSTAIN,
  FAIL,
  REQUEST_APPROVAL,
  REVISE_STEP,
  REPLAN,
  TOOL_CALL,
  AI_ACTION,
  MALFORMED,
} from './fixtures.js';

// Deterministic AI output that satisfies every keyword check of the
// repository-fix template (repository/test/fail/cause/fix/pass/verified).
const REPO_FIX_OUTPUT =
  'repository inspection found failing tests with clear failure signals; root cause diagnosis complete; minimal fix applied; targeted tests pass and broader suite pass; final state verified. repository test fail cause fix pass verified';

describe('PHASE 21 — full chain: goal → plan → READY → adaptive loop → ACHIEVED', () => {
  it('executes a real PlannerService READY plan to ACHIEVED with every step VERIFIED', async () => {
    const planner = new PlannerService();
    const { result, understanding } = await planner.generatePlan({
      goal: 'Analyze this repository and fix the failing tests.',
    });
    expect(understanding.goalId).toBeTruthy();
    expect(result.readiness.status).toBe('READY');
    expect(result.plan).toBeDefined();
    expect(result.plan!.steps.length).toBe(7);

    const plan = result.plan!;
    const ai = new FakeAiPort({ content: REPO_FIX_OUTPUT });
    const { run, engine } = buildAdaptiveRun({ plan, ai });
    const finished = await engine.run(run);

    expect(finished.outcome).toBe('ACHIEVED');
    expect(finished.state).toBe('VERIFIED');
    expect(finished.terminationReason).toBe('GOAL_VERIFIED');
    expect(Object.values(finished.stepStatus).every((s) => s === 'verified')).toBe(true);
    expect(finished.usage.attempts).toBe(7);
    expect(ai.calls.length).toBe(7);
    // Every executed action went through the frozen AI execution port.
    expect(finished.executedActions.every((a) => a.kind === 'AI_ACTION')).toBe(true);
    expect(finished.executedActions.every((a) => a.decisionId === 'declared')).toBe(true);
  });

  it('keeps the model-driven chain honest: decision → validated AI_ACTION → observation → verification → ACHIEVED', async () => {
    const planner = new PlannerService();
    const { result } = await planner.generatePlan({
      goal: 'Analyze this repository and fix the failing tests.',
    });
    expect(result.readiness.status).toBe('READY');
    const plan = result.plan!;

    // The model proposes the FIRST action as an AI_ACTION; the rest of the
    // plan continues deterministically through declared actions.
    const decisionModel = new ScriptedDecisionModel(
      AI_ACTION('reasoning', ['reasoning']),
      CONTINUE(),
      CONTINUE(),
      CONTINUE(),
      CONTINUE(),
      CONTINUE(),
      CONTINUE(),
      CONTINUE(),
      CONTINUE(),
    );
    const ai = new FakeAiPort({ content: REPO_FIX_OUTPUT });
    const { run, engine } = buildAdaptiveRun({ plan, ai, decisionModel });
    const finished = await engine.run(run);

    expect(finished.outcome).toBe('ACHIEVED');
    expect(finished.terminationReason).toBe('GOAL_VERIFIED');
    const modelProposal = finished.executedActions.find((a) => a.decisionId !== 'declared');
    expect(modelProposal).toBeDefined();
    expect(modelProposal!.capability).toBe('reasoning');
    expect(modelProposal!.requiredCapabilities).toEqual(['reasoning']);
    // The model's decision is traceable (PHASE 18).
    const aiDecision = finished.decisionRecords.find((d) => d.decisionKind === 'AI_ACTION');
    expect(aiDecision).toBeDefined();
    expect(aiDecision!.validation).toBe('APPROVED');
    expect(aiDecision!.capability).toBe('reasoning');
    // Provider/model recorded only because the frozen runtime selected them.
    expect(finished.observations.some((o) => o.provider === 'mock' && o.model === 'mock-1')).toBe(
      true,
    );
    expect(finished.usage.costUsd).toBeGreaterThan(0);
  });

  it('executes a declared tool step only through the frozen tool port and verifies artifacts', async () => {
    const plan = simplePlan({
      steps: [toolStep('step-1', { toolName: 'read.file', verification: 'artifact' })],
    });
    const toolRegistry = makeToolRegistry({ 'read.file': { permissionClass: 'READ' } });
    const tools = new FakeToolPort({ permissionClass: 'READ', outcome: 'file contents ok' });
    const { run, engine } = buildAdaptiveRun({
      plan,
      tools,
      toolRegistry,
      allowedTools: ['read.file'],
      grantedPermissionClasses: ['READ'],
    });
    const finished = await engine.run(run);

    expect(finished.outcome).toBe('ACHIEVED');
    expect(finished.state).toBe('VERIFIED');
    expect(tools.calls).toHaveLength(1);
    expect(tools.calls[0].toolName).toBe('read.file');
    expect(finished.executedActions[0].kind).toBe('TOOL_CALL');
    expect(finished.executedActions[0].toolName).toBe('read.file');
  });

  it('records provider/model/tokens/cost and keeps observations bounded and sanitized', async () => {
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });
    const ai = new FakeAiPort({
      content: 'pass — result with token sk-abcdefghijklmnopqrstuvwxyz012345',
    });
    const { run, engine } = buildAdaptiveRun({ plan, ai });
    const finished = await engine.run(run);

    expect(finished.outcome).toBe('ACHIEVED');
    expect(finished.usage.tokensUsed).toBe(15);
    expect(finished.usage.costUsd).toBe(0.00001);
    // Secrets never leak into observations (frozen sanitizer applied).
    const raw = finished.observations.map((o) => o.resultSummary).join('\n');
    expect(raw).not.toContain('sk-abcdefghijklmnopqrstuvwxyz012345');
  });
});

describe('PHASE 21 safety — invalid model decisions cannot bypass the security boundary', () => {
  it('BLOCKS an unknown fabricated tool and never touches the tool port', async () => {
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });
    const toolRegistry = makeToolRegistry({ 'read.file': { permissionClass: 'READ' } });
    const tools = new FakeToolPort({ permissionClass: 'READ' });
    const decisionModel = new ScriptedDecisionModel(TOOL_CALL('fabricated.tool', { cmd: 'rm' }));
    const { run, engine } = buildAdaptiveRun({
      plan,
      tools,
      toolRegistry,
      allowedTools: ['read.file'],
      grantedPermissionClasses: ['READ'],
      decisionModel,
    });
    const finished = await engine.run(run);

    expect(finished.state).toBe('BLOCKED');
    expect(finished.terminationReason).toBe('TOOL_UNAVAILABLE');
    expect(finished.outcome).toBe('BLOCKED');
    expect(tools.calls).toHaveLength(0);
    // The rejected decision is recorded with deterministic reasons.
    const record = finished.decisionRecords.find((d) => d.decisionKind === 'TOOL_CALL');
    expect(record).toBeDefined();
    expect(record!.validation).toBe('BLOCKED');
    expect(record!.rejectionReasons.join(' ')).toContain('TOOL_UNAVAILABLE');
  });

  it('BLOCKS an unauthorized tool (registered but not in the principal allowlist) without executing', async () => {
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });
    const toolRegistry = makeToolRegistry({
      'read.file': { permissionClass: 'READ' },
      'admin.purge': { permissionClass: 'DELETE' },
    });
    const tools = new FakeToolPort({ permissionClass: 'DELETE' });
    const decisionModel = new ScriptedDecisionModel(TOOL_CALL('admin.purge', {}));
    const { run, engine } = buildAdaptiveRun({
      plan,
      tools,
      toolRegistry,
      allowedTools: ['read.file'],
      grantedPermissionClasses: ['READ'],
      decisionModel,
    });
    const finished = await engine.run(run);
    expect(finished.state).toBe('BLOCKED');
    expect(finished.terminationReason).toBe('UNAUTHORIZED_TOOL');
    expect(tools.calls).toHaveLength(0);
  });

  it('BLOCKS a capability escalation (the model cannot upgrade its own authority)', async () => {
    const plan = simplePlan({
      steps: [aiStep('step-1', { capability: 'reasoning', verification: 'includes-pass' })],
    });
    const ai = new FakeAiPort({ content: 'pass' });
    const decisionModel = new ScriptedDecisionModel(AI_ACTION('vision', ['vision']));
    const { run, engine } = buildAdaptiveRun({ plan, ai, decisionModel });
    const finished = await engine.run(run);

    expect(finished.state).toBe('BLOCKED');
    expect(finished.terminationReason).toBe('CAPABILITY_ESCALATION');
    expect(finished.outcome).toBe('BLOCKED');
    expect(ai.calls).toHaveLength(0); // nothing executed — never a bypass
    const record = finished.decisionRecords.find((d) => d.decisionKind === 'AI_ACTION');
    expect(record).toBeDefined();
    expect(record!.rejectionReasons.join(' ')).toContain('CAPABILITY_ESCALATION');
  });

  it('rejects provider directives in model output — the model cannot steer routing', async () => {
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });
    const ai = new FakeAiPort({ content: 'pass' });
    const decisionModel = new ScriptedDecisionModel(
      jsonDecision({ kind: 'AI_ACTION', capability: 'reasoning', provider: 'gemini-2.5' }),
      CONTINUE(),
    );
    const { run, engine } = buildAdaptiveRun({ plan, ai, decisionModel });
    const finished = await engine.run(run);

    // The directive is rejected at parse time; the run then proceeds with
    // the declared plan and still finishes honestly.
    expect(finished.outcome).toBe('ACHIEVED');
    const rejected = finished.decisionRecords.find((d) => d.validation === 'REJECTED');
    expect(rejected).toBeDefined();
    expect(rejected!.rejectionReasons.join(' ')).toContain('provider');
    // Only the frozen AI execution port ran (never a direct provider call).
    expect(ai.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('refuses a model COMPLETE claim without verification evidence', async () => {
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });
    const ai = new FakeAiPort({ content: 'pass' });
    const decisionModel = new ScriptedDecisionModel(COMPLETE());
    const { run, engine } = buildAdaptiveRun({ plan, ai, decisionModel });
    const finished = await engine.run(run);

    // Step-1 never executed → nothing verified → COMPLETE is refused.
    expect(finished.state).toBe('FAILED_FINAL');
    expect(finished.terminationReason).toBe('VERIFICATION_BLOCKED');
    expect(finished.error).toContain('COMPLETE');
  });

  it('honors a FAIL decision and explains why', async () => {
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });
    const ai = new FakeAiPort({ content: 'pass' });
    const decisionModel = new ScriptedDecisionModel(FAIL('the allowed tools cannot finish this'));
    const { run, engine } = buildAdaptiveRun({ plan, ai, decisionModel });
    const finished = await engine.run(run);

    expect(finished.state).toBe('FAILED_FINAL');
    expect(finished.terminationReason).toBe('FAIL_DECISION');
    expect(finished.error).toContain('allowed tools');
    expect(ai.calls).toHaveLength(0);
  });

  it('treats malformed model output as an honest rejection — never an executed action', async () => {
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });
    const ai = new FakeAiPort({ content: 'pass' });
    const decisionModel = new ScriptedDecisionModel(MALFORMED(), MALFORMED(), MALFORMED());
    const { run, engine } = buildAdaptiveRun({ plan, ai, decisionModel });
    const finished = await engine.run(run);

    // Malformed output → ABSTAIN (honest); repeated abstentions bound the loop.
    expect(finished.state).toBe('FAILED_FINAL');
    expect(finished.terminationReason).toBe('ABSTAIN_LIMIT_EXCEEDED');
    expect(ai.calls).toHaveLength(0);
    const rejected = finished.decisionRecords.filter((d) => d.validation === 'REJECTED');
    expect(rejected.length).toBeGreaterThan(0);
    expect(rejected.some((d) => d.rejectionReasons.join(' ').includes('malformed'))).toBe(true);
  });
});

describe('PHASE 15 governance — approvals are explicit; the model cannot approve itself', () => {
  it('pauses a high-risk DELETE tool at CONTROLLED_AUTONOMOUS and resumes only after explicit approval', async () => {
    const plan = simplePlan({
      steps: [toolStep('step-1', { toolName: 'admin.purge', verification: 'artifact' })],
    });
    const toolRegistry = makeToolRegistry({ 'admin.purge': { permissionClass: 'DELETE' } });
    const tools = new FakeToolPort({ permissionClass: 'DELETE', outcome: 'purged' });
    const { run, engine, approvals } = buildAdaptiveRun({
      plan,
      tools,
      toolRegistry,
      autonomyLevel: 'CONTROLLED_AUTONOMOUS',
      allowedTools: ['admin.purge'],
      grantedPermissionClasses: ['DELETE'],
    });

    let finished = await engine.run(run);
    expect(finished.state).toBe('WAITING_FOR_APPROVAL');
    expect(tools.calls).toHaveLength(0); // nothing executes without a human
    const pending = approvals.pending(run.runId);
    expect(pending).toHaveLength(1);
    const proposalId = pending[0].proposalId;

    // No decision yet → resume is refused (no fabricated resume).
    finished = await engine.run(finished);
    expect(finished.state).toBe('WAITING_FOR_APPROVAL');

    // The human approves → the exact paused proposal executes once.
    approvals.approve(run.runId, proposalId, 'human-1');
    finished = await engine.run(finished);
    expect(finished.state).toBe('VERIFIED');
    expect(finished.outcome).toBe('ACHIEVED');
    expect(tools.calls).toHaveLength(1);
    expect(finished.executedActions.find((a) => a.proposalId === proposalId)).toBeDefined();
  });

  it('rejects the paused proposal → APPROVAL_REJECTED honest failure (never executes)', async () => {
    const plan = simplePlan({
      steps: [toolStep('step-1', { toolName: 'admin.purge', verification: 'artifact' })],
    });
    const toolRegistry = makeToolRegistry({ 'admin.purge': { permissionClass: 'DELETE' } });
    const tools = new FakeToolPort({ permissionClass: 'DELETE' });
    const { run, engine, approvals } = buildAdaptiveRun({
      plan,
      tools,
      toolRegistry,
      autonomyLevel: 'CONTROLLED_AUTONOMOUS',
      allowedTools: ['admin.purge'],
      grantedPermissionClasses: ['DELETE'],
    });
    let finished = await engine.run(run);
    expect(finished.state).toBe('WAITING_FOR_APPROVAL');
    const proposalId = approvals.pending(run.runId)[0].proposalId;

    approvals.reject(run.runId, proposalId, 'human-1');
    finished = await engine.run(finished);
    expect(finished.state).toBe('FAILED_FINAL');
    expect(finished.terminationReason).toBe('APPROVAL_REJECTED');
    expect(tools.calls).toHaveLength(0);
  });

  it('gates EVERY tool under ASSISTED autonomy, even a low-risk READ tool', async () => {
    const plan = simplePlan({
      steps: [toolStep('step-1', { toolName: 'read.file', verification: 'artifact' })],
    });
    const toolRegistry = makeToolRegistry({ 'read.file': { permissionClass: 'READ' } });
    const tools = new FakeToolPort({ permissionClass: 'READ', outcome: 'ok' });
    const { run, engine, approvals } = buildAdaptiveRun({
      plan,
      tools,
      toolRegistry,
      autonomyLevel: 'ASSISTED',
      allowedTools: ['read.file'],
      grantedPermissionClasses: ['READ'],
    });
    let finished = await engine.run(run);
    expect(finished.state).toBe('WAITING_FOR_APPROVAL');
    expect(tools.calls).toHaveLength(0);

    approvals.approve(run.runId, approvals.pending(run.runId)[0].proposalId, 'human-1');
    finished = await engine.run(finished);
    expect(finished.state).toBe('VERIFIED');
    expect(tools.calls).toHaveLength(1);
  });

  it('routes a model REQUEST_APPROVAL through the same explicit gate', async () => {
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });
    const ai = new FakeAiPort({ content: 'pass verified' });
    const decisionModel = new ScriptedDecisionModel(REQUEST_APPROVAL());
    const { run, engine, approvals } = buildAdaptiveRun({ plan, ai, decisionModel });
    let finished = await engine.run(run);

    expect(finished.state).toBe('WAITING_FOR_APPROVAL');
    expect(finished.pendingApprovalReason).toContain('human approval');
    expect(ai.calls).toHaveLength(0);

    // Model asks again while waiting → still waiting (the model cannot
    // approve itself, so its own decisions cannot advance the gate).
    finished = await engine.run(finished);
    expect(finished.state).toBe('WAITING_FOR_APPROVAL');

    approvals.approve(run.runId, approvals.pending(run.runId)[0].proposalId, 'human-1');
    finished = await engine.run(finished);
    expect(finished.state).toBe('VERIFIED');
    expect(finished.outcome).toBe('ACHIEVED');
  });
});

describe('PHASE 10/11 bounds — deterministic loop guard, never delegated to the model', () => {
  it('detects a repeated identical action and terminates with LOOP_DETECTED', async () => {
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });
    const ai = new FakeAiPort({ content: 'pass' });
    const decisionModel = new ScriptedDecisionModel(
      AI_ACTION('reasoning'),
      AI_ACTION('reasoning'),
      AI_ACTION('reasoning'),
    );
    const { run, engine } = buildAdaptiveRun({ plan, ai, decisionModel });
    const finished = await engine.run(run);

    expect(finished.state).toBe('FAILED_FINAL');
    expect(finished.terminationReason).toBe('LOOP_DETECTED');
    // The third identical action never executed.
    expect(ai.calls).toHaveLength(2);
  });

  it('stops asking the model once the decision-iteration budget is exhausted', async () => {
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });
    const ai = new FakeAiPort({ content: 'pass' });
    const decisionModel = new ScriptedDecisionModel(
      ABSTAIN(),
      ABSTAIN(),
      ABSTAIN(),
      ABSTAIN(),
      ABSTAIN(),
    );
    const { run, engine } = buildAdaptiveRun({
      plan,
      ai,
      decisionModel,
      loopBudgets: { maxDecisionIterations: 4, maxAbstains: 10 },
    });
    const finished = await engine.run(run);

    expect(finished.terminationReason).toBe('DECISION_LOOP_BUDGET_EXCEEDED');
    expect(finished.state).toBe('FAILED_FINAL');
    expect(finished.usage.decisionIterations).toBe(4); // never asked again
    expect(decisionModel.contexts.length).toBe(4);
    // The final context honestly reported zero remaining decision iterations.
    expect(decisionModel.contexts[3].remainingBudget.decisionIterations).toBe(0);
  });

  it('bounded abstentions end honestly — no fabricated action', async () => {
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });
    const ai = new FakeAiPort({ content: 'pass' });
    const decisionModel = new ScriptedDecisionModel(ABSTAIN(), ABSTAIN(), ABSTAIN(), ABSTAIN());
    const { run, engine } = buildAdaptiveRun({ plan, ai, decisionModel });
    const finished = await engine.run(run);

    expect(finished.terminationReason).toBe('ABSTAIN_LIMIT_EXCEEDED');
    expect(finished.usage.abstains).toBe(3);
    expect(ai.calls).toHaveLength(0);
  });

  it('permission denial is never retried — the run stops at the first denial', async () => {
    const plan = simplePlan({
      steps: [toolStep('step-1', { toolName: 'read.file', verification: 'artifact' })],
    });
    const toolRegistry = makeToolRegistry({ 'read.file': { permissionClass: 'READ' } });
    const tools = new FakeToolPort({ permissionClass: 'READ', denied: true });
    const { run, engine } = buildAdaptiveRun({
      plan,
      tools,
      toolRegistry,
      allowedTools: ['read.file'],
      grantedPermissionClasses: ['READ'],
    });
    const finished = await engine.run(run);

    expect(finished.state).toBe('BLOCKED');
    expect(finished.terminationReason).toBe('PERMISSION_DENIED');
    expect(tools.calls).toHaveLength(1); // exactly one attempt — never retried
    const deniedObs = finished.observations.filter((o) => o.status === 'denied');
    expect(deniedObs.length).toBe(1);
  });

  it('budget exhaustion is never retried and later steps never execute', async () => {
    const plan = simplePlan({
      steps: [
        aiStep('step-1', { verification: 'includes-pass' }),
        aiStep('step-2', { verification: 'includes-pass' }),
      ],
    });
    const ai = new FakeAiPort({ content: 'pass' });
    const { run, engine } = buildAdaptiveRun({ plan, ai, loopBudgets: { maxActions: 1 } });
    const finished = await engine.run(run);

    expect(finished.terminationReason).toBe('ACTION_BUDGET_EXCEEDED');
    expect(finished.state).toBe('FAILED_FINAL');
    expect(ai.calls).toHaveLength(1);
    expect(finished.stepStatus['step-2']).toBe('pending');
  });
});

describe('PHASE 12/14/16 recovery honesty — failures become observations; no fabricated success', () => {
  it('re-recovers a step whose output fails verification, then ACHIEVES with verified evidence', async () => {
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });
    const ai = new FakeAiPort({ contents: ['wrong content without keyword', 'pass now verified'] });
    const { run, engine } = buildAdaptiveRun({ plan, ai });
    const finished = await engine.run(run);

    expect(finished.outcome).toBe('ACHIEVED');
    expect(finished.stepStatus['step-1']).toBe('verified');
    // The failing attempt produced an observation; verification records are kept.
    expect(
      finished.observations.filter((o) => o.stepId === 'step-1').length,
    ).toBeGreaterThanOrEqual(2);
    const finalVerification = finished.verificationResults.find((v) => v.stepId === 'step-1');
    expect(finalVerification!.verdict).toBe('VERIFIED');
  });

  it('a tool failure becomes an observation and recovery is bounded (RECOVERY_EXHAUSTED)', async () => {
    const plan = simplePlan({
      steps: [toolStep('step-1', { toolName: 'read.file', verification: 'artifact' })],
    });
    const toolRegistry = makeToolRegistry({ 'read.file': { permissionClass: 'READ' } });
    const tools = new FakeToolPort({ permissionClass: 'READ', error: 'disk timeout' });
    const { run, engine } = buildAdaptiveRun({
      plan,
      tools,
      toolRegistry,
      allowedTools: ['read.file'],
      grantedPermissionClasses: ['READ'],
      loopBudgets: { maxRetries: 2 },
    });
    const finished = await engine.run(run);

    // Bounded retries exhausted → honest FAILED_FINAL, never fabricated success.
    expect(finished.state).toBe('FAILED_FINAL');
    expect(finished.terminationReason).toBe('RECOVERY_EXHAUSTED');
    expect(finished.observations.some((o) => o.status === 'failed' && o.error !== undefined)).toBe(
      true,
    );
  });

  it('an AI runtime error becomes an honest failed observation without hiding the failure', async () => {
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });
    const ai = new FakeAiPort({ error: 'model unavailable after timeout' });
    const { run, engine } = buildAdaptiveRun({ plan, ai });
    const finished = await engine.run(run);

    expect(finished.state).toBe('FAILED_FINAL');
    expect(finished.terminationReason).toBe('RECOVERY_EXHAUSTED');
    expect(finished.observations.some((o) => o.status === 'failed')).toBe(true);
    expect(finished.observations.some((o) => (o.error ?? '').includes('model unavailable'))).toBe(
      true,
    );
  });
});

describe('PHASE 13/14 bounded replan and revision', () => {
  it('bounds REVISE_STEP and terminates when revisions are exhausted', async () => {
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });
    const ai = new FakeAiPort({ content: 'pass' });
    const decisionModel = new ScriptedDecisionModel(
      REVISE_STEP('approach A'),
      REVISE_STEP('approach B'),
    );
    const { run, engine } = buildAdaptiveRun({
      plan,
      ai,
      decisionModel,
      loopBudgets: { maxRevisions: 1 },
    });
    const finished = await engine.run(run);

    expect(finished.state).toBe('BLOCKED');
    expect(finished.terminationReason).toBe('REVISION_BUDGET_EXCEEDED');
    expect(finished.usage.revisions).toBe(1);
    // REVISE_STEP only rewrote the approach context, never authority fields.
    expect(finished.revisedInstructions['step-1']).toContain('approach A');
  });

  it('bounds REPLAN through the planner port and refuses widening authority', async () => {
    const safeReplanPlan = simplePlan({
      steps: [aiStep('step-1', { verification: 'includes-pass' })],
    });
    const replanPlanner = new FakePlanner({ plan: safeReplanPlan, ready: true });
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });
    const ai = new FakeAiPort({ content: 'pass' });
    const decisionModel = new ScriptedDecisionModel(
      REPLAN('stuck'),
      REPLAN('stuck'),
      REPLAN('stuck'),
    );
    const { run, engine } = buildAdaptiveRun({ plan, ai, decisionModel, planner: replanPlanner });
    const finished = await engine.run(run);

    // Two bounded replans were honored; the third is refused.
    expect(finished.usage.replans).toBe(2);
    expect(finished.state).toBe('BLOCKED');
    expect(finished.terminationReason).toBe('REPLAN_BUDGET_EXCEEDED');
  });

  it('refuses a replan that widens capability authority (CAPABILITY_ESCALATION)', async () => {
    // The fake planner proposes a plan with a NEW capability (coding).
    const wideningPlan = simplePlan({
      steps: [aiStep('step-1', { capability: 'coding', verification: 'includes-pass' })],
    });
    const replanPlanner = new FakePlanner({ plan: wideningPlan, ready: true });
    const plan = simplePlan({
      steps: [aiStep('step-1', { capability: 'reasoning', verification: 'includes-pass' })],
    });
    const ai = new FakeAiPort({ content: 'pass' });
    const decisionModel = new ScriptedDecisionModel(REPLAN('needs more power'));
    const { run, engine } = buildAdaptiveRun({ plan, ai, decisionModel, planner: replanPlanner });
    const finished = await engine.run(run);

    expect(finished.state).toBe('BLOCKED');
    expect(finished.terminationReason).toBe('CAPABILITY_ESCALATION');
    expect(finished.error).toContain('widen');
    expect(finished.usage.replans).toBe(0); // never accepted
  });
});

describe('PHASE 17/18 context bounds and traceability', () => {
  it('never hands the full history to the model — bounded contexts only', async () => {
    const steps: ReturnType<typeof aiStep>[] = [];
    for (let i = 1; i <= 8; i += 1) {
      steps.push(aiStep(`step-${i}`, { verification: 'includes-pass' }));
    }
    const plan = simplePlan({ steps });
    const ai = new FakeAiPort({ content: 'pass' });
    const decisionModel = new ScriptedDecisionModel(
      ...Array.from({ length: 20 }, () => CONTINUE()),
    );
    const { run, engine } = buildAdaptiveRun({ plan, ai, decisionModel });
    const finished = await engine.run(run);

    expect(finished.outcome).toBe('ACHIEVED');
    expect(decisionModel.contexts.length).toBeGreaterThan(0);
    for (const context of decisionModel.contexts) {
      expect(context.recentObservations.length).toBeLessThanOrEqual(13); // 12 + compression marker
      expect(context.goal).toBeTruthy();
      expect(context.remainingBudget).toBeDefined();
    }
  });

  it('records a bounded, sanitized rationale for every decision (PHASE 18)', async () => {
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });
    const ai = new FakeAiPort({ content: 'pass' });
    const decisionModel = new ScriptedDecisionModel(VERIFY(), CONTINUE());
    const { run, engine } = buildAdaptiveRun({ plan, ai, decisionModel });
    const finished = await engine.run(run);

    expect(finished.outcome).toBe('ACHIEVED');
    expect(finished.decisionRecords.length).toBeGreaterThanOrEqual(2);
    const verify = finished.decisionRecords.find((d) => d.decisionKind === 'VERIFY');
    expect(verify).toBeDefined();
    expect(verify!.stepId).toBe('step-1');
    expect(verify!.rationale.length).toBeLessThanOrEqual(400);
    expect(verify!.validation).toBe('APPROVED');
    expect(typeof verify!.attempt).toBe('number');
    expect(verify!.decidedAt).toBeTruthy();
  });
});
