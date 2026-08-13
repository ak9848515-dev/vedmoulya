// ──────────────────────────────────────────────────────────────────
// VedMoulya — Goal & Task Intelligence: Prioritization Service
// EI-006 — Enterprise Goal & Task Intelligence Engine
// Scores each task 0–100 from business value, urgency, importance,
// dependency load, risk, and confidence (per the sprint brief).
// Pure deterministic scoring — no AI execution.
// ──────────────────────────────────────────────────────────────────

import type { Task } from '../../types/goal-types.js';

export const PRIORITY_WEIGHTS = {
  businessValue: 0.25,
  urgency: 0.2,
  importance: 0.2,
  dependencies: 0.15,
  risk: 0.1,
  confidence: 0.1,
} as const;

export class TaskPrioritizationService {
  /** Compute the priority score (0–100) for a single task. */
  score(task: Task, dependencyCount: number): number {
    const w = PRIORITY_WEIGHTS;
    const dependencyLoad = Math.min(1, dependencyCount / 4);
    const risk = Math.min(1, 1 - task.confidence);
    const score =
      task.businessValue * w.businessValue +
      task.urgency * w.urgency +
      task.importance * w.importance +
      dependencyLoad * w.dependencies +
      risk * w.risk +
      task.confidence * w.confidence;
    return Math.round(score * 100);
  }

  /** Score all tasks in a graph (dependencies resolved from the DAG). */
  prioritize(tasks: Task[]): Task[] {
    const byId = new Map(tasks.map((t) => [t.taskId, t]));
    return tasks.map((task) => {
      const dependencyCount = task.dependencies.filter((d) => byId.has(d)).length;
      const priority = this.score(task, dependencyCount);
      return { ...task, priority };
    });
  }
}
