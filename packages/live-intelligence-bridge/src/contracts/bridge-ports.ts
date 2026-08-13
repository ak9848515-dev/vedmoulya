// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/live-intelligence-bridge — Bridge Ports
// EPIC-017
//
// The ONLY seams the bridge uses to reach the frozen estate. Every
// port is a thin facade over an EXISTING application service — the
// bridge never reaches inside another engine. Adapters live at the
// gateway (deterministic in CI); the bridge itself stays pure.
//
// Reused seams (never duplicated):
//   • BrainCandidatePort  — @vedmoulya/brain (the single source seam)
//   • BrainPreferencePort — @vedmoulya/brain (EPIC-014 ledger)
// ──────────────────────────────────────────────────────────────────

import type {
  CapabilityId,
  FactoryCapabilityPlan,
  CapabilityPlanRequest,
} from '@vedmoulya/capability-marketplace';
import type { BrainCandidatePort, BrainPreferencePort, BrainTask } from '@vedmoulya/brain';
import type {
  IntelligenceTaskContext,
  TaskIntelligenceResult,
  IntelligenceNotification,
  IntelligenceNotificationKind,
  LicenseIntelligence,
  IntelligenceOption,
} from '@vedmoulya/ecosystem-intelligence';
import type { ExecutionRun } from '@vedmoulya/execution-bridge';
import type { BridgeNotificationEvent } from '../types/bridge-types.js';

// ── Clock (same shape as the platform ClockPort) ──────────────────
export interface BridgeClockPort {
  now(): string;
  timestampMs(): number;
}

// ── Brain (EPIC-016) — UNDERSTAND / PLAN / APPROVAL / EXECUTE / VERIFY / EVALUATE ──
export interface BridgeBrainPort {
  createTask(
    userId: string,
    objective: string,
  ): { success: boolean; data?: BrainTask; error?: string; code?: string };
  plan(
    userId: string,
    taskId: string,
  ): Promise<{ success: boolean; data?: BrainTask; error?: string; code?: string }>;
  selectResources(
    userId: string,
    taskId: string,
  ): Promise<{ success: boolean; data?: BrainTask; error?: string; code?: string }>;
  requestApproval(
    userId: string,
    taskId: string,
    action: string,
  ): { success: boolean; data?: BrainTask; error?: string; code?: string };
  approve(
    userId: string,
    taskId: string,
    action: string,
  ): { success: boolean; data?: BrainTask; error?: string; code?: string };
  reject(
    userId: string,
    taskId: string,
    action: string,
  ): { success: boolean; data?: BrainTask; error?: string; code?: string };
  execute(
    userId: string,
    taskId: string,
  ): Promise<{ success: boolean; data?: BrainTask; error?: string; code?: string }>;
  verify(
    userId: string,
    taskId: string,
  ): { success: boolean; data?: BrainTask; error?: string; code?: string };
  evaluateOutcome(
    userId: string,
    taskId: string,
    accepted: boolean,
  ): Promise<{ success: boolean; data?: BrainTask; error?: string; code?: string }>;
  getStatus(
    userId: string,
    taskId: string,
  ): { success: boolean; data?: BrainTask; error?: string; code?: string };
  listTasks(userId: string): {
    success: boolean;
    data?: BrainTask[];
    error?: string;
    code?: string;
  };
}

