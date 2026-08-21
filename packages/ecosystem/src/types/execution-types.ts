// ──────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem: Workflow Execution Types
// SPRINT-051 — Agent & Workflow Execution Foundation
//
// The execution state model for workflow executions. This bridges
// WorkflowDefinition (SPRINT-050) to ExecutionRunService (EPIC-014).
//
// CRITICAL: This does NOT duplicate the existing ExecutionRunService.
// It provides the workflow-level execution state that maps to the
// existing execution infrastructure.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type { RiskLevel, ApprovalPolicy, AutomationLevel } from './ecosystem-types.js';

// ── Workflow Execution Status ──────────────────────────────────────

/** Workflow-level execution status. */
export type WorkflowExecutionStatus =
  | 'PENDING' // Created but not started
  | 'RUNNING' // Actively executing steps
  | 'WAITING_FOR_APPROVAL' // Paused at an approval gate
  | 'WAITING_FOR_INPUT' // Paused waiting for user input
  | 'PAUSED' // Manually paused
  | 'FAILED' // One or more steps failed
  | 'COMPLETED' // All steps completed successfully
  | 'CANCELLED'; // Cancelled by user

export const WORKFLOW_EXECUTION_STATUSES: readonly WorkflowExecutionStatus[] = [
  'PENDING',
  'RUNNING',
  'WAITING_FOR_APPROVAL',
  'WAITING_FOR_INPUT',
  'PAUSED',
  'FAILED',
  'COMPLETED',
  'CANCELLED',
] as const;

// ── Step Execution Status ──────────────────────────────────────────

/** Per-step execution status within a workflow. */
export type WorkflowStepStatus =
  | 'pending' // Not yet reached
  | 'running' // Currently executing
  | 'completed' // Successfully completed
  | 'failed' // Failed (with error)
  | 'skipped' // Skipped (unavailable)
  | 'waiting_approval' // Waiting for human approval
  | 'blocked' // Blocked by dependency or budget
  | 'cancelled'; // Cancelled

// ── Step Result ────────────────────────────────────────────────────

/** The result of executing a single workflow step. */
export interface WorkflowStepResult {
  /** The step id. */
  stepId: string;
  /** The step title. */
  title: string;
  /** The agent that executed this step (if any). */
  agentId?: string;
  /** The capability used. */
  capability?: CapabilityType;
  /** The provider that executed this step. */
  provider?: string;
  /** The model used. */
  model?: string;
  /** The step output content. */
  output?: string;
  /** Whether this step was verified. */
  verified: boolean;
  /** Verification checks. */
  verificationChecks?: Array<{ name: string; passed: boolean; detail: string }>;
  /** The step execution status. */
  status: WorkflowStepStatus;
  /** Error message if failed. */
  error?: string;
  /** Execution cost in USD. */
  costUsd: number;
  /** Tokens used. */
  tokensUsed: number;
  /** Latency in ms. */
  latencyMs: number;
  /** Number of attempts (including retries). */
  attempts: number;
  /** When this step started. */
  startedAt?: string;
  /** When this step ended. */
  endedAt?: string;
}

// ── Workflow Execution ─────────────────────────────────────────────

/** The full execution state of a workflow. */
export interface WorkflowExecution {
  /** Unique execution id. */
  executionId: string;
  /** The workflow id this execution belongs to. */
  workflowId: string;
  /** The owner (user id). */
  ownerId: string;
  /** The workflow name (denormalized for display). */
  workflowName: string;
  /** The desired outcome. */
  outcome: string;
  /** Current execution status. */
  status: WorkflowExecutionStatus;
  /** The current step index (0-based). */
  currentStepIndex: number;
  /** Total number of steps. */
  totalSteps: number;
  /** Step results (one per step, in order). */
  stepResults: WorkflowStepResult[];
  /** Approval gate state (if waiting). */
  approvalState?: WorkflowApprovalState;
  /** Execution error (if failed). */
  error?: string;
  /** When this execution was created. */
  createdAt: string;
  /** When this execution was last updated. */
  updatedAt: string;
  /** When this execution completed (if finished). */
  completedAt?: string;
  /** Total cost in USD. */
  totalCostUsd: number;
  /** Total tokens used. */
  totalTokensUsed: number;
  /** Total latency in ms. */
  totalLatencyMs: number;
  /** The underlying ExecutionRun id (for bridging to EPIC-014). */
  executionRunId?: string;
}

// ── Approval State ─────────────────────────────────────────────────

/** State when a workflow is waiting for human approval. */
export interface WorkflowApprovalState {
  /** The step id waiting for approval. */
  stepId: string;
  /** The step title. */
  stepTitle: string;
  /** The risk level of the step. */
  riskLevel: RiskLevel;
  /** The approval policy. */
  approvalPolicy: ApprovalPolicy;
  /** The automation level. */
  automationLevel: AutomationLevel;
  /** What the step will do (plain language). */
  description: string;
  /** When the approval was requested. */
  requestedAt: string;
}

// ── Execution Request ──────────────────────────────────────────────

/** Request to start a workflow execution. */
export interface StartWorkflowExecutionRequest {
  /** The workflow id to execute. */
  workflowId: string;
  /** The owner (user id). */
  ownerId: string;
  /** Optional input data for the workflow. */
  input?: Record<string, unknown>;
}

// ── Execution Summary ──────────────────────────────────────────────

/** Summary of a workflow execution (for list views). */
export interface WorkflowExecutionSummary {
  executionId: string;
  workflowId: string;
  workflowName: string;
  outcome: string;
  status: WorkflowExecutionStatus;
  currentStepIndex: number;
  totalSteps: number;
  progress: number; // 0-100
  totalCostUsd: number;
  createdAt: string;
  completedAt?: string;
}
