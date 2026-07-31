// ──────────────────────────────────────────────────────────────────
// VedMoulya — Life OS Integration & Unified Experience
// BLD-015 — Life OS Integration & Unified Experience
// ──────────────────────────────────────────────────────────────────

export { LifeOSApplicationService } from './LifeOSApplicationService.js';
export { LifeOSAssembler } from './LifeOSAssembler.js';
export { LifeOSSnapshotService } from './LifeOSSnapshotService.js';
export { LifeOSNavigationService } from './LifeOSNavigationService.js';
export { LifeOSSearchService } from './LifeOSSearchService.js';
export { LifeOSRecommendationService } from './LifeOSRecommendationService.js';
export { LifeOSNotificationService } from './LifeOSNotificationService.js';
export { LifeOSTimelineService } from './LifeOSTimelineService.js';
export { LifeOSQuickActionService } from './LifeOSQuickActionService.js';
export { LifeOSInsightService } from './LifeOSInsightService.js';
export { LifeOSMetricsService } from './LifeOSMetricsService.js';
export { LifeOSHealthService } from './LifeOSHealthService.js';
export { LifeOSCacheService } from './LifeOSCacheService.js';
export { LifeOSConfigurationService } from './LifeOSConfigurationService.js';
export { LifeOSAnalyticsService } from './LifeOSAnalyticsService.js';
export { LifeOSViewModelFactory } from './LifeOSViewModelFactory.js';
export { LifeOSDTOMapper } from './LifeOSDTOMapper.js';

export type {
  LifeOSSnapshotDTO,
  LifeOSIdentitySummaryDTO,
  LifeOSModuleSummaryDTO,
  LifeOSMemorySummaryDTO,
  LifeOSDecisionSummaryDTO,
  LifeOSExecutionSummaryDTO,
  LifeOSKnowledgeSummaryDTO,
  LifeOSPriorityDTO,
  LifeOSUnifiedTimelineDTO,
  LifeOSTimelineEntryDTO,
  LifeOSSearchResultDTO,
  LifeOSRecommendationDTO,
  LifeOSNotificationDTO,
  LifeOSPlatformHealthDTO,
  LifeOSModuleHealthDTO,
  LifeOSCacheStatusDTO,
  LifeOSPerformanceSummaryDTO,
  LifeOSIntegrationStatusDTO,
  LifeOSProviderStatusDTO,
  LifeOSMetricsDTO,
  LifeOSAIContextDTO,
  LifeOSConfigDTO,
  LifeOSCacheMetricsDTO,
  LifeOSModule,
  LifeOSSearchCategory,
} from './LifeOSDTO.js';

export type {
  ModuleCardViewModel,
  PriorityListViewModel,
  SearchSummaryViewModel,
  LifeOSDashboardViewModel,
} from './LifeOSViewModelFactory.js';

export type { LifeOSResult } from './LifeOSApplicationService.js';
export type { SafeCallResult } from './LifeOSAssembler.js';
export type { NavigationItem } from './LifeOSNavigationService.js';
