// ──────────────────────────────────────────────────────────────────
// VedMoulya — Business Goal Service
// BLD-013 — Business Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { BusinessGoalDTO } from './BusinessDTO.js';

export class BusinessGoalService {
  private readonly stores = new Map<string, Map<string, BusinessGoalDTO>>();

  private getStore(userId: string): Map<string, BusinessGoalDTO> {
    let store = this.stores.get(userId);
    if (!store) {
      store = new Map();
      this.stores.set(userId, store);
    }
    return store;
  }

  getGoals(userId: string): BusinessGoalDTO[] {
    return Array.from(this.getStore(userId).values());
  }
  getGoal(userId: string, goalId: string): BusinessGoalDTO | undefined {
    return this.getStore(userId).get(goalId);
  }
  addGoal(userId: string, goal: BusinessGoalDTO): void {
    this.getStore(userId).set(goal.id, goal);
  }

  updateGoal(userId: string, goalId: string, updates: Partial<BusinessGoalDTO>): BusinessGoalDTO {
    const store = this.getStore(userId);
    const existing = store.get(goalId);
    if (!existing) throw new Error(`Goal not found: ${goalId}`);
    const updated = { ...existing, ...updates };
    store.set(goalId, updated);
    return updated;
  }

  deleteGoal(userId: string, goalId: string): void {
    this.getStore(userId).delete(goalId);
  }

  getActiveGoals(userId: string): BusinessGoalDTO[] {
    return this.getGoals(userId).filter((g) => g.status === 'active');
  }

  getGoalsByCategory(userId: string, category: string): BusinessGoalDTO[] {
    return this.getGoals(userId).filter((g) => g.category === category);
  }

  updateGoalProgress(userId: string, goalId: string, progress: number): BusinessGoalDTO {
    return this.updateGoal(userId, goalId, { progress: Math.min(100, Math.max(0, progress)) });
  }
}
