// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Production Composition (BLD-022)
//
// The smallest production composition layer that makes the BLD-021A
// Mission Controller EXECUTABLE by the real application:
//
//   USER MISSION → MissionControllerService → objective selection
//   (DevelopmentObjectiveSelector over real repository inspection) →
//   Planning (PlanningApplicationService + PlannerService over the
//   AIOrchestrationPlannerPort) → Agent Execution (AgentExecutionService
//   over the AIOrchestrationAgentPort) → REAL AI provider (registered
//   adapters: Gemini/OpenAI/DeepSeek/Ollama/mock — the controller cannot
//   tell the difference) → REAL ToolRuntime (governed ToolRegistry with
//   bounded, path-jailed workspace tools) → verification (the REAL run's
//   verification results) → checkpoint → Execution Memory (ingestRun) →
//   Experience Optimization (advisory) → next objective — no second user
//   prompt.
//
// DUPLICATES NOTHING: every capability is the frozen estate reached
// through its own port. The controller never calls a provider SDK,
// never executes a shell command, never mutates git directly, and
// never bypasses ToolRuntime. Adaptive-loop is deliberately NOT
// instantiated here: action-level adaptation already lives inside the
// frozen agent execution engine (recovery/replan policies per step) —
// wiring a second loop would duplicate it.
// ──────────────────────────────────────────────────────────────────

import { AIOrchestrationService } from '@vedmoulya/services';
import type { ToolRegistry, ToolRegistryOptions } from '@vedmoulya/services/ai/runtime/ToolRuntime';
import { AgentExecutionService, AIOrchestrationAgentPort } from '@vedmoulya/agent-execution';
import type { ToolPermissionClass } from '@vedmoulya/agent-execution';
import {
  AIOrchestrationPlannerPort,
  PLAN_TEMPLATES,
  PlannerService,
  PlanningApplicationService,
} from '@vedmoulya/planning';
import type { PlanTemplate } from '@vedmoulya/planning';
import { ExecutionMemoryService } from '@vedmoulya/execution-memory';
import {
  ExperienceMemoryPortAdapter,
  ExperienceOptimizationService,
  InMemoryRecommendationOutcomeStore,
} from '@vedmoulya/experience-optimization';
import {
  DevelopmentObjectiveSelector,
  InMemoryCheckpointStore,
  InMemoryMissionStore,
  MissionControllerService,
  SimpleGoalUnderstanding,
  SystemClock,
  createIdGenerator,
} from '@vedmoulya/mission-controller';
import type {
  CheckpointStore,
  ClockPort,
  FailureClassificationPort,
  FailureDiagnosisPort,
  FailureRepairPort,
  IdGeneratorPort,
  MissionControllerOptions,
  MissionStore,
  RepositoryInspectionPort,
} from '@vedmoulya/mission-controller';
import { OrchestratorProviderAvailability } from '../adapters/OrchestratorProviderAvailability.js';
import { FsRepositoryInspector } from '../adapters/FsRepositoryInspector.js';
import { RuntimeGitSafetyAdapter } from '../adapters/RuntimeGitSafetyAdapter.js';
import type { RuntimeGitSafetyAdapterOptions } from '../adapters/RuntimeGitSafetyAdapter.js';
import {
  ClassifyingToolRegistryPort,
  createGovernedToolRegistry,
  permissionClassForTool,
} from '../adapters/GovernedToolRegistry.js';
import { WorkspaceRootBinding, type WorkspaceToolOptions } from '../adapters/WorkspaceTools.js';
import type { CommandExecutionToolOptions } from '../adapters/CommandExecutionTool.js';
import {
  AgentExecutionAdapter,
  MissionPlanningAdapter,
  RunRegistry,
  RunVerificationAdapter,
} from '../adapters/PlanningExecutionPorts.js';
import {
  MissionExecutionMemoryAdapter,
  MissionExperienceOptimizationAdapter,
  MissionLearningRetrievalAdapter,
} from '../adapters/MemoryOptimizationPorts.js';
import { createWorkspaceFileTemplate } from '../adapters/WorkspaceDevTemplate.js';
import { createOrchestratorRoutingPorts } from '../adapters/OrchestratorRoutingPorts.js';
import { MissionFailureClassifierAdapter } from '../adapters/MissionFailureClassifierAdapter.js';
import { MissionDiagnosisAdapter } from '../adapters/DiagnosisRepairAdapter.js';
import { GovernedRepairAdapter } from '../adapters/GovernedRepairAdapter.js';
import { MissionRuntimeApi } from '../mission-api/MissionRuntimeApi.js';

