// ──────────────────────────────────────────────────────────────────
// VedMoulya — Life OS Integration DTOs
// Unified Data Transfer Objects for the Life OS Integration Layer
// BLD-015 — Life OS Integration & Unified Experience
// ──────────────────────────────────────────────────────────────────

import type { QuickActionDTO } from '@vedmoulya/shared';

// ── Unified Snapshot DTO ───────────────────────────────────────────────────

export interface LifeOSSnapshotDTO {
  id: string;
  userId: string;
  generatedAt: string;
  ttl: number;
  identity: LifeOSIdentitySummaryDTO;
  dashboard: LifeOSModuleSummaryDTO;
  career: LifeOSModuleSummaryDTO;
  learning: LifeOSModuleSummaryDTO;
  business: LifeOSModuleSummaryDTO;
  marketplace: LifeOSModuleSummaryDTO;
  memory: LifeOSMemorySummaryDTO;
  decisions: LifeOSDecisionSummaryDTO;
  execution: LifeOSExecutionSummaryDTO;
  knowledge: LifeOSKnowledgeSummaryDTO;
  priorities: LifeOSPriorityDTO[];
  unifiedTimeline: LifeOSUnifiedTimelineDTO;
  crossDomainRecommendations: LifeOSRecommendationDTO[];
  globalNotifications: LifeOSNotificationDTO[];
  quickActions: QuickActionDTO[];
  searchResults: LifeOSSearchResultDTO[];
  platformHealth: LifeOSPlatformHealthDTO;
  metrics: LifeOSMetricsDTO;
  aiContext: LifeOSAIContextDTO;
}

// ── Identity Summary ───────────────────────────────────────────────────────

export interface LifeOSIdentitySummaryDTO {
  displayName: string;
  email: string;
  role: string;
  purpose: string;
  primaryGoal: string;
  currentJourney: string;
  greeting: string;
  avatarUrl?: string;
}

// ── Module Summary ─────────────────────────────────────────────────────────

export interface LifeOSModuleSummaryDTO {
  module: LifeOSModule;
  status: 'available' | 'degraded' | 'unavailable';
  summary: string;
  metrics: Record<string, number>;
  lastUpdated: string;
  hasNotifications: boolean;
  notificationCount: number;
}

export type LifeOSModule = 'dashboard' | 'career' | 'learning' | 'business' | 'marketplace';

// ── Memory Summary ─────────────────────────────────────────────────────────

export interface LifeOSMemorySummaryDTO {
  totalMemories: number;
  recentCount: number;
  importantEvents: number;
  lastMemoryDate?: string;
  aiObservations: string[];
  reflectionPrompts: string[];
}

// ── Decision Summary ───────────────────────────────────────────────────────

export interface LifeOSDecisionSummaryDTO {
  pendingDecisions: number;
  decisionsToday: number;
  averageConfidence: number;
  highRiskCount: number;
  topPending: string[];
}

// ── Execution Summary ──────────────────────────────────────────────────────

export interface LifeOSExecutionSummaryDTO {
  activePlans: number;
  blockedPlans: number;
  completedToday: number;
  totalEstimatedMinutes: number;
  recoverySuggestions: string[];
}

// ── Knowledge Summary ──────────────────────────────────────────────────────

export interface LifeOSKnowledgeSummaryDTO {
  totalNodes: number;
  recentNodes: number;
  topCategories: string[];
  lastUpdated?: string;
}

// ── Priorities ─────────────────────────────────────────────────────────────

export interface LifeOSPriorityDTO {
  id: string;
  title: string;
  description: string;
  source: LifeOSModule;
  priority: number;
  isBlocked: boolean;
  deadline?: string;
  category: string;
}

// ── Unified Timeline ───────────────────────────────────────────────────────

export interface LifeOSUnifiedTimelineDTO {
  entries: LifeOSTimelineEntryDTO[];
  totalEntries: number;
  hasMore: boolean;
  filter: 'today' | 'week' | 'month' | 'all';
}

