import { describe, it, expect } from 'vitest';
import { CareerPortfolioService } from '../CareerPortfolioService.js';

describe('CareerPortfolioService', () => {
  it('analyzes empty portfolio', () => {
    const svc = new CareerPortfolioService();
    const p = svc.analyzePortfolio([], false, false, false, false);
    expect(p.completeness).toBe(0);
    expect(p.projectCount).toBe(0);
    expect(p.suggestions.length).toBeGreaterThanOrEqual(3);
  });

  it('analyzes complete portfolio', () => {
    const svc = new CareerPortfolioService();
    const projects = [
      {
        id: 'p1',
        title: 'Project 1',
        description: 'Desc',
        technologies: ['React', 'TS'],
        role: 'Lead',
        outcomes: ['Shipped'],
        dateCompleted: '2025-01-01',
      },
      {
        id: 'p2',
        title: 'Project 2',
        description: 'Desc',
        technologies: ['Node'],
        role: 'Dev',
        outcomes: ['Delivered'],
      },
      {
        id: 'p3',
        title: 'Project 3',
        description: 'Desc',
        technologies: ['Python'],
        role: 'Architect',
        outcomes: [],
      },
    ];
    const p = svc.analyzePortfolio(projects, true, true, true, true);
    expect(p.completeness).toBeGreaterThan(85);
    expect(p.projectCount).toBe(3);
    expect(p.technologies).toContain('React');
    expect(p.suggestions).toHaveLength(0);
  });

  it('addProject increments count and merges technologies', () => {
    const svc = new CareerPortfolioService();
    const base = svc.analyzePortfolio([], false, false, false, false);
    const updated = svc.addProject(base, {
      id: 'p1',
      title: 'New',
      description: 'D',
      technologies: ['React'],
      role: 'Dev',
      outcomes: [],
    });
    expect(updated.projectCount).toBe(1);
    expect(updated.technologies).toContain('React');
  });

  it('identifies missing platforms', () => {
    const svc = new CareerPortfolioService();
    const p = svc.analyzePortfolio([], true, false, false, true);
    expect(p.suggestions.some((s) => s.includes('GitHub'))).toBe(true);
  });

  it('caps featured projects at 3', () => {
    const svc = new CareerPortfolioService();
    const projects = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`,
      title: `P${i}`,
      description: '',
      technologies: [`Tech${i}`],
      role: 'Dev',
      outcomes: [],
    }));
    const p = svc.analyzePortfolio(projects, false, false, false, false);
    expect(p.featuredProjects).toHaveLength(3);
  });
});
