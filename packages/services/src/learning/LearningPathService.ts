// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Path Service
// BLD-012 — Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { LearningPathDTO, LearningTopicDTO } from './LearningDTO.js';

export class LearningPathService {
  private readonly pathStores = new Map<string, Map<string, LearningPathDTO>>();

  private getStore(userId: string): Map<string, LearningPathDTO> {
    let store = this.pathStores.get(userId);
    if (!store) {
      store = new Map();
      this.pathStores.set(userId, store);
    }
    return store;
  }

  getPaths(userId: string): LearningPathDTO[] {
    return Array.from(this.getStore(userId).values());
  }

  getPath(userId: string, pathId: string): LearningPathDTO | undefined {
    return this.getStore(userId).get(pathId);
  }

  addPath(userId: string, path: LearningPathDTO): void {
    this.getStore(userId).set(path.id, path);
  }

  updatePath(userId: string, pathId: string, updates: Partial<LearningPathDTO>): LearningPathDTO {
    const store = this.getStore(userId);
    const existing = store.get(pathId);
    if (!existing) throw new Error(`Path not found: ${pathId}`);
    const updated = { ...existing, ...updates };
    store.set(pathId, updated);
    return updated;
  }

  deletePath(userId: string, pathId: string): void {
    this.getStore(userId).delete(pathId);
  }

  getActivePaths(userId: string): LearningPathDTO[] {
    return this.getPaths(userId).filter((p) => p.status === 'in_progress');
  }

  getRecommendedPaths(userId: string, limit: number = 5): LearningPathDTO[] {
    return this.getPaths(userId)
      .filter((p) => p.status === 'not_started')
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  updateTopicProgress(
    userId: string,
    pathId: string,
    topicId: string,
    completedMinutes: number,
  ): LearningTopicDTO | undefined {
    const path = this.getPath(userId, pathId);
    if (!path) return undefined;
    const topic = path.topics.find((t) => t.id === topicId);
    if (!topic) return undefined;
    topic.completedMinutes += completedMinutes;
    if (topic.completedMinutes >= topic.estimatedMinutes && topic.status !== 'completed') {
      topic.status = 'completed';
      topic.masteryLevel = Math.min(100, topic.masteryLevel + 20);
    } else if (topic.completedMinutes > 0 && topic.status === 'pending') {
      topic.status = 'in_progress';
    }
    path.completedHours = path.topics.reduce((s, t) => s + t.completedMinutes, 0) / 60;
    const allDone = path.topics.every((t) => t.status === 'completed');
    if (allDone && path.status === 'in_progress') path.status = 'completed';
    return topic;
  }
}
