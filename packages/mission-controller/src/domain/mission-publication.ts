// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Controller: atomic publication semantics (LEASE-02)
//
// WHY THIS EXISTS
// ---------------
// A mission document used to be persisted as a WHOLE. Every owner therefore
// wrote its own snapshot over everybody else's: a lease that had just been
// renewed, an objective another worker had just verified, a terminal
// cancellation — anything absent from (or older in) that snapshot was lost.
//
// These functions are the ONE place where a publication is applied. They are
// deliberately merge/objective-scoped:
//   • an objective publication writes exactly ONE objective document;
//   • activity is merged by event id (history can only grow);
//   • checkpoints are appended (never replaced);
//   • usage accounting is written by the execution that owns the objective;
//   • a mission-level hold applies only while the mission is still RUNNING.
//
// The stores call them INSIDE their ownership/state validation (an atomic step
// for the in-memory store, a row-locked transaction for Postgres), so these
// helpers assume the caller already decided that the write may happen.
// ──────────────────────────────────────────────────────────────────

import type {
  Mission,
  MissionActivityEvent,
  MissionCasSnapshot,
  MissionObjective,
  MissionObjectiveLease,
  MissionPatch,
  MissionState,
  ObjectivePublication,
  RecoveryObjectiveChange,
} from '../types/mission-types.js';
import { MISSION_TERMINAL_STATES } from '../types/mission-types.js';
import { mergeMissionActivity } from './mission-activity.js';

/** True for a mission state that can never be reopened by a late writer. */
export function isMissionTerminal(state: MissionState): boolean {
  return (MISSION_TERMINAL_STATES as readonly string[]).includes(state);
}

/**
 * LEASE-03 — capture the ownership-relevant facts of a mission document.
 *
 * Deliberately SMALL and canonical: mission state, history/activity lengths,
 * update instant and every objective's state + lease identity. It is what a
 * conditional whole-document write compares against the authoritative row, so
 * a newer lease (renewed or re-acquired), a healed objective, a verification or
 * a terminal decision all count as "the record moved on" and refuse the write.
 */
export function missionCasSnapshot(mission: Mission): MissionCasSnapshot {
  return {
    state: mission.state,
    updatedAt: mission.updatedAt,
    stateHistoryLength: mission.stateHistory.length,
    activityLength: mission.activity?.length ?? 0,
    objectives: mission.objectives.map((objective) => ({
      objectiveId: objective.objectiveId,
      state: objective.state,
      ...(objective.lease?.token !== undefined ? { leaseToken: objective.lease.token } : {}),
      ...(objective.lease?.expiresAt !== undefined
        ? { leaseExpiresAt: objective.lease.expiresAt }
        : {}),
    })),
  };
}

/**
 * LEASE-03 — does the authoritative mission still match what the caller read?
 * Any difference refuses the caller's whole-document write.
 */
export function matchesMissionCas(mission: Mission, expected: MissionCasSnapshot): boolean {
  if (mission.state !== expected.state) return false;
  if (mission.updatedAt !== expected.updatedAt) return false;
  if (mission.stateHistory.length !== expected.stateHistoryLength) return false;
  if ((mission.activity?.length ?? 0) !== expected.activityLength) return false;
  if (mission.objectives.length !== expected.objectives.length) return false;
  return expected.objectives.every((observed, index) => {
    // eslint-disable-next-line security/detect-object-injection -- `index` walks the snapshot's own bounded objectives array, whose length was just proven equal to the authoritative one; it is never user-controlled.
    const current = mission.objectives[index];
    if (!current || current.objectiveId !== observed.objectiveId) return false;
    if (current.state !== observed.state) return false;
    if ((current.lease?.token ?? undefined) !== observed.leaseToken) return false;
    return (current.lease?.expiresAt ?? undefined) === observed.leaseExpiresAt;
  });
}

/**
 * LEASE-02 — one owner per MISSION.
 *
 * Every mission-level write (usage accounting, activity, terminal outcome)
 * assumes exactly one active owner. Acquisition is therefore refused while any
 * OTHER objective of the same mission holds a live lease, which is what keeps
 * two workers from running different objectives of one mission and merging
 * their whole-document assumptions into a lost update.
 *
 * `at` is the caller's acquisition time (the store owns no clock); an
 * unreadable timestamp is treated as "assume a conflict" — never as "free".
 */
export function hasOtherLiveLease(mission: Mission, objectiveId: string, at: string): boolean {
  const nowMs = Date.parse(at);
  if (Number.isNaN(nowMs)) return true;
  return mission.objectives.some(
    (objective) =>
      objective.objectiveId !== objectiveId &&
      objective.state === 'RUNNING' &&
      objective.lease !== undefined &&
      Date.parse(objective.lease.expiresAt) > nowMs,
  );
}

/** Merge bounded activity into a mission (deduped by id, never replaced). */
export function applyActivityToMission(
  mission: Mission,
  events: MissionActivityEvent[] | undefined,
  limit: number | undefined,
): void {
  mission.activity = mergeMissionActivity(mission.activity, events, limit);
}

