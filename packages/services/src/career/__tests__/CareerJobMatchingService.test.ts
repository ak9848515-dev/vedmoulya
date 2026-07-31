import { describe, it, expect } from 'vitest';
import { CareerJobMatchingService } from '../CareerJobMatchingService.js';

const job = (id: string, title: string, skills: string[], minExp: number = 2) => ({
  id,
  title,
  company: 'TestCo',
  location: 'Remote',
  requiredSkills: skills,
  preferredSkills: [],
  minExperience: minExp,
  postedDate: new Date().toISOString(),
});

describe('CareerJobMatchingService', () => {
  it('perfect match returns high fit score', () => {
    const svc = new CareerJobMatchingService();
    const matches = svc.matchJobs(
      [job('j1', 'Software Engineer', ['TypeScript', 'React'], 2)],
      ['TypeScript', 'React'],
      3,
      'Software Engineer',
    );
    expect(matches[0]!.fitScore).toBeGreaterThan(70);
    expect(matches[0]!.matchedSkills).toHaveLength(2);
  });

  it('partial match returns moderate score', () => {
    const svc = new CareerJobMatchingService();
    const matches = svc.matchJobs(
      [job('j1', 'Software Engineer', ['TypeScript', 'React', 'AWS'], 2)],
      ['TypeScript'],
      1,
      'Software Engineer',
    );
    expect(matches[0]!.fitScore).toBeLessThan(70);
    expect(matches[0]!.missingSkills).toHaveLength(2);
  });

  it('poor match with no matching skills', () => {
    const svc = new CareerJobMatchingService();
    const matches = svc.matchJobs(
      [job('j1', 'Data Scientist', ['Python', 'ML', 'Statistics'], 5)],
      ['CSS'],
      0,
      'Designer',
    );
    expect(matches[0]!.fitScore).toBeLessThan(50);
    expect(matches[0]!.matchedSkills).toHaveLength(0);
  });

  it('handles empty jobs', () => {
    expect(new CareerJobMatchingService().matchJobs([], [], 0, '')).toHaveLength(0);
  });

  it('sorts by fitScore descending', () => {
    const svc = new CareerJobMatchingService();
    const jobs = [
      job('j1', 'Engineer', ['React'], 2),
      job('j2', 'Senior Engineer', ['React', 'Node', 'AWS'], 5),
    ];
    const matches = svc.matchJobs(jobs, ['React', 'Node'], 4, 'Engineer');
    expect(matches[0]!.fitScore).toBeGreaterThanOrEqual(matches[1]!.fitScore);
  });

  it('findBestMatch returns top match', () => {
    const svc = new CareerJobMatchingService();
    const matches = svc.matchJobs([job('j1', 'Engineer', ['React'], 2)], ['React'], 2, 'Engineer');
    const best = svc.findBestMatch(matches);
    expect(best!.id).toBe('j1');
  });

  it('findBestMatch returns undefined for empty', () => {
    expect(new CareerJobMatchingService().findBestMatch([])).toBeUndefined();
  });

  it('getMatchSummary returns summary', () => {
    const svc = new CareerJobMatchingService();
    const matches = svc.matchJobs([job('j1', 'Engineer', ['React'], 2)], ['React'], 2, 'Engineer');
    const summary = svc.getMatchSummary(matches);
    expect(summary.total).toBe(1);
    expect(summary.avgFitScore).toBeGreaterThan(0);
  });

  it('getMatchSummary handles empty', () => {
    const summary = new CareerJobMatchingService().getMatchSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.avgFitScore).toBe(0);
  });
});
