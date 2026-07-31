// ──────────────────────────────────────────────────────────────────
// VedMoulya — Business Execution Service
// BLD-013 — Business Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { BusinessExecutionDTO, BusinessProjectDTO } from './BusinessDTO.js';

export class BusinessExecutionService {
  private readonly executions = new Map<string, BusinessExecutionDTO>();

  getExecution(userId: string): BusinessExecutionDTO {
    const existing = this.executions.get(userId);
    if (existing) return existing;
    const exec: BusinessExecutionDTO = {
      currentPriorities: [],
      delayedWork: [],
      completedWork: [],
      blockedItems: [],
      recommendedActions: [],
      velocity: 0,
      completionRate: 0,
      onTrackTasks: 0,
      delayedTasks: 0,
      completedTasks: 0,
    };
    this.executions.set(userId, exec);
    return exec;
  }

  analyzeExecution(userId: string, projects: BusinessProjectDTO[]): BusinessExecutionDTO {
    const active = projects.filter((p) => p.status === 'in_progress');
    const blocked = projects.filter((p) => p.status === 'blocked');
    const completed = projects.filter((p) => p.status === 'completed');
    const delayed = projects.filter(
      (p) => p.targetDate && new Date(p.targetDate) < new Date() && p.status !== 'completed',
    );

    const exec: BusinessExecutionDTO = {
      currentPriorities: active
        .sort((a, b) => {
          const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
          return (order[a.priority] ?? 99) - (order[b.priority] ?? 99);
        })
        .map((p) => p.title),
      delayedWork: delayed.map((p) => p.title),
      completedWork: completed.map((p) => p.title),
      blockedItems: blocked.map((p) => p.title),
      recommendedActions: this.generateRecommendedActions(blocked, active),
      velocity:
        active.length > 0
          ? Math.round(active.reduce((s, p) => s + p.progress, 0) / active.length)
          : 0,
      completionRate:
        projects.length > 0 ? Math.round((completed.length / projects.length) * 100) : 0,
      onTrackTasks: active.length - delayed.length,
      delayedTasks: delayed.length,
      completedTasks: completed.length,
    };
    this.executions.set(userId, exec);
    return exec;
  }

  private generateRecommendedActions(
    blocked: BusinessProjectDTO[],
    active: BusinessProjectDTO[],
  ): string[] {
    const actions: string[] = [];
    if (blocked.length > 0)
      actions.push(
        `Resolve blockers for ${String(blocked.length)} blocked project${blocked.length > 1 ? 's' : ''}`,
      );
    if (active.length > 0)
      actions.push(`Focus on completing ${active[0]?.title ?? 'priority projects'}`);
    actions.push('Review and update project timelines');
    return actions;
  }
}
