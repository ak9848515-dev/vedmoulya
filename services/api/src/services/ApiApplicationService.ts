// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Application Service
// Creates all certified backend services and wires them to the API gateway
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import { ExecutionTraceProvider } from '@vedmoulya/core';
import { OrchestratorService as OrchestratorServiceFabric } from '@vedmoulya/orchestration-fabric';
import type { TelemetryPort } from '@vedmoulya/core';
import {
  AIOrchestrationService,
  AIObservability,
  OtelAIObservabilityExporter,
  BusinessApplicationService,
  CareerApplicationService,
  ClientOpsAIService,
  ClientOperationsApplicationService,
  ContentAgencyAIService,
  ContentAgencyApplicationService,
  ContextOptimizer,
  DashboardApplicationService,
  DecisionApplicationService,
  ExecutionApplicationService,
  IdentityApplicationService,
  KnowledgeApplicationService,
  LearningApplicationService,
  LifeOSApplicationService,
  MarketplaceApplicationService,
  MemoryApplicationService,
  PromptCacheManager,
  redactSecrets,
} from '@vedmoulya/services';
import { RagApplicationService, MockEmbeddingProvider } from '@vedmoulya/rag';
import type { RagRepository, EmbeddingProvider } from '@vedmoulya/rag';
import { CapabilityApplicationService } from '@vedmoulya/capabilities';
import type { CapabilityRepository } from '@vedmoulya/capabilities';
import {
  ProviderApplicationService,
  InMemoryProviderPreferencesStore,
  InMemoryProviderIntelligenceStore,
  InMemoryLocalModelDiscovery,
  ProviderPreferencesService,
} from '@vedmoulya/providers';
import type { ProviderRepository } from '@vedmoulya/providers';
import { ContextApplicationService } from '@vedmoulya/context';
import type { ContextRepository } from '@vedmoulya/context';
import { ExecutionStrategyApplicationService } from '@vedmoulya/execution-strategy';
import type { ExecutionStrategyRepository } from '@vedmoulya/execution-strategy';
import {
  InMemoryExecutionGraphRepository,
  InMemoryExecutionHistoryRepository,
  InMemoryExecutionQueueRepository,
  InMemoryExecutionSessionRepository,
  InMemoryWorkerRegistry,
  OrchestratorApplicationService,
} from '@vedmoulya/execution-orchestrator';
import type {
  ExecutionGraphRepository,
  ExecutionSessionRepository,
  ExecutionQueueRepository,
  WorkerRegistry,
  ExecutionHistoryRepository,
} from '@vedmoulya/execution-orchestrator';
import { GoalsApplicationService } from '@vedmoulya/goals';
import type { GoalRepository, TaskRepository } from '@vedmoulya/goals';
import { IntelligenceApplicationService } from '@vedmoulya/intelligence';
import { LearningIntelligenceApplicationService } from '@vedmoulya/learning-intelligence';
import type { LearningRepository } from '@vedmoulya/learning-intelligence';
import { BrainApplicationService } from '@vedmoulya/enterprise-brain';
import type { BrainRepository } from '@vedmoulya/enterprise-brain';
import {
  KnowledgeApplicationService as KnowledgeIntelligenceApplicationService,
  PostgresKnowledgeGraph,
} from '@vedmoulya/knowledge-intelligence';
import type { KnowledgeRepository as KnowledgeIntelligenceRepository } from '@vedmoulya/knowledge-intelligence';
import {
  MemoryApplicationService as MemoryIntelligenceApplicationService,
  PostgresMemoryGraph,
} from '@vedmoulya/memory-intelligence';
import { OSApplicationService } from '@vedmoulya/os-intelligence';
import type { OSRepository as OSIntelligenceRepository } from '@vedmoulya/os-intelligence';
import { ContextFabricApplicationService } from '@vedmoulya/context-fabric';
import type { GraphRepository as ContextFabricGraphRepository } from '@vedmoulya/context-fabric';
import {
  AIOrchestratorSpecialistPort,
  LoopApplicationService,
  SystemClock,
  ToolRegistryToolPort,
} from '@vedmoulya/loop-engine';
import type { LoopEnginePorts } from '@vedmoulya/loop-engine';
import {
  DEFAULT_EXECUTION_POLICY,
  FactoryApplicationService,
  InMemoryVersionControl,
  InMemoryWorkspace,
  LocalDeploymentAdapter,
  VercelDeploymentAdapter,
} from '@vedmoulya/app-factory';
import type { ApplicationProjectRepository } from '@vedmoulya/app-factory';
import { RequirementsApplicationService } from '@vedmoulya/requirements';
import { ExperienceApplicationService } from '@vedmoulya/experience';
import { DiscoveryApplicationService, StaticCatalogDiscoverySource } from '@vedmoulya/ai-world';
import {
  CapabilityMarketplaceApplicationService,
  InMemoryCapabilityPlanStore,
} from '@vedmoulya/capability-marketplace';
import { BrainApplicationService as VedMoulyaBrainService } from '@vedmoulya/brain';
import {
  createBrainPlanPort,
  createBrainCandidatePort,
  createBrainExecutionPort,
  createBrainContextPort,
  createBrainPreferencePort,
  createBrainUsagePort,
  createBrainDiscoveryBridgePort,
  createBrainMemoryPort,
} from '../infrastructure/BrainPorts.js';
import { BrainDashboardService } from './BrainDashboardService.js';
import { EcosystemIntelligenceApplicationService } from '@vedmoulya/ecosystem-intelligence';
import {
  WorkflowExecutionService,
  AgentRegistry,
  WorkflowRegistry,
  InMemoryWorkflowExecutionStore,
  Agent,
  Workflow,
} from '@vedmoulya/ecosystem';
import { LiveIntelligenceBridgeService } from '@vedmoulya/live-intelligence-bridge';
import { SchedulerApplicationService, DiscoveryScheduler } from '@vedmoulya/ai-world-scheduler';
import {
  createGitHubAuthPort,
  createGitHubRepoSourcePort,
} from '../infrastructure/EcosystemIntelligencePorts.js';
import {
  createBridgeAiWorldPort,
  createBridgeBrainPort,
  createBridgeClockPort,
  createBridgeExecutionPort,
  createBridgeIntelligencePort,
  createBridgeMarketplacePort,
} from '../infrastructure/LiveIntelligenceBridgePorts.js';
import {
  createSchedulerClockPort,
  createSchedulerDiscoveryPort,
  createSchedulerBrainPort,
  createSchedulerNotifyPort,
} from '../infrastructure/SchedulerPorts.js';
import {
  ExecutionRunService,
  InMemoryExecutionRunStore,
  InMemoryPreferenceLedger,
} from '@vedmoulya/execution-bridge';
import type {
  ExecutionBudgetConfig,
  ExecutionRunStore,
  PreferenceLedgerPort,
  StepExecutionPort,
} from '@vedmoulya/execution-bridge';
import { createCapabilitySourcePort } from '../infrastructure/CapabilitySourcePorts.js';
import { createCapabilityEnrichmentPort } from '../infrastructure/CapabilityEnrichmentPort.js';
import {
  createExecutionBudgetConfig,
  createExecutionPlanSource,
  createStepExecutionPort,
} from '../infrastructure/ExecutionBridgePorts.js';
import { createOrchestrationAwarePlanSource } from '../infrastructure/OrchestrationPlanSource.js';
import type { RequirementEnrichmentPort, RequirementSessionStore } from '@vedmoulya/requirements';
import { createExperienceAICritiquePort } from '../infrastructure/ExperienceAICritiquePort.js';
import { TraceProviderOtelBridge } from '../observability/TraceProviderOtelBridge.js';
import type { SchedulerRuntimeStatus } from '../observability/scheduler-cadence.js';
import { OpsApplicationService } from './OpsApplicationService.js';
import { CostLedger } from '../observability/CostLedger.js';
import { AlertEngine } from '../observability/AlertEngine.js';
import { OperatorGate, AuditTrail } from '../observability/OpsAudit.js';
// Deep-import path: the frozen ToolRuntime exports the secure tool registry
// (tool boundary). The top-level services barrel re-exports only a subset of
// the runtime — the loop tool port consumes the registry directly.
import { ToolRegistry, registerSafeTools } from '@vedmoulya/services/ai/runtime/ToolRuntime';
import type { MemoryRepository as MemoryIntelligenceRepository } from '@vedmoulya/memory-intelligence';
import type {
  IdentityRepository,
  MemoryRepository,
  DecisionRepository,
  ExecutionRepository,
  KnowledgeRepository,
  ContentAgencyRepository,
  ClientOpsRepository,
} from '@vedmoulya/domain';
import { InfrastructureHealthProbe } from './InfrastructureHealthProbe.js';
import { registerPlatformProviders, createOpenAIEmbeddingProvider } from '@vedmoulya/orchestrator';
import {
  createProviderIntelligencePort,
  createExecutionStrategyPort,
  createRagRetrievalPort,
} from '../infrastructure/RuntimePorts.js';
import { ProviderExperienceService } from './ProviderExperienceService.js';
import { ModelSelectionIntelligence } from '@vedmoulya/services';
import { validateProductionAIConfig } from '../infrastructure/ProductionAIConfig.js';
import { resolvePersistenceBundle } from '../infrastructure/PersistenceStores.js';
import { setAuditStore } from '../middleware/audit.js';
import {
  SpeechApplicationService,
  VoiceAssistantService,
  MockSpeechToTextAdapter,
  MockTextToSpeechAdapter,
  RuntimeSpeechToTextAdapter,
  RuntimeTextToSpeechAdapter,
} from '@vedmoulya/voice';
import type { SpeechToTextPort, TextToSpeechPort } from '@vedmoulya/voice';
import { createVoiceBrainPort, createVoiceAnswerPort } from '../infrastructure/VoiceBridgePorts.js';
import { ProactiveIntelligenceService } from '@vedmoulya/proactive';
import { ActiveIntelligenceControlPlane } from '@vedmoulya/control-plane';
import { WorldModelService } from '@vedmoulya/world-model';
import {
  createControlBrainPort,
  createControlProactivePort,
  createControlFabricPort,
  createControlStores,
} from '../infrastructure/ControlBridgePorts.js';
import {
  createCommandCenterPresentationPort,
  createWorldActionPort,
  createWorldApprovalPort,
  createWorldBrainPort,
  createWorldControlPort,
  createWorldCostPort,
  createWorldFabricPort,
  createWorldProactivePort,
  createWorldStores,
  resolveWorldSignalSources,
} from '../infrastructure/WorldBridgePorts.js';
import {
  createProactiveBrainPort,
  createProactiveCapabilityPort,
} from '../infrastructure/ProactiveBridgePorts.js';
import { IntelligenceFabricService, ProviderHealthLedger } from '@vedmoulya/intelligence-fabric';
import {
  createFabricCostPort,
  createFabricProviderPort,
} from '../infrastructure/FabricBridgePorts.js';
import { AutomationBoundaryEngine } from '@vedmoulya/capability-marketplace';
import type {
  OutcomeMemoryLike,
  PersistenceBundle,
  PersistenceStoreOverrides,
} from '../infrastructure/PersistenceStores.js';
import {
  createProductionApplicationRepository,
  createProductionRequirementSessionStore,
  createProductionIdentityRepository,
  createProductionMemoryRepository,
  createProductionDecisionRepository,
  createProductionExecutionRepository,
  createProductionKnowledgeRepository,
  createProductionContentAgencyRepository,
  createProductionClientOpsRepository,
  createProductionCapabilityRepository,
  createProductionContextRepository,
  createProductionExecutionStrategyRepository,
  createProductionGoalRepository,
  createProductionTaskRepository,
  createProductionPipelineRepository,
  createProductionLearningRepository,
  createProductionBrainRepository,
  createProductionKnowledgeIntelligenceRepository,
  createProductionMemoryIntelligenceRepository,
  createProductionOSIntelligenceRepository,
  createProductionContextFabricRepository,
  createProductionProviderRepository,
  createProductionRagRepository,
  awaitAllEngineEnsureTables,
} from '../infrastructure/ProductionRepositories.js';

// ── ApiApplicationService ───────────────────────────────────────────────────

/**
 * Options for constructing the API Gateway application service.
 */
