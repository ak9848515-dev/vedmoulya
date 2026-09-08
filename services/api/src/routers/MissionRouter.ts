// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Mission Router (BLD-024)
//
// Thin transport layer over MissionService → MissionRuntimeApi. Every
// handler: authenticate (standardProcedure) → validate (zod) → authorize
// (userId comes from the verified session, never the payload) → delegate.
// No mission logic lives here — objective selection, planning, execution,
// verification, checkpoints and continuation stay in the frozen runtime.
// ─────────────────────────────────────────────────────────────────────────────

import type { MissionStatusView, CreateMissionInputView } from '../services/MissionService.js';
import type { Mission } from '@vedmoulya/mission-controller';
import { successResponse, type ApiResponse } from '../services/ResponseMapper.js';

export interface MissionHandlers {
  /** CREATE + START + run the autonomous loop (idempotent per mission). */
  createAndRun: (input: { userId: string } & Record<string, unknown>) => Promise<ApiResponse>;
  /** START (when CREATED) + run the autonomous loop. */
  start: (input: { userId: string; missionId: string }) => Promise<ApiResponse>;
  status: (input: { userId: string; missionId: string }) => Promise<ApiResponse>;
  pause: (input: { userId: string; missionId: string }) => Promise<ApiResponse>;
  resume: (input: { userId: string; missionId: string }) => Promise<ApiResponse>;
  cancel: (input: { userId: string; missionId: string }) => Promise<ApiResponse>;
  approve: (input: { userId: string; missionId: string }) => Promise<ApiResponse>;
  reject: (input: { userId: string; missionId: string }) => Promise<ApiResponse>;
  history: (input: { userId: string }) => Promise<ApiResponse>;
}

export interface MissionServiceLike {
  createAndRun(userId: string, input: CreateMissionInputView): Promise<Mission>;
  startAutonomousLoop(userId: string, missionId: string): Promise<Mission>;
  resumeAutonomousLoop(userId: string, missionId: string): Promise<Mission>;
  getStatus(userId: string, missionId: string): Promise<MissionStatusView>;
  listMissionSummaries(userId: string): Promise<unknown>;
  pause(userId: string, missionId: string): Promise<Mission>;
  resume(userId: string, missionId: string): Promise<Mission>;
  cancel(userId: string, missionId: string): Promise<Mission>;
  approve(userId: string, missionId: string): Promise<Mission>;
  reject(userId: string, missionId: string): Promise<Mission>;
  start(userId: string, missionId: string): Promise<Mission>;
  createMission(userId: string, input: CreateMissionInputView): Promise<Mission>;
}

export function createMissionRouter(missionService: MissionServiceLike): MissionHandlers {
  const toMissionView = (mission: Mission) =>
    successResponse({
      missionId: mission.missionId,
      userId: mission.userId,
      title: mission.title,
      objective: mission.objective,
      state: mission.state,
      outcome: mission.outcome,
      outcomeReason: mission.outcomeReason,
      createdAt: mission.createdAt,
      updatedAt: mission.updatedAt,
      objectives: mission.objectives.map((o) => ({
        objectiveId: o.objectiveId,
        title: o.title,
        state: o.state,
        failureReason: o.failureReason,
        verifiedAt: o.verifiedOutcome?.verifiedAt,
      })),
    });

  const mapError = (error: unknown): ApiResponse => {
    const message = error instanceof Error ? error.message : 'Mission operation failed';
    const notFound = message.includes('not found');
    return {
      success: false,
      error: {
        code: notFound ? 'NOT_FOUND' : 'VALIDATION_ERROR',
        message,
        statusCode: notFound ? 404 : 400,
      },
      meta: { timestamp: new Date().toISOString(), duration: 0, version: '1.0.0' },
    };
  };

  return {
    createAndRun: async (input) => {
      try {
        const {
          userId,
          title,
          objective,
          workspace,
          initialObjectives,
          maxObjectives,
          maxCostUsd,
          maxTokens,
          maxRuntimeMs,
          autonomyLevel,
        } = input as {
          userId: string;
          title: string;
          objective: string;
          workspace?: string;
          initialObjectives?: string[];
          maxObjectives?: number;
          maxCostUsd?: number;
          maxTokens?: number;
          maxRuntimeMs?: number;
          autonomyLevel?: 'ASSISTED' | 'SUPERVISED' | 'CONTROLLED_AUTONOMOUS';
        };
        const missionInput: CreateMissionInputView = {
          title,
          objective,
          workspace,
          initialObjectives,
          maxObjectives,
          maxCostUsd,
          maxTokens,
          maxRuntimeMs,
          autonomyLevel,
        };
        const mission = await missionService.createAndRun(userId, missionInput);
        return toMissionView(mission);
      } catch (error) {
        return mapError(error);
      }
    },

    start: async (input) => {
      try {
        const mission = await missionService.startAutonomousLoop(input.userId, input.missionId);
        return toMissionView(mission);
      } catch (error) {
        return mapError(error);
      }
    },

    status: async (input) => {
      try {
        const view = await missionService.getStatus(input.userId, input.missionId);
        return successResponse(view);
      } catch (error) {
        return mapError(error);
      }
    },

    pause: async (input) => {
      try {
        const mission = await missionService.pause(input.userId, input.missionId);
        return toMissionView(mission);
      } catch (error) {
        return mapError(error);
      }
    },

    resume: async (input) => {
      try {
        const mission = await missionService.resumeAutonomousLoop(input.userId, input.missionId);
        return toMissionView(mission);
      } catch (error) {
        return mapError(error);
      }
    },

    cancel: async (input) => {
      try {
        const mission = await missionService.cancel(input.userId, input.missionId);
        return toMissionView(mission);
      } catch (error) {
        return mapError(error);
      }
    },

    approve: async (input) => {
      try {
        const mission = await missionService.approve(input.userId, input.missionId);
        return toMissionView(mission);
      } catch (error) {
        return mapError(error);
      }
    },

    reject: async (input) => {
      try {
        const mission = await missionService.reject(input.userId, input.missionId);
        return toMissionView(mission);
      } catch (error) {
        return mapError(error);
      }
    },

    history: async (input) => {
      try {
        const summaries = await missionService.listMissionSummaries(input.userId);
        return successResponse(summaries);
      } catch (error) {
        return mapError(error);
      }
    },
  };
}
