// ──────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Snapshot Service
// Orchestrates snapshot generation, caching, and lifecycle
// BLD-010 — Dashboard Experience Platform
// ──────────────────────────────────────────────────────────────────

import type { DashboardSnapshotDTO, CacheMetricsDTO } from './DashboardDTO.js';
import { DashboardCacheService } from './DashboardCacheService.js';
import { DashboardConfigurationService } from './DashboardConfigurationService.js';
import { DashboardAssembler } from './DashboardAssembler.js';
import {
  DashboardAnalyticsService,
  type DashboardAnalyticsData,
} from './DashboardAnalyticsService.js';

export class DashboardSnapshotService {
  private readonly cache: DashboardCacheService;
  private readonly config: DashboardConfigurationService;
  private readonly assembler: DashboardAssembler;
  private readonly analytics: DashboardAnalyticsService;

  constructor(
    assembler: DashboardAssembler,
    cache?: DashboardCacheService,
    config?: DashboardConfigurationService,
    analytics?: DashboardAnalyticsService,
  ) {
    this.assembler = assembler;
    this.cache = cache ?? new DashboardCacheService(300_000); // 5 min default
    this.config = config ?? new DashboardConfigurationService();
    this.analytics = analytics ?? new DashboardAnalyticsService();
  }

  /** Get a snapshot for a user (with caching) */
  async getSnapshot(userId: string): Promise<{
    data?: DashboardSnapshotDTO;
    error?: string;
    source: 'cache' | 'fresh';
    latency: number;
  }> {
    const startTime = Date.now();
    const cacheKey = `snapshot_${userId}`;

    // Try cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get<DashboardSnapshotDTO>(cacheKey);
      if (cached.hit && cached.data) {
        this.analytics.trackCacheHit();
        this.analytics.trackLoad('snapshot', Date.now() - startTime, true);
        return {
          data: cached.data,
          source: 'cache',
          latency: Date.now() - startTime,
        };
      }
    }

    this.analytics.trackCacheMiss();

    // Generate fresh snapshot
    try {
      const snapshot = await this.assembler.assemble(userId);
      const userConfig = this.config.getConfig(userId);

      // Cache the snapshot
      this.cache.set(cacheKey, snapshot, userConfig.refreshInterval);

      this.analytics.trackLoad('snapshot', Date.now() - startTime, true);

      return {
        data: snapshot,
        source: 'fresh',
        latency: Date.now() - startTime,
      };
    } catch (error) {
      this.analytics.trackLoad('snapshot', Date.now() - startTime, false);
      return {
        error: error instanceof Error ? error.message : 'Failed to generate snapshot',
        source: 'fresh',
        latency: Date.now() - startTime,
      };
    }
  }

  /** Refresh a specific section of the snapshot */
  async refreshSection(
    userId: string,
    _sectionId: string,
  ): Promise<{
    data?: Partial<DashboardSnapshotDTO>;
    error?: string;
    latency: number;
  }> {
    const startTime = Date.now();

    try {
      const sectionData = await this.assembler.assembleSection(userId, _sectionId);

      // Update the cached snapshot with the refreshed section
      const cacheKey = `snapshot_${userId}`;
      const cached = this.cache.get<DashboardSnapshotDTO>(cacheKey);
      if (cached.hit && cached.data) {
        const updatedSnapshot: DashboardSnapshotDTO = {
          ...cached.data,
          ...sectionData,
          generatedAt: new Date().toISOString(),
        };
        this.cache.set(cacheKey, updatedSnapshot);
      }

      this.analytics.trackLoad(_sectionId, Date.now() - startTime, true);

      return {
        data: sectionData,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      this.analytics.trackLoad(_sectionId, Date.now() - startTime, false);
      return {
        error: error instanceof Error ? error.message : `Failed to refresh section: ${_sectionId}`,
        latency: Date.now() - startTime,
      };
    }
  }

  /** Invalidate a user's cached snapshot */
  invalidateSnapshot(userId: string): void {
    this.cache.invalidateByPrefix(`snapshot_${userId}`);
  }

  /** Invalidate a specific section in the cached snapshot */
  invalidateSection(userId: string, _sectionId: string): void {
    this.cache.invalidateByPrefix(`snapshot_${userId}`);
  }

  /** Warm the cache for a user */
  async warmCache(userId: string): Promise<boolean> {
    try {
      const snapshot = await this.assembler.assemble(userId);
      const userConfig = this.config.getConfig(userId);
      this.cache.set(`snapshot_${userId}`, snapshot, userConfig.refreshInterval);
      return true;
    } catch {
      return false;
    }
  }

  /** Get snapshot with partial refresh support */
  async getSnapshotWithPartialRefresh(
    userId: string,
    staleWhileRefresh: boolean = true,
  ): Promise<{
    data?: DashboardSnapshotDTO;
    error?: string;
    source: 'cache' | 'fresh' | 'stale';
    latency: number;
  }> {
    const cacheKey = `snapshot_${userId}`;

    // Check for stale cache entry
    if (staleWhileRefresh && this.cache.has(cacheKey)) {
      const cached = this.cache.get<DashboardSnapshotDTO>(cacheKey);
      if (cached.hit && cached.data) {
        const age = Date.now() - new Date(cached.data.generatedAt).getTime();
        // If cache is stale but we can serve stale data
        if (age > 300_000) {
          // Fire-and-forget background refresh
          this.assembler
            .assemble(userId)
            .then((snapshot) => {
              const userConfig = this.config.getConfig(userId);
              this.cache.set(cacheKey, snapshot, userConfig.refreshInterval);
            })
            .catch(() => {
              // Silently fail background refresh
            });

          return {
            data: cached.data,
            source: 'stale',
            latency: 0,
          };
        }
      }
    }

    return this.getSnapshot(userId);
  }

  /** Get analytics data */
  getAnalytics(): DashboardAnalyticsData {
    return this.analytics.getAnalytics();
  }

  /** Get cache metrics */
  getCacheMetrics(): CacheMetricsDTO {
    return this.cache.getMetrics();
  }
}
