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
  OpportunityMissionLaunchIntent,
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
  extends WriteThroughDocumentStore<OpportunityMissionLaunchIntent>
  implements OpportunityMissionLinkStore
{
  constructor(sql: postgres.Sql, table = 'control_opportunity_mission_links') {
    super(sql, table);
  }

  save(link: OpportunityMissionAssociation): OpportunityMissionAssociation {
    const existing = this.read(link.userId, link.opportunityId);
    if (existing) return existing;
    const linked = { ...link, status: 'LINKED' as const };
    this.write(link.userId, link.opportunityId, linked);
    return linked;
  }

  async claimLaunch(
    intent: OpportunityMissionAssociation,
  ): Promise<OpportunityMissionLaunchIntent> {
    const key = intent.opportunityId;
    const pending = { ...intent, status: 'PENDING' as const };
    const rows = await this.sql<Array<{ doc: OpportunityMissionLaunchIntent }>>`
      INSERT INTO ${this.sql(this.tableName)} (owner, key, doc)
      VALUES (${intent.userId}, ${key}, ${this.sql.json(pending)})
      ON CONFLICT (owner, key) DO NOTHING
      RETURNING doc
    `;
    if (rows[0]?.doc) return this.remember(intent.userId, key, rows[0].doc);
    const existingRows = await this.sql<Array<{ doc: OpportunityMissionLaunchIntent }>>`
      SELECT doc FROM ${this.sql(this.tableName)} WHERE owner = ${intent.userId} AND key = ${key} FOR UPDATE
    `;
    const existing = existingRows[0]?.doc ?? this.read(intent.userId, key);
    if (!existing) throw new Error('Launch intent could not be read after claim.');
    const normalized = (
      typeof existing === 'string' ? JSON.parse(existing) : existing
    ) as OpportunityMissionLaunchIntent;
    return this.remember(
      intent.userId,
      key,
      'status' in normalized ? normalized : Object.assign({}, normalized, { status: 'LINKED' }),
    );
  }

  async completeLaunch(
    link: OpportunityMissionAssociation,
  ): Promise<OpportunityMissionAssociation> {
    const key = link.opportunityId;
    const rows = await this.sql<Array<{ doc: OpportunityMissionLaunchIntent }>>`
      UPDATE ${this.sql(this.tableName)} SET doc = ${this.sql.json({ ...link, status: 'LINKED' })}, updated_at = now()
      WHERE owner = ${link.userId} AND key = ${key}
        AND doc->>'missionId' = ${link.missionId}
      RETURNING doc
    `;
    if (rows[0]?.doc) return this.remember(link.userId, key, rows[0].doc);
    const existing = this.read(link.userId, key);
    if (existing?.status === 'LINKED' && existing.missionId === link.missionId) return existing;
    throw new Error('Launch intent is missing or Mission ID does not match.');
  }

  getLaunch(userId: string, opportunityId: string): OpportunityMissionLaunchIntent | undefined {
    const row = this.read(userId, opportunityId);
    return row
      ? 'status' in row
        ? row
        : { ...(row as OpportunityMissionAssociation), status: 'LINKED' }
      : undefined;
  }

  getByOpportunity(
    userId: string,
    opportunityId: string,
  ): OpportunityMissionAssociation | undefined {
    const row = this.getLaunch(userId, opportunityId);
    return row?.status === 'LINKED' ? row : undefined;
  }

  getByMission(userId: string, missionId: string): OpportunityMissionAssociation | undefined {
    return this.all(userId).find((l) => l.status === 'LINKED' && l.missionId === missionId);
  }

  list(userId: string): OpportunityMissionAssociation[] {
    return this.all(userId)
      .filter((l) => l.status === 'LINKED')
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
}
