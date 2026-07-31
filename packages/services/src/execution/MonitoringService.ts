// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Monitoring Service
// Monitoring and bottleneck analysis for Execution
// BLD-009 — Execution Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import type { ExecutionRepository } from '@vedmoulya/domain';
import type { BottleneckDTO, ExecutionStatsDTO } from './ExecutionDTO.js';

export class MonitoringService {
  private readonly repository: ExecutionRepository;

  constructor(repository: ExecutionRepository) {
    this.repository = repository;
  }

  /** Analyze bottlenecks across all active plans */
  async analyzeBottlenecks(
    planId: string,
  ): Promise<{ success: boolean; data?: BottleneckDTO[]; error?: string }> {
    try {
      const plan = await this.repository.findById(planId);
      if (!plan) return { success: false, error: `Plan not found: ${planId}` };

      const bottlenecks = plan.analyzeBottlenecks();
      return {
        success: true,
        data: bottlenecks.map((b) => ({
          entityId: b.entityId,
          entityType: b.entityType,
          issue: b.issue,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bottleneck analysis error',
      };
    }
  }

  /** Get execution statistics */
  async getStats(): Promise<{ success: boolean; data?: ExecutionStatsDTO; error?: string }> {
    try {
      const [totalPlans, activePlans, overduePlans] = await Promise.all([
        this.repository.count(),
        this.repository.countActive(),
        this.repository.countOverdue(),
      ]);
      const byStatus = await this.repository.countByStatus();
      const completedPlans = byStatus['completed'] ?? 0;
      const completionRate = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;

      return {
        success: true,
        data: { totalPlans, activePlans, completedPlans, overduePlans, completionRate },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Stats error' };
    }
  }

  /** Get plans that are behind schedule */
  async getAtRiskPlans(): Promise<{
    success: boolean;
    data?: Array<{ id: string; title: string; reason: string }>;
    error?: string;
  }> {
    try {
      const activePlans = await this.repository.search(
        { query: '', statuses: ['in_progress'] },
        { page: 1, limit: 100 },
      );

      const atRisk = activePlans.data
        .filter((p) => p.progress.isAtRisk)
        .map((p) => ({
          id: p.id,
          title: p.title,
          reason: `Progress is ${String(p.progress.percentage)}% with ${String(p.totalTasks - p.completedTasks)} tasks remaining`,
        }));

      return { success: true, data: atRisk };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'At-risk analysis error',
      };
    }
  }
}
