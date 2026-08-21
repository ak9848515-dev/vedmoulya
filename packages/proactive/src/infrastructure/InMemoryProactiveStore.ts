// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Proactive Intelligence · InMemoryProactiveStore
// SPRINT-029 — owner-scoped in-memory recommendation store (hermetic default;
// Postgres backing lives in PostgresProactiveStore). Owner isolation is
// structural: every read is keyed by (ownerId, recommendationId) — a foreign
// owner can never address another user's rows.
// ─────────────────────────────────────────────────────────────────────────────

import type { ProactiveRecommendation } from '../types/proactive-types.js';
import type { ProactiveRecommendationStore } from '../contracts/proactive-ports.js';

export class InMemoryProactiveStore implements ProactiveRecommendationStore {
  private readonly byOwner = new Map<string, Map<string, ProactiveRecommendation>>();
  private readonly keys = new Map<string, string>();

  private ownerMap(userId: string): Map<string, ProactiveRecommendation> {
    let map = this.byOwner.get(userId);
    if (!map) {
      map = new Map();
      this.byOwner.set(userId, map);
    }
    return map;
  }

  save(recommendation: ProactiveRecommendation): void {
    this.ownerMap(recommendation.ownerId).set(recommendation.id, recommendation);
  }

  saveWithKey(key: string, recommendation: ProactiveRecommendation): void {
    const previousId = this.keys.get(key);
    if (previousId) {
      const map = this.ownerMap(recommendation.ownerId);
      const previous = map.get(previousId);
      if (previous) {
        map.set(previousId, { ...previous, ...recommendation, id: previousId });
        return;
      }
    }
    this.keys.set(key, recommendation.id);
    this.save(recommendation);
  }

  list(userId: string): ProactiveRecommendation[] {
    return [...this.ownerMap(userId).values()].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  }

  get(userId: string, recommendationId: string): ProactiveRecommendation | undefined {
    return this.ownerMap(userId).get(recommendationId);
  }

  update(
    userId: string,
    recommendationId: string,
    patch: Partial<ProactiveRecommendation>,
  ): ProactiveRecommendation | undefined {
    const map = this.ownerMap(userId);
    const existing = map.get(recommendationId);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch };
    map.set(recommendationId, updated);
    return updated;
  }

  delete(userId: string, recommendationId: string): void {
    this.ownerMap(userId).delete(recommendationId);
  }
}