export interface ApiApplicationServiceOptions {
  /**
   * Identity repository override. Defaults to the production
   * `PostgresIdentityRepository` resolved through the identity module's
   * existing DI registration (SPRINT PR-002A). Inject a custom repository
   * (e.g. an in-memory one) for tests or alternate persistence.
   */
  identityRepository?: IdentityRepository;
  /**
   * Memory repository override. Defaults to the production
   * `PostgresMemoryRepository` resolved through the memory module's existing
   * DI registration (SPRINT PR-002B).
   */
  memoryRepository?: MemoryRepository;
  /**
   * Decision repository override. Defaults to the production
   * `PostgresDecisionRepository` resolved through the decision module's
   * existing DI registration (SPRINT PR-002B).
   */
  decisionRepository?: DecisionRepository;
  /**
   * Execution repository override. Defaults to the production
   * `PostgresExecutionRepository` resolved through the execution module's
   * existing DI registration (SPRINT PR-002B).
   */
  executionRepository?: ExecutionRepository;
  /**
   * Knowledge repository override. Defaults to the production
   * `PostgresKnowledgeRepository` resolved through the knowledge module's
   * existing DI registration (SPRINT PR-002B).
   */
  knowledgeRepository?: KnowledgeRepository;
  /**
   * Content Agency repository override. Defaults to the production
   * `PostgresContentAgencyRepository` resolved through the content-agency
   * module's existing DI registration (EPIC-003 / AC-001).
   */
  contentAgencyRepository?: ContentAgencyRepository;
  /**
   * Client Operations repository override. Defaults to the production
   * `PostgresClientOpsRepository` resolved through the content-agency
   * module's DI registration (EPIC-003 / AC-002).
   */
  clientOpsRepository?: ClientOpsRepository;
  /**
   * Capability repository override. Production default: Postgres-backed
   * Enterprise Capability Registry (EI-001, CERT-002 C-04). The registry
   * is a platform catalog (not user-scoped), shared across all users.
   * Tests inject the seeded in-memory registry via options.
   */
  capabilitiesRepository?: CapabilityRepository;
  /**
   * Provider repository override. Production default: Postgres-backed
   * Enterprise Provider Registry (EI-002, CERT-002 C-04). The registry is
   * a platform catalog (not user-scoped), shared across all users. Tests
   * inject the seeded in-memory registry via options.
   */
  providersRepository?: ProviderRepository;
  /**
   * Context repository override. Production default: Postgres-backed
   * Enterprise Context Registry (EI-003, CERT-002 C-04). The registry is
   * a platform catalog (not user-scoped), shared across all users. Tests
   * inject the seeded in-memory registry via options.
   */
  contextRepository?: ContextRepository;
  /**
   * Execution Strategy repository override. Production default:
   * Postgres-backed Enterprise Execution Strategy Engine (EI-004,
   * CERT-002 C-04). The engine is a platform catalog (not user-scoped),
   * shared across all users. Tests inject the seeded in-memory registry
   * via options.
   */
  executionStrategyRepository?: ExecutionStrategyRepository;
  /**
   * Execution Orchestrator repository/registry overrides (EPIC-004 / EI-005).
   * Defaults to the seeded in-memory graph/session/queue/worker/history
   * stores. Inject overrides for tests or alternate persistence.
   */
  orchestratorRepositories?: {
    graphs?: ExecutionGraphRepository;
    sessions?: ExecutionSessionRepository;
    queues?: ExecutionQueueRepository;
    workers?: WorkerRegistry;
    history?: ExecutionHistoryRepository;
  };
  /**
   * Goal & Task Intelligence repository overrides (EPIC-004 / EI-006).
   * Defaults to the seeded in-memory goal + task stores. Inject overrides
   * for tests or alternate persistence.
   */
  goalRepositories?: {
    goals?: GoalRepository;
    tasks?: TaskRepository;
  };
  /**
   * Enterprise Learning Intelligence repository override (EPIC-004 / EI-007).
   * Production default: Postgres-backed `learning_registry` (events +
   * safety decisions). Tests inject the seeded in-memory store via options.
   */
  learningRepository?: LearningRepository;
  /**
   * Enterprise Brain repository override (EPIC-004 / EI-008). Production
   * default: Postgres-backed `brain_registry` (decision plans + decisions).
   * Tests inject the seeded in-memory store via options.
   */
  brainRepository?: BrainRepository;
  /**
   * Enterprise Knowledge Intelligence repository override (EPIC-004 / EI-009).
   * Production default: Postgres-backed `knowledge_registry` (items +
   * relationship edges). Tests inject the seeded in-memory store via options.
   */
  knowledgeIntelligenceRepository?: KnowledgeIntelligenceRepository;
  /**
   * Enterprise Memory Intelligence repository override (EPIC-004 / EI-010).
   * Production default: Postgres-backed `memory_registry` (memory items +
   * relationship edges). Tests inject the seeded in-memory store via options.
   */
  memoryIntelligenceRepository?: MemoryIntelligenceRepository;
  /**
   * Enterprise Operating System snapshot repository override (EPIC-005 / OS-001).
   * Production default: Postgres-backed `os_health_registry` (health snapshots
   * for the OS dashboard history). Tests inject the in-memory store via options.
   */
  osIntelligenceRepository?: OSIntelligenceRepository;
  /**
   * Context Fabric graph repository override (APP-001). Production default:
   * Postgres-backed `context_fabric_registry` (entities + relationships as
   * JSONB documents). Tests inject the in-memory graph store via options.
   */
  contextFabricRepository?: ContextFabricGraphRepository;
  /**
   * RAG repository override (AI-RUNTIME-002). Production default: Postgres
   * + pgvector `rag_chunks`. Tests inject the in-memory store via options.
   */
  ragRepository?: RagRepository;
  /**
   * RAG embedding provider override (AI-RUNTIME-002). Production default:
   * SDK-backed OpenAI embeddings when OPENAI_API_KEY is present, otherwise
   * the deterministic mock. Tests inject a stub via options.
   */
  ragEmbeddingProvider?: EmbeddingProvider;
  /**
   * Application Factory project repository override (EPIC-008 Phase 1).
   * Production default: Postgres-backed `application_projects` registry
   * (projects survive server restart). Tests inject the in-memory store
   * via options.
   */
  factoryRegistry?: ApplicationProjectRepository;
  /**
   * Requirement session store override (EPIC-009). Production default:
   * Postgres-backed `requirement_sessions` registry (sessions survive
   * server restart). Tests inject the in-memory store via options.
   */
  requirementSessionStore?: RequirementSessionStore;
  /**
   * Optional AI enrichment port override (EPIC-009). Default: a narrow
   * adapter over the frozen AIOrchestratorSpecialistPort (single economy
   * classification call, non-fatal). Tests inject a stub or omit it.
   */
  requirementEnrichment?: RequirementEnrichmentPort;
  /**
   * Execution run store override (EPIC-014). Production default: Postgres
   * store (in-memory in dev/test — same convention as the capability plan
   * store). Inject for tests or alternate persistence.
   */
  executionRunStore?: ExecutionRunStore;
  /**
   * Preference ledger override (EPIC-014 Phase 5). Default: bounded
   * in-memory ledger (append-only, provenance preserved).
   */
  executionLedger?: PreferenceLedgerPort;
  /**
   * Step execution port override (EPIC-014). Default: a narrow adapter
   * over the frozen AIOrchestratorSpecialistPort (the same runtime the
   * loop/factory reuse). Tests inject a deterministic fake port.
   */
  executionPort?: StepExecutionPort;
  /**
   * Execution budget override (EPIC-014). Default: env-tunable hard limits
   * (AI_EXECUTION_MAX_*) consumed by the LoopBudget-backed guard.
   */
  executionBudget?: ExecutionBudgetConfig;
  /**
   * SPRINT-022 — Persistent Intelligence Foundation store overrides.
   * Production default: Postgres write-through stores (in-memory mirror +
   * async idempotent upserts + boot hydration + shutdown flush) — scheduler,
   * Brain, Intelligence, Bridge and AI World state survive process restart
   * with owner isolation. Development/test default: the deterministic
   * in-memory stores (hermetic convention). Inject individual store
   * overrides for tests or alternate persistence.
   */
  persistence?: PersistenceStoreOverrides;
}

/**
 * Top-level application service that creates and manages all certified
 * backend services. This is the single entry point for the API Gateway.
 *
 * Follows the BLD-016A architecture:
 *   ApiApplicationService
 *   ├── Infrastructure Services (Identity, Memory, Decision, Execution, Knowledge, AI)
 *   ├── Domain Module Services (Dashboard, Career, Learning, Business, Marketplace)
 *   └── Integration Layer (LifeOS)
 *
 * SPRINT PR-002A: the Identity application service is now wired to the real
 * production `PostgresIdentityRepository` (reusing the identity module's DI
 * registration) instead of the in-memory development repository, so the
 * complete authenticated request path resolves against real persistence.
 */
export class ApiApplicationService {
  // ── Infrastructure Services ───────────────────────────────────────────────
  readonly identity: IdentityApplicationService;
  readonly memory: MemoryApplicationService;
  readonly decision: DecisionApplicationService;
  readonly execution: ExecutionApplicationService;
  readonly knowledge: KnowledgeApplicationService;
  readonly ai: AIOrchestrationService;

  // ── Domain Module Services ────────────────────────────────────────────────
  readonly dashboard: DashboardApplicationService;
  readonly career: CareerApplicationService;
  readonly learning: LearningApplicationService;
  readonly business: BusinessApplicationService;
  readonly marketplace: MarketplaceApplicationService;
  readonly contentAgency: ContentAgencyApplicationService;
  readonly clientOps: ClientOperationsApplicationService;

  // ── Enterprise Capability Registry (EPIC-004 / EI-001) ────────────────────
  readonly capabilities: CapabilityApplicationService;

  // ── Enterprise Provider Registry (EPIC-004 / EI-002) ──────────────────────
  readonly providers: ProviderApplicationService;

  // ── Enterprise Context Registry (EPIC-004 / EI-003) ───────────────────────
  readonly context: ContextApplicationService;

  // ── Enterprise Execution Strategy Engine (EPIC-004 / EI-004) ──────────────
  readonly executionStrategy: ExecutionStrategyApplicationService;

  // ── Enterprise Execution Orchestrator (EPIC-004 / EI-005) ─────────────────
  readonly executionOrchestrator: OrchestratorApplicationService;

  // ── Enterprise Goal & Task Intelligence Engine (EPIC-004 / EI-006) ────────
  readonly goals: GoalsApplicationService;

  // ── Enterprise Intelligence Integration Platform (EPIC-004 / EI-006 / INT-001) ──
  readonly intelligence: IntelligenceApplicationService;

  // ── Enterprise Learning Intelligence Platform (EPIC-004 / EI-007) ────────
  readonly learningIntelligence: LearningIntelligenceApplicationService;

  // ── Enterprise Brain (EPIC-004 / EI-008) ──────────────────────────────────
  readonly enterpriseBrain: BrainApplicationService;

  // ── Enterprise Knowledge Intelligence Platform (EPIC-004 / EI-009) ────────
  readonly knowledgeIntelligence: KnowledgeIntelligenceApplicationService;

  // ── Enterprise Memory Intelligence Platform (EPIC-004 / EI-010) ───────────
  readonly memoryIntelligence: MemoryIntelligenceApplicationService;

  // ── Enterprise Operating System Integration Layer (EPIC-005 / OS-001) ─────
  readonly osIntelligence: OSApplicationService;

  // ── Context & Personal Intelligence Fabric (APP-001) ──────────────────────
  readonly contextFabric: ContextFabricApplicationService;

  // ── Enterprise RAG Platform (EPIC-005 / AI-RUNTIME-002) ───────────────────
  readonly rag: RagApplicationService;

  // ── Orchestrated AI Loop Engine (EPIC-006) ────────────────────────────────
  readonly loop: LoopApplicationService;

  // ── AI Application Factory (EPIC-007) ─────────────────────────────────────
  readonly factory: FactoryApplicationService;

  // ── Product Intelligence & Requirements Engine (EPIC-009) ─────────────────
  readonly requirements: RequirementsApplicationService;

  // ── Adaptive Application Experience & Visual Intelligence (EPIC-010) ───────
  readonly experience: ExperienceApplicationService;

  // ── AI World Discovery (EPIC-012C) ───────────────────────────────────────
  readonly aiWorld: DiscoveryApplicationService;

  // ── AI Capability Marketplace & Factory Intelligence (EPIC-013) ─────────
  readonly capability: CapabilityMarketplaceApplicationService;

  // ── Capability Execution Engine (EPIC-014) ───────────────────────────────
  readonly executionRun: ExecutionRunService;

  // ── The VedMoulya Brain (EPIC-016) ──────────────────────────────────────
  readonly brain: VedMoulyaBrainService;

  // ── VedMoulya Intelligence (EPIC-015) ──────────────────────────────────
  readonly ecosystemIntelligence: EcosystemIntelligenceApplicationService;

  // ── Ecosystem Workflow Execution (SPRINT-052) ──────────────────────────
  readonly ecosystemWorkflow: import('@vedmoulya/ecosystem').WorkflowExecutionService;

