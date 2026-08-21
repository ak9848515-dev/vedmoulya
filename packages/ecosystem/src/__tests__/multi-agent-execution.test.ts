// ──────────────────────────────────────────────────────────────────
// VedMoulya — Multi-Agent Orchestration Tests (SPRINT-053)
//
// Tests multi-agent workflow execution:
// 1. Multi-agent workflow definition
// 2. Sequential agent execution
// 3. Agent handoffs
// 4. Agent capability validation
// 5. Agent failure propagation
// 6. Bounded agent retry
// 7. Approval gate in multi-agent context
// 8. Owner scoping / IDOR
// 9. Evidence recording
// 10. No false memory on failure
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../domain/entities/Agent.js';
import { Workflow } from '../domain/entities/Workflow.js';
import { AgentRegistry } from '../domain/registries/AgentRegistry.js';
import { WorkflowRegistry } from '../domain/registries/WorkflowRegistry.js';
import { WorkflowExecutionService } from '../application/WorkflowExecutionService.js';
import { InMemoryWorkflowExecutionStore } from '../infrastructure/InMemoryWorkflowExecutionStore.js';
import type { WorkflowStep } from '../types/ecosystem-types.js';
import type {
  ClockPort,
  StepExecutorPort,
  StepVerifierPort,
  EvidencePort,
} from '../application/WorkflowExecutionService.js';

// ── Test Helpers ───────────────────────────────────────────────────

function createMockClock(): ClockPort {
  let time = 1000000;
  return {
    now: () => new Date(time).toISOString(),
    timestampMs: () => {
      time += 100;
      return time;
    },
  };
}

function createMockStepExecutor(
  results: Array<{
    ok: boolean;
    content?: string;
    error?: string;
    provider?: string;
    model?: string;
  }> = [],
): StepExecutorPort & { calls: Array<{ stepId: string; instruction: string; userId: string }> } {
  const calls: Array<{ stepId: string; instruction: string; userId: string }> = [];
  const callCount = { value: 0 };
  return {
    calls,
    execute: async (params) => {
      calls.push({ stepId: params.stepId, instruction: params.instruction, userId: params.userId });
      const idx = callCount.value;
      callCount.value++;
      const result = results[idx % results.length] ?? { ok: true, content: 'Mock output' };
      return {
        ...result,
        tokens: { input: 100, output: 200, total: 300 },
        costUsd: 0.001,
        latencyMs: 50,
      };
    },
  };
}

function createMockVerifier(
  passAll = true,
): StepVerifierPort & { calls: Array<{ stepId: string; output: string }> } {
  const calls: Array<{ stepId: string; output: string }> = [];
  return {
    calls,
    verify: async (params) => {
      calls.push({ stepId: params.stepId, output: params.output });
      return {
        passed: passAll,
        checks: params.verificationRequirements.map((req) => ({
          name: req,
          passed: passAll,
          detail: passAll ? 'OK' : `Failed: ${req}`,
        })),
      };
    },
  };
}

function createMockEvidence(): EvidencePort & {
  calls: Array<{ executionId: string; status: string; ownerId: string }>;
} {
  const calls: Array<{ executionId: string; status: string; ownerId: string }> = [];
  return {
    calls,
    record: (params) => {
      calls.push({
        executionId: params.executionId,
        status: params.status,
        ownerId: params.ownerId,
      });
    },
  };
}

