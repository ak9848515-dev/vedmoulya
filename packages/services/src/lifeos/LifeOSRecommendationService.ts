// ──────────────────────────────────────────────────────────────────
// VedMoulya — Life OS Cross-Domain Recommendation Service
// BLD-015 — Life OS Integration & Unified Experience
// ──────────────────────────────────────────────────────────────────

import type { LifeOSRecommendationDTO, LifeOSModule } from './LifeOSDTO.js';

export class LifeOSRecommendationService {
  generateCrossDomainRecommendations(input: {
    careerProgress: number;
    learningProgress: number;
    businessGoalsAtRisk: number;
    hasCriticalRisks: boolean;
    marketplaceUpdates: number;
    pendingDecisions: number;
    hasBlockedProjects: boolean;
    skillGaps: number;
  }): LifeOSRecommendationDTO[] {
    const recs: LifeOSRecommendationDTO[] = [];
    let priority = 1;

    // Career + Learning: Skill gaps
    if (input.skillGaps > 0 && input.learningProgress < 50) {
      recs.push(
        this.create(
          priority++,
          0.95,
          'Career + Learning',
          'Close Skill Gaps with Learning',
          `You have ${String(input.skillGaps)} skill gaps. Start targeted learning paths to close them.`,
          'Focus on skills that align with your career goals.',
          ['career', 'learning'],
          '/career/skills',
        ),
      );
    }
    // Learning + Business: Apply learning to business
    if (input.learningProgress > 70 && input.businessGoalsAtRisk > 0) {
      recs.push(
        this.create(
          priority++,
          0.9,
          'Learning + Business',
          'Apply Learning to Business Goals',
          'Your learning progress is strong. Apply new skills to at-risk business goals.',
          'Transfer learning into practical business outcomes.',
          ['learning', 'business'],
          '/learning/projects',
        ),
      );
    }
    // Business + Marketplace: New tools
    if (input.marketplaceUpdates > 0 && input.businessGoalsAtRisk > 0) {
      recs.push(
        this.create(
          priority++,
          0.85,
          'Business + Marketplace',
          'Discover Tools for Business Goals',
          `${String(input.marketplaceUpdates)} marketplace updates available. Find assets that support your business objectives.`,
          'New marketplace assets can accelerate business execution.',
          ['business', 'marketplace'],
          '/marketplace/catalog',
        ),
      );
    }
    // Career + Projects: Apply skills
    if (input.careerProgress > 50 && input.hasBlockedProjects) {
      recs.push(
        this.create(
          priority++,
          0.8,
          'Career + Projects',
          'Apply Career Skills to Unblock Projects',
          'Your career growth provides skills that can help resolve blocked projects.',
          'Use newly acquired skills to overcome project obstacles.',
          ['career', 'learning'],
          '/career/roadmap',
        ),
      );
    }
    // Execution + Memory: Reflect on patterns
    if (input.pendingDecisions > 3) {
      recs.push(
        this.create(
          priority++,
          0.75,
          'Execution + Memory',
          'Review Past Decisions for Guidance',
          `${String(input.pendingDecisions)} decisions pending. Review past outcomes for better choices.`,
          'Past decisions contain valuable patterns for current challenges.',
          ['dashboard', 'career'],
          '/decisions',
        ),
      );
    }
    // Decision + Dashboard: Prioritize
    if (input.hasCriticalRisks) {
      recs.push(
        this.create(
          priority++,
          0.7,
          'Decision + Dashboard',
          'Address Critical Risks on Dashboard',
          'Critical risks detected across modules. Review your dashboard for a unified view.',
          'Cross-module risks need immediate attention.',
          ['business', 'dashboard'],
          '/dashboard',
        ),
      );
    }
    // General: Review all activity
    recs.push(
      this.create(
        priority++,
        0.5,
        'All Modules',
        'Weekly Life OS Review',
        'Schedule a weekly review across all modules to stay aligned with your goals.',
        'Regular cross-module reviews improve overall life score.',
        ['dashboard', 'career', 'learning', 'business', 'marketplace'],
        '/lifeos/review',
      ),
    );

    return recs;
  }

  prioritizeRecommendations(
    recs: LifeOSRecommendationDTO[],
    maxCount: number = 10,
  ): LifeOSRecommendationDTO[] {
    return recs
      .filter((r) => !r.isDismissed)
      .sort((a, b) => b.priority - a.priority || b.confidence - a.confidence)
      .slice(0, maxCount);
  }

  dismissRecommendation(recs: LifeOSRecommendationDTO[], id: string): LifeOSRecommendationDTO[] {
    return recs.map((r) => (r.id === id ? { ...r, isDismissed: true } : r));
  }

  private create(
    priority: number,
    confidence: number,
    category: string,
    title: string,
    description: string,
    reason: string,
    sources: LifeOSModule[],
    actionRoute: string,
  ): LifeOSRecommendationDTO {
    return {
      id: `lrec_${String(Date.now())}_${String(priority)}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      description,
      priority,
      confidence,
      sources,
      reason,
      actionLabel: 'View',
      actionRoute,
      isDismissed: false,
      category,
      createdAt: new Date().toISOString(),
    };
  }
}
