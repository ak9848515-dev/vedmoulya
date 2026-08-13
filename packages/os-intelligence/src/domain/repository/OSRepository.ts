// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Repository Contract
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// Persists OS health snapshots (the OS dashboard history). The
// InMemoryOSRepository is the hermetic test double; the
// PostgresOSRepository stores snapshots as JSONB documents in the
// `os_health_registry` table (migration ready via ensureTable).
// ──────────────────────────────────────────────────────────────────

import type { OSHealthSnapshot } from '../../types/os-types.js';

export interface OSRepository {
  saveSnapshot(snapshot: OSHealthSnapshot): Promise<void>;
  listSnapshots(limit?: number): Promise<OSHealthSnapshot[]>;
  countSnapshots(): Promise<number>;
  /** CREATE TABLE IF NOT EXISTS + indexes — migration ready. */
  ensureTable(): Promise<void>;
}
