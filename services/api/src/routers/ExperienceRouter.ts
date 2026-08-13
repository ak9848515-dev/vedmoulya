// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Adaptive Application Experience & Visual Intelligence
// EPIC-010. The typed experience.* contract:
//   experience.evaluate — design system + UI blueprint + design decisions +
//                         visual critic + multi-dimensional quality +
//                         traceability for a persisted generated application
//   experience.findings — evidence-classified critic findings (Phase 10)
//   experience.refine   — targeted refinement plan (Phase 12/13: change
//                         impact, only affected files, never regenerate-all)
// Every procedure is owner-scoped: the router resolves the persisted
// application through factory.getDetail, which enforces ownership (IDOR
// refused at the factory engine — the same boundary handoffToFactory uses).
// Authenticated + rate-limited by the RouterRegistry middleware.
// ─────────────────────────────────────────────────────────────────────────────

import type { ExperienceApplicationService } from '@vedmoulya/experience';
import type {
  ExperienceEvaluateDTO,
  ExperienceFindingsDTO,
  ExperienceRefineDTO,
} from '@vedmoulya/experience';
import type { FactoryApplicationService } from '@vedmoulya/app-factory';
import type { TRPCContext } from '../router.js';
import { successResponse, type ApiResponse } from '../services/ResponseMapper.js';

export interface ExperienceHandlers {
  evaluate: (
    input: { userId: string; applicationId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<ExperienceEvaluateDTO>>;
  /** EPIC-010 Phase 8/11 optional seam: evaluate WITH a live AI critique. */
  evaluateWithAI: (
    input: { userId: string; applicationId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<ExperienceEvaluateDTO>>;
  findings: (
    input: { userId: string; applicationId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<ExperienceFindingsDTO>>;
  refine: (
    input: { userId: string; applicationId: string; findingId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<ExperienceRefineDTO>>;
}

export function createExperienceRouter(
  experience: ExperienceApplicationService,
  factory: FactoryApplicationService,
): ExperienceHandlers {
  return {
    evaluate: async (input, _ctx): Promise<ApiResponse<ExperienceEvaluateDTO>> => {
      const detail = await factory.getDetail(input.applicationId, input.userId);
      const result = experience.evaluate({
        applicationId: input.applicationId,
        archetype: detail.archetype,
        files: detail.files.map((f) => ({ path: f.path, content: f.content })),
        securityFindings: detail.securityReport?.findings.map((f) => ({
          severity: f.severity,
          description: f.description,
          filePath: f.filePath,
        })),
        validationEvidence: detail.lastValidation?.gates.map((g) => ({
          gate: g.gate,
          passed: g.passed,
          detail: g.findings.join('; '),
        })),
      });
      return successResponse(result);
    },
    evaluateWithAI: async (input, ctx): Promise<ApiResponse<ExperienceEvaluateDTO>> => {
      const detail = await factory.getDetail(input.applicationId, input.userId);
      const result = await experience.evaluateWithAI({
        // The AUTHENTICATED user from the request context — the AI runtime's
        // per-user rate limit/cache/audit scoping must key off the real user,
        // never the application id.
        userId: ctx.userId,
        applicationId: input.applicationId,
        archetype: detail.archetype,
        files: detail.files.map((f) => ({ path: f.path, content: f.content })),
        securityFindings: detail.securityReport?.findings.map((f) => ({
          severity: f.severity,
          description: f.description,
          filePath: f.filePath,
        })),
        validationEvidence: detail.lastValidation?.gates.map((g) => ({
          gate: g.gate,
          passed: g.passed,
          detail: g.findings.join('; '),
        })),
      });
      return successResponse(result);
    },
    findings: async (input, _ctx): Promise<ApiResponse<ExperienceFindingsDTO>> => {
      const detail = await factory.getDetail(input.applicationId, input.userId);
      const result = experience.findings({
        applicationId: input.applicationId,
        archetype: detail.archetype,
        files: detail.files.map((f) => ({ path: f.path, content: f.content })),
        securityFindings: detail.securityReport?.findings.map((f) => ({
          severity: f.severity,
          description: f.description,
          filePath: f.filePath,
        })),
        validationEvidence: detail.lastValidation?.gates.map((g) => ({
          gate: g.gate,
          passed: g.passed,
          detail: g.findings.join('; '),
        })),
      });
      return successResponse(result);
    },
    refine: async (input, _ctx): Promise<ApiResponse<ExperienceRefineDTO>> => {
      const detail = await factory.getDetail(input.applicationId, input.userId);
      const result = experience.refine({
        applicationId: input.applicationId,
        archetype: detail.archetype,
        findingId: input.findingId,
        files: detail.files.map((f) => ({ path: f.path, content: f.content })),
      });
      return successResponse(result);
    },
  };
}