// ── Intelligence (EPIC-015) — DISCOVER / COMPARE / RECOMMEND ──────
export interface BridgeIntelligencePort {
  findBetterOption(
    userId: string,
    capability: CapabilityId,
    ctx: IntelligenceTaskContext,
  ): Promise<TaskIntelligenceResult>;
  findFreeAlternative(
    userId: string,
    capability: CapabilityId,
  ): Promise<{
    free: boolean;
    name?: string;
    providerId?: string;
    quality?: number;
    note?: string;
  }>;
  findLocalAlternative(
    userId: string,
    capability: CapabilityId,
  ): Promise<Array<{ name: string; available: boolean }> | { available: false; note: string }>;
  findGitHubCapability(
    userId: string,
    capability: CapabilityId,
  ): Promise<{
    found: boolean;
    items: Array<{ title: string; configurable: boolean; securityFlags: string[] }>;
    note?: string;
  }>;
  findBetterProvider(
    userId: string,
    capability: CapabilityId,
  ): Promise<{
    better: boolean;
    current?: { name: string; quality?: number };
    recommended?: { name: string; quality?: number; requiresActivation: boolean };
    note?: string;
  }>;
  evaluateSecurity(userId: string, resourceId: string): { state: string; evidence: string[] };
  evaluateLicense(
    userId: string,
    facts: { license?: string; modelLicense?: string },
  ): LicenseIntelligence;
  respondToRecommendation(
    userId: string,
    recommendationId: string,
    action:
      | 'use_recommended'
      | 'continue_with_current'
      | 'review_details'
      | 'dont_suggest_again'
      | 'review_and_configure'
      | 'ignore'
      | 'download'
      | 'open_repository',
  ): Promise<{ state: string; recommendationId?: string; error?: string }>;
  notify(
    userId: string,
    opts: {
      kind: IntelligenceNotificationKind;
      title: string;
      body: string;
      relevance: number;
      itemId?: string;
    },
  ): IntelligenceNotification | { dropped: true; reason: string };
}

// ── Marketplace (EPIC-013) — PLAN ─────────────────────────────────
export interface BridgeMarketplacePort {
  plan(userId: string, request: CapabilityPlanRequest): Promise<FactoryCapabilityPlan>;
  getPlan(userId: string, planId: string): Promise<FactoryCapabilityPlan | undefined>;
}

// ── Execution (EPIC-014) — EXECUTE / VERIFY ───────────────────────
export interface BridgeExecutionPort {
  start(
    ownerId: string,
    planId: string,
  ): Promise<{ success: boolean; data?: ExecutionRun; error?: string }>;
  approve(
    ownerId: string,
    executionId: string,
    stepId: string,
    note?: string,
  ): Promise<{ success: boolean; data?: ExecutionRun; error?: string }>;
  reject(
    ownerId: string,
    executionId: string,
    stepId: string,
    note?: string,
  ): Promise<{ success: boolean; data?: ExecutionRun; error?: string }>;
  completeHandoff(
    ownerId: string,
    executionId: string,
    stepId: string,
    note?: string,
  ): Promise<{ success: boolean; data?: ExecutionRun; error?: string }>;
  get(
    ownerId: string,
    executionId: string,
  ): { success: boolean; data?: ExecutionRun; error?: string };
  list(ownerId: string): { success: boolean; data?: ExecutionRun[]; error?: string };
}

// ── AI World emission (EPIC-012C) — NOTIFY (existing surface) ─────
export interface BridgeAiWorldPort {
  /** Emit a materially-relevant intelligence change into the EXISTING AI World surface (owner-scoped). */
  emit(
    userId: string,
    event: BridgeNotificationEvent,
  ): { emitted: boolean; reason?: string } | Promise<{ emitted: boolean; reason?: string }>;
  /** Unread AI World count for the bell (existing surface state). */
  unreadCount(userId: string): number | Promise<number>;
}

// ── Candidate + preference — REUSED from @vedmoulya/brain ─────────
export type { BrainCandidatePort, BrainPreferencePort };

// ── Stores (owner-scoped; synchronous in-memory convention) ───────
import type { BridgeLoopRun } from '../types/bridge-types.js';

export interface BridgeLoopStore {
  save(loop: BridgeLoopRun): void;
  get(userId: string, loopId: string): BridgeLoopRun | undefined;
  list(userId: string): BridgeLoopRun[];
}

// ── Option view helper (kept here for the assembler contract) ─────
export type { IntelligenceOption };
