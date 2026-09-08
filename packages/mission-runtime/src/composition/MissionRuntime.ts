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
} from '../adapters/GovernedToolRegistry.js';
import { WorkspaceRootBinding, type WorkspaceToolOptions } from '../adapters/WorkspaceTools.js';
import {
  AgentExecutionAdapter,
  MissionPlanningAdapter,
  RunRegistry,
  RunVerificationAdapter,
} from '../adapters/PlanningExecutionPorts.js';
import {
  MissionExecutionMemoryAdapter,
  MissionExperienceOptimizationAdapter,
} from '../adapters/MemoryOptimizationPorts.js';
import { createWorkspaceFileTemplate } from '../adapters/WorkspaceDevTemplate.js';
import { createOrchestratorRoutingPorts } from '../adapters/OrchestratorRoutingPorts.js';
import { MissionFailureClassifierAdapter } from '../adapters/MissionFailureClassifierAdapter.js';
import { MissionRuntimeApi } from '../mission-api/MissionRuntimeApi.js';

export interface MissionRuntimeOptions {
  /** The authorized workspace root (operator-set; never model-settable). */
  workspaceRoot?: string;
  /** Bounded workspace tool configuration (sizes / content policy). */
  workspaceToolOptions?: WorkspaceToolOptions;
  /** Register workspace tools on the governed registry (default true). */
  workspaceTools?: boolean;
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
    failureClassifier: FailureClassificationPort;
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
  const toolRegistry = createGovernedToolRegistry({
    registryOptions: options.registryOptions,
    workspace:
      includeWorkspaceTools && options.workspaceRoot
        ? { binding: workspace, toolOptions: options.workspaceToolOptions }
        : undefined,
  });
  const toolPort = new ClassifyingToolRegistryPort(toolRegistry);

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
      planner: new MissionPlanningAdapter(planning),
      executor: new AgentExecutionAdapter(agent, runs),
      verifier: new RunVerificationAdapter(runs),
      executionMemory: new MissionExecutionMemoryAdapter(memory, runs),
      experienceOptimization: new MissionExperienceOptimizationAdapter(optimization),
      failureClassifier,
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
    failureClassifier: components.ports.failureClassifier,
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
