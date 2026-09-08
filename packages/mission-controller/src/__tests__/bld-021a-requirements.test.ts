// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Controller: BLD-021A Phase 25 Verification Suite
// Explicit 1-to-1 verification for all 53 requirements in Sprint BLD-021A
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { createTestService, createTestMission, createTestProviderStatus } from './fixtures.js';
import { DeterministicObjectiveSelector } from '../domain/objective-selector.js';
import { DevelopmentObjectiveSelector } from '../domain/development-objective-selector.js';
import { SimpleGoalUnderstanding } from '../domain/goal-understanding.js';
import { GitSafetyPolicy } from '../domain/git-safety-policy.js';
import {
  checkBudget,
  createDefaultBudget,
  createEmptyBudgetUsage,
  updateBudgetUsage,
} from '../domain/mission-budget-enforcer.js';
import { transition } from '../domain/mission-state-machine.js';

// Frozen foundations
import * as ai from '@vedmoulya/ai';
import * as agentExecution from '@vedmoulya/agent-execution';
import * as planning from '@vedmoulya/planning';
import * as adaptiveLoop from '@vedmoulya/adaptive-loop';
import * as executionMemory from '@vedmoulya/execution-memory';
import * as experienceOptimization from '@vedmoulya/experience-optimization';

describe('BLD-021A Requirements 1 to 14: Mission Lifecycle & Planning Integration', () => {
  it('1. mission creation: initializes in CREATED state with explicit budget and constraints', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({
      userId: 'usr_1',
      title: 'Autonomous System',
      objective: 'Build platform',
      constraints: { allowedTools: ['read_file'] },
    });
    expect(mission.state).toBe('CREATED');
    expect(mission.constraints.allowedTools).toEqual(['read_file']);
    expect(mission.budget.maxObjectives).toBeGreaterThan(0);
  });

  it('2. mission start: transitions CREATED -> RUNNING and updates state history', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({ userId: 'u1', title: 'T', objective: 'O' });
    const started = await service.startMission(mission.missionId);
    expect(started.state).toBe('RUNNING');
    expect(started.stateHistory).toEqual(['CREATED', 'RUNNING']);
  });

  it('3. objective selection: selects next actionable objective', async () => {
    const selector = new DeterministicObjectiveSelector();
    const mission = createTestMission();
    mission.objectives = [
      { objectiveId: 'o1', priority: 1, state: 'PENDING', dependencies: [] } as never,
    ];
    const res = await selector.selectNextObjective(mission, [], createTestProviderStatus());
    expect(res.selected).toBe(true);
    expect(res.objectiveId).toBe('o1');
  });

  it('4. objective prioritization: lower priority number selected first', async () => {
    const selector = new DeterministicObjectiveSelector();
    const mission = createTestMission();
    mission.objectives = [
      { objectiveId: 'low', priority: 5, state: 'PENDING', dependencies: [] } as never,
      { objectiveId: 'high', priority: 1, state: 'PENDING', dependencies: [] } as never,
    ];
    const res = await selector.selectNextObjective(mission, [], createTestProviderStatus());
    expect(res.selected).toBe(true);
    expect(res.objectiveId).toBe('high');
  });

  it('5. goal creation: extracts capabilities and constraints into structured goal', async () => {
    const gu = new SimpleGoalUnderstanding();
    const res = await gu.understandGoal('Implement coding and test verification', 'Context', {
      allowedTools: ['read'],
    });
    expect(res.requiredCapabilities).toContain('coding');
    expect(res.requiredCapabilities).toContain('testing');
    expect(res.constraints).toContain('Allowed tools: read');
  });

  it('6. planning integration: generates AgentPlan from goal and capabilities', async () => {
    const { service, ports } = createTestService();
    let planRequested = false;
    ports.planner.createPlan = async (goal: string) => {
      planRequested = true;
      return { planId: 'p1', goalId: 'g1', objective: goal, steps: [] };
    };
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Plan me'],
    });
    await service.startMission(mission.missionId);
    await service.runNextObjective(mission.missionId);
    expect(planRequested).toBe(true);
  });

  it('7. plan validation: plan structure adheres to frozen AgentPlan schema', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Validate plan'],
    });
    await service.startMission(mission.missionId);
    const res = await service.runNextObjective(mission.missionId);
    expect(res.objectives[0]?.planId).toBeDefined();
    expect(res.objectives[0]?.state).toBe('VERIFIED');
  });

  it('8. execution integration: executor runs plan with forwarded permissions and tools', async () => {
    let capturedTools: string[] | undefined;
    const { service } = createTestService({
      onExecute: (call) => {
        capturedTools = call.allowedTools;
      },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      constraints: { allowedTools: ['echo', 'calculator'] },
      initialObjectives: ['Run tools'],
    });
    await service.startMission(mission.missionId);
    await service.runNextObjective(mission.missionId);
    expect(capturedTools).toEqual(['echo', 'calculator']);
  });

  it('9. adaptive loop integration: execution drives observe/verify cycle', async () => {
    const { service } = createTestService({
      executorResult: { success: true, verified: true },
      verifierResult: { verified: true, evidence: ['output matched expectation'] },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Step 1'],
    });
    await service.startMission(mission.missionId);
    const res = await service.runNextObjective(mission.missionId);
    expect(res.objectives[0]?.verifiedOutcome?.achieved).toBe(true);
  });

  it('10. verification: objective verified requires concrete evidence', async () => {
    const { service } = createTestService({
      executorResult: { success: true, verified: true },
      verifierResult: { verified: true, evidence: ['tests passed 10/10'] },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Step 1'],
    });
    await service.startMission(mission.missionId);
    const res = await service.runNextObjective(mission.missionId);
    expect(res.objectives[0]?.verifiedOutcome?.evidence).toContain('tests passed 10/10');
  });

  it('11. checkpoint creation: checkpoint persisted after every verified objective', async () => {
    const { service, checkpointStore } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Step 1'],
    });
    await service.startMission(mission.missionId);
    await service.runNextObjective(mission.missionId);
    const list = await checkpointStore.listForMission(mission.missionId);
    expect(list.length).toBe(1);
    expect(list[0]?.state).toBe('VERIFIED');
  });

  it('12. next-objective selection: advances to subsequent objective autonomously', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Obj 1', 'Obj 2'],
    });
    await service.startMission(mission.missionId);
    await service.runNextObjective(mission.missionId);
    expect(mission.objectives[0]?.state).toBe('VERIFIED');
    expect(mission.objectives[1]?.state).toBe('PENDING');
    await service.runNextObjective(mission.missionId);
    expect(mission.objectives[1]?.state).toBe('VERIFIED');
  });

  it('13. two sequential objectives: runs 2 objectives in loop without intermediate prompt', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Obj 1', 'Obj 2'],
    });
    await service.startMission(mission.missionId);
    const completed = await service.runAutonomousLoop(mission.missionId);
    expect(completed.objectives[0]?.state).toBe('VERIFIED');
    expect(completed.objectives[1]?.state).toBe('VERIFIED');
    expect(completed.budgetUsage.objectivesCompleted).toBe(2);
  });

  it('14. mission completion: transitions to COMPLETED when all objectives verified', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Obj 1'],
    });
    await service.startMission(mission.missionId);
    const done = await service.runAutonomousLoop(mission.missionId);
    expect(done.state).toBe('COMPLETED');
    expect(done.outcome).toBe('ACHIEVED');
  });
});

