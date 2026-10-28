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
import { PostgresWorkspaceLeaseStore } from './PostgresWorkspaceLeaseStore.js';
import type { CheckpointStore, MissionStore } from '@vedmoulya/mission-controller';
import type {
  Mission,
  MissionActivityEvent,
  MissionCasSnapshot,
  MissionCheckpoint,
  MissionObjective,
  MissionObjectiveLease,
  MissionPatch,
  MissionPatchResult,
  MissionReplaceResult,
  ObjectiveLeaseRenewal,
  ObjectivePublication,
  ObjectivePublicationResult,
  RecoveryChangesResult,
  RecoveryObjectiveChange,
} from '@vedmoulya/mission-controller';
import {
  MISSION_TERMINAL_STATES,
  applyActivityToMission,
  applyMissionPatchToMission,
  applyPublicationToMission,
  applyRecoveryChangesToMission,
  hasOtherLiveLease,
  matchesMissionCas,
} from '@vedmoulya/mission-controller';

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

  async saveRequired(mission: Mission): Promise<void> {
    await this.flush();
    await this.writeThroughUpsert(OWNER, mission.missionId, mission);
    // Replace any failed/stale queued copy with the durable version. If a
    // previous best-effort flush could not reach Postgres, its old snapshot
    // must not overwrite this required write on a later retry.
    this.write(OWNER, mission.missionId, mission);
  }

  async createIfAbsent(mission: Mission): Promise<Mission> {
    const rows = await this.database<Array<{ doc: Mission }>>`
      INSERT INTO ${this.database(this.tableName)} (owner, key, doc)
      VALUES (${OWNER}, ${mission.missionId}, ${this.database.json(mission as unknown as JSONValue)})
      ON CONFLICT (owner, key) DO NOTHING
      RETURNING doc
    `;
    if (rows[0]?.doc) return this.remember(OWNER, mission.missionId, rows[0].doc);
    const existingRows = await this.database<Array<{ doc: Mission }>>`
      SELECT doc FROM ${this.database(this.tableName)} WHERE owner = ${OWNER} AND key = ${mission.missionId}
    `;
    const existing = existingRows[0]?.doc ?? this.read(OWNER, mission.missionId);
    if (!existing) throw new Error('Mission ID claim could not be read after insert conflict.');
    return this.remember(OWNER, mission.missionId, existing);
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
      // LEASE-03 — a terminal mission never starts new work: the cancellation
      // (or completion) is authoritative, even for an objective that is still
      // PENDING.
      if (isTerminalState(mission.state)) return undefined;
      const objective = mission.objectives.find(
        (candidate) => candidate.objectiveId === objectiveId,
      );
      if (!objective || !['PENDING', 'READY'].includes(objective.state)) return undefined;
      // LEASE-02 — one owner per MISSION: never start a second objective while
      // another objective of the same mission is still owned.
      if (hasOtherLiveLease(mission, objectiveId, lease.acquiredAt)) return undefined;
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
    // LEASE-03 — the transaction already persisted the authoritative row, so
    // refresh the mirror ONLY: enqueuing another whole-document upsert here
    // would let a delayed best-effort write land after a newer commit (a
    // renewal or another process's acquisition) and revert it.
    if (acquired) this.remember(OWNER, missionId, acquired);
    return acquired;
  }

  /**
   * LEASE-01 — ownership-checked lease RENEWAL, atomic against the authoritative
   * persisted document.
   *
   * The row lock (`SELECT … FOR UPDATE`) serialises renewal against acquisition
   * and healing, and the state/owner/token/expiry checks all happen INSIDE the
   * transaction on the durable copy — never on the (possibly stale) mirror.
   * Only `expiresAt` is extended, so a renewal can never resurrect a lease that
   * recovery already released or steal one that another execution acquired.
   * The mirror is refreshed only after the durable write committed, and with the
   * committed document itself (`remember`) rather than a queued whole-document
   * write, so a renewal never re-publishes an older snapshot.
   */
  async renewObjectiveLease(
    missionId: string,
    objectiveId: string,
    renewal: ObjectiveLeaseRenewal,
  ): Promise<MissionObjectiveLease | undefined> {
    // ── LEASE-DEADLINE — DO NOT DRAIN THE SHARED WRITE QUEUE HERE. ────────
    //    This used to `await this.flush()` first, to keep an older queued
    //    snapshot from landing after the renewal. That made the renewal's 5 s
    //    budget wait behind EVERY queued best-effort write — and during
    //    autonomous work the queue is never empty (each `save()` enqueues a
    //    whole mission document, drained ONE AT A TIME). Measured: a queued
    //    write held for 1.2 s delayed the renewal by >1.1 s although the
    //    renewal statement itself costs ~0 ms. That is the reported
    //    "renewal did not settle within 5000 ms" → OBJECTIVE_LEASE_LOST.
    //
    //    The drain was never needed for correctness. The row lock below is what
    //    orders the renewal against queued upserts of the SAME row: an upsert
    //    that already took the lock commits first (and then a queued OLDER
    //    snapshot can no longer exist — `saveRequired`/`remember` supersede the
    //    queue entry, and the upsert writes the LATEST version for its key); an
    //    upsert that has not started yet simply waits for this transaction and
    //    then writes its own document. Losing the wait removes a serialization
    //    point without removing an ownership check: every state/owner/token/
    //    expiry validation below still runs INSIDE the lock on the durable row.
    const renewed = await this.database.begin(async (tx) => {
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
      if (!objective || objective.state !== 'RUNNING') return undefined;
      const current = objective.lease;
      if (!current || !sameLeaseAcquisition(current, renewal)) return undefined;
      // A lease that already EXPIRED is not renewable: recovery may already own
      // the decision, and a late renewal must never reclaim authority.
      if (Date.parse(current.expiresAt) <= renewal.nowMs) return undefined;

      const extended: MissionObjectiveLease = { ...current, expiresAt: renewal.expiresAt };
      const now = new Date(renewal.nowMs).toISOString();
      objective.lease = extended;
      objective.updatedAt = now;
      mission.updatedAt = now;
      await tx`
        UPDATE ${tx(this.tableName)}
        SET doc = ${tx.json(mission as unknown as JSONValue)}, updated_at = now()
        WHERE owner = ${OWNER} AND key = ${missionId}
      `;
      return { mission, lease: extended };
    });
    if (!renewed) return undefined;
    this.remember(OWNER, missionId, renewed.mission);
    return renewed.lease;
  }

  /**
   * LEASE-01 — FENCING read against the authoritative row (see the port).
   * Deliberately lock-free: it answers a question, it never mutates.
   */
  async holdsObjectiveLease(
    missionId: string,
    objectiveId: string,
    acquisition: { owner: string; token: string },
  ): Promise<boolean> {
    return readObjectiveAcquisition(
      this.database,
      this.tableName,
      missionId,
      objectiveId,
      acquisition,
    );
  }

  /**
   * LEASE-01 — atomically heal ONE abandoned RUNNING objective back to READY.
   *
   * The liveness re-check and the READY write happen under the SAME row lock, so
   * a renewal (or a fresh acquisition) that lands in between makes this a no-op
   * instead of resetting a working objective. Returns `undefined` when the heal
   * was refused, so recovery adopts the authoritative record.
   */
  async releaseExpiredObjectiveLease(
    missionId: string,
    objectiveId: string,
    options: { nowMs: number; failureReason: string },
  ): Promise<Mission | undefined> {
    await this.flush();
    const outcome = await this.withLockedMission(missionId, (mission) => {
      // LEASE-03 — a terminal mission is never healed: the cancellation (or any
      // other terminal decision) wins over a recovery observation, and this
      // check runs under the SAME row lock as the write.
      if (isTerminalState(mission.state)) return undefined;
      const objective = mission.objectives.find(
        (candidate) => candidate.objectiveId === objectiveId,
      );
      if (!objective || objective.state !== 'RUNNING') return undefined;
      const lease = objective.lease;
      if (lease && Date.parse(lease.expiresAt) > options.nowMs) return undefined; // a live owner
      const now = new Date(options.nowMs).toISOString();
      objective.state = 'READY';
      objective.stateHistory.push('READY');
      objective.lease = undefined;
      if (!objective.failureReason) objective.failureReason = options.failureReason;
      objective.updatedAt = now;
      mission.updatedAt = now;
      return { value: true };
    });
    return outcome?.value === true ? outcome.mission : undefined;
  }

  /**
   * LEASE-02/03 — run `work` against the AUTHORITATIVE document under the row
   * lock. `work` returns `undefined` to leave the row untouched; it may also
   * return a REPLACEMENT document (`write`), which is how a conditional
   * whole-document write (`replaceMissionIfUnchanged`) stays inside the same
   * transaction as its authority check. The caller always gets the
   * authoritative mission back. The mirror is refreshed only AFTER commit.
   */
  private async withLockedMission<R>(
    missionId: string,
    work: (mission: Mission) => { value: R; write?: Mission } | undefined,
  ): Promise<{ value: R | undefined; mission: Mission } | undefined> {
    const outcome = await this.database.begin(async (tx) => {
      const rows = await tx<Array<{ doc: string }>>`
        SELECT doc::text AS doc
        FROM ${tx(this.tableName)}
        WHERE owner = ${OWNER} AND key = ${missionId}
        FOR UPDATE
      `;
      const row = rows[0];
      if (!row) return undefined;
      const mission = JSON.parse(row.doc) as Mission;
      const outcomeOfWork = work(mission);
      if (outcomeOfWork === undefined) return { mission, value: undefined };
      const next = outcomeOfWork.write ?? mission;
      await tx`
        UPDATE ${tx(this.tableName)}
        SET doc = ${tx.json(next as unknown as JSONValue)}, updated_at = now()
        WHERE owner = ${OWNER} AND key = ${missionId}
      `;
      return { mission: next, value: outcomeOfWork.value };
    });
    if (!outcome) return undefined;
    this.remember(OWNER, missionId, outcome.mission);
    return outcome;
  }

  /**
   * LEASE-02 — ownership-checked, OBJECTIVE-scoped publication.
   *
   * Ownership, the objective state and the mission's terminal status are
   * validated inside the SAME row-locked transaction that writes the result, so
   * there is no window between "I still own it" and the write. A superseded
   * execution receives `applied: false` together with the authoritative mission
   * and never overwrites a newer lease, result or activity history.
   */
  async finalizeObjectiveIfLeaseOwner(
    missionId: string,
    objectiveId: string,
    acquisition: { owner: string; token: string },
    publication: ObjectivePublication,
  ): Promise<ObjectivePublicationResult | undefined> {
    // Drain queued best-effort writes first so an older whole-document snapshot
    // cannot land after (and overwrite) this committed publication.
    await this.flush();
    const outcome = await this.withLockedMission(missionId, (mission) => {
      const index = mission.objectives.findIndex(
        (candidate) => candidate.objectiveId === objectiveId,
      );
      // eslint-disable-next-line security/detect-object-injection -- Index produced by findIndex on the same bounded objectives array.
      const current = index >= 0 ? mission.objectives[index] : undefined;
      const owns =
        current !== undefined &&
        current.state === 'RUNNING' &&
        current.lease?.token !== undefined &&
        current.lease.owner === acquisition.owner &&
        current.lease.token === acquisition.token;
      if (!owns || isTerminalState(mission.state)) {
        return { value: { applied: false } };
      }
      applyPublicationToMission(mission, index, current.lease, publication);
      return { value: { applied: true } };
    });
    if (!outcome) return undefined;
    return { applied: outcome.value?.applied === true, mission: outcome.mission };
  }

  /**
   * LEASE-02 — conditional recovery publication. Changes whose observed state
   * (state + lease token + expiration) no longer matches are skipped, so a
   * renewal or a fresh acquisition is never reverted by a recovery pass.
   */
  async applyRecoveryChanges(
    missionId: string,
    changes: RecoveryObjectiveChange[],
    options: { nowMs: number; activity?: MissionActivityEvent[]; activityLimit?: number },
  ): Promise<RecoveryChangesResult | undefined> {
    await this.flush();
    const outcome = await this.withLockedMission(missionId, (mission) => ({
      value: applyRecoveryChangesToMission(mission, changes, options),
    }));
    if (!outcome || !outcome.value) return undefined;
    return {
      applied: outcome.value.applied,
      skipped: outcome.value.skipped,
      mission: outcome.mission,
    };
  }

  /** LEASE-02 — merge-only activity append (never reverts any state). */
  async appendActivity(
    missionId: string,
    events: MissionActivityEvent[],
    options?: { limit?: number; at?: string },
  ): Promise<Mission | undefined> {
    const outcome = await this.withLockedMission(missionId, (mission) => {
      // LEASE-03 — a terminal mission still accepts merge-only history (it is
      // never reverted by it), but nothing here may change its state.
      applyActivityToMission(mission, events, options?.limit);
      if (options?.at !== undefined && !isTerminalState(mission.state)) {
        mission.updatedAt = options.at;
      }
      return { value: true };
    });
    return outcome?.mission;
  }

  /**
   * LEASE-02 — optimistic mission-level patch. Refused when the persisted state
   * moved on, or (for a terminal acknowledgement) while any objective is still
   * RUNNING. It never rewrites objectives, checkpoints or usage accounting.
   */
  async patchMission(
    missionId: string,
    patch: MissionPatch,
  ): Promise<MissionPatchResult | undefined> {
    await this.flush();
    const outcome = await this.withLockedMission(missionId, (mission) => {
      if (mission.state !== patch.expectedState) return { value: { applied: false } };
      if (
        patch.requireIdle &&
        mission.objectives.some((objective) => objective.state === 'RUNNING')
      ) {
        return { value: { applied: false } };
      }
      // LEASE-03 — refuse while any objective still holds a LIVE lease: a
      // stale provider-resume/recovery decision must never reopen work a real
      // worker is executing.
      const requireNoLiveLease = patch.requireNoLiveLease;
      if (
        requireNoLiveLease !== undefined &&
        mission.objectives.some(
          (objective) =>
            objective.state === 'RUNNING' &&
            objective.lease !== undefined &&
            Date.parse(objective.lease.expiresAt) > requireNoLiveLease.nowMs,
        )
      ) {
        return { value: { applied: false } };
      }
      applyMissionPatchToMission(mission, patch);
      return { value: { applied: true } };
    });
    if (!outcome) return undefined;
    return { applied: outcome.value?.applied === true, mission: outcome.mission };
  }

  /**
   * LEASE-03 — conditional WHOLE-DOCUMENT replacement.
   *
   * The authority check and the write are the SAME row-locked transaction, and
   * the check is `matchesMissionCas` against the row itself (never the mirror).
   * A stale snapshot is therefore refused instead of overwriting a renewal, a
   * re-acquisition, a verification or a terminal decision, and the caller gets
   * the authoritative record back.
   */
  async replaceMissionIfUnchanged(
    missionId: string,
    next: Mission,
    expected: MissionCasSnapshot,
  ): Promise<MissionReplaceResult | undefined> {
    // Drain queued best-effort writes first so an older snapshot cannot land
    // after (and overwrite) this committed replacement.
    await this.flush();
    const outcome = await this.withLockedMission(missionId, (mission) => {
      if (!matchesMissionCas(mission, expected)) {
        return { value: { applied: false } };
      }
      return { value: { applied: true }, write: next };
    });
    if (!outcome) return undefined;
    return { applied: outcome.value?.applied === true, mission: outcome.mission };
  }
}

