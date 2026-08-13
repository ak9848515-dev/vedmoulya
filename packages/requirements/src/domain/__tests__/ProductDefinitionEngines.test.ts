// ──────────────────────────────────────────────────────────────────
// VedMoulya — EPIC-009: Product Definition Engines
// Deterministic tests (Phase 31): product brief (18 sections), user
// journeys (7 path kinds), experience strategy (never defaulting to
// chatbot) and application-specific design intelligence.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { IntentUnderstandingEngine } from '../IntentUnderstandingEngine.js';
import { RequirementExtractionEngine } from '../RequirementExtractionEngine.js';
import { ProductBriefGenerator } from '../ProductBriefGenerator.js';
import { UserJourneyEngine } from '../UserJourneyEngine.js';
import { ExperienceStrategyEngine, ALL_MODELS } from '../ExperienceStrategyEngine.js';
import { DesignIntelligenceEngine } from '../DesignIntelligenceEngine.js';

const INTENT = new IntentUnderstandingEngine();
const EXTRACTION = new RequirementExtractionEngine();
const BRIEF = new ProductBriefGenerator();
const JOURNEYS = new UserJourneyEngine();
const EXPERIENCE = new ExperienceStrategyEngine();
const DESIGN = new DesignIntelligenceEngine();

describe('ProductBriefGenerator (Phase 12)', () => {
  it('produces all 18 sections', () => {
    const sessionId = 'b1';
    const intent = INTENT.derive({
      sessionId,
      idea: 'Build a restaurant app with delivery and admin.',
    });
    const requirements = EXTRACTION.extract({ sessionId, intent });
    const brief = BRIEF.generate({
      sessionId,
      intent,
      requirements,
      defaults: [
        {
          id: 'd1',
          unknown: 'platforms',
          assumption: 'responsive web',
          defaultValue: 'Responsive web application',
          reason: 'r',
          impact: 'i',
          status: 'accepted',
          securitySensitive: false,
        },
      ],
    });
    expect(brief.problem.length).toBeGreaterThan(0);
    expect(brief.targetUsers.length).toBeGreaterThan(0);
    expect(brief.goals.length).toBeGreaterThan(0);
    expect(brief.nonGoals.length).toBeGreaterThan(0);
    expect(brief.features.length).toBeGreaterThan(0);
    expect(brief.userJourneys.length).toBeGreaterThan(0);
    expect(brief.businessRules.length).toBeGreaterThan(0);
    expect(brief.data.length).toBeGreaterThan(0);
    expect(brief.integrations.length).toBeGreaterThan(0);
    expect(brief.aiCapabilities.length).toBeGreaterThan(0);
    expect(brief.uxStrategy.length).toBeGreaterThan(0);
    expect(brief.security.length).toBeGreaterThan(0);
    expect(brief.performance.length).toBeGreaterThan(0);
    expect(brief.scalability.length).toBeGreaterThan(0);
    expect(brief.deployment.length).toBeGreaterThan(0);
    expect(brief.assumptions.length).toBeGreaterThan(0);
    expect(brief.openQuestions.length).toBeGreaterThan(0);
    expect(brief.successCriteria.length).toBeGreaterThan(0);
  });

  it('uses the safe fallback when the problem is unknown and no features are named', () => {
    const sessionId = 'b2';
    const derived = INTENT.derive({ sessionId, idea: 'Build a tool.' });
    const intent = { ...derived, problem: undefined, knownFeatures: [] };
    const requirements = EXTRACTION.extract({ sessionId, intent });
    const brief = BRIEF.generate({ sessionId, intent, requirements, defaults: [] });
    expect(brief.problem).toBe('A problem worth solving with software.');
    expect(brief.goals.some((g) => g.startsWith('Deliver a'))).toBe(true);
  });
});

describe('UserJourneyEngine (Phase 13)', () => {
  it('covers all seven path kinds across actors', () => {
    const journeys = JOURNEYS.generate({ sessionId: 'j1', archetype: 'restaurant-app' });
    const kinds = new Set(journeys.map((j) => j.path));
    for (const kind of [
      'happy',
      'failure',
      'empty_state',
      'permission_failure',
      'network_failure',
      'validation_failure',
      'recovery',
    ] as const) {
      expect(kinds.has(kind), `missing journey kind ${kind}`).toBe(true);
    }
  });

  it('gives each journey a stable id and ordered steps', () => {
    const journeys = JOURNEYS.generate({ sessionId: 'j2', archetype: 'abap-debugger' });
    for (const j of journeys) {
      expect(j.id).toMatch(/^J-\d{3}$/);
      expect(j.steps.length).toBeGreaterThan(0);
      expect(j.actor.length).toBeGreaterThan(0);
    }
  });

  it('generates per-archetype journeys', () => {
    const restaurant = JOURNEYS.generate({ sessionId: 'j3', archetype: 'restaurant-app' });
    expect(restaurant.some((j) => j.name.toLowerCase().includes('order'))).toBe(true);
    const abap = JOURNEYS.generate({ sessionId: 'j4', archetype: 'abap-debugger' });
    expect(abap.some((j) => j.name.toLowerCase().includes('diagnos'))).toBe(true);
  });
});

describe('ExperienceStrategyEngine (Phase 14)', () => {
  it('does not default every application to a chatbot UI', () => {
    const restaurant = EXPERIENCE.derive({ sessionId: 'e1', archetype: 'restaurant-app' });
    expect(restaurant.primaryModel).toBe('workflow');
    const abap = EXPERIENCE.derive({ sessionId: 'e2', archetype: 'abap-debugger' });
    expect(abap.primaryModel).toBe('editor');
  });

  it('honours an explicit requested model', () => {
    const chat = EXPERIENCE.derive({
      sessionId: 'e3',
      archetype: 'restaurant-app',
      requestedModel: 'chat',
    });
    expect(chat.primaryModel).toBe('chat');
  });

  it('explains alternatives with tradeoffs', () => {
    const strategy = EXPERIENCE.derive({ sessionId: 'e4', archetype: 'restaurant-app' });
    expect(strategy.alternatives.length).toBeGreaterThan(0);
    for (const alt of strategy.alternatives) {
      expect(ALL_MODELS).toContain(alt.model);
      expect(alt.tradeoff.length).toBeGreaterThan(0);
    }
  });
});

describe('DesignIntelligenceEngine (Phase 15)', () => {
  it('produces an application-specific design (not one-size-fits-all)', () => {
    const restaurant = DESIGN.derive({ sessionId: 'e5', archetype: 'restaurant-app' });
    const abap = DESIGN.derive({ sessionId: 'e6', archetype: 'abap-debugger' });
    expect(restaurant.visualPersonality).toContain('warm');
    expect(abap.visualPersonality).toContain('professional');
    expect(restaurant.visualPersonality).not.toBe(abap.visualPersonality);
  });

  it('covers color, typography, motion, responsive and accessibility', () => {
    const design = DESIGN.derive({ sessionId: 'e7', archetype: 'generic-web' });
    expect(design.colorSystem.length).toBeGreaterThan(0);
    expect(design.typography.length).toBeGreaterThan(0);
    expect(design.motion.length).toBeGreaterThan(0);
    expect(design.responsiveStrategy.length).toBeGreaterThan(0);
    expect(design.accessibility).toContain('WCAG');
    expect(design.emptyStates.length).toBeGreaterThan(0);
    expect(design.loadingStates.length).toBeGreaterThan(0);
    expect(design.errorStates.length).toBeGreaterThan(0);
    expect(design.interactionStates).toContain('hover');
  });
});
