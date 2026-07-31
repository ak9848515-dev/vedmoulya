import type { ExecutionPlan } from '@vedmoulya/domain';
import type { ExecutionExplanation } from '../types/ExecutionTypes.js';
import type { AIOrchestratorClient } from '../integration/AIOrchestratorClient.js';

export class ExecutionExplainabilityService {
  private readonly aiClient: AIOrchestratorClient | null;

  constructor(aiClient?: AIOrchestratorClient) {
    this.aiClient = aiClient ?? null;
  }

  /** Generate an explanation for an execution plan */
  async generateExplanation(plan: ExecutionPlan): Promise<ExecutionExplanation> {
    const bottlenecks = plan.analyzeBottlenecks();

    const explanation: ExecutionExplanation = {
      planId: plan.id,
      title: plan.title,
      planningLevel: plan.planningLevel,
      status: plan.status.toString(),
      progress: { completed: plan.progress.completed, total: plan.progress.total },
      priority: { level: plan.priority.level, score: plan.priority.score },
      goalReferences: plan.goalReferences.map((g) => ({ goalId: g.goalId, label: g.label })),
      decisionReferences: plan.decisionReferences.map((d) => ({
        decisionId: d.decisionId,
        title: d.title,
      })),
      tasksCompleted: plan.completedTasks,
      tasksTotal: plan.totalTasks,
      missionsCompleted: plan.completedMissions,
      missionsTotal: plan.totalMissions,
      bottlenecks,
      riskFactors: this.assessRiskFactors(plan),
      recoveryAttempts: this.countRecoveryAttempts(plan),
    };

    // Try AI-powered summary
    if (this.aiClient?.isEnabled()) {
      try {
        const aiSummary = await this.aiClient.generateDailyBrief(
          plan as unknown as Record<string, unknown>,
        );
        if (aiSummary) {
          return { ...explanation, riskFactors: [...explanation.riskFactors, `AI: ${aiSummary}`] };
        }
      } catch {
        // If AI fails, return standard explanation
      }
    }

    return explanation;
  }

  /** Assess risk factors for a plan */
  private assessRiskFactors(plan: ExecutionPlan): string[] {
    const risks: string[] = [];

    if (plan.progress.completed === 0 && plan.totalTasks > 0) {
      risks.push('No tasks completed yet');
    }
    const bottlenecks = plan.analyzeBottlenecks();
    if (bottlenecks.length > 0) {
      risks.push(`${String(bottlenecks.length)} bottleneck(s) identified`);
    }
    if (
      plan.totalTasks > 0 &&
      plan.progress.completed < plan.totalTasks * 0.5 &&
      plan.status.isInProgress
    ) {
      risks.push('Less than 50% progress while in progress — possible schedule risk');
    }

    return risks;
  }

  /** Count recovery attempts from metadata */
  private countRecoveryAttempts(plan: ExecutionPlan): number {
    return (plan.metadata.recoveryAttempts ?? 0) as number;
  }
}
