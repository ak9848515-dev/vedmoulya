// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Application Registry
// EPIC-007 — Phase 13. Every generated application is registered with
// its application ID, owner, specification, blueprint, version,
// status, repository, technologies, AI capabilities, deployment
// status, health, last build, last validation, created/updated dates.
// Statuses: DRAFT → PLANNED → BUILDING → VALIDATING → READY →
// DEPLOYED / FAILED / ARCHIVED.
// ──────────────────────────────────────────────────────────────────

import { NotFoundError } from '@vedmoulya/core';
import type { AppProject, ApplicationStatus } from '../types/app-types.js';

export interface ApplicationRegistryPort {
  save(project: AppProject): void;
  get(applicationId: string): AppProject | undefined;
  list(owner?: string): AppProject[];
  delete(applicationId: string): boolean;
}

export class InMemoryApplicationRegistry implements ApplicationRegistryPort {
  private readonly projects = new Map<string, AppProject>();

  save(project: AppProject): void {
    this.projects.set(project.applicationId, project);
  }

  get(applicationId: string): AppProject | undefined {
    return this.projects.get(applicationId);
  }

  list(owner?: string): AppProject[] {
    const all = Array.from(this.projects.values()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    return owner ? all.filter((p) => p.owner === owner) : all;
  }

  delete(applicationId: string): boolean {
    return this.projects.delete(applicationId);
  }
}

export class ApplicationRegistry {
  constructor(private readonly port: ApplicationRegistryPort) {}

  register(project: AppProject): AppProject {
    this.port.save(project);
    return project;
  }

  get(applicationId: string): AppProject {
    const project = this.port.get(applicationId);
    if (!project) throw new NotFoundError('Application', applicationId);
    return project;
  }

  /** Owner-scoped read (IDOR protection at the registry level). */
  getOwned(applicationId: string, owner: string): AppProject {
    const project = this.get(applicationId);
    if (project.owner !== owner) throw new NotFoundError('Application', applicationId);
    return project;
  }

  list(owner?: string): AppProject[] {
    return this.port.list(owner);
  }

  update(applicationId: string, mutation: (project: AppProject) => AppProject): AppProject {
    const project = this.get(applicationId);
    const updated = mutation(project);
    updated.updatedAt = new Date().toISOString();
    this.port.save(updated);
    return updated;
  }

  setStatus(applicationId: string, status: ApplicationStatus): AppProject {
    return this.update(applicationId, (p) => ({ ...p, status }));
  }
}
