// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Assembler
// Assembles the complete marketplace snapshot from all modules
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import type { MarketplaceSnapshotDTO } from './MarketplaceDTO.js';
import { MarketplaceDTOMapper } from './MarketplaceDTOMapper.js';
import { MarketplaceCatalogService } from './MarketplaceCatalogService.js';
import { MarketplaceAssetService } from './MarketplaceAssetService.js';
import { MarketplaceProviderService } from './MarketplaceProviderService.js';
import { MarketplaceInstallationService } from './MarketplaceInstallationService.js';
import { MarketplaceActivationService } from './MarketplaceActivationService.js';
import { MarketplaceVersionService } from './MarketplaceVersionService.js';
import { MarketplaceCompatibilityService } from './MarketplaceCompatibilityService.js';
import { MarketplaceInsightService } from './MarketplaceInsightService.js';
import { MarketplaceRecommendationService } from './MarketplaceRecommendationService.js';
import { MarketplaceMetricsService } from './MarketplaceMetricsService.js';
import { MarketplaceHealthService } from './MarketplaceHealthService.js';
import { MarketplaceNotificationService } from './MarketplaceNotificationService.js';
import { MarketplaceTimelineService } from './MarketplaceTimelineService.js';
import { MarketplaceConfigurationService } from './MarketplaceConfigurationService.js';

import type { IdentityApplicationService } from '../identity/IdentityApplicationService.js';
import type { MemoryApplicationService } from '../memory/MemoryApplicationService.js';
import type { DecisionApplicationService } from '../decision/DecisionApplicationService.js';
import type { ExecutionApplicationService } from '../execution/ExecutionApplicationService.js';
import type { KnowledgeApplicationService } from '../knowledge/KnowledgeApplicationService.js';
import type { AIOrchestrationService } from '../ai/AIOrchestrationService.js';
import type {
  MarketplaceAIContextDTO,
  QuickActionDTO,
  MarketplaceVersionDTO,
} from './MarketplaceDTO.js';

export interface SafeCallResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class MarketplaceAssembler {
  private readonly mapper: MarketplaceDTOMapper;
  private readonly catalog: MarketplaceCatalogService;
  private readonly asset: MarketplaceAssetService;
  private readonly provider: MarketplaceProviderService;
  private readonly installation: MarketplaceInstallationService;
  private readonly activation: MarketplaceActivationService;
  private readonly version: MarketplaceVersionService;
  private readonly compatibility: MarketplaceCompatibilityService;
  private readonly insights: MarketplaceInsightService;
  private readonly recommendations: MarketplaceRecommendationService;
  private readonly metrics: MarketplaceMetricsService;
  private readonly health: MarketplaceHealthService;
  private readonly notifications: MarketplaceNotificationService;
  private readonly timeline: MarketplaceTimelineService;
  private readonly config: MarketplaceConfigurationService;

  constructor(
    private readonly identityService: IdentityApplicationService,
    private readonly memoryService: MemoryApplicationService,
    private readonly decisionService: DecisionApplicationService,
    private readonly executionService: ExecutionApplicationService,
    private readonly knowledgeService: KnowledgeApplicationService,
    private readonly aiService: AIOrchestrationService,
  ) {
    this.mapper = new MarketplaceDTOMapper();
    this.catalog = new MarketplaceCatalogService();
    this.asset = new MarketplaceAssetService();
    this.provider = new MarketplaceProviderService();
    this.installation = new MarketplaceInstallationService();
    this.activation = new MarketplaceActivationService();
    this.version = new MarketplaceVersionService();
    this.compatibility = new MarketplaceCompatibilityService();
    this.insights = new MarketplaceInsightService();
    this.recommendations = new MarketplaceRecommendationService();
    this.metrics = new MarketplaceMetricsService();
    this.health = new MarketplaceHealthService();
    this.notifications = new MarketplaceNotificationService();
    this.timeline = new MarketplaceTimelineService();
    this.config = new MarketplaceConfigurationService();
  }

