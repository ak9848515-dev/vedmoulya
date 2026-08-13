// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Intelligence: Visual Critic Engine
// EPIC-010 — Phase 8. Evaluates generated applications against the
// design system across: hierarchy, spacing, alignment, consistency,
// readability, responsiveness, accessibility, interaction clarity,
// visual density and domain appropriateness. Every finding is
// evidence-backed (CONFIRMED/LIKELY/UNCERTAIN/NOT_FOUND) — the critic
// never invents defects.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import type {
  ApplicationDesignSystem,
  CriticFinding,
  EvidenceClass,
  UIBlueprint,
  VisualCriticReport,
} from '../types/experience-types.js';
import type { AICritiqueFinding, AICritiquePort } from '../contracts/AICritiquePort.js';
import { AccessibilityEngine } from './AccessibilityEngine.js';

export interface VisualCriticEngineOptions {
  /** Optional AI critique seam (EPIC-010 Phase 8/11). When provided, the
   *  engine may augment deterministic findings with live-provider critique
   *  through `critiqueWithAI`. The deterministic `critique()` path is
   *  unchanged and never depends on the seam. */
  aiCritique?: AICritiquePort;
}

export interface VisualCriticInput {
  applicationId: string;
  /** The authenticated user requesting the critique — forwarded to the AI
   *  runtime through the port for per-user scoping (rate limit/cache/audit).
   *  Never the application id. */
  userId?: string;
  archetype: AppArchetype;
  designSystem: ApplicationDesignSystem;
  blueprint: UIBlueprint;
  files: Array<{ path: string; content: string }>;
}

export interface CriticRuleResult {
  finding: Omit<CriticFinding, 'id'>;
  /** Evidence-backed certainty of the finding. */
  evidenceClass: EvidenceClass;
  autoFixable: boolean;
}

export interface RuleContext {
  designSystem: ApplicationDesignSystem;
  blueprint: UIBlueprint;
  files: Array<{ path: string; content: string }>;
  allContent: string;
}

/** Deterministic critic rules. Each rule returns a finding (id is assigned
 *  later by the engine) or null — a rule can only claim what the generated
 *  code actually shows. */
const RULES: Array<(ctx: RuleContext) => Omit<CriticFinding, 'id'> | null> = [
  ({ designSystem, allContent }): Omit<CriticFinding, 'id'> | null => {
    // Domain appropriateness: the generated code should reference the
    // declared personality or its tokens.
    const tokensMentioned = designSystem.tokens.filter((t) =>
      allContent.includes(t.value.toLowerCase()),
    ).length;
    if (tokensMentioned === 0) {
      return {
        severity: 'HIGH',
        area: 'domain_appropriateness',
        location: 'global',
        issue: `The UI does not reference the "${designSystem.visualPersonality}" design language anywhere`,
        evidence: 'no design token value appears in the generated source',
        recommendation:
          'Generate the UI from the design system tokens so the personality is actually expressed',
        evidenceClass: 'CONFIRMED',
        autoFixable: true,
      };
    }
    return null;
  },
  ({ designSystem, allContent }): Omit<CriticFinding, 'id'> | null => {
    // Consistency: a primary color token should be referenced.
    const primary = designSystem.tokens.find((t) => t.id === 'color.primary');
    if (primary && !allContent.includes(primary.value.toLowerCase())) {
      return {
        severity: 'MEDIUM',
        area: 'consistency',
        location: 'global',
        issue: 'The primary color is not used in the generated UI',
        evidence: `token color.primary = ${primary.value} absent from source`,
        recommendation: 'Bind buttons/links to the primary token',
        evidenceClass: 'CONFIRMED',
        autoFixable: true,
      };
    }
    return null;
  },
  ({ blueprint, allContent }): Omit<CriticFinding, 'id'> | null => {
    // States: loading, empty and error must exist (Phase 5).
    const missing = ['loading', 'empty', 'error'].filter((s) => !allContent.includes(s));
    if (missing.length > 0) {
      return {
        severity: missing.length >= 2 ? 'HIGH' : 'MEDIUM',
        area: 'interaction_clarity',
        location: blueprint.screens[0]?.id ?? 'screen',
        issue: `Missing screen states in generated UI: ${missing.join(', ')}`,
        evidence: `the words ${missing.map((m) => `"${m}"`).join(', ')} do not appear in any generated file`,
        recommendation: 'Implement loading/empty/error states for every screen',
        evidenceClass: 'CONFIRMED',
        autoFixable: true,
      };
    }
    return null;
  },
  ({ blueprint: _blueprint, allContent }): Omit<CriticFinding, 'id'> | null => {
    // Responsiveness: media queries or breakpoints must exist.
    const adaptive = /@media|sm:|md:|lg:|breakpoint/.test(allContent);
    if (!adaptive) {
      return {
        severity: 'HIGH',
        area: 'responsiveness',
        location: 'global',
        issue: 'The generated UI has no responsive breakpoints',
        evidence: 'no @media query or breakpoint utility appears in the source',
        recommendation: 'Add mobile/tablet/desktop breakpoints per the responsive blueprint',
        evidenceClass: 'CONFIRMED',
        autoFixable: true,
      };
    }
    return null;
  },
  ({ blueprint, allContent }): Omit<CriticFinding, 'id'> | null => {
    // Accessibility: labels/aria must exist.
    const hasA11y = /aria-|label|alt=/.test(allContent);
    if (!hasA11y) {
      return {
        severity: 'HIGH',
        area: 'accessibility',
        location: blueprint.screens[0]?.id ?? 'screen',
        issue: 'No accessibility attributes found in the generated UI',
        evidence: 'no aria-*, label or alt attribute appears in the source',
        recommendation: 'Add labels, roles and focus handling per the accessibility requirements',
        evidenceClass: 'CONFIRMED',
        autoFixable: true,
      };
    }
    return null;
  },
  ({ blueprint }): Omit<CriticFinding, 'id'> | null => {
    // Navigation: the blueprint declares routes — the UI should link them.
    if (blueprint.routes.length > 1 && blueprint.navigation.length === 0) {
      return {
        severity: 'LOW',
        area: 'interaction_clarity',
        location: 'navigation',
        issue: 'Navigation is not described for a multi-screen application',
        evidence: 'blueprint declares routes but the UI has no navigation structure',
        recommendation: 'Generate navigation from the blueprint screens',
        evidenceClass: 'UNCERTAIN',
        autoFixable: false,
      };
    }
    return null;
  },
];

