// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Client Hooks
// Typed React hooks for consuming Life OS and module services
// BLD-016-B — Dashboard Landing Experience
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/explicit-function-return-type */
// Return types are inferred by tRPC's type system

'use client';

import type {
  ClientDTO,
  BrandDTO,
  ProjectDTO,
  ContentItemDTO,
  InvoiceDTO,
  CalendarEntryDTO,
  ContentAgencyDashboardDTO,
  ContentAgencyAnalyticsDTO,
  DeliveryExportDTO,
  ProposalDTO,
  ProposalDetailDTO,
  QuotationDTO,
  CreatePortalAccessResult,
  ProposalExportDTO,
  LeadDTO,
  LeadDetailDTO,
  ContractDTO,
  ContractDetailDTO,
  PaymentDTO,
  RevenueOverviewDTO,
  DocumentDTO,
  DocumentDetailDTO,
  PortalAccessDTO,
  PortalDashboardDTO,
  PortalContentPayload,
  OpsNotificationDTO,
  BusinessAnalyticsDTO,
  OrchestrateResponseDTO,
  ProviderHealthDTO,
  ProviderListDTO,
  CapabilityListDTO,
  ProviderSelectionDTO,
  StreamRunDTO,
} from '@vedmoulya/services';
import type { RagSearchResultDTO, RagStatsDTO } from '@vedmoulya/rag';
import type {
  CapabilityMarketplaceDTO,
  CapabilityDTO,
  CapabilityCompositionDTO,
  CapabilityGraphDTO,
  CapabilityCategory,
  CapabilityStatusValue,
  BusinessModule,
} from '@vedmoulya/capabilities';
import type {
  ProviderMarketplaceDTO,
  ProviderDTO,
  ProviderCapabilityMatrixDTO,
  ProviderFleetHealthDTO,
  ProviderLifecycleStatusValue,
  ProviderPreferences,
  ProviderIntelligenceStatusResult,
  ProviderIntelligenceRefreshResult,
} from '@vedmoulya/providers';
import type {
  DiscoveryDigest,
  DiscoveryItemView,
  DiscoveryRunReport,
  DiscoveryWorldResult,
} from '@vedmoulya/ai-world';
import type {
  CapabilityMarketplaceView,
  CapabilityPlanSummary,
  FactoryCapabilityPlan,
} from '@vedmoulya/capability-marketplace';
import type { CapabilityId } from '@vedmoulya/capability-marketplace';
import type {
  ExecutionRun,
  RunIntelligence,
  ExecutionPreferenceEvent,
} from '@vedmoulya/execution-bridge';
import type {
  BrainTask,
  BrainDecisionRecord,
  Opportunity,
  IntelligenceEvent,
} from '@vedmoulya/brain';
import type {
  GitHubPermissionView,
  GitHubBeginResult,
  GitHubVerifyResult,
  TaskIntelligenceResult,
  AcquisitionPlan,
  LicenseIntelligence,
  LifecycleRecord,
  IntelligenceNotification,
} from '@vedmoulya/ecosystem-intelligence';
import type { BridgeLoopRun } from '@vedmoulya/live-intelligence-bridge';
import type {
  SchedulerStatusView,
  DiscoverySchedule,
  DiscoveryRun,
  DiscoveryRunLedger,
  DiscoverySourcePolicy,
} from '@vedmoulya/ai-world-scheduler';

// ── EPIC-015 — GitHub repository facts view (token-free mirror) ─────────────
interface GitHubRepoFactsView {
  fullName: string;
  visibility: 'public' | 'private';
  description?: string;
  language?: string;
  stars?: number;
  forks?: number;
  lastCommitAt?: string;
  license?: string;
  defaultBranch?: string;
  archived: boolean;
  allowedActions: Array<'read' | 'clone' | 'write'>;
}

/** Notification view: the store attaches a per-user `read` flag at list time. */
type IntelligenceNotificationView = IntelligenceNotification & { read?: boolean };

/**
 * Gateway-supported capability ids — mirrors the RouterRegistry
 * capabilityIdEnum (the package CapabilityId also includes
 * QUALITY_EVALUATION / ASSEMBLY, which the gateway does not expose).
 */
export type GatewayCapabilityId = Exclude<CapabilityId, 'QUALITY_EVALUATION' | 'ASSEMBLY'>;

// ── EPIC-012A — Provider Experience view-model types ────────────────────────
// Shapes mirror the gateway ProviderExperienceService (the web app never
// imports from services/api — these are the typed API contract).

interface ProviderExperienceViewDTO {
  providers: Array<{
    providerId: string;
    name: string;
    family: string;
    selectedModel: { id: string; name: string } | null;
    models: Array<{ id: string; name: string; capabilities: string[] }>;
    availability: 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE' | 'LOCAL' | 'UNKNOWN';
    enabled: boolean;
    resourceType: string;
    freeToUse: boolean;
    health: { status: string; score: number; latencyMs: number; quotaUsedPercent: number };
    lifecycleStatus: string;
  }>;
  usage: {
    tokensUsed: number;
    tokenBudget: number;
    costUsd: number;
    aiCalls: number;
    cacheHits: number;
    freePercent: number;
    budgetPolicy: ProviderPreferences['budgetPolicy'];
    budgets: ProviderPreferences['budgets'];
  };
  preferences: ProviderPreferences;
}

interface ProviderUsageDetailDTO {
  totals: {
    aiCalls: number;
    tokensInput: number;
    tokensOutput: number;
    tokensTotal: number;
    costUsd: number;
    cacheHits: number;
    retries: number;
    latencyMs: number;
  };
  byProvider: Array<{
    provider: string;
    calls: number;
    latencyMs: number;
    tokensInput: number;
    tokensOutput: number;
    tokensTotal: number;
    costUsd: number;
  }>;
  byModel: Array<{
    providerId: string;
    modelId: string;
    calls: number;
    latencyMs: number;
    costUsd: number;
  }>;
  executions: Array<{
    traceId: string;
    name: string;
    status: string;
    tokensTotal: number;
    costUsd: number;
    aiCalls: number;
    startedAt: number;
  }>;
  preferences: ProviderPreferences;
}

type ProviderPreferencesDTO = ProviderPreferences;

interface ModelSelectionResultDTO {
  capability: string;
  selected: { providerId: string; modelId: string; resourceType: string; freeToUse: boolean };
  verdict: string;
  requiresPaidApproval: boolean;
  blockedReason?: string;
  preferenceConflict?: {
    preferred: string;
    reason: string;
    options: Array<{ label: string; providerId: string; modelId: string }>;
  };
  upgradeDowngrade: { action: 'upgrade' | 'downgrade' | 'keep'; reason: string };
  whySummary: string[];
  strategy: string;
  estimatedCost: number;
}
import type { CapabilityType, ModalityType, ProviderFamily } from '@vedmoulya/ai';
import type {
  ProviderBenchmarkDatasetDTO,
  ProviderBenchmarkQueryDTO,
  ProviderModelRegistryDTO,
} from '@vedmoulya/providers';
import type {
  ContextItemDTO,
  ContextRegistrySummaryDTO,
  ContextDiscoveryDTO,
  ContextCompressionResultDTO,
  ContextRankingDTO,
  ContextFilterResultDTO,
  EnterpriseContextPackageDTO,
  ContextMetricsDTO,
  ContextPreviewDTO,
  ContextExplanationDTO,
  ContextQueryDTO,
  ContextSource,
  ContextCategory,
  ContextPriority,
  CompressionStrategy,
} from '@vedmoulya/context';
import type {
  ExecutionStrategyDTO,
  StrategySummaryDTO,
  StrategyExplanationDTO,
  TokenEstimateDTO,
  CostEstimateDTO,
  LatencyEstimateDTO,
} from '@vedmoulya/execution-strategy';
import type {
  ExecutionGraphDTO,
  ExecutionSessionDTO,
  ExecutionWorkerDTO,
  ExecutionQueueEntryDTO,
  ExecutionMonitorSnapshotDTO,
  ExecutionRecoveryPlanDTO,
  ScheduleResultDTO,
  OrchestratorSummaryDTO,
  ExplainGraphDTO,
} from '@vedmoulya/execution-orchestrator';
import type {
  GoalDTO,
  GoalSummaryDTO,
  GoalExplanationDTO,
  GoalValidationDTO,
  GoalSearchDTO,
  TaskGraphDTO,
  TaskDTO,
  StrategyHandoffDTO,
  ProblemDefinition,
} from '@vedmoulya/goals';
import type {
  PipelineDTO,
  PipelineExplanationDTO,
  IntelligenceDashboardDTO,
} from '@vedmoulya/intelligence';
import type {
  LearningDashboardDTO,
  LearningEventDTO,
  LearningModelDTO,
  LearningRecommendationDTO,
  LearningInsightDTO,
  LearningReportDTO,
  LearningAnalyticsDTO,
  LearningDecisionDTO,
  LearningCategory,
} from '@vedmoulya/learning-intelligence';
import type {
  BrainDashboardDTO,
  BrainDecisionDTO,
  BrainDecisionMetricsDTO,
  BrainDecisionStatus,
  BrainDecisionType,
  BrainHistoryDTO,
  BrainPlanDTO,
} from '@vedmoulya/enterprise-brain';
import type {
  KnowledgeAnalyticsDTO,
  KnowledgeCategory,
  KnowledgeConsumerType,
  KnowledgeDashboardDTO,
  KnowledgeDiffDTO,
  KnowledgeExplanationDTO,
  KnowledgeGraphTraversalDTO,
  KnowledgeItemDTO,
  KnowledgeLifecycleStatus,
  KnowledgeRelationshipDTO,
  KnowledgeRelationshipType,
  KnowledgeSearchResultDTO,
  KnowledgeSourceType,
  KnowledgeTimelineEntryDTO,
  KnowledgeValidationReportDTO,
  KnowledgeValidationStatus,
  KnowledgeVersionDTO,
} from '@vedmoulya/knowledge-intelligence';
import type {
  MemoryAnalyticsDTO,
  MemoryCompressionState,
  MemoryDashboardDTO,
  MemoryGraphTraversalDTO,
  MemoryItemDTO,
  MemoryLifecycleStatus,
  MemoryRelationshipDTO,
  MemoryRelationshipType,
  MemoryRetentionPolicy,
  MemorySearchResultDTO,
  MemorySourceType,
  MemoryTimelineEntryDTO,
  MemoryType,
} from '@vedmoulya/memory-intelligence';
import type {
  OSDashboardDataDTO,
  OSDependencyGraphDTO,
  OSDiagnosticsReportDTO,
  OSEngineStatusDTO,
  OSHealthSnapshotDTO,
  OSPerformanceMetricsDTO,
  OSPipelineHealthDTO,
  OSPlatformValidationDTO,
  OSSystemHealthDTO,
} from '@vedmoulya/os-intelligence';
import type {
  PersonalGraphDTO,
  BusinessGraphDTO,
  ContextRetrievalResultDTO,
  ContextFabricPackageDTO,
  ContextExplanationDTO as FabricContextExplanationDTO,
  FabricHealthDTO,
  ContextSource as FabricContextSource,
  FabricEntityType,
  PermissionEvaluation,
} from '@vedmoulya/context-fabric';
import { api } from './trpc';

/** Strip the ApiResponse envelope: typed view of a query's `data` payload. */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- generic cast helper
function unwrap<T>(value: { data?: unknown } | undefined): T | undefined {
  return value?.data as T | undefined;
}

/**
 * Make a tRPC mutation throw when the gateway returns `success: false`.
 * The gateway maps service failures to an HTTP 200 `{ success: false }`
 * envelope, so without this, `isError` never fires for business errors
 * (e.g. "No provider available") and the UI silently shows an empty state.
 */
function guardMutation<A extends unknown[], R>(
  mutate: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    const res = await mutate(...args);
    const envelope = res as { success?: boolean; error?: { message?: string } | null };
    if (envelope.success === false) {
      throw new Error(envelope.error?.message ?? 'Request failed');
    }
    return res;
  };
}

// ── Life OS Hooks ───────────────────────────────────────────────────────────

/**
 * Fetch the full Life OS snapshot for the current user.
 * This is the primary data source for the Dashboard landing page.
 * The query is disabled when no userId is available (signed-out / pre-hydration)
 * so anonymous visitors do not fire doomed requests (BLD-016C strict auth).
 */
export function useLifeOSSnapshot(userId: string) {
  return api.lifeOS.getSnapshot.useQuery({ userId }, { enabled: Boolean(userId) });
}

/**
 * Fetch the Life OS dashboard view model (pre-formatted for display).
 */
export function useLifeOSViewModel(userId: string) {
  return api.lifeOS.getViewModel.useQuery({ userId }, { enabled: Boolean(userId) });
}

// ── Career Hooks ────────────────────────────────────────────────────────────

export function useCareer(userId: string) {
  return api.career.getCareer.useQuery({ userId }, { enabled: Boolean(userId) });
}

export function useCareerViewModel(userId: string) {
  return api.career.getViewModel.useQuery({ userId }, { enabled: Boolean(userId) });
}

// ── Learning Hooks ──────────────────────────────────────────────────────────

export function useLearning(userId: string) {
  return api.learning.getLearning.useQuery({ userId }, { enabled: Boolean(userId) });
}

export function useLearningViewModel(userId: string) {
  return api.learning.getViewModel.useQuery({ userId }, { enabled: Boolean(userId) });
}

// ── Business Hooks ──────────────────────────────────────────────────────────

export function useBusiness(userId: string) {
  return api.business.getBusiness.useQuery({ userId }, { enabled: Boolean(userId) });
}

export function useBusinessViewModel(userId: string) {
  return api.business.getViewModel.useQuery({ userId }, { enabled: Boolean(userId) });
}

// ── Marketplace Hooks ───────────────────────────────────────────────────────

export function useMarketplace(userId: string) {
  return api.marketplace.getMarketplace.useQuery({ userId }, { enabled: Boolean(userId) });
}

export function useMarketplaceViewModel(userId: string) {
  return api.marketplace.getViewModel.useQuery({ userId }, { enabled: Boolean(userId) });
}

