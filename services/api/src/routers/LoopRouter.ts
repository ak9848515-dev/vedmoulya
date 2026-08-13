// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Orchestrated AI Loop Engine Router
// EPIC-006 — Phase 14. The typed orchestration contract:
//   loop.start       — understand + plan + bounded execution (background)
//   loop.status      — status + budget snapshot
//   loop.getTrace    — full explainable execution trace
//   loop.cancel      — abort a running loop (explicit CANCELLED reason)
//   loop.resume      — continue a suspended run with user clarification
//   loop.listRuns    — recent runs for the session user
//   loop.listPatterns— available controlled use-case templates
// Internal engine details (ports, execution internals) are never exposed —
// the LoopApplicationService DTOs are the boundary (Phase 14).
// ─────────────────────────────────────────────────────────────────────────────

import type { LoopApplicationService } from '@vedmoulya/loop-engine';
import type {
  LoopCancelResultDTO,
  LoopPatternDTO,
  LoopRunDTO,
  LoopRunSummaryDTO,
  LoopStartResultDTO,
  LoopStatusDTO,
} from '@vedmoulya/loop-engine';
import type { TRPCContext } from '../router.js';
import { successResponse, type ApiResponse } from '../services/ResponseMapper.js';

export interface LoopHandlers {
  /** Start a bounded orchestrated loop for a goal (returns immediately). */
  start: (
    input: {
      userId: string;
      goal: string;
      collection?: string;
      budgetOverride?: Parameters<LoopApplicationService['start']>[0]['budgetOverride'];
    },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<LoopStartResultDTO>>;
  /** Status + budget snapshot for one owned run. */
  status: (
    input: { userId: string; runId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<LoopStatusDTO>>;
  /** Full explainable execution trace for one owned run. */
  getTrace: (
    input: { userId: string; runId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<LoopRunDTO>>;
  /** Cancel a pending/running loop (explicit CANCELLED reason). */
  cancel: (
    input: { userId: string; runId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<LoopCancelResultDTO>>;
  /** Resume a suspended run with the user's clarification (bounded). */
  resume: (
    input: { userId: string; runId: string; clarification: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<LoopRunDTO>>;
  /** Recent loop runs for the session user. */
  listRuns: (
    input: { userId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<LoopRunSummaryDTO[]>>;
  /** Available controlled use-case templates. */
  listPatterns: (
    input: { userId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<LoopPatternDTO[]>>;
}

export function createLoopRouter(loop: LoopApplicationService): LoopHandlers {
  return {
    start: (input, _ctx) =>
      Promise.resolve(
        successResponse(
          loop.start({
            goal: input.goal,
            userId: input.userId,
            collection: input.collection,
            budgetOverride: input.budgetOverride,
          }),
        ),
      ),
    status: (input, _ctx) =>
      Promise.resolve(successResponse(loop.status(input.runId, input.userId))),
    getTrace: (input, _ctx) =>
      Promise.resolve(successResponse(loop.getTrace(input.runId, input.userId))),
    cancel: (input, _ctx) =>
      Promise.resolve(successResponse(loop.cancel(input.runId, input.userId))),
    resume: (input, _ctx) =>
      loop
        .resume(input.runId, input.userId, input.clarification)
        .then((run) => successResponse(run)),
    listRuns: (input, _ctx) => Promise.resolve(successResponse(loop.listRuns(input.userId))),
    listPatterns: (_input, _ctx) => Promise.resolve(successResponse(loop.listPatterns())),
  };
}
