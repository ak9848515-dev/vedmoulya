// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Proactive Intelligence · PostgresProactiveStore
// SPRINT-029 — durable owner-scoped recommendation store over the shared
// @vedmoulya/core WriteThroughDocumentStore base (sync mirror + async
// idempotent write-through + boot hydrate + shutdown flush). Owner isolation
// by query construction (PRIMARY KEY (owner, key)). Recommendations are
// interaction artifacts — never secrets, never auto-promoted.
// ─────────────────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import { WriteThroughDocumentStore } from '@vedmoulya/core';
import type { ProactiveRecommendation } from '../types/proactive-types.js';
import type { ProactiveRecommendationStore } from '../contracts/proactive-ports.js';

export class PostgresProactiveStore
  extends WriteThroughDocumentStore<ProactiveRecommendation>
  implements ProactiveRecommendationStore
{
  constructor(sql: postgres.Sql, table = 'proactive_recommendations') {
    super(sql, table);
  }

  save(recommendation: ProactiveRecommendation): void {
    this.write(recommendation.ownerId, recommendation.id, recommendation);
  }

  saveWithKey(key: string, recommendation: ProactiveRecommendation): void {
    // Deterministic id from the stable key — idempotent upsert.
    this.save({ ...recommendation, id: this.idFromKey(key) });
  }

  list(userId: string): ProactiveRecommendation[] {
    return this.all(userId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  get(userId: string, recommendationId: string): ProactiveRecommendation | undefined {
    return this.read(userId, recommendationId);
  }

  update(
    userId: string,
    recommendationId: string,
    patch: Partial<ProactiveRecommendation>,
  ): ProactiveRecommendation | undefined {
    const existing = this.read(userId, recommendationId);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch };
    this.save(updated);
    return updated;
  }

  delete(userId: string, recommendationId: string): void {
    this.remove(userId, recommendationId);
  }

  private idFromKey(key: string): string {
    // Deterministic (no random component) so re-refresh keeps the same row.
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    return `pr-${Math.abs(hash).toString(36)}`;
  }
}