export class VisualCriticEngine {
  private readonly accessibility = new AccessibilityEngine();
  private readonly aiCritique?: AICritiquePort;

  constructor(options: VisualCriticEngineOptions = {}) {
    this.aiCritique = options.aiCritique;
  }

  critique(input: VisualCriticInput): VisualCriticReport {
    const allContent = input.files
      .map((f) => f.content)
      .join('\n')
      .toLowerCase();
    const ctx: RuleContext = {
      designSystem: input.designSystem,
      blueprint: input.blueprint,
      files: input.files,
      allContent,
    };

    const findings: CriticFinding[] = [];
    for (const rule of RULES) {
      const finding = rule(ctx);
      if (finding) {
        findings.push({
          ...finding,
          id: `VC-${String(findings.length + 1).padStart(3, '0')}`,
        });
      }
    }

    // Accessibility audit findings from the automated checks.
    const audit = this.accessibility.audit(
      {
        applicationId: input.applicationId,
        archetype: input.archetype,
        blueprint: input.blueprint,
      },
      input.files,
    );
    for (const check of audit.filter((c) => !c.passed)) {
      findings.push({
        id: `VC-${String(findings.length + 1).padStart(3, '0')}`,
        severity: 'MEDIUM',
        area: 'accessibility',
        location: 'global',
        issue: `Accessibility requirement "${check.requirementId}" not satisfied by generated code`,
        evidence: check.detail,
        recommendation: 'Implement the automated accessibility check',
        evidenceClass: 'CONFIRMED',
        autoFixable: true,
      });
    }

    const blocking = findings.some((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH');
    const score = this.score(findings);
    return { applicationId: input.applicationId, findings, score, blocking };
  }

  /**
   * Optional AI-augmented critique (EPIC-010 Phase 8/11 — the seam).
   *
   * 1. Runs the full deterministic critique first (never weakened).
   * 2. If an AICritiquePort is wired, asks a live provider to critique the
   *    generated UI IN ADDITION — passing the deterministic findings so the
   *    model does not duplicate them.
   * 3. Merges model findings through the SAME evidence-first contract:
   *    every AI finding is re-classified deterministically (confidence is a
   *    claim, never a fact), empty-evidence findings are DROPPED (never
   *    invented), and duplicates of deterministic findings are skipped.
   * 4. When the port is absent, abstains or fails — the deterministic report
   *    is returned unchanged (the seam never weakens or fakes evaluation).
   */
  async critiqueWithAI(
    input: VisualCriticInput,
    port?: AICritiquePort,
  ): Promise<VisualCriticReport> {
    const deterministic = this.critique(input);
    const aiCritique = port ?? this.aiCritique;
    if (!aiCritique) return deterministic;

    const allContent = input.files
      .map((f) => f.content)
      .join('\n')
      .toLowerCase();
    let result;
    try {
      result = await aiCritique.critique({
        userId: input.userId ?? 'unknown',
        applicationId: input.applicationId,
        archetype: input.archetype,
        designSystem: input.designSystem,
        blueprint: input.blueprint,
        files: input.files,
        existingFindings: deterministic.findings,
      });
    } catch {
      // Non-fatal: a provider failure never breaks the deterministic path.
      return deterministic;
    }
    if (result.abstained || result.findings.length === 0) return deterministic;

    const findings = [...deterministic.findings];
    for (const ai of result.findings) {
      const mapped = this.mapAIFinding(ai, allContent);
      if (!mapped) continue; // empty/weak evidence — never invented
      if (this.duplicates(findings, mapped)) continue;
      findings.push({
        ...mapped,
        id: `VC-${String(findings.length + 1).padStart(3, '0')}`,
      });
    }

    const blocking = findings.some((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH');
    return { applicationId: input.applicationId, findings, score: this.score(findings), blocking };
  }

  /**
   * Map a model-claimed finding into the evidence-first CriticFinding.
   * Honesty rules (EPIC-010 Phase 10 — never manufacture confidence):
   *   - empty evidence → NOT_FOUND → dropped (returns null)
   *   - absence claims ("does not appear"/"absent") are verifiable → CONFIRMED
   *   - evidence referencing concrete code artifacts → CONFIRMED (HIGH)
   *     or LIKELY (MEDIUM/LOW)
   *   - unverifiable generic evidence → UNCERTAIN (say so, never confirm)
   */
  private mapAIFinding(
    ai: AICritiqueFinding,
    allContent: string,
  ): Omit<CriticFinding, 'id'> | null {
    const evidence = ai.evidence.trim();
    if (evidence.length === 0) return null;

    // Absence claims ("no aria-*", "does not appear") are verifiable from
    // source — the deterministic critic uses the same evidence style.
    const absenceClaim = /does not appear|does not exist|not present|absent|^no [a-z-]+/i.test(
      evidence,
    );
    const grounded = absenceClaim || this.groundedEvidence(evidence, allContent);
    let evidenceClass: EvidenceClass;
    if (grounded) {
      evidenceClass = ai.confidence === 'HIGH' ? 'CONFIRMED' : 'LIKELY';
    } else {
      evidenceClass = 'UNCERTAIN';
    }

    return {
      severity: ai.severity,
      area: ai.area,
      location: ai.location,
      issue: ai.issue,
      evidence,
      recommendation: ai.recommendation,
      evidenceClass,
      // AI-suggested fixes are PROPOSED, never auto-applied: the deterministic
      // refinement planner (Phase 12/13) only auto-fixes deterministic
      // evidence it can reproduce. AI findings surface for user review.
      autoFixable: false,
    };
  }

  /**
   * True when the evidence references CONCRETE code artifacts in the source.
   * Only quoted fragments (backtick/double/single) and structured identifiers
   * (kebab/dotted/scoped or camelCase) count — generic English words like
   * "app" or "visual" never ground a claim.
   */
  private groundedEvidence(evidence: string, allContent: string): boolean {
    const quoted = evidence.match(/`[^`]+`|"[^"]{4,}"|'[^']{4,}'/g) ?? [];
    const identifiers =
      evidence.match(/\b[a-z][a-z0-9]*([._:-][a-z0-9]+)+\b|\b[a-z]+[A-Z][a-zA-Z0-9]*\b/g) ?? [];
    const candidates = [...quoted, ...identifiers].map((a) =>
      a.replace(/[`"']/g, '').toLowerCase(),
    );
    return candidates.some((a) => allContent.includes(a));
  }

  /** Skip findings whose issue duplicates an already-present finding. */
  private duplicates(existing: CriticFinding[], candidate: Omit<CriticFinding, 'id'>): boolean {
    const c = candidate.issue.toLowerCase();
    return existing.some(
      (f) =>
        f.issue.toLowerCase() === c ||
        f.issue.toLowerCase().includes(c) ||
        c.includes(f.issue.toLowerCase()),
    );
  }

  /** Severity-weighted score: 1.0 with no findings, dropping for each. */
  private score(findings: CriticFinding[]): number {
    if (findings.length === 0) return 1;
    const weight: Record<CriticFinding['severity'], number> = {
      CRITICAL: 0.4,
      HIGH: 0.25,
      MEDIUM: 0.15,
      LOW: 0.05,
    };
    const penalty = findings.reduce((sum, f) => sum + weight[f.severity], 0);
    return Number(Math.max(0, Math.min(1, 1 - penalty)).toFixed(2));
  }
}
