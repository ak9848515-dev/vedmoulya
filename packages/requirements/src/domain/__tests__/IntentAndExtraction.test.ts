// ──────────────────────────────────────────────────────────────────
// VedMoulya — EPIC-009: Intent Understanding + Requirement Extraction
// Deterministic tests (Phase 31): intent extraction, provenance,
// unknowns, confidence, requirement categories and critical unknowns.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { IntentUnderstandingEngine } from '../IntentUnderstandingEngine.js';
import { RequirementExtractionEngine } from '../RequirementExtractionEngine.js';
import type { Requirement } from '../../types/requirement-types.js';

const INTENT = new IntentUnderstandingEngine();
const EXTRACTION = new RequirementExtractionEngine();

const RESTAURANT_IDEA =
  'Build me a modern restaurant app with online payment, delivery, and an admin dashboard.';

describe('IntentUnderstandingEngine (Phase 1)', () => {
  it('detects the restaurant archetype and explicit features with USER provenance', () => {
    const intent = INTENT.derive({ sessionId: 's1', idea: RESTAURANT_IDEA });
    expect(intent.archetype).toBe('restaurant-app');
    expect(intent.knownFeatures).toContain('Ordering & checkout');
    expect(intent.knownFeatures).toContain('Administration');
    expect(intent.integrations).toContain('Payment provider');
    const explicit = intent.explicit.find((c) => c.label.includes('Payment provider'));
    expect(explicit?.provenance.source).toBe('USER');
    expect(explicit?.provenance.confidence).toBeGreaterThan(0.8);
  });

  it('never upgrades inference into USER fact', () => {
    const intent = INTENT.derive({ sessionId: 's2', idea: 'Build an ABAP debugger.' });
    const userClaims = intent.explicit;
    const inferredClaims = intent.inferred;
    for (const c of userClaims) expect(c.provenance.source).toBe('USER');
    for (const c of inferredClaims) expect(c.provenance.source).not.toBe('USER');
  });

  it('records unknowns for every open question with QUESTION provenance', () => {
    const intent = INTENT.derive({ sessionId: 's3', idea: 'Build me a restaurant app.' });
    expect(intent.unknowns.length).toBeGreaterThanOrEqual(4);
    for (const u of intent.unknowns) {
      expect(u.provenance.source).toBe('QUESTION');
      expect(u.isUnknown).toBe(true);
      expect(u.provenance.confidence).toBeLessThan(0.3);
    }
  });

  it('confidence grows with explicit detail', () => {
    const vague = INTENT.derive({ sessionId: 's4', idea: 'Make an app.' });
    const detailed = INTENT.derive({ sessionId: 's5', idea: RESTAURANT_IDEA });
    expect(detailed.overallConfidence).toBeGreaterThan(vague.overallConfidence);
  });

  it('detects mobile expectations from the idea', () => {
    const intent = INTENT.derive({
      sessionId: 's6',
      idea: 'Build a mobile restaurant ordering app for iOS and Android.',
    });
    expect(intent.platforms.some((p) => p.includes('mobile') || p.includes('Native'))).toBe(true);
  });

  it('extracts AI expectations when the idea mentions AI', () => {
    const intent = INTENT.derive({
      sessionId: 's7',
      idea: 'Build an AI customer support chatbot.',
    });
    expect(intent.aiExpectations.length).toBeGreaterThan(0);
  });
});

describe('RequirementExtractionEngine (Phase 2)', () => {
  it('covers all 13 categories for a restaurant idea', () => {
    const intent = INTENT.derive({ sessionId: 's8', idea: RESTAURANT_IDEA });
    const set = EXTRACTION.extract({ sessionId: 's8', intent });
    const categories = new Set(set.requirements.map((r) => r.category));
    const expected: Array<Requirement['category']> = [
      'functional',
      'non_functional',
      'business_rule',
      'user',
      'data',
      'integration',
      'ai',
      'ux',
      'security',
      'performance',
      'scalability',
      'deployment',
      'compliance',
    ];
    for (const cat of expected) {
      expect(categories.has(cat), `missing category ${cat}`).toBe(true);
    }
  });

  it('keeps architecture-changing unknowns UNKNOWN (never silently assumed)', () => {
    const intent = INTENT.derive({ sessionId: 's9', idea: 'Build me a restaurant app.' });
    const set = EXTRACTION.extract({ sessionId: 's9', intent });
    const unknowns = set.requirements.filter((r) => r.status === 'UNKNOWN');
    expect(unknowns.length).toBeGreaterThan(0);
    for (const u of unknowns) {
      expect(u.priority).toBe('CRITICAL');
      expect(u.source).toBe('QUESTION');
    }
  });

  it('marks payment requirements as CRITICAL with risks', () => {
    const intent = INTENT.derive({ sessionId: 's10', idea: RESTAURANT_IDEA });
    const set = EXTRACTION.extract({ sessionId: 's10', intent });
    const payment = set.requirements.find((r) => r.description.includes('Payment references'));
    expect(payment?.priority).toBe('CRITICAL');
    expect(payment?.risks.some((r) => r.includes('Payment processing'))).toBe(true);
  });

  it('records explicit user constraints as CONFIRMED requirements', () => {
    const intent = INTENT.derive({
      sessionId: 's11',
      idea: 'Build a secure low-cost workflow tool.',
    });
    const set = EXTRACTION.extract({ sessionId: 's11', intent });
    const confirmed = set.requirements.filter((r) => r.status === 'CONFIRMED');
    expect(confirmed.length).toBeGreaterThan(0);
    expect(set.counts.byStatus.CONFIRMED).toBeGreaterThan(0);
  });

  it('computes per-status and per-priority counts', () => {
    const intent = INTENT.derive({ sessionId: 's12', idea: RESTAURANT_IDEA });
    const set = EXTRACTION.extract({ sessionId: 's12', intent });
    expect(set.counts.total).toBe(set.requirements.length);
    expect(set.counts.byPriority.CRITICAL).toBeGreaterThan(0);
    expect(set.byCategory.functional.length).toBeGreaterThan(0);
  });
});
