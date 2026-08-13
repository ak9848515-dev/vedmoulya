import { describe, expect, it } from 'vitest';
import { CriticEvaluator, estimateTokens } from '../CriticEvaluator.js';

const successCriteria = [
  {
    criterionId: 'c1',
    description: 'sections',
    requiredSections: ['Diagnosis', 'Explanation', 'Corrected Code', 'Validation'],
    minLength: 50,
  },
];

describe('CriticEvaluator', () => {
  const critic = new CriticEvaluator();

  it('returns PASS when every check passes', () => {
    const result = critic.evaluate({
      output:
        '## Diagnosis\nroot cause\n## Explanation\nwhy\n## Corrected Code\ncode\n## Validation\npass',
      successCriteria,
      evidenceState: 'SUFFICIENT_EVIDENCE',
      groundingRequired: true,
    });
    expect(result.verdict).toBe('PASS');
    expect(result.score).toBe(1);
  });

  it('returns FAIL when required sections are missing', () => {
    const result = critic.evaluate({
      output: '## Diagnosis\nroot cause only',
      successCriteria,
      evidenceState: 'SUFFICIENT_EVIDENCE',
      groundingRequired: true,
    });
    expect(result.verdict).toBe('FAIL');
    expect(result.checks.some((c) => c.name === 'constraint' && !c.passed)).toBe(true);
  });

  it('returns ABSTAIN on insufficient evidence for grounding-required tasks', () => {
    const result = critic.evaluate({
      output: '## Diagnosis\nconfident claim',
      successCriteria,
      evidenceState: 'INSUFFICIENT_EVIDENCE',
      groundingRequired: true,
    });
    expect(result.verdict).toBe('ABSTAIN');
  });

  it('returns ABSTAIN on conflicting evidence', () => {
    const result = critic.evaluate({
      output: 'answer',
      successCriteria,
      evidenceState: 'CONFLICTING_EVIDENCE',
      groundingRequired: true,
    });
    expect(result.verdict).toBe('ABSTAIN');
  });

  it('returns PARTIAL when only minor checks fail', () => {
    const result = critic.evaluate({
      output: 'short',
      successCriteria: [{ criterionId: 'c1', description: 'long enough', minLength: 500 }],
      evidenceState: 'SUFFICIENT_EVIDENCE',
      groundingRequired: true,
    });
    expect(result.verdict).toBe('PARTIAL');
  });

  it('flags a tool denial as a critical security failure', () => {
    const result = critic.evaluate({
      output: 'answer',
      successCriteria,
      groundingRequired: false,
      toolDenied: true,
    });
    expect(result.verdict).toBe('FAIL');
    expect(result.checks.some((c) => c.name === 'security' && !c.passed)).toBe(true);
  });

  it('validates JSON schema output via the frozen StructuredOutputValidator', () => {
    const invalid = critic.evaluate({
      output: 'not json at all',
      successCriteria: [],
      groundingRequired: false,
      expectedSchema: { type: 'object', properties: { ok: { type: 'boolean', required: true } } },
      format: 'json',
    });
    expect(invalid.verdict).toBe('FAIL');
    expect(invalid.checks.some((c) => c.name === 'schema' && !c.passed)).toBe(true);

    const valid = critic.evaluate({
      output: '{"ok":true}',
      successCriteria: [],
      groundingRequired: false,
      expectedSchema: { type: 'object', properties: { ok: { type: 'boolean', required: true } } },
      format: 'json',
    });
    expect(valid.verdict).toBe('PASS');
  });

  it('estimates tokens deterministically (4 chars/token)', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcdefgh')).toBe(2);
    expect(estimateTokens('')).toBe(0);
  });

  it('does not pass when output is empty', () => {
    const result = critic.evaluate({
      output: '',
      successCriteria,
      groundingRequired: false,
    });
    expect(result.verdict).not.toBe('PASS');
  });
});
