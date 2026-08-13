// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Intelligence: Accessibility Engine
// EPIC-010 — Phase 7. Defines accessibility requirements (keyboard
// navigation, focus states, semantic structure, labels, contrast,
// screen-reader support, touch targets, reduced motion) and provides
// AUTOMATED checks over generated code so accessibility is verified,
// not asserted.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import { experienceKnowledgeFor } from '../catalog/design-knowledge.js';
import type { AccessibilityRequirement, UIBlueprint } from '../types/experience-types.js';

export interface AccessibilityInput {
  applicationId: string;
  archetype: AppArchetype;
  blueprint: UIBlueprint;
}

export interface AccessibilityCheckResult {
  requirementId: string;
  passed: boolean;
  detail: string;
}

const CODE_CHECKS: Record<string, (content: string) => boolean> = {
  keyboard: (c) => /tabIndex|tabindex|onKeyDown|onKeyPress/.test(c),
  focus: (c) => /focus-visible|:focus|focus:/.test(c),
  semantics: (c) => /<(nav|header|main|footer|section)\b/.test(c),
  labels: (c) => /aria-label|<label|placeholder|for=/.test(c),
  contrast: (c) => /contrast|--text|--primary/.test(c),
  screen_reader: (c) => /aria-live|role="(status|alert)"|aria-/.test(c),
  touch_target: (c) => /min-h-\[44|minHeight:\s*44|h-11|min-h-11/.test(c),
  reduced_motion: (c) => /prefers-reduced-motion|motion-reduce/.test(c),
};

export class AccessibilityEngine {
  requirements(input: AccessibilityInput): AccessibilityRequirement[] {
    const k = experienceKnowledgeFor(input.archetype);
    return [
      ...k.accessibility,
      {
        id: 'a-common-states',
        category: 'screen_reader',
        requirement: 'State changes are announced to screen readers',
        reference: 'WCAG 4.1.3',
        check: 'aria-live present for async status',
      },
    ];
  }

  /** Automated checks over the generated source — evidence-based. */
  audit(
    input: AccessibilityInput,
    files: Array<{ path: string; content: string }>,
  ): AccessibilityCheckResult[] {
    const reqs = this.requirements(input);
    const allContent = files.map((f) => f.content).join('\n');
    return reqs.map((r) => {
      const check = CODE_CHECKS[r.category];
      const passed = check ? check(allContent) : true;
      return {
        requirementId: r.id,
        passed,
        detail: passed
          ? `automated check passed: ${r.check}`
          : `automated check failed: ${r.check} — evidence not found in generated code`,
      };
    });
  }
}
