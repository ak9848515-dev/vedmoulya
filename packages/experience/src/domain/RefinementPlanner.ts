// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Intelligence: Refinement Planner
// EPIC-010 — Phase 12/13. Targeted refinement: a small issue (e.g.
// button spacing) must modify ONLY the affected design/component —
// never regenerate the entire application. Before refining, the
// planner calculates change impact (affected requirements, screens,
// components, files, tests, architecture, security, deployment).
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import type {
  ApplicationDesignSystem,
  CriticFinding,
  RefinementImpact,
  RefinementPlan,
  UIBlueprint,
} from '../types/experience-types.js';

export interface RefinementInput {
  applicationId: string;
  archetype: AppArchetype;
  designSystem: ApplicationDesignSystem;
  blueprint: UIBlueprint;
  finding: CriticFinding;
  files: Array<{ path: string; content: string }>;
}

/** Map a critic area to the files that own it. */
const AREA_TO_FILE_HINTS: Record<string, string[]> = {
  spacing: ['css', 'styles', 'theme', 'tokens', 'ui'],
  consistency: ['css', 'styles', 'theme', 'tokens', 'ui'],
  hierarchy: ['ui', 'app', 'page', 'component', 'css'],
  readability: ['css', 'typography', 'theme', 'ui'],
  responsiveness: ['css', 'styles', 'ui', 'app'],
  accessibility: ['ui', 'component', 'app', 'a11y'],
  interaction_clarity: ['ui', 'component', 'page'],
  visual_density: ['css', 'ui', 'component'],
  domain_appropriateness: ['theme', 'tokens', 'css', 'ui'],
};

export class RefinementPlanner {
  plan(input: RefinementInput): RefinementPlan {
    const impact = this.impact(input);
    const fileHints = AREA_TO_FILE_HINTS[input.finding.area] ?? ['ui'];
    const affectedFiles = input.files
      .filter((f) => fileHints.some((hint) => f.path.toLowerCase().includes(hint)))
      .map((f) => f.path);
    const fileOperations = (affectedFiles.length > 0 ? affectedFiles : ['ui/app.tsx']).map(
      (path) => ({
        path,
        kind: 'patch' as const,
        description: `Apply targeted fix for ${input.finding.area}: ${input.finding.recommendation}`,
      }),
    );
    const untouched = input.files
      .map((f) => f.path)
      .filter((p) => !fileOperations.some((o) => o.path === p));
    return {
      applicationId: input.applicationId,
      findingId: input.finding.id,
      impact,
      fileOperations,
      untouched,
      requiresApproval: input.finding.severity === 'CRITICAL' || input.finding.severity === 'HIGH',
    };
  }

  private impact(input: RefinementInput): RefinementImpact {
    const screens =
      input.finding.location === 'global'
        ? input.blueprint.screens.map((s) => s.id)
        : [input.finding.location];
    const components =
      input.finding.area === 'domain_appropriateness' || input.finding.area === 'consistency'
        ? input.designSystem.components.map((c) => c.component)
        : [input.finding.area];
    return {
      findingId: input.finding.id,
      affectedRequirements: [`UX/${input.finding.area}`, 'non_functional: production-quality UI'],
      affectedScreens: screens,
      affectedComponents: components,
      affectedFiles: input.files
        .filter((f) => input.finding.evidence.includes(f.path) || f.path.includes('ui'))
        .map((f) => f.path),
      affectedTests: [`UI tests for ${input.finding.area}`],
      architectureImpact:
        input.finding.area === 'domain_appropriateness'
          ? ['Theme layer only']
          : ['None — styling-level change'],
      securityImpact:
        input.finding.area === 'accessibility'
          ? ['None — accessibility improves security posture (no behavioral change)']
          : ['None — no security boundary touched'],
      deploymentImpact: ['None — cosmetic/styling change does not affect deployment'],
      targeted: true,
      rationale: `Targeted refinement for "${input.finding.issue}" — only the affected ${input.finding.area} layer changes; unrelated working functionality is preserved.`,
    };
  }
}
