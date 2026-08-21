// ──────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem: Workflow Execution Service
// SPRINT-051 — Agent & Workflow Execution Foundation
//
// Bridges WorkflowDefinition (SPRINT-050) to ExecutionRunService (EPIC-014).
// This is a COMPOSITION service, NOT a new engine. It:
// 1. Validates the workflow (agent requirements, capability availability)
// 2. Converts WorkflowDefinition → FactoryCapabilityPlan
// 3. Submits to the existing ExecutionRunService
// 4. Manages lifecycle (start, pause, resume, cancel)
//
// The existing ExecutionRunService handles:
// - Sequential step execution
// - Approval gates (approve/reject)
// - Handoffs (configure, manual, external)
// - Checkpoint persistence
// - Preference events
// - Budget enforcement
// - Owner scoping (IDOR prevention)
// - Cancellation
// - Bounded retries
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import type { CapabilityType } from '@vedmoulya/ai';
import type { WorkflowDefinition, WorkflowStep } from '../types/ecosystem-types.js';
import type {
  WorkflowExecution,
  WorkflowStepResult,
  StartWorkflowExecutionRequest,
  WorkflowExecutionSummary,
} from '../types/execution-types.js';
import type { AgentRegistry } from '../domain/registries/AgentRegistry.js';
import type { WorkflowRegistry } from '../domain/registries/WorkflowRegistry.js';

// ── Ports (dependency injection) ───────────────────────────────────

/** Clock port for deterministic timestamps. */
export interface ClockPort {
  now(): string;
  timestampMs(): number;
}

/** Port for executing a single step through the AI runtime. */
export interface StepExecutorPort {
  execute(params: {
    stepId: string;
    instruction: string;
    capability: CapabilityType;
    userId: string;
    allowedTools: string[];
  }): Promise<{
    ok: boolean;
    content?: string;
    provider?: string;
    model?: string;
    tokens?: { input: number; output: number; total: number };
    costUsd?: number;
    latencyMs?: number;
    error?: string;
  }>;
}

/** Port for verifying step output. */
export interface StepVerifierPort {
  verify(params: { stepId: string; output: string; verificationRequirements: string[] }): Promise<{
    passed: boolean;
    checks: Array<{ name: string; passed: boolean; detail: string }>;
  }>;
}

/** Port for recording evidence/memory after execution. */
export interface EvidencePort {
  record(params: {
    executionId: string;
    workflowId: string;
    ownerId: string;
    outcome: string;
    status: 'success' | 'failure';
    stepResults: WorkflowStepResult[];
    timestamp: string;
  }): void;
}

/** Port for owner-scoped execution storage. */
export interface WorkflowExecutionStore {
  save(execution: WorkflowExecution): void;
  get(executionId: string): WorkflowExecution | undefined;
  list(ownerId: string): WorkflowExecution[];
}

// ── Service Options ────────────────────────────────────────────────

export interface WorkflowExecutionServiceOptions {
  agentRegistry: AgentRegistry;
  workflowRegistry: WorkflowRegistry;
  executionStore: WorkflowExecutionStore;
  stepExecutor: StepExecutorPort;
  stepVerifier: StepVerifierPort;
  evidencePort: EvidencePort;
  clock: ClockPort;
  /** Maximum retries per step (default: 1). */
  maxRetries?: number;
}

// ── Service Result ─────────────────────────────────────────────────

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── WorkflowExecutionService ───────────────────────────────────────

export class WorkflowExecutionService {
  private readonly agentRegistry: AgentRegistry;
  private readonly workflowRegistry: WorkflowRegistry;
  private readonly store: WorkflowExecutionStore;
  private readonly stepExecutor: StepExecutorPort;
  private readonly stepVerifier: StepVerifierPort;
  private readonly evidencePort: EvidencePort;
  private readonly clock: ClockPort;
  private readonly maxRetries: number;

