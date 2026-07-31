// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Analytics Service
// BLD-012 — Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

export class LearningAnalyticsService {
  private totalLoads = 0;
  private totalLatency = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private readonly events: Array<{
    type: string;
    section: string;
    latency: number;
    timestamp: string;
    success: boolean;
  }> = [];

  trackLoad(section: string, latency: number, success: boolean): void {
    this.totalLoads++;
    this.totalLatency += latency;
    this.events.unshift({
      type: success ? 'load_success' : 'load_error',
      section,
      latency,
      timestamp: new Date().toISOString(),
      success,
    });
    if (this.events.length > 1000) this.events.pop();
  }

  trackCacheHit(): void {
    this.cacheHits++;
  }
  trackCacheMiss(): void {
    this.cacheMisses++;
  }

  getAnalytics(): {
    totalLoads: number;
    averageLoadTime: number;
    cacheHitRate: number;
    recentEvents: Array<{
      type: string;
      section: string;
      latency: number;
      timestamp: string;
      success: boolean;
    }>;
  } {
    return {
      totalLoads: this.totalLoads,
      averageLoadTime: this.totalLoads > 0 ? Math.round(this.totalLatency / this.totalLoads) : 0,
      cacheHitRate:
        this.cacheHits + this.cacheMisses > 0
          ? this.cacheHits / (this.cacheHits + this.cacheMisses)
          : 0,
      recentEvents: this.events.slice(0, 50),
    };
  }

  reset(): void {
    this.totalLoads = 0;
    this.totalLatency = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.events.length = 0;
  }
}