function createStep(overrides: Partial<WorkflowStep> = {}): WorkflowStep {
  return {
    id: `step-${String(Math.random()).slice(2, 8)}`,
    title: 'Test Step',
    purpose: 'Do something useful',
    requiredCapabilities: ['TEXT_GENERATION'],
    agentIds: ['agent-a'],
    allowedTools: [],
    riskLevel: 'LOW',
    approvalPolicy: 'AUTO',
    automationLevel: 'FULLY_AUTOMATED',
    dependencies: [],
    verificationRequirements: [],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('Multi-Agent Orchestration (SPRINT-053)', () => {
  let agentRegistry: AgentRegistry;
  let workflowRegistry: WorkflowRegistry;
  let store: InMemoryWorkflowExecutionStore;
  let clock: ClockPort;
  let evidence: ReturnType<typeof createMockEvidence>;

  beforeEach(() => {
    agentRegistry = new AgentRegistry();
    workflowRegistry = new WorkflowRegistry();
    store = new InMemoryWorkflowExecutionStore();
    clock = createMockClock();
    evidence = createMockEvidence();

    // Register multiple specialized agents
    agentRegistry.register(
      Agent.create({
        id: 'agent-a',
        name: 'Agent A (Research)',
        purpose: 'Gathers information',
        requiredCapabilities: ['reasoning'],
        owner: 'system',
      }),
    );

    agentRegistry.register(
      Agent.create({
        id: 'agent-b',
        name: 'Agent B (Analysis)',
        purpose: 'Analyzes findings',
        requiredCapabilities: ['reasoning'],
        owner: 'system',
      }),
    );

    agentRegistry.register(
      Agent.create({
        id: 'agent-c',
        name: 'Agent C (Summary)',
        purpose: 'Produces summaries',
        requiredCapabilities: ['content_generation'],
        owner: 'system',
      }),
    );
  });

  describe('1. multi-agent workflow definition', () => {
    it('defines a workflow with multiple agents', () => {
      const step1 = createStep({ id: 's1', agentIds: ['agent-a'] });
      const step2 = createStep({ id: 's2', agentIds: ['agent-b'] });
      const step3 = createStep({ id: 's3', agentIds: ['agent-c'] });

      const workflow = Workflow.create({
        id: 'multi-agent-wf',
        name: 'Multi-Agent Workflow',
        outcome: 'Test multi-agent',
        steps: [step1, step2, step3],
        owner: 'system',
      });

      const def = workflow.toDefinition();
      expect(def.steps).toHaveLength(3);
      expect(def.steps[0]?.agentIds).toEqual(['agent-a']);
      expect(def.steps[1]?.agentIds).toEqual(['agent-b']);
      expect(def.steps[2]?.agentIds).toEqual(['agent-c']);
    });
  });

  describe('2. sequential agent execution', () => {
    it('executes steps with different agents in sequence', async () => {
      const step1 = createStep({
        id: 's1',
        agentIds: ['agent-a'],
        requiredCapabilities: ['reasoning'],
      });
      const step2 = createStep({
        id: 's2',
        agentIds: ['agent-b'],
        requiredCapabilities: ['reasoning'],
      });
      const step3 = createStep({
        id: 's3',
        agentIds: ['agent-c'],
        requiredCapabilities: ['content_generation'],
      });

      const workflow = Workflow.create({
        id: 'multi-agent-wf',
        name: 'Multi-Agent Workflow',
        outcome: 'Test multi-agent',
        steps: [step1, step2, step3],
        owner: 'system',
      });
      workflowRegistry.register(workflow);

      const executor = createMockStepExecutor([
        { ok: true, content: 'Research findings' },
        { ok: true, content: 'Analysis results' },
        { ok: true, content: 'Final summary' },
      ]);
      const verifier = createMockVerifier();

      const service = new WorkflowExecutionService({
        agentRegistry,
        workflowRegistry,
        executionStore: store,
        stepExecutor: executor,
        stepVerifier: verifier,
        evidencePort: evidence,
        clock,
      });

      const result = await service.start({ workflowId: 'multi-agent-wf', ownerId: 'user-1' });
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('COMPLETED');
      expect(executor.calls).toHaveLength(3);
      expect(executor.calls[0]?.stepId).toBe('s1');
      expect(executor.calls[1]?.stepId).toBe('s2');
      expect(executor.calls[2]?.stepId).toBe('s3');
    });
  });

  describe('3. agent handoffs', () => {
    it('passes step output to next step input', async () => {
      const step1 = createStep({
        id: 's1',
        agentIds: ['agent-a'],
        requiredCapabilities: ['reasoning'],
        purpose: 'Research the topic',
      });
      const step2 = createStep({
        id: 's2',
        agentIds: ['agent-b'],
        requiredCapabilities: ['reasoning'],
        purpose: 'Analyze findings',
      });

      const workflow = Workflow.create({
        id: 'handoff-wf',
        name: 'Handoff Workflow',
        outcome: 'Test handoffs',
        steps: [step1, step2],
        owner: 'system',
      });
      workflowRegistry.register(workflow);

      const executor = createMockStepExecutor([
        { ok: true, content: 'Key finding: AI is transformative' },
        { ok: true, content: 'Analysis shows 3 major areas' },
      ]);
      const verifier = createMockVerifier();

      const service = new WorkflowExecutionService({
        agentRegistry,
        workflowRegistry,
        executionStore: store,
        stepExecutor: executor,
        stepVerifier: verifier,
        evidencePort: evidence,
        clock,
      });

      const result = await service.start({ workflowId: 'handoff-wf', ownerId: 'user-1' });
      expect(result.success).toBe(true);

      // Step 2 should receive step 1's output in its instruction
      expect(executor.calls[1]?.instruction).toContain('Key finding: AI is transformative');
    });
  });

  describe('4. agent capability validation', () => {
    it('validates agent capabilities match step requirements', async () => {
      const step = createStep({
        agentIds: ['agent-c'],
        requiredCapabilities: ['content_generation'],
      });

      const workflow = Workflow.create({
        id: 'cap-wf',
        name: 'Capability Workflow',
        outcome: 'Test capabilities',
        steps: [step],
        owner: 'system',
      });
      workflowRegistry.register(workflow);

      const executor = createMockStepExecutor([{ ok: true, content: 'Result' }]);
      const verifier = createMockVerifier();

      const service = new WorkflowExecutionService({
        agentRegistry,
        workflowRegistry,
        executionStore: store,
        stepExecutor: executor,
        stepVerifier: verifier,
        evidencePort: evidence,
        clock,
      });

      const result = await service.start({ workflowId: 'cap-wf', ownerId: 'user-1' });
      expect(result.success).toBe(true);
    });

    it('rejects when agent missing required capability', async () => {
      const step = createStep({
        agentIds: ['agent-a'],
        requiredCapabilities: ['content_generation'], // agent-a only has 'reasoning'
      });

      const workflow = Workflow.create({
        id: 'cap-fail-wf',
        name: 'Capability Fail Workflow',
        outcome: 'Test capability failure',
        steps: [step],
        owner: 'system',
      });
      workflowRegistry.register(workflow);

      const executor = createMockStepExecutor();
      const verifier = createMockVerifier();

      const service = new WorkflowExecutionService({
        agentRegistry,
        workflowRegistry,
        executionStore: store,
        stepExecutor: executor,
        stepVerifier: verifier,
        evidencePort: evidence,
        clock,
      });

      const result = await service.start({ workflowId: 'cap-fail-wf', ownerId: 'user-1' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('missing required capabilities');
    });
  });

  describe('5. agent failure propagation', () => {
    it('stops workflow when an agent fails', async () => {
      const step1 = createStep({
        id: 's1',
        agentIds: ['agent-a'],
        requiredCapabilities: ['reasoning'],
      });
      const step2 = createStep({
        id: 's2',
        agentIds: ['agent-b'],
        requiredCapabilities: ['reasoning'],
      });

      const workflow = Workflow.create({
        id: 'fail-wf',
        name: 'Failure Workflow',
        outcome: 'Test failure',
        steps: [step1, step2],
        owner: 'system',
      });
      workflowRegistry.register(workflow);

      // Agent A succeeds, Agent B fails
      const executor = createMockStepExecutor([
        { ok: true, content: 'Research done' },
        { ok: false, error: 'Analysis agent crashed' },
      ]);
      const verifier = createMockVerifier();

      const service = new WorkflowExecutionService({
        agentRegistry,
        workflowRegistry,
        executionStore: store,
        stepExecutor: executor,
        stepVerifier: verifier,
        evidencePort: evidence,
        clock,
      });

      const result = await service.start({ workflowId: 'fail-wf', ownerId: 'user-1' });
      expect(result.data?.status).toBe('FAILED');
      expect(result.data?.stepResults[0]?.status).toBe('completed');
      expect(result.data?.stepResults[1]?.status).toBe('failed');
      expect(result.data?.error).toContain('Analysis agent crashed');
    });

    it('does not fabricate output for failed agents', async () => {
      const step = createStep({ agentIds: ['agent-a'], requiredCapabilities: ['reasoning'] });

      const workflow = Workflow.create({
        id: 'no-fabricate-wf',
        name: 'No Fabricate Workflow',
        outcome: 'Test no fabrication',
        steps: [step],
        owner: 'system',
      });
      workflowRegistry.register(workflow);

      const executor = createMockStepExecutor([{ ok: false, error: 'Agent failed' }]);
      const verifier = createMockVerifier();

      const service = new WorkflowExecutionService({
        agentRegistry,
        workflowRegistry,
        executionStore: store,
        stepExecutor: executor,
        stepVerifier: verifier,
        evidencePort: evidence,
        clock,
      });

      await service.start({ workflowId: 'no-fabricate-wf', ownerId: 'user-1' });
      expect(evidence.calls.every((c) => c.status === 'failure')).toBe(true);
    });
  });

  describe('6. bounded agent retry', () => {
    it('retries failed agent within bounds', async () => {
      const step = createStep({ agentIds: ['agent-a'], requiredCapabilities: ['reasoning'] });

      const workflow = Workflow.create({
        id: 'retry-wf',
        name: 'Retry Workflow',
        outcome: 'Test retry',
        steps: [step],
        owner: 'system',
      });
      workflowRegistry.register(workflow);

      // First attempt fails, second succeeds
      const executor = createMockStepExecutor([
        { ok: false, error: 'Temporary failure' },
        { ok: true, content: 'Success after retry' },
      ]);
      const verifier = createMockVerifier();

      const service = new WorkflowExecutionService({
        agentRegistry,
        workflowRegistry,
        executionStore: store,
        stepExecutor: executor,
        stepVerifier: verifier,
        evidencePort: evidence,
        clock,
        maxRetries: 2,
      });

      const result = await service.start({ workflowId: 'retry-wf', ownerId: 'user-1' });
      expect(result.data?.status).toBe('COMPLETED');
      expect(result.data?.stepResults[0]?.attempts).toBe(2);
    });

    it('fails after max retries exhausted', async () => {
      const step = createStep({ agentIds: ['agent-a'], requiredCapabilities: ['reasoning'] });

      const workflow = Workflow.create({
        id: 'max-retry-wf',
        name: 'Max Retry Workflow',
        outcome: 'Test max retry',
        steps: [step],
        owner: 'system',
      });
      workflowRegistry.register(workflow);

      const executor = createMockStepExecutor([
        { ok: false, error: 'Fail 1' },
        { ok: false, error: 'Fail 2' },
      ]);
      const verifier = createMockVerifier();

      const service = new WorkflowExecutionService({
        agentRegistry,
        workflowRegistry,
        executionStore: store,
        stepExecutor: executor,
        stepVerifier: verifier,
        evidencePort: evidence,
        clock,
        maxRetries: 2,
      });

      const result = await service.start({ workflowId: 'max-retry-wf', ownerId: 'user-1' });
      expect(result.data?.status).toBe('FAILED');
      expect(result.data?.stepResults[0]?.attempts).toBe(2);
    });
  });

  describe('7. approval gate in multi-agent context', () => {
    it('pauses at approval gate between agents', async () => {
      const step1 = createStep({
        id: 's1',
        agentIds: ['agent-a'],
        requiredCapabilities: ['reasoning'],
      });
      const approvalStep = createStep({
        id: 's-approval',
        title: 'Review Agent Results',
        agentIds: [],
        requiredCapabilities: [],
        approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
        riskLevel: 'MEDIUM',
      });
      const step3 = createStep({
        id: 's3',
        agentIds: ['agent-c'],
        requiredCapabilities: ['content_generation'],
      });

      const workflow = Workflow.create({
        id: 'approval-wf',
        name: 'Approval Workflow',
        outcome: 'Test approval',
        steps: [step1, approvalStep, step3],
        owner: 'system',
      });
      workflowRegistry.register(workflow);

      const executor = createMockStepExecutor([{ ok: true, content: 'Result' }]);
      const verifier = createMockVerifier();

      const service = new WorkflowExecutionService({
        agentRegistry,
        workflowRegistry,
        executionStore: store,
        stepExecutor: executor,
        stepVerifier: verifier,
        evidencePort: evidence,
        clock,
      });

      const startResult = await service.start({ workflowId: 'approval-wf', ownerId: 'user-1' });
      // Step 1 (agent-a) should complete, step 2 (approval) should pause
      expect(startResult.data?.status).toBe('WAITING_FOR_APPROVAL');
      expect(startResult.data?.stepResults[0]?.status).toBe('completed');
      expect(startResult.data?.approvalState?.stepId).toBe('s-approval');

      // Approve and continue to step 3
      const approveResult = await service.approve(
        startResult.data!.executionId,
        'user-1',
        's-approval',
      );
      expect(approveResult.data?.status).toBe('COMPLETED');
      expect(approveResult.data?.stepResults[2]?.status).toBe('completed');
    });
  });

  describe('8. owner scoping / IDOR', () => {
    it('prevents cross-user access to multi-agent execution', async () => {
      const step = createStep({ agentIds: ['agent-a'], requiredCapabilities: ['reasoning'] });

      const workflow = Workflow.create({
        id: 'idor-wf',
        name: 'IDOR Workflow',
        outcome: 'Test IDOR',
        steps: [step],
        owner: 'system',
      });
      workflowRegistry.register(workflow);

      const executor = createMockStepExecutor([{ ok: true, content: 'Result' }]);
      const verifier = createMockVerifier();

      const service = new WorkflowExecutionService({
        agentRegistry,
        workflowRegistry,
        executionStore: store,
        stepExecutor: executor,
        stepVerifier: verifier,
        evidencePort: evidence,
        clock,
      });

      const startResult = await service.start({ workflowId: 'idor-wf', ownerId: 'user-1' });
      expect(startResult.success).toBe(true);

      // User 2 cannot access user 1's execution
      const getResult = service.get(startResult.data!.executionId, 'user-2');
      expect(getResult.success).toBe(false);
      expect(getResult.error).toContain('IDOR');

      // User 2 cannot approve user 1's execution
      const step2 = createStep({
        id: 'approval-step',
        agentIds: [],
        requiredCapabilities: [],
        approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
      });
      const approvalWorkflow = Workflow.create({
        id: 'idor-approval-wf',
        name: 'IDOR Approval Workflow',
        outcome: 'Test IDOR approval',
        steps: [step2],
        owner: 'system',
      });
      workflowRegistry.register(approvalWorkflow);

      const approvalStart = await service.start({
        workflowId: 'idor-approval-wf',
        ownerId: 'user-1',
      });
      const approveResult = await service.approve(
        approvalStart.data!.executionId,
        'user-2',
        'approval-step',
      );
      expect(approveResult.success).toBe(false);
      expect(approveResult.error).toContain('IDOR');
    });
  });

  describe('9. evidence recording', () => {
    it('records evidence on multi-agent completion', async () => {
      const step1 = createStep({
        id: 's1',
        agentIds: ['agent-a'],
        requiredCapabilities: ['reasoning'],
      });
      const step2 = createStep({
        id: 's2',
        agentIds: ['agent-b'],
        requiredCapabilities: ['reasoning'],
      });

      const workflow = Workflow.create({
        id: 'evidence-wf',
        name: 'Evidence Workflow',
        outcome: 'Test evidence',
        steps: [step1, step2],
        owner: 'system',
      });
      workflowRegistry.register(workflow);

      const executor = createMockStepExecutor([
        { ok: true, content: 'Agent A result' },
        { ok: true, content: 'Agent B result' },
      ]);
      const verifier = createMockVerifier();

      const service = new WorkflowExecutionService({
        agentRegistry,
        workflowRegistry,
        executionStore: store,
        stepExecutor: executor,
        stepVerifier: verifier,
        evidencePort: evidence,
        clock,
      });

      const result = await service.start({ workflowId: 'evidence-wf', ownerId: 'user-1' });
      expect(result.data?.status).toBe('COMPLETED');

      // Evidence should be recorded with success
      expect(evidence.calls).toHaveLength(1);
      expect(evidence.calls[0]?.status).toBe('success');
      expect(evidence.calls[0]?.ownerId).toBe('user-1');
    });
  });

  describe('10. no false memory on failure', () => {
    it('never records success evidence on agent failure', async () => {
      const step1 = createStep({
        id: 's1',
        agentIds: ['agent-a'],
        requiredCapabilities: ['reasoning'],
      });
      const step2 = createStep({
        id: 's2',
        agentIds: ['agent-b'],
        requiredCapabilities: ['reasoning'],
      });

      const workflow = Workflow.create({
        id: 'no-false-wf',
        name: 'No False Memory Workflow',
        outcome: 'Test no false memory',
        steps: [step1, step2],
        owner: 'system',
      });
      workflowRegistry.register(workflow);

      const executor = createMockStepExecutor([
        { ok: true, content: 'Agent A done' },
        { ok: false, error: 'Agent B failed' },
      ]);
      const verifier = createMockVerifier();

      const service = new WorkflowExecutionService({
        agentRegistry,
        workflowRegistry,
        executionStore: store,
        stepExecutor: executor,
        stepVerifier: verifier,
        evidencePort: evidence,
        clock,
      });

      await service.start({ workflowId: 'no-false-wf', ownerId: 'user-1' });

      // Only failure evidence, never success
      expect(evidence.calls.every((c) => c.status === 'failure')).toBe(true);
    });
  });

  describe('11. multi-agent agentId in results', () => {
    it('populates agentId in step results', async () => {
      const step1 = createStep({
        id: 's1',
        agentIds: ['agent-a'],
        requiredCapabilities: ['reasoning'],
      });
      const step2 = createStep({
        id: 's2',
        agentIds: ['agent-b'],
        requiredCapabilities: ['reasoning'],
      });

      const workflow = Workflow.create({
        id: 'agent-id-wf',
        name: 'Agent ID Workflow',
        outcome: 'Test agentId',
        steps: [step1, step2],
        owner: 'system',
      });
      workflowRegistry.register(workflow);

      const executor = createMockStepExecutor([
        { ok: true, content: 'Result A', provider: 'gemini', model: 'gemini-pro' },
        { ok: true, content: 'Result B', provider: 'ollama', model: 'llama3' },
      ]);
      const verifier = createMockVerifier();

      const service = new WorkflowExecutionService({
        agentRegistry,
        workflowRegistry,
        executionStore: store,
        stepExecutor: executor,
        stepVerifier: verifier,
        evidencePort: evidence,
        clock,
      });

      const result = await service.start({ workflowId: 'agent-id-wf', ownerId: 'user-1' });
      expect(result.data?.status).toBe('COMPLETED');
      expect(result.data?.stepResults[0]?.agentId).toBe('agent-a');
      expect(result.data?.stepResults[1]?.agentId).toBe('agent-b');
    });
  });

  describe('12. existing regression', () => {
    it('single-agent workflow still works', async () => {
      const step = createStep({ agentIds: ['agent-a'], requiredCapabilities: ['reasoning'] });
      const workflow = Workflow.create({
        id: 'single-wf',
        name: 'Single Agent',
        outcome: 'Single agent test',
        steps: [step],
        owner: 'system',
      });
      workflowRegistry.register(workflow);

      const executor = createMockStepExecutor([{ ok: true, content: 'Result' }]);
      const verifier = createMockVerifier();

      const service = new WorkflowExecutionService({
        agentRegistry,
        workflowRegistry,
        executionStore: store,
        stepExecutor: executor,
        stepVerifier: verifier,
        evidencePort: evidence,
        clock,
      });

      const result = await service.start({ workflowId: 'single-wf', ownerId: 'user-1' });
      expect(result.data?.status).toBe('COMPLETED');
    });
  });
});
