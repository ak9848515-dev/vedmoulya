// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/mission-runtime (BLD-022)
// Autonomous Mission Runtime: the production composition layer that
// makes the BLD-021A Mission Controller executable against the real
// VedMoulya runtime. Composes ONLY existing frozen systems.
// ──────────────────────────────────────────────────────────────────

// Composition
export {
  buildMissionRuntimeComponents,
  createMissionRuntime,
} from './composition/MissionRuntime.js';
export type {
  MissionRuntime,
  MissionRuntimeComponents,
  MissionRuntimeOptions,
} from './composition/MissionRuntime.js';

// Adapters — provider availability over the frozen AIOrchestrationService
export { OrchestratorProviderAvailability } from './adapters/OrchestratorProviderAvailability.js';

// Adapters — routing intelligence ports over the real registered adapters
export {
  createMissionExecutionStrategy,
  createOrchestratorProviderIntelligence,
  createOrchestratorRoutingPorts,
} from './adapters/OrchestratorRoutingPorts.js';

// Adapters — failure classification hardening (delegates to the frozen classifier)
export { MissionFailureClassifierAdapter } from './adapters/MissionFailureClassifierAdapter.js';

// Adapters — bounded, path-jailed governed workspace tools (ToolRuntime)
export {
  WORKSPACE_READ_TOOL,
  WORKSPACE_WRITE_TOOL,
  WorkspaceRootBinding,
  createWorkspaceTools,
} from './adapters/WorkspaceTools.js';
export type { WorkspaceToolOptions, WorkspaceTools } from './adapters/WorkspaceTools.js';
export {
  ClassifyingToolRegistryPort,
  createGovernedToolRegistry,
  permissionClassForTool,
} from './adapters/GovernedToolRegistry.js';

// Adapters — bounded repository inspection
export { FsRepositoryInspector } from './adapters/FsRepositoryInspector.js';
export type { FsRepositoryInspectorOptions } from './adapters/FsRepositoryInspector.js';

// Adapters — Git safety runtime boundary (policy + bounded runtime)
export { RuntimeGitSafetyAdapter } from './adapters/RuntimeGitSafetyAdapter.js';
export type {
  GitOperationDecision,
  GitOperationOutcome,
  GitSafetyAuditEvent,
  RuntimeGitSafetyAdapterOptions,
} from './adapters/RuntimeGitSafetyAdapter.js';

// Adapters — planning / execution / verification over the frozen estate
export {
  AgentExecutionAdapter,
  MissionPlanningAdapter,
  RunRegistry,
  RunVerificationAdapter,
  planToolNames,
} from './adapters/PlanningExecutionPorts.js';

// Adapters — learning estate (advisory only)
export {
  MissionExecutionMemoryAdapter,
  MissionExperienceOptimizationAdapter,
} from './adapters/MemoryOptimizationPorts.js';

// Adapters — deterministic workspace development template (frozen planner extension)
export {
  createWorkspaceFileTemplate,
  extractWorkspaceFileTarget,
  sanitizePlanningGoal,
} from './adapters/WorkspaceDevTemplate.js';
export type { WorkspaceFileTarget } from './adapters/WorkspaceDevTemplate.js';

// Durable mission persistence (existing WriteThroughDocumentStore infra)
export {
  CHECKPOINTS_TABLE,
  MISSIONS_TABLE,
  PostgresCheckpointStore,
  PostgresMissionStore,
  ensureMissionPersistence,
} from './persistence/PostgresMissionStores.js';

// Minimal API / service boundary (START/PAUSE/RESUME/CANCEL/APPROVE/REJECT/STATUS)
export { MissionRuntimeApi } from './mission-api/MissionRuntimeApi.js';
export type { MissionRuntimeApiOptions } from './mission-api/MissionRuntimeApi.js';
