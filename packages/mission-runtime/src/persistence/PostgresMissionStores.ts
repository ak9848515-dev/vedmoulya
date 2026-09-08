// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Durable Mission Persistence (BLD-022)
//
// Postgres-backed MissionStore + CheckpointStore on the EXISTING
// @vedmoulya/core WriteThroughDocumentStore infrastructure — the same
// storage base as every enterprise intelligence store (sync mirror +
// idempotent parameterized write-through + boot hydrate + shutdown
// flush). NO new database, NO second memory system:
//   - one generic JSONB table per store, PRIMARY KEY (owner, key)
//   - owner isolation enforced BY QUERY construction
//   - every value parameterized (SQL injection impossible by design)
//   - documents are plain mission state — never secrets
//   - checkpoint retention is bounded per mission (crash-safe recovery
//     window, never an unbounded sink)
// All writes are idempotent upserts; recovery reads the LATEST verified
// checkpoint per mission.
// ──────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import type { JSONValue } from 'postgres';
import { WriteThroughDocumentStore } from '@vedmoulya/core';
import type { CheckpointStore, MissionStore } from '@vedmoulya/mission-controller';
import type { Mission, MissionCheckpoint, MissionObjective } from '@vedmoulya/mission-controller';
import { MISSION_TERMINAL_STATES } from '@vedmoulya/mission-controller';

export const MISSIONS_TABLE = 'mission_controller_missions';
export const CHECKPOINTS_TABLE = 'mission_controller_checkpoints';

/** Mission rows live under a single runtime owner, keyed by mission id. */
const OWNER = 'mission-controller';
const MAX_CHECKPOINTS_PER_MISSION = 50;

/** The base store's driver type (same convention as every EI store). */
type Sql = postgres.Sql;

export class PostgresMissionStore
  extends WriteThroughDocumentStore<Mission>
  implements MissionStore
{
  private readonly database: Sql;

  constructor(sql: Sql, table: string = MISSIONS_TABLE) {
    super(sql, table);
    this.database = sql;
  }

  async save(mission: Mission): Promise<void> {
    this.write(OWNER, mission.missionId, mission);
  }

  async get(missionId: string): Promise<Mission | undefined> {
    return this.read(OWNER, missionId);
  }

  getSync(missionId: string): Mission | undefined {
    return this.read(OWNER, missionId);
  }

  async listByUserId(userId: string): Promise<Mission[]> {
    return this.all(OWNER).filter((mission) => mission.userId === userId);
  }

  async listActive(): Promise<Mission[]> {
    return this.all(OWNER).filter(
      (mission) => !(MISSION_TERMINAL_STATES as readonly string[]).includes(mission.state),
    );
  }

  /**
   * Cross-process lease acquisition. The row lock makes the read/check/write
   * one atomic operation; a second worker sees the already-RUNNING objective
   * and loses without executing any unsafe work.
   */
  async acquireObjectiveLease(
    missionId: string,
    objectiveId: string,
    lease: NonNullable<MissionObjective['lease']>,
  ): Promise<Mission | undefined> {
    await this.flush();
    const acquired = await this.database.begin(async (tx) => {
      const rows = await tx<Array<{ doc: string }>>`
        SELECT doc::text AS doc
        FROM ${tx(this.tableName)}
        WHERE owner = ${OWNER} AND key = ${missionId}
        FOR UPDATE
      `;
      const row = rows[0];
      if (!row) return undefined;
      const mission = JSON.parse(row.doc) as Mission;
      const objective = mission.objectives.find(
        (candidate) => candidate.objectiveId === objectiveId,
      );
      if (!objective || !['PENDING', 'READY'].includes(objective.state)) return undefined;
      const now = new Date().toISOString();
      objective.state = 'RUNNING';
      objective.stateHistory.push('RUNNING');
      objective.lease = lease;
      objective.startedAt = objective.startedAt ?? lease.acquiredAt;
      objective.updatedAt = now;
      mission.updatedAt = now;
      await tx`
        UPDATE ${tx(this.tableName)}
        SET doc = ${tx.json(mission as unknown as JSONValue)}
        WHERE owner = ${OWNER} AND key = ${missionId}
      `;
      return mission;
    });
    if (acquired) this.write(OWNER, missionId, acquired);
    return acquired;
  }
}

export class PostgresCheckpointStore
  extends WriteThroughDocumentStore<MissionCheckpoint>
  implements CheckpointStore
{
  constructor(sql: Sql, table: string = CHECKPOINTS_TABLE) {
    super(sql, table);
  }

  async save(checkpoint: MissionCheckpoint): Promise<void> {
    this.write(OWNER, checkpoint.checkpointId, checkpoint);
    this.pruneMissionCheckpoints(checkpoint.missionId);
  }

  async getLatestForMission(missionId: string): Promise<MissionCheckpoint | undefined> {
    const list = this.listForMissionSync(missionId);
    return list[list.length - 1];
  }

  async listForMission(missionId: string): Promise<MissionCheckpoint[]> {
    return this.listForMissionSync(missionId);
  }

  private listForMissionSync(missionId: string): MissionCheckpoint[] {
    return this.all(OWNER)
      .filter((checkpoint) => checkpoint.missionId === missionId)
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  }

  /** Bounded FIFO retention per mission (never an unbounded sink). */
  private pruneMissionCheckpoints(missionId: string): void {
    const ordered = this.listForMissionSync(missionId);
    if (ordered.length <= MAX_CHECKPOINTS_PER_MISSION) return;
    const excess = ordered.slice(0, ordered.length - MAX_CHECKPOINTS_PER_MISSION);
    for (const evicted of excess) {
      this.remove(OWNER, evicted.checkpointId);
    }
  }
}

/**
 * Boot the durable mission persistence: ensure both tables exist and
 * hydrate the mirrors. Returns the stores ready for the composition.
 */
export async function ensureMissionPersistence(sql: Sql): Promise<{
  missions: PostgresMissionStore;
  checkpoints: PostgresCheckpointStore;
}> {
  const missions = new PostgresMissionStore(sql);
  const checkpoints = new PostgresCheckpointStore(sql);
  await missions.ensureTable();
  await checkpoints.ensureTable();
  await missions.hydrate();
  await checkpoints.hydrate();
  return { missions, checkpoints };
}
