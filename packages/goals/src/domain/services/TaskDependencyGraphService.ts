// ──────────────────────────────────────────────────────────────────
// VedMoulya — Goal & Task Intelligence: Dependency Graph Service
// EI-006 — Enterprise Goal & Task Intelligence Engine
// Builds the task DAG: cycle detection, critical path (longest
// weighted path by estimated duration), slack, parallel groups, and
// milestone wiring. Deterministic graph algorithms — no AI execution.
// ──────────────────────────────────────────────────────────────────

import type { Milestone, Task, TaskGraph } from '../../types/goal-types.js';

export class TaskDependencyGraphService {
  /**
   * Build the full task graph. Assumes tasks carry `dependencies`
   * (taskIds). Returns the DAG, critical path, parallel groups,
   * milestones, and aggregate estimates.
   */
  build(goalId: string, tasks: Task[], milestones: Milestone[]): TaskGraph {
    const byId = new Map(tasks.map((t) => [t.taskId, t]));
    const cycle = this.findCycle(tasks, byId);
    const acyclic = cycle.length === 0;

    const totalTokens = tasks.reduce((s, t) => s + t.estimatedTokens, 0);
    const totalCost = Number(tasks.reduce((s, t) => s + t.estimatedCostUsd, 0).toFixed(2));

    // Critical path: longest total duration chain (weighted by time).
    // Skipped for cyclic graphs (the recursive solver is only safe on DAGs).
    const critical = acyclic
      ? this.criticalPath(tasks, byId)
      : { criticalPath: [] as string[], totalTime: 0 };
    const { criticalPath, totalTime } = critical;

    // Slack: per task, total path time minus the max ancestor depth.
    const slackByTask = acyclic
      ? this.computeSlack(tasks, byId, criticalPath)
      : new Map<string, number>();

    // Parallel groups: consecutive tasks that are parallel-eligible and
    // share the same immediate dependency set.
    const parallelGroups = this.buildParallelGroups(tasks);

    // Milestone achievement: achieved when all member tasks are completed.
    const milestoneStates: Milestone[] = milestones.map((m) => ({
      ...m,
      achieved:
        m.taskIds.length > 0 && m.taskIds.every((id) => byId.get(id)?.status === 'completed'),
    }));

    // Attach critical + slack back onto the tasks.
    const graphTasks = tasks.map((t) => ({
      ...t,
      critical: criticalPath.includes(t.taskId),
      slack: slackByTask.get(t.taskId) ?? 0,
    }));

    return {
      goalId,
      tasks: graphTasks,
      criticalPath,
      parallelGroups,
      milestones: milestoneStates,
      totalEstimatedTimeMs: totalTime,
      totalEstimatedCostUsd: totalCost,
      totalEstimatedTokens: totalTokens,
      criticalPathLength: criticalPath.length,
      validated: acyclic && tasks.every((t) => t.dependencies.every((d) => byId.has(d))),
    };
  }

  /** Detect the first cycle (DFS 3-coloring); empty array = acyclic. */
  findCycle(tasks: Task[], byId: Map<string, Task>): string[] {
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Map<string, number>();
    const stack: string[] = [];

    const visit = (taskId: string): boolean => {
      color.set(taskId, GRAY);
      stack.push(taskId);
      const task = byId.get(taskId);
      for (const dep of task?.dependencies ?? []) {
        if (!byId.has(dep)) continue;
        const c = color.get(dep) ?? WHITE;
        if (c === GRAY) {
          // Found a cycle.
          return true;
        }
        if (c === WHITE && visit(dep)) return true;
      }
      stack.pop();
      color.set(taskId, BLACK);
      return false;
    };

    for (const task of tasks) {
      if ((color.get(task.taskId) ?? WHITE) === WHITE) {
        if (visit(task.taskId)) {
          const top = stack[stack.length - 1];
          if (top === undefined) return [];
          const idx = stack.indexOf(top);
          return stack.slice(Math.max(0, idx));
        }
      }
    }
    return [];
  }