  async assemble(userId: string, displayName: string): Promise<MarketplaceSnapshotDTO> {
    const startTime = Date.now();

    const [, , , , aiResult] = await Promise.all([
      this.safeCall(() => this.identityService.getUserById(userId)),
      this.safeCall(() => this.memoryService.getStats()),
      this.safeCall(() => this.decisionService.getStats()),
      this.safeCall(() => this.executionService.getStats()),
      this.safeCall(() =>
        this.aiService.orchestrate({
          capability: 'reasoning',
          userInput: `Marketplace context analysis for user ${userId}`,
          qualityTier: 'standard',
          userId,
          context: {
            systemPrompt: `Marketplace context for user ${userId}`,
          },
        }),
      ),
    ]);

    // Note: _memoryResult, _decisionResult, _executionResult reserved for future cross-module integration

    const catalogDTO = this.catalog.getCatalog();
    const installedAssets = this.asset.getInstalledAssets(userId);
    const activeAssets = this.asset.getActiveAssets(userId);
    const providersList = this.provider.getAllProviders();
    const activeProviders = this.provider.getActiveProviders();
    const installHistory = this.installation.getInstallationHistory();
    const allActivations = this.activation.getAllActivations();
    const pendingActivations = this.activation.getPendingActivations();

    // Compute asset types
    const templates = installedAssets.filter(
      (a) =>
        a.type === 'workflow_template' ||
        a.type === 'career_template' ||
        a.type === 'learning_template' ||
        a.type === 'business_template',
    );
    const knowledgePacks = installedAssets.filter((a) => a.type === 'knowledge_pack');
    const workflowPacks = installedAssets.filter((a) => a.type === 'workflow_template');

    // Versions & updates
    const availableUpdates = this.version.getAllAvailableUpdates();
    const versionHistory: MarketplaceVersionDTO[] = [];
    for (const asset of installedAssets) {
      versionHistory.push(...this.version.getVersions(asset.id));
    }

    // Compatibility
    const allRequirements = installedAssets.flatMap((a) => a.requirements);
    const compatibilityDTO = this.compatibility.checkAssetCompatibility(allRequirements);
    const compatibilityIssues = compatibilityDTO.issues.length + compatibilityDTO.warnings.length;

    // Popular uninstalled assets for recommendations
    const allAssets = this.catalog.getAllAssets();
    const uninstalledPopular = allAssets
      .filter((a) => !a.isInstalled)
      .sort((a, b) => b.downloadCount - a.downloadCount)
      .slice(0, 5);
    const newHighRatedAssets = allAssets
      .filter((a) => !a.isInstalled && a.rating >= 4.5)
      .slice(0, 3);

    // Metrics
    const metricsComponents = {
      totalAssets: catalogDTO.totalAssets,
      installedCount: installedAssets.length,
      activeCount: activeAssets.length,
      availableUpdates: availableUpdates.length,
      providerCount: providersList.length,
      templateCount: templates.length,
      packCount: knowledgePacks.length + workflowPacks.length,
      averageRating:
        allAssets.length > 0
          ? Math.round((allAssets.reduce((s, a) => s + a.rating, 0) / allAssets.length) * 10) / 10
          : 0,
      totalDownloads: allAssets.reduce((s, a) => s + a.downloadCount, 0),
      compatibilityScore:
        compatibilityDTO.overall === 'compatible'
          ? 100
          : compatibilityDTO.overall === 'partial'
            ? 50
            : 0,
      installationSuccessRate: Math.round(this.installation.getSuccessRate() * 100),
      catalogCompleteness:
        catalogDTO.totalAssets > 0 ? Math.min(100, catalogDTO.totalAssets * 10) : 0,
      providerHealth: (activeProviders.length / Math.max(1, providersList.length)) * 100,
      updateCoverage:
        installedAssets.length > 0
          ? Math.round((1 - availableUpdates.length / installedAssets.length) * 100)
          : 100,
    };
    const metricsDTO = this.metrics.aggregate(metricsComponents);

    // Insights
    const insightDTOs = this.insights.generateInsights({
      installErrors: this.installation.getErrorCount(),
      providerErrors: providersList.filter((p) => p.status === 'error').length,
      compatibilityIssues,
      availableUpdates: availableUpdates.length,
      newAssetsCount: catalogDTO.recent.length,
      pendingActivations: pendingActivations.length,
      totalInstalled: installedAssets.length,
      activeCount: activeAssets.length,
    });

    // Recommendations
    const recDTOs = this.recommendations.generateRecommendations({
      availableUpdates: availableUpdates.length,
      uninstalledPopular,
      providersWithErrors: providersList.filter((p) => p.status === 'error').length,
      pendingActivations: pendingActivations.length,
      incompatibleAssets: compatibilityDTO.issues.length,
      newHighRatedAssets,
    });

    // Notifications
    const notifDTOs = this.notifications.generateNotifications({
      availableUpdates: availableUpdates.length,
      installErrors: this.installation.getErrorCount(),
      newAssetsCount: catalogDTO.recent.length,
      compatibilityIssues,
      providerErrors: providersList.filter((p) => p.status === 'error').length,
      pendingActivations: pendingActivations.length,
    });

    // Timeline
    const timelineEntries = this.timeline.buildTimeline([
      ...installHistory.map((i) => ({
        id: i.id,
        type: 'installation' as const,
        title: `Installed ${i.assetName}`,
        description: `Version ${i.version} - ${i.status}`,
        timestamp: i.completedAt ?? i.startedAt,
        importance: i.status === 'completed' ? 8 : 5,
        icon: i.status === 'completed' ? 'check-circle' : 'loader',
        assetId: i.assetId,
      })),
      ...allActivations
        .filter((a) => a.activatedAt)
        .map((a) => ({
          id: a.id,
          type: 'activation' as const,
          title: a.isActive ? `Activated ${a.assetName}` : `Deactivated ${a.assetName}`,
          description: a.isActive ? 'Asset activated' : 'Asset deactivated',
          timestamp: a.activatedAt ?? new Date().toISOString(),
          importance: 7,
          icon: a.isActive ? 'toggle-right' : 'toggle-left',
          assetId: a.assetId,
        })),
    ]);
    const timelineDTO = this.mapper.toTimeline(timelineEntries);

    // Quick actions
    const quickActions: QuickActionDTO[] = [
      this.mapper.createQuickAction(
        'browse_catalog',
        'Browse Catalog',
        'Discover new marketplace assets',
        'compass',
        '/marketplace/catalog',
        1,
        'catalog',
        true,
      ),
      this.mapper.createQuickAction(
        'manage_providers',
        'Manage Providers',
        'Configure AI and service providers',
        'cpu',
        '/marketplace/providers',
        2,
        'provider',
        true,
      ),
      this.mapper.createQuickAction(
        'view_updates',
        'View Updates',
        'Check for available updates',
        'refresh-cw',
        '/marketplace/updates',
        3,
        'update',
        true,
      ),
      this.mapper.createQuickAction(
        'view_installations',
        'View Installations',
        'Track installation history',
        'package',
        '/marketplace/installations',
        4,
        'installation',
        true,
      ),
      this.mapper.createQuickAction(
        'check_compatibility',
        'Check Compatibility',
        'Verify asset compatibility',
        'check-square',
        '/marketplace/compatibility',
        5,
        'compatibility',
        true,
      ),
      this.mapper.createQuickAction(
        'browse_templates',
        'Browse Templates',
        'Explore workflow templates',
        'layout',
        '/marketplace/templates',
        6,
        'template',
        availableUpdates.length > 0,
      ),
      this.mapper.createQuickAction(
        'view_activations',
        'View Activations',
        pendingActivations.length > 0
          ? `${String(pendingActivations.length)} pending`
          : 'Manage asset activations',
        'toggle-right',
        '/marketplace/activations',
        7,
        'activation',
        true,
      ),
      this.mapper.createQuickAction(
        'explore_providers',
        'Explore Providers',
        providersList.length > 0
          ? `${String(providersList.length)} providers available`
          : 'Configure AI and service providers',
        'cloud',
        '/marketplace/providers',
        8,
        'provider',
        true,
      ),
    ];

    this.health.reportHealth('marketplace', 'healthy', Date.now() - startTime);
    const healthDTO = this.health.getHealth();
    const healthIndicator = this.mapper.createHealthIndicator(
      healthDTO.services.map((s) => ({ name: s.name, status: s.status, latency: s.latency })),
    );

    const aiContext: MarketplaceAIContextDTO = {
      currentFocus: `Marketplace for ${displayName}`,
      recentActivity: this.buildRecentActivitySummary(installHistory, providersList),
      suggestedQuestions: [
        'What assets should I install for my workflow?',
        `How do I configure ${providersList.length > 0 ? (providersList[0]?.name ?? 'AI providers') : 'AI providers'}?`,
        'Are there templates for my use case?',
      ],
      contextSummary:
        aiResult.success && aiResult.data
          ? `AI analysis available for marketplace user ${displayName}`
          : `${displayName} has ${String(installedAssets.length)} assets installed with ${String(availableUpdates.length)} updates available.`,
    };

    const snapshot: MarketplaceSnapshotDTO = {
      id: `msnap_${userId}_${String(Date.now())}`,
      userId,
      generatedAt: new Date().toISOString(),
      ttl: 300_000,
      catalog: catalogDTO,
      installedAssets,
      availableUpdates,
      providers: providersList,
      installedTemplates: templates,
      knowledgePacks,
      workflowPacks,
      compatibility: compatibilityDTO,
      recommendations: this.recommendations.prioritizeRecommendations(recDTOs),
      insights: insightDTOs,
      versionHistory,
      installationHistory: installHistory,
      notifications: notifDTOs,
      metrics: metricsDTO,
      health: healthIndicator,
      timeline: timelineDTO,
      quickActions,
      aiContext,
    };

    this.health.reportHealth('marketplace-snapshot', 'healthy', Date.now() - startTime);
    return snapshot;
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private buildRecentActivitySummary(
    installations: { assetName: string; status: string }[],
    providers: { name: string; status: string }[],
  ): string[] {
    const activities: string[] = [];
    const completed = installations.filter((i) => i.status === 'completed').length;
    if (completed > 0) activities.push(`Installed ${String(completed)} assets`);
    const errors = providers.filter((p) => p.status === 'error').length;
    if (errors > 0) activities.push(`${String(errors)} providers with errors`);
    return activities.length > 0 ? activities : ['Marketplace ready for exploration'];
  }

  // ── Service Accessors ────────────────────────────────────────────────────

  getCatalogService(): MarketplaceCatalogService {
    return this.catalog;
  }
  getAssetService(): MarketplaceAssetService {
    return this.asset;
  }
  getProviderService(): MarketplaceProviderService {
    return this.provider;
  }
  getInstallationService(): MarketplaceInstallationService {
    return this.installation;
  }
  getActivationService(): MarketplaceActivationService {
    return this.activation;
  }
  getVersionService(): MarketplaceVersionService {
    return this.version;
  }
  getCompatibilityService(): MarketplaceCompatibilityService {
    return this.compatibility;
  }
  getInsightService(): MarketplaceInsightService {
    return this.insights;
  }
  getRecommendationService(): MarketplaceRecommendationService {
    return this.recommendations;
  }

  private async safeCall<T>(fn: () => Promise<T>): Promise<SafeCallResult<T>> {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}
