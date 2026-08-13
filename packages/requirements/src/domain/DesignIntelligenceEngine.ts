// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Design Intelligence Engine
// EPIC-009 — Phase 15. Produces an application-specific
// DesignSpecification BEFORE code generation: visual personality,
// audience, brand direction, color system, typography, spacing,
// components, iconography, motion, responsive strategy, accessibility
// and interaction/empty/loading/error states. The design must match
// the product — an ABAP debugger is not a restaurant app.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import type { DesignSpecification } from '../types/requirement-types.js';
import { buildDesignSpecification, knowledgeFor } from '../catalog/knowledge.js';

export interface DesignInput {
  sessionId: string;
  archetype: AppArchetype;
  customAudience?: string;
}

export class DesignIntelligenceEngine {
  derive(input: DesignInput): DesignSpecification {
    const k = knowledgeFor(input.archetype);
    const design = buildDesignSpecification(input.sessionId, k, input.customAudience);
    // Components are derived from the archetype's screens + data model.
    return {
      ...design,
      components: [
        ...k.experience.screens.map((s) => `${s} screen`),
        ...k.dataModel.map((e) => `${e.entity} card/list`),
        'Primary action button',
        'Status indicator',
        'Empty state component',
        'Loading skeleton',
        'Error banner',
      ],
    };
  }
}
