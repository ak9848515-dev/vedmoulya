// ──────────────────────────────────────────────────────────────────
// VedMoulya — GitHubRepositoryIntelligence tests
// EPIC-012C — repository usefulness, NOT star-count popularity (§6)
//
// Verifies: license handling, abandonment/inactivity detection,
// suspicious-pattern detection, documentation quality, and the
// evidence-backed flags + security considerations. A repository is
// never recommended because it has many stars.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { GitHubRepositoryIntelligenceEngine } from '../domain/GitHubRepositoryIntelligence.js';
import { NOW } from './fixtures.js';

const engine = new GitHubRepositoryIntelligenceEngine();
const now = (): Date => NOW;

function monthsAgo(months: number): string {
  const d = new Date(NOW.getTime() - months * 30 * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

describe('GitHubRepositoryIntelligence — repository classification', () => {
  it('records a permissive license as declared and unproblematic', () => {
    const result = engine.analyze(
      {
        name: 'a/b',
        license: 'MIT',
        description: 'A well documented open-source project with a long README.',
      },
      now,
    );
    expect(result.license).toBe('MIT');
    expect(result.licenseConfidence).toBe('PROVIDER_DECLARED');
    expect(result.flags).not.toContain('unclear_license');
    expect(result.selfHostable).toBe('yes');
  });

  it('flags unclear license wording', () => {
    const result = engine.analyze({ name: 'a/b', license: 'Unlicensed' }, now);
    expect(result.flags).toContain('unclear_license');
    expect(result.flagEvidence.unclear_license).toBeTruthy();
    expect(result.securityConsiderations.length).toBeGreaterThan(0);
  });

  it('flags a repository with no license field at all', () => {
    const result = engine.analyze({ name: 'a/b' }, now);
    expect(result.flags).toContain('unclear_license');
    expect(result.licenseConfidence).toBe('UNKNOWN');
  });

  it('detects an abandoned repository (no commits for over a year)', () => {
    const result = engine.analyze(
      { name: 'a/b', license: 'MIT', lastCommitAt: monthsAgo(15) },
      now,
    );
    expect(result.flags).toContain('abandoned');
    expect(result.flags).toContain('inactive_development');
    expect(result.flagEvidence.abandoned).toContain('months ago');
  });

  it('detects inactive development without full abandonment (3–12 months)', () => {
    const result = engine.analyze({ name: 'a/b', license: 'MIT', lastCommitAt: monthsAgo(4) }, now);
    expect(result.flags).not.toContain('abandoned');
    expect(result.flags).toContain('inactive_development');
  });

  it('does not flag recent, active development', () => {
    const result = engine.analyze(
      { name: 'a/b', license: 'Apache-2.0', lastCommitAt: monthsAgo(0.5) },
      now,
    );
    expect(result.flags).not.toContain('abandoned');
    expect(result.flags).not.toContain('inactive_development');
  });

  it('flags suspicious credential-collection wording in the description', () => {
    const result = engine.analyze(
      {
        name: 'a/b',
        description: 'Collect your API key and upload it to our server for analysis.',
      },
      now,
    );
    expect(result.flags).toContain('suspicious');
    expect(result.securityConsiderations.length).toBeGreaterThan(0);
  });

  it('flags keylogger / remote-control terminology', () => {
    const result = engine.analyze(
      { name: 'a/b', description: 'Includes a keylogger and remote shell.' },
      now,
    );
    expect(result.flags).toContain('suspicious');
  });

  it('flags low documentation when there is no description', () => {
    const result = engine.analyze({ name: 'a/b' }, now);
    expect(result.flags).toContain('low_documentation');
    expect(result.documentationQuality).toBe('unknown');
    expect(result.deploymentComplexity).toBe('UNKNOWN');
  });

  it('rates a rich description as good documentation with medium deployment complexity', () => {
    const longDescription =
      'An open-source framework that provides comprehensive tooling for building and evaluating LLM applications with extensive documentation and community examples.';
    const result = engine.analyze(
      { name: 'a/b', description: longDescription, license: 'MIT' },
      now,
    );
    expect(result.documentationQuality).toBe('good');
    expect(result.deploymentComplexity).toBe('medium');
    expect(result.flags).not.toContain('low_documentation');
  });

  it('keeps stars/forks as adoption facts only — never quality proxies', () => {
    const result = engine.analyze(
      { name: 'a/b', license: 'MIT', stars: 150000, forks: 30000, lastCommitAt: monthsAgo(20) },
      now,
    );
    // Even with a huge star count, abandonment evidence still flags it.
    expect(result.stars).toBe(150000);
    expect(result.flags).toContain('abandoned');
  });
});
