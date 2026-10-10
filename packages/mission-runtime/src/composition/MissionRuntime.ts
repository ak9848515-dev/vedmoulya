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
import type { AIOrchestrationOptions } from '@vedmoulya/services';
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
import type { UserAgentResolver } from '../adapters/PlanningExecutionPorts.js';
import {
  MissionExecutionMemoryAdapter,
  MissionExperienceOptimizationAdapter,
  MissionLearningRetrievalAdapter,
} from '../adapters/MemoryOptimizationPorts.js';
import { createWorkspaceFileTemplate } from '../adapters/WorkspaceDevTemplate.js';
import { createTestVerifiedTemplate } from '../adapters/TestVerificationTemplate.js';
import { createDataReportTemplate } from '../adapters/DataReportTemplate.js';
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
  /**
   * Orchestrator tuning for the runtime's OWN orchestrators (shared + each
   * per-user one): retry backoff, and — for hosts that supply it — the SAME
   * `observability` (AIObservability) pipeline the direct AI path uses, so
   * Mission AI execution emits the same trace/usage telemetry instead of a
   * second telemetry system. Absent → unchanged NOOP behavior.
   */
  orchestratorOptions?: AIOrchestrationOptions;
  /**
   * Provider registration hook — production wiring passes the platform
   * registrar (registerPlatformProviders from @vedmoulya/orchestrator).
   * Default: NO providers (missions honestly wait until providers are
   * configured — never silently mocked in production).
   */
  registerProviders?: (orchestrator: AIOrchestrationService) => void;
  /**
   * PROVIDER-01 → Mission — user-scoped provider registration.
   *
   * When wired, every provider-facing decision for a mission is served by a
   * PER-USER orchestrator: the platform providers registered above PLUS the
   * OWNER's own credential-backed adapters. A provider the user connected
   * through the Providers screen therefore becomes genuinely usable by THAT
   * user's missions — without the credential ever becoming a deployment-wide
   * provider for anyone else. Absent → the shared orchestrator only
   * (unchanged behavior).
   *
   * The callback receives the freshly-created orchestrator and the mission
   * owner's id; it must resolve the credential through the EXISTING credential
   * service and register the EXISTING adapter. It must never log, persist or
   * return secret material.
   */
  registerUserProviders?: (orchestrator: AIOrchestrationService, userId: string) => Promise<void>;
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

/**
 * PROVIDER-01 → Mission — cache a lazy per-user runtime initialization.
 *
 * Concurrent callers for the SAME user share ONE initialization promise, so
 * registration never runs twice. A FAILED initialization is NOT retained: the
 * entry is evicted (identity-checked, so a concurrently replaced entry is
 * never removed) and the ORIGINAL error is re-thrown to every awaiting caller.
 * A later request can therefore retry cleanly — no retry is attempted here and
 * nothing is swallowed. Different users are cached under different keys and
 * remain isolated.
 */
export function cacheUserInitialization<V>(
  cache: Map<string, Promise<V>>,
  userId: string,
  initialize: () => Promise<V>,
): Promise<V> {
  const existing = cache.get(userId);
  if (existing) return existing;
  const attempt: Promise<V> = initialize().catch((error: unknown) => {
    // Evict only THIS attempt; a concurrent retry may already have replaced it.
    if (cache.get(userId) === attempt) cache.delete(userId);
    throw error;
  });
  cache.set(userId, attempt);
  return attempt;
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

  // ── PROVIDER-01 → Mission: per-user orchestrators ──────────────────────
  //    A user who connected a provider with their OWN credential must be
  //    able to run missions with it WITHOUT that credential becoming a
  //    deployment-wide provider. When a user registrar is wired, each
  //    mission owner gets their own orchestrator (platform providers + their
  //    own adapters only), created once and reused. Every other runtime
  //    keeps the shared orchestrator — and every user keeps every platform
  //    provider, so environment-configured providers are unaffected.
  const userOrchestrators = new Map<string, Promise<AIOrchestrationService>>();
  const resolveUserOrchestrator =
    options.registerUserProviders === undefined
      ? undefined
      : (userId: string): Promise<AIOrchestrationService> =>
          // A failed initialization is evicted (never cached) so a transient
          // credential-service failure cannot permanently disable this user.
          cacheUserInitialization(userOrchestrators, userId, async () => {
            const userOrchestrator = new AIOrchestrationService(options.orchestratorOptions);
            // Platform providers first — a user credential OVERLAYS the
            // deployment's providers, it never removes them.
            options.registerProviders?.(userOrchestrator);
            // Then the owner's own credential-backed adapters, resolved
            // through the existing credential service by the host wiring.
            await options.registerUserProviders?.(userOrchestrator, userId);
            userOrchestrator.configureIntelligence(
              createOrchestratorRoutingPorts(userOrchestrator),
            );
            return userOrchestrator;
          });

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
      //
      // REAL-08 — the test-verified template precedes the workspace-file
      // template on purpose: its goal phrase requires REAL command evidence,
      // while the workspace-file template verifies by read-back only. It
      // stays governed end to end — the write and the read are the same
      // path-jailed workspace tools, and the verification command is an entry
      // of the fixed COMMAND_CATALOG (never a model-chosen shell string).
      createTestVerifiedTemplate(),
      createWorkspaceFileTemplate(),
      // REVENUE-002A — the read→analyse→write data-report template. It is
      // registered AFTER the two narrow workspace-file templates (which match
      // their own literal-content goals) and BEFORE the generic planning
      // templates, so a data-analysis goal that names both a source data file
      // and an output deliverable gets the real read→analyse→write plan rather
      // than the AI-only analysis plan that can never touch the workspace.
      createDataReportTemplate(),
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

  // ── PROVIDER-01 → Mission: per-user execution agents ──────────────────
  //    The agent's AI boundary must answer from the OWNER's orchestrator,
  //    otherwise the run would route to the shared deployment providers and
  //    silently ignore the credential the user connected. The tools are the
  //    SAME shared, governed registry — only the AI boundary is user-scoped.
  const userAgents = new Map<string, Promise<AgentExecutionService>>();
  const resolveUserAgent = ((): UserAgentResolver | undefined => {
    const resolveOrchestrator = resolveUserOrchestrator;
    if (resolveOrchestrator === undefined) return undefined;
    return (userId: string): Promise<AgentExecutionService> =>
      // Same rule as the orchestrator cache: a failed initialization is
      // evicted so it can be retried, and the original error still propagates.
      cacheUserInitialization(userAgents, userId, async () => {
        const userOrchestrator = await resolveOrchestrator(userId);
        return new AgentExecutionService({
          ai: new AIOrchestrationAgentPort(userOrchestrator),
          tools: toolPort,
          toolRegistry: toolPort,
          clock: new SystemClock(),
        });
      });
  })();

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
      providerAvailability: new OrchestratorProviderAvailability(
        orchestrator,
        resolveUserOrchestrator,
      ),
      goalUnderstanding: new SimpleGoalUnderstanding(),
      planner: new MissionPlanningAdapter(planning, {
        grantedPermissionClasses: missionPermissionClasses,
      }),
      executor: new AgentExecutionAdapter(agent, runs, resolveUserAgent),
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
