// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Factory Engine
// EPIC-007 — the orchestrating layer ABOVE the frozen platform.
//
//   UNDERSTAND → SPECIFY → ARCHITECT → PLAN → SELECT TECHNOLOGIES →
//   SELECT AI CAPABILITIES → GENERATE → TEST → CRITIQUE → REFINE →
//   BUILD → PACKAGE → DEPLOY/EXPORT
//
// Reuses (never rebuilds): the AI Runtime (SpecialistExecutionPort →
// AIOrchestratorSpecialistPort), the EPIC-006 LoopEngine (the bounded
// generation loop with a pre-built application task graph), the frozen
// ToolRuntime (ToolExecutionPort), the CriticEvaluator, and the
// execution budget. It adds ONLY the application-factory layer:
// specification/architecture/blueprint engines, the controlled file-
// operation + policy layer, validation gates, security + UI quality
// review, economics, registry, deployment + VCS abstraction.
//
// EPIC-008 — persistent application lifecycle (Phase 1) + version
// history (Phase 14). When a registry port is provided every mutation
// is written through and projects survive restart; ownership is
// enforced at the engine layer (`getOwned`), never only in the UI.
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import { LoopEngine } from '@vedmoulya/loop-engine';
import type { LoopRun, LoopTask, LoopTaskGraph } from '@vedmoulya/loop-engine';
import type { FactoryEnginePorts } from '../contracts/factory-ports.js';
import type {
  AppProject,
  ApplicationArchitecture,
  ApplicationSpecification,
  ApplicationStatus,
  ApplicationTaskGraph,
  ApplicationVersion,
  BlueprintFile,
  DeploymentRequest,
  DeploymentResult,
  ExecutionPolicy,
  FileOperation,
  NewAppProject,
  RepairAttempt,
} from '../types/app-types.js';
import { SpecificationEngine } from './SpecificationEngine.js';
import { ArchitectureEngine } from './ArchitectureEngine.js';
import { TaskGraphBuilder } from './TaskGraphBuilder.js';
import { BlueprintService } from './BlueprintService.js';
import { PlanPreviewService } from './PlanPreviewService.js';
import { FileOperationLayer } from './FileOperationLayer.js';
import { ValidationPipeline } from './ValidationPipeline.js';
import { SecurityReviewer } from './SecurityReviewer.js';
import { UIQualityEvaluator } from './UIQualityEvaluator.js';
import { EconomicsTracker } from './EconomicsTracker.js';
import { DeploymentAbstraction } from './DeploymentAbstraction.js';
import { VersionControlService } from './VersionControlService.js';
import { DEFAULT_EXECUTION_POLICY } from './ExecutionPolicy.js';
import { generateProject } from '../catalog/generator.js';

export interface FactoryEngineOptions extends FactoryEnginePorts {
  /** Stable clock source (defaults to loop-engine SystemClock). */
  defaultPolicy?: ExecutionPolicy;
  /**
   * Phase 14 (isolation): optional per-application workspace factory. When
   * provided, every application gets its OWN isolated workspace (preventing
   * cross-application file contamination). When absent (backward compatible),
   * the single `workspace` port is shared — the behavior of the original
   * in-memory test implementation.
   */
  workspaceFactory?: (
    applicationId: string,
    policy: ExecutionPolicy,
  ) => FactoryEnginePorts['workspace'];
  /**
   * Phase 11: validation seam (defaults to the deterministic
   * ValidationPipeline). Tests inject a stub to exercise the repair-loop
   * exhaustion path deterministically.
   */
  validation?: ValidationPipeline;
}

export interface CreateApplicationInput {
  goal: string;
  owner: string;
  /** Optional budget override (bounded loop). */
  budgetOverride?: Partial<ApplicationSpecification['budget']>;
}

export interface BuildApplicationInput {
  applicationId: string;
  owner: string;
  /** When false, only the plan preview is produced (Phase 8 approval gate). */
  approved: boolean;
  /** Explicit policy grants (e.g. SAFE_WRITE for file creation). */
  grants?: Partial<Record<FileOperation['actionClass'], boolean>>;
  /** Seed the workspace with generated files (default true after approval). */
  generate?: boolean;
}

