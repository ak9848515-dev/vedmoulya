// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ecosystem-intelligence
// PostgresIntelligenceStores — SPRINT-022 — Persistent Intelligence
//
// Production persistence for the EPIC-015 owner-scoped stores, keeping
// the SAME synchronous ports. Write-through Postgres via the shared
// @vedmoulya/core WriteThroughDocumentStore base.
//
// SECURITY: the GitHubConnection document NEVER contains a token — the
// frozen contract explicitly forbids it ("Never store the access token
// here — server-side credential store only"), so nothing secret is ever
// serialized. Notification read-state is persisted beside each
// notification (idempotent upsert). Every query is owner-scoped +
// parameterized — IDOR/SQLi safe by construction. Notifications survive
// restart with their read-state intact (SPRINT-022 §12).
// ──────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import { WriteThroughDocumentStore } from '@vedmoulya/core';
import type {
  GitHubConnection,
  IntelligenceNotification,
  LifecycleRecord,
} from '../types/intelligence-types.js';
import type {
  AcquisitionStore,
  GitHubConnectionStore,
  LifecycleStore,
  NotificationStore,
  RecommendationStore,
} from '../contracts/intelligence-ports.js';

/** Bounded per-owner notification retention (SPRINT-022 §9). */
export const NOTIFICATIONS_PER_OWNER = 200;

export interface RecommendationRecord {
  id: string;
  kind: string;
  title: string;
  state: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'DISMISSED' | 'SUPPRESSED';
  createdAt: string;
}

interface AcquisitionRecord {
  repository: string;
  state: string;
  updatedAt: string;
}

/** Persisted notification wrapper: document + owner-scoped read state. */
interface NotificationDocument {
  notification: IntelligenceNotification;
  read: boolean;
}

function byUpdatedAt(a: { updatedAt: string }, b: { updatedAt: string }): number {
  return Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
}

function byCreatedAt(a: { createdAt: string }, b: { createdAt: string }): number {
  return Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

// ── GitHub connections (metadata only — NEVER tokens) ─────────────

/** One connection per user — keyed (userId, 'default'). */
export class PostgresGitHubConnectionStore
  extends WriteThroughDocumentStore<GitHubConnection>
  implements GitHubConnectionStore
{
  private static readonly KEY = 'default';

  constructor(sql: postgres.Sql, table = 'ecosystem_github_connections') {
    super(sql, table);
  }

  save(connection: GitHubConnection): void {
    this.write(connection.userId, PostgresGitHubConnectionStore.KEY, connection);
  }

  get(userId: string): GitHubConnection | undefined {
    return this.read(userId, PostgresGitHubConnectionStore.KEY);
  }
}

// ── Lifecycle records ─────────────────────────────────────────────

/** Owner-scoped lifecycle records — keyed (userId, resourceId). */
export class PostgresLifecycleStore
  extends WriteThroughDocumentStore<LifecycleRecord>
  implements LifecycleStore
{
  constructor(sql: postgres.Sql, table = 'ecosystem_lifecycle_records') {
    super(sql, table);
  }

  save(userId: string, record: LifecycleRecord): void {
    this.write(userId, record.resourceId, record);
  }

  get(userId: string, resourceId: string): LifecycleRecord | undefined {
    return this.read(userId, resourceId);
  }

  list(userId: string): LifecycleRecord[] {
    return this.all(userId).sort(byUpdatedAt);
  }
}

// ── Recommendations ───────────────────────────────────────────────

/** Owner-scoped recommendation records — keyed (userId, id). */
export class PostgresRecommendationStore
  extends WriteThroughDocumentStore<RecommendationRecord>
  implements RecommendationStore
{
  constructor(sql: postgres.Sql, table = 'ecosystem_recommendations') {
    super(sql, table);
  }

  save(userId: string, recommendation: RecommendationRecord): void {
    this.write(userId, recommendation.id, recommendation);
  }

  get(
    userId: string,
    id: string,
  ): { id: string; kind: string; title: string; state: string; createdAt: string } | undefined {
    return this.read(userId, id);
  }

  list(
    userId: string,
  ): Array<{ id: string; kind: string; title: string; state: string; createdAt: string }> {
    return this.all(userId).sort(byCreatedAt);
  }

  mark(userId: string, id: string, state: RecommendationRecord['state']): void {
    const existing = this.read(userId, id);
    if (!existing) return;
    this.write(userId, id, { ...existing, state });
  }
}

// ── Notifications (durable, read-state preserved) ─────────────────

/** Owner-scoped notifications — keyed (userId, id), bounded retention. */
export class PostgresNotificationStore
  extends WriteThroughDocumentStore<NotificationDocument>
  implements NotificationStore
{
  constructor(sql: postgres.Sql, table = 'ecosystem_notifications') {
    super(sql, table);
  }

  save(userId: string, notification: IntelligenceNotification): void {
    const existing = this.read(userId, notification.id);
    // Re-saving a notification preserves its read state (never resets it).
    const read = existing?.read ?? false;
    this.write(userId, notification.id, { notification, read });
    this.prune(
      userId,
      NOTIFICATIONS_PER_OWNER,
      (d) => d.notification.createdAt,
      (d) => d.notification.id,
    );
  }

  list(userId: string): IntelligenceNotification[] {
    return this.all(userId)
      .sort((a, b) => byCreatedAt(a.notification, b.notification))
      .map((d) => ({ ...d.notification, read: d.read }));
  }

  markRead(userId: string, id: string): void {
    const existing = this.read(userId, id);
    if (!existing) return;
    this.write(userId, id, { ...existing, read: true });
  }
}

// ── Repository acquisitions ───────────────────────────────────────

/** Owner-scoped acquisition plans — keyed (userId, repository-lowercased). */
export class PostgresAcquisitionStore
  extends WriteThroughDocumentStore<AcquisitionRecord>
  implements AcquisitionStore
{
  constructor(sql: postgres.Sql, table = 'ecosystem_acquisitions') {
    super(sql, table);
  }

  save(userId: string, plan: AcquisitionRecord): void {
    this.write(userId, plan.repository.toLowerCase(), plan);
  }

  get(userId: string, repository: string): AcquisitionRecord | undefined {
    return this.read(userId, repository.toLowerCase());
  }

  mark(userId: string, repository: string, state: string): void {
    const existing = this.read(userId, repository.toLowerCase());
    if (!existing) return;
    this.write(userId, repository.toLowerCase(), { ...existing, state });
  }
}
