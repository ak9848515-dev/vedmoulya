// ──────────────────────────────────────────────────────────────────
// VedMoulya — Adaptive Application Experience & Visual Intelligence
// EPIC-010 — the layer ABOVE the Application Factory that makes
// generated applications VISUALLY EXCELLENT, COHERENT, RESPONSIVE,
// ACCESSIBLE and CONTINUOUSLY REVIEWABLE.
//
//   USER IDEA → EPIC-009 (requirements + design) → EPIC-007 (factory)
//   → EPIC-006 (loop) → GENERATE → VISUAL REVIEW → FUNCTIONAL REVIEW
//   → SECURITY REVIEW → UX REVIEW → CRITIQUE → TARGETED REFINEMENT
//   → PREVIEW → USER APPROVAL → DEPLOY
//
// This layer defines TYPES ONLY. The engines are deterministic and
// provider-neutral; optional AI critique flows through the frozen AI
// runtime via a narrow port (never a direct provider call).
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import type { DesignSpecification } from '@vedmoulya/requirements';

// ── Phase 1 — Design System ────────────────────────────────────────────────

/** One structured design token (never scattered arbitrary styling). */
export interface DesignToken {
  /** e.g. 'color.primary', 'space.md', 'radius.card', 'type.h1'. */
  id: string;
  /** Token group: typography | color | spacing | radius | elevation | surface | component. */
  group: 'typography' | 'color' | 'spacing' | 'radius' | 'elevation' | 'surface' | 'component';
  /** The token value (hex, rem, px, shadow string, etc.). */
  value: string;
  /** Where this token came from (DesignSpecification / archetype / system). */
  source: 'DESIGN_SPEC' | 'ARCHETYPE' | 'SYSTEM';
  /** Short human reason for the value. */
  rationale: string;
}

export interface ComponentStyleSpec {
  component:
    | 'button'
    | 'form'
    | 'navigation'
    | 'card'
    | 'table'
    | 'dialog'
    | 'notification'
    | 'badge'
    | 'chart'
    | 'empty_state'
    | 'loading_state'
    | 'error_state';
  /** Key behavioral styling decisions (tokens + intent), not raw CSS. */
  decisions: string[];
  states: string[];
}

export interface ApplicationDesignSystem {
  applicationId: string;
  archetype: AppArchetype;
  tokens: DesignToken[];
  /** Per-component styling spec (buttons, forms, navigation, …). */
  components: ComponentStyleSpec[];
  /** Structured token groups for tooling (theme generation). */
  byGroup: Record<DesignToken['group'], string[]>;
  /** Design personality declared in the EPIC-009 DesignSpecification. */
  visualPersonality: string;
  rationale: string[];
}

// ── Phase 3 — Design Decisions ─────────────────────────────────────────────

export type DesignDecisionSource = 'DESIGN_SPEC' | 'ARCHETYPE' | 'CRITIC' | 'USER' | 'SYSTEM';

export interface DesignDecision {
  id: string;
  /** The decision (e.g. "card-based dashboard"). */
  decision: string;
  /** Why (e.g. "high-level operational information"). */
  rationale: string;
  source: DesignDecisionSource;
  alternatives: string[];
  /** 0..1 confidence. */
  confidence: number;
  /** Components / screens this decision affects. */
  affectedComponents: string[];
  /** Linked EPIC-009 design dimension when applicable. */
  designDimension?: keyof DesignSpecification;
}

// ── Phase 4 — UI Blueprint ─────────────────────────────────────────────────

export interface BlueprintScreen {
  id: string;
  /** route path (e.g. /menu). */
  route: string;
  title: string;
  /** Child sections of the screen. */
  sections: string[];
  /** Screen-level states (subset of the standard state list). */
  states: ScreenStateId[];
  /** Accessibility requirements for this screen. */
  accessibility: string[];
}

export interface UIBlueprint {
  applicationId: string;
  screens: BlueprintScreen[];
  routes: string[];
  navigation: string;
  /** Shared + screen-specific components. */
  components: string[];
  layouts: string[];
  /** Mobile / tablet / desktop behavior summary. */
  responsive: ResponsiveBehavior[];
  interactions: string[];
  /** Global accessibility requirements. */
  accessibility: string[];
}

// ── Phase 5 — State Intelligence ───────────────────────────────────────────

export type ScreenStateId =
  | 'LOADING'
  | 'EMPTY'
  | 'SUCCESS'
  | 'ERROR'
  | 'PARTIAL'
  | 'OFFLINE'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR';

export interface ScreenStateSpec {
  state: ScreenStateId;
  /** What the user sees in this state. */
  description: string;
  /** The component(s) that render this state. */
  component: string;
  /** Required behavior (e.g. "retry action present"). */
  requirements: string[];
}