  // ── Live Intelligence Bridge (EPIC-017) ────────────────────────────────
  readonly liveIntelligence: LiveIntelligenceBridgeService;

  // ── AI World Scheduler & Discovery Engine (EPIC-018) ──────────────────
  readonly aiWorldScheduler: SchedulerApplicationService;

  // ── EPIC-020 — Continuous Intelligence (dashboard composition) ────────
  readonly brainDashboard: BrainDashboardService;

  // ── SPRINT-093 — Orchestration Fabric ────────────────────────────────
  /** Central orchestration service — work queuing, priority scheduling,
   *  concurrency control, provider routing, backpressure, cancellation.
   *  The orchestrator does NOT create database connections — it delegates
   *  to engines which use DatabaseManager's shared bounded pool. */
  readonly orchestrator: import('@vedmoulya/orchestration-fabric').OrchestratorService;
  /** Brain's durable outcome memory (shared with the dashboard). */
  readonly brainOutcomeMemory: OutcomeMemoryLike;

  // ── SPRINT-022 — Persistent Intelligence Foundation ───────────────────
  /** The resolved persistence bundle shared across every engine's store ports. */
  readonly persistence: PersistenceBundle;

  // ── SPRINT-027 — Voice foundation (speech seams + conversation store) ──
  /** Narrow speech/voice composition seam — NOT a voice engine. */
  readonly voice: SpeechApplicationService;

  // ── SPRINT-028 — Voice Assistant (voice → Brain bridge) ───────────────
  /** The one-turn voice assistant — composes the EXISTING Brain pipeline
   *  (createTask/plan/approve) + the EXISTING AI Q&A runtime. Never a
   *  voice engine: no planning/execution/approval/learning logic here. */
  readonly voiceAssistant: VoiceAssistantService;

  // ── SPRINT-029 — Proactive Intelligence (composition seam) ───────────
  /** Turns existing Brain/scheduler/marketplace/execution intelligence into
   *  evidence-only, authorization-aware recommendations. NOT an engine — it
   *  composes the frozen estate (brain.discoverIntelligence, dailyPriorities,
   *  listOpportunities/listTasks, AutomationBoundaryEngine). */
  readonly proactive: ProactiveIntelligenceService;

  // ── SPRINT-030 — Intelligence Fabric (composition seam) ─────────────
  /** The provider-neutral orchestration contract: observed provider health,
   *  fail-closed cost policy, autonomy levels, advisory selection strategies,
   *  result normalization, bounded verification chains and workflow bounds.
   *  NOT an engine — composes the real CostLedger (measures), the real
   *  provider registry (evidence) and the real proactive layer (cadence). */
  readonly fabric: IntelligenceFabricService;

  // ── SPRINT-031 — Active Intelligence Control Plane (composition seam) ──
  /** Coordinates the existing estate into a CONTROLLED continuous-intelligence
   *  lifecycle: observe → discover → assess → prioritize → propose → gate.
   *  Enforces the user's explicit autonomy settings + emergency stop through
   *  the existing AutonomyPolicy + CostPolicyGuard. NOT an engine — the cycle
   *  NEVER executes anything (executedNothing:true is structural); approval
   *  stays with the Brain, execution with the execution bridge, memory/learning
   *  with the existing outcome memory. */
  readonly controlPlane: ActiveIntelligenceControlPlane;

  // ── SPRINT-032 — World Model & Business Operating System (composition seam) ──
  /** The minimum useful world representation for better decisions: a bounded
   *  owner-scoped typed graph over EXISTING entities, configurable business
   *  units, evidence-only opportunity economics, a provider-neutral AI
   *  workforce role abstraction, a generic bounded workflow factory and an
   *  honest external-world signal interface. NOT an engine — no discovery,
   *  no provider selection, no approval, no spending, no execution and no
   *  memory promotion: every authority stays in the frozen estate and is
   *  reached through the WorldBridgePorts seams. */
  readonly world: WorldModelService;

  // ── EPIC-012A — Provider Experience & Preferences ────────────────────────
  readonly preferencesService: ProviderPreferencesService;
  readonly modelSelection: ModelSelectionIntelligence;
  readonly providerExperience: ProviderExperienceService;

  // ── EPIC-012 — Production Observability & Control Plane ───────────────────
  /** The correlated execution-trace spine (also the engine TelemetryPort). */
  readonly traceProvider: ExecutionTraceProvider;
  /** The operational control surface (ops.* namespace). */
  readonly ops: OpsApplicationService;

  // ── Integration Layer ─────────────────────────────────────────────────────
  readonly lifeOS: LifeOSApplicationService;

  // ── Infrastructure Health (PH-002/T3 follow-up) ────────────────────────────
  readonly infrastructureHealth: InfrastructureHealthProbe;

  // ── EPIC-018 closure — AI World cadence driver status ────────────────────
  // Bound once at the route layer when the cadence driver starts (the driver
  // lives in observability, not in this service). Before/without the driver
  // the source reports the honest inactive state — the UI never shows
  // "scheduled" when no runtime caller exists.
  private schedulerRuntimeSource: () => SchedulerRuntimeStatus = () => ({
    active: false,
    reason: 'not_started',
    maxUsersPerTick: 0,
    refreshIntelligenceEnabled: false,
    proactiveRefreshEnabled: false,
  });

  /** The aiWorldScheduler.* runtime-status source (never undefined). */
  readonly schedulerRuntimeStatus = (): SchedulerRuntimeStatus => this.schedulerRuntimeSource();

  /** Bind the cadence driver status (called once at gateway startup). */
  setSchedulerRuntimeStatusSource(source: () => SchedulerRuntimeStatus): void {
    this.schedulerRuntimeSource = source;
  }

  // ── SPRINT-022 — persistence lifecycle ────────────────────────────────

  /**
   * Hydrate the persistence bundle (load persisted state into the sync
   * mirrors). Bounded — never blocks boot forever when the database is
   * unreachable; a timeout degrades to empty mirrors with loud logging
   * (the write-through stores keep working from that point forward).
   */
  async hydratePersistence(): Promise<void> {
    // SPRINT-080C — ensure Memory/Decision/Execution tables exist before
    // hydration queries run (the engine pools are constructed synchronously;
    // without this, the first SELECT races the async CREATE TABLE).
    await awaitAllEngineEnsureTables();
    const bounded = Promise.race([
      this.persistence.hydrate(),
      new Promise<void>((resolve) => {
        setTimeout(resolve, 15_000);
      }),
    ]);
    await bounded;
  }

  /**
   * Flush pending persistence writes (shutdown). Bounded + error-isolated:
   * a database outage at shutdown is logged loudly — restart durability is
   * exactly what is lost — and never blocks the process exit.
   */
  async flushPersistence(): Promise<void> {
    const bounded = Promise.race([
      this.persistence.flush(),
      new Promise<void>((resolve) => {
        setTimeout(resolve, 10_000);
      }),
    ]);
    await bounded;
  }

