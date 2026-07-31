// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career Interview Service
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { InterviewReadinessDTO, InterviewCategoryDTO } from './CareerDTO.js';

export class CareerInterviewService {
  assessReadiness(
    behavioralScore: number,
    technicalScore: number,
    systemDesignScore: number,
    mockInterviewCount: number,
    categories: InterviewCategoryDTO[],
  ): InterviewReadinessDTO {
    const overallScore = Math.round((behavioralScore + technicalScore + systemDesignScore) / 3);
    const weakAreas = categories.filter((c) => c.score < 50).map((c) => c.name);
    const strongAreas = categories.filter((c) => c.score >= 70).map((c) => c.name);

    const recommendedPractice: string[] = [];
    if (behavioralScore < 60)
      recommendedPractice.push('Practice behavioral stories using the STAR method');
    if (technicalScore < 60)
      recommendedPractice.push('Review core technical concepts and data structures');
    if (systemDesignScore < 50)
      recommendedPractice.push('Study system design fundamentals and common patterns');
    if (mockInterviewCount < 3)
      recommendedPractice.push('Schedule more mock interviews for real practice');
    if (recommendedPractice.length === 0)
      recommendedPractice.push('You are well-prepared. Consider doing a final mock interview.');

    return {
      overallScore,
      behavioralScore,
      technicalScore,
      systemDesignScore,
      questionCategories: categories,
      weakAreas,
      strongAreas,
      mockInterviewCount,
      recommendedPractice,
      lastPracticed: mockInterviewCount > 0 ? new Date().toISOString() : undefined,
    };
  }

  getDefaultCategories(): InterviewCategoryDTO[] {
    return [
      {
        name: 'Behavioral',
        score: 50,
        questionCount: 10,
        sampleQuestions: [
          'Tell me about yourself',
          'Why do you want this role?',
          'Describe a challenge you overcame',
        ],
        resources: ['STAR Method Guide'],
      },
      {
        name: 'Technical',
        score: 50,
        questionCount: 15,
        sampleQuestions: ['Reverse a linked list', 'Design a rate limiter'],
        resources: ['LeetCode', 'System Design Primer'],
      },
      {
        name: 'System Design',
        score: 40,
        questionCount: 5,
        sampleQuestions: ['Design Twitter', 'Design a URL shortener'],
        resources: ['System Design Interview'],
      },
    ];
  }

  recordMockInterview(previous: InterviewReadinessDTO): InterviewReadinessDTO {
    return {
      ...previous,
      mockInterviewCount: previous.mockInterviewCount + 1,
    };
  }
}
