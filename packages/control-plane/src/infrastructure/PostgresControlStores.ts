// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Control Plane · PostgresControlStores
// SPRINT-031 — durable owner-scoped stores over the shared @vedmoulya/core
// WriteThroughDocumentStore base (sync mirror + async idempotent write-through
// + boot hydrate + shutdown flush). Owner isolation by query construction
// (PRIMARY KEY (owner, key)). Documents are settings / stop-state / lifecycle
// records — never secrets.
// ─────────────────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import { WriteThroughDocumentStore } from '@vedmoulya/core';
import type {
  AutonomySettings,
  EmergencyStopState,
  OpportunityLifecycleRecord,
  OpportunityMissionAssociation,
  OpportunityMissionLinkStore,
} from '../types/control-types.js';

interface SettingsStoreSeam {
  get(ownerId: string): AutonomySettings | undefined;
  save(settings: AutonomySettings): void;
}
interface EmergencyStopStoreSeam {
  get(ownerId: string): EmergencyStopState | undefined;
  save(state: EmergencyStopState): void;
}
interface OpportunityStoreSeam {
  save(record: OpportunityLifecycleRecord): void;
  get(ownerId: string, id: string): OpportunityLifecycleRecord | undefined;
  getByKey(ownerId: string, stableKey: string): OpportunityLifecycleRecord | undefined;
  list(ownerId: string): OpportunityLifecycleRecord[];
}

/** Owner-scoped settings — one document per owner (key 'settings'). */
export class PostgresSettingsStore
  extends WriteThroughDocumentStore<AutonomySettings>
  implements SettingsStoreSeam
{
  constructor(sql: postgres.Sql, table = 'control_settings') {
    super(sql, table);
  }

  get(ownerId: string): AutonomySettings | undefined {
    return this.read(ownerId, 'settings');
  }

  save(settings: AutonomySettings): void {
    this.write(settings.ownerId, 'settings', settings);
  }
}

/** Owner-scoped emergency-stop state — one document per owner. */
export class PostgresEmergencyStopStore
  extends WriteThroughDocumentStore<EmergencyStopState>
  implements EmergencyStopStoreSeam
{
  constructor(sql: postgres.Sql, table = 'control_emergency_stops') {
    super(sql, table);
  }

  get(ownerId: string): EmergencyStopState | undefined {
    return this.read(ownerId, 'stop');
  }

  save(state: EmergencyStopState): void {
    this.write(state.ownerId, 'stop', state);
  }
}

/** Owner-scoped opportunity lifecycle records — keyed (owner, id). */
export class PostgresOpportunityStore
  extends WriteThroughDocumentStore<OpportunityLifecycleRecord>
  implements OpportunityStoreSeam
{
  constructor(sql: postgres.Sql, table = 'control_opportunities') {
    super(sql, table);
  }

  save(record: OpportunityLifecycleRecord): void {
    this.write(record.ownerId, record.id, record);
  }

  get(ownerId: string, id: string): OpportunityLifecycleRecord | undefined {
    return this.read(ownerId, id);
  }

  getByKey(ownerId: string, stableKey: string): OpportunityLifecycleRecord | undefined {
    return this.all(ownerId).find((r) => r.stableKey === stableKey);
  }

  list(ownerId: string): OpportunityLifecycleRecord[] {
    return this.all(ownerId).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
}

/** Owner-scoped Opportunity ↔ Mission associations — keyed (user, opportunityId).
 *  Idempotent by construction: `save` returns the existing link instead of
 *  writing a second one, so a retried handoff can never duplicate a Mission. */
export class PostgresOpportunityMissionLinkStore
  extends WriteThroughDocumentStore<OpportunityMissionAssociation>
  implements OpportunityMissionLinkStore
{
  constructor(sql: postgres.Sql, table = 'control_opportunity_mission_links') {
    super(sql, table);
  }

  save(link: OpportunityMissionAssociation): OpportunityMissionAssociation {
    const existing = this.read(link.userId, link.opportunityId);
    if (existing) return existing;
    this.write(link.userId, link.opportunityId, link);
    return link;
  }

  getByOpportunity(
    userId: string,
    opportunityId: string,
  ): OpportunityMissionAssociation | undefined {
    return this.read(userId, opportunityId);
  }

  getByMission(userId: string, missionId: string): OpportunityMissionAssociation | undefined {
    return this.all(userId).find((l) => l.missionId === missionId);
  }

  list(userId: string): OpportunityMissionAssociation[] {
    return this.all(userId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
}