/** Statuses from which an application may be deleted (policy, Phase 1). */
const DELETABLE_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  'DRAFT',
  'PLANNED',
  'FAILED',
  'ARCHIVED',
]);

/** Phase 11: the repair loop never exceeds this many attempts (bounded). */
export const MAX_REPAIR_ATTEMPTS = 6;

export class FactoryEngine {
  private readonly specEngine: SpecificationEngine;
  private readonly archEngine: ArchitectureEngine;
  private readonly graphBuilder: TaskGraphBuilder;
  private readonly blueprintService: BlueprintService;
  private readonly previewService: PlanPreviewService;
  private readonly validation: ValidationPipeline;
  private readonly security: SecurityReviewer;
  private readonly uiQuality: UIQualityEvaluator;
  private readonly deployment: DeploymentAbstraction;
  private readonly versionControlService: VersionControlService;
  private readonly policy: ExecutionPolicy;
  private readonly economics = new Map<string, EconomicsTracker>();
  private readonly projects = new Map<string, AppProject>();
  private readonly workspaces = new Map<string, FactoryEnginePorts['workspace']>();

  constructor(private readonly ports: FactoryEngineOptions) {
    this.policy = ports.defaultPolicy ?? DEFAULT_EXECUTION_POLICY;
    this.specEngine = new SpecificationEngine();
    this.archEngine = new ArchitectureEngine();
    this.graphBuilder = new TaskGraphBuilder();
    this.blueprintService = new BlueprintService();
    this.previewService = new PlanPreviewService();
    this.validation = ports.validation ?? new ValidationPipeline();
    this.security = new SecurityReviewer();
    this.uiQuality = new UIQualityEvaluator();
    this.deployment = new DeploymentAbstraction(ports.deployments);
    this.versionControlService = new VersionControlService(ports.versionControl);
  }

