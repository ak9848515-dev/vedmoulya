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
  OpportunityMissionAssociation,
} from '../types/control-types.js';
import type { ControlStores } from '../contracts/control-ports.js';

export class InMemoryControlStores implements ControlStores {
  readonly settings: ControlStores['settings'];
  readonly emergencyStop: ControlStores['emergencyStop'];
  readonly opportunities: ControlStores['opportunities'];
  readonly opportunityMissionLinks: ControlStores['opportunityMissionLinks'];

  constructor() {
    const settingsMap = new Map<string, AutonomySettings>();
    const stopMap = new Map<string, EmergencyStopState>();
    const oppMap = new Map<string, OpportunityLifecycleRecord>();
    const linkMap = new Map<string, OpportunityMissionAssociation>();

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

    // S5.1 — owner-scoped association store, idempotent by opportunityId.
    this.opportunityMissionLinks = {
      save: (link): OpportunityMissionAssociation => {
        const key = `${link.userId}:${link.opportunityId}`;
        const existing = linkMap.get(key);
        if (existing) return existing;
        linkMap.set(key, link);
        return link;
      },
      getByOpportunity: (userId, opportunityId) => linkMap.get(`${userId}:${opportunityId}`),
      getByMission: (userId, missionId) =>
        [...linkMap.values()].find((l) => l.userId === userId && l.missionId === missionId),
      list: (userId) =>
        [...linkMap.values()]
          .filter((l) => l.userId === userId)
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    };
  }
}