export interface LifeOSTimelineEntryDTO {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  importance: number;
  icon: string;
  source: LifeOSModule;
  sourceRoute?: string;
  metadata?: Record<string, unknown>;
}

// ── Global Search ──────────────────────────────────────────────────────────

export interface LifeOSSearchResultDTO {
  id: string;
  category: LifeOSSearchCategory;
  title: string;
  description: string;
  confidence: number;
  source: LifeOSModule;
  deepLink: string;
  timestamp: string;
  tags: string[];
}

export type LifeOSSearchCategory =
  | 'profile'
  | 'skill'
  | 'goal'
  | 'project'
  | 'kpi'
  | 'learning_path'
  | 'assessment'
  | 'certification'
  | 'job'
  | 'marketplace_asset'
  | 'provider'
  | 'template'
  | 'memory'
  | 'decision'
  | 'knowledge'
  | 'insight'
  | 'recommendation';

// ── Cross-Domain Recommendations ───────────────────────────────────────────

export interface LifeOSRecommendationDTO {
  id: string;
  title: string;
  description: string;
  priority: number;
  confidence: number;
  sources: LifeOSModule[];
  reason: string;
  actionLabel: string;
  actionRoute: string;
  isDismissed: boolean;
  category: string;
  createdAt: string;
}

// ── Global Notifications ───────────────────────────────────────────────────

export interface LifeOSNotificationDTO {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'reminder';
  title: string;
  message: string;
  source: LifeOSModule;
  isRead: boolean;
  isActionable: boolean;
  actionLabel?: string;
  actionRoute?: string;
  priority: number;
  createdAt: string;
  expiresAt?: string;
}

// ── Platform Health ────────────────────────────────────────────────────────

export interface LifeOSPlatformHealthDTO {
  overall: 'healthy' | 'degraded' | 'critical';
  modules: LifeOSModuleHealthDTO[];
  cacheStatus: LifeOSCacheStatusDTO;
  performance: LifeOSPerformanceSummaryDTO;
  integrationStatus: LifeOSIntegrationStatusDTO;
  providerStatus: LifeOSProviderStatusDTO;
}

export interface LifeOSModuleHealthDTO {
  name: LifeOSModule;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  lastChecked: string;
}

export interface LifeOSCacheStatusDTO {
  totalEntries: number;
  hitRate: number;
  memoryUsage: number;
}

export interface LifeOSPerformanceSummaryDTO {
  snapshotGeneration: number;
  searchLatency: number;
  timelineMerge: number;
  recommendationLatency: number;
}

export interface LifeOSIntegrationStatusDTO {
  totalModules: number;
  connectedModules: number;
  failedModules: number;
}

export interface LifeOSProviderStatusDTO {
  total: number;
  active: number;
  errorRate: number;
}

// ── Metrics ────────────────────────────────────────────────────────────────

export interface LifeOSMetricsDTO {
  lifeScore: number;
  moduleEngagement: Record<string, number>;
  totalNotifications: number;
  unreadNotifications: number;
  totalRecommendations: number;
  activeRecommendations: number;
  searchPerformed: number;
  timelineEntries: number;
  quickActionsUsed: number;
}

// ── AI Context ─────────────────────────────────────────────────────────────

export interface LifeOSAIContextDTO {
  currentFocus: string;
  recentActivity: string[];
  suggestedQuestions: string[];
  contextSummary: string;
  topPriorities: string[];
  crossDomainInsights: string[];
}

// ── Configuration ──────────────────────────────────────────────────────────

export interface LifeOSConfigDTO {
  userId: string;
  enabledModules: LifeOSModule[];
  timelineDefaultFilter: LifeOSUnifiedTimelineDTO['filter'];
  notificationPriorityThreshold: number;
  maxRecommendations: number;
  enableCrossDomainInsights: boolean;
  enableGlobalSearch: boolean;
  cacheTTL: number;
  refreshInterval: number;
}

// ── Cache Metrics ──────────────────────────────────────────────────────────

export interface LifeOSCacheMetricsDTO {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  averageLatency: number;
  memoryUsage: number;
}
