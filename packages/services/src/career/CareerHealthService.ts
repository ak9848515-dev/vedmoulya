// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career Health Service
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { CareerHealthIndicatorDTO } from './CareerDTO.js';

export class CareerHealthService {
  private readonly services = new Map<
    string,
    { name: string; status: 'healthy' | 'degraded' | 'down'; latency: number; lastChecked: number }
  >();

  reportHealth(name: string, status: 'healthy' | 'degraded' | 'down', latency: number): void {
    this.services.set(name, { name, status, latency, lastChecked: Date.now() });
  }

  getHealth(): CareerHealthIndicatorDTO {
    const services = Array.from(this.services.values());
    const warnings: string[] = [];
    let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';

    for (const svc of services) {
      if (svc.status === 'down') {
        overall = 'critical';
        warnings.push(`${svc.name} is down`);
      } else if (svc.status === 'degraded' && overall !== 'critical') {
        overall = 'degraded';
        warnings.push(`${svc.name} is degraded (${String(svc.latency)}ms)`);
      }
    }

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

  isHealthy(): boolean {
    for (const svc of this.services.values()) {
      if (svc.status !== 'healthy') return false;
    }
    return this.services.size > 0;
  }

  reset(): void {
    this.services.clear();
  }
}