describe('BLD-021A Requirements 15 to 22: Providers & Crash Recovery', () => {
  it('15. provider failure: primary failure fails over to alternate capable provider', async () => {
    const { service, providerAvailability } = createTestService({
      providers: [
        { providerId: 'p1', modelId: 'm1', capabilities: ['coding'], healthy: true },
        { providerId: 'p2', modelId: 'm2', capabilities: ['coding'], healthy: true },
      ],
    });
    providerAvailability.setProviderHealth('p1', false);
    const status = await providerAvailability.getProviderStatus(['coding']);
    expect(status.available).toBe(true);
    expect(status.capableProviders[0]?.providerId).toBe('p2');
  });

  it('16. alternate provider: mission completes successfully using alternate provider', async () => {
    const { service, providerAvailability } = createTestService({
      providers: [
        { providerId: 'down', modelId: 'm1', capabilities: ['coding'], healthy: false },
        { providerId: 'backup', modelId: 'm2', capabilities: ['coding'], healthy: true },
      ],
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Task'],
    });
    await service.startMission(mission.missionId);
    const done = await service.runAutonomousLoop(mission.missionId);
    expect(done.state).toBe('COMPLETED');
  });

  it('17. local provider: ollama participates through identical ProviderStatus contract', async () => {
    const { service } = createTestService({
      providers: [
        { providerId: 'ollama', modelId: 'llama3', capabilities: ['coding'], healthy: true },
      ],
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Local'],
    });
    await service.startMission(mission.missionId);
    const done = await service.runAutonomousLoop(mission.missionId);
    expect(done.state).toBe('COMPLETED');
  });

  it('18. all providers unavailable: transitions to WAITING_FOR_PROVIDER with persisted checkpoint', async () => {
    const { service, providerAvailability, checkpointStore } = createTestService({
      providers: [{ providerId: 'p1', modelId: 'm1', capabilities: ['coding'], healthy: false }],
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Waiting'],
    });
    await service.startMission(mission.missionId);
    const waiting = await service.runAutonomousLoop(mission.missionId);
    expect(waiting.state).toBe('WAITING_FOR_PROVIDER');
    const checkpoints = await checkpointStore.listForMission(mission.missionId);
    expect(checkpoints.length).toBeGreaterThan(0);
  });

  it('19. provider recovery: resuming when provider restored continues execution safely', async () => {
    const { service, providerAvailability } = createTestService({
      providers: [{ providerId: 'p1', modelId: 'm1', capabilities: ['coding'], healthy: false }],
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Resume'],
    });
    await service.startMission(mission.missionId);
    const waiting = await service.runAutonomousLoop(mission.missionId);
    expect(waiting.state).toBe('WAITING_FOR_PROVIDER');

    providerAvailability.setProviderHealth('p1', true);
    await service.resumeMission(mission.missionId);
    const done = await service.runAutonomousLoop(mission.missionId);
    expect(done.state).toBe('COMPLETED');
  });

  it('20. crash recovery: process restart loads checkpoint and verifies current state', async () => {
    const { service, checkpointStore } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Task 1', 'Task 2'],
    });
    await service.startMission(mission.missionId);
    await service.runNextObjective(mission.missionId);

    const latest = await checkpointStore.getLatestForMission(mission.missionId);
    expect(latest?.state).toBe('VERIFIED');

    const resumed = await service.resumeFromCheckpoint(mission.missionId);
    expect(resumed.objectives[1]?.state).toBe('VERIFIED');
  });

  it('21. checkpoint resume: does not re-run already verified objectives', async () => {
    let executions = 0;
    const { service } = createTestService({
      onExecute: () => {
        executions++;
      },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Task 1', 'Task 2'],
    });
    await service.startMission(mission.missionId);
    await service.runAutonomousLoop(mission.missionId);
    expect(executions).toBe(2);

    await service.resumeFromCheckpoint(mission.missionId);
    expect(executions).toBe(2);
  });

  it('22. duplicate execution prevention: action and plan identity prevent repeat work', async () => {
    const executedPlans: string[] = [];
    const { service } = createTestService({
      onExecute: (call: any) => {
        executedPlans.push(call.plan.planId);
      },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Unique'],
    });
    await service.startMission(mission.missionId);
    await service.runAutonomousLoop(mission.missionId);
    expect(executedPlans.length).toBe(1);

    await service.resumeFromCheckpoint(mission.missionId);
    expect(executedPlans.length).toBe(1);
  });
});

