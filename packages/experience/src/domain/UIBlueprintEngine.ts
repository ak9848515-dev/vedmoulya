// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Intelligence: UI Blueprint Engine
// EPIC-010 — Phase 4. Before any UI code is generated, produces a
// UIBlueprint: screens, routes, navigation, components, layouts,
// responsive behavior, states, interactions and accessibility
// requirements. The factory consumes this blueprint rather than
// improvising a UI.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import { buildUIBlueprint, experienceKnowledgeFor } from '../catalog/design-knowledge.js';
import type { UIBlueprint } from '../types/experience-types.js';

export interface UIBlueprintInput {
  applicationId: string;
  archetype: AppArchetype;
}

export class UIBlueprintEngine {
  derive(input: UIBlueprintInput): UIBlueprint {
    const blueprint = buildUIBlueprint(input.applicationId, input.archetype);
    const k = experienceKnowledgeFor(input.archetype);
    return {
      ...blueprint,
      accessibility: [
        ...k.accessibility.map((a) => `${a.category}: ${a.requirement}`),
        'Screen states defined per screen (never only the happy path)',
      ],
    };
  }
}
