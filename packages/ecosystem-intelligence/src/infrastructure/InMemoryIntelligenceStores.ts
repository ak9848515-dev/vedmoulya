// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ecosystem-intelligence
// InMemoryIntelligenceStores — EPIC-015
//
// Owner-scoped stores. Every lookup is keyed by (userId, id) — IDOR
// is impossible by construction: a foreign userId can never address
// another user's records.
// ──────────────────────────────────────────────────────────────────

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

interface RecommendationRecord {
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

export class InMemoryGitHubConnectionStore implements GitHubConnectionStore {
  private readonly byUser = new Map<string, GitHubConnection>();
  save(connection: GitHubConnection): void {
    this.byUser.set(connection.userId, connection);
  }
  get(userId: string): GitHubConnection | undefined {
    return this.byUser.get(userId);
  }
}

export class InMemoryLifecycleStore implements LifecycleStore {
  private readonly byUser = new Map<string, Map<string, LifecycleRecord>>();

  private userMap(userId: string): Map<string, LifecycleRecord> {
    let map = this.byUser.get(userId);
    if (!map) {
      map = new Map();
      this.byUser.set(userId, map);
    }
    return map;
  }

  save(userId: string, record: LifecycleRecord): void {
    this.userMap(userId).set(record.resourceId, record);
  }

  get(userId: string, resourceId: string): LifecycleRecord | undefined {
    return this.byUser.get(userId)?.get(resourceId);
  }

  list(userId: string): LifecycleRecord[] {
    return [...(this.byUser.get(userId)?.values() ?? [])];
  }
}

export class InMemoryRecommendationStore implements RecommendationStore {
  private readonly byUser = new Map<string, Map<string, RecommendationRecord>>();

  private userMap(userId: string): Map<string, RecommendationRecord> {
    let map = this.byUser.get(userId);
    if (!map) {
      map = new Map();
      this.byUser.set(userId, map);
    }
    return map;
  }

  save(userId: string, recommendation: RecommendationRecord): void {
    this.userMap(userId).set(recommendation.id, recommendation);
  }

  get(userId: string, id: string): RecommendationRecord | undefined {
    return this.byUser.get(userId)?.get(id);
  }

  list(userId: string): RecommendationRecord[] {
    return [...(this.byUser.get(userId)?.values() ?? [])];
  }

  mark(userId: string, id: string, state: RecommendationRecord['state']): void {
    const record = this.byUser.get(userId)?.get(id);
    if (record) record.state = state;
  }
}

export class InMemoryNotificationStore implements NotificationStore {
  private readonly byUser = new Map<string, Map<string, IntelligenceNotification>>();
  private readonly readByUser = new Map<string, Set<string>>();

  private userMap(userId: string): Map<string, IntelligenceNotification> {
    let map = this.byUser.get(userId);
    if (!map) {
      map = new Map();
      this.byUser.set(userId, map);
    }
    return map;
  }

  save(userId: string, notification: IntelligenceNotification): void {
    this.userMap(userId).set(notification.id, notification);
  }

  list(userId: string): IntelligenceNotification[] {
    const items = [...(this.byUser.get(userId)?.values() ?? [])];
    return items.map((n) => ({ ...n, read: this.readByUser.get(userId)?.has(n.id) ?? false }));
  }

  markRead(userId: string, id: string): void {
    let set = this.readByUser.get(userId);
    if (!set) {
      set = new Set();
      this.readByUser.set(userId, set);
    }
    set.add(id);
  }
}

export class InMemoryAcquisitionStore implements AcquisitionStore {
  private readonly byUser = new Map<string, Map<string, AcquisitionRecord>>();

  private userMap(userId: string): Map<string, AcquisitionRecord> {
    let map = this.byUser.get(userId);
    if (!map) {
      map = new Map();
      this.byUser.set(userId, map);
    }
    return map;
  }

  save(userId: string, plan: AcquisitionRecord): void {
    this.userMap(userId).set(plan.repository.toLowerCase(), plan);
  }

  get(userId: string, repository: string): AcquisitionRecord | undefined {
    return this.byUser.get(userId)?.get(repository.toLowerCase());
  }

  mark(userId: string, repository: string, state: string): void {
    const record = this.byUser.get(userId)?.get(repository.toLowerCase());
    if (record) record.state = state;
  }
}
