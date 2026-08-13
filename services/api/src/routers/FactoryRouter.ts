// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: AI Application Factory Router
// EPIC-007 — Phase 20. The typed application-factory contract:
//   factory.create           — understand → specify → architect → plan (preview)
//   factory.approve          — user approves (or modifies) the plan (Phase 8)
//   factory.build            — generate → validate → critique → refine (bounded)
//   factory.status           — status + validation + economics snapshot
//   factory.getDetail        — full project (spec, files, ops, VCS history)
//   factory.deploy           — deploy with EXPLICIT authorization (Phase 16)
//   factory.list             — registered applications for the session user
//   factory.vcInit/vcBranch/vcCommit/vcDiff/vcPreparePullRequest — version
//                             control (Phase 15 — NEVER auto-pushes)
// Internal engine details (ports, execution internals) are never exposed —
// the FactoryApplicationService DTOs are the boundary (Phase 20).
// ─────────────────────────────────────────────────────────────────────────────

import type { FactoryApplicationService } from '@vedmoulya/app-factory';
import type {
  FactoryApproveResultDTO,
  FactoryApplicationDTO,
  FactoryBuildResultDTO,
  FactoryCreateResultDTO,
  FactoryDeployResultDTO,
  FactoryDetailDTO,
  FactoryLifecycleResultDTO,
} from '@vedmoulya/app-factory';
import type { DeploymentRequest } from '@vedmoulya/app-factory';
import type { ApplicationVersion } from '@vedmoulya/app-factory';
import type { TRPCContext } from '../router.js';
import { successResponse, type ApiResponse } from '../services/ResponseMapper.js';
import { PreviewService, type PreviewResult } from '../services/PreviewService.js';

