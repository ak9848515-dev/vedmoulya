// In-memory mission store for testing and development
//
// LEASE-02 — ISOLATION. Every read hands out a CLONE and every write stores a
// clone, exactly like the durable (Postgres) store parses its own row. Without
// it, a controller's local mutation WAS the stored document: a superseded
// worker's in-flight snapshot changes were visible to every other reader
// immediately, and the ownership-validated operations below could never refuse
// a stale write (there was nothing stale to refuse). Cloning makes the
// in-memory store behave like a real persistence boundary, so the same race
// semantics are exercised in tests.
import type {
  Mission,
  MissionActivityEvent,
  MissionCasSnapshot,
  MissionObjectiveLease,
  MissionPatch,
  MissionPatchResult,
  MissionReplaceResult,
  ObjectiveLeaseRenewal,
  ObjectivePublication,
  ObjectivePublicationResult,
  RecoveryChangesResult,
  RecoveryObjectiveChange,
} from '../types/mission-types.js';
import type { MissionStore } from '../contracts/mission-ports.js';
import {
  applyActivityToMission,
  applyMissionPatchToMission,
  applyPublicationToMission,
  applyRecoveryChangesToMission,
  hasOtherLiveLease,
  isMissionTerminal,
  matchesMissionCas,
} from '../domain/mission-publication.js';

export class InMemoryMissionStore implements MissionStore {
  private readonly missions = new Map<string, Mission>();

  // eslint-disable-next-line @typescript-eslint/require-await
  async save(mission: Mission): Promise<void> {
    this.missions.set(mission.missionId, structuredClone(mission));
  }

  saveRequired(mission: Mission): Promise<void> {
    return this.save(mission);
  }