/** LEASE-01/02 — true for a mission state that can never be reopened. */
function isTerminalState(state: Mission['state']): boolean {
  return (MISSION_TERMINAL_STATES as readonly string[]).includes(state);
}

/**
 * LEASE-01 — is this EXACT acquisition still the recorded owner? Reads the
 * AUTHORITATIVE row (not the mirror): the question is asked exactly when
 * another process may have healed or re-acquired the objective. An expired
 * lease still counts — expiry refuses RENEWAL, it does not transfer ownership.
 */
async function readObjectiveAcquisition(
  sql: Sql,
  table: string,
  missionId: string,
  objectiveId: string,
  acquisition: { owner: string; token: string },
): Promise<boolean> {
  const rows = await sql<Array<{ doc: string }>>`
    SELECT doc::text AS doc
    FROM ${sql(table)}
    WHERE owner = ${OWNER} AND key = ${missionId}
  `;
  const row = rows[0];
  if (!row) return false;
  const mission = JSON.parse(row.doc) as Mission;
  const objective = mission.objectives.find((candidate) => candidate.objectiveId === objectiveId);
  if (!objective || objective.state !== 'RUNNING') return false;
  const lease = objective.lease;
  if (!lease?.token) return false;
  return lease.owner === acquisition.owner && lease.token === acquisition.token;
}

