import { describe, it, expect } from 'vitest';
import { CareerDTOMapper } from '../CareerDTOMapper.js';
import type { UserDTO } from '../../identity/UserDTO.js';

const mockUser: UserDTO = {
  id: 'u1',
  email: 'test@example.com',
  displayName: 'Test User',
  givenName: 'Test',
  familyName: 'User',
  avatarUrl: undefined,
  bio: '',
  timezone: 'UTC',
  locale: 'en-US',
  theme: 'system',
  language: 'en',
  statusState: 'active',
  emailVerified: true,
  twoFactorEnabled: false,
  profileVisibility: 'public',
  entityStatus: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};

describe('CareerDTOMapper', () => {
  describe('toProfile', () => {
    it('maps UserDTO to CareerProfileDTO', () => {
      const m = new CareerDTOMapper();
      const p = m.toProfile(mockUser, 'Engineer', 'Tech', 5);
      expect(p.userId).toBe('u1');
      expect(p.displayName).toBe('Test User');
      expect(p.currentTitle).toBe('Engineer');
      expect(p.yearsOfExperience).toBe(5);
      expect(p.careerStage).toBe('exploring');
    });
  });

  describe('toSkillInventory', () => {
    it('creates inventory from skills', () => {
      const m = new CareerDTOMapper();
      const inv = m.toSkillInventory([
        {
          id: 's1',
          name: 'TS',
          category: 'technical',
          level: 'advanced',
          yearsOfExperience: 3,
          confidence: 0.9,
          certifications: [],
          projects: [],
          endorsements: 0,
          isVerified: false,
          isFavorite: false,
        },
      ]);
      expect(inv.totalCount).toBe(1);
    });
  });

  describe('toGapResults', () => {
    it('sorts gaps by priority then size', () => {
      const m = new CareerDTOMapper();
      const gaps = m.toGapResults([
        {
          skillName: 'B',
          category: 'technical',
          currentLevel: 'beginner',
          requiredLevel: 'intermediate',
          gapSize: 3,
          priority: 'critical',
          recommendedResources: [],
          estimatedTimeToClose: 120,
          relevanceToGoal: 25,
        },
        {
          skillName: 'A',
          category: 'technical',
          currentLevel: 'beginner',
          requiredLevel: 'intermediate',
          gapSize: 1,
          priority: 'critical',
          recommendedResources: [],
          estimatedTimeToClose: 40,
          relevanceToGoal: 75,
        },
      ]);
      expect(gaps[0]!.skillName).toBe('B');
      expect(gaps[0]!.gapSize).toBe(3);
    });
  });

  describe('toRoadmap', () => {
    it('builds roadmap DTO', () => {
      const m = new CareerDTOMapper();
      const r = m.toRoadmap('exploring', 'senior', [], [], 48, 25);
      expect(r.currentStage).toBe('exploring');
      expect(r.estimatedTimelineMonths).toBe(48);
      expect(r.flexibilityScore).toBe(75);
    });
  });

  describe('toResumeHealth', () => {
    it('maps resume analysis', () => {
      const m = new CareerDTOMapper();
      const r = m.toResumeHealth(80, 70, [], [], ['Fix this'], { javascript: 3 });
      expect(r.completeness).toBe(80);
      expect(r.atsScore).toBe(70);
      expect(r.keywordDensity.javascript).toBe(3);
    });
  });

  describe('toPortfolioHealth', () => {
    it('maps portfolio health', () => {
      const m = new CareerDTOMapper();
      const p = m.toPortfolioHealth(60, 2, ['React'], ['Add more']);
      expect(p.completeness).toBe(60);
      expect(p.technologies).toContain('React');
    });
  });

  describe('toInterviewReadiness', () => {
    it('maps interview readiness', () => {
      const m = new CareerDTOMapper();
      const r = m.toInterviewReadiness(70, 80, 60, ['Tech'], ['Behavioral']);
      expect(r.overallScore).toBe(70);
      expect(r.weakAreas).toContain('Tech');
    });
  });

  describe('toJobMatches', () => {
    it('sorts jobs by fitScore descending', () => {
      const m = new CareerDTOMapper();
      const j = m.toJobMatches([
        {
          id: 'j1',
          title: 'T1',
          company: 'C1',
          location: 'L',
          fitScore: 50,
          skillMatch: 50,
          experienceMatch: 50,
          growthPotential: 50,
          marketDemand: 50,
          matchedSkills: [],
          missingSkills: [],
          relevance: 50,
        },
        {
          id: 'j2',
          title: 'T2',
          company: 'C2',
          location: 'L',
          fitScore: 80,
          skillMatch: 80,
          experienceMatch: 80,
          growthPotential: 80,
          marketDemand: 80,
          matchedSkills: [],
          missingSkills: [],
          relevance: 80,
        },
      ]);
      expect(j[0]!.fitScore).toBe(80);
    });
  });

  describe('toMarketInsight', () => {
    it('creates market insight DTO', () => {
      const m = new CareerDTOMapper();
      const mi = m.toMarketInsight('Tech');
      expect(mi.industry).toBe('Tech');
    });
  });

  describe('toCertifications', () => {
    it('sorts certs by progress descending', () => {
      const m = new CareerDTOMapper();
      const c = m.toCertifications([
        {
          id: 'c1',
          name: 'C1',
          provider: 'AWS',
          status: 'in_progress',
          progress: 30,
          estimatedStudyHours: 100,
          cost: 150,
          skills: [],
          isVerified: false,
        },
        {
          id: 'c2',
          name: 'C2',
          provider: 'AWS',
          status: 'completed',
          progress: 100,
          estimatedStudyHours: 100,
          cost: 150,
          skills: [],
          isVerified: false,
        },
      ]);
      expect(c[0]!.progress).toBe(100);
    });
  });

  describe('toTimeline', () => {
    it('maps entries to timeline DTO', () => {
      const m = new CareerDTOMapper();
      const t = m.toTimeline([
        {
          id: 'e1',
          type: 'experience',
          title: 'T',
          description: 'D',
          date: '',
          importance: 5,
          icon: 'briefcase',
        },
      ]);
      expect(t.totalEntries).toBe(1);
      expect(t.hasMore).toBe(false);
    });

    it('sets hasMore when ≥20 entries', () => {
      const m = new CareerDTOMapper();
      const entries = Array.from({ length: 20 }, (_, i) => ({
        id: `e${i}`,
        type: 'experience' as const,
        title: 'T',
        description: '',
        date: '',
        importance: 5,
        icon: 'briefcase',
      }));
      expect(m.toTimeline(entries).hasMore).toBe(true);
    });
  });

  describe('createQuickAction', () => {
    it('creates quick action with defaults', () => {
      const m = new CareerDTOMapper();
      const a = m.createQuickAction('qa1', 'Test', 'Desc', 'icon', '/route', 1, 'career');
      expect(a.isAvailable).toBe(true);
    });

    it('creates disabled quick action', () => {
      const m = new CareerDTOMapper();
      const a = m.createQuickAction(
        'qa2',
        'Test',
        'Desc',
        'icon',
        '/route',
        1,
        'career',
        false,
        'Reason',
      );
      expect(a.isAvailable).toBe(false);
      expect(a.disabledReason).toBe('Reason');
    });
  });

  describe('createHealthIndicator', () => {
    it('returns healthy', () => {
      const m = new CareerDTOMapper();
      const h = m.createHealthIndicator([{ name: 'svc', status: 'healthy', latency: 5 }]);
      expect(h.overall).toBe('healthy');
    });

    it('returns critical when down', () => {
      const m = new CareerDTOMapper();
      const h = m.createHealthIndicator([{ name: 'svc', status: 'down', latency: 0 }]);
      expect(h.overall).toBe('critical');
    });

    it('returns degraded', () => {
      const m = new CareerDTOMapper();
      const h = m.createHealthIndicator([{ name: 'svc', status: 'degraded', latency: 500 }]);
      expect(h.overall).toBe('degraded');
    });
  });

  describe('aggregateMetrics', () => {
    it('aggregates all metrics', () => {
      const m = new CareerDTOMapper();
      const r = m.aggregateMetrics({
        careerScore: 70,
        skillGrowthRate: 60,
        interviewReadiness: 50,
        resumeHealth: 40,
        portfolioHealth: 30,
        jobMatchCount: 3,
        marketFitScore: 50,
        certificationProgress: 60,
        networkingScore: 40,
        learningHoursThisMonth: 10,
        applicationsThisMonth: 5,
        interviewConversionRate: 50,
      });
      expect(r.careerScore).toBe(70);
      expect(r.overallProgress).toBeGreaterThan(0);
    });
  });
});
