// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Application Service
// EPIC-007 — Phase 20. The factory.* execution contract:
//   factory.create     — understand → specify → architect → plan
//   factory.approve    — user approves (or modifies) the plan
//   factory.build      — generate → validate → critique → refine (bounded)
//   factory.status     — status + validation + economics snapshot
//   factory.getDetail  — full project (files, ops, vcs history)
//   factory.deploy     — deploy with EXPLICIT authorization
//   factory.versionControl — init/branch/commit/diff/prepare-PR
//   factory.list       — registered applications for the session user
// EPIC-008 — Phase 1 lifecycle: rename / archive / delete (policy) /
//   resume + Phase 14 version history. Every method is owner-scoped
//   (IDOR enforced at the engine layer, never only in the UI).
// Internal engine details are never exposed (DTO boundary).
// ──────────────────────────────────────────────────────────────────

import { NotFoundError, NOOP_TELEMETRY, normalizeTraceStatus } from '@vedmoulya/core';
import type { TelemetryPort, TraceStatus } from '@vedmoulya/core';
import type { FactoryEnginePorts } from '../contracts/factory-ports.js';
import { FactoryEngine } from '../domain/FactoryEngine.js';
import type {
  AppProject,
  ApplicationStatus,
  ApplicationVersion,
  ExecutionPolicy,
} from '../types/app-types.js';
import { FactoryMapper } from './FactoryMapper.js';
import type {
  FactoryApproveResultDTO,
  FactoryApplicationDTO,
  FactoryBuildResultDTO,
  FactoryCreateResultDTO,
  FactoryDeployResultDTO,
  FactoryDetailDTO,
} from './FactoryDTO.js';
import type { DeploymentRequest, FileOperation } from '../types/app-types.js';

export interface FactoryApplicationServiceOptions extends FactoryEnginePorts {
  /** Default execution policy for every file operation (Phase 9). */
  defaultPolicy?: ExecutionPolicy;
  /** Phase 14: per-application isolated workspace factory. */
  workspaceFactory?: (
    applicationId: string,
    policy: ExecutionPolicy,
  ) => FactoryEnginePorts['workspace'];
  /**
   * EPIC-012 — optional telemetry port. When provided, factory lifecycle
   * operations emit correlated spans (factory.create/approve/build/deploy)
   * carrying validation, security, quality and economics attributes.
   * Defaults to a zero-overhead NOOP.
   */
  telemetry?: TelemetryPort;
}

export interface FactoryCreateInput {
  goal: string;
  userId: string;
  budgetOverride?: Record<string, unknown>;
}

/** Result of an EPIC-008 lifecycle mutation (rename/archive/delete/resume). */
export interface FactoryLifecycleResultDTO {
  applicationId: string;
  status?: ApplicationStatus;
  name?: string;
  deleted?: boolean;
  message?: string;
}

export class FactoryApplicationService {
  private readonly engine: FactoryEngine;
  private readonly telemetry: TelemetryPort;

  constructor(options: FactoryApplicationServiceOptions) {
    const { defaultPolicy, workspaceFactory, telemetry, ...ports } = options;
    this.telemetry = telemetry ?? NOOP_TELEMETRY;
    this.engine = new FactoryEngine({
      ...ports,
      defaultPolicy,
      workspaceFactory,
    });
  }

  /** Map a factory project onto the trace status vocabulary. */
  private static traceStatusOf(project: AppProject): TraceStatus {
    if (project.status === 'FAILED') {
      return project.terminationReason ? normalizeTraceStatus(project.terminationReason) : 'FAILED';
    }
    if (project.securityReport?.blocked) return 'SECURITY_BLOCK';
    if (project.lastValidation?.overall === 'FAIL') return 'VALIDATION_FAILURE';
    if (project.status === 'READY' || project.status === 'DEPLOYED') return 'OK';
    return 'OK';
  }

  async create(input: FactoryCreateInput): Promise<FactoryCreateResultDTO> {
    const project = await this.telemetry.withSpan(
      {
        name: 'factory.create',
        kind: 'engine',
        userId: input.userId,
        attributes: { goal: input.goal.slice(0, 160) },
      },
      async (span) => {
        const created = await this.engine.create({
          goal: input.goal,
          owner: input.userId,
          budgetOverride: input.budgetOverride,
        });
        span.setAttribute('application_id', created.applicationId);
        span.setAttribute('archetype', created.archetype);
        return created;
      },
    );
    return FactoryMapper.toCreateResult(project);
  }

  async approve(
    applicationId: string,
    userId: string,
    changes?: string,
  ): Promise<FactoryApproveResultDTO> {
    const project = await this.telemetry.withSpan(
      {
        name: 'factory.approve',
        kind: 'engine',
        applicationId,
        userId,
        attributes: { changes: (changes ?? '').slice(0, 120) },
      },
      async (span) => {
        const approved = await this.engine.approve(applicationId, userId, changes);
        span.setAttribute('status', approved.status);
        return approved;
      },
    );
    return { applicationId, status: project.status, approvedAt: project.planPreview?.approvedAt };
  }