// ── Capability Registry Hooks (EPIC-004 / EI-001) ──────────────────────────

export function useCapabilityMarketplace(userId: string) {
  const query = api.capabilities.getMarketplace.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...query, data: unwrap<CapabilityMarketplaceDTO>(query.data) };
}

export function useCapabilitySearch(
  userId: string,
  criteria: {
    query?: string;
    categories?: CapabilityCategory[];
    statuses?: CapabilityStatusValue[];
    businessModules?: BusinessModule[];
    onlyCompositions?: boolean;
  },
) {
  const query = api.capabilities.search.useQuery(
    { userId, ...criteria },
    { enabled: Boolean(userId) },
  );
  return { ...query, data: unwrap<{ items: CapabilityDTO[]; total: number }>(query.data) };
}

export function useCapability(userId: string, id: string) {
  const query = api.capabilities.getCapability.useQuery(
    { userId, id },
    { enabled: Boolean(userId) && Boolean(id) },
  );
  return { ...query, data: unwrap<CapabilityDTO>(query.data) };
}

export function useCapabilityGraph(userId: string) {
  const query = api.capabilities.getGraph.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...query, data: unwrap<CapabilityGraphDTO>(query.data) };
}

export function useCapabilityCompositionTree(userId: string, id: string) {
  const query = api.capabilities.getCompositionTree.useQuery(
    { userId, id },
    { enabled: Boolean(userId) && Boolean(id) },
  );
  return {
    ...query,
    data: unwrap<{ tree: CapabilityCompositionDTO; leaves: string[] }>(query.data),
  };
}

// ── Provider Registry Hooks (EPIC-004 / EI-002) ────────────────────────────

export function useProviderMarketplace(userId: string) {
  const query = api.providers.getMarketplace.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...query, data: unwrap<ProviderMarketplaceDTO>(query.data) };
}

export function useProviderSearch(
  userId: string,
  criteria: {
    query?: string;
    families?: ProviderFamily[];
    lifecycleStatuses?: ProviderLifecycleStatusValue[];
    capabilities?: CapabilityType[];
    modalities?: ModalityType[];
    tags?: string[];
    minHealthScore?: number;
    minContextLength?: number;
    feature?: 'streaming' | 'vision' | 'function_calling' | 'embeddings';
  },
) {
  const query = api.providers.search.useQuery(
    { userId, ...criteria },
    { enabled: Boolean(userId) },
  );
  return { ...query, data: unwrap<{ items: ProviderDTO[]; total: number }>(query.data) };
}

export function useProvider(userId: string, id: string) {
  const query = api.providers.getProvider.useQuery(
    { userId, id },
    { enabled: Boolean(userId) && Boolean(id) },
  );
  return { ...query, data: unwrap<ProviderDTO>(query.data) };
}

export function useProviderCapabilityMatrix(userId: string) {
  const query = api.providers.getCapabilityMatrix.useQuery(
    { userId },
    { enabled: Boolean(userId) },
  );
  return { ...query, data: unwrap<ProviderCapabilityMatrixDTO>(query.data) };
}

export function useProviderFleetHealth(userId: string) {
  const query = api.providers.getFleetHealth.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...query, data: unwrap<ProviderFleetHealthDTO>(query.data) };
}

export function useProviderBenchmarkDatasets(
  userId: string,
  query: ProviderBenchmarkQueryDTO = {},
) {
  const q = api.providers.getBenchmarkDatasets.useQuery(
    { userId, ...query },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<ProviderBenchmarkDatasetDTO>(q.data) };
}

export function useProviderModelRegistry(userId: string) {
  const q = api.providers.getModelRegistry.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<ProviderModelRegistryDTO>(q.data) };
}

// ── EPIC-019 — Provider Runtime Truth Hook ─────────────────────────────────
// Surfaces the SAME registry the config layer, production validator and
// provider registration use: CONFIGURED / NOT_CONFIGURED / UNSUPPORTED_RUNTIME /
// MOCK / DISABLED / ERROR per family (key NAMES only — never secret values).

export interface ProviderRuntimeStateDTO {
  family: string;
  name: string;
  status: string;
  reason: string;
  adapterImplemented: boolean;
  registered: boolean;
  canExecute: boolean;
  freeTier: boolean;
  defaultEligible: boolean;
  envKeys: string[];
}

export interface ProviderRuntimeStatusDTO {
  mode: string;
  defaultProvider: string;
  defaultProviderSupported: boolean;
  providers: ProviderRuntimeStateDTO[];
}

export function useProviderRuntimeStatus(userId: string) {
  const q = api.providers.getRuntimeStatus.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<ProviderRuntimeStatusDTO>(q.data) };
}

// ── EPIC-012A — Provider Experience Hooks ───────────────────────────────────

export function useProviderExperience(userId: string) {
  const q = api.providers.getExperience.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<ProviderExperienceViewDTO>(q.data) };
}

export function useProviderPreferences(userId: string) {
  const q = api.providers.getPreferences.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<ProviderPreferencesDTO>(q.data) };
}