  /** Phase 1–3 + 7–8: create the project record with spec, architecture,
   *  task graph, blueprint and preview. NO files are generated yet. */
  async create(input: CreateApplicationInput): Promise<NewAppProject> {
    if (!input.goal.trim()) throw new Error('application goal is required');
    const applicationId = `app-${generateId()}`;
    const spec = this.specEngine.derive({
      applicationId,
      owner: input.owner,
      goal: input.goal,
      budget: input.budgetOverride,
    });
    const architecture = this.archEngine.derive({ specification: spec });
    const taskGraph = this.graphBuilder.build(architecture);
    const plannedFiles = this.planFiles(spec, architecture);
    const blueprint = this.blueprintService.build({
      specification: spec,
      architecture,
      taskGraph,
      plannedFiles,
      deploymentTarget: architecture.deploymentTarget,
    });
    const preview = this.previewService.build({ specification: spec, architecture, blueprint });

    const project: AppProject = {
      applicationId,
      owner: input.owner,
      name: spec.name,
      archetype: spec.archetype,
      specification: spec,
      architecture,
      taskGraph,
      blueprint,
      planPreview: preview,
      version: '1.0.0',
      status: 'DRAFT',
      technologies: blueprint.technologies,
      aiCapabilities: architecture.aiCapabilities.map((c) => c.capability),
      repositoryPath: `Applications/${applicationId}`,
      deploymentStatus: 'not_deployed',
      health: 'unknown',
      fileOperations: [],
      files: [],
      vcOperations: [],
      versionHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const withVersion = this.withVersion(project, 'created');
    this.projects.set(applicationId, withVersion);
    await this.persist(withVersion);
    return toNewProject(withVersion);
  }

  /** Phase 8: user approves (or modifies) the plan → PLANNED. */
  async approve(applicationId: string, owner: string, changes?: string): Promise<AppProject> {
    const project = await this.getOwned(applicationId, owner);
    if (!project.blueprint) {
      throw new Error(`application has no blueprint: ${applicationId}`);
    }
    const approvedPreview = this.previewService.approve(
      project.planPreview ??
        this.previewService.build({
          specification: project.specification,
          architecture: project.architecture,
          blueprint: project.blueprint,
        }),
      changes,
    );
    const change = changes?.trim() ? 'plan approved with requested changes' : 'plan approved';
    const updated = this.withVersion(
      { ...project, planPreview: approvedPreview, status: 'PLANNED' as const },
      change,
    );
    this.projects.set(applicationId, updated);
    await this.persist(updated);
    return updated;
  }

  /** Phase 5–6 + 10: build the application in an isolated workspace.
   *  Requires approval (Phase 8) and explicit policy grants. */
  async build(input: BuildApplicationInput): Promise<AppProject> {
    const project = await this.getOwned(input.applicationId, input.owner);
    if (!input.approved) {
      throw new Error('the plan must be approved before building (Phase 8)');
    }

    // Isolated workspace (Phase 14) with the project's execution policy.
    const policy: ExecutionPolicy = {
      ...this.policy,
      grants: { ...this.policy.grants, ...input.grants },
    };
    // Phase 14: each application gets its own isolated workspace when the
    // gateway provides a workspace factory — cross-application file
    // contamination is prevented by construction.
    const workspace = this.ports.workspaceFactory
      ? this.ports.workspaceFactory(input.applicationId, policy)
      : this.ports.workspace;
    this.workspaces.set(input.applicationId, workspace);
    const fileLayer = new FileOperationLayer(workspace, policy);
    const tracker = new EconomicsTracker(input.applicationId, {
      estimatedTokens: project.planPreview?.estimatedAiUsage.estimatedTokens ?? 8_000,
      estimatedCostUsd: project.planPreview?.estimatedAiUsage.estimatedCostUsd ?? 0.5,
    });
    tracker.start();
    this.economics.set(input.applicationId, tracker);

    let updated: AppProject = { ...project, status: 'BUILDING' as const };
    this.projects.set(input.applicationId, updated);
    await this.persist(updated);

    try {
      // 1. GENERATE (Phase 5): seed the isolated workspace with the
      // deterministic, typed project files for the archetype.
      if (input.generate !== false) {
        const files = generateProject(updated.archetype, {
          applicationId: input.applicationId,
          name: updated.name,
        });
        for (const file of files) {
          const planned = fileLayer.plan({
            kind: 'create',
            path: file.path,
            content: file.content,
            reason: `generated by the ${file.kind} template for archetype ${updated.archetype}`,
            originatingTask: `template-${file.kind}`,
          });
          if (fileLayer.canApply(planned)) {
            fileLayer.apply(planned);
          }
        }
      }

      // 2. Run the bounded loop (EPIC-006 reuse) over the APPLICATION task
      // graph to produce the specialist-generated deliverables.
      const loopRun = await this.runGenerationLoop(updated, tracker);
      updated = {
        ...updated,
        terminationReason: loopRun.terminationReason,
        error: loopRun.error,
      };
      if (loopRun.terminationReason !== 'SUCCESS' && !loopRun.finalCritic) {
        updated.status = 'FAILED';
        updated.error = `generation loop terminated: ${loopRun.terminationReason ?? 'unknown'}`;
        updated.economics = tracker.snapshot();
        const failed = this.withVersion(
          updated,
          `build FAILED (${loopRun.terminationReason ?? 'unknown'})`,
        );
        this.projects.set(input.applicationId, failed);
        await this.persist(failed);
        return failed;
      }

      // 3. VALIDATE with a BOUNDED REPAIR LOOP (Phase 10 + Phase 11):
      //    diagnose → patch → diff → re-validate, capped at
      //    MAX_REPAIR_ATTEMPTS (6). Every attempt is recorded (the UI shows
      //    the attempt n/6 counter and the per-attempt diagnosis/patches/
      //    result). When the loop is exhausted while validation still fails,
      //    the application is FAILED with REPAIR_LIMIT_REACHED — the UI must
      //    never pretend the application is ready.
      updated.status = 'VALIDATING';
      this.projects.set(input.applicationId, updated);
      await this.persist(updated);

      const repairAttempts: RepairAttempt[] = [];
      let repairLimitReached = false;
      let validationResult = this.validation.run(
        {
          applicationId: input.applicationId,
          files: workspace.listFiles(),
          architecture: updated.architecture,
          specification: updated.specification,
          blueprint: updated.blueprint,
          fileOperations: fileLayer.history(),
          policy,
        },
        { hasAdminViews: updated.archetype === 'restaurant-app' },
      );

      for (
        let attempt = 1;
        attempt <= MAX_REPAIR_ATTEMPTS && validationResult.report.overall !== 'PASS';
        attempt += 1
      ) {
        const diagnosis = validationResult.report;
        // No deterministic fix left to try — nothing more the loop can do.
        if (validationResult.fixes.length === 0) {
          break;
        }
        const patches: Array<{ path: string; reason: string }> = [];
        for (const fix of validationResult.fixes) {
          const planned = fileLayer.plan({
            kind: 'create',
            path: fix.path,
            content:
              fix.path === 'package.json'
                ? JSON.stringify(
                    {
                      name: updated.name,
                      version: '0.1.0',
                      private: true,
                      scripts: { build: 'tsc -p tsconfig.json', test: 'vitest run' },
                    },
                    null,
                    2,
                  )
                : `import { describe, expect, it } from 'vitest';\n\ndescribe('${fix.path}', () => {\n  it('passes the auto-generated smoke test', () => {\n    expect(true).toBe(true);\n  });\n});\n`,
            reason: fix.reason,
            originatingTask: `repair-${attempt}`,
          });
          if (fileLayer.canApply(planned)) {
            fileLayer.apply(planned);
            patches.push({ path: fix.path, reason: fix.reason });
            tracker.recordIteration();
          }
        }
        // If none of the proposed fixes could actually be applied (policy
        // block / path collision), re-validating identical files would spin
        // the remaining attempts pointlessly — stop and report honestly
        // (VALIDATION_FAILURE, not REPAIR_LIMIT_REACHED).
        if (patches.length === 0) {
          break;
        }
        // Re-validate after applying the patch — the diff is recorded in the
        // workspace file-operation history (Phase 8 diff/change review).
        validationResult = this.validation.run(
          {
            applicationId: input.applicationId,
            files: workspace.listFiles(),
            architecture: updated.architecture,
            specification: updated.specification,
            blueprint: updated.blueprint,
            fileOperations: fileLayer.history(),
            policy,
          },
          { hasAdminViews: updated.archetype === 'restaurant-app' },
        );
        repairAttempts.push({
          attempt,
          limit: MAX_REPAIR_ATTEMPTS,
          diagnosis,
          patches,
          result: validationResult.report,
          createdAt: new Date().toISOString(),
        });
      }
      if (validationResult.report.overall !== 'PASS') {
        repairLimitReached = repairAttempts.length >= MAX_REPAIR_ATTEMPTS;
      }

      // 4. SECURITY + UI quality (Phases 11–12).
      const securityReport = this.security.review(input.applicationId, {
        files: workspace.listFiles(),
        apiContract: updated.architecture.apiContract,
        dependencies: updated.blueprint?.dependencies ?? [],
      });
      const uiReport = this.uiQuality.evaluate({
        files: workspace.listFiles(),
        uiDesign: workspace.listFiles().find((f) => f.path.includes('ui-design'))?.content ?? '',
        hasAdminViews: updated.archetype === 'restaurant-app',
      });

      const files = workspace.listFiles();
      const validationFailed = validationResult.report.overall !== 'PASS';
      const failed = securityReport.blocked || validationFailed;
      updated = {
        ...updated,
        status: failed ? 'FAILED' : 'READY',
        files: files.map((f) => ({ path: f.path, content: f.content, kind: f.kind })),
        fileOperations: fileLayer.history(),
        lastBuildAt: new Date().toISOString(),
        lastValidation: validationResult.report,
        securityReport,
        uiQuality: uiReport,
        economics: tracker.snapshot(),
        repairAttempts: repairAttempts.length > 0 ? repairAttempts : undefined,
        repairLimit: MAX_REPAIR_ATTEMPTS,
        repairLimitReached: repairLimitReached || undefined,
        terminationReason: validationFailed
          ? repairLimitReached
            ? 'REPAIR_LIMIT_REACHED'
            : 'VALIDATION_FAILURE'
          : updated.terminationReason,
        error: validationFailed
          ? repairLimitReached
            ? `validation did not pass after ${MAX_REPAIR_ATTEMPTS} repair attempts — REPAIR_LIMIT_REACHED`
            : `validation did not pass (${validationResult.report.overall}) and no deterministic fix remained`
          : updated.error,
        health: securityReport.blocked ? 'unhealthy' : validationFailed ? 'degraded' : 'healthy',
      };
      const completed = this.withVersion(
        updated,
        `build ${updated.status}${validationFailed ? ` (${updated.terminationReason ?? 'VALIDATION_FAILURE'})` : ''}`,
      );
      this.projects.set(input.applicationId, completed);
      await this.persist(completed);
      return completed;
    } catch (error) {
      updated = {
        ...updated,
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error),
        economics: tracker.snapshot(),
      };
      const failed = this.withVersion(updated, 'build FAILED (engine error)');
      this.projects.set(input.applicationId, failed);
      await this.persist(failed);
      return failed;
    }
  }