export interface MissionRuntimeOptions {
  /** The authorized workspace root (operator-set; never model-settable). */
  workspaceRoot?: string;
  /** Bounded workspace tool configuration (sizes / content policy). */
  workspaceToolOptions?: WorkspaceToolOptions;
  /** Register workspace tools on the governed registry (default true). */
  workspaceTools?: boolean;
  /**
   * AUTONOMY-02 — register the governed command tool (allowlisted, path-jailed,
   * bounded test/build command families) on the governed registry.
   * Default true: autonomous software verification requires real test
   * execution, and the tool is heavily constrained (fixed command catalog,
   * mission-workspace cwd, timeout + output caps, EXECUTE permission class).
   */
  commandTools?: boolean;
  /** Bounded command tool configuration (timeout / output cap / allowlist). */
  commandToolOptions?: CommandExecutionToolOptions;
  /**
   * FINAL-02 — the permission classes this runtime's missions may use when
   * the FROZEN planner validates a plan (the planner can never exceed them).
   * The classes are derived from the SAME governed registry that classifies
   * the real tools, so naming a class here never invents a capability: the
   * plan still has to pass registry + mission-constraint enforcement.
   * Defaults to the classes of the tools actually registered.
   */
  missionPermissionClasses?: ToolPermissionClass[];
  /** Inject an existing orchestrator; otherwise a fresh one is created. */
  orchestrator?: AIOrchestrationService;
  /** Narrow orchestrator tuning (retry backoff for tests, etc.). */
  orchestratorOptions?: { retryBaseDelayMs?: number };
  /**
   * Provider registration hook — production wiring passes the platform
   * registrar (registerPlatformProviders from @vedmoulya/orchestrator).
   * Default: NO providers (missions honestly wait until providers are
   * configured — never silently mocked in production).
   */
  registerProviders?: (orchestrator: AIOrchestrationService) => void;
  /** Additional deterministic templates for the frozen planner. */
  extraPlannerTemplates?: readonly PlanTemplate[];
  /** Persistence override (defaults to in-memory; use ensureMissionPersistence for durable). */
  stores?: { missions?: MissionStore; checkpoints?: CheckpointStore };
  /** Repository inspection override (defaults to the bounded fs inspector). */
  inspector?: RepositoryInspectionPort;
  /** Last recorded verification evidence for inspection ("where available"). */
  verificationEvidence?: () => string[];
  /** Git safety runtime options (approved executor, workspace root...). */
  gitSafety?: RuntimeGitSafetyAdapterOptions;
  /** Extra governed-registry options (allow/deny lists, audit sink). */
  registryOptions?: ToolRegistryOptions;
  clock?: ClockPort;
  idGenerator?: IdGeneratorPort;
  /** Learning estate overrides (defaults instantiate the real services). */
  memory?: ExecutionMemoryService;
  optimization?: ExperienceOptimizationService;
  /**
   * Optional operator approval gate (BLD-025 §17), forwarded unchanged to the
   * frozen MissionControllerService. When configured and triggered after a
   * failed/risky execution, the mission enters the persisted
   * WAITING_FOR_APPROVAL state and the loop stops until the operator APPROVEs
   * or REJECTs through the controller's frozen state machine. Not configured =
   * the frozen default (failure classification decides directly).
   */
  approvalGate?: MissionControllerOptions['approvalGate'];
  /**
   * FINAL-03A — override the production structured root-cause diagnosis
   * adapter. Default: the real `MissionDiagnosisAdapter` over the existing
   * AUTONOMY-04 diagnosis engine, wired into the production controller.
   * Pass `null` to explicitly compose WITHOUT diagnosis (pre-FINAL-03A
   * behavior); an override must still implement the same port contract.
   */
  diagnosis?: FailureDiagnosisPort | null;
  /**
   * FINAL-03A — override the production GOVERNED repair mechanism. Default:
   * the real `GovernedRepairAdapter` over the SAME governed ToolRegistry the
   * mission executes plans against (only when the governed workspace tools
   * are part of this composition). Pass `null` to explicitly compose without
   * a repair mechanism (pre-FINAL-03A behavior); an override must still
   * implement the same port contract and perform its mutations through the
   * governed tool path.
   */
  repair?: FailureRepairPort | null;
}