  async build(input: {
    applicationId: string;
    userId: string;
    approved: boolean;
    grants?: Partial<Record<FileOperation['actionClass'], boolean>>;
    generate?: boolean;
  }): Promise<FactoryBuildResultDTO> {
    const project = await this.telemetry.withSpan(
      {
        name: 'factory.build',
        kind: 'engine',
        applicationId: input.applicationId,
        userId: input.userId,
        attributes: { approved: input.approved },
      },
      async (span) => {
        const built = await this.engine.build({
          applicationId: input.applicationId,
          owner: input.userId,
          approved: input.approved,
          grants: input.grants,
          generate: input.generate,
        });
        span.setAttribute('status', built.status);
        span.setAttribute('termination_reason', built.terminationReason ?? built.status);
        span.setAttribute('repair_attempts', built.repairAttempts?.length ?? 0);
        span.setAttribute('repair_limit_reached', built.repairLimitReached ?? false);
        if (built.lastValidation) {
          span.setAttribute('validation', built.lastValidation.overall);
          span.setAttribute(
            'gates_passed',
            built.lastValidation.gates.filter((g) => g.passed).length,
          );
        }
        if (built.securityReport) {
          span.setAttribute('security_blocked', built.securityReport.blocked);
          span.setAttribute('security_critical', built.securityReport.summary.critical);
          span.setAttribute('security_high', built.securityReport.summary.high);
        }
        if (built.uiQuality) {
          span.setAttribute('ui_quality_score', built.uiQuality.score);
          span.setAttribute('ui_quality_verdict', built.uiQuality.verdict);
        }
        if (built.economics) {
          span.setAttribute('tokens_total', built.economics.totalTokens);
          span.setAttribute('cost_usd', built.economics.estimatedCostUsd);
          span.setAttribute('ai_calls', built.economics.aiCalls);
          span.setAttribute('cache_hits', built.economics.cacheHits);
        }
        span.end(FactoryApplicationService.traceStatusOf(built));
        return built;
      },
    );
    return {
      applicationId: project.applicationId,
      status: project.status,
      validation: project.lastValidation,
      security: project.securityReport,
      uiQuality: project.uiQuality,
      economics: project.economics,
      terminationReason: project.terminationReason,
      error: project.error,
    };
  }

  async status(applicationId: string, userId: string): Promise<FactoryApplicationDTO> {
    return FactoryMapper.toApplicationDTO(await this.getOwned(applicationId, userId));
  }

  async getDetail(applicationId: string, userId: string): Promise<FactoryDetailDTO> {
    return FactoryMapper.toDetailDTO(await this.getOwned(applicationId, userId));
  }

  async deploy(
    applicationId: string,
    userId: string,
    request: DeploymentRequest,
  ): Promise<FactoryDeployResultDTO> {
    const result = await this.telemetry.withSpan(
      {
        name: 'factory.deploy',
        kind: 'engine',
        applicationId,
        userId,
        attributes: { target: request.target, authorized: request.authorized },
      },
      async (span) => {
        const deployed = await this.engine.deploy(applicationId, userId, request);
        span.setAttribute('status', deployed.status);
        span.end(
          deployed.status === 'deployed' ? 'OK' : deployed.status === 'failed' ? 'FAILED' : 'OK',
        );
        return deployed;
      },
    );
    return { ...result, applicationId };
  }

  async list(userId: string): Promise<FactoryApplicationDTO[]> {
    const projects = await this.engine.list(userId);
    return projects.map((project) => FactoryMapper.toApplicationDTO(project));
  }

  // ── EPIC-008 Phase 1 lifecycle ─────────────────────────────────────────────

  async rename(
    applicationId: string,
    userId: string,
    name: string,
  ): Promise<FactoryLifecycleResultDTO> {
    return this.engine.rename(applicationId, userId, name);
  }

  async archive(applicationId: string, userId: string): Promise<FactoryLifecycleResultDTO> {
    return this.engine.archive(applicationId, userId);
  }

  async deleteApplication(
    applicationId: string,
    userId: string,
    confirm: boolean,
  ): Promise<FactoryLifecycleResultDTO> {
    return this.engine.deleteApplication(applicationId, userId, confirm);
  }

  async resume(applicationId: string, userId: string): Promise<FactoryLifecycleResultDTO> {
    return this.telemetry.withSpan(
      {
        name: 'factory.resume',
        kind: 'engine',
        applicationId,
        userId,
      },
      async (span) => {
        const resumed = await this.engine.resume(applicationId, userId);
        span.setAttribute('status', resumed.status);
        return resumed;
      },
    );
  }

  /** Phase 14 — recorded application states for the History view. */
  async history(applicationId: string, userId: string): Promise<ApplicationVersion[]> {
    return this.engine.history(applicationId, userId);
  }

  /** Version control operations (never auto-pushed). */
  async versionControl(
    applicationId: string,
    userId: string,
  ): Promise<{
    init(): { ok: boolean; message: string };
    branch(name: string): { ok: boolean; message: string };
    commit(message: string, files: string[]): { ok: boolean; message: string };
    diff(): { ok: boolean; message: string; hunks: string[] };
    preparePullRequest(title: string): {
      ok: boolean;
      message: string;
      pullRequestDraft?: { title: string; body: string };
    };
    history(): Array<{
      opId: string;
      type: string;
      detail: string;
      timestamp: string;
      pushed: boolean;
    }>;
  }> {
    const project = await this.getOwned(applicationId, userId);
    const service = await this.engine.versionControl(applicationId, userId);
    return {
      init: () => service.init(project.repositoryPath),
      branch: (name: string) => service.branch(project.repositoryPath, name),
      commit: (message: string, files: string[]) =>
        service.commit(project.repositoryPath, message, files),
      diff: () => service.diff(project.repositoryPath),
      preparePullRequest: (title: string) =>
        service.preparePullRequest(project.repositoryPath, title),
      history: () => service.history(),
    };
  }

  private async getOwned(applicationId: string, userId: string): Promise<AppProject> {
    const project = (await this.engine.list(userId)).find((p) => p.applicationId === applicationId);
    if (!project) throw new NotFoundError('Application', applicationId);
    return this.engine.get(applicationId, userId);
  }
}
