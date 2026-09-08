// In-memory mission store for testing and development
import type { Mission } from '../types/mission-types.js';
import type { MissionStore } from '../contracts/mission-ports.js';

export class InMemoryMissionStore implements MissionStore {
  private readonly missions = new Map<string, Mission>();

  // eslint-disable-next-line @typescript-eslint/require-await
  async save(mission: Mission): Promise<void> {
    this.missions.set(mission.missionId, mission);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async get(missionId: string): Promise<Mission | undefined> {
    return this.missions.get(missionId);
  }

  getSync(missionId: string): Mission | undefined {
    return this.missions.get(missionId);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async acquireObjectiveLease(
    missionId: string,
    objectiveId: string,
    lease: NonNullable<import('../types/mission-types.js').MissionObjective['lease']>,
  ): Promise<import('../types/mission-types.js').Mission | undefined> {
    const mission = this.missions.get(missionId);
    const objective = mission?.objectives.find(
      (candidate) => candidate.objectiveId === objectiveId,
    );
    if (!mission || !objective || !['PENDING', 'READY'].includes(objective.state)) {
      return undefined;
    }
    objective.state = 'RUNNING';
    objective.stateHistory.push('RUNNING');
    objective.lease = lease;
    objective.startedAt = objective.startedAt ?? lease.acquiredAt;
    objective.updatedAt = lease.acquiredAt;
    mission.updatedAt = lease.acquiredAt;
    return mission;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async listByUserId(userId: string): Promise<Mission[]> {
    return [...this.missions.values()].filter((m) => m.userId === userId);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async listActive(): Promise<Mission[]> {
    return [...this.missions.values()].filter(
      (m) => !['COMPLETED', 'FAILED', 'CANCELLED'].includes(m.state),
    );
  }

  clear(): void {
    this.missions.clear();
  }
}