/**
 * LEASE-01 — the shared ownership predicate: the persisted lease must be the
 * EXACT acquisition the caller holds. A legacy lease without a token (or a
 * request without one) can never be proven and is therefore not renewable.
 */
function sameLeaseAcquisition(
  current: MissionObjectiveLease,
  renewal: ObjectiveLeaseRenewal,
): boolean {
  if (!current.token || !renewal.token) return false;
  return current.owner === renewal.owner && current.token === renewal.token;
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

  /**
   * S10 — durability barrier for the checkpoint that witnesses a verified
   * objective. The upsert is AWAITED (it throws when Postgres rejects it), so
   * the caller can never mistake this write for durable when it is not. Any
   * earlier best-effort queue is drained first so an older snapshot cannot
   * overwrite this one later, and the mirror is refreshed only after the
   * durable write succeeded.
   */
  async saveRequired(checkpoint: MissionCheckpoint): Promise<void> {
    await this.flush();
    await this.writeThroughUpsert(OWNER, checkpoint.checkpointId, checkpoint);
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
/**
 * SCHEMA-01 — create ONLY the mission tables (idempotent DDL), with no
 * hydration. Used by the dedicated schema-bootstrap command, which must not
 * load every mirror into a process that is about to exit.
 *
 * The workspace-lease store shares the mission document table, so this is the
 * complete durable surface of the mission runtime.
 */
export async function ensureMissionTables(sql: Sql): Promise<{
  missions: PostgresMissionStore;
  checkpoints: PostgresCheckpointStore;
  workspaceLeases: PostgresWorkspaceLeaseStore;
}> {
  const missions = new PostgresMissionStore(sql);
  const checkpoints = new PostgresCheckpointStore(sql);
  const workspaceLeases = new PostgresWorkspaceLeaseStore(sql);
  await missions.ensureTable();
  await checkpoints.ensureTable();
  await workspaceLeases.ensureTable();
  return { missions, checkpoints, workspaceLeases };
}

export async function ensureMissionPersistence(sql: Sql): Promise<{
  missions: PostgresMissionStore;
  checkpoints: PostgresCheckpointStore;
  /** WORKSPACE-01 — cross-process workspace exclusion over the SAME table. */
  workspaceLeases: PostgresWorkspaceLeaseStore;
}> {
  const missions = new PostgresMissionStore(sql);
  const checkpoints = new PostgresCheckpointStore(sql);
  const workspaceLeases = new PostgresWorkspaceLeaseStore(sql);
  await missions.ensureTable();
  await checkpoints.ensureTable();
  await workspaceLeases.ensureTable();
  await missions.hydrate();
  await checkpoints.hydrate();
  return { missions, checkpoints, workspaceLeases };
}
