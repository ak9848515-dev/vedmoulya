// ──────────────────────────────────────────────────────────────────
// VedMoulya — Business Project Service
// BLD-013 — Business Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { BusinessProjectDTO } from './BusinessDTO.js';

export class BusinessProjectService {
  private readonly stores = new Map<string, Map<string, BusinessProjectDTO>>();

  private getStore(userId: string): Map<string, BusinessProjectDTO> {
    let store = this.stores.get(userId);
    if (!store) {
      store = new Map();
      this.stores.set(userId, store);
    }
    return store;
  }

  getProjects(userId: string): BusinessProjectDTO[] {
    return Array.from(this.getStore(userId).values());
  }
  getProject(userId: string, projectId: string): BusinessProjectDTO | undefined {
    return this.getStore(userId).get(projectId);
  }
  addProject(userId: string, project: BusinessProjectDTO): void {
    this.getStore(userId).set(project.id, project);
  }

  updateProject(
    userId: string,
    projectId: string,
    updates: Partial<BusinessProjectDTO>,
  ): BusinessProjectDTO {
    const store = this.getStore(userId);
    const existing = store.get(projectId);
    if (!existing) throw new Error(`Project not found: ${projectId}`);
    const updated = { ...existing, ...updates };
    store.set(projectId, updated);
    return updated;
  }

  deleteProject(userId: string, projectId: string): void {
    this.getStore(userId).delete(projectId);
  }

  getActiveProjects(userId: string): BusinessProjectDTO[] {
    return this.getProjects(userId).filter((p) => p.status === 'in_progress');
  }

  getBlockedProjects(userId: string): BusinessProjectDTO[] {
    return this.getProjects(userId).filter((p) => p.status === 'blocked');
  }

  getProjectsByPriority(userId: string): BusinessProjectDTO[] {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return this.getProjects(userId).sort(
      (a, b) => (order[a.priority] ?? 99) - (order[b.priority] ?? 99),
    );
  }
}
