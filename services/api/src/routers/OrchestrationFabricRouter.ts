// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Orchestration Fabric Router
// SPRINT-093 — Exposes the orchestration fabric through tRPC
//
// Procedures:
//   orchestrationFabric.submitWork    — Submit a new work item
//   orchestrationFabric.getWorkItem   — Get a work item by ID
//   orchestrationFabric.cancelWork    — Cancel a work item and its dependents
//   orchestrationFabric.getQueueState — Current queue depth and stats
//   orchestrationFabric.getConcurrency — Active work items by policy
//   orchestrationFabric.getMetrics    — Full orchestrator metrics
//   orchestrationFabric.getEvents     — Recent orchestration events
// ─────────────────────────────────────────────────────────────────────────────

import type { OrchestratorService } from '@vedmoulya/orchestration-fabric';
import type { WorkType, WorkPriority } from '@vedmoulya/orchestration-fabric';
import type { TRPCContext } from '../router.js';

// ── Router Factory ─────────────────────────────────────────────────────

export function createFabricOrchestratorRouter(orchestrator: OrchestratorService) {
  return {
    /**
     * Submit a new work item to the orchestrator.
     */
    submitWork: (
      input: {
        userId: string;
        workType: string;
        priority?: string;
        description: string;
        dependencies?: string[];
        requiresDatabase?: boolean;
        resourceProfile?: string;
        aiCapability?: string;
        idempotencyKey?: string;
      },
      _ctx: TRPCContext,
    ) => {
      const result = orchestrator.submitWork({
        workType: input.workType as WorkType,
        priority: (input.priority ?? 'user_submitted') as WorkPriority,
        description: input.description,
        ownerUserId: input.userId,
        dependencies: input.dependencies,
        idempotencyKey: input.idempotencyKey,
        resources: {
          requiresDatabase: input.requiresDatabase ?? false,
          resourceProfile: (input.resourceProfile ?? 'ai_bound') as 'ai_bound',
          timeoutMs: 30000,
          aiCapability: input.aiCapability,
        },
      });

      if (!result) {
        return { success: false, error: 'Work item rejected by backpressure' };
      }

      return {
        success: true,
        data: {
          id: result.id,
          status: result.status,
          priority: result.priority,
          workType: result.workType,
          description: result.description,
          createdAt: result.createdAt,
        },
      };
    },

    /**
     * Get a work item by ID (owner-scoped).
     */
    getWorkItem: (input: { userId: string; workItemId: string }, _ctx: TRPCContext) => {
      const item = orchestrator.getWorkItem(input.workItemId);
      if (!item) {
        return { success: false, error: 'Work item not found' };
      }
      if (item.ownerUserId !== input.userId) {
        return { success: false, error: 'Access denied' };
      }
      return { success: true, data: item };
    },

    /**
     * Cancel a work item (owner-scoped).
     */
    cancelWork: (
      input: { userId: string; workItemId: string; reason: string },
      _ctx: TRPCContext,
    ) => {
      const item = orchestrator.getWorkItem(input.workItemId);
      if (!item) {
        return { success: false, error: 'Work item not found' };
      }
      if (item.ownerUserId !== input.userId) {
        return { success: false, error: 'Access denied' };
      }
      const cancelled = orchestrator.cancelWork(input.workItemId, input.userId, input.reason);
      return { success: cancelled };
    },

    /**
     * Get the current queue state.
     */
    getQueueState: (_input: { userId: string }, _ctx: TRPCContext) => {
      return { success: true, data: orchestrator.getQueueState() };
    },

    /**
     * Get the concurrency snapshot.
     */
    getConcurrency: (_input: { userId: string }, _ctx: TRPCContext) => {
      return { success: true, data: orchestrator.getConcurrencySnapshot() };
    },

    /**
     * Get full orchestrator metrics.
     */
    getMetrics: (_input: { userId: string }, _ctx: TRPCContext) => {
      return { success: true, data: orchestrator.getMetrics() };
    },

    /**
     * Get recent orchestration events.
     */
    getEvents: (input: { userId: string; limit?: number }, _ctx: TRPCContext) => {
      const events = orchestrator.getEvents(input.limit ?? 50);
      return { success: true, data: events };
    },
  };
}
