// ──────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Analytics Service
// Aggregates analytics data from all dashboard components
// BLD-010 — Dashboard Experience Platform
// ──────────────────────────────────────────────────────────────────

export interface AnalyticsEvent {
  eventType: string;
  section: string;
  latency: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface SectionAnalytics {
  sectionId: string;
  loadCount: number;
  totalLatency: number;
  averageLatency: number;
  errorCount: number;
  lastLoaded?: string;
}

export interface DashboardAnalyticsData {
  totalLoads: number;
  averageLoadTime: number;
  cacheHitRate: number;
  sectionAnalytics: SectionAnalytics[];
  topSections: string[];
  slowestSections: string[];
  recentEvents: AnalyticsEvent[];
}

export class DashboardAnalyticsService {
  private readonly events: AnalyticsEvent[] = [];
  private readonly maxEvents = 1000;
  private readonly sectionStats = new Map<
    string,
    {
      loadCount: number;
      totalLatency: number;
      errorCount: number;
      lastLoaded?: string;
    }
  >();
  private totalLoads = 0;
  private totalLatency = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  /** Track a dashboard load event */
  trackLoad(section: string, latency: number, success: boolean): void {
    this.totalLoads++;
    this.totalLatency += latency;

    const stats = this.sectionStats.get(section) ?? {
      loadCount: 0,
      totalLatency: 0,
      errorCount: 0,
    };
    stats.loadCount++;
    stats.totalLatency += latency;
    stats.lastLoaded = new Date().toISOString();
    if (!success) stats.errorCount++;
    this.sectionStats.set(section, stats);

    this.addEvent({
      eventType: success ? 'load_success' : 'load_error',
      section,
      latency,
      timestamp: new Date().toISOString(),
    });
  }

  /** Track a cache hit */
  trackCacheHit(): void {
    this.cacheHits++;
  }

  /** Track a cache miss */
  trackCacheMiss(): void {
    this.cacheMisses++;
  }

  /** Track a custom analytics event */
  trackEvent(
    eventType: string,
    section: string,
    latency: number,
    metadata?: Record<string, unknown>,
  ): void {
    this.addEvent({
      eventType,
      section,
      latency,
      timestamp: new Date().toISOString(),
      metadata,
    });
  }

  /** Get aggregated analytics data */
  getAnalytics(): DashboardAnalyticsData {
    const sections = Array.from(this.sectionStats.entries()).map(([sectionId, stats]) => ({
      sectionId,
      loadCount: stats.loadCount,
      totalLatency: stats.totalLatency,
      averageLatency: stats.loadCount > 0 ? Math.round(stats.totalLatency / stats.loadCount) : 0,
      errorCount: stats.errorCount,
      lastLoaded: stats.lastLoaded,
    }));

    const sortedByLoad = [...sections].sort((a, b) => b.loadCount - a.loadCount);
    const sortedByLatency = [...sections].sort((a, b) => b.averageLatency - a.averageLatency);

    return {
      totalLoads: this.totalLoads,
      averageLoadTime: this.totalLoads > 0 ? Math.round(this.totalLatency / this.totalLoads) : 0,
      cacheHitRate: this.getCacheHitRate(),
      sectionAnalytics: sections,
      topSections: sortedByLoad.slice(0, 5).map((s) => s.sectionId),
      slowestSections: sortedByLatency.slice(0, 3).map((s) => s.sectionId),
      recentEvents: this.events.slice(0, 50),
    };
  }

  /** Get analytics for a specific section */
  getSectionAnalytics(sectionId: string): SectionAnalytics | undefined {
    const stats = this.sectionStats.get(sectionId);
    if (!stats) return undefined;
    return {
      sectionId,
      loadCount: stats.loadCount,
      totalLatency: stats.totalLatency,
      averageLatency: stats.loadCount > 0 ? Math.round(stats.totalLatency / stats.loadCount) : 0,
      errorCount: stats.errorCount,
      lastLoaded: stats.lastLoaded,
    };
  }

  /** Get performance summary */
  getPerformanceSummary(): {
    averageLoadTime: number;
    cacheHitRate: number;
    totalSections: number;
    totalEvents: number;
    errorRate: number;
  } {
    const totalErrors = Array.from(this.sectionStats.values()).reduce(
      (sum, s) => sum + s.errorCount,
      0,
    );
    return {
      averageLoadTime: this.totalLoads > 0 ? Math.round(this.totalLatency / this.totalLoads) : 0,
      cacheHitRate: this.getCacheHitRate(),
      totalSections: this.sectionStats.size,
      totalEvents: this.events.length,
      errorRate: this.totalLoads > 0 ? totalErrors / this.totalLoads : 0,
    };
  }

  /** Reset all analytics data */
  reset(): void {
    this.events.length = 0;
    this.sectionStats.clear();
    this.totalLoads = 0;
    this.totalLatency = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  private addEvent(event: AnalyticsEvent): void {
    this.events.unshift(event);
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }
  }

  private getCacheHitRate(): number {
    const total = this.cacheHits + this.cacheMisses;
    return total > 0 ? this.cacheHits / total : 0;
  }
}