/** Every wired component of the composed mission runtime. */
export interface MissionRuntimeComponents {
  orchestrator: AIOrchestrationService;
  workspace: WorkspaceRootBinding;
  toolRegistry: ToolRegistry;
  planner: PlannerService;
  planning: PlanningApplicationService;
  agent: AgentExecutionService;
  memory: ExecutionMemoryService;
  optimization: ExperienceOptimizationService;
  runs: RunRegistry;
  ports: {
    objectiveSelector: DevelopmentObjectiveSelector;
    providerAvailability: OrchestratorProviderAvailability;
    goalUnderstanding: SimpleGoalUnderstanding;
    planner: MissionPlanningAdapter;
    executor: AgentExecutionAdapter;
    verifier: RunVerificationAdapter;
    executionMemory: MissionExecutionMemoryAdapter;
    experienceOptimization: MissionExperienceOptimizationAdapter;
    /** AUTONOMY-06 — advisory learning retrieval over the existing memory. */
    learning: import('@vedmoulya/mission-controller').LearningRetrievalPort;
    failureClassifier: FailureClassificationPort;
    /**
     * FINAL-03A — production structured root-cause diagnosis. Present unless
     * the composition was explicitly asked to omit it (`diagnosis: null`).
     */
    diagnosis?: FailureDiagnosisPort;
    /**
     * FINAL-03A — production governed repair mechanism. Present when the
     * composition registers the governed workspace tools (a repair can only
     * exist where a governed `workspace_write` really exists), unless the
     * composition was explicitly asked to omit it (`repair: null`).
     */
    repair?: FailureRepairPort;
    repositoryInspector?: RepositoryInspectionPort;
    gitSafety: RuntimeGitSafetyAdapter;
  };
  stores: { missions: MissionStore; checkpoints: CheckpointStore };
}

export function buildMissionRuntimeComponents(
  options: MissionRuntimeOptions = {},
): MissionRuntimeComponents {
  // ── AI orchestration (frozen router — providers registered via hook) ──
  const orchestrator =
    options.orchestrator ?? new AIOrchestrationService(options.orchestratorOptions);
  options.registerProviders?.(orchestrator);
  // A SELF-created orchestrator is wired with deterministic routing
  // intelligence over its real registered adapters (provider-agnostic; the
  // controller never sees provider details). An INJECTED orchestrator (host
  // application wiring) is left untouched — production routing stays with
  // the host's enterprise intelligence.
  if (!options.orchestrator) {
    orchestrator.configureIntelligence(createOrchestratorRoutingPorts(orchestrator));
  }

  // ── Governed ToolRuntime: safe tools + bounded, path-jailed workspace ──
  const workspace = new WorkspaceRootBinding();
  if (options.workspaceRoot) workspace.setRoot(options.workspaceRoot);
  const includeWorkspaceTools = options.workspaceTools !== false;
  const includeCommandTools = options.commandTools !== false;
  const toolRegistry = createGovernedToolRegistry({
    registryOptions: options.registryOptions,
    workspace:
      includeWorkspaceTools && options.workspaceRoot
        ? { binding: workspace, toolOptions: options.workspaceToolOptions }
        : undefined,
    command:
      includeCommandTools && options.workspaceRoot
        ? { toolOptions: options.commandToolOptions }
        : undefined,
  });
  const toolPort = new ClassifyingToolRegistryPort(toolRegistry);

  // ── FINAL-02 — mission permission classes, derived from the REAL registry ──
  // The planner is told exactly which permission classes this principal
  // holds. Deriving them from the governed registry (rather than a literal)
  // means a class is only ever reachable when a registered tool really
  // carries it — and the mission constraint (MissionService) still decides
  // which TOOLS are allowed for a given mission.
  const registeredToolNames = toolRegistry.list().map((tool) => tool.name);
  const derivedPermissionClasses: ToolPermissionClass[] = [
    ...new Set(registeredToolNames.map((name) => permissionClassForTool(name))),
  ];
  const missionPermissionClasses = options.missionPermissionClasses ?? derivedPermissionClasses;

  // ── Planning (frozen planner + templates through its extension point) ──
  const planner = new PlannerService({
    ai: new AIOrchestrationPlannerPort(orchestrator),
    toolRegistry: toolPort,
    clock: new SystemClock(),
    templates: [
      // Specific deterministic templates precede the generic fallback so
      // matched goals (e.g. "create the workspace file X …") get the
      // smallest tool-driven plan instead of the generic AI-only plan.
      createWorkspaceFileTemplate(),
      ...PLAN_TEMPLATES,
      ...(options.extraPlannerTemplates ?? []),
    ],
  });
  const runs = new RunRegistry();
  const agent = new AgentExecutionService({
    ai: new AIOrchestrationAgentPort(orchestrator),
    tools: toolPort,
    toolRegistry: toolPort,
    clock: new SystemClock(),
  });
  const planning = new PlanningApplicationService({ planner, executor: agent });

  // ── Learning estate (frozen services + their infrastructure) ──
  const memory = options.memory ?? new ExecutionMemoryService();
  const optimization =
    options.optimization ??
    new ExperienceOptimizationService({
      memory: new ExperienceMemoryPortAdapter(memory),
      outcomes: new InMemoryRecommendationOutcomeStore(),
    });
  // AUTONOMY-06 — advisory learning retrieval adapter over the existing
  // memory. Runtime-truth tool availability is supplied by the governed
  // registry so memory can never recommend an unavailable tool.
  const learning = new MissionLearningRetrievalAdapter(memory, {
    availableTools: (): string[] => toolRegistry.list().map((t) => t.name),
  });

  // ── Mission ports over the real estate ──
  const inspector =
    options.inspector ??
    (options.workspaceRoot
      ? new FsRepositoryInspector({
          defaultWorkspace: options.workspaceRoot,
          verificationEvidence: options.verificationEvidence,
        })
      : undefined);
  const gitSafety = new RuntimeGitSafetyAdapter({
    ...options.gitSafety,
    workspaceRoot: options.gitSafety?.workspaceRoot ?? options.workspaceRoot,
  });
  // Failure classification reuses the frozen domain classifier and hardens
  // executor-reported permanent failure classes (permission/capability).
  const failureClassifier: FailureClassificationPort = new MissionFailureClassifierAdapter();

  // FINAL-03A — production structured root-cause diagnosis over the EXISTING
  // AUTONOMY-04 engine. `null` is an explicit, deliberate opt-out (the
  // pre-FINAL-03A behavior); the default is the real production adapter.
  const diagnosis: FailureDiagnosisPort | undefined =
    options.diagnosis === null ? undefined : (options.diagnosis ?? new MissionDiagnosisAdapter());

  // FINAL-03A — production GOVERNED repair mechanism over the SAME governed
  // registry the mission executes plan actions against. It is only wired when
  // the governed workspace tools are really registered (otherwise there is no
  // governed `workspace_write` for a repair to use, and the honest answer is
  // "no repair mechanism" rather than a mechanism that can only fail).
  const governedWriteRegistered = includeWorkspaceTools && Boolean(options.workspaceRoot);
  const repair: FailureRepairPort | undefined =
    options.repair === null
      ? undefined
      : (options.repair ??
        (governedWriteRegistered
          ? new GovernedRepairAdapter({ registry: toolRegistry })
          : undefined));

  return {
    orchestrator,
    workspace,
    toolRegistry,
    planner,
    planning,
    agent,
    memory,
    optimization,
    runs,
    ports: {
      objectiveSelector: new DevelopmentObjectiveSelector(inspector),
      providerAvailability: new OrchestratorProviderAvailability(orchestrator),
      goalUnderstanding: new SimpleGoalUnderstanding(),
      planner: new MissionPlanningAdapter(planning, {
        grantedPermissionClasses: missionPermissionClasses,
      }),
      executor: new AgentExecutionAdapter(agent, runs),
      verifier: new RunVerificationAdapter(runs),
      executionMemory: new MissionExecutionMemoryAdapter(memory, runs),
      experienceOptimization: new MissionExperienceOptimizationAdapter(optimization),
      learning,
      failureClassifier,
      diagnosis,
      repair,
      repositoryInspector: inspector,
      gitSafety,
    },
    stores: {
      missions: options.stores?.missions ?? new InMemoryMissionStore(),
      checkpoints: options.stores?.checkpoints ?? new InMemoryCheckpointStore(),
    },
  };
}