  constructor(options: ApiApplicationServiceOptions = {}) {
    // AI-RUNTIME-002 C-07: production must explicitly configure the AI
    // runtime — provider, RAG database, token budgets, timeout, tool policy.
    // Fail fast here (lazy construction happens on the first real request)
    // instead of silently serving dev mocks in production.
    validateProductionAIConfig();
    // SPRINT-022 — Persistent Intelligence Foundation: ONE persistence
    // bundle (in-memory for dev/test/CI; Postgres write-through in
    // production/staging) injected into every engine's frozen store ports.
    // The engines keep their synchronous contracts — the backend is
    // invisible to them.
    const persistence = resolvePersistenceBundle(options.persistence);
    this.persistence = persistence;
    // SPRINT-027 (R-2) — durable gateway audit logging: every middleware/routes
    // audit write flows into the bundle's owner-scoped audit store (in-memory
    // in dev/test; Postgres write-through in production/staging). Routers keep
    // using the unchanged createRequestAudit API.
    setAuditStore(persistence.auditLogs);
    // SPRINT-027/028 — the voice foundation: narrow speech seams
    // (SpeechToTextPort/TextToSpeechPort) + the owner-scoped bounded
    // conversation store, wired into the SAME persistence bundle.
    // SPRINT-028: REAL provider-neutral runtime adapters are used when the
    // operator configures them (VOICE_STT_BASE_URL / VOICE_TTS_BASE_URL, the
    // OpenAI-compatible audio contract — OpenAI, Groq, Deepgram, Azure,
    // ElevenLabs all speak it). Otherwise the deterministic mocks serve, and
    // the status reports MOCK honestly. Production refuses mock speech unless
    // VOICE_ENABLE_MOCK=true (mirrors AI_ENABLE_MOCK). Provider credentials
    // stay server-side; nothing is exposed to the browser.
    const voiceSpeechPorts = resolveVoiceRuntimeAdapters();
    this.voice = new SpeechApplicationService({
      stt: voiceSpeechPorts.stt,
      tts: voiceSpeechPorts.tts,
      conversations: persistence.voice.conversations,
      allowMockInProduction: process.env.VOICE_ENABLE_MOCK === 'true',
    });
    this.infrastructureHealth = new InfrastructureHealthProbe();
    // ── Create infrastructure services ────────────────────────────────
    //     All five engines use their production Postgres repositories,
    //     resolved through each service module's existing DI registration
    //     (SPRINT PR-002A identity + PR-002B memory/decision/execution/
    //     knowledge — no duplicate wiring, lazy-connect clients). Inject
    //     overrides (e.g. the Map-backed in-memory repositories from
    //     services/api/src/infrastructure/InMemoryRepositories.ts) for
    //     tests or alternate persistence.
    this.identity = new IdentityApplicationService(
      options.identityRepository ?? createProductionIdentityRepository(),
    );
    this.memory = new MemoryApplicationService(
      options.memoryRepository ?? createProductionMemoryRepository(),
    );
    this.decision = new DecisionApplicationService(
      options.decisionRepository ?? createProductionDecisionRepository(),
    );
    this.execution = new ExecutionApplicationService(
      options.executionRepository ?? createProductionExecutionRepository(),
    );
    this.knowledge = new KnowledgeApplicationService(
      options.knowledgeRepository ?? createProductionKnowledgeRepository(),
    );
    // EPIC-012: the correlated trace spine. It doubles as the engine
    // TelemetryPort, so every engine span lands in one reconstructable trace
    // (USER → REQUIREMENTS → FACTORY → LOOP → AI → RAG → PROVIDER → QUALITY →
    // REFINEMENT → DEPLOYMENT). The AI runtime's observability seam is bridged
    // onto it, so ai.* spans parent under the active engine span.
    // EPIC-012 security: every string attribute/event value is redacted via the
    // AI runtime's redactSecrets before it can land in a trace — user-derived
    // data (e.g. the factory goal attribute) can never leak secrets.
    this.traceProvider = new ExecutionTraceProvider({ redact: redactSecrets });
    const telemetry: TelemetryPort = this.traceProvider;
    // SPRINT-034 — ONE CostLedger instance is shared between the ops surface
    // and the world-model cost port (the world model only READS measured cost;
    // CostLedger stays the single accounting authority).
    const costLedger = new CostLedger();

    // AI-RUNTIME-002: the orchestrator is constructed with the EI-003
    // context-optimization pipeline and the prompt cache; the EI-002/EI-004
    // intelligence ports and the RAG retrieval port are wired below once the
    // registry application services exist. EPIC-012: the AIObservability seam
    // is now ACTIVE in production — bridged onto the trace spine (no OTLP
    // credentials required; works with the in-process store, and operators
    // can additionally point OTEL_EXPORTER_OTLP_ENDPOINT at a collector).
    this.ai = new AIOrchestrationService({
      contextOptimizer: new ContextOptimizer(),
      promptCache: new PromptCacheManager(),
      observability: new AIObservability({
        exporter: new OtelAIObservabilityExporter(new TraceProviderOtelBridge(this.traceProvider)),
      }),
    });
    // AI-RUNTIME-001 (EPIC-005): the gateway AI orchestrator was previously
    // constructed with no provider adapters registered — every real AI call
    // (Content Agency generation, ClientOps proposal drafting, Career/
    // Business/Learning/Marketplace insight assemblies) threw
    // NotFoundError('Provider', …) in production. Register the platform
    // providers through the single @vedmoulya/orchestrator registration
    // point: MockProvider in non-production environments, OpenAIProvider
    // when OPENAI_API_KEY is present. Production never silently serves
    // synthetic responses (mock requires AI_ENABLE_MOCK=true).
    registerPlatformProviders(this.ai);

    // ── Create domain module services ──────────────────────────────────
    this.dashboard = new DashboardApplicationService(
      this.identity,
      this.memory,
      this.decision,
      this.execution,
      this.knowledge,
      this.ai,
    );
    this.career = new CareerApplicationService(
      this.identity,
      this.memory,
      this.decision,
      this.execution,
      this.knowledge,
      this.ai,
    );
    this.learning = new LearningApplicationService(
      this.identity,
      this.memory,
      this.decision,
      this.execution,
      this.knowledge,
      this.ai,
    );
    this.business = new BusinessApplicationService(
      this.identity,
      this.memory,
      this.decision,
      this.execution,
      this.knowledge,
      this.ai,
    );
    this.marketplace = new MarketplaceApplicationService(
      this.identity,
      this.memory,
      this.decision,
      this.execution,
      this.knowledge,
      this.ai,
    );

    // ── Create the Content Agency module (EPIC-003 / AC-001) ────────────
    //    Reuses the shared AI Orchestrator + Memory/Knowledge engines.
    this.contentAgency = new ContentAgencyApplicationService(
      options.contentAgencyRepository ?? createProductionContentAgencyRepository(),
      new ContentAgencyAIService(this.ai, {
        memory: this.memory,
        knowledge: this.knowledge,
      }),
    );

    // ── Create the Client Operations module (EPIC-003 / AC-002) ─────────
    //    Reuses the AC-001 application service (clients, projects, content,
    //    invoices) and the shared AI Orchestrator — no duplicated logic.
    this.clientOps = new ClientOperationsApplicationService(
      options.clientOpsRepository ?? createProductionClientOpsRepository(),
      this.contentAgency,
      new ClientOpsAIService(this.ai),
    );

    // ── Create the Enterprise Capability Registry (EPIC-004 / EI-001) ────
    //    A reusable platform catalog consumed by every business module.
    //    Production default: Postgres-backed repository (CERT-002 C-04).
    //    Tests inject the seeded in-memory registry via options.
    this.capabilities = new CapabilityApplicationService(
      options.capabilitiesRepository ?? createProductionCapabilityRepository(),
    );

    // ── Create the Enterprise Provider Registry (EPIC-004 / EI-002) ──────
    //    Providers are enterprise assets: discoverable, health-monitored,
    //    capability-mapped, costed. Production default: Postgres-backed
    //    repository (CERT-002 C-04, same factory pattern as the other EI
    //    stores); tests inject the seeded in-memory registry via options.
    this.providers = new ProviderApplicationService(
      options.providersRepository ?? createProductionProviderRepository(),
    );

    // ── EPIC-012A — Owner-Scoped Provider Preferences ────────────────
    //    Per-user preferences (enabled set, preferred model, budget policy)
    //    layered over the global registry. Gateway's authMiddleware sets
    //    the request context so routing discovery immediately respects the
    //    user's enabled providers. In-memory store is the hermetic default;
    //    production can inject a Postgres-backed store via options.
    const preferencesStore = new InMemoryProviderPreferencesStore();
    this.preferencesService = new ProviderPreferencesService(preferencesStore);

    // ── EPIC-012B — Provider Intelligence cache ─────────────────────
    //    Bounded in-memory cache of refresh results (profiles + staleness).
    //    The UI never re-derives intelligence on every render, and routing
    //    candidates exclude models the intelligence layer marked
    //    unavailable/deprecated. Production can inject a Postgres-backed
    //    store via the intelligence infrastructure options.
    const intelligenceStore = new InMemoryProviderIntelligenceStore();

    // Give the registry service access to the preferences store for
    // routing-candidate filtering (listByCapability/listByFamily) and to
    // the intelligence store for cache-first reads + safe refresh.
    this.providers = new ProviderApplicationService(
      options.providersRepository ?? createProductionProviderRepository(),
      preferencesStore,
      { store: intelligenceStore },
    );

    // ── Create the Enterprise Context Registry (EPIC-004 / EI-003) ────────
    //    Context is the intelligence layer that decides WHAT information,
    //    HOW MUCH, WHICH, and IN WHAT ORDER is sent to AI. Ranking,
    //    filtering, compression, and assembly are pure intelligence —
    //    no execution decisions. Production default: Postgres-backed
    //    repository (CERT-002 C-04); tests inject in-memory via options.
    this.context = new ContextApplicationService(
      options.contextRepository ?? createProductionContextRepository(),
    );

    // ── Create the Enterprise Execution Strategy Engine (EPIC-004 / EI-004) ──
    //    Given a Goal, the EES determines WHAT to execute, WHICH capabilities
    //    are required, WHICH providers are eligible, HOW work should be divided,
    //    HOW MUCH context/tokens/budget to use, whether execution is sequential
    //    or parallel, WHAT quality must be achieved, and WHAT fallback strategy
    //    to use. The engine creates the strategy — it does NOT execute work.
    //    Production default: Postgres-backed repository (CERT-002 C-04);
    //    tests inject the seeded in-memory registry via options.
    this.executionStrategy = new ExecutionStrategyApplicationService(
      options.executionStrategyRepository ?? createProductionExecutionStrategyRepository(),
    );

    // ── Create the Enterprise RAG Platform (EPIC-005 / AI-RUNTIME-002) ────
    //    Real production RAG: Postgres + pgvector repository, SDK-backed
    //    OpenAI embeddings in production (deterministic mock otherwise).
    //    The runtime consumes it through the narrow retrieval port below.
    this.rag = new RagApplicationService({
      repository: options.ragRepository ?? createProductionRagRepository(),
      embeddingProvider:
        options.ragEmbeddingProvider ??
        createOpenAIEmbeddingProvider() ??
        new MockEmbeddingProvider(),
      telemetry,
    });

    // ── EPIC-012A — Model Selection Intelligence ───────────────────────
    //    A thin layer over the frozen ProviderRoutingAdvisor (Phase 12–16).
    //    Constructed with the same provider + execution strategy ports the
    //    AI runtime uses — never duplicates routing.
    this.modelSelection = new ModelSelectionIntelligence(
      createProviderIntelligencePort(this.providers, intelligenceStore),
      createExecutionStrategyPort(this.executionStrategy),
    );

    // ── Wire the AI runtime intelligence (AI-RUNTIME-002) ─────────────────
    //    The orchestrator now genuinely routes on EI-002 provider
    //    intelligence + EI-004 execution strategy and retrieves enterprise
    //    knowledge through the RAG port — consuming the real application
    //    services, never duplicating them.
    this.ai.configureIntelligence({
      providerIntelligence: createProviderIntelligencePort(this.providers, intelligenceStore),
      executionStrategy: createExecutionStrategyPort(this.executionStrategy),
      rag: createRagRetrievalPort(this.rag),
    });

    // ── Create the Enterprise Execution Orchestrator (EPIC-004 / EI-005) ────
    //    Converts an Execution Strategy into an executable workflow: graph,
    //    planner, scheduler, workers, queue, sessions, state machine, monitor,
    //    events, recovery, validation, history. Orchestrates execution — never
    //    runs AI. Runtime engines (Hatchet, LangGraph) are adapters.
    //    Defaults to in-memory stores; overrides can be injected for tests.
    this.executionOrchestrator = new OrchestratorApplicationService(
      options.orchestratorRepositories?.graphs ?? new InMemoryExecutionGraphRepository(),
      options.orchestratorRepositories?.sessions ?? new InMemoryExecutionSessionRepository(),
      options.orchestratorRepositories?.workers ?? new InMemoryWorkerRegistry(),
      options.orchestratorRepositories?.queues ?? new InMemoryExecutionQueueRepository(),
      options.orchestratorRepositories?.history ?? new InMemoryExecutionHistoryRepository(),
    );

    // ── Create the Enterprise Goal & Task Intelligence Engine (EPIC-004 / EI-006) ──
    //    Transforms any user objective into a structured execution plan: goal
    //    registry, understanding, classification, hierarchy, lifecycle, task
    //    decomposition, prioritization, dependency DAG with critical path,
    //    milestones, success criteria, and validation. Understands goals — it
    //    never executes them. Defaults to the seeded in-memory stores; overrides
    //    can be injected for tests.
    this.goals = new GoalsApplicationService(
      options.goalRepositories?.goals ?? createProductionGoalRepository(),
      options.goalRepositories?.tasks ?? createProductionTaskRepository(),
    );

    // ── Create the Enterprise Intelligence Integration Platform (EI-006 / INT-001) ──
    //    Composes every Enterprise Intelligence engine into one validated pipeline:
    //    Goal → Capabilities → Providers → Context → Strategy → Graph → Session.
    //    No AI calls; sessions are created but never run.
    this.intelligence = new IntelligenceApplicationService(createProductionPipelineRepository(), {
      goals: this.goals,
      capabilities: this.capabilities,
      providers: this.providers,
      context: this.context,
      strategies: this.executionStrategy,
      orchestrator: this.executionOrchestrator,
    });

    // ── Create the Enterprise Learning Intelligence Platform (EPIC-004 / EI-007) ──
    //    Observes every execution across the six engines through narrow ports
    //    and turns outcomes into models, insights, recommendations, and
    //    reports. Learning never bypasses human approval: recommendations
    //    are born pending and only become actionable after an explicit,
    //    versioned, audited approval. Production default: Postgres-backed
    //    repository (learning_registry); tests inject in-memory via options.
    this.learningIntelligence = new LearningIntelligenceApplicationService(
      options.learningRepository ?? createProductionLearningRepository(),
      {
        goals: this.goals,
        capabilities: this.capabilities,
        providers: this.providers,
        context: this.context,
        strategies: this.executionStrategy,
        orchestrator: this.executionOrchestrator,
      },
    );

    // ── Create the Enterprise Brain (EPIC-004 / EI-008) ─────────────────
    //    The highest decision layer: consumes every Enterprise Intelligence
    //    engine through narrow ports (goals, learning, capabilities,
    //    providers, context, strategies, orchestrator) and produces fully
    //    explained decision plans. It DECIDES — it never executes. Production
    //    default: Postgres-backed repository (brain_registry); tests inject
    //    in-memory via options.
    this.enterpriseBrain = new BrainApplicationService(
      options.brainRepository ?? createProductionBrainRepository(),
      {
        goals: this.goals,
        learning: this.learningIntelligence,
        capabilities: this.capabilities,
        providers: this.providers,
        context: this.context,
        strategies: this.executionStrategy,
        orchestrator: this.executionOrchestrator,
      },
    );

    // ── Create the Enterprise Knowledge Intelligence Platform (EPIC-004 / EI-009) ──
    //    The Enterprise Knowledge Layer — the authoritative knowledge source
    //    used by every engine. Consumes every engine through narrow ports
    //    (goals, capabilities, providers, context, strategies, orchestrator,
    //    learning, brain) to cross-link knowledge items and register who
    //    consumes what — no duplicated logic. Production default: Postgres-
    //    backed repository (knowledge_registry); tests inject in-memory via
    //    options. The graph travels the same repository seam.
    this.knowledgeIntelligence = new KnowledgeIntelligenceApplicationService(
      options.knowledgeIntelligenceRepository ?? createProductionKnowledgeIntelligenceRepository(),
      new PostgresKnowledgeGraph(
        options.knowledgeIntelligenceRepository ??
          createProductionKnowledgeIntelligenceRepository(),
      ),
      {
        goals: this.goals,
        capabilities: this.capabilities,
        providers: this.providers,
        context: this.context,
        strategies: this.executionStrategy,
        orchestrator: this.executionOrchestrator,
        learning: this.learningIntelligence,
        brain: this.enterpriseBrain,
      },
    );

    // ── Create the Enterprise Memory Intelligence Platform (EPIC-004 / EI-010) ──
    //    The Enterprise Memory Layer — records, retrieves, ranks, compresses,
    //    consolidates, and expires evolving experience across the operating
    //    system. Consumes every engine through narrow ports (goals,
    //    capabilities, providers, context, strategies, orchestrator, learning,
    //    brain, knowledge) to link memories to live engine entities and
    //    register who retrieves what — no duplicated logic. Knowledge
    //    represents authoritative facts; memory represents evolving
    //    experience. The two systems stay architecturally separate but
    //    tightly integrated. Production default: Postgres-backed repository
    //    (memory_registry); tests inject in-memory via options.
    this.memoryIntelligence = new MemoryIntelligenceApplicationService(
      options.memoryIntelligenceRepository ?? createProductionMemoryIntelligenceRepository(),
      new PostgresMemoryGraph(
        options.memoryIntelligenceRepository ?? createProductionMemoryIntelligenceRepository(),
      ),
      {
        goals: this.goals,
        capabilities: this.capabilities,
        providers: this.providers,
        context: this.context,
        strategies: this.executionStrategy,
        orchestrator: this.executionOrchestrator,
        learning: this.learningIntelligence,
        brain: this.enterpriseBrain,
        knowledge: this.knowledgeIntelligence,
      },
    );

    // ── Create the Enterprise Operating System Integration Layer (EPIC-005 / OS-001) ──
    //    The integration layer that turns every Enterprise Intelligence Engine
    //    into one Enterprise Operating System — it integrates, validates,
    //    optimizes and certifies the complete platform. It consumes every
    //    engine through narrow OSEngines port contracts (goals, capabilities,
    //    providers, context, strategies, orchestrator, intelligence, learning,
    //    brain, knowledge, memory) and owns none — no duplicated logic, no
    //    engine modification. Production default: Postgres-backed snapshot
    //    repository (os_health_registry); tests inject in-memory via options.
    this.osIntelligence = new OSApplicationService(
      options.osIntelligenceRepository ?? createProductionOSIntelligenceRepository(),
      {
        goals: this.goals,
        capabilities: this.capabilities,
        providers: this.providers,
        context: this.context,
        strategies: this.executionStrategy,
        orchestrator: this.executionOrchestrator,
        intelligence: this.intelligence,
        learning: this.learningIntelligence,
        brain: this.enterpriseBrain,
        knowledge: this.knowledgeIntelligence,
        memory: this.memoryIntelligence,
      },
    );

    // ── Create the Context & Personal Intelligence Fabric (APP-001) ─────
    //    Post-V1 application-platform layer. Consumes the frozen EI engines
    //    (context, memory, knowledge, goals, capabilities) through narrow
    //    FabricEngines port contracts and owns none. Production default:
    //    Postgres-backed graph repository (context_fabric_registry); tests
    //    inject the in-memory graph store via options.
    this.contextFabric = new ContextFabricApplicationService(
      options.contextFabricRepository ?? createProductionContextFabricRepository(),
      {
        context: this.context,
        memory: this.memoryIntelligence,
        knowledge: this.knowledgeIntelligence,
        goals: this.goals,
        capabilities: this.capabilities,
      },
    );

    // ── Create the Orchestrated AI Loop Engine (EPIC-006) ────────────────
    //    Controlled, measurable, evidence-first orchestration. The loop
    //    engine executes NO AI directly: every specialist call flows through
    //    the frozen AIOrchestrationService via the AIOrchestratorSpecialistPort
    //    (AI-SELECT / EI-002 / EI-004 / EI-003 / Evidence-First inherited),
    //    evidence through the existing RAG retrieval port, and tools through
    //    the frozen ToolRuntime security chain (allowlist + capability +
    //    schema validation + rate limit + audit). No provider SDKs are
    //    imported here — the runtime is the single provider boundary.
    this.loop = new LoopApplicationService({
      specialist: new AIOrchestratorSpecialistPort(this.ai),
      rag: createLoopRagPort(this.rag),
      tools: createLoopToolPort(),
      telemetry,
    });

    // ── Create the AI Application Factory (EPIC-007) ────────────────────
    //    The APPLICATION FACTORY layer above the frozen platform. It reuses
    //    (never rebuilds): the same AIOrchestratorSpecialistPort over the AI
    //    runtime (AI-SELECT / EI-002 / EI-004 / EI-003 / Evidence-First), the
    //    frozen ToolRuntime secure tool chain, the EPIC-006 LoopEngine (the
    //    bounded generation loop over an application task graph), and the
    //    gateway clock. The factory adds ONLY the application layer: each
    //    generated application gets its OWN isolated workspace (Phase 14 —
    //    cross-application contamination prevented by construction), the
    //    deterministic project generator, validation/security/UI-quality
    //    gates, economics tracking, a safe local deployment adapter and an
    //    in-memory VCS journal (Phase 15 — never auto-pushes).
    this.factory = new FactoryApplicationService({
      specialist: new AIOrchestratorSpecialistPort(this.ai),
      tools: createLoopToolPort(),
      clock: new SystemClock(),
      workspace: new InMemoryWorkspace('factory-root', DEFAULT_EXECUTION_POLICY),
      policy: DEFAULT_EXECUTION_POLICY,
      deployments: {
        local: new LocalDeploymentAdapter(),
        vercel: new VercelDeploymentAdapter(),
      },
      versionControl: new InMemoryVersionControl(),
      workspaceFactory: (applicationId, policy): InMemoryWorkspace =>
        new InMemoryWorkspace(applicationId, policy),
      // EPIC-008 Phase 1: persistent application projects (Postgres in
      // production; in-memory injected by tests via options.factoryRegistry).
      registry: options.factoryRegistry ?? createProductionApplicationRepository(),
      telemetry,
    });

    // ── Create the Product Intelligence & Requirements Engine (EPIC-009) ─
    //    The INTELLIGENCE LAYER ABOVE the factory: understands the problem,
    //    extracts requirements with provenance, asks high-value questions,
    //    proposes safe defaults and produces the full product plan for user
    //    approval. The engines are deterministic; optional intent enrichment
    //    flows through the SAME frozen AI runtime the loop/factory reuse (a
    //    narrow, non-fatal adapter — never provider SDKs in product code).
    //    Sessions persist owner-scoped (Postgres in production; in-memory
    //    injected by tests via options.requirementSessionStore). The router
    //    composes `requirements.handoffToFactory` with this.factory so an
    //    approved product plan flows straight into factory.create.
    this.requirements = new RequirementsApplicationService({
      store: options.requirementSessionStore ?? createProductionRequirementSessionStore(),
      enrichment: options.requirementEnrichment ?? createRequirementEnrichmentPort(this.ai),
      telemetry,
    });

    // ── Create the Experience Intelligence layer (EPIC-010) ─────────────
    //    The ADAPTIVE APPLICATION EXPERIENCE & VISUAL INTELLIGENCE layer
    //    above the Application Factory: evaluates persisted generated
    //    applications against the design system, UI blueprint, visual
    //    critic, multi-dimensional quality model and traceability — and
    //    plans TARGETED refinement (never regenerate-all). Fully
    //    deterministic and provider-neutral; the OPTIONAL AI critique
    //    seam flows through the SAME frozen AI runtime the loop/factory
    //    reuse (a narrow, non-fatal adapter — never provider SDKs in
    //    product code; abstains when no provider is configured). The
    //    router resolves applications through this.factory.getDetail,
    //    so owner isolation (IDOR) is enforced at the factory engine.
    this.experience = new ExperienceApplicationService({
      aiCritique: createExperienceAICritiquePort(this.ai),
      telemetry,
    });

    // ── Create the AI World Discovery service (EPIC-012C) ───────────────
    //    Continuous, bounded, evidence-first discovery of the AI ecosystem.
    //    The default source is the static curated catalog (deterministic,
    //    evidence-honest — nothing fabricated). Live-source adapters are
    //    operator-extensible via the AIDiscoverySource port.
    this.aiWorld = new DiscoveryApplicationService({
      sources: [new StaticCatalogDiscoverySource()],
      store: persistence.discoveryStore,
      autoSeed: true,
    });

    // ── Create the AI Capability Marketplace (EPIC-013) ──────────────────
    //    Connects AI World intelligence with the factory ecosystem through
    //    narrow ports (no duplicate provider intelligence / AI World
    //    discovery / local-model discovery). The optional AI enrichment seam
    //    flows through the SAME frozen AI runtime the loop/factory reuse and
    //    is non-fatal: without a provider it abstains and the deterministic
    //    planner stands. Plans are owner-scoped + bounded in memory.
    this.capability = new CapabilityMarketplaceApplicationService({
      source: createCapabilitySourcePort({
        providers: this.providers,
        aiWorld: this.aiWorld,
        localModelDiscovery: new InMemoryLocalModelDiscovery(),
      }),
      store: new InMemoryCapabilityPlanStore(),
      enrichment: createCapabilityEnrichmentPort(this.ai),
    });

    // ── Create the Capability Execution Engine (EPIC-014) ────────────────
    //    PLAN → EXECUTE → VERIFY. Consumes the REAL EPIC-013 plan through
    //    the capability service (owner-scoped there), executes EXECUTABLE
    //    steps through the SAME frozen AI runtime (AIOrchestratorSpecialistPort
    //    — no new provider SDKs, routing/evidence/validation inherited),
    //    gates irreversible actions behind the run's approval runtime, records
    //    provenance-preserving preference facts (Phase 5) and persists
    //    checkpoints after every completed step. Hard limits come from the
    //    LoopBudget-backed RunBudgetGuard (fail-closed — never silently
    //    exceeded). Runs are owner-scoped; IDOR is refused at the service.
    // SPRINT-037 — the plan source is now orchestration-aware: an APPROVED
    // world-model OrchestrationPlan (SPRINT-036) adapts into the SAME bridge
    // plan shape; capability-marketplace plans still run through the SAME
    // ExecutionRunService. Exactly ONE execution pathway exists. `this.world`
    // is constructed later, so the world reference is lazy.
    this.executionRun = new ExecutionRunService({
      planSource: createOrchestrationAwarePlanSource(
        () => this.world,
        createExecutionPlanSource(this.capability),
      ),
      port: options.executionPort ?? createStepExecutionPort(this.ai),
      store: options.executionRunStore ?? new InMemoryExecutionRunStore(),
      ledger: options.executionLedger ?? new InMemoryPreferenceLedger(),
      budget: options.executionBudget ?? createExecutionBudgetConfig(),
      clock: new SystemClock(),
      maxRetries: 1,
    });

    // ── EPIC-012A — Provider Experience Service ────────────────────────
    //    Composes registry + preferences + cost ledger + trace store into
    //    the AI Providers view model, usage summary, and model selection
    //    explanation. Constructed BEFORE the Brain so the EPIC-020 usage
    //    port (mission §3) can consume real health/usage evidence.
    this.providerExperience = new ProviderExperienceService(
      this.providers,
      this.preferencesService,
      this.modelSelection,
      new CostLedger(),
      this.traceProvider.getStore(),
    );

    // ── Create The VedMoulya Brain (EPIC-016) ────────────────────────────
    //    The central intelligence & orchestration coordinator. Consumes the
    //    frozen estate through NARROW ports only: the EPIC-013 capability
    //    plan (the SAME plan the execution bridge consumes), the EPIC-012A/B
    //    provider + EPIC-012C AI World + local-model candidate sources (the
    //    SAME capability-source seam the planner/execution bridge reuse), the
    //    frozen AI orchestration specialist port for execution (EPIC-006
    //    reuse — no new provider SDKs), a minimal context assembler (never
    //    dumps the user profile), and the EPIC-014 preference ledger for
    //    provenance-preserving learning facts. The Brain orchestrates — it
    //    never rebuilds routing/execution/planner/security.
    const brainPortDeps = {
      capability: this.capability,
      capabilitySource: createCapabilitySourcePort({
        providers: this.providers,
        aiWorld: this.aiWorld,
        localModelDiscovery: new InMemoryLocalModelDiscovery(),
      }),
      ai: this.ai,
      preferenceLedger: new InMemoryPreferenceLedger(),
    };
    const brainPortDepsExtended = {
      ...brainPortDeps,
      providerExperience: this.providerExperience,
      aiWorld: this.aiWorld,
      memoryIntelligence: this.memoryIntelligence,
    };
    const brainOutcomeMemory = persistence.brain.outcomeMemory;
    this.brainOutcomeMemory = brainOutcomeMemory;
    this.brain = new VedMoulyaBrainService({
      plan: createBrainPlanPort(brainPortDeps),
      candidates: createBrainCandidatePort(brainPortDeps),
      execution: createBrainExecutionPort(brainPortDeps),
      context: createBrainContextPort(),
      preference: createBrainPreferencePort(brainPortDeps.preferenceLedger),
      // EPIC-020 — continuous intelligence seams (mission §3/§4/§8/§10/§12):
      usage: createBrainUsagePort(brainPortDepsExtended),
      experience: persistence.brain.adaptiveScores,
      memory: createBrainMemoryPort(brainPortDepsExtended),
      discovery: createBrainDiscoveryBridgePort(brainPortDepsExtended),
      opportunities: persistence.brain.opportunities,
      events: persistence.brain.events,
      tasks: persistence.brain.tasks,
      decisions: persistence.brain.decisions,
      clock: new SystemClock(),
      budget: {
        maxTokens: 10000,
        maxCostUsd: 0.5,
        maxIterations: 20,
        maxLatencyMs: 60000,
      },
      traceId: (): string => `trace-${Math.random().toString(36).slice(2, 10)}`,
    });

    // ── SPRINT-028 — the Voice Assistant (voice → Brain bridge) ────────
    // Composes the EXISTING Brain pipeline (createTask → plan → approve via
    // createVoiceBrainPort) and the EXISTING AI Q&A runtime (ANSWER intents
    // via createVoiceAnswerPort) with the speech seams + conversation store
    // from SPRINT-027. Zero new engines; VOICE ≠ AUTHORIZATION is enforced
    // by the assistant (sensitive turns end WAITING_FOR_APPROVAL and only
    // the non-voice confirmSensitive procedure may call the Brain's approve).
    this.voiceAssistant = new VoiceAssistantService({
      stt: voiceSpeechPorts.stt,
      tts: voiceSpeechPorts.tts,
      conversations: persistence.voice.conversations,
      brain: createVoiceBrainPort(this.brain),
      answer: createVoiceAnswerPort(this.ai),
      // SPRINT-035 — Command Center PRESENTATION (read-only; VOICE ≠
      // AUTHORIZATION). The world service is constructed later, so the port
      // resolves it lazily at call time (never at construction).
      present: createCommandCenterPresentationPort(() => this.world),
      allowMockInProduction: process.env.VOICE_ENABLE_MOCK === 'true',
    });

    // ── SPRINT-029 — Proactive Intelligence (composition seam) ──────────
    //    Composes the EXISTING Brain pipeline (discoverIntelligence,
    //    dailyPriorities, listOpportunities, listTasks), the EXISTING
    //    capability marketplace (AutomationBoundaryEngine) and the
    //    owner-scoped recommendation store. Zero new engines: no discovery,
    //    no provider selection, no approval, no execution, no memory/learning
    //    authority lives here. Sensitive recommendations are class C — the
    //    existing approval authority decides; nothing runs on proposal alone.
    this.proactive = new ProactiveIntelligenceService({
      brain: createProactiveBrainPort(this.brain),
      capability: createProactiveCapabilityPort(new AutomationBoundaryEngine(), async (userId) => {
        const view = await this.capability.capabilities(userId);
        return view.capabilities.filter((c) => c.ready).map((c) => c.id);
      }),
      store: persistence.proactive,
    });

    // ── SPRINT-030 — Intelligence Fabric (composition seam) ──────────
    //    Composes the EXISTING CostLedger (measures actual spend from the
    //    trace spine) + the EXISTING provider registry (candidate evidence)
    //    + its own observed health ledger. Zero new engines: no provider
    //    selection (selectStrategy is ADVISORY — the frozen routing authority
    //    executes), no budget (cost policy CHECKs caps over recorded spend;
    //    RunBudgetGuard still enforces per-run limits), no approval (autonomy
    //    gates onto the existing ActionClassPolicy), no scheduler (the cadence
    //    driver calls proactive.refresh, research/recommend only). Health
    //    observations are in-memory (reset on restart — documented operator
    //    step for Postgres durability, same convention as other telemetry).
    const fabricHealthLedger = new ProviderHealthLedger();
    this.fabric = new IntelligenceFabricService({
      healthLedger: fabricHealthLedger,
      costPort: createFabricCostPort(new CostLedger(), this.traceProvider.getStore()),
      providerPort: createFabricProviderPort(this.providers, fabricHealthLedger),
    });

    // ── SPRINT-031 — Active Intelligence Control Plane (composition seam) ──
    //    Coordinates the existing estate into a CONTROLLED lifecycle. The
    //    cycle OBSERVES (provider health + cost + pending approvals),
    //    refreshes recommendations and GATES them through the existing
    //    AutonomyPolicy + CostPolicyGuard + the user's explicit autonomy
    //    settings + the emergency stop. Zero new engines: approval stays with
    //    the Brain, execution with the execution bridge, budget with
    //    RunBudgetGuard, memory/learning with the existing outcome memory.
    this.controlPlane = new ActiveIntelligenceControlPlane({
      brain: createControlBrainPort(this.brain),
      proactive: createControlProactivePort(this.proactive),
      fabric: createControlFabricPort(this.fabric),
      stores: createControlStores(persistence.control),
    });

    // ── SPRINT-032 — World Model & Business Operating System ─────────
    //    Composes the EXISTING Brain (tasks/opportunities), the EXISTING
    //    proactive assessor (opportunity economics base), the EXISTING
    //    Intelligence Fabric (advisory selection + workflow bounds + cost),
    //    the EXISTING ActionClassPolicy (A/B/C/D boundary) and the EXISTING
    //    control plane (opportunity lifecycle + autonomy posture). Zero new
    //    engines: the world model only indexes, represents and proposes —
    //    it never approves, spends, executes or promotes to memory. The
    //    external-world signal interface ships WITHOUT a live source
    //    (honest UNAVAILABLE — an operator adapter implements the port).
    // SPRINT-034 — the world model gains the EXISTING approval authority
    // (Brain approve/reject — blueprint approval decisions route through it
    // exclusively), the EXISTING CostLedger cost evidence (measure-only) and
    // the operator-configured live signal sources (LiveSignalAdapter — with
    // no configuration the honest status stays UNAVAILABLE).
    this.world = new WorldModelService({
      brain: createWorldBrainPort(this.brain),
      proactive: createWorldProactivePort(this.proactive),
      fabric: createWorldFabricPort(this.fabric),
      action: createWorldActionPort(),
      control: createWorldControlPort(this.controlPlane),
      stores: createWorldStores(persistence.world),
      approval: createWorldApprovalPort(this.brain),
      cost: createWorldCostPort(costLedger, this.traceProvider.getStore()),
      signalSources: resolveWorldSignalSources(),
    });

    // ── Create the VedMoulya Intelligence layer (EPIC-015) ──────────────
    //    The Intelligence layer continuously understands the external AI
    //    ecosystem and answers "For THIS task, is something significantly
    //    better available?" — across configured providers, free providers,
    //    local models, GitHub projects and external applications. It REUSES
    //    the SAME candidate seam (createBrainCandidatePort) and the SAME
    //    preference ledger (createBrainPreferencePort) as the Brain — one
    //    source seam, zero duplication. Google auth stays untouched; GitHub
    //    connects through a separate least-privilege flow (deterministic
    //    adapter; a live GitHub App adapter is an operator step).
    this.ecosystemIntelligence = new EcosystemIntelligenceApplicationService({
      clock: new SystemClock(),
      candidatePort: createBrainCandidatePort(brainPortDeps),
      preferencePort: createBrainPreferencePort(brainPortDeps.preferenceLedger),
      githubAuth: createGitHubAuthPort(),
      githubRepos: createGitHubRepoSourcePort(this.aiWorld),
      connectionStore: persistence.ecosystem.connectionStore,
      lifecycleStore: persistence.ecosystem.lifecycleStore,
      recommendationStore: persistence.ecosystem.recommendationStore,
      notificationStore: persistence.ecosystem.notificationStore,
      acquisitionStore: persistence.ecosystem.acquisitionStore,
    });

    // ── Create the Ecosystem Workflow Execution (SPRINT-052) ─────────────
    //    The controlled workflow execution foundation: takes a WorkflowDefinition,
    //    validates agents, executes steps through the existing AI runtime,
    //    handles approval gates, and records evidence. Composes the existing
    //    ecosystem registries and the existing AI runtime — no new engines.
    const ecoAgentRegistry = new AgentRegistry();
    const ecoWorkflowRegistry = new WorkflowRegistry();
    const ecoExecutionStore = new InMemoryWorkflowExecutionStore();

    // Register the certification agent
    ecoAgentRegistry.register(
      Agent.create({
        id: 'certification-agent',
        name: 'Certification Agent',
        purpose: 'Safe agent for workflow execution certification testing',
        requiredCapabilities: [
          'content_generation',
          'reasoning',
        ] as import('@vedmoulya/ai').CapabilityType[],
        allowedTools: ['echo', 'current_time', 'calculator'],
        preferredProviders: [
          'openai',
          'anthropic',
          'google',
          'mock',
        ] as import('@vedmoulya/ai').ProviderFamily[],
        riskLevel: 'LOW',
        approvalPolicy: 'AUTO',
        privacyClass: 'PUBLIC',
        pricingModel: 'FREE',
        status: 'available',
        tags: ['certification', 'safe', 'test'],
        owner: 'system',
      }),
    );

    // Register the certification workflow
    ecoWorkflowRegistry.register(
      Workflow.create({
        id: 'certification-knowledge-summary',
        name: 'Personal Knowledge Summary',
        outcome: 'Produce a grounded summary from user-supplied text',
        steps: [
          {
            id: 'step-collect',
            title: 'Collect Content',
            purpose: 'Read and validate the supplied text content for summarization.',
            requiredCapabilities: [
              'content_generation',
            ] as import('@vedmoulya/ai').CapabilityType[],
            agentIds: ['certification-agent'],
            allowedTools: [],
            riskLevel: 'LOW',
            approvalPolicy: 'AUTO',
            automationLevel: 'FULLY_AUTOMATED',
            dependencies: [],
            verificationRequirements: ['Output is non-empty'],
          },
          {
            id: 'step-analyze',
            title: 'AI Analysis',
            purpose: 'Analyze the content and produce a structured summary with key points.',
            requiredCapabilities: [
              'content_generation',
              'reasoning',
            ] as import('@vedmoulya/ai').CapabilityType[],
            agentIds: ['certification-agent'],
            allowedTools: [],
            riskLevel: 'LOW',
            approvalPolicy: 'AUTO',
            automationLevel: 'FULLY_AUTOMATED',
            dependencies: ['step-collect'],
            verificationRequirements: ['Output contains at least one key point'],
          },
          {
            id: 'step-approval',
            title: 'Review Summary',
            purpose: 'The AI has prepared a summary. Continue to final verification?',
            requiredCapabilities: [],
            agentIds: ['certification-agent'],
            allowedTools: [],
            riskLevel: 'MEDIUM',
            approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
            automationLevel: 'HUMAN_APPROVAL',
            dependencies: ['step-analyze'],
            verificationRequirements: [],
          },
          {
            id: 'step-verify',
            title: 'Final Verification',
            purpose: 'Verify the summary is complete and present the final result.',
            requiredCapabilities: [
              'content_generation',
            ] as import('@vedmoulya/ai').CapabilityType[],
            agentIds: ['certification-agent'],
            allowedTools: [],
            riskLevel: 'LOW',
            approvalPolicy: 'AUTO',
            automationLevel: 'FULLY_AUTOMATED',
            dependencies: ['step-approval'],
            verificationRequirements: ['Output is non-empty', 'Output contains summary'],
          },
        ],
        riskLevel: 'MEDIUM',
        approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
        privacyClass: 'PUBLIC',
        completionCriteria: [
          'Summary is non-empty',
          'Summary contains key points from the input',
          'Summary is grounded in the supplied content',
        ],
        approvalGates: ['step-approval'],
        status: 'ACTIVE',
        tags: ['certification', 'safe', 'knowledge', 'summary'],
        owner: 'system',
      }),
    );

    // Register multi-agent certification agents (SPRINT-053)
    ecoAgentRegistry.register(
      Agent.create({
        id: 'research-agent',
        name: 'Research Agent',
        purpose: 'Gathers information and research findings from available sources',
        requiredCapabilities: ['reasoning'],
        allowedTools: ['echo', 'current_time'],
        preferredProviders: ['openai', 'anthropic', 'google', 'mock'],
        riskLevel: 'LOW',
        approvalPolicy: 'AUTO',
        privacyClass: 'PUBLIC',
        pricingModel: 'FREE',
        status: 'available',
        tags: ['certification', 'research', 'safe'],
        owner: 'system',
      }),
    );
    ecoAgentRegistry.register(
      Agent.create({
        id: 'analysis-agent',
        name: 'Analysis Agent',
        purpose: 'Analyzes research findings and extracts key insights and patterns',
        requiredCapabilities: ['reasoning'],
        allowedTools: ['calculator', 'echo'],
        preferredProviders: ['openai', 'anthropic', 'google', 'mock'],
        riskLevel: 'LOW',
        approvalPolicy: 'AUTO',
        privacyClass: 'PUBLIC',
        pricingModel: 'FREE',
        status: 'available',
        tags: ['certification', 'analysis', 'safe'],
        owner: 'system',
      }),
    );
    ecoAgentRegistry.register(
      Agent.create({
        id: 'summary-agent',
        name: 'Summary Agent',
        purpose: 'Produces a concise, well-structured summary of analyzed findings',
        requiredCapabilities: ['content_generation'],
        allowedTools: ['echo'],
        preferredProviders: ['openai', 'anthropic', 'google', 'mock'],
        riskLevel: 'LOW',
        approvalPolicy: 'AUTO',
        privacyClass: 'PUBLIC',
        pricingModel: 'FREE',
        status: 'available',
        tags: ['certification', 'summary', 'safe'],
        owner: 'system',
      }),
    );
    ecoAgentRegistry.register(
      Agent.create({
        id: 'verification-agent',
        name: 'Verification Agent',
        purpose: 'Verifies the summary is complete, accurate, and grounded in evidence',
        requiredCapabilities: ['reasoning'],
        allowedTools: ['echo'],
        preferredProviders: ['openai', 'anthropic', 'google', 'mock'],
        riskLevel: 'LOW',
        approvalPolicy: 'AUTO',
        privacyClass: 'PUBLIC',
        pricingModel: 'FREE',
        status: 'available',
        tags: ['certification', 'verification', 'safe'],
        owner: 'system',
      }),
    );

    // Register multi-agent certification workflow (SPRINT-053)
    ecoWorkflowRegistry.register(
      Workflow.create({
        id: 'multi-agent-research-summary',
        name: 'Opportunity Research & Summary',
        outcome: 'Multi-agent research, analysis, and summary of a topic',
        steps: [
          {
            id: 'step-research',
            title: 'Research',
            purpose: 'Gather relevant information and research findings about the topic.',
            requiredCapabilities: ['reasoning'],
            agentIds: ['research-agent'],
            allowedTools: ['echo', 'current_time'],
            riskLevel: 'LOW',
            approvalPolicy: 'AUTO',
            automationLevel: 'FULLY_AUTOMATED',
            dependencies: [],
            verificationRequirements: ['Output is non-empty'],
          },
          {
            id: 'step-analysis',
            title: 'Analysis',
            purpose: 'Analyze the research findings and extract key insights and patterns.',
            requiredCapabilities: ['reasoning'],
            agentIds: ['analysis-agent'],
            allowedTools: ['calculator', 'echo'],
            riskLevel: 'LOW',
            approvalPolicy: 'AUTO',
            automationLevel: 'FULLY_AUTOMATED',
            dependencies: ['step-research'],
            verificationRequirements: ['Output contains analysis'],
          },
          {
            id: 'step-summary',
            title: 'Summary',
            purpose: 'Produce a concise, well-structured summary of the analyzed findings.',
            requiredCapabilities: ['content_generation'],
            agentIds: ['summary-agent'],
            allowedTools: ['echo'],
            riskLevel: 'LOW',
            approvalPolicy: 'AUTO',
            automationLevel: 'FULLY_AUTOMATED',
            dependencies: ['step-analysis'],
            verificationRequirements: ['Output is non-empty'],
          },
          {
            id: 'step-multi-approval',
            title: 'Review Findings',
            purpose: 'The agents have prepared research findings. Continue to verification?',
            requiredCapabilities: [],
            agentIds: [],
            allowedTools: [],
            riskLevel: 'MEDIUM',
            approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
            automationLevel: 'HUMAN_APPROVAL',
            dependencies: ['step-summary'],
            verificationRequirements: [],
          },
          {
            id: 'step-multi-verify',
            title: 'Final Verification',
            purpose: 'Verify the summary is complete and present the final result.',
            requiredCapabilities: ['reasoning'],
            agentIds: ['verification-agent'],
            allowedTools: ['echo'],
            riskLevel: 'LOW',
            approvalPolicy: 'AUTO',
            automationLevel: 'FULLY_AUTOMATED',
            dependencies: ['step-multi-approval'],
            verificationRequirements: ['Output is non-empty', 'Output contains verification'],
          },
        ],
        riskLevel: 'MEDIUM',
        approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
        privacyClass: 'PUBLIC',
        completionCriteria: [
          'Research findings are non-empty',
          'Analysis contains key insights',
          'Summary is well-structured',
          'Verification confirms completeness',
        ],
        approvalGates: ['step-multi-approval'],
        status: 'ACTIVE',
        tags: ['certification', 'multi-agent', 'research', 'safe'],
        owner: 'system',
      }),
    );

    // Register career intelligence agents (SPRINT-054)
    type CapType = import('@vedmoulya/ai').CapabilityType;
    type ProvFam = import('@vedmoulya/ai').ProviderFamily;
    const careerAgentDefs: Array<{
      id: string;
      name: string;
      purpose: string;
      requiredCapabilities: CapType[];
      allowedTools: string[];
      preferredProviders: ProvFam[];
      riskLevel: import('@vedmoulya/ecosystem').RiskLevel;
      approvalPolicy: import('@vedmoulya/ecosystem').ApprovalPolicy;
      privacyClass: import('@vedmoulya/ecosystem').PrivacyClass;
      pricingModel: import('@vedmoulya/ecosystem').PricingModel;
      status: import('@vedmoulya/ecosystem').AgentStatus;
      tags: string[];
      owner: string;
    }> = [
      {
        id: 'career-research-agent',
        name: 'Opportunity Research Agent',
        purpose: 'Discovers relevant career and freelance opportunities',
        requiredCapabilities: ['reasoning'],
        allowedTools: ['echo', 'current_time'],
        preferredProviders: ['openai', 'anthropic', 'google'],
        riskLevel: 'LOW',
        approvalPolicy: 'AUTO',
        privacyClass: 'PUBLIC',
        pricingModel: 'FREE',
        status: 'available',
        tags: ['career', 'research', 'safe'],
        owner: 'system',
      },
      {
        id: 'career-match-agent',
        name: 'Career Match Agent',
        purpose: 'Compares opportunities against user profile and goals',
        requiredCapabilities: ['reasoning'],
        allowedTools: ['echo'],
        preferredProviders: ['openai', 'anthropic', 'google'],
        riskLevel: 'LOW',
        approvalPolicy: 'AUTO',
        privacyClass: 'PUBLIC',
        pricingModel: 'FREE',
        status: 'available',
        tags: ['career', 'matching', 'safe'],
        owner: 'system',
      },
      {
        id: 'career-ranking-agent',
        name: 'Opportunity Ranking Agent',
        purpose: 'Ranks opportunities using transparent criteria',
        requiredCapabilities: ['reasoning'],
        allowedTools: ['echo'],
        preferredProviders: ['openai', 'anthropic', 'google'],
        riskLevel: 'LOW',
        approvalPolicy: 'AUTO',
        privacyClass: 'PUBLIC',
        pricingModel: 'FREE',
        status: 'available',
        tags: ['career', 'ranking', 'safe'],
        owner: 'system',
      },
      {
        id: 'career-proposal-agent',
        name: 'Proposal Preparation Agent',
        purpose: 'Prepares draft proposal for the top opportunity',
        requiredCapabilities: ['content_generation'],
        allowedTools: ['echo'],
        preferredProviders: ['openai', 'anthropic', 'google'],
        riskLevel: 'MEDIUM',
        approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
        privacyClass: 'PUBLIC',
        pricingModel: 'FREE',
        status: 'available',
        tags: ['career', 'proposal', 'safe'],
        owner: 'system',
      },
      {
        id: 'career-verification-agent',
        name: 'Verification Agent',
        purpose: 'Verifies proposal has no fabricated claims',
        requiredCapabilities: ['reasoning'],
        allowedTools: ['echo'],
        preferredProviders: ['openai', 'anthropic', 'google'],
        riskLevel: 'LOW',
        approvalPolicy: 'AUTO',
        privacyClass: 'PUBLIC',
        pricingModel: 'FREE',
        status: 'available',
        tags: ['career', 'verification', 'safe'],
        owner: 'system',
      },
    ];
    for (const agentDef of careerAgentDefs) {
      ecoAgentRegistry.register(Agent.create(agentDef));
    }

    // Register career intelligence workflow (SPRINT-054)
    ecoWorkflowRegistry.register(
      Workflow.create({
        id: 'career-freelance-intelligence',
        name: 'AI Career & Freelance Intelligence',
        outcome:
          'Identify the best realistic opportunities for the founder and prepare actionable next steps',
        steps: [
          {
            id: 'step-career-research',
            title: 'Opportunity Research',
            purpose:
              'Discover relevant career and freelance opportunities based on the user profile and goals.',
            requiredCapabilities: ['reasoning'],
            agentIds: ['career-research-agent'],
            allowedTools: ['echo', 'current_time'],
            riskLevel: 'LOW',
            approvalPolicy: 'AUTO',
            automationLevel: 'FULLY_AUTOMATED',
            dependencies: [],
            verificationRequirements: [
              'Output contains at least one opportunity or honest UNAVAILABLE status',
            ],
          },
          {
            id: 'step-career-match',
            title: 'Career Matching',
            purpose:
              'Compare discovered opportunities against the user profile: skill match, experience match, goal alignment.',
            requiredCapabilities: ['reasoning'],
            agentIds: ['career-match-agent'],
            allowedTools: ['echo'],
            riskLevel: 'LOW',
            approvalPolicy: 'AUTO',
            automationLevel: 'FULLY_AUTOMATED',
            dependencies: ['step-career-research'],
            verificationRequirements: ['Output contains match analysis'],
          },
          {
            id: 'step-career-rank',
            title: 'Opportunity Ranking',
            purpose:
              'Rank matched opportunities using transparent criteria with human-readable rationale.',
            requiredCapabilities: ['reasoning'],
            agentIds: ['career-ranking-agent'],
            allowedTools: ['echo'],
            riskLevel: 'LOW',
            approvalPolicy: 'AUTO',
            automationLevel: 'FULLY_AUTOMATED',
            dependencies: ['step-career-match'],
            verificationRequirements: ['Output contains ranked list with rationale'],
          },
          {
            id: 'step-career-proposal',
            title: 'Proposal Preparation',
            purpose:
              'Prepare a draft proposal for the top-ranked opportunity. Never fabricate experience.',
            requiredCapabilities: ['content_generation'],
            agentIds: ['career-proposal-agent'],
            allowedTools: ['echo'],
            riskLevel: 'MEDIUM',
            approvalPolicy: 'AUTO',
            automationLevel: 'FULLY_AUTOMATED',
            dependencies: ['step-career-rank'],
            verificationRequirements: ['Output contains proposal with no fabricated claims'],
          },
          {
            id: 'step-career-approval',
            title: 'Founder Review',
            purpose:
              'Review the career intelligence findings before final verification. This does NOT authorize external submission.',
            requiredCapabilities: [],
            agentIds: [],
            allowedTools: [],
            riskLevel: 'MEDIUM',
            approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
            automationLevel: 'HUMAN_APPROVAL',
            dependencies: ['step-career-proposal'],
            verificationRequirements: [],
          },
          {
            id: 'step-career-verify',
            title: 'Verification',
            purpose:
              'Verify the proposal: no fabricated experience, no invented qualifications, no unsupported claims.',
            requiredCapabilities: ['reasoning'],
            agentIds: ['career-verification-agent'],
            allowedTools: ['echo'],
            riskLevel: 'LOW',
            approvalPolicy: 'AUTO',
            automationLevel: 'FULLY_AUTOMATED',
            dependencies: ['step-career-approval'],
            verificationRequirements: ['Output contains verification with no fabricated claims'],
          },
          {
            id: 'step-career-summarize',
            title: 'Final Summary',
            purpose:
              'Produce the final career intelligence summary: top opportunities, recommended next step, evidence, risks.',
            requiredCapabilities: ['content_generation'],
            agentIds: ['career-proposal-agent'],
            allowedTools: ['echo'],
            riskLevel: 'LOW',
            approvalPolicy: 'AUTO',
            automationLevel: 'FULLY_AUTOMATED',
            dependencies: ['step-career-verify'],
            verificationRequirements: ['Output contains actionable summary'],
          },
        ],
        riskLevel: 'MEDIUM',
        approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
        privacyClass: 'PUBLIC',
        completionCriteria: [
          'Opportunities discovered',
          'Matched against profile',
          'Ranked with rationale',
          'Proposal prepared',
          'Founder reviewed',
          'Verification passed',
          'Summary produced',
        ],
        approvalGates: ['step-career-approval'],
        status: 'ACTIVE',
        tags: ['career', 'freelance', 'intelligence', 'safe'],
        owner: 'system',
      }),
    );

    // Create a simple step executor that uses the existing AI runtime
    const ecoStepExecutor = {
      execute: async (params: {
        stepId: string;
        instruction: string;
        capability: string;
        userId: string;
        allowedTools: string[];
      }): Promise<{
        ok: boolean;
        content?: string;
        provider?: string;
        model?: string;
        tokens?: { input: number; output: number; total: number };
        costUsd?: number;
        latencyMs?: number;
        error?: string;
      }> => {
        // Use the existing AI orchestration service for execution
        try {
          const result = await this.ai.orchestrate({
            userInput: params.instruction,
            userId: params.userId,
            capability: params.capability as import('@vedmoulya/ai').CapabilityType,
            qualityTier: 'standard',
          });
          return {
            ok: true,
            content: result.content,
            provider: result.provider,
            model: result.model,
            tokens: result.tokenUsage,
            costUsd: result.cost,
            latencyMs: result.latency,
          };
        } catch (error) {
          return {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    };

    // Create a simple verifier
    const ecoStepVerifier = {
      verify: (params: {
        stepId: string;
        output: string;
        verificationRequirements: string[];
      }): Promise<{
        passed: boolean;
        checks: { name: string; passed: boolean; detail: string }[];
      }> => {
        const checks = params.verificationRequirements.map((req) => ({
          name: req,
          passed: params.output.length > 0,
          detail: params.output.length > 0 ? 'OK' : 'Output is empty',
        }));
        return Promise.resolve({
          passed: checks.every((c) => c.passed),
          checks,
        });
      },
    };

    // Create a simple evidence port
    const ecoEvidencePort = {
      record: (params: {
        executionId: string;
        workflowId: string;
        ownerId: string;
        outcome: string;
        status: string;
        stepResults: unknown[];
        timestamp: string;
      }): void => {
        // Record evidence through the existing memory system
        // For now, just log it — the evidence is stored in the execution state
        console.warn(
          `[ECOSYSTEM-WORKFLOW] Evidence recorded: ${params.workflowId} → ${params.status}`,
        );
      },
    };

    this.ecosystemWorkflow = new WorkflowExecutionService({
      agentRegistry: ecoAgentRegistry,
      workflowRegistry: ecoWorkflowRegistry,
      executionStore: ecoExecutionStore,
      stepExecutor: ecoStepExecutor,
      stepVerifier: ecoStepVerifier,
      evidencePort: ecoEvidencePort,
      clock: new SystemClock(),
      maxRetries: 1,
    });

    // ── Create the Live Intelligence Bridge (EPIC-017) ──────────────────
    //    The bridge orchestrates the full loop — USER TASK → BRAIN UNDERSTAND
    //    → DISCOVER → COMPARE → RECOMMEND → USER APPROVAL → CONFIGURATION /
    //    HAND-OFF → EPIC-014 EXECUTION → VERIFY → EVALUATE → PREFERENCE
    //    FEEDBACK → AI World NOTIFY. It composes the EXISTING Brain, Intelligence,
    //    Marketplace and Execution services through narrow ports (no duplicate
    //    engines) and reuses the SAME candidate + preference seams.
    this.liveIntelligence = new LiveIntelligenceBridgeService({
      clock: createBridgeClockPort(),
      brain: createBridgeBrainPort(this.brain),
      intelligence: createBridgeIntelligencePort(this.ecosystemIntelligence),
      marketplace: createBridgeMarketplacePort(this.capability),
      execution: createBridgeExecutionPort(this.executionRun),
      candidates: createBrainCandidatePort(brainPortDeps),
      preference: createBrainPreferencePort(brainPortDeps.preferenceLedger),
      aiWorld: createBridgeAiWorldPort(this.ecosystemIntelligence),
      loops: persistence.bridge.loops,
      traceId: (): string => `bridge-${Math.random().toString(36).slice(2, 10)}`,
    });

    // ── Create the AI World Scheduler (EPIC-018) ─────────────────────────
    //    The controlled, bounded, security-first scheduling layer that drives
    //    the EXISTING AI World discovery pipeline. The scheduler decides WHEN
    //    (per-category schedules, budgets, cooldowns, rate limits, retries,
    //    backoff, change detection); discovery (WHAT) stays in this.aiWorld,
    //    intelligence/relevance stays on the existing evidence engines, and
    //    notifications reuse the EXISTING relevance-gated surface. Manual
    //    runs (Run now) take the exact same bounded path — no shortcut.
    //    The scheduler + application service SHARE one set of owner-scoped
    //    stores (never two states).
    const schedulerStores = {
      schedules: persistence.scheduler.schedules,
      jobs: persistence.scheduler.jobs,
      runs: persistence.scheduler.runs,
    };
    this.aiWorldScheduler = new SchedulerApplicationService({
      scheduler: new DiscoveryScheduler({
        clock: createSchedulerClockPort(),
        discovery: createSchedulerDiscoveryPort(this.aiWorld),
        brain: createSchedulerBrainPort(),
        notify: createSchedulerNotifyPort(this.ecosystemIntelligence),
        ...schedulerStores,
        sourcePolicies: persistence.scheduler.sourcePolicies,
        cooldowns: persistence.scheduler.cooldowns,
      }),
      ...schedulerStores,
      clock: createSchedulerClockPort(),
    });

    // ── EPIC-020 — Brain Operating Dashboard ────────────────────────
    //    Composes existing services only (brain stores + provider experience
    //    + scheduler status) — no duplicate engines, no new persistence.
    this.brainDashboard = new BrainDashboardService({
      brain: this.brain,
      outcomeMemory: brainOutcomeMemory,
      providerExperience: this.providerExperience,
      aiWorldScheduler: this.aiWorldScheduler,
    });

    // ── Create the EPIC-012 control plane ───────────────────────────────
    //    The ops.* surface inspects the correlated traces, ledger, health and
    //    alerts, and exposes audited owner-scoped + operator-gated controls
    //    (retry/cancel/revalidate/requality/disable-provider). The operator
    //    allowlist comes from OPS_OPERATOR_IDS (empty = deny-all).
    this.ops = new OpsApplicationService({
      traceProvider: this.traceProvider,
      telemetry,
      factory: this.factory,
      loop: this.loop,
      ai: this.ai,
      experience: this.experience,
      providers: this.providers,
      costLedger,
      alertEngine: new AlertEngine(),
      operatorGate: new OperatorGate(),
      auditTrail: new AuditTrail(),
    });

    // ── SPRINT-093 — Orchestration Fabric ──────────────────────────────
    //    Central coordination layer for work queuing, priority scheduling,
    //    concurrency control, provider routing, backpressure, cancellation.
    //    The orchestrator does NOT create database connections — engines
    //    delegate to DatabaseManager's shared bounded pool.
    this.orchestrator = new OrchestratorServiceFabric({
      tickIntervalMs: 100,
      maxItemsPerTick: 50,
      enableDependencyGraph: true,
      enableProviderRouting: true,
    });

    // ── Create the Life OS integration layer ────────────────────────────
    this.lifeOS = new LifeOSApplicationService(
      this.dashboard,
      this.career,
      this.learning,
      this.business,
      this.marketplace,
      this.identity,
      this.memory,
      this.decision,
      this.execution,
      this.knowledge,
      this.ai,
    );
  }

  /**
   * Check if all services are healthy.
   * Currently returns true for dev — no frozen service implements isHealthy().
   * Will be restored with real repository-backed service health checks.
   */
  isHealthy(): boolean {
    return true;
  }
}

// ── Loop Engine Port Factories (EPIC-006) ────────────────────────────────────
// The loop engine executes NO AI directly — these factories adapt the frozen
// gateway services into the loop's narrow ports:
//   • specialist — AIOrchestratorSpecialistPort over the AI runtime
//   • rag        — the existing RAG retrieval port (retrieve → search)
//   • tools      — the frozen ToolRuntime secure registry (allowlist +
//                  capability + schema validation + rate limit + audit)

/** Adapt the runtime's RAG retrieval port to the loop's RagSearchPort shape. */
function createLoopRagPort(rag: RagApplicationService): LoopEnginePorts['rag'] {
  const retrieval = createRagRetrievalPort(rag);
  return {
    search: (input) => retrieval.retrieve(input),
  };
}

/**
 * Build the secure loop tool port from the frozen ToolRuntime. Only the safe
 * built-in tools (echo, current_time, calculator) are registered; the
 * platform allowlist honours AI_TOOL_ALLOWLIST when configured (empty =
 * tools disabled by default). No shell/fs/network/db surface exists.
 */
function createLoopToolPort(): LoopEnginePorts['tools'] {
  const registry = new ToolRegistry({
    allowlist: parseToolAllowlist(),
    grantedCapabilities: ['reasoning', 'calculation', 'productivity'],
  });
  registerSafeTools(registry);
  return new ToolRegistryToolPort(registry);
}

/** Parse AI_TOOL_ALLOWLIST ("echo,calculator") — empty/absent = deny-all. */
function parseToolAllowlist(): string[] {
  const raw = process.env.AI_TOOL_ALLOWLIST?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Build the optional EPIC-009 intent-enrichment port over the frozen AI
 * runtime (the same AIOrchestratorSpecialistPort the loop and factory use).
 * A single economy classification call extracts additional features /
 * integrations / constraints. Non-fatal: parse failures or missing providers
 * return confident:false and the pipeline stays deterministic (recorded in
 * the session's enrichment ledger).
 */
function createRequirementEnrichmentPort(ai: AIOrchestrationService): RequirementEnrichmentPort {
  const specialist = new AIOrchestratorSpecialistPort(ai);
  return {
    async enrich(input): Promise<Awaited<ReturnType<RequirementEnrichmentPort['enrich']>>> {
      try {
        const result = await specialist.execute({
          taskId: 'requirements-intent-enrichment',
          capability: 'classification',
          qualityTier: 'economy',
          userInput:
            'Analyze this application idea and return ONLY a compact JSON object with keys ' +
            'additionalFeatures (string array), additionalIntegrations (string array), ' +
            'additionalConstraints (string array) and confident (boolean). ' +
            `Idea: ${input.idea}`,
          userId: input.userId,
          constraints: { maxOutputTokens: 400, maxInputTokens: 2_000 },
        });
        const parsed = parseEnrichmentJson(result.content);
        return {
          additionalFeatures: parsed?.additionalFeatures ?? [],
          additionalIntegrations: parsed?.additionalIntegrations ?? [],
          additionalConstraints: parsed?.additionalConstraints ?? [],
          confident: parsed?.confident === true,
          provider: result.provider,
          model: result.model,
          tokens: result.tokens.total,
          costUsd: result.costUsd,
        };
      } catch {
        // Non-fatal: the pipeline stays deterministic; the session records
        // that enrichment was attempted (session.enrichment.attempted).
        return {
          additionalFeatures: [],
          additionalIntegrations: [],
          additionalConstraints: [],
          confident: false,
          provider: 'none',
          model: 'none',
          tokens: 0,
          costUsd: 0,
        };
      }
    },
  };
}

/** Parse the enrichment JSON defensively (tolerant of markdown fences). */
function parseEnrichmentJson(content: string):
  | {
      additionalFeatures?: string[];
      additionalIntegrations?: string[];
      additionalConstraints?: string[];
      confident?: boolean;
    }
  | undefined {
  const stripped = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const parsed: unknown = JSON.parse(stripped);
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const obj = parsed as Record<string, unknown>;
    return {
      additionalFeatures: toStringArray(obj.additionalFeatures),
      additionalIntegrations: toStringArray(obj.additionalIntegrations),
      additionalConstraints: toStringArray(obj.additionalConstraints),
      confident: typeof obj.confident === 'boolean' ? obj.confident : undefined,
    };
  } catch {
    return undefined;
  }
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((v): v is string => typeof v === 'string');
}

/**
 * SPRINT-028 — resolve the speech runtime adapters from operator config.
 * Provider-neutral: the adapters speak the OpenAI-compatible audio contract
 * (VOICE_STT_BASE_URL → /audio/transcriptions, VOICE_TTS_BASE_URL →
 * /audio/speech). When the operator configures a base URL the REAL adapter is
 * wired (kind REAL → status CONFIGURED only when live); otherwise the
 * deterministic mocks serve and the status honestly reports MOCK. In
 * production, a configured-but-missing base URL for a wanted capability
 * falls back to mocks that are refused unless VOICE_ENABLE_MOCK=true.
 * Credentials (VOICE_STT_API_KEY / VOICE_TTS_API_KEY) stay server-side.
 */
function resolveVoiceRuntimeAdapters(): {
  stt: SpeechToTextPort;
  tts: TextToSpeechPort;
} {
  const sttBaseUrl = (process.env.VOICE_STT_BASE_URL ?? '').trim();
  const ttsBaseUrl = (process.env.VOICE_TTS_BASE_URL ?? '').trim();
  const stt = sttBaseUrl
    ? new RuntimeSpeechToTextAdapter({
        baseUrl: sttBaseUrl,
        apiKey: process.env.VOICE_STT_API_KEY?.trim() || undefined,
        model: process.env.VOICE_STT_MODEL?.trim() || undefined,
        probePath: '/models',
      })
    : new MockSpeechToTextAdapter();
  const tts = ttsBaseUrl
    ? new RuntimeTextToSpeechAdapter({
        baseUrl: ttsBaseUrl,
        apiKey: process.env.VOICE_TTS_API_KEY?.trim() || undefined,
        model: process.env.VOICE_TTS_MODEL?.trim() || undefined,
        voice: process.env.VOICE_TTS_VOICE?.trim() || undefined,
        format: process.env.VOICE_TTS_FORMAT?.trim() || undefined,
        probePath: '/models',
      })
    : new MockTextToSpeechAdapter();
  return { stt, tts };
}
