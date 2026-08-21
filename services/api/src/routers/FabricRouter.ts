// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Intelligence Fabric Router
// SPRINT-030 — fabric.* procedures (composition over the frozen estate).
//
//   fabric.getProviderHealth   — observed runtime health (UNKNOWN until observed).
//   fabric.allProviderHealth   — all observed provider health snapshots.
//   fabric.observeOutcome      — record ONE real call outcome (health + audit).
//   fabric.checkCostPolicy     — fail-closed cost caps vs recorded spend.
//   fabric.classifyAutonomy    — autonomy-level gate over the existing A/B/C/D.
//   fabric.selectStrategy      — ADVISORY provider ranking (CHEAP/FAST/QUALITY/
//                                PRIVATE/BALANCED) — never actual routing.
//   fabric.validateWorkflow    — bounded orchestration limits (no fan-out).
//   fabric.evaluateVerificationChain — bounded A→critique→verify verdict.
//
// Every procedure is authenticated + rate-limited + owner-checked by the
// central middleware. The fabric owns no authority.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';
import type { IntelligenceFabricService } from '@vedmoulya/intelligence-fabric';
import type { TRPCContext } from '../services/RouterRegistry.js';
import type { ApiResponse } from '../services/ResponseMapper.js';
import { successResponse } from '../services/ResponseMapper.js';

