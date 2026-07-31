// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Platform DTOs
// Data Transfer Objects for the Marketplace Platform
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import type { QuickActionDTO } from '@vedmoulya/shared';

// ── Snapshot DTO ───────────────────────────────────────────────────────────

export interface MarketplaceSnapshotDTO {
  id: string;
  userId: string;
  generatedAt: string;
  ttl: number;
  catalog: MarketplaceCatalogDTO;
  installedAssets: MarketplaceAssetDTO[];
  availableUpdates: MarketplaceVersionDTO[];
  providers: MarketplaceProviderDTO[];
  installedTemplates: MarketplaceAssetDTO[];
  knowledgePacks: MarketplaceAssetDTO[];
  workflowPacks: MarketplaceAssetDTO[];
  compatibility: MarketplaceCompatibilityDTO;
  recommendations: MarketplaceRecommendationDTO[];
  insights: MarketplaceInsightDTO[];
  versionHistory: MarketplaceVersionDTO[];
  installationHistory: MarketplaceInstallationDTO[];
  notifications: MarketplaceNotificationDTO[];
  metrics: MarketplaceMetricsDTO;
  health: MarketplaceHealthIndicatorDTO;
  timeline: MarketplaceTimelineDTO;
  quickActions: QuickActionDTO[];
  aiContext: MarketplaceAIContextDTO;
}

// ── Catalog DTOs ───────────────────────────────────────────────────────────

export interface MarketplaceCatalogDTO {
  totalAssets: number;
  categories: MarketplaceCategoryDTO[];
  featured: MarketplaceAssetDTO[];
  popular: MarketplaceAssetDTO[];
  recent: MarketplaceAssetDTO[];
}

export interface MarketplaceCategoryDTO {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  assetCount: number;
}

// ── Asset DTOs ─────────────────────────────────────────────────────────────

export interface MarketplaceAssetDTO {
  id: string;
  name: string;
  description: string;
  type: AssetType;
  category: string;
  version: string;
  author: string;
  publisher: string;
  tags: string[];
  rating: number;
  downloadCount: number;
  isInstalled: boolean;
  isActive: boolean;
  isBuiltIn: boolean;
  size: number;
  requirements: AssetRequirementDTO[];
  screenshots: string[];
  changelog: ChangelogEntryDTO[];
  createdAt: string;
  updatedAt: string;
}

export type AssetType =
  | 'ai_provider'
  | 'prompt_pack'
  | 'workflow_template'
  | 'career_template'
  | 'learning_template'
  | 'business_template'
  | 'knowledge_pack'
  | 'assessment_pack'
  | 'automation_pack'
  | 'plugin'
  | 'integration'
  | 'theme'
  | 'extension';

export interface AssetRequirementDTO {
  name: string;
  version: string;
  optional: boolean;
}

export interface ChangelogEntryDTO {
  version: string;
  date: string;
  changes: string[];
}

// ── Provider DTOs ──────────────────────────────────────────────────────────

export interface MarketplaceProviderDTO {
  id: string;
  name: string;
  type: 'ai' | 'storage' | 'analytics' | 'communication' | 'other';
  provider: string;
  version: string;
  status: ProviderStatus;
  config: Record<string, string>;
  capabilities: string[];
  isDefault: boolean;
  apiEndpoint?: string;
  apiKeyConfigured: boolean;
  latency: number;
  errorRate: number;
  lastChecked: string;
  installedAt: string;
}

export type ProviderStatus = 'active' | 'inactive' | 'error' | 'configuring';

// ── Installation DTOs ──────────────────────────────────────────────────────

export interface MarketplaceInstallationDTO {
  id: string;
  assetId: string;
  assetName: string;
  assetType: AssetType;
  version: string;
  status: InstallationStatus;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  steps: InstallationStepDTO[];
  error?: string;
}

export type InstallationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';

export interface InstallationStepDTO {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  duration?: number;
  error?: string;
}

// ── Activation DTOs ────────────────────────────────────────────────────────

export interface MarketplaceActivationDTO {
  id: string;
  assetId: string;
  assetName: string;
  isActive: boolean;
  activatedAt?: string;
  deactivatedAt?: string;
  lastUsed?: string;
  usageCount: number;
  config: Record<string, unknown>;
}

// ── Version DTOs ───────────────────────────────────────────────────────────

export interface MarketplaceVersionDTO {
  id: string;
  assetId: string;
  assetName: string;
  version: string;
  previousVersion?: string;
  changes: string[];
  breaking: boolean;
  publishedAt: string;
  installedAt?: string;
  isCurrent: boolean;
  size: number;
  compatibility: 'compatible' | 'partial' | 'incompatible' | 'unknown';
}

