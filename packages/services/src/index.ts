// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/services
// Application Service Layer — BLD-004 Identity Platform, BLD-005 AI Orchestrator, BLD-006 Knowledge Graph
// ──────────────────────────────────────────────────────────────────

export const name = 'services' as const;

// ── Identity Application Layer ────────────────────────────────────────────
export { IdentityApplicationService } from './identity/IdentityApplicationService.js';
export { UserMapper } from './identity/UserMapper.js';
export type {
  UserDTO,
  RegisterUserDTO,
  UpdateProfileDTO,
  UserListDTO,
} from './identity/UserDTO.js';

// ── AI Orchestrator Application Layer ──────────────────────────────────────
export { AIOrchestrationService, AIMapper, AIMetrics } from './ai/index.js';
export type {
  ProviderAdapter,
  OrchestrateRequestDTO,
  OrchestrateResponseDTO,
  ProviderHealthDTO,
  CapabilityProfileDTO,
  CostEstimateDTO,
  StreamingResponseDTO,
  ProviderListDTO,
  CapabilityListDTO,
} from './ai/index.js';

// ── Knowledge Graph Application Layer ─────────────────────────────────────
export { KnowledgeApplicationService } from './knowledge/KnowledgeApplicationService.js';
export { GraphTraversalService } from './knowledge/GraphTraversalService.js';
export { SearchService } from './knowledge/SearchService.js';
export { RecommendationPreparationService } from './knowledge/RecommendationPreparationService.js';
export { KnowledgeMapper } from './knowledge/KnowledgeMapper.js';
export type {
  KnowledgeNodeDTO,
  KnowledgeEdgeDTO,
  KnowledgeGraphDTO,
  KnowledgeNodeListDTO,
  KnowledgeEdgeListDTO,
  KnowledgeGraphListDTO,
  TraversalResultDTO,
  TraversalStepDTO,
  SearchResultDTO,
  ImpactResultDTO,
  GraphStatisticsDTO,
  CycleResultDTO,
  CreateNodeDTO,
  CreateEdgeDTO,
  CreateGraphDTO,
  UpdateNodeDTO,
  MergeNodesDTO,
  SplitNodeDTO,
} from './knowledge/KnowledgeDTO.js';
export type {
  KnowledgeQuery,
  KnowledgeCommand,
  KnowledgeContractEvent,
  KnowledgeMessage,
  KnowledgeContractResult,
  GetNodeQuery,
  CreateNodeCommand,
  CreateEdgeCommand,
  KnowledgeNodeCreatedEvent,
  KnowledgeEdgeCreatedEvent,
  KnowledgeGraphCreatedEvent,
} from './knowledge/KnowledgeContracts.js';

// ── Memory Engine Application Layer ───────────────────────────────────────
export { MemoryApplicationService } from './memory/MemoryApplicationService.js';
export { MemoryTimelineService } from './memory/MemoryTimelineService.js';
export { MemorySearchService } from './memory/MemorySearchService.js';
export { MemoryReflectionService } from './memory/MemoryReflectionService.js';
export { MemoryRetentionService } from './memory/MemoryRetentionService.js';
export { MemoryMapper } from './memory/MemoryMapper.js';
export type {
  CreateMemoryDTO,
  UpdateMemoryDTO,
  MemoryDTO,
  MemoryListDTO,
  TimelineEntryDTO,
  MemoryStatsDTO,
  DecayResultDTO,
  ConsolidationSuggestionDTO,
  RetentionResultDTO,
  MemoryContractEvent,
} from './memory/MemoryDTO.js';
export type {
  MemoryQuery,
  MemoryContextQuery,
  CaptureMemoryCommand,
  RecallMemoryCommand,
} from './memory/MemoryContracts.js';

// ── Decision Intelligence Engine Application Layer ─────────────────────────
export { DecisionApplicationService } from './decision/DecisionApplicationService.js';
export { DecisionMapper } from './decision/DecisionMapper.js';

// ── Execution Intelligence Engine Application Layer ────────────────────────
export { ExecutionApplicationService } from './execution/ExecutionApplicationService.js';
export { PlanningService } from './execution/PlanningService.js';
export { SchedulingService } from './execution/SchedulingService.js';
export { ProgressService } from './execution/ProgressService.js';
export { MonitoringService } from './execution/MonitoringService.js';
export { RecoveryService } from './execution/RecoveryService.js';
export { ExecutionMapper } from './execution/ExecutionMapper.js';
export type {
  CreateDecisionDTO,
  UpdateDecisionDTO,
  AddOptionDTO,
  ScoreOptionDTO,
  AssessRiskDTO,
  AssessOpportunityDTO,
  CompleteDecisionDTO,
  DecideDTO,
  DecisionQueryDTO,
  DecisionDTO,
  DecisionListDTO,
  DecisionStatsDTO,
  DecisionOptionDTO,
  DecisionEvidenceDTO,
  RankingDTO,
  RecommendationDTO,
  TradeoffDTO,
} from './decision/DecisionDTO.js';

export type {
  CreatePlanDTO,
  UpdatePlanDTO,
  CreateMissionDTO,
  CreateTaskDTO,
  AddStepDTO,
  CompleteTaskDTO,
  ReportExecutionDTO,
  AdaptPlanDTO,
  PlanDTO,
  MissionDTO,
  TaskDTO,
  StepDTO,
  PlanListDTO,
  DailyPlanDTO,
  WeeklyReviewDTO,
  ExecutionStatsDTO,
  BottleneckDTO,
  DependencyGraphDTO,
} from './execution/ExecutionDTO.js';

// ── Dashboard Application Layer ────────────────────────────────────────────
export { DashboardApplicationService } from './dashboard/DashboardApplicationService.js';

// ── Career Application Layer ───────────────────────────────────────────────
export { CareerApplicationService } from './career/CareerApplicationService.js';

// ── Learning Application Layer ─────────────────────────────────────────────
export { LearningApplicationService } from './learning/LearningApplicationService.js';

// ── Business Application Layer ─────────────────────────────────────────────
export { BusinessApplicationService } from './business/BusinessApplicationService.js';

// ── Marketplace Application Layer ──────────────────────────────────────────
export { MarketplaceApplicationService } from './marketplace/MarketplaceApplicationService.js';

// ── LifeOS Application Layer ───────────────────────────────────────────────
export { LifeOSApplicationService } from './lifeos/LifeOSApplicationService.js';
export type { LifeOSConfigDTO, LifeOSModule, LifeOSSearchCategory } from './lifeos/LifeOSDTO.js';