export interface FabricHandlers {
  getProviderHealth: (
    input: { userId: string; providerId: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  allProviderHealth: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  observeOutcome: (
    input: {
      userId: string;
      providerId: string;
      kind: 'success' | 'failure' | 'timeout' | 'quota_exhausted' | 'config_error';
      latencyMs?: number;
      errorCode?: string;
    },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  checkCostPolicy: (
    input: { userId: string; additionalUsd?: number; providerId?: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  classifyAutonomy: (
    input: { userId: string; currentLevel: number; action: string; userAuthorizationId?: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  selectStrategy: (
    input: {
      userId: string;
      strategy: 'CHEAP' | 'FAST' | 'QUALITY' | 'PRIVATE' | 'BALANCED';
      taskPrivacy: 'PUBLIC' | 'INTERNAL' | 'SENSITIVE' | 'PRIVATE';
      capability: string;
    },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  validateWorkflow: (
    input: {
      userId: string;
      taskCount: number;
      depth: number;
      maxParallelFanout: number;
      estimatedProviderCalls: number;
      estimatedCostUsd?: number;
      estimatedTimeMs?: number;
    },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  evaluateVerificationChain: (
    input: {
      userId: string;
      answer: { providerId: string; verdict: 'AGREE' | 'CONTRADICT' | 'UNKNOWN'; note: string };
      critique?: { providerId: string; verdict: 'AGREE' | 'CONTRADICT' | 'UNKNOWN'; note: string };
      verify?: { providerId: string; verdict: 'AGREE' | 'CONTRADICT' | 'UNKNOWN'; note: string };
      costUsd?: number;
      timeMs?: number;
    },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
}

export const fabricInputs = {
  getProviderHealth: z.object({ userId: z.string().min(1), providerId: z.string().min(1) }),
  allProviderHealth: z.object({ userId: z.string().min(1) }),
  observeOutcome: z.object({
    userId: z.string().min(1),
    providerId: z.string().min(1).max(120),
    kind: z.enum(['success', 'failure', 'timeout', 'quota_exhausted', 'config_error']),
    latencyMs: z.number().int().min(0).max(3_600_000).optional(),
    errorCode: z.string().max(120).optional(),
  }),
  checkCostPolicy: z.object({
    userId: z.string().min(1),
    additionalUsd: z.number().min(0).max(10_000).optional(),
    providerId: z.string().max(120).optional(),
  }),
  classifyAutonomy: z.object({
    userId: z.string().min(1),
    currentLevel: z.number().int().min(0).max(5),
    action: z.string().min(1).max(300),
    userAuthorizationId: z.string().max(120).optional(),
  }),
  selectStrategy: z.object({
    userId: z.string().min(1),
    strategy: z.enum(['CHEAP', 'FAST', 'QUALITY', 'PRIVATE', 'BALANCED']),
    taskPrivacy: z.enum(['PUBLIC', 'INTERNAL', 'SENSITIVE', 'PRIVATE']),
    capability: z.string().min(1).max(120),
  }),
  validateWorkflow: z.object({
    userId: z.string().min(1),
    taskCount: z.number().int().min(0).max(1000),
    depth: z.number().int().min(0).max(100),
    maxParallelFanout: z.number().int().min(0).max(100),
    estimatedProviderCalls: z.number().int().min(0).max(10_000),
    estimatedCostUsd: z.number().min(0).max(100_000).optional(),
    estimatedTimeMs: z.number().int().min(0).max(86_400_000).optional(),
  }),
  evaluateVerificationChain: z.object({
    userId: z.string().min(1),
    answer: z.object({
      providerId: z.string().min(1),
      verdict: z.enum(['AGREE', 'CONTRADICT', 'UNKNOWN']),
      note: z.string().max(400),
    }),
    critique: z
      .object({
        providerId: z.string().min(1),
        verdict: z.enum(['AGREE', 'CONTRADICT', 'UNKNOWN']),
        note: z.string().max(400),
      })
      .optional(),
    verify: z
      .object({
        providerId: z.string().min(1),
        verdict: z.enum(['AGREE', 'CONTRADICT', 'UNKNOWN']),
        note: z.string().max(400),
      })
      .optional(),
    costUsd: z.number().min(0).max(100_000).optional(),
    timeMs: z.number().int().min(0).max(86_400_000).optional(),
  }),
};

export function createFabricRouter(service: IntelligenceFabricService): FabricHandlers {
  return {
    getProviderHealth: async (input): Promise<ApiResponse> =>
      Promise.resolve(successResponse(service.providerHealth(input.providerId))),

    allProviderHealth: async (): Promise<ApiResponse> =>
      Promise.resolve(successResponse(service.allProviderHealth())),

    observeOutcome: async (input): Promise<ApiResponse> => {
      const health = service.observeHealth({
        providerId: input.providerId,
        ownerId: input.userId,
        kind: input.kind,
        latencyMs: input.latencyMs,
        errorCode: input.errorCode,
        at: new Date().toISOString(),
      });
      return Promise.resolve(successResponse(health));
    },

    checkCostPolicy: async (input): Promise<ApiResponse> =>
      Promise.resolve(
        successResponse(
          service.checkCost({
            additionalUsd: input.additionalUsd,
            providerId: input.providerId,
            ownerId: input.userId,
          }),
        ),
      ),

    classifyAutonomy: async (input): Promise<ApiResponse> =>
      Promise.resolve(
        successResponse(
          service.gateAutonomy({
            currentLevel: input.currentLevel as 0 | 1 | 2 | 3 | 4 | 5,
            action: input.action,
            userAuthorization: input.userAuthorizationId
              ? {
                  id: input.userAuthorizationId,
                  grantedAt: new Date().toISOString(),
                  scope: input.action,
                }
              : undefined,
          }),
        ),
      ),

    selectStrategy: async (input): Promise<ApiResponse> => {
      const selection = await service.select({
        strategy: input.strategy,
        taskPrivacy: input.taskPrivacy,
        capability: input.capability,
      });
      return Promise.resolve(successResponse(selection));
    },

    validateWorkflow: async (input): Promise<ApiResponse> =>
      Promise.resolve(
        successResponse(
          service.validateWorkflow({
            taskCount: input.taskCount,
            depth: input.depth,
            maxParallelFanout: input.maxParallelFanout,
            estimatedProviderCalls: input.estimatedProviderCalls,
            estimatedCostUsd: input.estimatedCostUsd,
            estimatedTimeMs: input.estimatedTimeMs,
          }),
        ),
      ),

    evaluateVerificationChain: async (input): Promise<ApiResponse> =>
      Promise.resolve(
        successResponse(
          service.evaluateVerificationChain({
            answer: input.answer,
            critique: input.critique,
            verify: input.verify,
            costUsd: input.costUsd,
            timeMs: input.timeMs,
          }),
        ),
      ),
  };
}