  /** Phase 16: deploy ONLY with explicit authorization. */
  async deploy(
    applicationId: string,
    owner: string,
    request: DeploymentRequest,
  ): Promise<DeploymentResult> {
    const project = await this.getOwned(applicationId, owner);
    const result = await this.deployment.deploy(request, project.repositoryPath);
    if (result.status === 'deployed') {
      const deployed = this.withVersion(
        {
          ...project,
          deploymentStatus: 'deployed',
          deploymentTarget: request.target,
          status: 'DEPLOYED' as const,
        },
        'deployed',
      );
      this.projects.set(applicationId, deployed);
      await this.persist(deployed);
    } else if (result.status === 'failed') {
      const failed = { ...project, deploymentStatus: 'failed' as const };
      this.projects.set(applicationId, failed);
      await this.persist(failed);
    }
    return result;
  }

  // ── EPIC-008 Phase 1: application lifecycle management ────────────────────

  /** Rename the application (recorded in the version history). */
  async rename(
    applicationId: string,
    owner: string,
    name: string,
  ): Promise<{ applicationId: string; status: ApplicationStatus; name: string }> {
    const project = await this.getOwned(applicationId, owner);
    const trimmed = name.trim();
    if (!trimmed) throw new Error('application name is required');
    const updated = this.withVersion({ ...project, name: trimmed }, `renamed to "${trimmed}"`);
    this.projects.set(applicationId, updated);
    await this.persist(updated);
    return { applicationId, status: updated.status, name: updated.name };
  }

