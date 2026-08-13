// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Intelligence: Design System Engine
// EPIC-010 — Phase 1. Produces a typed ApplicationDesignSystem:
// typography, colors, spacing, radius, elevation, surfaces, buttons,
// forms, navigation, cards, tables, dialogs, notifications, badges,
// charts, empty/loading/error states. Design tokens are STRUCTURED —
// generated applications never scatter arbitrary styling.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import type { DesignSpecification } from '@vedmoulya/requirements';
import { buildDesignSystem } from '../catalog/design-knowledge.js';
import type { ApplicationDesignSystem } from '../types/experience-types.js';

export interface DesignSystemInput {
  applicationId: string;
  archetype: AppArchetype;
  /** Optional EPIC-009 DesignSpecification — overrides catalog defaults. */
  designSpec?: DesignSpecification;
}

export class DesignSystemEngine {
  derive(input: DesignSystemInput): ApplicationDesignSystem {
    const system = buildDesignSystem(input.applicationId, input.archetype, input.designSpec);
    // Consistency invariant: every component spec references tokens that exist.
    return {
      ...system,
      rationale: [
        ...system.rationale,
        'Tokens are the single source of truth — components reference token ids, never literal values.',
        'Domain-aware: the design system is specific to the application archetype, never universal.',
      ],
    };
  }
}
