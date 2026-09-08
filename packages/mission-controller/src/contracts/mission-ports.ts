// ------------------------------------------------------------------
// VedMoulya ? Mission Controller: Ports (Contracts)
// BLD-021A ? Autonomous Mission Controller
//
// These ports define how the mission controller integrates with
// the existing frozen systems. No system is duplicated ? only
// narrow integration points are defined.
// ------------------------------------------------------------------

import type { AgentPlan, AgentRunBudgetConfig } from '@vedmoulya/agent-execution';
import type {
  Mission,
  MissionCheckpoint,
  MissionObjective,
  ObjectiveSelectionResult,
  ProviderCapability,
  ProviderStatus,
  MissionFailureClassification,
  RepositoryInspectionEvidence,
  GitOperation,
  GitSafetyClassification,
} from '../types/mission-types.js';

export type {
  ProviderStatus,
  ProviderCapability,
  RepositoryInspectionEvidence,
  GitOperation,
  GitSafetyClassification,
};

// -- Mission Persistence -------------------------------------------
export interface MissionStore {
  save(mission: Mission): Promise<void>;
  get(missionId: string): Promise<Mission | undefined>;
  getSync?(missionId: string): Mission | undefined;
  listByUserId(userId: string): Promise<Mission[]>;
  listActive(): Promise<Mission[]>;
  /**
   * Atomically transition one persisted objective to RUNNING and attach its
   * lease. Stores that cannot provide a cross-process CAS may omit this
   * optional method; the controller retains its in-process safety fallback.
   */
  acquireObjectiveLease?(
    missionId: string,
    objectiveId: string,
    lease: MissionObjective['lease'],
  ): Promise<Mission | undefined>;
}

// -- Checkpoint Persistence ----------------------------------------
export interface CheckpointStore {
  save(checkpoint: MissionCheckpoint): Promise<void>;
  getLatestForMission(missionId: string): Promise<MissionCheckpoint | undefined>;
  listForMission(missionId: string): Promise<MissionCheckpoint[]>;
}

// -- Objective Selection Port --------------------------------------
export interface ObjectiveSelectionPort {
  selectNextObjective(
    mission: Mission,
    completedObjectiveIds: string[],
    providerStatus: ProviderStatus,
  ): Promise<ObjectiveSelectionResult>;
}

// -- Provider Availability Port ------------------------------------
export interface ProviderAvailabilityPort {
  getProviderStatus(requiredCapabilities: string[]): Promise<ProviderStatus>;
}

// -- Goal Understanding Port (delegates to planning) --------------
export interface GoalUnderstandingPort {
  understandGoal(
    objective: string,
    missionContext: string,
    constraints: Mission['constraints'],
  ): Promise<{
    goal: string;
    requiredCapabilities: string[];
    constraints: string[];
    estimatedComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
}

// -- Planning Port (delegates to planning package) -----------------
export interface PlanningPort {
  createPlan(
    goal: string,
    requiredCapabilities: string[],
    constraints: string[],
  ): Promise<AgentPlan>;
}

// -- Execution Port (delegates to agent-execution) -----------------
export interface ExecutionPort {
  executePlan(
    plan: AgentPlan,
    userId: string,
    budget?: Partial<AgentRunBudgetConfig>,
    allowedTools?: string[],
    permissionClasses?: string[],
    executionContext?: { missionId: string; objectiveId: string },
  ): Promise<{
    runId: string;
    success: boolean;
    verified: boolean;
    output?: string;
    error?: string;
    failureClass?: string;
    usage: {
      tokens: number;
      costUsd: number;
      latencyMs: number;
      toolCalls: number;
    };
  }>;
}

// -- Verification Port (delegates to agent-execution) --------------
export interface VerificationPort {
  verifyObjective(
    objective: MissionObjective,
    executionResult: { output?: string; success: boolean },
  ): Promise<{
    verified: boolean;
    evidence: string[];
    method: string;
  }>;
}

// -- Execution Memory Port (delegates to execution-memory) ---------
export interface ExecutionMemoryPort {
  recordVerifiedOutcome(
    missionId: string,
    objectiveId: string,
    outcome: { success: boolean; verified?: boolean; output?: string; evidence: string[] },
  ): Promise<void>;
}

// -- Experience Optimization Port ----------------------------------
export interface ExperienceOptimizationPort {
  getAdvisorySignal(
    taskPattern: string,
    context: Record<string, unknown>,
  ): Promise<{
    recommendation?: string;
    confidence: number;
    evidenceCount: number;
    reason?: string;
  }>;
}

// -- Failure Classification Port -----------------------------------
export interface FailureClassificationPort {
  classify(
    error: string,
    executionResult: { failureClass?: string; usage: unknown },
    providerStatus: ProviderStatus,
  ): Promise<MissionFailureClassification>;
}

// -- Clock Port ---------------------------------------------------
export interface ClockPort {
  now(): string;
  timestampMs(): number;
}

// -- Id Generator Port --------------------------------------------
export interface IdGeneratorPort {
  generateId(prefix: string): string;
}

// -- Repository Inspection Port (Phase 1, 4, 5) ---------------------
export type RepositoryInspectionResult = RepositoryInspectionEvidence;

export interface RepositoryInspectionPort {
  inspectRepository(workspacePath?: string): Promise<RepositoryInspectionResult>;
}

// -- Git Safety Port (Phase 14, 24) --------------------------------
export interface GitSafetyPort {
  classifyOperation(operation: GitOperation): GitSafetyClassification;
  isSafe(operation: GitOperation): boolean;
  requiresApproval(operation: GitOperation): boolean;
}
