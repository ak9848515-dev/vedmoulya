// ──────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Health Service
// Health monitoring for the Dashboard Experience Platform
// BLD-010 — Dashboard Experience Platform
// ──────────────────────────────────────────────────────────────────

import type { HealthIndicatorDTO } from './DashboardDTO.js';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  lastChecked: number;
}

export class DashboardHealthService {
  private readonly services = new Map<string, ServiceHealth>();

  /** Report health status for a service */
  reportHealth(name: string, status: 'healthy' | 'degraded' | 'down', latency: number): void {
    this.services.set(name, { name, status, latency, lastChecked: Date.now() });
  }

  /** Get overall health indicator */
  getHealth(): HealthIndicatorDTO {
    const services = Array.from(this.services.values());
    const warnings: string[] = [];

    let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';

    for (const svc of services) {
      if (svc.status === 'down') {
        overall = 'critical';
        warnings.push(`${svc.name} is down`);
      } else if (svc.status === 'degraded' && overall !== 'critical') {
        overall = 'degraded';
        warnings.push(`${svc.name} is degraded (${svc.latency.toFixed(0)}ms)`);
      }
    }

    // Check for stale services (not checked in > 5 minutes)
    const now = Date.now();
    for (const svc of services) {
      if (now - svc.lastChecked > 300_000 && svc.status !== 'down') {
        warnings.push(`${svc.name} hasn't reported in 5+ minutes`);
      }
    }

    return {
      overall,
      services: services.map((s) => ({ name: s.name, status: s.status, latency: s.latency })),
      lastChecked: new Date().toISOString(),
      warnings,
    };
  }

  /** Check if all services are healthy */
  isHealthy(): boolean {
    for (const svc of this.services.values()) {
      if (svc.status !== 'healthy') return false;
    }
    return this.services.size > 0;
  }

  /** Get count of services by status */
  getServiceCounts(): { healthy: number; degraded: number; down: number } {
    const counts = { healthy: 0, degraded: 0, down: 0 };
    for (const svc of this.services.values()) {
      counts[svc.status]++;
    }
    return counts;
  }

  /** Reset all health data */
  reset(): void {
    this.services.clear();
  }
}
