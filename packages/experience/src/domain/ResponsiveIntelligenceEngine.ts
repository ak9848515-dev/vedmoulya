// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Intelligence: Responsive Intelligence Engine
// EPIC-010 — Phase 6. Generated applications must support mobile,
// tablet and desktop with EXPLICIT per-component behavior. The engine
// forbids "just shrink the desktop layout" — every important component
// declares what it does at each breakpoint and why.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import { experienceKnowledgeFor } from '../catalog/design-knowledge.js';
import type { Breakpoint, ResponsiveBehavior, UIBlueprint } from '../types/experience-types.js';

export interface ResponsiveIntelligenceInput {
  applicationId: string;
  archetype: AppArchetype;
  blueprint: UIBlueprint;
}

export const BREAKPOINTS: readonly Breakpoint[] = ['mobile', 'tablet', 'desktop'];

export class ResponsiveIntelligenceEngine {
  derive(input: ResponsiveIntelligenceInput): ResponsiveBehavior[] {
    const k = experienceKnowledgeFor(input.archetype);
    const behaviors = [...k.responsive];
    // Every blueprint screen must be represented — no screen left without
    // an explicit responsive strategy.
    for (const screen of input.blueprint.screens) {
      if (!behaviors.some((b) => b.component === screen.id)) {
        behaviors.push({
          component: screen.id,
          mobile: 'Single-column layout',
          tablet: 'Two-column layout',
          desktop: 'Full multi-column layout',
          rationale: `screen "${screen.title}" adapts per breakpoint`,
        });
      }
    }
    return behaviors;
  }

  /** Assertion helper: fails when a component has identical behavior on all
   *  breakpoints (the "shrunk desktop" anti-pattern). */
  isTrulyAdaptive(behavior: ResponsiveBehavior): boolean {
    const values = new Set([behavior.mobile, behavior.tablet, behavior.desktop]);
    return values.size > 1;
  }
}
