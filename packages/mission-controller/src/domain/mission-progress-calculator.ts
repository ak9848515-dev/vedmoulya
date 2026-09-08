// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Controller: Progress Calculator
// BLD-021A — Autonomous Mission Controller
//
// Evidence-based progress calculation. Progress is derived from
// verified outcomes, never from model confidence.
// ──────────────────────────────────────────────────────────────────

import type { Mission, MissionProgress } from '../types/mission-types.js';

export function calculateProgress(mission: Mission): MissionProgress {
  const totalObjectives = mission.objectives.length;
  const completedObjectives = mission.objectives.filter((o) => o.state === 'VERIFIED').length;
  const blockedObjectives = mission.objectives.filter((o) => o.state === 'BLOCKED').length;
  const failedObjectives = mission.objectives.filter((o) => o.state === 'FAILED').length;

  // Evidence-based percentage: verified / total
  const percentComplete = totalObjectives > 0 ? (completedObjectives / totalObjectives) * 100 : 0;

  // Remaining = pending + ready + running + blocked (not yet verified)
  const pendingObjectives = mission.objectives.filter(
    (o) => o.state === 'PENDING' || o.state === 'READY',
  ).length;
  const runningObjectives = mission.objectives.filter((o) => o.state === 'RUNNING').length;
  const objectivesUntilCompletion = pendingObjectives + runningObjectives + blockedObjectives;

  // Estimate remaining cost from unverified objectives
  const estimatedRemainingCost = mission.objectives
    .filter((o) => o.state !== 'VERIFIED' && o.state !== 'SKIPPED')
    .reduce((sum, o) => sum + o.estimatedCost, 0);

  // Estimate remaining runtime (rough: 30s per pending objective)
  const estimatedRemainingRuntimeMs = objectivesUntilCompletion * 30000;

  const lastCheckpoint =
    mission.checkpoints.length > 0
      ? mission.checkpoints[mission.checkpoints.length - 1]
      : undefined;
  const lastVerifiedAt = lastCheckpoint?.timestamp;

  return {
    missionId: mission.missionId,
    totalObjectives,
    completedObjectives,
    verifiedObjectives: completedObjectives,
    blockedObjectives,
    failedObjectives,
    currentObjectiveId: mission.currentObjectiveId,
    accumulatedValue: completedObjectives,
    budgetUsed: mission.budgetUsage,
    percentComplete: Math.round(percentComplete * 100) / 100,
    objectivesUntilCompletion,
    estimatedRemainingCost,
    estimatedRemainingRuntimeMs,
    lastVerifiedAt,
  };
}
