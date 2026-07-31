// ──────────────────────────────────────────────────────────────────
// VedMoulya — Business Strategy Service
// BLD-013 — Business Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { BusinessStrategyDTO } from './BusinessDTO.js';

export class BusinessStrategyService {
  private readonly stores = new Map<string, Map<string, BusinessStrategyDTO>>();

  private getStore(userId: string): Map<string, BusinessStrategyDTO> {
    let store = this.stores.get(userId);
    if (!store) {
      store = new Map();
      this.stores.set(userId, store);
    }
    return store;
  }

  getStrategies(userId: string): BusinessStrategyDTO[] {
    return Array.from(this.getStore(userId).values());
  }
  getStrategy(userId: string, strategyId: string): BusinessStrategyDTO | undefined {
    return this.getStore(userId).get(strategyId);
  }
  addStrategy(userId: string, strategy: BusinessStrategyDTO): void {
    this.getStore(userId).set(strategy.id, strategy);
  }

  updateStrategy(
    userId: string,
    strategyId: string,
    updates: Partial<BusinessStrategyDTO>,
  ): BusinessStrategyDTO {
    const store = this.getStore(userId);
    const existing = store.get(strategyId);
    if (!existing) throw new Error(`Strategy not found: ${strategyId}`);
    const updated = { ...existing, ...updates };
    store.set(strategyId, updated);
    return updated;
  }

  deleteStrategy(userId: string, strategyId: string): void {
    this.getStore(userId).delete(strategyId);
  }

  getActiveStrategies(userId: string): BusinessStrategyDTO[] {
    return this.getStrategies(userId).filter((s) => s.status === 'active');
  }
}