// ── Compatibility DTOs ─────────────────────────────────────────────────────

export interface MarketplaceCompatibilityDTO {
  overall: 'compatible' | 'partial' | 'incompatible' | 'unknown';
  platformVersion: string;
  checks: CompatibilityCheckDTO[];
  issues: string[];
  warnings: string[];
}

export interface CompatibilityCheckDTO {
  name: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  message: string;
  details?: string;
}

// ── Insight & Recommendation DTOs ──────────────────────────────────────────

export interface MarketplaceInsightDTO {
  id: string;
  type: 'pattern' | 'achievement' | 'warning' | 'prediction' | 'trend';
  title: string;
  description: string;
  severity: 'info' | 'positive' | 'warning' | 'critical';
  source: string;
  timestamp: string;
  actionable: boolean;
  actionLabel?: string;
  actionRoute?: string;
}

export interface MarketplaceRecommendationDTO {
  id: string;
  category: 'asset' | 'update' | 'provider' | 'template' | 'pack' | 'plugin' | 'integration';
  title: string;
  description: string;
  priority: number;
  confidence: number;
  source: string;
  reason: string;
  actionLabel: string;
  actionRoute: string;
  isDismissed: boolean;
  assetId?: string;
  createdAt: string;
}

// ── Notification DTOs ──────────────────────────────────────────────────────

export interface MarketplaceNotificationDTO {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'reminder';
  title: string;
  message: string;
  source: string;
  isRead: boolean;
  isActionable: boolean;
  actionLabel?: string;
  actionRoute?: string;
  assetId?: string;
  createdAt: string;
  expiresAt?: string;
}

// ── Quick Action DTOs ──────────────────────────────────────────────────────

export type { QuickActionDTO };

// ── Metrics DTOs ───────────────────────────────────────────────────────────

export interface MarketplaceMetricsDTO {
  totalAssets: number;
  installedCount: number;
  activeCount: number;
  availableUpdates: number;
  providerCount: number;
  templateCount: number;
  packCount: number;
  averageRating: number;
  totalDownloads: number;
  compatibilityScore: number;
  installationSuccessRate: number;
  overallHealth: number;
}

// ── Health DTOs ────────────────────────────────────────────────────────────

export interface MarketplaceHealthIndicatorDTO {
  overall: 'healthy' | 'degraded' | 'critical';
  services: Array<{ name: string; status: 'healthy' | 'degraded' | 'down'; latency: number }>;
  lastChecked: string;
  warnings: string[];
}

// ── AI Context DTO ─────────────────────────────────────────────────────────

export interface MarketplaceAIContextDTO {
  currentFocus: string;
  recentActivity: string[];
  suggestedQuestions: string[];
  contextSummary: string;
}

// ── Timeline DTOs ──────────────────────────────────────────────────────────

export interface MarketplaceTimelineDTO {
  entries: MarketplaceTimelineEntryDTO[];
  totalEntries: number;
  hasMore: boolean;
}

export interface MarketplaceTimelineEntryDTO {
  id: string;
  // Current emitted variants: 'installation', 'activation'
  // Reserved for future use: 'update', 'deactivation', 'uninstall', 'discovery'
  type: 'installation' | 'activation';
  title: string;
  description: string;
  timestamp: string;
  importance: number;
  icon: string;
  assetId?: string;
  metadata?: Record<string, unknown>;
}

// ── Configuration DTOs ─────────────────────────────────────────────────────

export interface MarketplaceConfigDTO {
  userId: string;
  autoUpdate: boolean;
  autoUpdatePolicies: AutoUpdatePolicy;
  notifyOnUpdates: boolean;
  notifyOnInstall: boolean;
  allowBetaVersions: boolean;
  allowCommunityAssets: boolean;
  preferredProviders: string[];
  proxyConfig?: { host: string; port: number; auth?: boolean };
  cacheTTL: number;
  registryUrl: string;
}

export interface AutoUpdatePolicy {
  enabled: boolean;
  onlyStable: boolean;
  scheduledDay: 'daily' | 'weekly' | 'monthly';
  scheduledTime?: string;
  excludeAssets: string[];
}

// ── Cache DTOs ─────────────────────────────────────────────────────────────

export interface MarketplaceCacheMetricsDTO {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  averageLatency: number;
  memoryUsage: number;
}

// ── Catalog Filter DTOs ────────────────────────────────────────────────────

export interface CatalogFilterDTO {
  type?: AssetType;
  category?: string;
  search?: string;
  tags?: string[];
  sortBy?: 'popular' | 'recent' | 'rating' | 'name';
  onlyFree?: boolean;
  onlyCompatible?: boolean;
  page?: number;
  pageSize?: number;
}