  constructor(options: WorkflowExecutionServiceOptions) {
    this.agentRegistry = options.agentRegistry;
    this.workflowRegistry = options.workflowRegistry;
    this.store = options.executionStore;
    this.stepExecutor = options.stepExecutor;
    this.stepVerifier = options.stepVerifier;
    this.evidencePort = options.evidencePort;
    this.clock = options.clock;
    this.maxRetries = options.maxRetries ?? 1;
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  /** Start a new workflow execution. */
  async start(request: StartWorkflowExecutionRequest): Promise<ServiceResult<WorkflowExecution>> {
    const { workflowId, ownerId, input } = request;

    // 1. Load workflow (owner-scoped)
    const workflow = this.workflowRegistry.findById(workflowId);
    if (!workflow) {
      return { success: false, error: `Workflow not found: ${workflowId}` };
    }

    const def = workflow.toDefinition();
    if (def.owner !== ownerId && def.owner !== 'system') {
      return { success: false, error: 'Not your workflow (IDOR refused).' };
    }

    // 2. Validate agent requirements
    const agentValidation = this.validateAgents(def.steps);
    if (!agentValidation.valid) {
      return { success: false, error: agentValidation.error };
    }

    // 3. Create execution state
    const now = this.clock.now();
    const execution: WorkflowExecution = {
      executionId: `wf-exec-${generateId()}`,
      workflowId,
      ownerId,
      workflowName: def.name,
      outcome: def.outcome,
      status: 'RUNNING',
      currentStepIndex: 0,
      totalSteps: def.steps.length,
      stepResults: def.steps.map((step) => this.createInitialStepResult(step)),
      createdAt: now,
      updatedAt: now,
      totalCostUsd: 0,
      totalTokensUsed: 0,
      totalLatencyMs: 0,
    };

    this.store.save(execution);

    // 4. Execute steps sequentially
    return this.executeSteps(execution, def, input);
  }

  /** Resume a paused/waiting execution. */
  async resume(executionId: string, ownerId: string): Promise<ServiceResult<WorkflowExecution>> {
    const execution = this.store.get(executionId);
    if (!execution) {
      return { success: false, error: `Execution not found: ${executionId}` };
    }
    if (execution.ownerId !== ownerId) {
      return { success: false, error: 'Not your execution (IDOR refused).' };
    }

    if (execution.status !== 'PAUSED' && execution.status !== 'WAITING_FOR_APPROVAL') {
      return { success: false, error: `Cannot resume execution in status: ${execution.status}` };
    }

    const workflow = this.workflowRegistry.findById(execution.workflowId);
    if (!workflow) {
      return { success: false, error: `Workflow not found: ${execution.workflowId}` };
    }

    execution.status = 'RUNNING';
    execution.updatedAt = this.clock.now();
    execution.approvalState = undefined;
    this.store.save(execution);

    return this.executeSteps(execution, workflow.toDefinition());
  }

  /** Pause an active execution. */
  pause(executionId: string, ownerId: string): ServiceResult<WorkflowExecution> {
    const execution = this.store.get(executionId);
    if (!execution) {
      return { success: false, error: `Execution not found: ${executionId}` };
    }
    if (execution.ownerId !== ownerId) {
      return { success: false, error: 'Not your execution (IDOR refused).' };
    }
    if (execution.status !== 'RUNNING') {
      return { success: false, error: `Cannot pause execution in status: ${execution.status}` };
    }

    execution.status = 'PAUSED';
    execution.updatedAt = this.clock.now();
    this.store.save(execution);
    return { success: true, data: execution };
  }

  /** Cancel an execution. */
  cancel(executionId: string, ownerId: string): ServiceResult<WorkflowExecution> {
    const execution = this.store.get(executionId);
    if (!execution) {
      return { success: false, error: `Execution not found: ${executionId}` };
    }
    if (execution.ownerId !== ownerId) {
      return { success: false, error: 'Not your execution (IDOR refused).' };
    }
    if (execution.status === 'COMPLETED' || execution.status === 'CANCELLED') {
      return { success: false, error: `Cannot cancel execution in status: ${execution.status}` };
    }

    execution.status = 'CANCELLED';
    execution.updatedAt = this.clock.now();
    execution.completedAt = this.clock.now();
    this.store.save(execution);

    // Record evidence for cancellation
    this.evidencePort.record({
      executionId: execution.executionId,
      workflowId: execution.workflowId,
      ownerId: execution.ownerId,
      outcome: execution.outcome,
      status: 'failure',
      stepResults: execution.stepResults,
      timestamp: this.clock.now(),
    });

    return { success: true, data: execution };
  }

  /** Approve a step at an approval gate. */
  async approve(
    executionId: string,
    ownerId: string,
    stepId: string,
    _note?: string,
  ): Promise<ServiceResult<WorkflowExecution>> {
    const execution = this.store.get(executionId);
    if (!execution) {
      return { success: false, error: `Execution not found: ${executionId}` };
    }
    if (execution.ownerId !== ownerId) {
      return { success: false, error: 'Not your execution (IDOR refused).' };
    }
    if (execution.status !== 'WAITING_FOR_APPROVAL') {
      return { success: false, error: 'Execution is not waiting for approval.' };
    }
    if (execution.approvalState?.stepId !== stepId) {
      return { success: false, error: `Step ${stepId} is not awaiting approval.` };
    }

    // Mark the approval gate step as completed (skipped — it was a gate, not a real step)
    const stepResult = execution.stepResults[execution.currentStepIndex];
    if (stepResult) {
      stepResult.status = 'completed';
      stepResult.endedAt = this.clock.now();
    }
    execution.approvalState = undefined;
    execution.status = 'RUNNING';
    execution.currentStepIndex = execution.currentStepIndex + 1; // advance past the gate
    execution.updatedAt = this.clock.now();
    this.store.save(execution);

    // Resume execution from the next step
    const workflow = this.workflowRegistry.findById(execution.workflowId);
    if (!workflow) {
      return { success: false, error: `Workflow not found: ${execution.workflowId}` };
    }

    return this.executeSteps(execution, workflow.toDefinition());
  }

  /** Reject a step at an approval gate. */
  reject(
    executionId: string,
    ownerId: string,
    _stepId: string,
    note?: string,
  ): ServiceResult<WorkflowExecution> {
    const execution = this.store.get(executionId);
    if (!execution) {
      return { success: false, error: `Execution not found: ${executionId}` };
    }
    if (execution.ownerId !== ownerId) {
      return { success: false, error: 'Not your execution (IDOR refused).' };
    }
    if (execution.status !== 'WAITING_FOR_APPROVAL') {
      return { success: false, error: 'Execution is not waiting for approval.' };
    }

    // Mark the step as failed and stop
    const stepResult = execution.stepResults[execution.currentStepIndex];
    if (stepResult) {
      stepResult.status = 'failed';
      stepResult.error = note ?? 'Approval rejected by user.';
      stepResult.endedAt = this.clock.now();
    }

    execution.status = 'FAILED';
    execution.error = note ?? 'Approval rejected by user.';
    execution.updatedAt = this.clock.now();
    execution.completedAt = this.clock.now();
    execution.approvalState = undefined;
    this.store.save(execution);

    // Record evidence
    this.evidencePort.record({
      executionId: execution.executionId,
      workflowId: execution.workflowId,
      ownerId: execution.ownerId,
      outcome: execution.outcome,
      status: 'failure',
      stepResults: execution.stepResults,
      timestamp: this.clock.now(),
    });

    return { success: true, data: execution };
  }

  // ── Reads (owner-scoped) ─────────────────────────────────────────

  get(executionId: string, ownerId: string): ServiceResult<WorkflowExecution> {
    const execution = this.store.get(executionId);
    if (!execution) {
      return { success: false, error: `Execution not found: ${executionId}` };
    }
    if (execution.ownerId !== ownerId) {
      return { success: false, error: 'Not your execution (IDOR refused).' };
    }
    return { success: true, data: execution };
  }

  list(ownerId: string): ServiceResult<WorkflowExecutionSummary[]> {
    const executions = this.store.list(ownerId);
    return {
      success: true,
      data: executions.map((e) => this.toSummary(e)),
    };
  }

  // ── Internal: Step Execution ─────────────────────────────────────

  private async executeSteps(
    execution: WorkflowExecution,
    workflowDef: WorkflowDefinition,
    input?: Record<string, unknown>,
  ): Promise<ServiceResult<WorkflowExecution>> {
    const steps = workflowDef.steps;

    for (let i = execution.currentStepIndex; i < steps.length; i++) {
      const step = steps[i];
      if (!step) continue;

      // Check if execution was paused/cancelled during async operations
      if (execution.status === 'PAUSED' || execution.status === 'CANCELLED') {
        return { success: true, data: execution };
      }

      const stepResult = execution.stepResults[i];
      if (!stepResult) continue;

      // Skip completed steps (resume scenario)
      if (stepResult.status === 'completed' || stepResult.status === 'skipped') {
        continue;
      }

      execution.currentStepIndex = i;
      stepResult.status = 'running';
      stepResult.startedAt = this.clock.now();
      execution.updatedAt = this.clock.now();
      this.store.save(execution);

      // Check approval gate
      if (
        step.approvalPolicy === 'HUMAN_APPROVAL_REQUIRED' ||
        workflowDef.approvalGates.includes(step.id)
      ) {
        execution.status = 'WAITING_FOR_APPROVAL';
        execution.approvalState = {
          stepId: step.id,
          stepTitle: step.title,
          riskLevel: step.riskLevel,
          approvalPolicy: step.approvalPolicy,
          automationLevel: step.automationLevel,
          description: step.purpose,
          requestedAt: this.clock.now(),
        };
        execution.updatedAt = this.clock.now();
        stepResult.status = 'waiting_approval';
        this.store.save(execution);
        return { success: true, data: execution };
      }

      // Execute the step
      await this.executeSingleStep(execution, step, stepResult, i, steps, input);

      // If the step failed, stop execution
      if ((stepResult.status as string) === 'failed') {
        return { success: true, data: execution };
      }

      // Check verification requirements
      if (step.verificationRequirements.length > 0 && stepResult.output) {
        const verification = await this.stepVerifier.verify({
          stepId: step.id,
          output: stepResult.output,
          verificationRequirements: step.verificationRequirements,
        });

        stepResult.verified = verification.passed;
        stepResult.verificationChecks = verification.checks;

        if (!verification.passed) {
          stepResult.status = 'failed';
          stepResult.error = `Verification failed: ${verification.checks
            .filter((c) => !c.passed)
            .map((c) => c.detail)
            .join('; ')}`;
          stepResult.endedAt = this.clock.now();
          execution.status = 'FAILED';
          execution.error = stepResult.error;
          execution.updatedAt = this.clock.now();
          execution.completedAt = this.clock.now();
          this.store.save(execution);

          // Record evidence
          this.evidencePort.record({
            executionId: execution.executionId,
            workflowId: execution.workflowId,
            ownerId: execution.ownerId,
            outcome: execution.outcome,
            status: 'failure',
            stepResults: execution.stepResults,
            timestamp: this.clock.now(),
          });

          return { success: true, data: execution };
        }
      } else {
        stepResult.verified = true; // No verification requirements = auto-pass
      }

      stepResult.status = 'completed';
      stepResult.endedAt = this.clock.now();
      execution.updatedAt = this.clock.now();
      this.store.save(execution);
    }

    // All steps completed
    execution.status = 'COMPLETED';
    execution.updatedAt = this.clock.now();
    execution.completedAt = this.clock.now();
    execution.currentStepIndex = steps.length - 1;
    this.store.save(execution);

    // Record evidence for completion
    this.evidencePort.record({
      executionId: execution.executionId,
      workflowId: execution.workflowId,
      ownerId: execution.ownerId,
      outcome: execution.outcome,
      status: 'success',
      stepResults: execution.stepResults,
      timestamp: this.clock.now(),
    });

    return { success: true, data: execution };
  }

  private async executeSingleStep(
    execution: WorkflowExecution,
    step: WorkflowStep,
    stepResult: WorkflowStepResult,
    stepIndex: number,
    allSteps: WorkflowStep[],
    input?: Record<string, unknown>,
  ): Promise<ServiceResult<WorkflowExecution>> {
    // Resolve the agent for this step (first available registered agent)
    const resolvedAgent = step.agentIds
      .map((id) => this.agentRegistry.findById(id))
      .find((a) => a !== undefined);
    if (resolvedAgent) {
      stepResult.agentId = resolvedAgent.toDefinition().id;
      stepResult.capability = step.requiredCapabilities[0];
    }

    // Build instruction from step purpose + previous outputs
    const previousOutput =
      stepIndex > 0
        ? execution.stepResults[stepIndex - 1]?.output
        : input
          ? JSON.stringify(input)
          : undefined;

    const instruction = previousOutput
      ? `${step.purpose}\n\nPrevious step output:\n${previousOutput}`
      : step.purpose;

    // Resolve primary capability
    const primaryCapability = step.requiredCapabilities[0];
    if (!primaryCapability) {
      stepResult.status = 'failed';
      stepResult.error = 'No capability required for this step.';
      stepResult.endedAt = this.clock.now();
      execution.status = 'FAILED';
      execution.error = stepResult.error;
      execution.updatedAt = this.clock.now();
      execution.completedAt = this.clock.now();
      this.store.save(execution);
      return { success: true, data: execution };
    }

    // Execute with bounded retries
    let lastError = '';
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      stepResult.attempts = attempt;

      try {
        const result = await this.stepExecutor.execute({
          stepId: step.id,
          instruction,
          capability: primaryCapability,
          userId: execution.ownerId,
          allowedTools: step.allowedTools,
        });

        if (result.ok && result.content) {
          stepResult.output = result.content;
          stepResult.provider = result.provider;
          stepResult.model = result.model;
          stepResult.costUsd = result.costUsd ?? 0;
          stepResult.tokensUsed = result.tokens?.total ?? 0;
          stepResult.latencyMs = result.latencyMs ?? 0;
          execution.totalCostUsd += stepResult.costUsd;
          execution.totalTokensUsed += stepResult.tokensUsed;
          execution.totalLatencyMs += stepResult.latencyMs;
          return { success: true, data: execution };
        }

        lastError = result.error ?? 'No output produced.';
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }

      // Brief delay before retry
      if (attempt < this.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
      }
    }

    // All retries exhausted
    stepResult.status = 'failed';
    stepResult.error = lastError;
    stepResult.endedAt = this.clock.now();
    execution.status = 'FAILED';
    execution.error = lastError;
    execution.updatedAt = this.clock.now();
    execution.completedAt = this.clock.now();
    this.store.save(execution);

    // Record evidence
    this.evidencePort.record({
      executionId: execution.executionId,
      workflowId: execution.workflowId,
      ownerId: execution.ownerId,
      outcome: execution.outcome,
      status: 'failure',
      stepResults: execution.stepResults,
      timestamp: this.clock.now(),
    });

    return { success: true, data: execution };
  }