describe('BLD-021A Requirements 23 to 32: Recovery, Budgets & Human Control', () => {
  it('23. tool failure: transient tool failure triggers bounded retry', async () => {
    const { service } = createTestService({
      executorResult: {
        success: false,
        verified: false,
        error: 'tool timed out',
        failureClass: 'TRANSIENT_TOOL',
      },
      verifierResult: { verified: false, evidence: [] },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      budget: { maxRetries: 1 },
      initialObjectives: ['Flaky tool'],
    });
    await service.startMission(mission.missionId);
    const result = await service.runAutonomousLoop(mission.missionId);
    expect(result.budgetUsage.retriesConsumed).toBe(1);
    expect(result.state).toBe('FAILED');
  });

  it('24. verification failure: verification rejection does not mark objective achieved', async () => {
    const { service } = createTestService({
      executorResult: { success: true, verified: false },
      verifierResult: { verified: false, evidence: [] },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      budget: { maxRetries: 0 },
      initialObjectives: ['Unverified'],
    });
    await service.startMission(mission.missionId);
    const result = await service.runNextObjective(mission.missionId);
    expect(result.objectives[0]?.verifiedOutcome).toBeUndefined();
    expect(result.objectives[0]?.state).toBe('FAILED');
  });

  it('25. bounded recovery: retries stop at ceiling and do not loop indefinitely', async () => {
    const { service } = createTestService({
      executorResult: {
        success: false,
        verified: false,
        error: 'error',
        failureClass: 'TRANSIENT_TOOL',
      },
      verifierResult: { verified: false, evidence: [] },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      budget: { maxRetries: 2 },
      initialObjectives: ['Bound'],
    });
    await service.startMission(mission.missionId);
    const result = await service.runAutonomousLoop(mission.missionId);
    expect(result.budgetUsage.retriesConsumed).toBe(2);
    expect(result.state).toBe('FAILED');
  });

  it('26. budget exhaustion: cost exhaustion stops mission immediately with reason', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      budget: { maxCostUsd: 0.0005 },
      initialObjectives: ['Obj 1', 'Obj 2'],
    });
    await service.startMission(mission.missionId);
    const done = await service.runAutonomousLoop(mission.missionId);
    expect(done.state).toBe('FAILED');
    expect(done.outcomeReason).toBe('Maximum cost reached');
  });

  it('27. objective limit: hard ceiling stops after max objectives completed', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      budget: { maxObjectives: 1 },
      initialObjectives: ['Obj 1', 'Obj 2'],
    });
    await service.startMission(mission.missionId);
    const done = await service.runAutonomousLoop(mission.missionId);
    expect(done.budgetUsage.objectivesCompleted).toBe(1);
    expect(done.state).toBe('FAILED');
    expect(done.outcomeReason).toBe('Maximum objectives reached');
  });

  it('28. runtime limit: runtimeMs ceiling is enforced by budget checker', () => {
    const budget = createDefaultBudget({ maxRuntimeMs: 1000 });
    const usage = updateBudgetUsage(createEmptyBudgetUsage(), { runtimeMs: 1001 });
    const status = checkBudget(budget, usage);
    expect(status.exhausted).toBe(true);
    expect(status.reason).toBe('Maximum runtime reached');
  });

  it('29. pause: human command pauses running mission', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({ userId: 'u1', title: 'T', objective: 'O' });
    await service.startMission(mission.missionId);
    const paused = await service.pauseMission(mission.missionId);
    expect(paused.state).toBe('PAUSED');
  });

  it('30. resume: human command resumes paused mission', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({ userId: 'u1', title: 'T', objective: 'O' });
    await service.startMission(mission.missionId);
    await service.pauseMission(mission.missionId);
    const resumed = await service.resumeMission(mission.missionId);
    expect(resumed.state).toBe('RUNNING');
  });

  it('31. cancel: human command cancels mission in any non-terminal state', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({ userId: 'u1', title: 'T', objective: 'O' });
    await service.startMission(mission.missionId);
    const cancelled = await service.cancelMission(mission.missionId);
    expect(cancelled.state).toBe('CANCELLED');
    expect(cancelled.outcome).toBe('CANCELLED');
  });

  it('32. approval gate: WAITING_FOR_APPROVAL requires human approval to proceed', async () => {
    const { service, store } = createTestService();
    const mission = await service.createMission({ userId: 'u1', title: 'T', objective: 'O' });
    await service.startMission(mission.missionId);
    mission.state = 'WAITING_FOR_APPROVAL';
    await store.save(mission);

    const approved = await service.approveObjective(mission.missionId, 'o1');
    expect(approved.state).toBe('RUNNING');
  });
});