export interface FactoryHandlers {
  /** Understand → specify → architect → plan. Returns the plan preview
   *  (Phase 8) — NO files are generated until the user approves. */
  create: (
    input: {
      userId: string;
      goal: string;
      budgetOverride?: Parameters<FactoryApplicationService['create']>[0]['budgetOverride'];
    },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<FactoryCreateResultDTO>>;
  /** User approves (or modifies) the plan → PLANNED. */
  approve: (
    input: { userId: string; applicationId: string; changes?: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<FactoryApproveResultDTO>>;
  /** Generate → validate → critique → refine in an isolated workspace.
   *  Bounded by the EPIC-006 loop budgets. Requires prior approval. */
  build: (
    input: {
      userId: string;
      applicationId: string;
      approved: boolean;
      grants?: Record<string, boolean>;
    },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<FactoryBuildResultDTO>>;
  /** Status + validation + economics snapshot for one owned application. */
  status: (
    input: { userId: string; applicationId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<FactoryApplicationDTO>>;
  /** Full project detail (spec, architecture, task graph, files, ops, VCS). */
  getDetail: (
    input: { userId: string; applicationId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<FactoryDetailDTO>>;
  /** EPIC-008 Phase 13 — sandboxed UI preview for one owned application.
   *  Pure derivation from the persisted project files (never faked). */
  preview: (
    input: { userId: string; applicationId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<PreviewResult>>;
  /** Deploy ONLY with explicit authorization (Phase 16). */
  deploy: (
    input: { userId: string; applicationId: string; request: DeploymentRequest },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<FactoryDeployResultDTO>>;
  /** Registered applications for the session user (Phase 13). */
  list: (
    input: { userId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<FactoryApplicationDTO[]>>;
  /** EPIC-008 Phase 1 — rename the application (recorded in history). */
  rename: (
    input: { userId: string; applicationId: string; name: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<FactoryLifecycleResultDTO>>;
  /** EPIC-008 Phase 1 — archive the application. */
  archive: (
    input: { userId: string; applicationId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<FactoryLifecycleResultDTO>>;
  /** EPIC-008 Phase 1 — delete per policy (explicit confirmation required). */
  delete: (
    input: { userId: string; applicationId: string; confirm: boolean },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<FactoryLifecycleResultDTO>>;
  /** EPIC-008 Phase 1 — resume an archived or failed application. */
  resume: (
    input: { userId: string; applicationId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<FactoryLifecycleResultDTO>>;
  /** EPIC-008 Phase 14 — recorded application version history. */
  history: (
    input: { userId: string; applicationId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<ApplicationVersion[]>>;
  /** Version control — initialize a repository (never auto-pushed). */
  vcInit: (
    input: { userId: string; applicationId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<{ ok: boolean; message: string }>>;
  /** Version control — create + checkout a branch. */
  vcBranch: (
    input: { userId: string; applicationId: string; name: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<{ ok: boolean; message: string }>>;
  /** Version control — commit files (validation happens before commit). */
  vcCommit: (
    input: { userId: string; applicationId: string; message: string; files: string[] },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<{ ok: boolean; message: string }>>;
  /** Version control — diff / change summary. */
  vcDiff: (
    input: { userId: string; applicationId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<{ ok: boolean; message: string; hunks: string[] }>>;
  /** Version control — prepare a pull-request draft (NEVER pushed). */
  vcPreparePullRequest: (
    input: { userId: string; applicationId: string; title: string },
    _ctx: TRPCContext,
  ) => Promise<
    ApiResponse<{
      ok: boolean;
      message: string;
      pullRequestDraft?: { title: string; body: string };
    }>
  >;
  /** Version control — operation history for one application. */
  vcHistory: (
    input: { userId: string; applicationId: string },
    _ctx: TRPCContext,
  ) => Promise<
    ApiResponse<
      Array<{ opId: string; type: string; detail: string; timestamp: string; pushed: boolean }>
    >
  >;
}

export function createFactoryRouter(
  factory: FactoryApplicationService,
  preview: PreviewService = new PreviewService(),
): FactoryHandlers {
  return {
    create: (input, _ctx) => factory.create(input).then((result) => successResponse(result)),
    approve: (input, _ctx) =>
      factory
        .approve(input.applicationId, input.userId, input.changes)
        .then((result) => successResponse(result)),
    build: (input, _ctx) =>
      factory
        .build({
          applicationId: input.applicationId,
          userId: input.userId,
          approved: input.approved,
          grants: input.grants,
        })
        .then((result) => successResponse(result)),
    status: (input, _ctx) =>
      factory.status(input.applicationId, input.userId).then((result) => successResponse(result)),
    getDetail: (input, _ctx) =>
      factory
        .getDetail(input.applicationId, input.userId)
        .then((result) => successResponse(result)),
    preview: async (input, _ctx): Promise<ApiResponse<PreviewResult>> => {
      const detail = await factory.getDetail(input.applicationId, input.userId);
      return successResponse(await preview.buildPreview(detail));
    },
    deploy: (input, _ctx) =>
      factory
        .deploy(input.applicationId, input.userId, input.request)
        .then((result) => successResponse(result)),
    list: (input, _ctx) => factory.list(input.userId).then((result) => successResponse(result)),
    rename: (input, _ctx) =>
      factory
        .rename(input.applicationId, input.userId, input.name)
        .then((result) => successResponse(result)),
    archive: (input, _ctx) =>
      factory.archive(input.applicationId, input.userId).then((result) => successResponse(result)),
    delete: (input, _ctx) =>
      factory
        .deleteApplication(input.applicationId, input.userId, input.confirm)
        .then((result) => successResponse(result)),
    resume: (input, _ctx) =>
      factory.resume(input.applicationId, input.userId).then((result) => successResponse(result)),
    history: (input, _ctx) =>
      factory.history(input.applicationId, input.userId).then((result) => successResponse(result)),
    vcInit: async (input, _ctx): Promise<ApiResponse<{ ok: boolean; message: string }>> => {
      const vc = await factory.versionControl(input.applicationId, input.userId);
      return successResponse(vc.init());
    },
    vcBranch: async (input, _ctx): Promise<ApiResponse<{ ok: boolean; message: string }>> => {
      const vc = await factory.versionControl(input.applicationId, input.userId);
      return successResponse(vc.branch(input.name));
    },
    vcCommit: async (input, _ctx): Promise<ApiResponse<{ ok: boolean; message: string }>> => {
      const vc = await factory.versionControl(input.applicationId, input.userId);
      return successResponse(vc.commit(input.message, input.files));
    },
    vcDiff: async (
      input,
      _ctx,
    ): Promise<ApiResponse<{ ok: boolean; message: string; hunks: string[] }>> => {
      const vc = await factory.versionControl(input.applicationId, input.userId);
      return successResponse(vc.diff());
    },
    vcPreparePullRequest: async (
      input,
      _ctx,
    ): Promise<
      ApiResponse<{
        ok: boolean;
        message: string;
        pullRequestDraft?: { title: string; body: string };
      }>
    > => {
      const vc = await factory.versionControl(input.applicationId, input.userId);
      return successResponse(vc.preparePullRequest(input.title));
    },
    vcHistory: async (
      input,
      _ctx,
    ): Promise<
      ApiResponse<
        Array<{ opId: string; type: string; detail: string; timestamp: string; pushed: boolean }>
      >
    > => {
      const vc = await factory.versionControl(input.applicationId, input.userId);
      return successResponse(vc.history());
    },
  };
}
