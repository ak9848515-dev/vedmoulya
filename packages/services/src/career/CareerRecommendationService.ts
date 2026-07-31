// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career Recommendation Service
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type {
  CareerRecommendationDTO,
  SkillGapDTO,
  InterviewReadinessDTO,
  ResumeHealthDTO,
} from './CareerDTO.js';

export class CareerRecommendationService {
  generateRecommendations(input: {
    gaps: SkillGapDTO[];
    interview: InterviewReadinessDTO;
    resume: ResumeHealthDTO;
    hasPortfolio: boolean;
    certProgress: number;
    applicationsActive: boolean;
  }): CareerRecommendationDTO[] {
    const recommendations: CareerRecommendationDTO[] = [];
    let priority = 1;

    // Skill-based recommendations
    const criticalGaps = input.gaps.filter((g) => g.priority === 'critical');
    for (const gap of criticalGaps) {
      if (priority <= 10) {
        recommendations.push(
          this.createRec(
            priority++,
            'skill',
            `Learn ${gap.skillName}`,
            `This ${gap.category} skill is critical for your target role. Level up from ${gap.currentLevel} to ${gap.requiredLevel}.`,
            'Closing this gap will significantly improve your job match scores.',
            '/career/skills',
            0.9,
          ),
        );
      }
    }

    // Interview recommendations
    if (input.interview.overallScore < 60) {
      recommendations.push(
        this.createRec(
          priority++,
          'interview',
          'Improve Interview Readiness',
          `Your overall interview score is ${String(input.interview.overallScore)}/100. Focus on ${input.interview.weakAreas.slice(0, 2).join(', ')}.`,
          'Interview preparation directly impacts job offer rates.',
          '/career/interview',
          0.85,
        ),
      );
    }

    // Resume recommendations
    if (input.resume.completeness < 70) {
      recommendations.push(
        this.createRec(
          priority++,
          'resume',
          'Optimize Your Resume',
          `Your resume completeness is ${String(input.resume.completeness)}%. ${input.resume.missingSections.length > 0 ? `Add missing sections: ${input.resume.missingSections.join(', ')}` : 'Improve existing sections.'}`,
          'A well-optimized resume increases interview callbacks.',
          '/career/resume',
          0.8,
        ),
      );
    }

    // Learning recommendations
    recommendations.push(
      this.createRec(
        priority++,
        'learning',
        'Expand Your Skills',
        'Consider adding complementary skills to increase your market value.',
        'Continuous learning is key to career growth.',
        '/career/learning',
        0.5,
      ),
    );
    recommendations.push(
      this.createRec(
        priority++,
        'career',
        'Review Career Goals',
        'Take time to assess and refine your career goals based on market insights.',
        'Clear goals drive focused skill development.',
        '/career/roadmap',
        0.6,
      ),
    );

    // Certification recommendations
    if (input.certProgress < 50) {
      recommendations.push(
        this.createRec(
          priority++,
          'certification',
          'Pursue Relevant Certifications',
          'Certifications can boost your resume and validate your skills to employers.',
          'Certified professionals earn 10-20% more on average.',
          '/career/certifications',
          0.7,
        ),
      );
    }

    // Portfolio recommendations
    if (!input.hasPortfolio) {
      recommendations.push(
        this.createRec(
          priority++,
          'project',
          'Build Your Portfolio',
          'Create projects that demonstrate your skills to potential employers.',
          'A strong portfolio often matters more than a resume.',
          '/career/portfolio',
          0.75,
        ),
      );
    }

    return recommendations;
  }

  prioritizeRecommendations(
    recommendations: CareerRecommendationDTO[],
    maxCount: number = 10,
  ): CareerRecommendationDTO[] {
    return recommendations
      .filter((r) => !r.isDismissed)
      .sort((a, b) => b.priority - a.priority || b.confidence - a.confidence)
      .slice(0, maxCount);
  }

  dismissRecommendation(
    recommendations: CareerRecommendationDTO[],
    id: string,
  ): CareerRecommendationDTO[] {
    return recommendations.map((r) => (r.id === id ? { ...r, isDismissed: true } : r));
  }

  private createRec(
    priority: number,
    category: CareerRecommendationDTO['category'],
    title: string,
    description: string,
    reason: string,
    actionRoute: string,
    confidence: number,
  ): CareerRecommendationDTO {
    return {
      id: `crec_${String(Date.now())}_${String(priority)}_${Math.random().toString(36).slice(2, 8)}`,
      category,
      title,
      description,
      priority,
      confidence,
      source: 'career',
      reason,
      actionLabel: 'View',
      actionRoute,
      isDismissed: false,
      createdAt: new Date().toISOString(),
    };
  }
}
