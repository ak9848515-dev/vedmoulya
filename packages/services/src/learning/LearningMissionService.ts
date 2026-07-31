// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Mission Service
// Manages mission-based learning journeys (sprints/quests)
// BLD-012 — Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { LearningMissionDTO, MissionMilestoneDTO } from './LearningDTO.js';

export class LearningMissionService {
  private readonly stores = new Map<string, Map<string, LearningMissionDTO>>();

  private getStore(userId: string): Map<string, LearningMissionDTO> {
    let store = this.stores.get(userId);
    if (!store) {
      store = new Map();
      this.stores.set(userId, store);
    }
    return store;
  }

  getMissions(userId: string): LearningMissionDTO[] {
    return Array.from(this.getStore(userId).values());
  }

  getMission(userId: string, missionId: string): LearningMissionDTO | undefined {
    return this.getStore(userId).get(missionId);
  }

  addMission(userId: string, mission: LearningMissionDTO): void {
    this.getStore(userId).set(mission.id, mission);
  }

  updateMission(
    userId: string,
    missionId: string,
    updates: Partial<LearningMissionDTO>,
  ): LearningMissionDTO {
    const store = this.getStore(userId);
    const existing = store.get(missionId);
    if (!existing) throw new Error(`Mission not found: ${missionId}`);
    const updated = { ...existing, ...updates };
    store.set(missionId, updated);
    return updated;
  }

  deleteMission(userId: string, missionId: string): void {
    this.getStore(userId).delete(missionId);
  }

  startMission(userId: string, missionId: string): LearningMissionDTO {
    return this.updateMission(userId, missionId, {
      status: 'active',
      startDate: new Date().toISOString(),
    });
  }

  completeMission(userId: string, missionId: string): LearningMissionDTO {
    return this.updateMission(userId, missionId, {
      status: 'completed',
      progress: 100,
      completedDate: new Date().toISOString(),
    });
  }

  updateMilestone(
    userId: string,
    missionId: string,
    milestoneId: string,
    progress: number,
    status: MissionMilestoneDTO['status'],
  ): LearningMissionDTO {
    const mission = this.getMission(userId, missionId);
    if (!mission) throw new Error(`Mission not found: ${missionId}`);
    const milestones = mission.milestones.map((m) =>
      m.id === milestoneId ? { ...m, progress, status } : m,
    );
    const completedCount = milestones.filter((m) => m.status === 'completed').length;
    const overallProgress =
      milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;
    return this.updateMission(userId, missionId, { milestones, progress: overallProgress });
  }

  getActiveMissions(userId: string): LearningMissionDTO[] {
    return this.getMissions(userId).filter((m) => m.status === 'active');
  }

  getAvailableMissions(userId: string): LearningMissionDTO[] {
    return this.getMissions(userId).filter((m) => m.status === 'available');
  }

  getCompletedMissions(userId: string): LearningMissionDTO[] {
    return this.getMissions(userId).filter((m) => m.status === 'completed');
  }

  createMission(
    userId: string,
    title: string,
    description: string,
    type: LearningMissionDTO['type'],
    topics: string[],
    difficulty: LearningMissionDTO['difficulty'],
    timeEstimateHours: number,
    milestoneLabels: string[],
  ): LearningMissionDTO {
    const milestones: MissionMilestoneDTO[] = milestoneLabels.map((label, i) => ({
      id: `ms_${String(Date.now())}_${String(i)}`,
      title: label,
      description: `Complete: ${label}`,
      progress: 0,
      status: 'pending',
    }));
    const mission: LearningMissionDTO = {
      id: `lmiss_${String(Date.now())}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      description,
      type,
      topics,
      milestones,
      progress: 0,
      status: 'available',
      rewards: [],
      timeEstimateHours,
      difficulty,
      createdAt: new Date().toISOString(),
    };
    this.addMission(userId, mission);
    return mission;
  }
}
