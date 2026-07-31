// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Recommendation Service
// BLD-012 — Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type {
  LearningRecommendationDTO,
  RevisionScheduleDTO,
  LearningStreakDTO,
} from './LearningDTO.js';

export class LearningRecommendationService {
  generateRecommendations(input: {
    revision: RevisionScheduleDTO;
    streak: LearningStreakDTO;
    topicsCompleted: number;
    assessmentsPassed: number;
    hasActivePaths: boolean;
  }): LearningRecommendationDTO[] {
    const recs: LearningRecommendationDTO[] = [];
    let priority = 1;

    if (input.revision.dueToday.length > 0) {
      recs.push(
        this.create(
          priority++,
          'revision',
          'Complete Pending Revisions',
          `${String(input.revision.dueToday.length)} topics need revision today to maintain retention.`,
          'Spaced repetition is proven to boost long-term retention.',
          '/learning/revision',
          0.9,
        ),
      );
    }

    if (!input.hasActivePaths) {
      recs.push(
        this.create(
          priority++,
          'path',
          'Start a Learning Path',
          'Choose a structured learning path to guide your studies.',
          'Structured paths increase completion rates by 60%.',
          '/learning/paths',
          0.85,
        ),
      );
    }

    if (input.assessmentsPassed < 2 && input.topicsCompleted > 3) {
      recs.push(
        this.create(
          priority++,
          'assessment',
          'Test Your Knowledge',
          "Take an assessment to validate what you've learned.",
          'Assessments identify knowledge gaps for targeted review.',
          '/learning/assessments',
          0.75,
        ),
      );
    }

    recs.push(
      this.create(
        priority++,
        'topic',
        'Explore New Topics',
        'Expand your knowledge by exploring related topics.',
        'Broad knowledge creates stronger mental models.',
        '/learning/topics',
        0.5,
      ),
    );
    recs.push(
      this.create(
        priority++,
        'resource',
        'Review Learning Resources',
        "Check your saved resources for topics you've studied.",
        'Regular review of resources reinforces learning.',
        '/learning/resources',
        0.4,
      ),
    );

    return recs;
  }

  prioritizeRecommendations(
    recs: LearningRecommendationDTO[],
    maxCount: number = 10,
  ): LearningRecommendationDTO[] {
    return recs
      .filter((r) => !r.isDismissed)
      .sort((a, b) => b.priority - a.priority || b.confidence - a.confidence)
      .slice(0, maxCount);
  }

  dismissRecommendation(
    recs: LearningRecommendationDTO[],
    id: string,
  ): LearningRecommendationDTO[] {
    return recs.map((r) => (r.id === id ? { ...r, isDismissed: true } : r));
  }

  private create(
    priority: number,
    category: LearningRecommendationDTO['category'],
    title: string,
    description: string,
    reason: string,
    actionRoute: string,
    confidence: number,
  ): LearningRecommendationDTO {
    return {
      id: `lrec_${String(Date.now())}_${String(priority)}_${Math.random().toString(36).slice(2, 8)}`,
      category,
      title,
      description,
      priority,
      confidence,
      source: 'learning',
      reason,
      actionLabel: 'View',
      actionRoute,
      isDismissed: false,
      createdAt: new Date().toISOString(),
    };
  }
}
