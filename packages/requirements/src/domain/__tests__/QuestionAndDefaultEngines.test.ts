// ──────────────────────────────────────────────────────────────────
// VedMoulya — EPIC-009: Question Intelligence + Safe Defaults
// Deterministic tests (Phase 31): question ranking (BLOCKING /
// IMPORTANT / OPTIONAL), bundling (no one-question-per-message), and
// safe defaults (security-sensitive never bulk-accepted).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { RequirementQuestionEngine, rankScore } from '../RequirementQuestionEngine.js';
import { SafeDefaultEngine } from '../SafeDefaultEngine.js';
import { IntentUnderstandingEngine } from '../IntentUnderstandingEngine.js';
import { RequirementExtractionEngine } from '../RequirementExtractionEngine.js';
import type { RequirementSet } from '../../types/requirement-types.js';

const INTENT = new IntentUnderstandingEngine();
const EXTRACTION = new RequirementExtractionEngine();
const QUESTIONS = new RequirementQuestionEngine();
const DEFAULTS = new SafeDefaultEngine();

function extract(idea: string, sessionId: string): RequirementSet {
  return EXTRACTION.extract({ sessionId, intent: INTENT.derive({ sessionId, idea }) });
}

describe('RequirementQuestionEngine (Phase 6/7/8)', () => {
  it('classifies payment + service-mode questions as BLOCKING', () => {
    const set = extract('Build a restaurant app.', 'q1');
    const plan = QUESTIONS.plan({
      sessionId: 'q1',
      idea: 'Build a restaurant app.',
      archetype: 'restaurant-app',
      requirements: set,
    });
    expect(plan.blocking.some((q) => q.id === 'q-restaurant-payment')).toBe(true);
    expect(plan.blocking.some((q) => q.id === 'q-restaurant-service-modes')).toBe(true);
  });

  it('classifies low-impact questions as OPTIONAL (never asked)', () => {
    const set = extract('Build a restaurant app.', 'q2');
    const plan = QUESTIONS.plan({
      sessionId: 'q2',
      idea: 'Build a restaurant app.',
      archetype: 'restaurant-app',
      requirements: set,
    });
    expect(plan.optional.some((q) => q.id === 'q-restaurant-tracking')).toBe(true);
    // OPTIONAL questions never appear in the ask list.
    expect(plan.all.filter((q) => q.class === 'OPTIONAL')).toHaveLength(0);
  });

  it('ranks blocking questions by weighted impact', () => {
    const set = extract('Build a restaurant app.', 'q3');
    const plan = QUESTIONS.plan({
      sessionId: 'q3',
      idea: 'Build a restaurant app.',
      archetype: 'restaurant-app',
      requirements: set,
    });
    const scores = plan.blocking.map((q) => rankScore(q.impacts));
    for (let i = 1; i < scores.length; i += 1) {
      const prev = scores[i - 1];
      const cur = scores[i];
      if (prev !== undefined && cur !== undefined) {
        expect(prev).toBeGreaterThanOrEqual(cur);
      }
    }
  });

  it('bundles related questions under one topic (no one-per-message spam)', () => {
    const set = extract('Build a restaurant app.', 'q4');
    const plan = QUESTIONS.plan({
      sessionId: 'q4',
      idea: 'Build a restaurant app.',
      archetype: 'restaurant-app',
      requirements: set,
    });
    expect(plan.bundles.length).toBeGreaterThan(0);
    for (const bundle of plan.bundles) {
      expect(bundle.questions.length).toBeGreaterThan(0);
    }
  });

  it('drops already-answered questions from the ask list', () => {
    const set = extract('Build a restaurant app.', 'q5');
    const answered = {
      id: 'q-restaurant-payment',
      class: 'BLOCKING' as const,
      topic: 'Restaurant ordering',
      text: 'Should customers pay online?',
      rationale: 'r',
      impacts: {
        architecture: 5,
        security: 5,
        business: 5,
        ux: 3,
        implementation: 5,
        cost: 4,
        confidence: 2,
      },
      groupId: 'restaurant-ordering',
      answer: 'online',
      answerSource: 'QUESTION' as const,
    };
    const plan = QUESTIONS.plan({
      sessionId: 'q5',
      idea: 'Build a restaurant app.',
      archetype: 'restaurant-app',
      requirements: set,
      answered: [answered],
    });
    expect(plan.blocking.some((q) => q.id === 'q-restaurant-payment')).toBe(false);
    expect(plan.answered.map((q) => q.id)).toContain('q-restaurant-payment');
  });
});

