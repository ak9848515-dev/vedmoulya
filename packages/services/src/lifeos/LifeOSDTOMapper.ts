// ──────────────────────────────────────────────────────────────────
// VedMoulya — Life OS DTO Mapper
// BLD-015 — Life OS Integration & Unified Experience
// ──────────────────────────────────────────────────────────────────

import type {
  LifeOSUnifiedTimelineDTO,
  LifeOSTimelineEntryDTO,
  LifeOSPlatformHealthDTO,
  LifeOSModuleHealthDTO,
  LifeOSPriorityDTO,
  LifeOSModule,
} from './LifeOSDTO.js';

export class LifeOSDTOMapper {
  toUnifiedTimeline(
    entries: LifeOSTimelineEntryDTO[],
    filter: LifeOSUnifiedTimelineDTO['filter'] = 'all',
  ): LifeOSUnifiedTimelineDTO {
    return { entries, totalEntries: entries.length, hasMore: entries.length >= 50, filter };
  }

  createPlatformHealth(modules: LifeOSModuleHealthDTO[]): LifeOSPlatformHealthDTO {
    let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';
    for (const m of modules) {
      if (m.status === 'down') {
        overall = 'critical';
      } else if (m.status === 'degraded' && overall !== 'critical') {
        overall = 'degraded';
      }
    }
    return {
      overall,
      modules,
      cacheStatus: { totalEntries: 0, hitRate: 0, memoryUsage: 0 },
      performance: {
        snapshotGeneration: 0,
        searchLatency: 0,
        timelineMerge: 0,
        recommendationLatency: 0,
      },
      integrationStatus: {
        totalModules: modules.length,
        connectedModules: modules.filter((m) => m.status === 'healthy').length,
        failedModules: modules.filter((m) => m.status === 'down').length,
      },
      providerStatus: { total: 0, active: 0, errorRate: 0 },
    };
  }

  createPriority(
    id: string,
    title: string,
    description: string,
    source: LifeOSModule,
    priority: number,
    category: string,
    isBlocked: boolean = false,
    deadline?: string,
  ): LifeOSPriorityDTO {
    return { id, title, description, source, priority, isBlocked, deadline, category };
  }
}
