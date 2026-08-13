// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/app-factory
// AI Application Factory (EPIC-007)
// The APPLICATION FACTORY layer above the frozen platform: takes a
// natural-language application idea and turns it into a structured,
// validated application project.
//
//   UNDERSTAND → SPECIFY → ARCHITECT → PLAN → SELECT TECHNOLOGIES →
//   SELECT AI CAPABILITIES → GENERATE → TEST → CRITIQUE → REFINE →
//   BUILD → PACKAGE → DEPLOY/EXPORT
//
// Reuses (never rebuilds): the AI Runtime, the EPIC-006 LoopEngine
// (bounded generation loop over an application task graph), RAG, the
// ToolRuntime, the CriticEvaluator and the EvidenceEvaluator. The
// factory adds ONLY the application layer: specification, architecture,
// blueprint, the controlled file-operation + policy layer, validation
// gates, security + UI quality review, economics, registry, deployment
// and version-control abstraction.
// ──────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────
export type {
  AppRequirement,
  UserJourney,
  ApplicationSpecification,
  AppArchetype,
  ArchitectureLayer,
  ApplicationArchitecture,
  ApplicationTaskPhase,
  ApplicationTask,
  ApplicationTaskGraph,
  SpecialistRoleId,
  SpecialistRole,
  FileOperationKind,
  ExecutionActionClass,
  FileOperation,
  ExecutionPolicyRule,
  ExecutionPolicy,
  BlueprintTechnology,
  BlueprintFile,
  ApplicationBlueprint,
  ApplicationPlanPreview,
  ValidationGateId,
  ValidationGateResult,
  ValidationReport,
  UIQualityCheck,
  UIQualityReport,
  SecuritySeverity,
  SecurityFinding,
  SecurityReport,
  EconomicsSnapshot,
  DeploymentTargetId,
  DeploymentRequest,
  DeploymentResult,
  VersionControlOpType,
  VersionControlOperation,
  ApplicationStatus,
  AppProject,
  NewAppProject,
  ApplicationVersion,
  RepairAttempt,
  FactoryRunLink,
} from './types/app-types.js';

// ── Ports ────────────────────────────────────────────────────────
export type {
  WorkspaceFileEntry,
  WorkspaceOperationInput,
  WorkspaceOperationResult,
  WorkspacePort,
  DeploymentAdapterPort,
  VersionControlPort,
  FactoryEnginePorts,
} from './contracts/factory-ports.js';
export { classifyFileOperation } from './contracts/factory-ports.js';
export type { ApplicationProjectRepository } from './contracts/application-repository.js';

// ── Domain ───────────────────────────────────────────────────────
export { SpecificationEngine } from './domain/SpecificationEngine.js';
export type { SpecificationEngineOptions } from './domain/SpecificationEngine.js';
export { ArchitectureEngine } from './domain/ArchitectureEngine.js';
export type { ArchitectureEngineOptions } from './domain/ArchitectureEngine.js';
export { TaskGraphBuilder } from './domain/TaskGraphBuilder.js';
export { ExecutionPolicyService, DEFAULT_EXECUTION_POLICY } from './domain/ExecutionPolicy.js';
export { FileOperationLayer } from './domain/FileOperationLayer.js';
export type { FileChangeInput, PlannedChange } from './domain/FileOperationLayer.js';
export { BlueprintService } from './domain/BlueprintService.js';
export type { BlueprintBuildInput } from './domain/BlueprintService.js';
export { PlanPreviewService } from './domain/PlanPreviewService.js';
export type { PreviewInput } from './domain/PlanPreviewService.js';
export { SecurityReviewer, severityRank } from './domain/SecurityReviewer.js';
export { UIQualityEvaluator } from './domain/UIQualityEvaluator.js';
export type { UIQualityInput } from './domain/UIQualityEvaluator.js';
export { ValidationPipeline } from './domain/ValidationPipeline.js';
export type { ValidationContext, ValidationOptions } from './domain/ValidationPipeline.js';
export { EconomicsTracker } from './domain/EconomicsTracker.js';
export {
  DeploymentAbstraction,
  SUPPORTED_DEPLOYMENT_TARGETS,
} from './domain/DeploymentAbstraction.js';
export { VersionControlService } from './domain/VersionControlService.js';
export { ApplicationRegistry, InMemoryApplicationRegistry } from './domain/ApplicationRegistry.js';
export type { ApplicationRegistryPort } from './domain/ApplicationRegistry.js';
export { FactoryEngine } from './domain/FactoryEngine.js';
export type {
  FactoryEngineOptions,
  CreateApplicationInput,
  BuildApplicationInput,
} from './domain/FactoryEngine.js';
export { MAX_REPAIR_ATTEMPTS } from './domain/FactoryEngine.js';

// ── Infrastructure ───────────────────────────────────────────────
export { InMemoryWorkspace } from './infrastructure/InMemoryWorkspace.js';
export { InMemoryApplicationRepository } from './infrastructure/InMemoryApplicationRepository.js';
export { PostgresApplicationRepository } from './infrastructure/PostgresApplicationRepository.js';
export {
  LocalDeploymentAdapter,
  VercelDeploymentAdapter,
  InMemoryVersionControl,
} from './infrastructure/adapters.js';

// ── Application (Phase 20: factory.* contract) ───────────────────
export { FactoryApplicationService } from './application/FactoryApplicationService.js';
export type {
  FactoryApplicationServiceOptions,
  FactoryCreateInput,
  FactoryLifecycleResultDTO,
} from './application/FactoryApplicationService.js';
export { FactoryMapper } from './application/FactoryMapper.js';
export type {
  FactoryCreateResultDTO,
  FactoryApplicationDTO,
  FactoryDetailDTO,
  FactoryApproveResultDTO,
  FactoryBuildResultDTO,
  FactoryDeployResultDTO,
} from './application/FactoryDTO.js';

// ── Catalog (Phases 2/4/18) ──────────────────────────────────────
export {
  ARCHETYPES,
  detectArchetype,
  archetypeLabel,
  SPECIALIST_ROLES,
  roleById,
  rolesForPhase,
  specialistRoleLabel,
} from './catalog/archetypes.js';
export type { ArchetypeDef } from './catalog/archetypes.js';
export { generateProject } from './catalog/generator.js';
export type { GeneratedFile, GenerateOptions } from './catalog/generator.js';