describe('SafeDefaultEngine (Phase 9)', () => {
  it('proposes defaults with ASSUMPTION / DEFAULT / REASON / IMPACT', () => {
    const set = extract('Build a restaurant app.', 'd1');
    const defaults = DEFAULTS.propose({
      sessionId: 'd1',
      archetype: 'restaurant-app',
      requirements: set,
      answeredTopics: [],
    });
    expect(defaults.length).toBeGreaterThan(0);
    for (const d of defaults) {
      expect(d.assumption.length).toBeGreaterThan(0);
      expect(d.defaultValue.length).toBeGreaterThan(0);
      expect(d.reason.length).toBeGreaterThan(0);
      expect(d.impact.length).toBeGreaterThan(0);
      expect(d.status).toBe('proposed');
    }
  });

  it('acceptAll never bulk-accepts security-sensitive defaults', () => {
    const set = extract('Build a restaurant app.', 'd2');
    const defaults = DEFAULTS.propose({
      sessionId: 'd2',
      archetype: 'restaurant-app',
      requirements: set,
      answeredTopics: [],
    });
    const sensitive = defaults.filter((d) => d.securitySensitive);
    const accepted = DEFAULTS.acceptAll(defaults);
    for (const s of sensitive) {
      const updated = accepted.find((d) => d.id === s.id);
      expect(updated?.status).toBe('proposed');
    }
    // Non-sensitive are accepted.
    expect(accepted.some((d) => d.status === 'accepted')).toBe(true);
  });

  it('decide() edits or rejects a default immutably', () => {
    const set = extract('Build a restaurant app.', 'd3');
    const defaults = DEFAULTS.propose({
      sessionId: 'd3',
      archetype: 'restaurant-app',
      requirements: set,
      answeredTopics: [],
    });
    const target = defaults[0];
    if (target) {
      const edited = DEFAULTS.decide(defaults, target.id, 'edited', 'custom value');
      expect(edited.find((d) => d.id === target.id)?.status).toBe('edited');
      expect(edited.find((d) => d.id === target.id)?.defaultValue).toBe('custom value');
      const rejected = DEFAULTS.decide(defaults, target.id, 'rejected');
      expect(rejected.find((d) => d.id === target.id)?.status).toBe('rejected');
    }
  });

  it('allSettled is false until every default is decided', () => {
    const set = extract('Build a restaurant app.', 'd4');
    const defaults = DEFAULTS.propose({
      sessionId: 'd4',
      archetype: 'restaurant-app',
      requirements: set,
      answeredTopics: [],
    });
    expect(DEFAULTS.allSettled(defaults)).toBe(false);
    const settled = DEFAULTS.acceptAll(defaults).map((d) =>
      d.securitySensitive ? { ...d, status: 'accepted' as const } : d,
    );
    expect(DEFAULTS.allSettled(settled)).toBe(true);
  });

  it('skips defaults whose topic was already answered', () => {
    const set = extract('Build a restaurant app.', 'd5');
    const defaults = DEFAULTS.propose({
      sessionId: 'd5',
      archetype: 'restaurant-app',
      requirements: set,
      answeredTopics: ['Target platforms'],
    });
    expect(defaults.some((d) => d.unknown === 'Target platforms')).toBe(false);
  });
});
