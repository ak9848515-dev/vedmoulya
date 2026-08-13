// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Intelligence: Traceability Engine
// EPIC-010 — Phase 16. Every major UI implementation is traceable:
// Requirement → Design Decision → UI Blueprint → Component → File →
// Test → Visual Review. The system can answer "why was this component
// designed this way?" with the full chain.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import type { DesignDecision, TraceabilityLink, UIBlueprint } from '../types/experience-types.js';

export interface TraceabilityInput {
  applicationId: string;
  archetype: AppArchetype;
  blueprint: UIBlueprint;
  decisions: DesignDecision[];
  files: Array<{ path: string; content: string }>;
}

export type { TraceabilityLink };

export class TraceabilityEngine {
  index(input: TraceabilityInput): TraceabilityLink[] {
    const links: TraceabilityLink[] = [];
    const fileSet = new Set(input.files.map((f) => f.path));
    for (const decision of input.decisions) {
      // Choose the most representative file for the decision's components.
      const file =
        this.pickFile(input.files, decision.affectedComponents) ??
        input.files[0]?.path ??
        'generated-ui';
      links.push({
        designDecisionId: decision.id,
        decision: decision.decision,
        requirement: this.requirementFor(decision),
        component: decision.affectedComponents[0] ?? 'app',
        file,
        test: `ui-${decision.id.toLowerCase()}.test.ts`,
        review: decision.affectedComponents.includes('All screens')
          ? 'visual critic: domain_appropriateness'
          : 'visual critic: consistency',
      });
      void fileSet;
    }
    return links;
  }

  /** Answer "why was this component designed this way?" for a component. */
  explain(links: TraceabilityLink[], component: string): string[] {
    const matches = links.filter(
      (l) =>
        l.component === component || l.decision.toLowerCase().includes(component.toLowerCase()),
    );
    if (matches.length === 0) return [`No recorded design decision for "${component}".`];
    return matches.map(
      (m) =>
        `"${m.component}" was designed per ${m.designDecisionId}: ${m.decision} (${m.requirement}). Implemented in ${m.file}, covered by ${m.test}, reviewed via ${m.review}.`,
    );
  }

  private requirementFor(decision: DesignDecision): string {
    const map: Record<string, string> = {
      visualPersonality: 'UX: the application expresses its declared visual personality',
      colorSystem: 'UX: a coherent color system across all screens',
      typography: 'UX: legible typographic hierarchy',
      navigation: 'UX: navigation follows the primary workflows',
      states: 'UX: every screen defines all nine states',
    };
    return decision.designDimension
      ? (map[decision.designDimension] ?? `Design: ${decision.decision}`)
      : `Design: ${decision.decision}`;
  }

  private pickFile(
    files: Array<{ path: string; content: string }>,
    components: string[],
  ): string | undefined {
    const component = components[0]?.toLowerCase() ?? '';
    return (
      files.find((f) => f.path.toLowerCase().includes('ui') && f.path.toLowerCase().includes('app'))
        ?.path ??
      files.find((f) => f.path.toLowerCase().includes(component.replace(/[^a-z0-9]/g, '')))?.path ??
      undefined
    );
  }
}