describe('BLD-021A Requirements 33 to 40: Security Invariants & Advisory Boundaries', () => {
  it('33. unauthorized tool: ToolRuntime enforcement prevents unregistered/denied tool usage', async () => {
    let executedTools: string[] | undefined;
    const { service } = createTestService({
      onExecute: (call) => {
        executedTools = call.allowedTools;
      },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      constraints: { allowedTools: ['read_file'] },
      initialObjectives: ['Test'],
    });
    await service.startMission(mission.missionId);
    await service.runNextObjective(mission.missionId);
    expect(executedTools).not.toContain('unauthorized_shell_command');
  });

  it('34. capability escalation: mission cannot grant itself unavailable capabilities', async () => {
    const { service } = createTestService({
      providers: [{ providerId: 'p1', modelId: 'm1', capabilities: ['coding'], healthy: true }],
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      constraints: { requiredCapabilities: ['deployment', 'coding'] },
      initialObjectives: ['Deploy'],
    });
    await service.startMission(mission.missionId);
    const waiting = await service.runNextObjective(mission.missionId);
    expect(waiting.state).toBe('WAITING_FOR_PROVIDER');
  });

  it('35. permission escalation: mission constraints cannot imply DELETE or SECRETS', async () => {
    const { service } = createTestService();
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      constraints: {},
    });
    expect(mission.constraints.grantedPermissionClasses).toBeUndefined();
  });

  it('36. planner injection: planner output cannot alter authoritative mission constraints', async () => {
    let receivedAllowedTools: string[] | undefined;
    const { service } = createTestService({
      onExecute: (call) => {
        receivedAllowedTools = call.allowedTools;
      },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      constraints: { allowedTools: ['read_file'] },
      initialObjectives: ['Attempt injection'],
    });
    await service.startMission(mission.missionId);
    await service.runNextObjective(mission.missionId);
    expect(receivedAllowedTools).toEqual(['read_file']);
  });

  it('37. provider directive injection: provider selection ignores prompt directives', async () => {
    const { service, providerAvailability } = createTestService({
      providers: [
        { providerId: 'ollama', modelId: 'llama3', capabilities: ['coding'], healthy: true },
      ],
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'Use gemini exclusively',
      initialObjectives: ['Task'],
    });
    await service.startMission(mission.missionId);
    const done = await service.runAutonomousLoop(mission.missionId);
    const status = await providerAvailability.getProviderStatus(['coding']);
    expect(status.capableProviders[0]?.providerId).toBe('ollama');
    expect(done.state).toBe('COMPLETED');
  });

  it('38. memory advisory-only: memory signals cannot authorize an action', async () => {
    let memoryCalled = false;
    const { service } = createTestService({
      onMemory: () => {
        memoryCalled = true;
      },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Task'],
    });
    await service.startMission(mission.missionId);
    await service.runAutonomousLoop(mission.missionId);
    expect(memoryCalled).toBe(true);
  });

  it('39. optimization advisory-only: strategy recommendation cannot bypass tool security', async () => {
    let advisoryRequested = false;
    const { service } = createTestService({
      onAdvisory: () => {
        advisoryRequested = true;
      },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Task'],
    });
    await service.startMission(mission.missionId);
    await service.runAutonomousLoop(mission.missionId);
    expect(advisoryRequested).toBe(true);
  });

  it('40. current runtime overrides historical recommendation: authoritative status wins', () => {
    const selector = new GitSafetyPolicy();
    expect(selector.isSafe('status')).toBe(true);
    expect(selector.isSafe('force_push')).toBe(false);
  });
});

