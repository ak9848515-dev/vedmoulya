// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Dashboard
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// Aggregates the OS dashboard payload: the live system health plus
// the latest persisted snapshot and the snapshot history (the OS
// health score trend).
// ──────────────────────────────────────────────────────────────────

import type { OSDashboardData, OSHealthSnapshot, OSSystemHealth } from '../../types/os-types.js';

export class OSDashboardService {
  /** Build the dashboard payload from a health pass + snapshot history. */
  dashboard(health: OSSystemHealth, snapshots: readonly OSHealthSnapshot[]): OSDashboardData {
    const sorted = [...snapshots].sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
    return {
      health,
      latestSnapshot: sorted[0],
      snapshotHistory: sorted,
    };
  }
}
