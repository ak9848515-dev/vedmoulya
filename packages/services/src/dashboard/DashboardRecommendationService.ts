// ──────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Recommendation Service
// Generates aggregated recommendations from all modules
// BLD-010 — Dashboard Experience Platform
// ──────────────────────────────────────────────────────────────────

import type {
  RecommendationDTO,
  IdentityCardDTO,
  ExecutionCardDTO,
  DecisionCardDTO,
  MemoryCardDTO,
  JourneyDTO,
} from './DashboardDTO.js';

interface RecommendationInput {
  identity: IdentityCardDTO;
  execution: ExecutionCardDTO;
  decisions: DecisionCardDTO;
  memory: MemoryCardDTO;
  journey: JourneyDTO;
}

export class DashboardRecommendationService {
  /** Generate recommendations based on current dashboard state */
  generateRecommendations(input: RecommendationInput): RecommendationDTO[] {
    const recommendations: RecommendationDTO[] = [];
    let priority = 1;

    // Execution-based recommendations
    if (input.execution.blockedPlans > 0) {
      recommendations.push(
        this.createRec(
          priority++,
          'productivity',
          'Unblock Your Plans',
          `You have ${String(input.execution.blockedPlans)} blocked plan${input.execution.blockedPlans > 1 ? 's' : ''}. Review and resolve blockers to regain momentum.`,
          'Blocked plans slow down progress. Identify dependencies or bottlenecks.',
          '/execution',
          0.85,
        ),
      );
    }

    if (input.execution.recoverySuggestions.length > 0) {
      recommendations.push(
        this.createRec(
          priority++,
          'productivity',
          'Recovery Suggestions Available',
          input.execution.recoverySuggestions[0] ?? '',
          'AI analysis suggests recovery actions for your plans.',
          '/execution/recovery',
          0.75,
        ),
      );
    }

    // Decision-based recommendations
    if (input.decisions.pendingDecisions > 3) {
      recommendations.push(
        this.createRec(
          priority++,
          'productivity',
          'Clear Pending Decisions',
          `You have ${String(input.decisions.pendingDecisions)} pending decisions. Review them to reduce cognitive load.`,
          'Accumulated pending decisions can cause decision fatigue.',
          '/decisions',
          0.8,
        ),
      );
    }

    if (input.decisions.highRiskDecisions > 0) {
      recommendations.push(
        this.createRec(
          priority++,
          'productivity',
          'High Risk Decisions Need Attention',
          `${String(input.decisions.highRiskDecisions)} decision${input.decisions.highRiskDecisions > 1 ? 's' : ''} ha${input.decisions.highRiskDecisions > 1 ? 've' : 's'} high risk indicators. Review mitigation strategies.`,
          'High-risk decisions benefit from additional analysis.',
          '/decisions/risk',
          0.9,
        ),
      );
    }

    // Memory-based recommendations
    if (input.memory.reflectionPrompts.length > 0) {
      recommendations.push(
        this.createRec(
          priority++,
          'relationships',
          'Time for Reflection',
          input.memory.reflectionPrompts[0] ?? '',
          'Regular reflection strengthens memory consolidation and self-awareness.',
          '/memories',
          0.6,
        ),
      );
    }

    // Journey-based recommendations
    if (input.journey.consistency < 40) {
      recommendations.push(
        this.createRec(
          priority++,
          'productivity',
          'Build Consistency',
          'Your consistency score is low. Focus on completing at least 50% of daily tasks.',
          'Small, consistent actions compound into significant progress.',
          '/journey',
          0.7,
        ),
      );
    }

    if (input.journey.momentum < 30) {
      recommendations.push(
        this.createRec(
          priority++,
          'health',
          'Regain Momentum',
          'Start with one small achievable task to rebuild momentum.',
          'Momentum can be rebuilt with small wins.',
          '/journey',
          0.7,
        ),
      );
    }

    // Learning recommendations
    recommendations.push(
      this.createRec(
        priority++,
        'learning',
        'Explore New Skills',
        'Consider adding a new learning goal aligned with your purpose.',
        'Continuous learning is key to personal growth.',
        '/learning',
        0.5,
      ),
    );

    // Career recommendations
    recommendations.push(
      this.createRec(
        priority++,
        'career',
        'Review Career Progress',
        'Take time to assess your career trajectory and identify growth opportunities.',
        'Regular career reviews help align actions with long-term goals.',
        '/career',
        0.5,
      ),
    );

    // Health recommendations
    if (input.execution.totalEstimatedMinutes > 480) {
      recommendations.push(
        this.createRec(
          priority++,
          'health',
          'Avoid Burnout',
          'Your scheduled tasks exceed 8 hours. Consider reducing load or delegating.',
          'Overloading leads to burnout and reduced effectiveness.',
          '/execution/balance',
          0.85,
        ),
      );
    }

    return recommendations;
  }

  /** Prioritize and filter recommendations */
  prioritizeRecommendations(
    recommendations: RecommendationDTO[],
    maxCount: number = 10,
  ): RecommendationDTO[] {
    return recommendations
      .filter((r) => !r.isDismissed)
      .sort((a, b) => b.priority - a.priority || b.confidence - a.confidence)
      .slice(0, maxCount);
  }

  /** Dismiss a recommendation */
  dismissRecommendation(recommendations: RecommendationDTO[], id: string): RecommendationDTO[] {
    return recommendations.map((r) => (r.id === id ? { ...r, isDismissed: true } : r));
  }

  private createRec(
    priority: number,
    category: RecommendationDTO['category'],
    title: string,
    description: string,
    reason: string,
    actionRoute: string,
    confidence: number,
  ): RecommendationDTO {
    return {
      id: `rec_${String(Date.now())}_${String(priority)}_${Math.random().toString(36).slice(2, 8)}`,
      category,
      title,
      description,
      priority,
      confidence,
      source: 'dashboard',
      reason,
      actionLabel: 'View',
      actionRoute,
      isDismissed: false,
      createdAt: new Date().toISOString(),
    };
  }
}
