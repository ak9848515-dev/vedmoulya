// In-memory checkpoint store for testing and development
import type { MissionCheckpoint } from '../types/mission-types.js';
import type { CheckpointStore } from '../contracts/mission-ports.js';

export class InMemoryCheckpointStore implements CheckpointStore {
  private readonly checkpoints = new Map<string, MissionCheckpoint[]>();

  // eslint-disable-next-line @typescript-eslint/require-await
  async save(checkpoint: MissionCheckpoint): Promise<void> {
    const existing = this.checkpoints.get(checkpoint.missionId) ?? [];
    existing.push(checkpoint);
    this.checkpoints.set(checkpoint.missionId, existing);
  }

  /**
   * S10 — this store's writes are process-local and cannot fail, so the
   * durability barrier is satisfied by the same call. Present so the
   * controller's required-persistence path behaves identically here.
   */
  saveRequired(checkpoint: MissionCheckpoint): Promise<void> {
    return this.save(checkpoint);
  }

  /**
   * S10 — the NEWEST VALID checkpoint, selected by timestamp (not insertion
   * order), matching the Postgres store's `timestamp` ordering. Insertion order
   * alone can return an older checkpoint when checkpoints are written out of
   * timestamp order; a checkpoint with an unparseable timestamp is skipped, and
   * a later insertion wins a tie.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getLatestForMission(missionId: string): Promise<MissionCheckpoint | undefined> {
    const list = this.checkpoints.get(missionId);
    if (!list || list.length === 0) return undefined;
    let latest: MissionCheckpoint | undefined;
    let latestMs = Number.NEGATIVE_INFINITY;
    let latestIndex = -1;
    let index = -1;
    for (const candidate of list) {
      index += 1;
      const ms = Date.parse(candidate.timestamp);
      if (Number.isNaN(ms)) continue;
      if (ms > latestMs || (ms === latestMs && index > latestIndex)) {
        latest = candidate;
        latestMs = ms;
        latestIndex = index;
      }
    }
    return latest;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async listForMission(missionId: string): Promise<MissionCheckpoint[]> {
    return this.checkpoints.get(missionId) ?? [];
  }
}