export function useSetProviderPreferences() {
  const mutation = api.providers.setPreferences.useMutation();
  return {
    ...mutation,
    data: unwrap<ProviderPreferencesDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useSetProviderEnabled() {
  const mutation = api.providers.setProviderEnabled.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useProviderUsageDetail(userId: string) {
  const q = api.providers.getUsageDetail.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<ProviderUsageDetailDTO>(q.data) };
}

export function useExplainModelSelection() {
  const mutation = api.providers.explainModelSelection.useMutation();
  return {
    ...mutation,
    data: unwrap<ModelSelectionResultDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

// ── EPIC-012B — Provider Intelligence Refresh Hooks ────────────────────────
// Cache-first intelligence status (profile + staleness + verification) and
// the explicit safe refresh (re-derives, reports model deltas, never deletes
// user configuration).

export function useProviderIntelligenceStatus(userId: string, providerId: string) {
  const q = api.providers.getIntelligenceStatus.useQuery(
    { userId, id: providerId },
    { enabled: Boolean(userId) && Boolean(providerId) },
  );
  return { ...q, data: unwrap<ProviderIntelligenceStatusResult>(q.data) };
}

export function useRefreshProviderIntelligence() {
  const mutation = api.providers.refreshIntelligence.useMutation();
  return {
    ...mutation,
    data: unwrap<ProviderIntelligenceRefreshResult>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

// ── EPIC-012C — AI World Discovery Hooks ───────────────────────────────────
// The aiWorld.* contract: the bell view (world sections + unread badge), the
// concise digest, the per-user discovery list, and the owner-scoped actions
// (markRead / markAllRead / setAction) + the bounded runDiscovery refresh.

export function useAIWorldWorld(userId: string) {
  const q = api.aiWorld.getWorld.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<DiscoveryWorldResult>(q.data) };
}

export function useAIWorldDigest(userId: string) {
  const q = api.aiWorld.getDigest.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<DiscoveryDigest>(q.data) };
}

export function useAIWorldList(userId: string) {
  const q = api.aiWorld.list.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<DiscoveryItemView[]>(q.data) };
}

export function useAIWorldMarkRead() {
  const mutation = api.aiWorld.markRead.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useAIWorldMarkAllRead() {
  const mutation = api.aiWorld.markAllRead.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useAIWorldSetAction() {
  const mutation = api.aiWorld.setAction.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useAIWorldRunDiscovery() {
  const mutation = api.aiWorld.runDiscovery.useMutation();
  return {
    ...mutation,
    data: unwrap<DiscoveryRunReport>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

// ── EPIC-018 — AI World Scheduler Hooks ────────────────────────────────────
// The aiWorldScheduler.* contract: getStatus (the /ai-world Discovery
// Activity view) · listSchedules / setSchedule (enable/disable/frequency) ·
// runNow (manual discovery through the EXACT same bounded path as scheduled
// runs — no privileged shortcut) · cancelRun · listRuns / getLedger /
// listSourcePolicies.

export function useAIWorldSchedulerStatus(userId: string) {
  const q = api.aiWorldScheduler.getStatus.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<SchedulerStatusView>(q.data) };
}

// ── EPIC-018 runtime closure — automatic discovery status ────────────────────
// Mirrors the gateway SchedulerRuntimeStatus (the web app never imports from
// services/api — this is the typed API contract). The UI must never show
// "scheduled" when the runtime driver is not actually active.

export interface SchedulerRuntimeStatusViewDTO {
  active: boolean;
  reason: 'enabled' | 'disabled' | 'not_started';
  intervalMs?: number;
  maxUsersPerTick: number;
  /** EPIC-021 — Brain opportunity refresh runs on this heartbeat. */
  refreshIntelligenceEnabled: boolean;
  startedAt?: number;
  lastTickAt?: number;
  lastTick?: {
    startedAt: number;
    finishedAt: number;
    usersProcessed: number;
    runsStarted: number;
    runsSkipped: number;
    /** EPIC-021 — new opportunities surfaced by the Brain's continuous bridge. */
    opportunitiesFound: number;
    /** EPIC-021 — EPIC-015 notifications emitted for new opportunities. */
    notificationsEmitted: number;
    errors: number;
    errorSample: string[];
    truncated: boolean;
    userDirectoryError?: string;
  };
  nextTickAt?: number;
}

export function useAIWorldSchedulerRuntimeStatus(userId: string) {
  const q = api.aiWorldScheduler.getRuntimeStatus.useQuery(
    { userId },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<SchedulerRuntimeStatusViewDTO>(q.data) };
}

export function useAIWorldSchedulerSchedules(userId: string) {
  const q = api.aiWorldScheduler.listSchedules.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<DiscoverySchedule[]>(q.data) };
}

export function useAIWorldSchedulerRuns(userId: string) {
  const q = api.aiWorldScheduler.listRuns.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<DiscoveryRun[]>(q.data) };
}

export function useAIWorldSchedulerLedger(userId: string) {
  const q = api.aiWorldScheduler.getLedger.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<DiscoveryRunLedger>(q.data) };
}

export function useAIWorldSchedulerPolicies(userId: string) {
  const q = api.aiWorldScheduler.listSourcePolicies.useQuery(
    { userId },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<DiscoverySourcePolicy[]>(q.data) };
}

export function useAIWorldSchedulerSetSchedule() {
  const mutation = api.aiWorldScheduler.setSchedule.useMutation();
  return {
    ...mutation,
    data: unwrap<DiscoverySchedule>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useAIWorldSchedulerRunNow() {
  const mutation = api.aiWorldScheduler.runNow.useMutation();
  return {
    ...mutation,
    data: unwrap<DiscoveryRun>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useAIWorldSchedulerCancelRun() {
  const mutation = api.aiWorldScheduler.cancelRun.useMutation();
  return {
    ...mutation,
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

// ── EPIC-013 — AI Capability Marketplace Hooks ─────────────────────────────
// The capability.* contract: plan (outcome → FactoryCapabilityPlan),
// getPlan / listPlans (owner-scoped history) and the capabilities view.

export function useCapabilityPlan() {
  const mutation = api.capability.plan.useMutation();
  return {
    ...mutation,
    data: unwrap<FactoryCapabilityPlan>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useCapabilityGetPlan(userId: string, planId: string) {
  const q = api.capability.getPlan.useQuery(
    { userId, planId },
    { enabled: Boolean(userId) && Boolean(planId) },
  );
  return { ...q, data: unwrap<FactoryCapabilityPlan | null>(q.data) };
}

export function useCapabilityListPlans(userId: string) {
  const q = api.capability.listPlans.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<CapabilityPlanSummary[]>(q.data) };
}

export function useCapabilityMarketplaceView(userId: string) {
  const q = api.capability.capabilities.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<CapabilityMarketplaceView>(q.data) };
}

// ── EPIC-014 — Capability Execution Engine Hooks ───────────────────────────
// The execution.* contract: start (plan → bounded run), get/list
// (owner-scoped reads), approve/reject (approval gate), completeHandoff
// (configure/manual/external hand-off), cancel, preferenceLedger (Phase 5
// provenance) and intelligence (Phase 4 run view). Every action returns the
// updated run, so the UI can advance without refetching.

export function useExecutionStart() {
  const mutation = api.execution.start.useMutation();
  return {
    ...mutation,
    data: unwrap<ExecutionRun>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useExecutionGet(userId: string, executionId: string) {
  const q = api.execution.get.useQuery(
    { userId, executionId },
    { enabled: Boolean(userId) && Boolean(executionId) },
  );
  return { ...q, data: unwrap<ExecutionRun | null>(q.data) };
}

export function useExecutionList(userId: string) {
  const q = api.execution.list.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<ExecutionRun[]>(q.data) };
}

export function useExecutionApprove() {
  const mutation = api.execution.approve.useMutation();
  return {
    ...mutation,
    data: unwrap<ExecutionRun>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useExecutionReject() {
  const mutation = api.execution.reject.useMutation();
  return {
    ...mutation,
    data: unwrap<ExecutionRun>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useExecutionCompleteHandoff() {
  const mutation = api.execution.completeHandoff.useMutation();
  return {
    ...mutation,
    data: unwrap<ExecutionRun>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useExecutionCancel() {
  const mutation = api.execution.cancel.useMutation();
  return {
    ...mutation,
    data: unwrap<ExecutionRun>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useExecutionPreferenceLedger(userId: string) {
  const q = api.execution.preferenceLedger.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<ExecutionPreferenceEvent[]>(q.data) };
}

export function useExecutionIntelligence(userId: string, executionId: string) {
  const q = api.execution.intelligence.useQuery(
    { userId, executionId },
    { enabled: Boolean(userId) && Boolean(executionId) },
  );
  return { ...q, data: unwrap<RunIntelligence>(q.data) };
}

// ── EPIC-016 — The VedMoulya Brain Hooks ────────────────────────────────────
// The brain.* contract: createTask (understand) → plan (EPIC-013 capability
// plan) → selectResources (N-provider role assignment) → execute (bounded,
// through the frozen runtime) → verify → result; plus sensitive-action
// approval gates (requestApproval / approve / reject), owner-scoped reads
// (getStatus / listTasks / getDecisionRecords), cancel and the
// outcome-learning feed (evaluateOutcome). Every action returns the updated
// BrainTask, so the UI can advance the pipeline without refetching.

export function useBrainCreateTask() {
  const mutation = api.brain.createTask.useMutation();
  return {
    ...mutation,
    data: unwrap<BrainTask>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useBrainPlan() {
  const mutation = api.brain.plan.useMutation();
  return {
    ...mutation,
    data: unwrap<BrainTask>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useBrainSelectResources() {
  const mutation = api.brain.selectResources.useMutation();
  return {
    ...mutation,
    data: unwrap<BrainTask>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useBrainExecute() {
  const mutation = api.brain.execute.useMutation();
  return {
    ...mutation,
    data: unwrap<BrainTask>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useBrainVerify(userId: string, taskId: string) {
  const q = api.brain.verify.useQuery(
    { userId, taskId },
    { enabled: Boolean(userId) && Boolean(taskId) },
  );
  return { ...q, data: unwrap<BrainTask>(q.data) };
}

export function useBrainRequestApproval() {
  const mutation = api.brain.requestApproval.useMutation();
  return {
    ...mutation,
    data: unwrap<BrainTask>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useBrainApprove() {
  const mutation = api.brain.approve.useMutation();
  return {
    ...mutation,
    data: unwrap<BrainTask>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useBrainReject() {
  const mutation = api.brain.reject.useMutation();
  return {
    ...mutation,
    data: unwrap<BrainTask>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useBrainGetStatus(userId: string, taskId: string) {
  const q = api.brain.getStatus.useQuery(
    { userId, taskId },
    { enabled: Boolean(userId) && Boolean(taskId) },
  );
  return { ...q, data: unwrap<BrainTask>(q.data) };
}

export function useBrainListTasks(userId: string) {
  const q = api.brain.listTasks.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<BrainTask[]>(q.data) };
}

export function useBrainDecisionRecords(userId: string, taskId: string) {
  const q = api.brain.getDecisionRecords.useQuery(
    { userId, taskId },
    { enabled: Boolean(userId) && Boolean(taskId) },
  );
  return { ...q, data: unwrap<BrainDecisionRecord[]>(q.data) };
}

export function useBrainCancel() {
  const mutation = api.brain.cancel.useMutation();
  return {
    ...mutation,
    data: unwrap<BrainTask>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useBrainEvaluateOutcome() {
  const mutation = api.brain.evaluateOutcome.useMutation();
  return {
    ...mutation,
    data: unwrap<BrainTask>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

// ── EPIC-020 (Outcome & Revenue layer) — Today's Top 5 (§8) ────────
/** Daily priority action — mirrors the brain OutcomePriorityEngine view. */
export interface DailyActionDTO {
  id: string;
  title: string;
  category: string;
  whyItMatters: string[];
  recommendedNextAction: string;
  priorityScore: number;
  requiresApproval?: string;
  source: { kind: string; id: string };
  expectedValue?: {
    category: string;
    label: string;
    status: string;
    amount?: number;
    unit?: string;
  };
  uncertainty?: number;
}

export function useBrainDailyPriorities(userId: string, limit = 5) {
  const q = api.brain.dailyPriorities.useQuery({ userId, limit }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<DailyActionDTO[]>(q.data) };
}

// ── EPIC-020 — Continuous Intelligence & Adaptive Orchestration Hooks ───────
// The brain.* continuous surface: discoverIntelligence (AI World / scheduler
// → screened intelligence events → opportunities), owner-scoped opportunity
// and event reads/updates, adaptive provider performance scores and the
// operating dashboard (status · approvals · opportunities · discoveries ·
// provider health · usage/cost · learning).

/** Brain operating dashboard view — mirrors BrainDashboardService. */
export interface BrainDashboardViewDTO {
  generatedAt: string;
  brainStatus: 'IDLE' | 'WORKING' | 'AWAITING_APPROVAL';
  activeTasks: number;
  pendingApprovals: Array<{ taskId: string; objective: string; actions: string[] }>;
  recentTasks: Array<{
    id: string;
    objective: string;
    status: string;
    stage: string;
    updatedAt: string;
  }>;
  opportunities: Array<{
    id: string;
    category: string;
    title: string;
    uncertainty: number;
    status: string;
  }>;
  intelligenceEvents: Array<{
    id: string;
    kind: string;
    title: string;
    security: string;
    relevance: number;
    status: string;
  }>;
  providerHealth: Array<{
    providerId: string;
    name: string;
    availability: string;
    healthStatus: string;
    quotaUsedPercent: number;
  }>;
  usage: {
    tokensUsed: number;
    tokenBudget: number;
    costUsd: number;
    aiCalls: number;
    freePercent: number;
  };
  adaptiveScores: Array<{
    providerId: string;
    capability: string;
    qualityScore: number;
    sampleCount: number;
  }>;
  learning: Array<{
    taskId: string;
    taskType: string;
    outcome: string;
    userAccepted: boolean;
    capturedAt: string;
  }>;
  scheduler: { nextDiscoveryAt?: string; meaningfulUpdates: number; enabledJobs: number };
}

export function useBrainDashboard(userId: string) {
  const q = api.brain.dashboard.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<BrainDashboardViewDTO>(q.data) };
}

export function useBrainDiscoverIntelligence() {
  const mutation = api.brain.discoverIntelligence.useMutation();
  return {
    ...mutation,
    data: unwrap<{ events: IntelligenceEvent[]; opportunities: Opportunity[] }>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useBrainListOpportunities(userId: string) {
  const q = api.brain.listOpportunities.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<Opportunity[]>(q.data) };
}

export function useBrainUpdateOpportunity() {
  const mutation = api.brain.updateOpportunity.useMutation();
  return {
    ...mutation,
    data: unwrap<Opportunity>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useBrainListIntelligenceEvents(userId: string) {
  const q = api.brain.listIntelligenceEvents.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<IntelligenceEvent[]>(q.data) };
}

export function useBrainUpdateIntelligenceEvent() {
  const mutation = api.brain.updateIntelligenceEvent.useMutation();
  return {
    ...mutation,
    data: unwrap<IntelligenceEvent>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

// ── EPIC-017 — Live Intelligence Bridge Hooks ─────────────────────────────
// The liveIntelligence.* contract runs the complete loop through the EXISTING
// ecosystem: start (understand) → discover → compare → recommend → approve /
// reject → handOff (configuration/execution) → verify → evaluateAndLearn
// (outcome + preference feedback + relevance-gated AI World notification) +
// owner-scoped reads (get / list / performanceProfile) and emitNotification.
// Every action returns the updated BridgeLoopRun so the UI advances the loop
// without refetching — same convention as the brain hooks.

export function useLiveIntelligenceStart() {
  const mutation = api.liveIntelligence.start.useMutation();
  return {
    ...mutation,
    data: unwrap<BridgeLoopRun>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useLiveIntelligenceDiscover() {
  const mutation = api.liveIntelligence.discover.useMutation();
  return {
    ...mutation,
    data: unwrap<BridgeLoopRun>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useLiveIntelligenceCompare() {
  const mutation = api.liveIntelligence.compare.useMutation();
  return {
    ...mutation,
    data: unwrap<BridgeLoopRun>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useLiveIntelligenceRecommend() {
  const mutation = api.liveIntelligence.recommend.useMutation();
  return {
    ...mutation,
    data: unwrap<BridgeLoopRun>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useLiveIntelligenceApprove() {
  const mutation = api.liveIntelligence.approve.useMutation();
  return {
    ...mutation,
    data: unwrap<BridgeLoopRun>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useLiveIntelligenceReject() {
  const mutation = api.liveIntelligence.reject.useMutation();
  return {
    ...mutation,
    data: unwrap<BridgeLoopRun>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useLiveIntelligenceHandOff() {
  const mutation = api.liveIntelligence.handOff.useMutation();
  return {
    ...mutation,
    data: unwrap<BridgeLoopRun>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useLiveIntelligenceEvaluateAndLearn() {
  const mutation = api.liveIntelligence.evaluateAndLearn.useMutation();
  return {
    ...mutation,
    data: unwrap<BridgeLoopRun>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useLiveIntelligenceGet(userId: string, loopId: string) {
  const q = api.liveIntelligence.get.useQuery(
    { userId, loopId },
    { enabled: Boolean(userId) && Boolean(loopId) },
  );
  return { ...q, data: unwrap<BridgeLoopRun>(q.data) };
}

export function useLiveIntelligenceList(userId: string) {
  const q = api.liveIntelligence.list.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<BridgeLoopRun[]>(q.data) };
}

// ── EPIC-015 — Ecosystem Intelligence Hooks ────────────────────────────────
// The github.* contract (Connect GitHub — separate from Google auth, GitHub
// App architecture, least-privilege) and the ecosystemIntelligence.* contract
// (the Brain's intelligence questions: is something significantly better
// available for THIS task? — across configured providers, free providers,
// local models, GitHub projects and paid providers; evidence-first, never
// auto-activated). Secrets never cross the gateway — only sanitized views.

// github.* — GitHub connection (permission review is a first-class step) ──────

export function useGitHubGetConnection(userId: string) {
  const q = api.github.getConnection.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<GitHubPermissionView>(q.data) };
}

export function useGitHubBeginConnect() {
  const mutation = api.github.beginConnect.useMutation();
  return {
    ...mutation,
    data: unwrap<GitHubBeginResult>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useGitHubCompleteAuth() {
  const mutation = api.github.completeAuth.useMutation();
  return {
    ...mutation,
    data: unwrap<GitHubPermissionView>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useGitHubVerify() {
  const mutation = api.github.verify.useMutation();
  return {
    ...mutation,
    data: unwrap<GitHubVerifyResult>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useGitHubRevoke() {
  const mutation = api.github.revoke.useMutation();
  return {
    ...mutation,
    data: unwrap<GitHubPermissionView>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useGitHubDisconnect() {
  const mutation = api.github.disconnect.useMutation();
  return {
    ...mutation,
    data: unwrap<GitHubPermissionView>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useGitHubListRepositories(userId: string) {
  const q = api.github.listRepositories.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<{ repos: GitHubRepoFactsView[]; error?: string }>(q.data) };
}

export function useGitHubGetPermissions(userId: string) {
  const q = api.github.getPermissions.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<GitHubPermissionView>(q.data) };
}

// ecosystemIntelligence.* — task-specific intelligence (Brain questions) ─────

export function useIntelligenceFindBetterOption(
  userId: string,
  params: {
    capability: GatewayCapabilityId;
    objective: string;
    domain: string;
    qualityTarget: 'LOW' | 'MEDIUM' | 'HIGH';
    privacyRequirement: 'PRIVATE' | 'STANDARD';
  },
  enabled: boolean,
) {
  const q = api.ecosystemIntelligence.findBetterOption.useQuery(
    { userId, ...params },
    { enabled: Boolean(userId) && enabled },
  );
  return { ...q, data: unwrap<TaskIntelligenceResult>(q.data) };
}

export function useIntelligenceFindFreeAlternative(
  userId: string,
  capability: GatewayCapabilityId,
) {
  const q = api.ecosystemIntelligence.findFreeAlternative.useQuery(
    { userId, capability },
    { enabled: Boolean(userId) && Boolean(capability) },
  );
  return {
    ...q,
    data: unwrap<{
      free: boolean;
      name?: string;
      providerId?: string;
      quality?: number;
      note?: string;
    }>(q.data),
  };
}

export function useIntelligenceFindLocalAlternative(
  userId: string,
  capability: GatewayCapabilityId,
) {
  const q = api.ecosystemIntelligence.findLocalAlternative.useQuery(
    { userId, capability },
    { enabled: Boolean(userId) && Boolean(capability) },
  );
  return {
    ...q,
    data: unwrap<Array<{ name: string; available: boolean }> | { available: false; note: string }>(
      q.data,
    ),
  };
}

export function useIntelligenceFindGitHubCapability(
  userId: string,
  capability: GatewayCapabilityId,
) {
  const q = api.ecosystemIntelligence.findGitHubCapability.useQuery(
    { userId, capability },
    { enabled: Boolean(userId) && Boolean(capability) },
  );
  return {
    ...q,
    data: unwrap<{
      found: boolean;
      items: Array<{ title: string; configurable: boolean; securityFlags: string[] }>;
      note?: string;
    }>(q.data),
  };
}

export function useIntelligenceFindBetterProvider(userId: string, capability: GatewayCapabilityId) {
  const q = api.ecosystemIntelligence.findBetterProvider.useQuery(
    { userId, capability },
    { enabled: Boolean(userId) && Boolean(capability) },
  );
  return {
    ...q,
    data: unwrap<{
      better: boolean;
      current?: { name: string; quality?: number };
      recommended?: { name: string; quality?: number; requiresActivation: boolean };
      note?: string;
    }>(q.data),
  };
}

export function useIntelligenceEvaluateSecurity(userId: string, resourceId: string) {
  const q = api.ecosystemIntelligence.evaluateSecurity.useQuery(
    { userId, resourceId },
    { enabled: Boolean(userId) && Boolean(resourceId) },
  );
  return { ...q, data: unwrap<{ state: string; evidence: string[] }>(q.data) };
}

export function useIntelligenceEvaluateLicense(
  userId: string,
  license?: string,
  modelLicense?: string,
) {
  const q = api.ecosystemIntelligence.evaluateLicense.useQuery(
    { userId, license, modelLicense },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<LicenseIntelligence>(q.data) };
}

export function useIntelligenceCheckFreshness(userId: string, resourceId: string) {
  const q = api.ecosystemIntelligence.checkCapabilityFreshness.useQuery(
    { userId, resourceId },
    { enabled: Boolean(userId) && Boolean(resourceId) },
  );
  return {
    ...q,
    data: unwrap<{
      fresh: 'FRESH' | 'STALE' | 'UNVERIFIED' | 'UNKNOWN';
      state?: string;
      verifiedAt?: string;
      note?: string;
    }>(q.data),
  };
}

export function useIntelligenceGetAcquisitionPlan(
  userId: string,
  params: {
    repository: string;
    visibility: 'public' | 'private';
    license?: string;
    relevance: string[];
    repoReadAuthorized: boolean;
    repositoryFacts: {
      installScripts: string[];
      credentialCollection: boolean;
      secretExposure: boolean;
      arbitraryCommandExecution: boolean;
      remoteCodeExecutionPaths: boolean;
      sandboxAvailable: boolean;
    };
  },
  enabled: boolean,
) {
  const q = api.ecosystemIntelligence.getAcquisitionPlan.useQuery(
    { userId, ...params },
    { enabled: Boolean(userId) && enabled },
  );
  return { ...q, data: unwrap<AcquisitionPlan>(q.data) };
}

export function useIntelligenceApproveAcquisition() {
  const mutation = api.ecosystemIntelligence.approveAcquisition.useMutation();
  return {
    ...mutation,
    data: unwrap<{ state: string; error?: string }>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useIntelligenceRejectAcquisition() {
  const mutation = api.ecosystemIntelligence.rejectAcquisition.useMutation();
  return {
    ...mutation,
    data: unwrap<{ state: string; fallback?: string; error?: string }>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useIntelligenceRespondToRecommendation() {
  const mutation = api.ecosystemIntelligence.respondToRecommendation.useMutation();
  return {
    ...mutation,
    data: unwrap<{ state: string; recommendationId?: string; error?: string }>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useIntelligenceListLifecycle(userId: string) {
  const q = api.ecosystemIntelligence.listLifecycle.useQuery(
    { userId },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<LifecycleRecord[]>(q.data) };
}

export function useIntelligenceGetLifecycle(userId: string, resourceId: string) {
  const q = api.ecosystemIntelligence.getLifecycle.useQuery(
    { userId, resourceId },
    { enabled: Boolean(userId) && Boolean(resourceId) },
  );
  return { ...q, data: unwrap<LifecycleRecord | { state: 'UNKNOWN'; evidence: string[] }>(q.data) };
}

export function useIntelligenceListNotifications(userId: string) {
  const q = api.ecosystemIntelligence.listNotifications.useQuery(
    { userId },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<IntelligenceNotificationView[]>(q.data) };
}

export function useIntelligenceMarkNotificationRead() {
  const mutation = api.ecosystemIntelligence.markNotificationRead.useMutation();
  return {
    ...mutation,
    data: unwrap<{ ok: boolean }>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

// ── Context Registry Hooks (EPIC-004 / EI-003) ─────────────────────────────

export function useContextSummary(userId: string) {
  const q = api.context.getSummary.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<ContextRegistrySummaryDTO>(q.data) };
}

export function useContextMetrics(userId: string) {
  const q = api.context.getMetrics.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<ContextMetricsDTO>(q.data) };
}

export function useContextSearch(userId: string, criteria: ContextQueryDTO = {}) {
  const q = api.context.search.useQuery({ userId, ...criteria }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<{ items: ContextItemDTO[]; total: number }>(q.data) };
}

export function useContextRank(
  userId: string,
  criteria: ContextQueryDTO & {
    capability: CapabilityType;
    requestIntent?: string;
    businessContext?: string[];
    maxResults?: number;
  },
) {
  const q = api.context.rank.useQuery({ userId, ...criteria }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<ContextRankingDTO>(q.data) };
}

export function useContextFilter(userId: string, criteria: ContextQueryDTO = {}) {
  const q = api.context.filter.useQuery({ userId, ...criteria }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<ContextFilterResultDTO>(q.data) };
}

export function useContextCompress(
  userId: string,
  criteria: ContextQueryDTO & {
    targetTokens: number;
    strategy?: CompressionStrategy;
    preserveCritical?: boolean;
    minConfidence?: number;
  },
) {
  const q = api.context.compress.useQuery({ userId, ...criteria }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<ContextCompressionResultDTO>(q.data) };
}

export function useContextAssemble(
  userId: string,
  criteria: ContextQueryDTO & {
    goal: string;
    capability: CapabilityType;
    prompt: string;
    requestIntent?: string;
    businessContext?: string[];
    targetTokens?: number;
    strategy?: CompressionStrategy;
  },
) {
  const q = api.context.assemble.useQuery({ userId, ...criteria }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<EnterpriseContextPackageDTO>(q.data) };
}

export function useContextDiscover(
  userId: string,
  criteria: ContextQueryDTO & { capability?: CapabilityType; businessContext?: string[] } = {},
) {
  const q = api.context.discover.useQuery({ userId, ...criteria }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<ContextDiscoveryDTO>(q.data) };
}

export function useContextPreview(userId: string, id: string) {
  const q = api.context.preview.useQuery(
    { userId, id, capability: 'reasoning' },
    { enabled: Boolean(userId) && Boolean(id) },
  );
  return { ...q, data: unwrap<ContextPreviewDTO>(q.data) };
}

export function useContextExplain(userId: string, id: string) {
  const q = api.context.explain.useQuery(
    { userId, id, capability: 'reasoning' },
    { enabled: Boolean(userId) && Boolean(id) },
  );
  return { ...q, data: unwrap<ContextExplanationDTO>(q.data) };
}

export function useContextBySource(userId: string, source: ContextSource) {
  const q = api.context.listBySource.useQuery({ userId, source }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<ContextItemDTO[]>(q.data) };
}

export function useContextByCategory(userId: string, category: ContextCategory) {
  const q = api.context.listByCategory.useQuery({ userId, category }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<ContextItemDTO[]>(q.data) };
}

export function useContextByPriority(userId: string, priority: ContextPriority) {
  const q = api.context.listByPriority.useQuery({ userId, priority }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<ContextItemDTO[]>(q.data) };
}

// ── Execution Strategy Hooks (EPIC-004 / EI-004) ───────────────────────────

export function useExecutionStrategySummary(userId: string) {
  const q = api.executionStrategy.getSummary.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<StrategySummaryDTO>(q.data) };
}

export function useExecutionStrategyList(userId: string) {
  const q = api.executionStrategy.list.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<ExecutionStrategyDTO[]>(q.data) };
}

export function useExecutionStrategySearch(
  userId: string,
  criteria: {
    query?: string;
    priority?: 'critical' | 'high' | 'medium' | 'low' | 'background';
    executionMode?: 'sequential' | 'parallel' | 'hybrid' | 'pipeline';
    capabilities?: CapabilityType[];
    business?: string[];
    minConfidence?: number;
  } = {},
) {
  const q = api.executionStrategy.search.useQuery(
    { userId, ...criteria },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<{ items: ExecutionStrategyDTO[]; total: number }>(q.data) };
}

export function useExecutionStrategy(userId: string, id: string) {
  const q = api.executionStrategy.getStrategy.useQuery(
    { userId, id },
    { enabled: Boolean(userId) && Boolean(id) },
  );
  return { ...q, data: unwrap<ExecutionStrategyDTO>(q.data) };
}

export function useExecutionStrategyExplain(userId: string, id: string) {
  const q = api.executionStrategy.explain.useQuery(
    { userId, id },
    { enabled: Boolean(userId) && Boolean(id) },
  );
  return { ...q, data: unwrap<StrategyExplanationDTO>(q.data) };
}

export function useExecutionStrategyByPriority(
  userId: string,
  priority: 'critical' | 'high' | 'medium' | 'low' | 'background',
) {
  const q = api.executionStrategy.listByPriority.useQuery(
    { userId, priority },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<ExecutionStrategyDTO[]>(q.data) };
}

export function useExecutionStrategyByMode(
  userId: string,
  mode: 'sequential' | 'parallel' | 'hybrid' | 'pipeline',
) {
  const q = api.executionStrategy.listByExecutionMode.useQuery(
    { userId, mode },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<ExecutionStrategyDTO[]>(q.data) };
}

export function useExecutionStrategyByCapability(userId: string, capability: CapabilityType) {
  const q = api.executionStrategy.listByCapability.useQuery(
    { userId, capability },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<ExecutionStrategyDTO[]>(q.data) };
}

export function useExecutionStrategyByGoal(userId: string, goalId: string) {
  const q = api.executionStrategy.listByGoal.useQuery(
    { userId, goalId },
    { enabled: Boolean(userId) && Boolean(goalId) },
  );
  return { ...q, data: unwrap<ExecutionStrategyDTO[]>(q.data) };
}

export function useCreateExecutionStrategy() {
  const mutation = api.executionStrategy.createStrategy.useMutation();
  return {
    ...mutation,
    data: unwrap<ExecutionStrategyDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useValidateExecutionStrategy() {
  const mutation = api.executionStrategy.validateStrategy.useMutation();
  return {
    ...mutation,
    data: unwrap<ExecutionStrategyDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useDeleteExecutionStrategy() {
  const mutation = api.executionStrategy.deleteStrategy.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useEstimateTokens(
  userId: string,
  goal: string,
  tier: 'premium' | 'standard' | 'economy' | 'free',
  maxTokens?: number,
) {
  const q = api.executionStrategy.estimateTokens.useQuery(
    { userId, goal, tier, maxTokens },
    { enabled: Boolean(userId) && Boolean(goal) },
  );
  return { ...q, data: unwrap<TokenEstimateDTO>(q.data) };
}

export function useEstimateCost(
  userId: string,
  goal: string,
  tier: 'premium' | 'standard' | 'economy' | 'free',
  maxCostUsd?: number,
) {
  const q = api.executionStrategy.estimateCost.useQuery(
    { userId, goal, tier, maxCostUsd },
    { enabled: Boolean(userId) && Boolean(goal) },
  );
  return { ...q, data: unwrap<CostEstimateDTO>(q.data) };
}

export function useEstimateLatency(
  userId: string,
  goal: string,
  tier: 'premium' | 'standard' | 'economy' | 'free',
  maxLatencyMs?: number,
) {
  const q = api.executionStrategy.estimateLatency.useQuery(
    { userId, goal, tier, maxLatencyMs },
    { enabled: Boolean(userId) && Boolean(goal) },
  );
  return { ...q, data: unwrap<LatencyEstimateDTO>(q.data) };
}

// ── Execution Orchestrator Hooks (EPIC-004 / EI-005) ───────────────────────

export function useExecutionOrchestratorSummary(userId: string) {
  const q = api.executionOrchestrator.getSummary.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<OrchestratorSummaryDTO>(q.data) };
}

export function useExecutionOrchestratorWorkers(userId: string) {
  const q = api.executionOrchestrator.listWorkers.useQuery(
    { userId },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<ExecutionWorkerDTO[]>(q.data) };
}

export function useExecutionSessions(userId: string) {
  const q = api.executionOrchestrator.listSessions.useQuery(
    { userId },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<ExecutionSessionDTO[]>(q.data) };
}

export function useExecutionSession(userId: string, sessionId: string) {
  const q = api.executionOrchestrator.getSession.useQuery(
    { userId, sessionId },
    { enabled: Boolean(userId) && Boolean(sessionId) },
  );
  return { ...q, data: unwrap<ExecutionSessionDTO>(q.data) };
}

export function useExecutionGraph(userId: string, graphId: string) {
  const q = api.executionOrchestrator.getGraph.useQuery(
    { userId, graphId },
    { enabled: Boolean(userId) && Boolean(graphId) },
  );
  return { ...q, data: unwrap<ExecutionGraphDTO>(q.data) };
}

export function useExecutionGraphExplain(userId: string, graphId: string) {
  const q = api.executionOrchestrator.explainExecutionGraph.useQuery(
    { userId, graphId },
    { enabled: Boolean(userId) && Boolean(graphId) },
  );
  return { ...q, data: unwrap<ExplainGraphDTO>(q.data) };
}

export function useExecutionMonitorSnapshot(userId: string, sessionId: string) {
  const q = api.executionOrchestrator.getMonitorSnapshot.useQuery(
    { userId, sessionId },
    { enabled: Boolean(userId) && Boolean(sessionId) },
  );
  return { ...q, data: unwrap<ExecutionMonitorSnapshotDTO>(q.data) };
}

export function useExecutionQueue(userId: string, sessionId: string) {
  const q = api.executionOrchestrator.getQueue.useQuery(
    { userId, sessionId },
    { enabled: Boolean(userId) && Boolean(sessionId) },
  );
  return { ...q, data: unwrap<ExecutionQueueEntryDTO[]>(q.data) };
}

export function useExecutionRecoveryPlans(
  userId: string,
  sessionId: string,
  failedNodeId?: string,
) {
  const q = api.executionOrchestrator.planRecovery.useQuery(
    { userId, sessionId, failedNodeId },
    { enabled: Boolean(userId) && Boolean(sessionId) },
  );
  return { ...q, data: unwrap<ExecutionRecoveryPlanDTO[]>(q.data) };
}

export function useBuildExecutionGraph() {
  const mutation = api.executionOrchestrator.buildExecutionGraph.useMutation();
  return {
    ...mutation,
    data: unwrap<ExecutionGraphDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useValidateExecutionGraph() {
  const mutation = api.executionOrchestrator.validateExecutionGraph.useMutation();
  return {
    ...mutation,
    data: unwrap<ExecutionGraphDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useOptimizeExecutionGraph() {
  const mutation = api.executionOrchestrator.optimizeExecutionGraph.useMutation();
  return {
    ...mutation,
    data: unwrap<ScheduleResultDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useCreateExecutionSession() {
  const mutation = api.executionOrchestrator.createExecutionSession.useMutation();
  return {
    ...mutation,
    data: unwrap<ExecutionSessionDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function usePauseExecutionSession() {
  const mutation = api.executionOrchestrator.pauseSession.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useResumeExecutionSession() {
  const mutation = api.executionOrchestrator.resumeSession.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useCancelExecutionSession() {
  const mutation = api.executionOrchestrator.cancelSession.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

// ── Goal & Task Intelligence Hooks (EPIC-004 / EI-006) ─────────────────────

// SPRINT-023 — typed problem understanding (the front door of the
// problem→outcome flow). Deterministic: intent / outcome / constraints /
// missing information / approval requirements / success criteria.
export function useGoalsUnderstandProblem(userId: string, problem: string) {
  const q = api.goals.understandProblem.useQuery(
    { userId, problem },
    { enabled: Boolean(userId) && problem.trim().length >= 5 },
  );
  return { ...q, data: unwrap<ProblemDefinition>(q.data) };
}

export function useGoalsSummary(userId: string) {
  const q = api.goals.getSummary.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<GoalSummaryDTO>(q.data) };
}

export function useGoalsList(userId: string) {
  const q = api.goals.listGoals.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<GoalDTO[]>(q.data) };
}

export function useGoalSearch(userId: string, criteria: Omit<GoalSearchDTO, 'userId'> = {}) {
  const q = api.goals.searchGoals.useQuery({ userId, ...criteria }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<{ items: GoalDTO[]; total: number }>(q.data) };
}

export function useGoal(userId: string, goalId: string) {
  const q = api.goals.getGoal.useQuery(
    { userId, goalId },
    { enabled: Boolean(userId) && Boolean(goalId) },
  );
  return { ...q, data: unwrap<GoalDTO>(q.data) };
}

export function useGoalExplain(userId: string, goalId: string) {
  const q = api.goals.explainGoal.useQuery(
    { userId, goalId },
    { enabled: Boolean(userId) && Boolean(goalId) },
  );
  return { ...q, data: unwrap<GoalExplanationDTO>(q.data) };
}

export function useGoalTaskGraph(userId: string, goalId: string) {
  const q = api.goals.getTaskGraph.useQuery(
    { userId, goalId },
    { enabled: Boolean(userId) && Boolean(goalId) },
  );
  return { ...q, data: unwrap<TaskGraphDTO>(q.data) };
}

export function useGoalTasks(userId: string, goalId: string) {
  const q = api.goals.listTasks.useQuery(
    { userId, goalId },
    { enabled: Boolean(userId) && Boolean(goalId) },
  );
  return { ...q, data: unwrap<TaskDTO[]>(q.data) };
}

export function useGoalStrategyHandoff(userId: string, goalId: string) {
  const q = api.goals.buildStrategyHandoff.useQuery(
    { userId, goalId },
    { enabled: Boolean(userId) && Boolean(goalId) },
  );
  return { ...q, data: unwrap<StrategyHandoffDTO>(q.data) };
}

export function useCreateGoal() {
  const mutation = api.goals.createGoal.useMutation();
  return {
    ...mutation,
    data: unwrap<GoalDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useAnalyzeGoal() {
  const mutation = api.goals.analyzeGoal.useMutation();
  return {
    ...mutation,
    data: unwrap<GoalDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useGenerateGoalTasks() {
  const mutation = api.goals.generateTasks.useMutation();
  return {
    ...mutation,
    data: unwrap<TaskGraphDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useValidateGoal() {
  const mutation = api.goals.validateGoal.useMutation();
  return {
    ...mutation,
    data: unwrap<GoalValidationDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useTransitionGoal() {
  const mutation = api.goals.transitionGoal.useMutation();
  return {
    ...mutation,
    data: unwrap<GoalDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

// ── Enterprise Intelligence Integration Hooks (EPIC-004 / EI-006 / INT-001) ─

export function useIntelligenceDashboard(userId: string) {
  const q = api.intelligence.getDashboard.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<IntelligenceDashboardDTO>(q.data) };
}

export function useIntelligencePipelineList(userId: string) {
  const q = api.intelligence.listPipelines.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<PipelineDTO[]>(q.data) };
}

export function useIntelligencePipeline(userId: string, pipelineId: string) {
  const q = api.intelligence.getPipeline.useQuery(
    { userId, pipelineId },
    { enabled: Boolean(userId) && Boolean(pipelineId) },
  );
  return { ...q, data: unwrap<PipelineDTO>(q.data) };
}

export function useIntelligencePipelineExplain(userId: string, pipelineId: string) {
  const q = api.intelligence.explainPipeline.useQuery(
    { userId, pipelineId },
    { enabled: Boolean(userId) && Boolean(pipelineId) },
  );
  return { ...q, data: unwrap<PipelineExplanationDTO>(q.data) };
}

export function useBuildIntelligencePipeline() {
  const mutation = api.intelligence.buildPipeline.useMutation();
  return {
    ...mutation,
    data: unwrap<PipelineDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

// ── Enterprise Learning Intelligence Hooks (EPIC-004 / EI-007) ──────────────

export function useLearningIntelligenceDashboard(userId: string) {
  const q = api.learningIntelligence.getDashboard.useQuery(
    { userId },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<LearningDashboardDTO>(q.data) };
}

export function useLearningIntelligenceEvents(
  userId: string,
  filters: {
    category?: LearningCategory;
    outcome?: 'success' | 'failure';
    page?: number;
    limit?: number;
  } = {},
) {
  const q = api.learningIntelligence.listEvents.useQuery(
    { userId, ...filters },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<{ items: LearningEventDTO[]; total: number }>(q.data) };
}

export function useLearningIntelligenceTimeline(userId: string, limit = 30) {
  const q = api.learningIntelligence.getTimeline.useQuery(
    { userId, limit },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<LearningEventDTO[]>(q.data) };
}

export function useLearningIntelligenceModels(userId: string, category?: LearningCategory) {
  const q = api.learningIntelligence.getModels.useQuery(
    { userId, category },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<LearningModelDTO[]>(q.data) };
}

export function useLearningIntelligenceInsights(userId: string, category?: LearningCategory) {
  const q = api.learningIntelligence.getInsights.useQuery(
    { userId, category },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<LearningInsightDTO[]>(q.data) };
}

export function useLearningIntelligenceRecommendations(
  userId: string,
  category?: LearningCategory,
) {
  const q = api.learningIntelligence.getRecommendations.useQuery(
    { userId, category },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<LearningRecommendationDTO[]>(q.data) };
}

export function useLearningIntelligenceAnalytics(userId: string, category?: LearningCategory) {
  const q = api.learningIntelligence.getAnalytics.useQuery(
    { userId, category },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<LearningAnalyticsDTO>(q.data) };
}

export function useLearningIntelligenceReports(userId: string, category?: LearningCategory) {
  const q = api.learningIntelligence.getReports.useQuery(
    { userId, category },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<LearningReportDTO[]>(q.data) };
}

export function useRecordLearningEvent() {
  const mutation = api.learningIntelligence.recordEvent.useMutation();
  return {
    ...mutation,
    data: unwrap<LearningEventDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useApproveLearningRecommendation() {
  const mutation = api.learningIntelligence.approveRecommendation.useMutation();
  return {
    ...mutation,
    data: unwrap<LearningDecisionDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useRejectLearningRecommendation() {
  const mutation = api.learningIntelligence.rejectRecommendation.useMutation();
  return {
    ...mutation,
    data: unwrap<LearningDecisionDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useRollbackLearningRecommendation() {
  const mutation = api.learningIntelligence.rollbackRecommendation.useMutation();
  return {
    ...mutation,
    data: unwrap<LearningDecisionDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

// ── Enterprise Brain Hooks (EPIC-004 / EI-008) ─────────────────────────────

export function useEnterpriseBrainDashboard(userId: string) {
  const q = api.enterpriseBrain.getDashboard.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<BrainDashboardDTO>(q.data) };
}

export function useEnterpriseBrainMetrics(userId: string) {
  const q = api.enterpriseBrain.getMetrics.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<BrainDecisionMetricsDTO>(q.data) };
}

export function useEnterpriseBrainDecisions(
  userId: string,
  filters: {
    type?: BrainDecisionType;
    status?: BrainDecisionStatus;
    goalId?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  const q = api.enterpriseBrain.listDecisions.useQuery(
    { userId, ...filters },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<{ items: BrainDecisionDTO[]; total: number }>(q.data) };
}

export function useEnterpriseBrainDecision(userId: string, decisionId: string) {
  const q = api.enterpriseBrain.getDecision.useQuery(
    { userId, decisionId },
    { enabled: Boolean(userId) && Boolean(decisionId) },
  );
  return { ...q, data: unwrap<BrainDecisionDTO>(q.data) };
}

export function useEnterpriseBrainPlans(userId: string, goalId?: string) {
  const q = api.enterpriseBrain.listPlans.useQuery(
    { userId, goalId },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<BrainPlanDTO[]>(q.data) };
}

export function useEnterpriseBrainPlan(userId: string, planId: string) {
  const q = api.enterpriseBrain.getPlan.useQuery(
    { userId, planId },
    { enabled: Boolean(userId) && Boolean(planId) },
  );
  return { ...q, data: unwrap<BrainPlanDTO>(q.data) };
}

export function useEnterpriseBrainTimeline(userId: string, limit = 40) {
  const q = api.enterpriseBrain.getTimeline.useQuery(
    { userId, limit },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<BrainDecisionDTO[]>(q.data) };
}

export function useEnterpriseBrainHistory(userId: string) {
  const q = api.enterpriseBrain.getHistory.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<BrainHistoryDTO[]>(q.data) };
}

export function useDecideEnterpriseBrainGoal() {
  const mutation = api.enterpriseBrain.decideGoal.useMutation();
  return {
    ...mutation,
    data: unwrap<BrainPlanDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useApproveEnterpriseBrainDecision() {
  const mutation = api.enterpriseBrain.approveDecision.useMutation();
  return {
    ...mutation,
    data: unwrap<BrainDecisionDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useRejectEnterpriseBrainDecision() {
  const mutation = api.enterpriseBrain.rejectDecision.useMutation();
  return {
    ...mutation,
    data: unwrap<BrainDecisionDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useApproveEnterpriseBrainPlan() {
  const mutation = api.enterpriseBrain.approvePlan.useMutation();
  return {
    ...mutation,
    data: unwrap<BrainPlanDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useRejectEnterpriseBrainPlan() {
  const mutation = api.enterpriseBrain.rejectPlan.useMutation();
  return {
    ...mutation,
    data: unwrap<BrainPlanDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useHandOffEnterpriseBrainPlan() {
  const mutation = api.enterpriseBrain.handOffPlan.useMutation();
  return {
    ...mutation,
    data: unwrap<BrainPlanDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

// ── Enterprise Knowledge Intelligence Hooks (EPIC-004 / EI-009) ─────────────

export function useKnowledgeDashboard(userId: string) {
  const q = api.knowledge.getDashboard.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<KnowledgeDashboardDTO>(q.data) };
}

export function useKnowledgeItems(
  userId: string,
  filters: {
    category?: KnowledgeCategory;
    sourceType?: KnowledgeSourceType;
    lifecycleStatus?: KnowledgeLifecycleStatus;
    validationStatus?: KnowledgeValidationStatus;
    owner?: string;
    tag?: string;
    minTrust?: number;
    page?: number;
    limit?: number;
  } = {},
) {
  const q = api.knowledge.listItems.useQuery({ userId, ...filters }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<{ items: KnowledgeItemDTO[]; total: number }>(q.data) };
}

export function useKnowledgeItem(userId: string, knowledgeId: string) {
  const q = api.knowledge.getItem.useQuery(
    { userId, knowledgeId },
    { enabled: Boolean(userId) && Boolean(knowledgeId) },
  );
  return { ...q, data: unwrap<KnowledgeItemDTO>(q.data) };
}

export function useKnowledgeSearch(
  userId: string,
  criteria: {
    query?: string;
    category?: KnowledgeCategory;
    sourceType?: KnowledgeSourceType;
    lifecycleStatus?: KnowledgeLifecycleStatus;
    validationStatus?: KnowledgeValidationStatus;
    tags?: string[];
    relationshipType?: KnowledgeRelationshipType;
    relationshipTargetId?: string;
    dependencyTargetId?: string;
    consumerType?: KnowledgeConsumerType;
    minTrust?: number;
    versionNumber?: number;
    limit?: number;
    offset?: number;
  } = {},
) {
  const q = api.knowledge.search.useQuery({ userId, ...criteria }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<KnowledgeSearchResultDTO[]>(q.data) };
}

export function useKnowledgeExplain(userId: string, knowledgeId: string) {
  const q = api.knowledge.explain.useQuery(
    { userId, knowledgeId },
    { enabled: Boolean(userId) && Boolean(knowledgeId) },
  );
  return { ...q, data: unwrap<KnowledgeExplanationDTO>(q.data) };
}

export function useKnowledgeVersions(userId: string, knowledgeId: string) {
  const q = api.knowledge.listVersions.useQuery(
    { userId, knowledgeId },
    { enabled: Boolean(userId) && Boolean(knowledgeId) },
  );
  return { ...q, data: unwrap<KnowledgeVersionDTO[]>(q.data) };
}

export function useKnowledgeVersion(userId: string, knowledgeId: string, versionNumber: number) {
  const q = api.knowledge.getVersion.useQuery(
    { userId, knowledgeId, versionNumber },
    { enabled: Boolean(userId) && Boolean(knowledgeId) && versionNumber > 0 },
  );
  return { ...q, data: unwrap<KnowledgeVersionDTO>(q.data) };
}

export function useKnowledgeDiff(
  userId: string,
  knowledgeId: string,
  fromVersion?: number,
  toVersion?: number,
) {
  const q = api.knowledge.diff.useQuery(
    { userId, knowledgeId, fromVersion, toVersion },
    { enabled: Boolean(userId) && Boolean(knowledgeId) },
  );
  return { ...q, data: unwrap<KnowledgeDiffDTO>(q.data) };
}

export function useKnowledgeRelationships(userId: string, type?: KnowledgeRelationshipType) {
  const q = api.knowledge.listRelationships.useQuery(
    { userId, type },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<KnowledgeRelationshipDTO[]>(q.data) };
}

export function useKnowledgeGraph(userId: string, knowledgeId: string, maxDepth?: number) {
  const q = api.knowledge.graph.useQuery(
    { userId, knowledgeId, maxDepth },
    { enabled: Boolean(userId) && Boolean(knowledgeId) && knowledgeId !== 'none' },
  );
  return { ...q, data: unwrap<KnowledgeGraphTraversalDTO>(q.data) };
}

export function useKnowledgeShortestPath(userId: string, fromId: string, toId: string) {
  const q = api.knowledge.shortestPath.useQuery(
    { userId, fromId, toId },
    {
      enabled:
        Boolean(userId) && Boolean(fromId) && Boolean(toId) && fromId !== 'none' && toId !== 'none',
    },
  );
  return { ...q, data: unwrap<string[]>(q.data) };
}

export function useKnowledgeConsumers(userId: string, knowledgeId: string) {
  const q = api.knowledge.listConsumers.useQuery(
    { userId, knowledgeId },
    { enabled: Boolean(userId) && Boolean(knowledgeId) },
  );
  return { ...q, data: unwrap<KnowledgeItemDTO['consumers']>(q.data) };
}

export function useKnowledgeDependencies(userId: string, knowledgeId: string) {
  const q = api.knowledge.listDependencies.useQuery(
    { userId, knowledgeId },
    { enabled: Boolean(userId) && Boolean(knowledgeId) },
  );
  return { ...q, data: unwrap<KnowledgeItemDTO['dependencies']>(q.data) };
}

export function useKnowledgeAnalytics(userId: string) {
  const q = api.knowledge.getAnalytics.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<KnowledgeAnalyticsDTO>(q.data) };
}

export function useKnowledgeTimeline(userId: string, limit = 40) {
  const q = api.knowledge.getTimeline.useQuery({ userId, limit }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<KnowledgeTimelineEntryDTO[]>(q.data) };
}

export function useCreateKnowledgeItem() {
  const mutation = api.knowledge.create.useMutation();
  return {
    ...mutation,
    data: unwrap<KnowledgeItemDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useUpdateKnowledgeItem() {
  const mutation = api.knowledge.update.useMutation();
  return {
    ...mutation,
    data: unwrap<KnowledgeItemDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useDeleteKnowledgeItem() {
  const mutation = api.knowledge.delete.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useValidateKnowledgeItem() {
  const mutation = api.knowledge.validate.useMutation();
  return {
    ...mutation,
    data: unwrap<KnowledgeValidationReportDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useCreateKnowledgeVersion() {
  const mutation = api.knowledge.createVersion.useMutation();
  return {
    ...mutation,
    data: unwrap<KnowledgeItemDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useRelateKnowledge() {
  const mutation = api.knowledge.relate.useMutation();
  return {
    ...mutation,
    data: unwrap<KnowledgeRelationshipDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useDetectKnowledgeRelationships() {
  const mutation = api.knowledge.detectRelationships.useMutation();
  return {
    ...mutation,
    data: unwrap<KnowledgeRelationshipDTO[]>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useRecordKnowledgeConsumerUsage() {
  const mutation = api.knowledge.recordConsumerUsage.useMutation();
  return {
    ...mutation,
    data: unwrap<KnowledgeItemDTO['consumers']>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useTransitionKnowledgeLifecycle() {
  const mutation = api.knowledge.transitionLifecycle.useMutation();
  return {
    ...mutation,
    data: unwrap<KnowledgeItemDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

// ── Enterprise Operating System Hooks (EPIC-005 / OS-001) ───────────────────
// The OS namespace is platform-wide — every procedure observes the whole
// operating system (the gateway scopes them to the authenticated user).

export function useOSDashboard(userId: string) {
  const q = api.os.dashboard.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<OSDashboardDataDTO>(q.data) };
}

export function useOSSystemHealth(userId: string) {
  const q = api.os.systemHealth.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<OSSystemHealthDTO>(q.data) };
}

export function useOSPipelineHealth(userId: string) {
  const q = api.os.pipelineHealth.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<OSPipelineHealthDTO>(q.data) };
}

export function useOSEngineStatus(userId: string) {
  const q = api.os.engineStatus.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<OSEngineStatusDTO[]>(q.data) };
}

export function useOSDependencyGraph(userId: string) {
  const q = api.os.dependencyGraph.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<OSDependencyGraphDTO>(q.data) };
}

export function useOSDiagnostics(userId: string) {
  const q = api.os.runDiagnostics.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<OSDiagnosticsReportDTO>(q.data) };
}

export function useOSPerformance(userId: string) {
  const q = api.os.performanceMetrics.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<OSPerformanceMetricsDTO>(q.data) };
}

export function useOSSnapshots(userId: string, limit = 12) {
  const q = api.os.snapshots.useQuery({ userId, limit }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<OSHealthSnapshotDTO[]>(q.data) };
}

export function useOSValidate(userId: string) {
  const q = api.os.validatePlatform.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<OSPlatformValidationDTO>(q.data) };
}

// ── Context & Personal Intelligence Fabric Hooks (APP-001) ──────────────────
// Post-V1 application-platform layer: personal + business graphs, hybrid
// search, context packages, explanations, provenance, permissions and health.

export function useContextFabricPersonalGraph(userId: string) {
  const q = api.contextFabric.getPersonalGraph.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<PersonalGraphDTO>(q.data) };
}

export function useContextFabricBusinessGraph(userId: string, organizationId: string) {
  const q = api.contextFabric.getBusinessGraph.useQuery(
    { userId, organizationId },
    { enabled: Boolean(userId) && Boolean(organizationId) },
  );
  return { ...q, data: unwrap<BusinessGraphDTO>(q.data) };
}

export function useContextFabricSearch(
  userId: string,
  query: string,
  filters?: {
    goalId?: string;
    projectId?: string;
    taskId?: string;
    sources?: FabricContextSource[];
    types?: FabricEntityType[];
    limit?: number;
  },
) {
  const q = api.contextFabric.search.useQuery(
    { userId, query, ...(filters ?? {}) },
    { enabled: Boolean(userId) && query.trim().length > 0 },
  );
  return { ...q, data: unwrap<ContextRetrievalResultDTO>(q.data) };
}

export function useContextFabricPackage(userId: string, goalId: string, query: string) {
  const q = api.contextFabric.buildContextPackage.useQuery(
    { userId, goalId, query },
    { enabled: Boolean(userId) && Boolean(query) },
  );
  return { ...q, data: unwrap<ContextFabricPackageDTO>(q.data) };
}

export function useContextFabricExplain(userId: string, entityId: string, query?: string) {
  const q = api.contextFabric.explainContextSelection.useQuery(
    { userId, entityId, query },
    { enabled: Boolean(userId) && Boolean(entityId) },
  );
  return { ...q, data: unwrap<FabricContextExplanationDTO[]>(q.data) };
}

export function useContextFabricHealth(userId: string) {
  const q = api.contextFabric.getHealth.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<FabricHealthDTO>(q.data) };
}

export function useContextFabricPermissions(userId: string, entityId: string) {
  const q = api.contextFabric.getPermissions.useQuery(
    { userId, entityId },
    { enabled: Boolean(userId) && Boolean(entityId) },
  );
  return {
    ...q,
    data: unwrap<{ permission: PermissionEvaluation; label: string }>(q.data),
  };
}

export function useContextFabricProvenance(userId: string, entityId: string) {
  const q = api.contextFabric.getProvenance.useQuery(
    { userId, entityId },
    { enabled: Boolean(userId) && Boolean(entityId) },
  );
  return { ...q, data: unwrap<{ provenance: string; facts: string[] }>(q.data) };
}

export function useContextFabricSources(userId: string) {
  const q = api.contextFabric.getSources.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<Array<{ source: string; entityCount: number }>>(q.data) };
}

// ── Enterprise Memory Intelligence Hooks (EPIC-004 / EI-010) ────────────────

export function useMemoryDashboard(userId: string) {
  const q = api.memoryIntelligence.getDashboard.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<MemoryDashboardDTO>(q.data) };
}

export function useMemoryItems(
  userId: string,
  filters: {
    type?: MemoryType;
    sourceType?: MemorySourceType;
    lifecycleStatus?: MemoryLifecycleStatus;
    compressionState?: MemoryCompressionState;
    retentionPolicy?: MemoryRetentionPolicy;
    owner?: string;
    tag?: string;
    minImportance?: number;
    minConfidence?: number;
    page?: number;
    limit?: number;
  } = {},
) {
  const q = api.memoryIntelligence.listItems.useQuery(
    { userId, ...filters },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<{ items: MemoryItemDTO[]; total: number }>(q.data) };
}

export function useMemoryItem(userId: string, memoryId: string) {
  const q = api.memoryIntelligence.getItem.useQuery(
    { userId, memoryId },
    { enabled: Boolean(userId) && Boolean(memoryId) },
  );
  return { ...q, data: unwrap<MemoryItemDTO>(q.data) };
}

export function useMemoryRetrieve(
  userId: string,
  criteria: {
    query?: string;
    relatedGoal?: string;
    relatedProject?: string;
    relatedUser?: string;
    relatedCapability?: string;
    relatedProvider?: string;
    relatedContext?: string;
    minImportance?: number;
    includeInactive?: boolean;
    limit?: number;
  } = {},
) {
  const q = api.memoryIntelligence.retrieve.useQuery(
    { userId, ...criteria },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<MemorySearchResultDTO[]>(q.data) };
}

export function useMemoryRelationships(userId: string, type?: MemoryRelationshipType) {
  const q = api.memoryIntelligence.listRelationships.useQuery(
    { userId, type },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<MemoryRelationshipDTO[]>(q.data) };
}

export function useMemoryGraph(userId: string, memoryId: string, maxDepth?: number) {
  const q = api.memoryIntelligence.graph.useQuery(
    { userId, memoryId, maxDepth },
    { enabled: Boolean(userId) && Boolean(memoryId) && memoryId !== 'none' },
  );
  return { ...q, data: unwrap<MemoryGraphTraversalDTO>(q.data) };
}

export function useMemoryAnalytics(userId: string) {
  const q = api.memoryIntelligence.getAnalytics.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<MemoryAnalyticsDTO>(q.data) };
}

export function useMemoryTimeline(userId: string, limit = 40) {
  const q = api.memoryIntelligence.getTimeline.useQuery(
    { userId, limit },
    { enabled: Boolean(userId) },
  );
  return { ...q, data: unwrap<MemoryTimelineEntryDTO[]>(q.data) };
}

export function useCaptureMemory() {
  const mutation = api.memoryIntelligence.capture.useMutation();
  return {
    ...mutation,
    data: unwrap<MemoryItemDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useUpdateMemory() {
  const mutation = api.memoryIntelligence.update.useMutation();
  return {
    ...mutation,
    data: unwrap<MemoryItemDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useDeleteMemory() {
  const mutation = api.memoryIntelligence.delete.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useValidateMemory() {
  const mutation = api.memoryIntelligence.validate.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useSummarizeMemory() {
  const mutation = api.memoryIntelligence.summarize.useMutation();
  return {
    ...mutation,
    data: unwrap<MemoryItemDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useConsolidateMemories() {
  const mutation = api.memoryIntelligence.consolidate.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useCompressMemories() {
  const mutation = api.memoryIntelligence.compress.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useExpireMemories() {
  const mutation = api.memoryIntelligence.expire.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useReinforceMemory() {
  const mutation = api.memoryIntelligence.reinforce.useMutation();
  return {
    ...mutation,
    data: unwrap<MemoryItemDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useTransitionMemoryLifecycle() {
  const mutation = api.memoryIntelligence.transitionLifecycle.useMutation();
  return {
    ...mutation,
    data: unwrap<MemoryItemDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useRelateMemories() {
  const mutation = api.memoryIntelligence.relate.useMutation();
  return {
    ...mutation,
    data: unwrap<MemoryRelationshipDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useDetectMemoryRelationships() {
  const mutation = api.memoryIntelligence.detectRelationships.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useRecordMemoryConsumerUsage() {
  const mutation = api.memoryIntelligence.recordConsumerUsage.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

// ── Content Agency Hooks (EPIC-003 / AC-001) ───────────────────────────────

export function useContentAgencyDashboard(userId: string) {
  const query = api.contentAgency.getDashboard.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...query, data: unwrap<ContentAgencyDashboardDTO>(query.data) };
}

export function useContentAgencyAnalytics(userId: string) {
  const query = api.contentAgency.getAnalytics.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...query, data: unwrap<ContentAgencyAnalyticsDTO>(query.data) };
}

export function useContentClients(userId: string) {
  const query = api.contentAgency.listClients.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...query, data: unwrap<ClientDTO[]>(query.data) };
}

export function useContentClient(userId: string, clientId: string) {
  const query = api.contentAgency.getClient.useQuery(
    { userId, clientId },
    { enabled: Boolean(userId) && Boolean(clientId) },
  );
  return { ...query, data: unwrap<ClientDTO>(query.data) };
}

export function useContentBrands(userId: string) {
  const query = api.contentAgency.listBrands.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...query, data: unwrap<BrandDTO[]>(query.data) };
}

export function useContentProjects(userId: string) {
  const query = api.contentAgency.listProjects.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...query, data: unwrap<ProjectDTO[]>(query.data) };
}

export function useContentItems(userId: string) {
  const query = api.contentAgency.listContent.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...query, data: unwrap<ContentItemDTO[]>(query.data) };
}

export function useContentItem(userId: string, contentId: string) {
  const query = api.contentAgency.getContent.useQuery(
    { userId, contentId },
    { enabled: Boolean(userId) && Boolean(contentId) },
  );
  return { ...query, data: unwrap<ContentItemDTO>(query.data) };
}

export function useContentCalendar(
  userId: string,
  range: 'month' | 'week' | 'day',
  anchor?: string,
) {
  const query = api.contentAgency.getCalendar.useQuery(
    { userId, range, anchor },
    { enabled: Boolean(userId) },
  );
  return { ...query, data: unwrap<CalendarEntryDTO[]>(query.data) };
}

export function useContentInvoices(userId: string) {
  const query = api.contentAgency.listInvoices.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...query, data: unwrap<InvoiceDTO[]>(query.data) };
}

// ── Content Agency Mutations (EPIC-003 / AC-001) ───────────────────────────

export function useCreateContentClient() {
  const mutation = api.contentAgency.createClient.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useUpdateContentClient() {
  const mutation = api.contentAgency.updateClient.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useDeleteContentClient() {
  const mutation = api.contentAgency.deleteClient.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useUpsertContentBrand() {
  const mutation = api.contentAgency.upsertBrand.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useDeleteContentBrand() {
  const mutation = api.contentAgency.deleteBrand.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useCreateContentProject() {
  const mutation = api.contentAgency.createProject.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useDeleteContentProject() {
  const mutation = api.contentAgency.deleteProject.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useGenerateContent() {
  const mutation = api.contentAgency.generateContent.useMutation();
  return {
    ...mutation,
    data: unwrap<ContentItemDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useCreateContentDraft() {
  const mutation = api.contentAgency.createDraft.useMutation();
  return {
    ...mutation,
    data: unwrap<ContentItemDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useTransitionContentStatus() {
  const mutation = api.contentAgency.transitionStatus.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useScheduleContent() {
  const mutation = api.contentAgency.scheduleContent.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function usePublishContent() {
  const mutation = api.contentAgency.publishContent.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useAddContentReview() {
  const mutation = api.contentAgency.addReview.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useRegenerateContent() {
  const mutation = api.contentAgency.regenerateContent.useMutation();
  return {
    ...mutation,
    data: unwrap<ContentItemDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useCreateInvoice() {
  const mutation = api.contentAgency.createInvoice.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useUpdateInvoiceStatus() {
  const mutation = api.contentAgency.updateInvoiceStatus.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useDeleteInvoice() {
  const mutation = api.contentAgency.deleteInvoice.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

/**
 * Fetch a content export (Delivery) with a typed payload.
 * Uses the tRPC utils proxy (must be called from a component/hook context).
 */
export function useContentExport() {
  const utils = api.useUtils();
  return async (
    userId: string,
    contentId: string,
    format: 'markdown' | 'html' | 'pdf' | 'docx',
  ): Promise<DeliveryExportDTO | null> => {
    const res = await utils.contentAgency.exportContent.fetch({ userId, contentId, format });
    return res.success ? ((res.data as DeliveryExportDTO | undefined) ?? null) : null;
  };
}

// ── Client Operations (EPIC-003 / AC-002) ───────────────────────────────────

export function useOpsLeads(userId: string, status?: string) {
  const query = api.clientOps.listLeads.useQuery({ userId, status }, { enabled: Boolean(userId) });
  return { ...query, data: unwrap<LeadDTO[]>(query.data) };
}

export function useOpsLead(userId: string, leadId: string) {
  const query = api.clientOps.getLead.useQuery(
    { userId, leadId },
    { enabled: Boolean(userId && leadId) },
  );
  return { ...query, data: unwrap<LeadDetailDTO>(query.data) };
}

export function useOpsProposals(userId: string) {
  const query = api.clientOps.listProposals.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...query, data: unwrap<ProposalDTO[]>(query.data) };
}

export function useOpsProposal(userId: string, proposalId: string) {
  const query = api.clientOps.getProposal.useQuery(
    { userId, proposalId },
    { enabled: Boolean(userId && proposalId) },
  );
  return { ...query, data: unwrap<ProposalDetailDTO>(query.data) };
}

export function useOpsContracts(userId: string) {
  const query = api.clientOps.listContracts.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...query, data: unwrap<ContractDTO[]>(query.data) };
}

export function useOpsContract(userId: string, contractId: string) {
  const query = api.clientOps.getContract.useQuery(
    { userId, contractId },
    { enabled: Boolean(userId && contractId) },
  );
  return { ...query, data: unwrap<ContractDetailDTO>(query.data) };
}

export function useOpsExpiringContracts(userId: string, days = 30) {
  const query = api.clientOps.listExpiringContracts.useQuery(
    { userId, days },
    { enabled: Boolean(userId) },
  );
  return { ...query, data: unwrap<ContractDTO[]>(query.data) };
}

export function useOpsQuotations(userId: string) {
  const query = api.clientOps.listQuotations.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...query, data: unwrap<QuotationDTO[]>(query.data) };
}

export function useOpsQuotation(userId: string, quotationId: string) {
  const query = api.clientOps.getQuotation.useQuery(
    { userId, quotationId },
    { enabled: Boolean(userId && quotationId) },
  );
  return { ...query, data: unwrap<QuotationDTO>(query.data) };
}

export function useOpsPayments(userId: string) {
  const query = api.clientOps.listPayments.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...query, data: unwrap<PaymentDTO[]>(query.data) };
}

export function useRevenueOverview(userId: string) {
  const query = api.clientOps.getRevenueOverview.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...query, data: unwrap<RevenueOverviewDTO>(query.data) };
}

export function useOpsDocuments(userId: string) {
  const query = api.clientOps.listDocuments.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...query, data: unwrap<DocumentDTO[]>(query.data) };
}

export function useOpsDocument(userId: string, documentId: string) {
  const query = api.clientOps.getDocument.useQuery(
    { userId, documentId },
    { enabled: Boolean(userId && documentId) },
  );
  return { ...query, data: unwrap<DocumentDetailDTO>(query.data) };
}

export function useOpsSearchDocuments(userId: string, query: string) {
  const q = api.clientOps.searchDocuments.useQuery(
    { userId, query },
    { enabled: Boolean(userId && query.trim().length >= 2) },
  );
  return { ...q, data: unwrap<DocumentDTO[]>(q.data) };
}

export function usePortalAccessList(userId: string) {
  const query = api.clientOps.listPortalAccess.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...query, data: unwrap<PortalAccessDTO[]>(query.data) };
}

export function useOpsNotifications(userId: string) {
  const query = api.clientOps.listNotifications.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...query, data: unwrap<OpsNotificationDTO[]>(query.data) };
}

export function useBusinessAnalytics(userId: string) {
  const query = api.clientOps.getBusinessAnalytics.useQuery(
    { userId },
    { enabled: Boolean(userId) },
  );
  return { ...query, data: unwrap<BusinessAnalyticsDTO>(query.data) };
}

// ── Client Operations mutations ─────────────────────────────────────────────

export function useCreateLead() {
  const mutation = api.clientOps.createLead.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useUpdateLead() {
  const mutation = api.clientOps.updateLead.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useMoveLead() {
  const mutation = api.clientOps.moveLead.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useArchiveLead() {
  const mutation = api.clientOps.archiveLead.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useAddInteraction() {
  const mutation = api.clientOps.addInteraction.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useAddTask() {
  const mutation = api.clientOps.addTask.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useCompleteTask() {
  const mutation = api.clientOps.completeTask.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useAddContact() {
  const mutation = api.clientOps.addContact.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useDeleteContact() {
  const mutation = api.clientOps.deleteContact.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useCreateProposal() {
  const mutation = api.clientOps.createProposal.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useUpdateProposal() {
  const mutation = api.clientOps.updateProposal.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useGenerateProposal() {
  const mutation = api.clientOps.generateProposal.useMutation();
  return {
    ...mutation,
    data: unwrap<ProposalDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useSendProposal() {
  const mutation = api.clientOps.sendProposal.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useAcceptProposal() {
  const mutation = api.clientOps.acceptProposal.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useRejectProposal() {
  const mutation = api.clientOps.rejectProposal.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useCreateContract() {
  const mutation = api.clientOps.createContract.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useUpdateContract() {
  const mutation = api.clientOps.updateContract.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useApproveContract() {
  const mutation = api.clientOps.approveContract.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useTerminateContract() {
  const mutation = api.clientOps.terminateContract.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useRenewContract() {
  const mutation = api.clientOps.renewContract.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useCreateQuotation() {
  const mutation = api.clientOps.createQuotation.useMutation();
  return {
    ...mutation,
    data: unwrap<QuotationDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useUpdateQuotation() {
  const mutation = api.clientOps.updateQuotation.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useSendQuotation() {
  const mutation = api.clientOps.sendQuotation.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useAcceptQuotation() {
  const mutation = api.clientOps.acceptQuotation.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useRejectQuotation() {
  const mutation = api.clientOps.rejectQuotation.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useAddPayment() {
  const mutation = api.clientOps.addPayment.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useUploadDocument() {
  const mutation = api.clientOps.uploadDocument.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useUpdateDocument() {
  const mutation = api.clientOps.updateDocument.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useDeleteDocument() {
  const mutation = api.clientOps.deleteDocument.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useCreatePortalAccess() {
  const mutation = api.clientOps.createPortalAccess.useMutation();
  return {
    ...mutation,
    data: unwrap<CreatePortalAccessResult>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useRevokePortalAccess() {
  const mutation = api.clientOps.revokePortalAccess.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useMarkNotificationRead() {
  const mutation = api.clientOps.markNotificationRead.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useMarkAllNotificationsRead() {
  const mutation = api.clientOps.markAllNotificationsRead.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

/** Fetch a proposal export with a typed payload (component/hook context only). */
export function useProposalExport() {
  const utils = api.useUtils();
  return async (
    userId: string,
    proposalId: string,
    format: 'markdown' | 'html' | 'pdf' | 'docx',
  ): Promise<ProposalExportDTO | null> => {
    const res = await utils.clientOps.exportProposal.fetch({ userId, proposalId, format });
    return res.success ? ((res.data as ProposalExportDTO | undefined) ?? null) : null;
  };
}

// ── Client Portal hooks (public, token-scoped — EPIC-003 / AC-002) ─────────

export function usePortalLogin() {
  return api.portal.login.useMutation();
}

export function usePortalDashboard(token: string) {
  const query = api.portal.getDashboard.useQuery({ token }, { enabled: Boolean(token) });
  return { ...query, data: unwrap<PortalDashboardDTO>(query.data) };
}

export function usePortalContent(token: string) {
  const query = api.portal.listContent.useQuery({ token }, { enabled: Boolean(token) });
  return { ...query, data: unwrap<ContentItemDTO[]>(query.data) };
}

export function usePortalContentDetail(token: string, contentId: string) {
  const query = api.portal.getContent.useQuery(
    { token, contentId },
    { enabled: Boolean(token && contentId) },
  );
  return { ...query, data: unwrap<PortalContentPayload>(query.data) };
}

export function usePortalApproveContent() {
  return api.portal.approveContent.useMutation();
}

export function usePortalRejectContent() {
  return api.portal.rejectContent.useMutation();
}

export function usePortalCommentContent() {
  return api.portal.commentContent.useMutation();
}

export function usePortalInvoices(token: string) {
  const query = api.portal.listInvoices.useQuery({ token }, { enabled: Boolean(token) });
  return { ...query, data: unwrap<InvoiceDTO[]>(query.data) };
}

export function usePortalInvoice(token: string, invoiceId: string) {
  const query = api.portal.getInvoice.useQuery(
    { token, invoiceId },
    { enabled: Boolean(token && invoiceId) },
  );
  return { ...query, data: unwrap<InvoiceDTO>(query.data) };
}

/** Fetch a portal deliverable export (component/hook context only). */
export function usePortalDeliverable() {
  const utils = api.useUtils();
  return async (
    token: string,
    contentId: string,
    format: 'markdown' | 'html' | 'pdf' | 'docx',
  ): Promise<DeliveryExportDTO | null> => {
    const res = await utils.portal.downloadDeliverable.fetch({ token, contentId, format });
    return res.success ? ((res.data as DeliveryExportDTO | undefined) ?? null) : null;
  };
}

// ── Platform Health ─────────────────────────────────────────────────────────

export function usePlatformHealth() {
  return api.health.check.useQuery();
}

export function usePlatformVersion() {
  return api.health.version.useQuery();
}

// ── Search Hooks ────────────────────────────────────────────────────────────

export function useRecentSearches(userId: string) {
  return api.search.recent.useQuery({ userId }, { enabled: Boolean(userId) });
}

// ── Notification Hooks ──────────────────────────────────────────────────────

export function useNotifications(userId: string) {
  return api.notifications.list.useQuery({ userId }, { enabled: Boolean(userId) });
}

// ── AI Runtime Hooks (ARC-005 / AI-RUNTIME-001) ─────────────────────────────
// The canonical AI execution contract: submit a task and let the platform
// select capability → provider → model with retry/fallback + metrics.

export function useAIOrchestrate() {
  return api.ai.orchestrate.useMutation();
}

export function useAIListProviders(userId: string) {
  const q = api.ai.listProviders.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<ProviderListDTO>(q.data) };
}

export function useAICapabilities(userId: string) {
  const q = api.ai.listCapabilities.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<CapabilityListDTO>(q.data) };
}

export function useAIAllProviderHealth(userId: string) {
  const q = api.ai.getAllProviderHealth.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<ProviderHealthDTO[]>(q.data) };
}

export function useAIOrchestrateTyped() {
  const mutation = api.ai.orchestrate.useMutation();
  return {
    ...mutation,
    /** Invoke with typed input; throws when the gateway returns success:false. */
    execute: guardMutation(mutation.mutateAsync),
  };
}

export type AIOrchestrateResponse = OrchestrateResponseDTO;

// ── AI Runtime Hooks (AI-RUNTIME-002: streaming + selection explanation) ───

export function useAIStream() {
  const mutation = api.ai.stream.useMutation();
  return {
    ...mutation,
    /** Invoke a streamed run; throws when the gateway returns success:false. */
    execute: guardMutation(mutation.mutateAsync),
  };
}

export function useAIExplainSelection(userId: string, capability: CapabilityType) {
  const q = api.ai.explainSelection.useQuery(
    { userId, capability },
    { enabled: Boolean(userId) && Boolean(capability) },
  );
  return { ...q, data: unwrap<ProviderSelectionDTO>(q.data) };
}

// ── Enterprise RAG Hooks (EPIC-005 / AI-RUNTIME-002) ───────────────────────

export function useRagSearch(userId: string, collection: string, query: string, topK = 5) {
  const q = api.rag.search.useQuery(
    { userId, collection, query, topK },
    { enabled: Boolean(userId) && Boolean(collection) && query.trim().length > 0 },
  );
  return { ...q, data: unwrap<RagSearchResultDTO>(q.data) };
}

export function useRagIngest() {
  const mutation = api.rag.ingest.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useRagDeleteSource() {
  const mutation = api.rag.deleteSource.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

export function useRagStats(userId: string, collection?: string) {
  const q = api.rag.getStats.useQuery({ userId, collection }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<RagStatsDTO>(q.data) };
}

export type AIStreamRun = StreamRunDTO;

// ── Orchestrated AI Loop Engine Hooks (EPIC-006) ─────────────────────────────
// The loop.* contract: start a bounded orchestrated goal run (understand →
// decompose → specialists → critic → refine), then poll status/getTrace.

/** Start a bounded loop run for a goal (returns the plan immediately). */
export function useLoopStart() {
  const mutation = api.loop.start.useMutation();
  return {
    ...mutation,
    data: unwrap<import('@vedmoulya/loop-engine').LoopStartResultDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

/** Status + budget snapshot for a run (poll this while it executes). */
export function useLoopStatus(userId: string, runId: string, refetchInterval = 0) {
  const q = api.loop.status.useQuery(
    { userId, runId },
    {
      enabled: Boolean(userId) && Boolean(runId),
      refetchInterval: refetchInterval > 0 ? refetchInterval : undefined,
    },
  );
  return { ...q, data: unwrap<import('@vedmoulya/loop-engine').LoopStatusDTO>(q.data) };
}

/** Full explainable execution trace for a run. */
export function useLoopTrace(userId: string, runId: string, refetchInterval = 0) {
  const q = api.loop.getTrace.useQuery(
    { userId, runId },
    {
      enabled: Boolean(userId) && Boolean(runId) && runId !== 'none',
      refetchInterval: refetchInterval > 0 ? refetchInterval : undefined,
    },
  );
  return { ...q, data: unwrap<import('@vedmoulya/loop-engine').LoopRunDTO>(q.data) };
}

/** Cancel a pending/running loop run. */
export function useLoopCancel() {
  const mutation = api.loop.cancel.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

/** Resume a suspended run with the user's clarification (bounded). */
export function useLoopResume() {
  const mutation = api.loop.resume.useMutation();
  return {
    ...mutation,
    data: unwrap<import('@vedmoulya/loop-engine').LoopRunDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

/** Recent loop runs for the session user. */
export function useLoopRuns(userId: string) {
  const q = api.loop.listRuns.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<import('@vedmoulya/loop-engine').LoopRunSummaryDTO[]>(q.data) };
}

/** Available controlled use-case templates. */
export function useLoopPatterns(userId: string) {
  const q = api.loop.listPatterns.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<import('@vedmoulya/loop-engine').LoopPatternDTO[]>(q.data) };
}

// ── AI Application Factory Hooks (EPIC-007) ─────────────────────────────────
// The factory.* contract: create (understand→specify→architect→plan),
// approve (Phase 8 plan approval), build (generate→validate→critique→
// refine, bounded), status, getDetail, deploy (explicit authorization),
// list, and version-control ops (never auto-pushed).

/** Create an application project: understand → specify → architect → plan. */
export function useFactoryCreate() {
  const mutation = api.factory.create.useMutation();
  return {
    ...mutation,
    data: unwrap<import('@vedmoulya/app-factory').FactoryCreateResultDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

/** User approves (or modifies) the plan → PLANNED (Phase 8 gate). */
export function useFactoryApprove() {
  const mutation = api.factory.approve.useMutation();
  return {
    ...mutation,
    data: unwrap<import('@vedmoulya/app-factory').FactoryApproveResultDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

/** Build: generate → validate → critique → refine (bounded, requires approval). */
export function useFactoryBuild() {
  const mutation = api.factory.build.useMutation();
  return {
    ...mutation,
    data: unwrap<import('@vedmoulya/app-factory').FactoryBuildResultDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

/** Status + validation + economics snapshot (poll while building). */
export function useFactoryStatus(userId: string, applicationId: string, refetchInterval = 0) {
  const q = api.factory.status.useQuery(
    { userId, applicationId },
    {
      enabled: Boolean(userId) && Boolean(applicationId) && applicationId !== 'none',
      refetchInterval: refetchInterval > 0 ? refetchInterval : undefined,
    },
  );
  return { ...q, data: unwrap<import('@vedmoulya/app-factory').FactoryApplicationDTO>(q.data) };
}

/** Full project detail (spec, files, operations, VCS history). */
export function useFactoryDetail(userId: string, applicationId: string) {
  const q = api.factory.getDetail.useQuery(
    { userId, applicationId },
    { enabled: Boolean(userId) && Boolean(applicationId) && applicationId !== 'none' },
  );
  return { ...q, data: unwrap<import('@vedmoulya/app-factory').FactoryDetailDTO>(q.data) };
}

/** EPIC-008 Phase 13 — sandboxed UI preview for a generated application.
 *  Pure derivation from the persisted project files; rendered in an iframe
 *  with sandbox="allow-scripts" (no parent access, no network). */
export function useFactoryPreview(userId: string, applicationId: string) {
  const q = api.factory.preview.useQuery(
    { userId, applicationId },
    { enabled: Boolean(userId) && Boolean(applicationId) && applicationId !== 'none' },
  );
  return {
    ...q,
    data: unwrap<{ hasUi: boolean; reason?: string; html?: string }>(q.data),
  };
}

/** Deploy with EXPLICIT authorization (Phase 16 — never silent). */
export function useFactoryDeploy() {
  const mutation = api.factory.deploy.useMutation();
  return {
    ...mutation,
    data: unwrap<import('@vedmoulya/app-factory').FactoryDeployResultDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

/** Registered applications for the session user (Phase 13). */
export function useFactoryList(userId: string) {
  const q = api.factory.list.useQuery({ userId }, { enabled: Boolean(userId) });
  return { ...q, data: unwrap<import('@vedmoulya/app-factory').FactoryApplicationDTO[]>(q.data) };
}

// ── Application lifecycle hooks (EPIC-008 — Phase 1/14) ─────────────────────

/** Rename the application (recorded in the version history). */
export function useFactoryRename() {
  const mutation = api.factory.rename.useMutation();
  return {
    ...mutation,
    data: unwrap<import('@vedmoulya/app-factory').FactoryLifecycleResultDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

/** Archive the application (removed from the active list, not deleted). */
export function useFactoryArchive() {
  const mutation = api.factory.archive.useMutation();
  return {
    ...mutation,
    data: unwrap<import('@vedmoulya/app-factory').FactoryLifecycleResultDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

/** Delete the application per policy (explicit confirmation required). */
export function useFactoryDelete() {
  const mutation = api.factory.delete.useMutation();
  return {
    ...mutation,
    data: unwrap<import('@vedmoulya/app-factory').FactoryLifecycleResultDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

/** Resume an archived (→ DRAFT) or failed (→ PLANNED) application. */
export function useFactoryResume() {
  const mutation = api.factory.resume.useMutation();
  return {
    ...mutation,
    data: unwrap<import('@vedmoulya/app-factory').FactoryLifecycleResultDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

/** Recorded application version history (Phase 14). */
export function useFactoryHistory(userId: string, applicationId: string) {
  const q = api.factory.history.useQuery(
    { userId, applicationId },
    { enabled: Boolean(userId) && Boolean(applicationId) && applicationId !== 'none' },
  );
  return {
    ...q,
    data: unwrap<import('@vedmoulya/app-factory').ApplicationVersion[]>(q.data),
  };
}

/** Version control — initialize the application repository (never pushes). */
export function useFactoryVcInit() {
  const mutation = api.factory.vcInit.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

/** Version control — create + checkout a branch. */
export function useFactoryVcBranch() {
  const mutation = api.factory.vcBranch.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

/** Version control — commit files (validation happens before commit). */
export function useFactoryVcCommit() {
  const mutation = api.factory.vcCommit.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

/** Version control — diff / change summary. */
export function useFactoryVcDiff(userId: string, applicationId: string) {
  const q = api.factory.vcDiff.useQuery(
    { userId, applicationId },
    { enabled: Boolean(userId) && Boolean(applicationId) && applicationId !== 'none' },
  );
  return { ...q, data: unwrap<{ ok: boolean; message: string; hunks: string[] }>(q.data) };
}

/** Version control — prepare a pull-request draft (NEVER pushed). */
export function useFactoryVcPreparePullRequest() {
  const mutation = api.factory.vcPreparePullRequest.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

/** Version control — operation history for one application. */
export function useFactoryVcHistory(userId: string, applicationId: string) {
  const q = api.factory.vcHistory.useQuery(
    { userId, applicationId },
    { enabled: Boolean(userId) && Boolean(applicationId) && applicationId !== 'none' },
  );
  return {
    ...q,
    data: unwrap<
      Array<{ opId: string; type: string; detail: string; timestamp: string; pushed: boolean }>
    >(q.data),
  };
}

// ── Product Intelligence & Requirements Hooks (EPIC-009) ────────────────────
// The requirements.* contract: start (understand → extract → analyze →
// questions + defaults), answer (bundled), acceptAllDefaults / decideDefault,
// resolveConflict, plan (full product plan), approve (Phase 23 gate), reject,
// handoffGoal / handoffToFactory (APPROVED session → factory.create),
// changeImpact (Phase 24), and owner-scoped session management.

type RequirementsSessionDTO = import('@vedmoulya/requirements').RequirementsSessionDTO;

export function useRequirementsStart() {
  const mutation = api.requirements.start.useMutation();
  return {
    ...mutation,
    data: unwrap<import('@vedmoulya/requirements').RequirementsStartDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useRequirementsSession(userId: string, sessionId: string) {
  const q = api.requirements.get.useQuery(
    { userId, sessionId },
    { enabled: Boolean(userId) && Boolean(sessionId) && sessionId !== 'none' },
  );
  return { ...q, data: unwrap<RequirementsSessionDTO>(q.data) };
}

export function useRequirementsList(userId: string) {
  const q = api.requirements.list.useQuery({ userId }, { enabled: Boolean(userId) });
  return {
    ...q,
    data: unwrap<import('@vedmoulya/requirements').RequirementsSessionSummaryDTO[]>(q.data),
  };
}

export function useRequirementsAnswer() {
  const mutation = api.requirements.answer.useMutation();
  return {
    ...mutation,
    data: unwrap<RequirementsSessionDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useRequirementsAcceptAllDefaults() {
  const mutation = api.requirements.acceptAllDefaults.useMutation();
  return {
    ...mutation,
    data: unwrap<RequirementsSessionDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useRequirementsDecideDefault() {
  const mutation = api.requirements.decideDefault.useMutation();
  return {
    ...mutation,
    data: unwrap<RequirementsSessionDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useRequirementsResolveConflict() {
  const mutation = api.requirements.resolveConflict.useMutation();
  return {
    ...mutation,
    data: unwrap<RequirementsSessionDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useRequirementsPlan() {
  const mutation = api.requirements.plan.useMutation();
  return {
    ...mutation,
    data: unwrap<RequirementsSessionDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useRequirementsApprove() {
  const mutation = api.requirements.approve.useMutation();
  return {
    ...mutation,
    data: unwrap<import('@vedmoulya/requirements').RequirementsApproveDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useRequirementsReject() {
  const mutation = api.requirements.reject.useMutation();
  return {
    ...mutation,
    data: unwrap<RequirementsSessionDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useRequirementsHandoffGoal(userId: string, sessionId: string) {
  const q = api.requirements.handoffGoal.useQuery(
    { userId, sessionId },
    { enabled: Boolean(userId) && Boolean(sessionId) && sessionId !== 'none' },
  );
  return {
    ...q,
    data: unwrap<{ goal: string }>(q.data),
  };
}

export function useRequirementsHandoffToFactory() {
  const mutation = api.requirements.handoffToFactory.useMutation();
  return {
    ...mutation,
    data: unwrap<import('@vedmoulya/app-factory').FactoryCreateResultDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useRequirementsChangeImpact() {
  const mutation = api.requirements.changeImpact.useMutation();
  return {
    ...mutation,
    data: unwrap<import('@vedmoulya/requirements').ChangeImpact>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}

export function useRequirementsDelete() {
  const mutation = api.requirements.delete.useMutation();
  return { ...mutation, mutateAsync: guardMutation(mutation.mutateAsync) };
}

// ── Adaptive Application Experience Hooks (EPIC-010) ────────────────────────
// The experience.* contract: evaluate (design system + UI blueprint + design
// decisions + visual critic + multi-dimensional quality + traceability),
// findings (Phase 10 evidence-classified critic findings), refine (Phase
// 12/13 targeted refinement with change impact — never regenerate-all).
// Owner isolation is enforced at the factory engine (IDOR refused there).

export function useExperienceEvaluate(userId: string, applicationId: string) {
  const q = api.experience.evaluate.useQuery(
    { userId, applicationId },
    { enabled: Boolean(userId) && Boolean(applicationId) && applicationId !== 'none' },
  );
  return {
    ...q,
    data: unwrap<import('@vedmoulya/experience').ExperienceEvaluateDTO>(q.data),
  };
}

export function useExperienceFindings(userId: string, applicationId: string) {
  const q = api.experience.findings.useQuery(
    { userId, applicationId },
    { enabled: Boolean(userId) && Boolean(applicationId) && applicationId !== 'none' },
  );
  return {
    ...q,
    data: unwrap<import('@vedmoulya/experience').ExperienceFindingsDTO>(q.data),
  };
}

/** EPIC-010 Phase 8/11 optional seam: evaluate WITH a live AI critique.
 *  Without a configured provider this equals `evaluate` (deterministic). */ export function useExperienceEvaluateWithAI(
  userId: string,
  applicationId: string,
  enabled = false,
) {
  const q = api.experience.evaluateWithAI.useQuery(
    { userId, applicationId },
    {
      enabled: Boolean(userId) && Boolean(applicationId) && applicationId !== 'none' && enabled,
      // A paid AI call must run ONLY on the explicit toggle — never silently
      // re-fetched on window focus or retried on failure.
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: false,
      staleTime: 60_000,
    },
  );
  return {
    ...q,
    data: unwrap<import('@vedmoulya/experience').ExperienceEvaluateDTO>(q.data),
  };
}

export function useExperienceRefine() {
  const mutation = api.experience.refine.useMutation();
  return {
    ...mutation,
    data: unwrap<import('@vedmoulya/experience').ExperienceRefineDTO>(mutation.data),
    mutateAsync: guardMutation(mutation.mutateAsync),
  };
}
