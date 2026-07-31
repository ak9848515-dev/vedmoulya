// ──────────────────────────────────────────────────────────────────
// VedMoulya — Life OS Health Service
// BLD-015 — Life OS Integration & Unified Experience
// ──────────────────────────────────────────────────────────────────

import type { LifeOSModuleHealthDTO, LifeOSModule } from './LifeOSDTO.js';

export class LifeOSHealthService {
  private readonly modules = new Map<
    string,
    {
      name: LifeOSModule;
      status: 'healthy' | 'degraded' | 'down';
      latency: number;
      lastChecked: number;
    }
  >();

  reportModuleHealth(
    name: LifeOSModule,
    status: 'healthy' | 'degraded' | 'down',
    latency: number,
  ): void {
    this.modules.set(name, { name, status, latency, lastChecked: Date.now() });
  }

  getModuleHealth(): LifeOSModuleHealthDTO[] {
    return Array.from(this.modules.values()).map((m) => ({
      name: m.name,
      status: m.status,
      latency: m.latency,
      lastChecked: new Date(m.lastChecked).toISOString(),
    }));
  }

  isHealthy(): boolean {
    for (const m of this.modules.values()) {
      if (m.status !== 'healthy') return false;
    }
    return this.modules.size > 0;
  }

  reset(): void {
    this.modules.clear();
  }
}
