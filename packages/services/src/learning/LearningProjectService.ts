// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Project Service
// BLD-012 — Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { LearningProjectDTO } from './LearningDTO.js';

export class LearningProjectService {
  private readonly stores = new Map<string, Map<string, LearningProjectDTO>>();

  private getStore(userId: string): Map<string, LearningProjectDTO> {
    let store = this.stores.get(userId);
    if (!store) {
      store = new Map();
      this.stores.set(userId, store);
    }
    return store;
  }

  getProjects(userId: string): LearningProjectDTO[] {
    return Array.from(this.getStore(userId).values());
  }
  getProject(userId: string, projectId: string): LearningProjectDTO | undefined {
    return this.getStore(userId).get(projectId);
  }
  addProject(userId: string, project: LearningProjectDTO): void {
    this.getStore(userId).set(project.id, project);
  }

  updateProject(
    userId: string,
    projectId: string,
    updates: Partial<LearningProjectDTO>,
  ): LearningProjectDTO {
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

  getActiveProjects(userId: string): LearningProjectDTO[] {
    return this.getProjects(userId).filter((p) => p.status === 'in_progress');
  }

  getSuggestedProjects(userId: string, limit: number = 3): LearningProjectDTO[] {
    return this.getProjects(userId)
      .filter((p) => p.status === 'suggested')
      .slice(0, limit);
  }
}
