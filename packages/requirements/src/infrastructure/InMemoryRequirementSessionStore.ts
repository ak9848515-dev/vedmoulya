// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: In-Memory Session Store
// EPIC-009 — hermetic test/dev double for the persistence seam.
// Mirrors the Postgres store contract exactly (async, owner-scoped
// listing, deep-cloned documents) so the engine is persistence-agnostic.
// ──────────────────────────────────────────────────────────────────

import type { RequirementSession } from '../types/requirement-types.js';
import type { RequirementSessionStore } from '../contracts/requirement-ports.js';

export class InMemoryRequirementSessionStore implements RequirementSessionStore {
  private readonly sessions = new Map<string, RequirementSession>();

  save(session: RequirementSession): Promise<void> {
    this.sessions.set(session.sessionId, structuredClone(session));
    return Promise.resolve();
  }

  get(sessionId: string): Promise<RequirementSession | undefined> {
    const session = this.sessions.get(sessionId);
    return Promise.resolve(session ? structuredClone(session) : undefined);
  }

  list(owner?: string): Promise<RequirementSession[]> {
    const all = Array.from(this.sessions.values()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    const filtered = owner ? all.filter((s) => s.owner === owner) : all;
    return Promise.resolve(filtered.map((s) => structuredClone(s)));
  }

  delete(sessionId: string): Promise<boolean> {
    return Promise.resolve(this.sessions.delete(sessionId));
  }
}