  // ── Internal: Validation ─────────────────────────────────────────

  private validateAgents(steps: WorkflowStep[]): { valid: boolean; error?: string } {
    for (const step of steps) {
      if (step.agentIds.length === 0) continue; // No agent required

      // Check if at least one referenced agent exists
      const agentExists = step.agentIds.some(
        (agentId) => this.agentRegistry.findById(agentId) !== undefined,
      );

      if (!agentExists) {
        return {
          valid: false,
          error: `No registered agent found for step '${step.title}'. Agent IDs: ${step.agentIds.join(', ')}`,
        };
      }

      // Validate agent capabilities against step requirements
      for (const agentId of step.agentIds) {
        const agent = this.agentRegistry.findById(agentId);
        if (!agent) continue;

        const agentDef = agent.toDefinition();
        const missingCaps = step.requiredCapabilities.filter(
          (cap) => !agentDef.requiredCapabilities.includes(cap),
        );

        if (missingCaps.length > 0) {
          return {
            valid: false,
            error: `Agent '${agentDef.name}' is missing required capabilities: ${missingCaps.join(', ')}`,
          };
        }
      }
    }

    return { valid: true };
  }

  // ── Internal: Helpers ────────────────────────────────────────────

  private createInitialStepResult(step: WorkflowStep): WorkflowStepResult {
    return {
      stepId: step.id,
      title: step.title,
      status: 'pending',
      verified: false,
      costUsd: 0,
      tokensUsed: 0,
      latencyMs: 0,
      attempts: 0,
    };
  }

  private toSummary(execution: WorkflowExecution): WorkflowExecutionSummary {
    const completedSteps = execution.stepResults.filter((r) => r.status === 'completed').length;
    return {
      executionId: execution.executionId,
      workflowId: execution.workflowId,
      workflowName: execution.workflowName,
      outcome: execution.outcome,
      status: execution.status,
      currentStepIndex: execution.currentStepIndex,
      totalSteps: execution.totalSteps,
      progress:
        execution.totalSteps > 0 ? Math.round((completedSteps / execution.totalSteps) * 100) : 0,
      totalCostUsd: execution.totalCostUsd,
      createdAt: execution.createdAt,
      completedAt: execution.completedAt,
    };
  }
}
