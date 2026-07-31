// ──────────────────────────────────────────────────────────────────
// VedMoulya — Life OS Snapshot Service
// Orchestrates snapshot generation from the Assemler
// BLD-015 — Life OS Integration & Unified Experience
// ──────────────────────────────────────────────────────────────────

import type { LifeOSSnapshotDTO, LifeOSCacheMetricsDTO } from './LifeOSDTO.js';
import { LifeOSAssembler } from './LifeOSAssembler.js';
import { LifeOSCacheService } from './LifeOSCacheService.js';
import { LifeOSConfigurationService } from './LifeOSConfigurationService.js';
import { LifeOSAnalyticsService } from './LifeOSAnalyticsService.js';

export interface SnapshotResult {
  success: boolean;
  data?: LifeOSSnapshotDTO;
  error?: string;
  latency?: number;
}

export class LifeOSSnapshotService {
  constructor(
    private readonly assembler: LifeOSAssembler,
    private readonly cache: LifeOSCacheService,
    private readonly config: LifeOSConfigurationService,
    private readonly analytics: LifeOSAnalyticsService,
  ) {}

  async getSnapshot(userId: string): Promise<SnapshotResult> {
    const startTime = Date.now();
    const cacheKey = `lifeos_${userId}`;

    try {
      const cached = this.cache.get<LifeOSSnapshotDTO>(cacheKey);
      if (cached.hit && cached.data) {
        this.analytics.trackCacheHit();
        this.analytics.trackLoad('lifeos', Date.now() - startTime, true);
        return { success: true, data: cached.data, latency: Date.now() - startTime };
      }

      this.analytics.trackCacheMiss();
      const snapshot = await this.assembler.assemble(userId);
      const userConfig = this.config.getConfig(userId);
      this.cache.set(cacheKey, snapshot, userConfig.cacheTTL);
      this.analytics.trackLoad('lifeos', Date.now() - startTime, true);
      return { success: true, data: snapshot, latency: Date.now() - startTime };
    } catch (error) {
      this.analytics.trackLoad('lifeos', Date.now() - startTime, false);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate Life OS snapshot',
        latency: Date.now() - startTime,
      };
    }
  }

  invalidateSnapshot(userId: string): void {
    this.cache.invalidateByPrefix(`lifeos_${userId}`);
  }

  async refreshModule(userId: string, _moduleName: string): Promise<SnapshotResult> {
    this.cache.invalidateByPrefix(`lifeos_${userId}`);
    return this.getSnapshot(userId);
  }

  async warmCache(userId: string): Promise<boolean> {
    try {
      await this.getSnapshot(userId);
      return true;
    } catch {
      return false;
    }
  }

  getCacheMetrics(): LifeOSCacheMetricsDTO {
    return this.cache.getMetrics();
  }
}