  /** Longest path by summed estimated duration. */
  private criticalPath(
    tasks: Task[],
    byId: Map<string, Task>,
  ): { criticalPath: string[]; totalTime: number } {
    const memo = new Map<string, { length: number; path: string[] }>();

    const longest = (taskId: string): { length: number; path: string[] } => {
      const cached = memo.get(taskId);
      if (cached) return cached;
      const task = byId.get(taskId);
      if (!task) return { length: 0, path: [] };

      let best = { length: 0, path: [] as string[] };
      for (const dep of task.dependencies) {
        if (!byId.has(dep)) continue;
        const sub = longest(dep);
        if (sub.length > best.length) best = sub;
      }
      const result = {
        length: best.length + task.estimatedTimeMs,
        path: [...best.path, task.taskId],
      };
      memo.set(taskId, result);
      return result;
    };

    let best = { length: 0, path: [] as string[] };
    for (const task of tasks) {
      const candidate = longest(task.taskId);
      if (candidate.length > best.length) best = candidate;
    }
    return { criticalPath: best.path, totalTime: best.length };
  }

  /** Earliest-start slack per task (0 for critical-path members). */
  private computeSlack(
    tasks: Task[],
    byId: Map<string, Task>,
    criticalPath: string[],
  ): Map<string, number> {
    const slack = new Map<string, number>();
    const criticalTime = criticalPath.reduce(
      (s, id) => s + (byId.get(id)?.estimatedTimeMs ?? 0),
      0,
    );
    // Shared memo + visiting guard make the upstream/downstream traversal
    // safe on DAGs (and terminate on any accidental cycle).
    const memo = new Map<string, number>();
    const visiting = new Set<string>();
    for (const task of tasks) {
      if (criticalPath.includes(task.taskId)) {
        slack.set(task.taskId, 0);
        continue;
      }
      // Slack = (total path time) − (longest chain through this task).
      const through = this.longestChainThrough(task.taskId, byId, memo, visiting);
      slack.set(task.taskId, Math.max(0, criticalTime - through));
    }
    return slack;
  }

  private longestChainThrough(
    taskId: string,
    byId: Map<string, Task>,
    memo: Map<string, number>,
    visiting: Set<string>,
  ): number {
    const cached = memo.get(taskId);
    if (cached !== undefined) return cached;
    if (visiting.has(taskId)) return 0; // cycle guard
    visiting.add(taskId);
    const task = byId.get(taskId);
    let upstream = 0;
    for (const dep of task?.dependencies ?? []) {
      if (!byId.has(dep)) continue;
      upstream = Math.max(upstream, this.longestChainThrough(dep, byId, memo, visiting));
    }
    let downstream = 0;
    for (const t of byId.values()) {
      if (t.dependencies.includes(taskId)) {
        downstream = Math.max(downstream, this.longestChainThrough(t.taskId, byId, memo, visiting));
      }
    }
    visiting.delete(taskId);
    const result = (task?.estimatedTimeMs ?? 0) + upstream + downstream;
    memo.set(taskId, result);
    return result;
  }

  /** Consecutive runs of parallel-eligible tasks with identical deps. */
  private buildParallelGroups(tasks: Task[]): string[][] {
    const groups: string[][] = [];
    let current: string[] = [];
    let currentDepsKey = '';

    for (const task of [...tasks].sort((a, b) => a.order - b.order)) {
      const depsKey = [...task.dependencies].sort().join(',');
      if (task.parallelEligible) {
        if (current.length > 0 && depsKey !== currentDepsKey) {
          groups.push(current);
          current = [];
        }
        current.push(task.taskId);
        currentDepsKey = depsKey;
      } else if (current.length > 0) {
        groups.push(current);
        current = [];
        currentDepsKey = '';
      }
    }
    if (current.length > 0) groups.push(current);
    return groups;
  }

  /**
   * Order root tasks for a readable schedule: dependency-first, then
   * priority desc (deterministic tie-break by order).
   */
  topologicalOrder(tasks: Task[]): Task[] {
    const byId = new Map(tasks.map((t) => [t.taskId, t]));
    const indegree = new Map<string, number>();
    for (const task of tasks) {
      indegree.set(task.taskId, task.dependencies.filter((d) => byId.has(d)).length);
    }
    const queue = tasks
      .filter((t) => (indegree.get(t.taskId) ?? 0) === 0)
      .sort((a, b) => a.priority - b.priority);
    const ordered: Task[] = [];
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) continue;
      ordered.push(task);
      for (const t of tasks) {
        if (t.dependencies.includes(task.taskId)) {
          const next = (indegree.get(t.taskId) ?? 0) - 1;
          indegree.set(t.taskId, next);
          if (next === 0) {
            queue.push(t);
            queue.sort((a, b) => a.priority - b.priority);
          }
        }
      }
    }
    return ordered;
  }
}