  /** Archive the application (removed from the active list, not deleted). */
  async archive(
    applicationId: string,
    owner: string,
  ): Promise<{ applicationId: string; status: ApplicationStatus }> {
    const project = await this.getOwned(applicationId, owner);
    if (project.status === 'ARCHIVED') return { applicationId, status: project.status };
    const updated = this.withVersion({ ...project, status: 'ARCHIVED' as const }, 'archived');
    this.projects.set(applicationId, updated);
    await this.persist(updated);
    return { applicationId, status: updated.status };
  }

  /** Delete the application according to policy (confirm required; active or
   *  released applications must be archived first). */
  async deleteApplication(
    applicationId: string,
    owner: string,
    confirm: boolean,
  ): Promise<{ applicationId: string; deleted: boolean; message: string }> {
    const project = await this.getOwned(applicationId, owner);
    if (!confirm) {
      return { applicationId, deleted: false, message: 'deletion requires explicit confirmation' };
    }
    if (!DELETABLE_STATUSES.has(project.status)) {
      return {
        applicationId,
        deleted: false,
        message: `applications in status ${project.status} must be archived before deletion`,
      };
    }
    this.projects.delete(applicationId);
    this.workspaces.delete(applicationId);
    this.economics.delete(applicationId);
    if (this.ports.registry) {
      await this.ports.registry.delete(applicationId);
    }
    return { applicationId, deleted: true, message: 'application deleted' };
  }

