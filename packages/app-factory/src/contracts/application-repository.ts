// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Application Project Repository
// EPIC-008 — Phase 1/2. Persistence seam for application projects.
// Application projects must survive page refresh, logout/login and
// server restart. The repository stores the FULL AppProject document
// (spec, architecture, blueprint, files, file operations, validation,
// security, economics, deployment, VCS history, version history) and
// is owner-scoped at the storage layer — `list(owner)` and ownership
// checks in the engine make cross-user access impossible by design.
// In-memory (hermetic) and Postgres (production) implementations.
// ──────────────────────────────────────────────────────────────────

import type { AppProject } from '../types/app-types.js';

export interface ApplicationProjectRepository {
  save(project: AppProject): Promise<void>;
  get(applicationId: string): Promise<AppProject | undefined>;
  /** Owner-scoped listing (all projects for one owner). */
  list(owner?: string): Promise<AppProject[]>;
  delete(applicationId: string): Promise<boolean>;
}
