// ──────────────────────────────────────────────────────────────────
// VedMoulya — Business KPI Service
// BLD-013 — Business Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { BusinessKPIDTO } from './BusinessDTO.js';

export class BusinessKPIService {
  private readonly stores = new Map<string, Map<string, BusinessKPIDTO>>();

  private getStore(userId: string): Map<string, BusinessKPIDTO> {
    let store = this.stores.get(userId);
    if (!store) {
      store = new Map();
      this.stores.set(userId, store);
    }
    return store;
  }

  getKPIs(userId: string): BusinessKPIDTO[] {
    return Array.from(this.getStore(userId).values());
  }
  getKPI(userId: string, kpiId: string): BusinessKPIDTO | undefined {
    return this.getStore(userId).get(kpiId);
  }
  addKPI(userId: string, kpi: BusinessKPIDTO): void {
    this.getStore(userId).set(kpi.id, kpi);
  }

  updateKPI(userId: string, kpiId: string, updates: Partial<BusinessKPIDTO>): BusinessKPIDTO {
    const store = this.getStore(userId);
    const existing = store.get(kpiId);
    if (!existing) throw new Error(`KPI not found: ${kpiId}`);
    const updated = { ...existing, ...updates };
    store.set(kpiId, updated);
    return updated;
  }

  deleteKPI(userId: string, kpiId: string): void {
    this.getStore(userId).delete(kpiId);
  }

  getKPIsByCategory(userId: string, category: string): BusinessKPIDTO[] {
    return this.getKPIs(userId).filter((k) => k.category === category);
  }

  getKPIsAtRisk(userId: string): BusinessKPIDTO[] {
    return this.getKPIs(userId).filter((k) => k.currentValue < k.targetValue * 0.5);
  }

  getKPIsOnTrack(userId: string): BusinessKPIDTO[] {
    return this.getKPIs(userId).filter((k) => k.currentValue >= k.targetValue);
  }
}
