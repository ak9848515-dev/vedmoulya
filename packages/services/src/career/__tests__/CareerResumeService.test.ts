import { describe, it, expect } from 'vitest';
import { CareerResumeService } from '../CareerResumeService.js';

describe('CareerResumeService', () => {
  it('analyzes empty resume', () => {
    const svc = new CareerResumeService();
    const r = svc.analyzeResume([]);
    expect(r.completeness).toBeLessThan(50);
    expect(r.atsScore).toBe(0);
    expect(r.missingSections).toContain('contact');
    expect(r.missingSections).toContain('summary');
  });

  it('analyzes complete resume with perfect ATS', () => {
    const svc = new CareerResumeService();
    const r = svc.analyzeResume([
      {
        name: 'contact',
        content: 'John Doe\njohn@example.com\n555-123-4567\nlinkedin.com/in/johndoe',
      },
      {
        name: 'summary',
        content:
          'Experienced engineer who achieved results and improved systems. Led teams. Created solutions. ' +
          'x'.repeat(200),
      },
      {
        name: 'experience',
        content:
          'Led development of 5 major features. Improved performance by 40%. Managed team of 10. Created CI/CD pipeline.',
      },
      { name: 'education', content: 'BS Computer Science, GPA 3.8' },
      { name: 'skills', content: 'JavaScript, Python, React, AWS, Docker, SQL' },
    ]);
    expect(r.completeness).toBeGreaterThan(40);
    expect(r.atsScore).toBeGreaterThan(80);
    expect(r.missingSections).toHaveLength(0);
  });

  it('identifies missing sections', () => {
    const svc = new CareerResumeService();
    const r = svc.analyzeResume([{ name: 'contact', content: 'email@example.com' }]);
    expect(r.missingSections.length).toBeGreaterThanOrEqual(4);
  });

  it('detects keywords in resume', () => {
    const svc = new CareerResumeService();
    const r = svc.analyzeResume([
      { name: 'skills', content: 'JavaScript and Python and JavaScript again' },
    ]);
    expect(r.keywordDensity.javascript).toBe(2);
    expect(r.keywordDensity.python).toBe(1);
  });

  it('generates suggestions for low ATS', () => {
    const svc = new CareerResumeService();
    const r = svc.analyzeResume([{ name: 'contact', content: 'a' }]);
    expect(r.suggestions.length).toBeGreaterThan(0);
  });

  it('adds section-specific suggestions', () => {
    const svc = new CareerResumeService();
    const r = svc.analyzeResume([
      { name: 'contact', content: 'test@example.com' },
      { name: 'experience', content: 'Did stuff' }, // no numbers
      { name: 'summary', content: 'Short' }, // < 200 chars
      { name: 'education', content: 'BS' },
      { name: 'skills', content: 'JS' },
    ]);
    const allSuggestions = r.sections.flatMap((s) => s.suggestions);
    expect(allSuggestions.some((s) => s.includes('quantifiable'))).toBe(true);
    expect(allSuggestions.some((s) => s.includes('brief'))).toBe(true);
  });
});