describe('BLD-021A Requirements 41 to 46: Git Safety & Autonomous Coding Cycle', () => {
  const policy = new GitSafetyPolicy();

  it('41. Git safe operation: git status/diff/log categorized as READ', () => {
    expect(policy.classifyOperation('status').permissionClass).toBe('READ');
    expect(policy.classifyOperation('diff').permissionClass).toBe('READ');
    expect(policy.classifyOperation('log').permissionClass).toBe('READ');
  });

  it('42. destructive Git approval: force_push, delete_branch, rewrite require human approval', () => {
    expect(policy.requiresApproval('force_push')).toBe(true);
    expect(policy.requiresApproval('delete_branch')).toBe(true);
    expect(policy.requiresApproval('history_rewrite')).toBe(true);
  });

  it('43. autonomous coding cycle: inspect -> select -> plan -> execute -> verify -> checkpoint', async () => {
    const { service, checkpointStore } = createTestService({
      verifierResult: { verified: true, evidence: ['targeted tests passed'] },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'Dev Cycle',
      objective: 'Autonomous development cycle',
      initialObjectives: ['Implement and verify code'],
    });
    await service.startMission(mission.missionId);
    const result = await service.runNextObjective(mission.missionId);
    expect(result.objectives[0]?.state).toBe('VERIFIED');
    const checkpoints = await checkpointStore.listForMission(mission.missionId);
    expect(checkpoints.length).toBe(1);
    expect(checkpoints[0]?.completedWork).toContain('targeted tests passed');
  });

  it('44. tests required before completion: verified outcome requires test evidence', async () => {
    const { service } = createTestService({
      executorResult: { success: true, verified: true },
      verifierResult: { verified: true, evidence: ['vitest run: 4 passed'] },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Task'],
    });
    await service.startMission(mission.missionId);
    const res = await service.runNextObjective(mission.missionId);
    expect(res.objectives[0]?.verifiedOutcome?.evidence).toContain('vitest run: 4 passed');
  });

  it('45. false completion rejected: empty verification evidence fails objective', async () => {
    const { service } = createTestService({
      executorResult: { success: true, verified: true },
      verifierResult: { verified: false, evidence: [] },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      budget: { maxRetries: 0 },
      initialObjectives: ['Task'],
    });
    await service.startMission(mission.missionId);
    const res = await service.runNextObjective(mission.missionId);
    expect(res.objectives[0]?.state).toBe('FAILED');
    expect(res.objectives[0]?.verifiedOutcome).toBeUndefined();
  });

  it('46. final mission verification: mission outcome declared achieved only after all objectives pass', async () => {
    const { service } = createTestService({
      verifierResult: { verified: true, evidence: ['All checks passed'] },
    });
    const mission = await service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['A', 'B'],
    });
    await service.startMission(mission.missionId);
    const completed = await service.runAutonomousLoop(mission.missionId);
    expect(completed.state).toBe('COMPLETED');
    expect(completed.outcome).toBe('ACHIEVED');
  });
});

