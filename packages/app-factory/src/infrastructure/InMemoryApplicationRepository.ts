// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: In-Memory Application Repository
// EPIC-008 — Phase 1. Hermetic test/dev double for the persistence
// seam. Mirrors the Postgres repository contract exactly (async,
// owner-scoped listing, full-document round-trip) so the engine is
// persistence-agnostic.
// ──────────────────────────────────────────────────────────────────

import type { AppProject } from '../types/app-types.js';
import type { ApplicationProjectRepository } from '../contracts/application-repository.js';

export class InMemoryApplicationRepository implements ApplicationProjectRepository {
  private readonly projects = new Map<string, AppProject>();

  save(project: AppProject): Promise<void> {
    this.projects.set(project.applicationId, structuredClone(project));
    return Promise.resolve();
  }

  get(applicationId: string): Promise<AppProject | undefined> {
    const project = this.projects.get(applicationId);
    return Promise.resolve(project ? structuredClone(project) : undefined);
  }

  list(owner?: string): Promise<AppProject[]> {
    const all = Array.from(this.projects.values()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    const filtered = owner ? all.filter((p) => p.owner === owner) : all;
    return Promise.resolve(filtered.map((p) => structuredClone(p)));
  }

  delete(applicationId: string): Promise<boolean> {
    return Promise.resolve(this.projects.delete(applicationId));
  }
}