// ── Phase 6 — Responsive Intelligence ──────────────────────────────────────

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export interface ResponsiveBehavior {
  component: string;
  mobile: string;
  tablet: string;
  desktop: string;
  /** Why this adaptation exists (not just "shrink the desktop layout"). */
  rationale: string;
}

// ── Phase 7 — Accessibility ────────────────────────────────────────────────

export type AccessibilityCategory =
  | 'keyboard'
  | 'focus'
  | 'semantics'
  | 'labels'
  | 'contrast'
  | 'screen_reader'
  | 'touch_target'
  | 'reduced_motion';

export interface AccessibilityRequirement {
  id: string;
  category: AccessibilityCategory;
  requirement: string;
  /** WCAG-ish reference when applicable. */
  reference?: string;
  /** How the generated code is checked for this requirement. */
  check: string;
}

// ── Phase 8 — Visual Critic ────────────────────────────────────────────────

export type CriticSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type VisualCriticArea =
  | 'hierarchy'
  | 'spacing'
  | 'alignment'
  | 'consistency'
  | 'readability'
  | 'responsiveness'
  | 'accessibility'
  | 'interaction_clarity'
  | 'visual_density'
  | 'domain_appropriateness';

export type EvidenceClass = 'CONFIRMED' | 'LIKELY' | 'UNCERTAIN' | 'NOT_FOUND';

export interface CriticFinding {
  id: string;
  severity: CriticSeverity;
  area: VisualCriticArea;
  /** Where the issue is (screen / component / file). */
  location: string;
  issue: string;
  /** Evidence from the generated files — never invented defects. */
  evidence: string;
  recommendation: string;
  /** Phase 10 — evidence classification. */
  evidenceClass: EvidenceClass;
  /** Whether an automatic targeted refinement exists. */
  autoFixable: boolean;
}

export interface VisualCriticReport {
  applicationId: string;
  findings: CriticFinding[];
  /** 0..1 — a critic score derived from severity-weighted findings. */
  score: number;
  /** High-severity findings that must be resolved before approval. */
  blocking: boolean;
}

// ── Phase 9 — Multi-Dimensional Quality Evaluation ─────────────────────────

export type QualityDimension =
  | 'FUNCTIONAL'
  | 'UX'
  | 'VISUAL'
  | 'ACCESSIBILITY'
  | 'SECURITY'
  | 'PERFORMANCE'
  | 'AI'
  | 'RAG'
  | 'DATA'
  | 'ARCHITECTURE';

export type QualityVerdict = 'READY' | 'READY_WITH_FINDINGS' | 'NOT_READY';

export interface QualityDimensionResult {
  dimension: QualityDimension;
  /** 0..1 score. */
  score: number;
  findings: CriticFinding[];
  evidence: string[];
  recommendations: string[];
  /** CRITICAL/HIGH findings make the dimension fail regardless of score. */
  failed: boolean;
}

export interface ApplicationQualityEvaluation {
  applicationId: string;
  /** 0..100 overall score. */
  overall: number;
  /** Per-dimension scores (0..1). */
  dimensions: QualityDimensionResult[];
  /** The overall verdict — a critical failure overrides any high score. */
  verdict: QualityVerdict;
  /** Dimensions that are failing (score is ignored for them). */
  blockingDimensions: QualityDimension[];
  /** Reason the verdict is what it is. */
  verdictReason: string;
  createdAt: string;
}

// ── Phase 12/13 — Targeted Refinement ──────────────────────────────────────

export interface RefinementImpact {
  findingId: string;
  affectedRequirements: string[];
  affectedScreens: string[];
  affectedComponents: string[];
  affectedFiles: string[];
  affectedTests: string[];
  architectureImpact: string[];
  securityImpact: string[];
  deploymentImpact: string[];
  /** True when the change is scoped and safe to auto-apply. */
  targeted: boolean;
  rationale: string;
}

export interface RefinementPlan {
  applicationId: string;
  findingId: string;
  impact: RefinementImpact;
  /** Deterministic file-level operations (targeted, never regenerate-all). */
  fileOperations: Array<{ path: string; kind: 'patch' | 'create' | 'delete'; description: string }>;
  /** What the refinement will NOT touch (preservation guarantee). */
  untouched: string[];
  /** Whether user approval is required before applying. */
  requiresApproval: boolean;
}

// ── Phase 16 — Design/Implementation Traceability ──────────────────────────

export interface TraceabilityLink {
  designDecisionId: string;
  decision: string;
  requirement: string;
  component: string;
  file: string;
  test: string;
  review: string;
}

// ── Experience Bundle (what the workspace Quality center renders) ──────────

export interface ExperienceEvaluationBundle {
  applicationId: string;
  archetype: AppArchetype;
  designSystem: ApplicationDesignSystem;
  blueprint: UIBlueprint;
  designDecisions: DesignDecision[];
  critic: VisualCriticReport;
  quality: ApplicationQualityEvaluation;
  traceability: TraceabilityLink[];
}
