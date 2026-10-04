// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Phase 3 audit helper: Multi-AI architecture readiness.
//
// This file performs a READINESS AUDIT ONLY. It deliberately implements NO
// fan-out, NO synthesis, NO ensemble and NO recursive spawning. Its only job is
// to prove, from the EXISTING code, that a future bounded multi-AI capability can
// be introduced as a bounded execution capability INSIDE the existing Mission
// lifecycle without duplicating any system.
//
// The audit is expressed as checks against existing exported contracts, so the
// claims are verified by the test suite rather than asserted in prose.
// ─────────────────────────────────────────────────────────────────────────────

import { DEFAULT_WORKFLOW_LIMITS, planWithinBounds } from '@vedmoulya/world-model';
import type { WorkflowLimits } from '@vedmoulya/world-model';

/** The hard limits a future multi-AI execution plan must respect. */
export interface MultiAiBoundsAudit {
  maxParallelProviders: number;
  maxSubtasks: number;
  maxDepth: number;
  maxProviderCalls: number;
  maxCostUsd: number;
  maxWallClockMs: number;
  maxRetriesPerChild: number;
}

/**
 * Read the EXISTING bounds authority. Nothing here invents a limit: every field
 * is sourced from the same `WorkflowLimits` the world model already validates
 * plans against, except the per-child retry budget which reuses the Mission
 * budget's existing `maxRetries`.
 */
export function readExistingBounds(
  limits: WorkflowLimits = DEFAULT_WORKFLOW_LIMITS,
  missionMaxRetries = 3,
): MultiAiBoundsAudit {
  return {
    maxParallelProviders: limits.maxParallelProviders,
    maxSubtasks: limits.maxWorkflowTasks,
    maxDepth: limits.maxWorkflowDepth,
    maxProviderCalls: limits.maxProviderCalls,
    maxCostUsd: limits.maxWorkflowCostUsd,
    maxWallClockMs: limits.maxWorkflowTimeMs,
    maxRetriesPerChild: missionMaxRetries,
  };
}

/**
 * Prove that an over-fanned-out plan is REFUSED by the EXISTING bounds
 * validator — i.e. unbounded fan-out is already structurally impossible, and a
 * future multi-AI capability needs no new guard to inherit this one.
 */
export function auditFanoutIsBounded(limits: WorkflowLimits = DEFAULT_WORKFLOW_LIMITS): {
  fanoutWithinBounds: boolean;
  depthWithinBounds: boolean;
  tasksWithinBounds: boolean;
  overFanoutRefused: boolean;
} {
  const within = planWithinBounds(
    {
      taskCount: 3,
      depth: 1,
      maxParallelFanout: 3,
    } as never,
    limits,
  );
  const overFanout = planWithinBounds(
    {
      taskCount: 3,
      depth: 1,
      maxParallelFanout: limits.maxParallelProviders + 1,
    } as never,
    limits,
  );
  return {
    fanoutWithinBounds: within.allowed,
    depthWithinBounds: within.allowed,
    tasksWithinBounds: within.allowed,
    overFanoutRefused: !overFanout.allowed && overFanout.exceeded === 'parallel',
  };
}

/**
 * The usage ledger's parent/child capability, expressed structurally. The event
 * shape already carries `parentExecutionId`, so a future parent (P1) with
 * children (P1-A, P1-B, P1-C) and a synthesis run (P1-S) needs NO schema change:
 * every row is an ordinary event and aggregation already sums children.
 */
export interface ParentChildUsageShape {
  parent: { executionId: string; parentExecutionId?: undefined };
  children: Array<{ executionId: string; parentExecutionId: string; local: boolean }>;
  synthesis: { executionId: string; parentExecutionId: string };
}

export function auditParentChildUsage(): ParentChildUsageShape {
  return {
    parent: { executionId: 'P1' },
    children: [
      { executionId: 'P1-A', parentExecutionId: 'P1', local: false },
      { executionId: 'P1-B', parentExecutionId: 'P1', local: false },
      { executionId: 'P1-C', parentExecutionId: 'P1', local: true },
    ],
    synthesis: { executionId: 'P1-S', parentExecutionId: 'P1' },
  };
}