/**
 * LEASE-02 — apply an ownership-validated objective publication.
 *
 * A still-RUNNING publication (evidence/trace) keeps the AUTHORITATIVE lease,
 * so a slower evidence write can never shorten an expiration the heartbeat has
 * already renewed. A final publication owns its own lease field (VERIFIED /
 * FAILED / PENDING clears it).
 */
export function applyPublicationToMission(
  mission: Mission,
  objectiveIndex: number,
  authoritativeLease: MissionObjectiveLease | undefined,
  publication: ObjectivePublication,
): void {
  const published: MissionObjective = {
    ...structuredClone(publication.objective),
    ...(publication.objective.state === 'RUNNING' ? { lease: authoritativeLease } : {}),
  };
  if (published.state === 'RUNNING') {
    delete published.finalizedByLeaseToken;
  } else if (publication.leaseToken !== undefined) {
    published.finalizedByLeaseToken = publication.leaseToken;
  }
  // eslint-disable-next-line security/detect-object-injection -- Index produced by findIndex on the same bounded objectives array; never user-controlled.
  mission.objectives[objectiveIndex] = published;

  applyActivityToMission(mission, publication.activity, publication.activityLimit);

  if (publication.budgetUsage !== undefined) {
    mission.budgetUsage = structuredClone(publication.budgetUsage);
  }

  if (publication.checkpoint !== undefined) {
    const checkpoints = mission.checkpoints;
    const id = publication.checkpoint.checkpointId;
    if (!checkpoints.some((existing) => existing.checkpointId === id)) {
      checkpoints.push(structuredClone(publication.checkpoint));
    }
    mission.checkpoints = checkpoints;
  }

  // A hold is applied ONLY while this mission is still RUNNING: an operator
  // hold, a cancellation or a terminal state always wins over a late hold.
  if (publication.hold !== undefined && mission.state === 'RUNNING') {
    mission.state = publication.hold.state;
    mission.stateHistory.push(publication.hold.state);
    if (publication.hold.reason !== undefined) {
      mission.outcomeReason = publication.hold.reason;
    }
  }

  mission.updatedAt = publication.at;
}

/**
 * LEASE-02 — apply the recovery changes whose observed state still matches.
 * Returns the ids actually applied and the ids skipped because the objective
 * moved on (renewed, re-acquired, healed by another pass).
 */
export function applyRecoveryChangesToMission(
  mission: Mission,
  changes: RecoveryObjectiveChange[],
  options: { nowMs: number; activity?: MissionActivityEvent[]; activityLimit?: number },
): { applied: string[]; skipped: string[] } {
  // LEASE-03 — a terminal mission is NEVER mutated by a recovery pass. The
  // check is evaluated by the store INSIDE its transaction, on the
  // authoritative document, so a cancellation that landed after the pass read
  // its snapshot wins: every change is skipped and no activity is merged.
  if (isMissionTerminal(mission.state)) {
    return { applied: [], skipped: changes.map((change) => change.objectiveId) };
  }
  const applied: string[] = [];
  const skipped: string[] = [];
  const now = new Date(options.nowMs).toISOString();

  for (const change of changes) {
    const objective = mission.objectives.find(
      (candidate) => candidate.objectiveId === change.objectiveId,
    );
    const matches =
      objective !== undefined &&
      objective.state === change.expected.state &&
      (objective.lease?.token ?? undefined) === change.expected.leaseToken &&
      (objective.lease?.expiresAt ?? undefined) === change.expected.leaseExpiresAt;
    if (!objective || !matches) {
      skipped.push(change.objectiveId);
      continue;
    }
    objective.state = change.state;
    objective.stateHistory.push(change.state);
    objective.lease = undefined;
    if (change.failureReason !== undefined) objective.failureReason = change.failureReason;
    objective.updatedAt = now;
    applied.push(change.objectiveId);
    applyActivityToMission(mission, change.activity, options.activityLimit);
  }

  applyActivityToMission(mission, options.activity, options.activityLimit);
  if (applied.length > 0) mission.updatedAt = now;
  return { applied, skipped };
}

/**
 * LEASE-02 — apply a mission-level patch. Objectives, checkpoints and usage
 * accounting are untouched, so a stale command write can never resurrect a
 * lease, an objective result or evidence.
 */
export function applyMissionPatchToMission(mission: Mission, patch: MissionPatch): void {
  mission.state = patch.state;
  if (patch.stateHistoryEntry !== undefined) {
    mission.stateHistory.push(patch.stateHistoryEntry);
  }
  if (patch.outcome !== undefined) mission.outcome = patch.outcome;
  if (patch.outcomeReason !== undefined) mission.outcomeReason = patch.outcomeReason;
  if (patch.error !== undefined) mission.error = patch.error;
  if (patch.startedAt !== undefined) mission.startedAt = patch.startedAt;
  if (patch.finishedAt !== undefined) mission.finishedAt = patch.finishedAt;
  if (patch.checkpoint !== undefined) {
    const checkpoints = mission.checkpoints;
    const id = patch.checkpoint.checkpointId;
    if (!checkpoints.some((existing) => existing.checkpointId === id)) {
      checkpoints.push(structuredClone(patch.checkpoint));
    }
    mission.checkpoints = checkpoints;
  }
  applyActivityToMission(mission, patch.activity, patch.activityLimit);
  mission.updatedAt = patch.at;
}
