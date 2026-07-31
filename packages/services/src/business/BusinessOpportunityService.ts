// ──────────────────────────────────────────────────────────────────
// VedMoulya — Business Opportunity Service
// BLD-013 — Business Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { BusinessOpportunityDTO } from './BusinessDTO.js';

export class BusinessOpportunityService {
  private readonly stores = new Map<string, Map<string, BusinessOpportunityDTO>>();

  private getStore(userId: string): Map<string, BusinessOpportunityDTO> {
    let store = this.stores.get(userId);
    if (!store) {
      store = new Map();
      this.stores.set(userId, store);
    }
    return store;
  }

  getOpportunities(userId: string): BusinessOpportunityDTO[] {
    return Array.from(this.getStore(userId).values());
  }
  getOpportunity(userId: string, oppId: string): BusinessOpportunityDTO | undefined {
    return this.getStore(userId).get(oppId);
  }
  addOpportunity(userId: string, opp: BusinessOpportunityDTO): void {
    this.getStore(userId).set(opp.id, opp);
  }

  updateOpportunity(
    userId: string,
    oppId: string,
    updates: Partial<BusinessOpportunityDTO>,
  ): BusinessOpportunityDTO {
    const store = this.getStore(userId);
    const existing = store.get(oppId);
    if (!existing) throw new Error(`Opportunity not found: ${oppId}`);
    const updated = { ...existing, ...updates };
    store.set(oppId, updated);
    return updated;
  }

  deleteOpportunity(userId: string, oppId: string): void {
    this.getStore(userId).delete(oppId);
  }

  getHighValueOpportunities(userId: string, minRoi: number = 100): BusinessOpportunityDTO[] {
    return this.getOpportunities(userId).filter(
      (o) => o.roi >= minRoi && o.status !== 'declined' && o.status !== 'completed',
    );
  }

  getOpportunitiesByType(userId: string, type: string): BusinessOpportunityDTO[] {
    return this.getOpportunities(userId).filter((o) => o.type === type);
  }

  getTopOpportunities(userId: string, limit: number = 5): BusinessOpportunityDTO[] {
    return this.getOpportunities(userId)
      .filter((o) => o.status !== 'declined' && o.status !== 'completed')
      .sort((a, b) => b.roi * b.confidence - a.roi * a.confidence)
      .slice(0, limit);
  }
}
