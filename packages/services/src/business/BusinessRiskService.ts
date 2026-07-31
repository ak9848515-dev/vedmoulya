// ──────────────────────────────────────────────────────────────────
// VedMoulya — Business Risk Service
// BLD-013 — Business Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { BusinessRiskDTO, RiskHeatMapDTO, RiskLevel } from './BusinessDTO.js';

export class BusinessRiskService {
  private readonly stores = new Map<string, Map<string, BusinessRiskDTO>>();

  private getStore(userId: string): Map<string, BusinessRiskDTO> {
    let store = this.stores.get(userId);
    if (!store) {
      store = new Map();
      this.stores.set(userId, store);
    }
    return store;
  }

  getRisks(userId: string): BusinessRiskDTO[] {
    return Array.from(this.getStore(userId).values());
  }
  getRisk(userId: string, riskId: string): BusinessRiskDTO | undefined {
    return this.getStore(userId).get(riskId);
  }
  addRisk(userId: string, risk: BusinessRiskDTO): void {
    this.getStore(userId).set(risk.id, risk);
  }

  updateRisk(userId: string, riskId: string, updates: Partial<BusinessRiskDTO>): BusinessRiskDTO {
    const store = this.getStore(userId);
    const existing = store.get(riskId);
    if (!existing) throw new Error(`Risk not found: ${riskId}`);
    const updated = { ...existing, ...updates };
    store.set(riskId, updated);
    return updated;
  }

  deleteRisk(userId: string, riskId: string): void {
    this.getStore(userId).delete(riskId);
  }

  calculateRiskScore(likelihood: RiskLevel, impact: RiskLevel): number {
    return likelihood * impact;
  }

  getCriticalRisks(userId: string): BusinessRiskDTO[] {
    return this.getRisks(userId).filter((r) => r.riskScore >= 15);
  }

  getHighRisks(userId: string): BusinessRiskDTO[] {
    return this.getRisks(userId).filter((r) => r.riskScore >= 10 && r.riskScore < 15);
  }

  getRisksByCategory(userId: string, category: string): BusinessRiskDTO[] {
    return this.getRisks(userId).filter((r) => r.category === category);
  }

  getHeatMap(userId: string): RiskHeatMapDTO {
    const risks = this.getRisks(userId);
    return {
      items: risks.map((r) => ({
        name: r.title,
        likelihood: r.likelihood,
        impact: r.impact,
        score: r.riskScore,
        category: r.category,
      })),
      totalRisks: risks.length,
      criticalCount: risks.filter((r) => r.riskScore >= 15).length,
      highCount: risks.filter((r) => r.riskScore >= 10 && r.riskScore < 15).length,
      mediumCount: risks.filter((r) => r.riskScore >= 5 && r.riskScore < 10).length,
      lowCount: risks.filter((r) => r.riskScore < 5).length,
    };
  }
}