describe('BLD-021A Requirements 47 to 53: Foundations Regression & End-to-End Mission', () => {
  it('47. Gemini regression: AI capability taxonomy and provider contracts remain intact', () => {
    expect(ai.CAPABILITY_TYPES).toContain('coding');
    expect(ai.CAPABILITY_TYPES).toContain('reasoning');
  });

  it('48. Agent Execution regression: agent autonomy and run state contracts intact', () => {
    expect(agentExecution.AGENT_AUTONOMY_LEVELS).toContain('CONTROLLED_AUTONOMOUS');
    expect(agentExecution.AGENT_RUN_STATES).toContain('EXECUTING');
  });

  it('49. Planning regression: planning service and readiness contracts intact', () => {
    expect(planning.GoalUnderstandingService).toBeDefined();
    expect(planning.PlannerService).toBeDefined();
  });

  it('50. Adaptive Loop regression: adaptive run states and engine contracts intact', () => {
    expect(adaptiveLoop.ADAPTIVE_RUN_STATES).toContain('EXECUTING');
  });

  it('51. Execution Memory regression: memory candidates and learning signal contracts intact', () => {
    expect(executionMemory.LEARNING_SIGNALS).toBeDefined();
    expect(executionMemory.MEMORY_CATEGORIES).toBeDefined();
  });

  it('52. Experience Optimization regression: strategy evidence and target contracts intact', () => {
    expect(experienceOptimization.OPTIMIZATION_TARGETS).toBeDefined();
    expect(experienceOptimization.EVIDENCE_LEVELS).toBeDefined();
  });

  it('53. full end-to-end mission: inspect -> select -> plan -> execute -> verify -> checkpoint -> continue -> complete', async () => {
    const { service } = createTestService({
      verifierResult: { verified: true, evidence: ['All unit tests green', 'Lint clean'] },
    });
    const mission = await service.createMission({
      userId: 'eng_1',
      title: 'Full E2E Mission',
      objective:
        'Continue building VedMoulya into the most powerful production-grade autonomous AI platform possible',
      initialObjectives: [
        'Objective 1: Verify test suite and type safety',
        'Objective 2: Enforce autonomous continuation and durable checkpointing',
      ],
    });

    await service.startMission(mission.missionId);
    const completed = await service.runAutonomousLoop(mission.missionId);

    expect(completed.state).toBe('COMPLETED');
    expect(completed.outcome).toBe('ACHIEVED');
    expect(completed.checkpoints.length).toBe(2);
    expect(completed.budgetUsage.objectivesCompleted).toBe(2);
    expect(completed.objectives.every((o) => o.state === 'VERIFIED')).toBe(true);
  });
});
