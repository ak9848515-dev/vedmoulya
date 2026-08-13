// ──────────────────────────────────────────────────────────────────
// VedMoulya — FreeResourceClassifier tests
// EPIC-012C — FREE / FREE_WITH_QUOTA / OPEN_WEIGHTS / OPEN_SOURCE /
// LOCAL / SELF_HOSTABLE / PAID / UNKNOWN (§5)
//
// Key rules verified here:
//   - "open source" ≠ "free API"
//   - "free model" ≠ "unlimited free inference"
//   - a source's claimedFreeClass is a CLAIM — re-classified from
//     evidence, and a claim without evidence lands on UNKNOWN.
//   - FREE never implies recommended (that is the RecommendationEngine).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { FreeResourceClassifier } from '../domain/FreeResourceClassifier.js';
import { rawItem } from './fixtures.js';

const classifier = new FreeResourceClassifier();

describe('FreeResourceClassifier — free / local classification', () => {
  it('classifies a GitHub repository as OPEN_SOURCE (code, not a free API)', () => {
    const result = classifier.classify(
      rawItem({
        category: 'github',
        github: { name: 'owner/repo', license: 'MIT' },
      }),
    );
    expect(result.freeClass).toBe('OPEN_SOURCE');
    expect(result.localAvailability).toBe('yes');
    expect(result.reasons[0]).toContain('OPEN_SOURCE');
  });

  it('leaves local availability UNKNOWN when a repo has no license field', () => {
    const result = classifier.classify(
      rawItem({ category: 'github', github: { name: 'owner/repo' } }),
    );
    expect(result.freeClass).toBe('OPEN_SOURCE');
    expect(result.localAvailability).toBe('UNKNOWN');
  });

  it('classifies a local-runnable model as LOCAL', () => {
    const result = classifier.classify(
      rawItem({
        category: 'model',
        claimedLocalAvailability: 'yes',
        claimedFreeClass: 'PAID', // a paid-cloud claim is overridden by local evidence
      }),
    );
    expect(result.freeClass).toBe('LOCAL');
    expect(result.localAvailability).toBe('yes');
  });

  it('classifies evidence-cited free tier as FREE_WITH_QUOTA when quota wording is present', () => {
    const result = classifier.classify(
      rawItem({
        evidence: [
          {
            claim: 'Free tier limited to 100 requests/day',
            source: 'official',
            confidence: 'VERIFIED',
          },
        ],
      }),
    );
    expect(result.freeClass).toBe('FREE_WITH_QUOTA');
  });

  it('classifies evidence-cited free availability as FREE_API when no quota wording', () => {
    const result = classifier.classify(
      rawItem({
        evidence: [{ claim: 'Free to use', source: 'official', confidence: 'VERIFIED' }],
      }),
    );
    expect(result.freeClass).toBe('FREE_API');
  });

  it('treats a claimed FREE_API with no evidence as UNKNOWN (never fabricated)', () => {
    const result = classifier.classify(rawItem({ claimedFreeClass: 'FREE_API', evidence: [] }));
    expect(result.freeClass).toBe('UNKNOWN');
    expect(result.localAvailability).toBe('UNKNOWN');
  });

  it('classifies a locally-runnable open-weights model as LOCAL (local inference wins)', () => {
    // The independent axes never conflate: a model that runs locally is LOCAL
    // (free per-inference) even when it is also open-weights.
    const result = classifier.classify(
      rawItem({
        category: 'model',
        claimedFreeClass: 'OPEN_WEIGHTS',
        claimedLocalAvailability: 'yes',
      }),
    );
    expect(result.freeClass).toBe('LOCAL');
    expect(result.localAvailability).toBe('yes');
  });

  it('honours a claimed OPEN_WEIGHTS class when local usability is not stated', () => {
    const result = classifier.classify(
      rawItem({ category: 'model', claimedFreeClass: 'OPEN_WEIGHTS' }),
    );
    expect(result.freeClass).toBe('OPEN_WEIGHTS');
    expect(result.localAvailability).toBe('UNKNOWN');
  });

  it('honours a claimed PAID class with no free evidence', () => {
    const result = classifier.classify(
      rawItem({ claimedFreeClass: 'PAID', evidence: [], claimedLocalAvailability: 'no' }),
    );
    expect(result.freeClass).toBe('PAID');
    expect(result.localAvailability).toBe('no');
  });

  it('defaults to UNKNOWN when nothing is known', () => {
    const result = classifier.classify(rawItem({ evidence: [] }));
    expect(result.freeClass).toBe('UNKNOWN');
  });
});
