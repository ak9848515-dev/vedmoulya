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

  // eslint-disable-next-line @typescript-eslint/require-await
  async getLatestForMission(missionId: string): Promise<MissionCheckpoint | undefined> {
    const list = this.checkpoints.get(missionId);
    if (!list || list.length === 0) return undefined;
    return list[list.length - 1];
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async listForMission(missionId: string): Promise<MissionCheckpoint[]> {
    return this.checkpoints.get(missionId) ?? [];
  }
}