  createIfAbsent(mission: Mission): Promise<Mission> {
    const existing = this.missions.get(mission.missionId);
    if (existing) return Promise.resolve(structuredClone(existing));
    this.missions.set(mission.missionId, structuredClone(mission));
    return Promise.resolve(structuredClone(mission));
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async get(missionId: string): Promise<Mission | undefined> {
    const mission = this.missions.get(missionId);
    return mission === undefined ? undefined : structuredClone(mission);
  }

  getSync(missionId: string): Mission | undefined {
    const mission = this.missions.get(missionId);
    return mission === undefined ? undefined : structuredClone(mission);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async acquireObjectiveLease(
    missionId: string,
    objectiveId: string,
    lease: NonNullable<import('../types/mission-types.js').MissionObjective['lease']>,
  ): Promise<import('../types/mission-types.js').Mission | undefined> {
    const mission = this.missions.get(missionId);
    if (!mission) return undefined;
    // LEASE-03 — a terminal mission never starts new work: the cancellation
    // (or completion) is authoritative, even for an objective that is still
    // PENDING.
    if (isMissionTerminal(mission.state)) return undefined;
    const objective = mission.objectives.find((candidate) => candidate.objectiveId === objectiveId);
    if (!objective || !['PENDING', 'READY'].includes(objective.state)) {
      return undefined;
    }
    // LEASE-02 — one owner per MISSION: never start a second objective while
    // another objective of the same mission is still owned.
    if (hasOtherLiveLease(mission, objectiveId, lease.acquiredAt)) return undefined;
    objective.state = 'RUNNING';
    objective.stateHistory.push('RUNNING');
    objective.lease = lease;
    objective.startedAt = objective.startedAt ?? lease.acquiredAt;
    objective.updatedAt = lease.acquiredAt;
    mission.updatedAt = lease.acquiredAt;
    return structuredClone(mission);
  }

  /**
   * LEASE-01 — ownership-checked renewal with exactly the same rules as the
   * durable (Postgres) implementation: the objective must exist and be RUNNING,
   * the lease `owner` + fencing `token` must match EXACTLY, and the persisted
   * lease must not already be expired. Anything else fails safely (`undefined`)
   * — renewal never resurrects a lease recovery already released, and a stale
   * execution can never extend a newer execution's lease.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async renewObjectiveLease(
    missionId: string,
    objectiveId: string,
    renewal: ObjectiveLeaseRenewal,
  ): Promise<MissionObjectiveLease | undefined> {
    const mission = this.missions.get(missionId);
    const objective = mission?.objectives.find(
      (candidate) => candidate.objectiveId === objectiveId,
    );
    if (!mission || !objective) return undefined;
    if (objective.state !== 'RUNNING') return undefined;
    const current = objective.lease;
    if (!current) return undefined;
    if (!holdsLease(current, renewal)) return undefined;
    if (Date.parse(current.expiresAt) <= renewal.nowMs) return undefined;
    const renewed: MissionObjectiveLease = { ...current, expiresAt: renewal.expiresAt };
    objective.lease = renewed;
    objective.updatedAt = new Date(renewal.nowMs).toISOString();
    mission.updatedAt = new Date(renewal.nowMs).toISOString();
    return renewed;
  }

  /**
   * LEASE-01 — atomically heal ONE abandoned RUNNING objective back to READY.
   * The liveness check and the transition are the SAME step against the stored
   * document, so recovery can never reset an objective whose owner renewed (or
   * that another execution re-acquired) in the meantime.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async releaseExpiredObjectiveLease(
    missionId: string,
    objectiveId: string,
    options: { nowMs: number; failureReason: string },
  ): Promise<Mission | undefined> {
    const mission = this.missions.get(missionId);
    if (!mission) return undefined;
    // LEASE-03 — a terminal mission is never healed: the cancellation (or any
    // other terminal decision) wins over a recovery observation, and this
    // check is part of the same atomic step as the write.
    if (isMissionTerminal(mission.state)) return undefined;
    const objective = mission.objectives.find((candidate) => candidate.objectiveId === objectiveId);
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
    return structuredClone(mission);
  }

  /**
   * LEASE-01 — is this EXACT acquisition still the recorded owner? Answered from
   * the stored document (never from the caller's snapshot). An expired lease
   * still counts: expiry refuses RENEWAL, it does not transfer ownership.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async holdsObjectiveLease(
    missionId: string,
    objectiveId: string,
    acquisition: { owner: string; token: string },
  ): Promise<boolean> {
    const mission = this.missions.get(missionId);
    const objective = mission?.objectives.find(
      (candidate) => candidate.objectiveId === objectiveId,
    );
    if (!objective || objective.state !== 'RUNNING') return false;
    const lease = objective.lease;
    if (!lease?.token) return false;
    return lease.owner === acquisition.owner && lease.token === acquisition.token;
  }

  /**
   * LEASE-02 — ownership-checked, OBJECTIVE-scoped publication.
   *
   * The ownership check and the write are one synchronous step (the in-memory
   * equivalent of the Postgres row-locked transaction), so a superseded
   * execution can never publish its objective, evidence, checkpoint or hold
   * over a newer owner's record — and never over a terminal mission.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async finalizeObjectiveIfLeaseOwner(
    missionId: string,
    objectiveId: string,
    acquisition: { owner: string; token: string },
    publication: ObjectivePublication,
  ): Promise<ObjectivePublicationResult | undefined> {
    const mission = this.missions.get(missionId);
    if (!mission) return undefined;
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
    if (!owns || isMissionTerminal(mission.state)) {
      return { applied: false, mission: structuredClone(mission) };
    }
    applyPublicationToMission(mission, index, current.lease, publication);
    return { applied: true, mission: structuredClone(mission) };
  }

  /**
   * LEASE-02 — conditional recovery publication. A change applies only when the
   * stored objective still matches exactly what the recovery pass observed, so
   * a renewal or a fresh acquisition that landed in between survives.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async applyRecoveryChanges(
    missionId: string,
    changes: RecoveryObjectiveChange[],
    options: { nowMs: number; activity?: MissionActivityEvent[]; activityLimit?: number },
  ): Promise<RecoveryChangesResult | undefined> {
    const mission = this.missions.get(missionId);
    if (!mission) return undefined;
    const { applied, skipped } = applyRecoveryChangesToMission(mission, changes, options);
    return { applied, skipped, mission: structuredClone(mission) };
  }

  /** LEASE-02 — merge-only activity append (never reverts any state). */
  // eslint-disable-next-line @typescript-eslint/require-await
  async appendActivity(
    missionId: string,
    events: MissionActivityEvent[],
    options?: { limit?: number; at?: string },
  ): Promise<Mission | undefined> {
    const mission = this.missions.get(missionId);
    if (!mission) return undefined;
    applyActivityToMission(mission, events, options?.limit);
    if (options?.at !== undefined) mission.updatedAt = options.at;
    return structuredClone(mission);
  }

  /**
   * LEASE-02 — optimistic mission-level patch. Refused when the stored state is
   * no longer the observed one, or (for a terminal acknowledgement) while any
   * objective is still RUNNING.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async patchMission(
    missionId: string,
    patch: MissionPatch,
  ): Promise<MissionPatchResult | undefined> {
    const mission = this.missions.get(missionId);
    if (!mission) return undefined;
    if (mission.state !== patch.expectedState) {
      return { applied: false, mission: structuredClone(mission) };
    }
    if (
      patch.requireIdle &&
      mission.objectives.some((objective) => objective.state === 'RUNNING')
    ) {
      return { applied: false, mission: structuredClone(mission) };
    }
    // LEASE-03 — refuse while any objective still holds a LIVE lease: a stale
    // provider-resume/recovery decision must never reopen work a real worker
    // is executing.
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
      return { applied: false, mission: structuredClone(mission) };
    }
    applyMissionPatchToMission(mission, patch);
    return { applied: true, mission: structuredClone(mission) };
  }

  /**
   * LEASE-03 — conditional whole-document replacement. The authority check and
   * the write are one synchronous step (the in-memory equivalent of the
   * Postgres row-locked transaction), so a stale snapshot can never overwrite a
   * renewal, a re-acquisition, a verification or a terminal decision.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async replaceMissionIfUnchanged(
    missionId: string,
    next: Mission,
    expected: MissionCasSnapshot,
  ): Promise<MissionReplaceResult | undefined> {
    const mission = this.missions.get(missionId);
    if (!mission) return undefined;
    if (!matchesMissionCas(mission, expected)) {
      return { applied: false, mission: structuredClone(mission) };
    }
    const stored = structuredClone(next);
    this.missions.set(missionId, stored);
    return { applied: true, mission: structuredClone(stored) };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async listByUserId(userId: string): Promise<Mission[]> {
    return [...this.missions.values()]
      .filter((mission) => mission.userId === userId)
      .map((mission) => structuredClone(mission));
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async listActive(): Promise<Mission[]> {
    return [...this.missions.values()]
      .filter((mission) => !isMissionTerminal(mission.state))
      .map((mission) => structuredClone(mission));
  }

  clear(): void {
    this.missions.clear();
  }
}

/**
 * LEASE-01 — the shared ownership predicate: the persisted lease must be the
 * EXACT acquisition the caller holds. A legacy lease without a token (or a
 * request without one) can never be proven and is therefore not renewable.
 */
function holdsLease(current: MissionObjectiveLease, renewal: ObjectiveLeaseRenewal): boolean {
  if (!current.token || !renewal.token) return false;
  return current.owner === renewal.owner && current.token === renewal.token;
}
