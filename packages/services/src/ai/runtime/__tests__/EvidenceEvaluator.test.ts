import { describe, it, expect } from 'vitest';
import { EvidenceEvaluator } from '../EvidenceEvaluator.js';
import type { EvidenceItem } from '../EvidenceEvaluator.js';

function item(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    title: 'doc',
    content:
      'VedMoulya onboards clients through lead capture, brand definition, and project scoping.',
    score: 0.9,
    source: 'knowledge_base',
    ...overrides,
  };
}

describe('EvidenceEvaluator', () => {
  it('classifies no evidence as INSUFFICIENT_EVIDENCE', () => {
    const evaluator = new EvidenceEvaluator();
    const assessment = evaluator.evaluate([]);
    expect(assessment.state).toBe('INSUFFICIENT_EVIDENCE');
    expect(assessment.evidenceCount).toBe(0);
    expect(assessment.groundedness).toBe(0);
    expect(assessment.reasons).toContain('no evidence retrieved');
  });

  it('classifies strong, non-conflicting evidence as SUFFICIENT_EVIDENCE', () => {
    const evaluator = new EvidenceEvaluator();
    const assessment = evaluator.evaluate([
      item({ title: 'a', score: 0.95 }),
      item({
        title: 'b',
        content: 'The onboarding workflow covers brand definition before scoping.',
        score: 0.9,
      }),
    ]);
    expect(assessment.state).toBe('SUFFICIENT_EVIDENCE');
    expect(assessment.groundedness).toBeGreaterThanOrEqual(0.65);
    expect(assessment.evidenceCount).toBe(2);
    expect(assessment.conflictingEvidence).toBe(false);
  });

  it('classifies weak or sparse evidence as PARTIAL_EVIDENCE', () => {
    const evaluator = new EvidenceEvaluator();
    const assessment = evaluator.evaluate([
      item({ score: 0.2 }), // low relevance
    ]);
    expect(assessment.state).toBe('PARTIAL_EVIDENCE');
    expect(assessment.evidenceCount).toBe(1);
  });

  it('detects conflicting evidence from divergent sources', () => {
    const evaluator = new EvidenceEvaluator();
    const assessment = evaluator.evaluate([
      item({ title: 'a', source: 'knowledge_base', content: 'The project deadline is Q3.' }),
      item({
        title: 'b',
        source: 'project_data',
        content: 'The project deadline was moved to Q4.',
      }),
    ]);
    expect(assessment.state).toBe('CONFLICTING_EVIDENCE');
    expect(assessment.conflictingEvidence).toBe(true);
    expect(assessment.reasons.some((r) => r.includes('disagree'))).toBe(true);
  });

  it('does not flag same-source evidence as conflicting', () => {
    const evaluator = new EvidenceEvaluator();
    const assessment = evaluator.evaluate([
      item({ title: 'a', content: 'Alpha team owns the client portal.' }),
      item({ title: 'b', content: 'Beta team owns the mobile app.' }),
    ]);
    expect(assessment.conflictingEvidence).toBe(false);
    expect(assessment.state).toBe('SUFFICIENT_EVIDENCE');
  });

  it('abstains when grounding is required and evidence is insufficient', () => {
    const evaluator = new EvidenceEvaluator();
    const insufficient = evaluator.evaluate([]);
    expect(evaluator.shouldAbstain(insufficient, true)).toBe(true);
    expect(evaluator.shouldAbstain(insufficient, false)).toBe(false);
  });

  it('abstains on conflicting evidence when grounding is required', () => {
    const evaluator = new EvidenceEvaluator();
    const conflicting = evaluator.evaluate([
      item({ title: 'a', source: 'knowledge_base', content: 'Answer is yes.' }),
      item({ title: 'b', source: 'project_data', content: 'Answer is no.' }),
    ]);
    expect(conflicting.state).toBe('CONFLICTING_EVIDENCE');
    expect(evaluator.shouldAbstain(conflicting, true)).toBe(true);
  });

  it('never abstains on sufficient or partial evidence', () => {
    const evaluator = new EvidenceEvaluator();
    const sufficient = evaluator.evaluate([
      item({ title: 'a', score: 0.95 }),
      item({ title: 'b', score: 0.9 }),
    ]);
    const partial = evaluator.evaluate([item({ score: 0.3 })]);
    expect(evaluator.shouldAbstain(sufficient, true)).toBe(false);
    expect(evaluator.shouldAbstain(partial, true)).toBe(false);
  });

  it('scales source authority and freshness into the assessment', () => {
    const evaluator = new EvidenceEvaluator();
    const stale = evaluator.evaluate([
      item({ source: 'conversation_memory', updatedAt: '2020-01-01T00:00:00Z' }),
    ]);
    expect(stale.sourceAuthority).toBeLessThan(1);
    expect(stale.sourceFreshness).toBeLessThan(0.7);
  });

  // ── AI-RUNTIME-003 calibration validation tests ────────────────────────────
  // The conflict band [0.2, 0.85] was VALIDATED, not changed (see the band
  // constants in EvidenceEvaluator.ts). A candidate 0.45 floor was measured
  // and rejected: the shortest genuine conflict (0.306) and complementary
  // same-topic evidence (0.317) are only 0.011 apart in similarity, so no
  // threshold can separate them — and missing a genuine conflict is worse
  // (serving a possibly-wrong confident answer) than a conservative false
  // abstention. The complementary-doc false positive is a documented known
  // limitation, deferred to a content-aware discriminator (AI-EVAL sprint).

  it('flags a SHORT genuine conflict (retained vs deleted, 0.31 similarity)', () => {
    // The shortest measured genuine conflict — must still abstain even though
    // its similarity (0.31) is near the complementary-evidence band.
    const evaluator = new EvidenceEvaluator();
    const assessment = evaluator.evaluate([
      item({
        title: 'a',
        source: 'knowledge_base',
        content: 'Records are retained for seven years.',
        score: 0.9,
      }),
      item({
        title: 'b',
        source: 'project_data',
        content: 'Records are deleted after thirty days.',
        score: 0.88,
      }),
    ]);
    expect(assessment.state).toBe('CONFLICTING_EVIDENCE');
    expect(evaluator.shouldAbstain(assessment, true)).toBe(true);
  });

  it('still flags the calibrated retention conflict (0.78 similarity)', () => {
    const evaluator = new EvidenceEvaluator();
    const assessment = evaluator.evaluate([
      item({
        title: 'hr',
        source: 'knowledge_base',
        content:
          'According to the HR policy, personnel records are retained for seven years after an employee leaves the company.',
        score: 0.63,
      }),
      item({
        title: 'finance',
        source: 'project_data',
        content:
          'According to the finance policy, personnel records are retained for only thirty days after an employee leaves the company.',
        score: 0.58,
      }),
    ]);
    expect(assessment.state).toBe('CONFLICTING_EVIDENCE');
    expect(evaluator.shouldAbstain(assessment, true)).toBe(true);
  });
});
