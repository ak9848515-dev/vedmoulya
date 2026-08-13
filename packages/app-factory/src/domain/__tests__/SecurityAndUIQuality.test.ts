import { describe, expect, it } from 'vitest';
import { SecurityReviewer, severityRank } from '../SecurityReviewer.js';
import { UIQualityEvaluator } from '../UIQualityEvaluator.js';

describe('SecurityReviewer — Phase 12', () => {
  const reviewer = new SecurityReviewer();

  it('blocks on hard-coded secrets (CRITICAL/HIGH)', () => {
    const report = reviewer.review('app-1', {
      files: [
        { path: 'src/index.ts', content: 'const SECRET_TOKEN = "sk-live-abcdef0123456789abcdef";' },
      ],
      apiContract: [],
      dependencies: [],
    });
    expect(report.blocked).toBe(true);
    expect(report.summary.critical + report.summary.high).toBeGreaterThan(0);
  });

  it('flags shell execution and eval (HIGH)', () => {
    const report = reviewer.review('app-2', {
      files: [{ path: 'src/bad.ts', content: 'import { exec } from "node:child_process";' }],
      apiContract: [],
      dependencies: [],
    });
    expect(report.blocked).toBe(true);
  });

  it('flags unapproved dependencies (MEDIUM, non-blocking)', () => {
    const report = reviewer.review('app-3', {
      files: [{ path: 'src/index.ts', content: 'x' }],
      apiContract: [],
      dependencies: ['obscure-package@99'],
    });
    expect(report.blocked).toBe(false);
    expect(
      report.findings.some((f) => f.category === 'dependency' && f.severity === 'MEDIUM'),
    ).toBe(true);
  });

  it('flags injection surface (dangerous HTML)', () => {
    const report = reviewer.review('app-4', {
      files: [{ path: 'src/App.tsx', content: 'el.innerHTML = userInput;' }],
      apiContract: [],
      dependencies: [],
    });
    expect(report.blocked).toBe(true);
  });

  it('clean projects pass with only low-severity notes', () => {
    const report = reviewer.review('app-5', {
      files: [{ path: 'src/index.ts', content: 'export const x = 1;' }],
      apiContract: [],
      dependencies: ['typescript'],
    });
    expect(report.blocked).toBe(false);
    expect(report.findings.every((f) => f.severity === 'LOW')).toBe(true);
  });

  it('ranks severities', () => {
    expect(severityRank('CRITICAL')).toBeGreaterThan(severityRank('HIGH'));
    expect(severityRank('HIGH')).toBeGreaterThan(severityRank('MEDIUM'));
    expect(severityRank('MEDIUM')).toBeGreaterThan(severityRank('LOW'));
  });
});

describe('UIQualityEvaluator — Phase 11', () => {
  const evaluator = new UIQualityEvaluator();

  it('passes a production-quality UI design', () => {
    const report = evaluator.evaluate({
      files: [
        {
          path: 'src/App.tsx',
          content: 'aria-label="menu" sm:grid-cols-2 lg:grid-cols-4 dark:bg-slate-900',
        },
      ],
      uiDesign:
        'Responsive navigation with mobile breakpoints, loading skeletons, empty state, error banner, dark/light mode, design tokens and accessible focus.',
      hasAdminViews: true,
    });
    expect(report.verdict).toBe('PASS');
    expect(report.score).toBeGreaterThanOrEqual(0.7);
  });

  it('fails a technically-working-but-low-quality UI', () => {
    const report = evaluator.evaluate({
      files: [{ path: 'src/App.tsx', content: 'return <div>hello</div>;' }],
      uiDesign: 'A page.',
      hasAdminViews: true,
    });
    expect(report.verdict).toBe('FAIL');
    expect(report.score).toBeLessThan(0.7);
    expect(report.checks.some((c) => !c.passed && c.check === 'accessibility')).toBe(true);
  });
});
