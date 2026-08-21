// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Control Plane · InMemoryControlStores
// SPRINT-031 — deterministic in-memory backend (dev/test convention). All
// stores are owner-scoped; documents are settings/stop-state/lifecycle
// records — never secrets.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AutonomySettings,
  EmergencyStopState,
  OpportunityLifecycleRecord,
} from '../types/control-types.js';
import type { ControlStores } from '../contracts/control-ports.js';

export class InMemoryControlStores implements ControlStores {
  readonly settings: ControlStores['settings'];
  readonly emergencyStop: ControlStores['emergencyStop'];
  readonly opportunities: ControlStores['opportunities'];

  constructor() {
    const settingsMap = new Map<string, AutonomySettings>();
    const stopMap = new Map<string, EmergencyStopState>();
    const oppMap = new Map<string, OpportunityLifecycleRecord>();

    this.settings = {
      get: (ownerId): AutonomySettings | undefined => settingsMap.get(ownerId),
      save: (s): void => {
        settingsMap.set(s.ownerId, s);
      },
    };

    this.emergencyStop = {
      get: (ownerId): EmergencyStopState | undefined => stopMap.get(ownerId),
      save: (s): void => {
        stopMap.set(s.ownerId, s);
      },
    };

    this.opportunities = {
      save: (r): void => {
        oppMap.set(`${r.ownerId}:${r.id}`, r);
      },
      get: (ownerId, id): OpportunityLifecycleRecord | undefined => oppMap.get(`${ownerId}:${id}`),
      getByKey: (ownerId, stableKey): OpportunityLifecycleRecord | undefined =>
        [...oppMap.values()].find((r) => r.ownerId === ownerId && r.stableKey === stableKey),
      list: (ownerId): OpportunityLifecycleRecord[] =>
        [...oppMap.values()]
          .filter((r) => r.ownerId === ownerId)
          .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    };
  }
}
