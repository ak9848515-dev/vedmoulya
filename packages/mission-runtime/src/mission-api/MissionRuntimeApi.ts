// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Minimal API / Service Boundary (BLD-022)
//
// The minimum runtime operations an API/UI surface needs this sprint:
// START, PAUSE, RESUME, CANCEL, APPROVE, REJECT, GET STATUS (+ create).
// This is a THIN application boundary over the frozen
// MissionControllerService — it adds ONLY ownership enforcement
// (missions are owner-scoped; a foreign caller cannot see or drive a
// mission) and never re-implements mission behavior. A transport layer
// (tRPC/HTTP router) can wrap this class next sprint without any
// runtime change.
// ──────────────────────────────────────────────────────────────────

import type {
  CreateMissionInput,
  Mission,
  MissionCheckpoint,
  MissionStore,
} from '@vedmoulya/mission-controller';
import type { MissionControllerService, MissionStatusDTO } from '@vedmoulya/mission-controller';

export interface MissionRuntimeApiOptions {
  controller: MissionControllerService;
  store: MissionStore;
  checkpointStore: import('@vedmoulya/mission-controller').CheckpointStore;
}

export class MissionRuntimeApi {
  constructor(private readonly options: MissionRuntimeApiOptions) {}

  /** Create AND start a mission — the autonomous entry point. */
  async createAndStart(input: CreateMissionInput): Promise<Mission> {
    const mission = await this.options.controller.createMission(input);
    return this.options.controller.startMission(mission.missionId);
  }

  async start(missionId: string, userId: string): Promise<Mission> {
    await this.assertOwned(missionId, userId);
    return this.options.controller.startMission(missionId);
  }

  async pause(missionId: string, userId: string): Promise<Mission> {
    await this.assertOwned(missionId, userId);
    return this.options.controller.pauseMission(missionId);
  }

  async resume(missionId: string, userId: string): Promise<Mission> {
    await this.assertOwned(missionId, userId);
    return this.options.controller.resumeMission(missionId);
  }

  async resumeFromCheckpoint(missionId: string, userId: string): Promise<Mission> {
    await this.assertOwned(missionId, userId);
    return this.options.controller.resumeFromCheckpoint(missionId);
  }

  async cancel(missionId: string, userId: string): Promise<Mission> {
    await this.assertOwned(missionId, userId);
    return this.options.controller.cancelMission(missionId);
  }

  async approve(missionId: string, userId: string, objectiveId: string): Promise<Mission> {
    await this.assertOwned(missionId, userId);
    return this.options.controller.approveObjective(missionId, objectiveId);
  }

  async reject(missionId: string, userId: string, objectiveId: string): Promise<Mission> {
    await this.assertOwned(missionId, userId);
    return this.options.controller.rejectObjective(missionId, objectiveId);
  }

  async getStatus(missionId: string, userId: string): Promise<MissionStatusDTO> {
    await this.assertOwned(missionId, userId);
    return this.options.controller.getStatus(missionId, userId);
  }

  async getCheckpoints(missionId: string, userId: string): Promise<MissionCheckpoint[]> {
    await this.assertOwned(missionId, userId);
    return this.options.checkpointStore.listForMission(missionId);
  }

  async listMissions(userId: string): Promise<Mission[]> {
    return this.options.store.listByUserId(userId);
  }

  /** A mission is invisible to every user except its owner. */
  private async assertOwned(missionId: string, userId: string): Promise<Mission> {
    const mission = await this.options.store.get(missionId);
    if (!mission || mission.userId !== userId) {
      throw new Error(`mission ${missionId} not found for user`);
    }
    return mission;
  }
}