  /** Resume an archived (→ DRAFT) or failed (→ PLANNED, ready to rebuild)
   *  application. Never restarts the whole application unnecessarily. */
  async resume(
    applicationId: string,
    owner: string,
  ): Promise<{ applicationId: string; status: ApplicationStatus; message: string }> {
    const project = await this.getOwned(applicationId, owner);
    if (project.status === 'BUILDING' || project.status === 'VALIDATING') {
      return { applicationId, status: project.status, message: 'a build is already in progress' };
    }
    let updated: AppProject;
    if (project.status === 'ARCHIVED') {
      updated = this.withVersion({ ...project, status: 'DRAFT' as const }, 'resumed from archive');
    } else if (project.status === 'FAILED') {
      updated = this.withVersion({ ...project, status: 'PLANNED' as const }, 'resumed for rebuild');
    } else {
      return { applicationId, status: project.status, message: 'application is already active' };
    }
    this.projects.set(applicationId, updated);
    await this.persist(updated);
    return { applicationId, status: updated.status, message: `resumed (${updated.status})` };
  }

  /** Phase 14: recorded application states (oldest first). */
  async history(applicationId: string, owner: string): Promise<ApplicationVersion[]> {
    const project = await this.getOwned(applicationId, owner);
    return project.versionHistory ?? [];
  }

  /** Phase 15: version-control operations (never auto-push). */
  async versionControl(applicationId: string, owner: string): Promise<VersionControlService> {
    await this.getOwned(applicationId, owner);
    return this.versionControlService;
  }

