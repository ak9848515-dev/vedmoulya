// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Product Intelligence & Requirements Router
// EPIC-009. The typed requirements.* contract:
//   requirements.start            — understand → extract → analyze →
//                                   questions + defaults (no build)
//   requirements.answer           — user answers (bundled) → re-derive
//   requirements.acceptAllDefaults / decideDefault — defaults (Phase 9)
//   requirements.resolveConflict  — explicit conflict resolution (Phase 11)
//   requirements.plan             — full product plan (Phases 12–25)
//   requirements.approve          — Phase 23 approval gate → handoff goal
//   requirements.reject           — user cancels
//   requirements.handoffToFactory — APPROVED session → factory.create
//   requirements.changeImpact     — Phase 24 mandatory impact analysis
//   requirements.get / list / delete — owner-scoped session management
// Every procedure is owner-scoped (IDOR enforced at the engine layer) and
// authenticated + rate-limited by the RouterRegistry middleware.
// ─────────────────────────────────────────────────────────────────────────────

import type { RequirementsApplicationService } from '@vedmoulya/requirements';
import type {
  ChangeImpact,
  RequirementsApproveDTO,
  RequirementsHandoffDTO,
  RequirementsSessionDTO,
  RequirementsSessionSummaryDTO,
  RequirementsStartDTO,
} from '@vedmoulya/requirements';
import type { FactoryApplicationService } from '@vedmoulya/app-factory';
import type { FactoryCreateResultDTO } from '@vedmoulya/app-factory';
import type { SafeDefaultStatus } from '@vedmoulya/requirements';
import type { TRPCContext } from '../router.js';
import { successResponse, type ApiResponse } from '../services/ResponseMapper.js';

export interface RequirementsHandlers {
  start: (
    input: { userId: string; idea: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<RequirementsStartDTO>>;
  get: (
    input: { userId: string; sessionId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<RequirementsSessionDTO>>;
  list: (
    input: { userId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<RequirementsSessionSummaryDTO[]>>;
  delete: (
    input: { userId: string; sessionId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<{ deleted: boolean }>>;
  answer: (
    input: {
      userId: string;
      sessionId: string;
      answers: Array<{ questionId: string; answer: string }>;
    },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<RequirementsSessionDTO>>;
  acceptAllDefaults: (
    input: { userId: string; sessionId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<RequirementsSessionDTO>>;
  decideDefault: (
    input: {
      userId: string;
      sessionId: string;
      defaultId: string;
      decision: SafeDefaultStatus;
      editedValue?: string;
    },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<RequirementsSessionDTO>>;
  resolveConflict: (
    input: { userId: string; sessionId: string; conflictId: string; choice: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<RequirementsSessionDTO>>;
  plan: (
    input: { userId: string; sessionId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<RequirementsSessionDTO>>;
  approve: (
    input: { userId: string; sessionId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<RequirementsApproveDTO>>;
  reject: (
    input: { userId: string; sessionId: string; reason?: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<RequirementsSessionDTO>>;
  handoffGoal: (
    input: { userId: string; sessionId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<RequirementsHandoffDTO>>;
  /** APPROVED session → factory.create (the EPIC-009 → factory handoff). */
  handoffToFactory: (
    input: { userId: string; sessionId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<FactoryCreateResultDTO>>;
  changeImpact: (
    input: { userId: string; sessionId: string; request: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<ChangeImpact>>;
}

export function createRequirementsRouter(
  requirements: RequirementsApplicationService,
  factory?: FactoryApplicationService,
): RequirementsHandlers {
  return {
    start: (input, _ctx) =>
      requirements
        .start({ idea: input.idea, userId: input.userId })
        .then((r) => successResponse(r)),
    get: (input, _ctx) =>
      requirements.get(input.sessionId, input.userId).then((r) => successResponse(r)),
    list: (input, _ctx) => requirements.list(input.userId).then((r) => successResponse(r)),
    delete: (input, _ctx) =>
      requirements.deleteSession(input.sessionId, input.userId).then((r) => successResponse(r)),
    answer: (input, _ctx) => requirements.answer(input).then((r) => successResponse(r)),
    acceptAllDefaults: (input, _ctx) =>
      requirements.acceptAllDefaults(input.sessionId, input.userId).then((r) => successResponse(r)),
    decideDefault: (input, _ctx) =>
      requirements
        .decideDefault(
          input.sessionId,
          input.userId,
          input.defaultId,
          input.decision,
          input.editedValue,
        )
        .then((r) => successResponse(r)),
    resolveConflict: (input, _ctx) =>
      requirements
        .resolveConflict(input.sessionId, input.userId, input.conflictId, input.choice)
        .then((r) => successResponse(r)),
    plan: (input, _ctx) =>
      requirements.plan(input.sessionId, input.userId).then((r) => successResponse(r)),
    approve: (input, _ctx) =>
      requirements.approve(input.sessionId, input.userId).then((r) => successResponse(r)),
    reject: (input, _ctx) =>
      requirements
        .reject(input.sessionId, input.userId, input.reason)
        .then((r) => successResponse(r)),
    handoffGoal: (input, _ctx) =>
      requirements.handoffGoal(input.sessionId, input.userId).then((r) => successResponse(r)),
    handoffToFactory: async (input, _ctx): Promise<ApiResponse<FactoryCreateResultDTO>> => {
      if (!factory) {
        throw new Error('the application factory is not available for handoff');
      }
      const handoff = await requirements.handoffGoal(input.sessionId, input.userId);
      const created = await factory.create({
        goal: handoff.goal,
        userId: input.userId,
      });
      return successResponse(created);
    },
    changeImpact: (input, _ctx) =>
      requirements
        .changeImpact(input.sessionId, input.userId, input.request)
        .then((r) => successResponse(r)),
  };
}
