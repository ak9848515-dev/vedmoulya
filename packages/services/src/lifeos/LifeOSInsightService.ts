// ──────────────────────────────────────────────────────────────────
// VedMoulya — Life OS Cross-Domain Insight Service
// BLD-015 — Life OS Integration & Unified Experience
// ──────────────────────────────────────────────────────────────────

import type { LifeOSAIContextDTO } from './LifeOSDTO.js';

export class LifeOSInsightService {
  generateCrossDomainInsights(input: {
    totalNotifications: number;
    unreadCount: number;
    pendingDecisions: number;
    activePlans: number;
    completedToday: number;
    hasCriticalRisks: boolean;
    careerProgress: number;
    learningProgress: number;
    businessHealth: number;
    marketplaceUpdates: number;
  }): string[] {
    const insights: string[] = [];

    if (input.completedToday > 0) {
      insights.push(`Completed ${String(input.completedToday)} tasks today across all modules.`);
    }
    if (input.unreadCount > 5) {
      insights.push(`${String(input.unreadCount)} unread notifications need attention.`);
    }
    if (input.pendingDecisions > 3) {
      insights.push(`${String(input.pendingDecisions)} decisions pending across modules.`);
    }
    if (input.hasCriticalRisks) {
      insights.push('Critical risks detected in business module.');
    }
    if (input.careerProgress > 70 && input.learningProgress > 70) {
      insights.push('Strong progress in both career and learning — great alignment!');
    }
    if (input.businessHealth < 50) {
      insights.push('Business health needs attention — review KPIs and projects.');
    }
    if (input.marketplaceUpdates > 0) {
      insights.push(`${String(input.marketplaceUpdates)} marketplace updates available.`);
    }

    return insights.length > 0 ? insights : ['All modules operating normally.'];
  }

  buildAIContext(input: {
    displayName: string;
    currentFocus: string;
    recentActivity: string[];
    crossDomainInsights: string[];
    topPriorities: string[];
  }): LifeOSAIContextDTO {
    return {
      currentFocus: input.currentFocus,
      recentActivity: input.recentActivity,
      suggestedQuestions: [
        'What should I focus on today across all modules?',
        'How are my career, learning, and business goals connected?',
        'What is the most important action I can take right now?',
        'Where am I making the most progress this week?',
      ],
      contextSummary: `${input.displayName} — ${input.currentFocus}`,
      topPriorities: input.topPriorities,
      crossDomainInsights: input.crossDomainInsights,
    };
  }
}