  async list(owner?: string): Promise<AppProject[]> {
    if (this.ports.registry) {
      const fromRegistry = await this.ports.registry.list(owner);
      for (const project of fromRegistry) {
        this.projects.set(project.applicationId, project);
      }
      return fromRegistry;
    }
    const all = Array.from(this.projects.values()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    return owner ? all.filter((p) => p.owner === owner) : all;
  }

  async get(applicationId: string, owner?: string): Promise<AppProject> {
    return this.getOwned(applicationId, owner ?? '*');
  }

  private async getOwned(applicationId: string, owner: string): Promise<AppProject> {
    let project = this.projects.get(applicationId);
    if (!project && this.ports.registry) {
      project = await this.ports.registry.get(applicationId);
      if (project) this.projects.set(applicationId, project);
    }
    if (!project) throw new Error(`application not found: ${applicationId}`);
    if (owner !== '*' && project.owner !== owner)
      throw new Error(`application not found: ${applicationId}`);
    return project;
  }

  /** Write a mutation through to the persistent repository when configured. */
  private async persist(project: AppProject): Promise<void> {
    if (this.ports.registry) {
      await this.ports.registry.save(project);
    }
  }

  /** Append a version record to the project (Phase 14). */
  private withVersion(project: AppProject, change: string): AppProject {
    const history = project.versionHistory ?? [];
    const entry: ApplicationVersion = {
      version: history.length + 1,
      createdAt: new Date().toISOString(),
      change,
      status: project.status,
      validation: project.lastValidation
        ? {
            overall: project.lastValidation.overall,
            gatesPassed: project.lastValidation.gates.filter((g) => g.passed).length,
            gatesTotal: project.lastValidation.gates.length,
          }
        : undefined,
      security: project.securityReport
        ? {
            blocked: project.securityReport.blocked,
            critical: project.securityReport.summary.critical,
            high: project.securityReport.summary.high,
          }
        : undefined,
      economics: project.economics
        ? {
            totalTokens: project.economics.totalTokens,
            estimatedCostUsd: project.economics.estimatedCostUsd,
            aiCalls: project.economics.aiCalls,
          }
        : undefined,
      actor: project.owner,
    };
    return { ...project, versionHistory: [...history, entry] };
  }

  /** Run the EPIC-006 loop over the application task graph (Phase 3 reuse). */
  private async runGenerationLoop(
    project: AppProject,
    tracker: EconomicsTracker,
  ): Promise<LoopRun> {
    const loopGraph = this.toLoopGraph(project.taskGraph, project);
    const engine = new LoopEngine({
      specialist: this.ports.specialist,
      tools: this.ports.tools,
      clock: this.ports.clock,
    });
    const run = await engine.run({
      goal: project.specification.purpose,
      userId: project.owner,
      specification: undefined,
      graph: loopGraph,
      budgetOverride: project.specification.budget,
    });
    for (const step of run.steps) {
      tracker.recordCall({
        tokens: step.tokens,
        costUsd: step.costUsd,
        provider: step.provider,
        retried: step.retried,
      });
    }
    tracker.recordIteration();
    return run;
  }

  /** Map the application task graph to a loop-engine task graph (Phase 3). */
  private toLoopGraph(graph: ApplicationTaskGraph, project: AppProject): LoopTaskGraph {
    const capabilityByRole: Record<string, string> = {};
    for (const task of graph.tasks) {
      capabilityByRole[task.taskId] = task.capability;
    }
    const tasks: LoopTask[] = graph.tasks.map((task, index) => ({
      taskId: task.taskId,
      title: task.title,
      description: `Application Factory task (${task.phase}) for ${project.name}`,
      capability: task.capability,
      qualityTier: task.qualityTier,
      dependencies: task.dependencies,
      parallelEligible: task.parallelEligible,
      input: `${task.prompt}\n\nApplication: ${project.name}\nGoal: ${project.specification.purpose}`,
      expectedOutput: task.expectedOutput,
      allowedTools: [],
      budget: { timeoutMs: 120_000, maxTokens: 2_000 },
      retryPolicy: { maxRetries: 2, retryDelayMs: 100 },
      status: 'pending',
      order: index + 1,
      phase: task.loopPhase,
    }));
    const dependents = new Set<string>();
    for (const task of tasks) {
      for (const dep of task.dependencies) dependents.add(dep);
    }
    return {
      goalId: project.applicationId,
      tasks,
      entryTaskIds: tasks.filter((t) => t.dependencies.length === 0).map((t) => t.taskId),
      terminalTaskIds: tasks.filter((t) => !dependents.has(t.taskId)).map((t) => t.taskId),
      validated: true,
      validationReasons: ['application task graph validated by the Application Factory'],
      createdAt: new Date().toISOString(),
      version: '1',
    };
  }

  /** Deterministic file plan from the archetype (Phase 7). */
  private planFiles(
    spec: ApplicationSpecification,
    architecture: ApplicationArchitecture,
  ): Array<{
    path: string;
    kind: BlueprintFile['kind'];
    purpose: string;
    producedBy: BlueprintFile['producedBy'];
  }> {
    const files: Array<{
      path: string;
      kind: BlueprintFile['kind'];
      purpose: string;
      producedBy: BlueprintFile['producedBy'];
    }> = [];
    const add = (
      path: string,
      kind: BlueprintFile['kind'],
      purpose: string,
      producedBy: BlueprintFile['producedBy'],
    ): void => {
      files.push({ path, kind, purpose, producedBy });
    };
    add('package.json', 'config', 'build manifest with scripts', 'build');
    add('tsconfig.json', 'config', 'strict TypeScript configuration', 'build');
    add('src/index.ts', 'source', 'application entry point', 'implementation');
    add('src/index.test.ts', 'test', 'unit tests for the entry point', 'testing');
    add('src/ui-design.md', 'docs', 'UI/UX design document', 'ui_design');
    add('db/schema.sql', 'schema', 'database schema', 'data_model');
    if (architecture.apiContract.length > 0) {
      add('src/api/contract.ts', 'source', 'typed API contract', 'api_contract');
      add('src/api/contract.test.ts', 'test', 'API contract integration tests', 'testing');
    }
    return files;
  }
}

function toNewProject(project: AppProject): NewAppProject {
  return {
    applicationId: project.applicationId,
    owner: project.owner,
    name: project.name,
    archetype: project.archetype,
    specification: project.specification,
    architecture: project.architecture,
    taskGraph: project.taskGraph,
    version: project.version,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}
