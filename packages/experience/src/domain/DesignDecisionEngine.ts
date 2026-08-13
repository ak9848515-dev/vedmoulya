// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Intelligence: Design Decision Engine
// EPIC-010 — Phase 3. Converts the EPIC-009 DesignSpecification into
// executable DesignDecisions. Every decision carries an id, the
// decision, rationale, source, alternatives, confidence and affected
// components — so the user can always ask "why was this designed this
// way?" and get a prov-enanced answer.
// ──────────────────────────────────────────────────────────────────

import type { DesignSpecification } from '@vedmoulya/requirements';
import type { AppArchetype } from '@vedmoulya/app-factory';
import { experienceKnowledgeFor } from '../catalog/design-knowledge.js';
import type { DesignDecision } from '../types/experience-types.js';

export interface DesignDecisionInput {
  applicationId: string;
  archetype: AppArchetype;
  designSpec: DesignSpecification;
}

/** Deterministic decision templates keyed to the EPIC-009 specification. */
const DECISION_RULES: Array<{
  key: keyof DesignSpecification | 'navigation' | 'states';
  decision: (value: string) => string;
  rationale: (value: string) => string;
  alternatives: string[];
  components: string[];
}> = [
  {
    key: 'visualPersonality',
    decision: (v) => `Adopt the "${v}" visual personality throughout the UI`,
    rationale: (v) =>
      `The EPIC-009 design specification declared "${v}" — every screen and component follows it`,
    alternatives: ['A neutral generic personality', 'A different domain personality'],
    components: ['All screens'],
  },
  {
    key: 'colorSystem',
    decision: () => 'Use the declared color system as the palette foundation',
    rationale: () =>
      "Color communicates the product's emotional register before a single word is read",
    alternatives: ['Platform default palette', 'Dark-mode-first palette'],
    components: ['Theme tokens', 'Buttons', 'Cards', 'Badges'],
  },
  {
    key: 'typography',
    decision: () => 'Apply the declared typography scale for all text',
    rationale: () => 'Readability and hierarchy are set by the type scale',
    alternatives: ['System font only', 'Monospace everywhere'],
    components: ['Headings', 'Body', 'Code panels'],
  },
  {
    key: 'navigation',
    decision: () => 'Choose navigation from the archetype workflow model',
    rationale: () => 'Navigation follows the primary workflows, not a template',
    alternatives: ['Chatbot-first navigation', 'Single-page scroll'],
    components: ['Navigation', 'App shell'],
  },
  {
    key: 'states',
    decision: () =>
      'Implement every screen state: loading, empty, success, error, partial, offline, unauthorized, forbidden, validation',
    rationale: () =>
      'Only the happy path is never enough — every important screen defines all nine states',
    alternatives: ['Happy path only', 'Loading + error only'],
    components: ['All screens'],
  },
];

export class DesignDecisionEngine {
  derive(input: DesignDecisionInput): DesignDecision[] {
    const k = experienceKnowledgeFor(input.archetype);
    const decisions: DesignDecision[] = [];
    for (const rule of DECISION_RULES) {
      const specValue = input.designSpec[rule.key as keyof DesignSpecification];
      const value =
        rule.key === 'navigation' || rule.key === 'states'
          ? k.navigation
          : Array.isArray(specValue)
            ? specValue.join(', ')
            : specValue;
      decisions.push({
        id: `DESIGN-${String(decisions.length + 1).padStart(3, '0')}`,
        decision: rule.decision(value),
        rationale: rule.rationale(value),
        source: 'DESIGN_SPEC',
        alternatives: rule.alternatives,
        confidence: rule.key === 'visualPersonality' ? 0.9 : 0.8,
        affectedComponents: rule.components,
        designDimension: rule.key === 'navigation' || rule.key === 'states' ? undefined : rule.key,
      });
    }
    return decisions;
  }
}
