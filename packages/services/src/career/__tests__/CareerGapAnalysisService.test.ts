import { describe, it, expect } from 'vitest';
import { CareerGapAnalysisService } from '../CareerGapAnalysisService.js';

const skill = (
  name: string,
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master' = 'intermediate',
) => ({
  id: name,
  name,
  category: 'technical' as const,
  level,
  yearsOfExperience: 2,
  confidence: 0.8,
  certifications: [],
  projects: [],
  endorsements: 0,
  isVerified: false,
  isFavorite: false,
});

describe('CareerGapAnalysisService', () => {
  it('returns no gaps when all skills match required level', () => {
    const svc = new CareerGapAnalysisService();
    const gaps = svc.analyzeGaps(
      [skill('TypeScript', 'advanced')],
      [{ name: 'TypeScript', category: 'technical', requiredLevel: 'advanced' }],
    );
    expect(gaps).toHaveLength(0);
  });

  it('detects single gap when skill is below required', () => {
    const svc = new CareerGapAnalysisService();
    const gaps = svc.analyzeGaps(
      [skill('TypeScript', 'beginner')],
      [{ name: 'TypeScript', category: 'technical', requiredLevel: 'advanced' }],
    );
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.gapSize).toBe(2);
    expect(gaps[0]!.priority).toBe('high');
  });

  it('detects critical gap when gap size >=3', () => {
    const svc = new CareerGapAnalysisService();
    const gaps = svc.analyzeGaps(
      [skill('TypeScript', 'beginner')],
      [{ name: 'TypeScript', category: 'technical', requiredLevel: 'master' }],
    );
    expect(gaps[0]!.priority).toBe('critical');
    expect(gaps[0]!.gapSize).toBe(4);
  });

  it('handles missing skill as beginner', () => {
    const svc = new CareerGapAnalysisService();
    const gaps = svc.analyzeGaps(
      [],
      [{ name: 'TypeScript', category: 'technical', requiredLevel: 'intermediate' }],
    );
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.currentLevel).toBe('beginner');
  });

  it('sorts gaps by size descending', () => {
    const svc = new CareerGapAnalysisService();
    const gaps = svc.analyzeGaps(
      [skill('Small', 'beginner'), skill('Big', 'beginner')],
      [
        { name: 'Small', category: 'technical', requiredLevel: 'intermediate' },
        { name: 'Big', category: 'technical', requiredLevel: 'master' },
      ],
    );
    expect(gaps[0]!.skillName).toBe('Big');
    expect(gaps[0]!.gapSize).toBe(4);
  });

  it('getPriorityGaps filters by minimum priority', () => {
    const svc = new CareerGapAnalysisService();
    const gaps = svc.analyzeGaps(
      [skill('A', 'beginner'), skill('B', 'intermediate')],
      [
        { name: 'A', category: 'technical', requiredLevel: 'master' },
        { name: 'B', category: 'technical', requiredLevel: 'advanced' },
      ],
    );
    const critical = svc.getPriorityGaps(gaps, 'critical');
    expect(critical.length).toBeLessThan(gaps.length);
  });

  it('calculateGapClosureRate returns 100 for no gaps', () => {
    expect(new CareerGapAnalysisService().calculateGapClosureRate([])).toBe(100);
  });

  it('calculateGapClosureRate returns partial for existing gaps', () => {
    const svc = new CareerGapAnalysisService();
    const gaps = svc.analyzeGaps(
      [skill('A', 'intermediate')],
      [{ name: 'A', category: 'technical', requiredLevel: 'master' }],
    );
    const rate = svc.calculateGapClosureRate(gaps);
    expect(rate).toBeLessThan(100);
    expect(rate).toBeGreaterThan(0);
  });
});