/** The fully composed, executable mission runtime. */
export interface MissionRuntime extends MissionRuntimeComponents {
  controller: MissionControllerService;
  api: MissionRuntimeApi;
}

export function createMissionRuntime(options: MissionRuntimeOptions = {}): MissionRuntime {
  const components = buildMissionRuntimeComponents(options);
  const controller = new MissionControllerService({
    store: components.stores.missions,
    checkpointStore: components.stores.checkpoints,
    objectiveSelector: components.ports.objectiveSelector,
    providerAvailability: components.ports.providerAvailability,
    goalUnderstanding: components.ports.goalUnderstanding,
    planner: components.ports.planner,
    executor: components.ports.executor,
    verifier: components.ports.verifier,
    executionMemory: components.ports.executionMemory,
    experienceOptimization: components.ports.experienceOptimization,
    learning: components.ports.learning,
    failureClassifier: components.ports.failureClassifier,
    diagnosis: components.ports.diagnosis,
    repair: components.ports.repair,
    clock: options.clock ?? new SystemClock(),
    idGenerator: options.idGenerator ?? createIdGenerator(),
    repositoryInspector: components.ports.repositoryInspector,
    gitSafety: components.ports.gitSafety,
    approvalGate: options.approvalGate,
  });
  const api = new MissionRuntimeApi({
    controller,
    store: components.stores.missions,
    checkpointStore: components.stores.checkpoints,
  });
  return { ...components, controller, api };
}
