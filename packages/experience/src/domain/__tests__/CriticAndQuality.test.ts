// ──────────────────────────────────────────────────────────────────
// VedMoulya — EPIC-010: Visual Critic, Quality, Evidence, Refinement
// Deterministic tests (Phases 8–13, 16): evidence-backed critic
// findings, multi-dimensional quality (a high score never hides a
// critical failure), evidence classification honesty, targeted
// refinement (never regenerate-all) and UI traceability.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { VisualCriticEngine } from '../VisualCriticEngine.js';
import { QualityEvaluator } from '../QualityEvaluator.js';
import { EvidenceClassifier } from '../EvidenceClassifier.js';
import { RefinementPlanner } from '../RefinementPlanner.js';
import { TraceabilityEngine } from '../TraceabilityEngine.js';
import { ExperienceEngine } from '../ExperienceEngine.js';
import { DesignSystemEngine } from '../DesignSystemEngine.js';
import { DesignDecisionEngine } from '../DesignDecisionEngine.js';
import { UIBlueprintEngine } from '../UIBlueprintEngine.js';

const DESIGN = new DesignSystemEngine();
const BLUEPRINT = new UIBlueprintEngine();
const CRITIC = new VisualCriticEngine();
const QUALITY = new QualityEvaluator();
const EVIDENCE = new EvidenceClassifier();
const REFINE = new RefinementPlanner();
const TRACE = new TraceabilityEngine();
const ENGINE = new ExperienceEngine();

const GOOD_FILES = [
  {
    path: 'src/ui/app.tsx',
    content:
      'export const App = () => (<main role="main" aria-live="polite"><h1>Menu</h1><div className="grid sm:grid-cols-2 lg:grid-cols-3">{items.map((i) => <MenuItemCard key={i.id} item={i} tabIndex={0} />)}</div><div className="loading">Loading…</div><div className="empty">No items yet</div><div className="error">Something went wrong</div></main>);',
  },
  {
    path: 'src/ui/styles.css',
    content:
      '@media (max-width: 640px) { .grid { grid-template-columns: 1fr; } } :focus { outline: 2px solid #C2410C; } :root { --text: #292524; --primary: #C2410C; } .btn { min-height: 44px; } @media (prefers-reduced-motion: reduce) { * { animation: none; } }',
  },
  {
    path: 'src/ui/components/menu-card.tsx',
    content:
      'export function MenuItemCard({ item, tabIndex }: { item: { id: string; name: string }; tabIndex: number }) { return <article aria-label={item.name}><img alt={item.name} src={item.image} /><button aria-label={`Add ${item.name}`} tabIndex={tabIndex}>Add</button></article>; }',
  },
];

const BAD_FILES = [
  { path: 'src/ui/app.tsx', content: 'export const App = () => (<div><h1>hi</h1></div>);' },
  { path: 'src/main.ts', content: 'export const x = 1;' },
];

describe('VisualCriticEngine (Phase 8)', () => {
  it('returns no critical findings for a well-formed generated UI', () => {
    const system = DESIGN.derive({ applicationId: 'app-1', archetype: 'restaurant-app' });
    const blueprint = BLUEPRINT.derive({ applicationId: 'app-1', archetype: 'restaurant-app' });
    const report = CRITIC.critique({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      designSystem: system,
      blueprint,
      files: GOOD_FILES,
    });
    expect(report.findings.length).toBeLessThanOrEqual(2);
    expect(report.blocking).toBe(false);
    expect(report.score).toBeGreaterThanOrEqual(0.7);
    for (const f of report.findings) {
      expect(f.id).toMatch(/^VC-\d{3}$/);
      expect(f.evidence.length).toBeGreaterThan(0);
      expect(['CONFIRMED', 'LIKELY', 'UNCERTAIN', 'NOT_FOUND']).toContain(f.evidenceClass);
    }
  });

  it('finds evidence-backed defects in a bare generated UI', () => {
    const system = DESIGN.derive({ applicationId: 'app-1', archetype: 'restaurant-app' });
    const blueprint = BLUEPRINT.derive({ applicationId: 'app-1', archetype: 'restaurant-app' });
    const report = CRITIC.critique({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      designSystem: system,
      blueprint,
      files: BAD_FILES,
    });
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.blocking).toBe(true);
    expect(report.score).toBeLessThan(0.7);
    expect(report.findings.some((f) => f.area === 'accessibility')).toBe(true);
    expect(report.findings.some((f) => f.area === 'responsiveness')).toBe(true);
  });

  it('never invents defects — every finding carries evidence', () => {
    const system = DESIGN.derive({ applicationId: 'app-1', archetype: 'restaurant-app' });
    const blueprint = BLUEPRINT.derive({ applicationId: 'app-1', archetype: 'restaurant-app' });
    const report = CRITIC.critique({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      designSystem: system,
      blueprint,
      files: GOOD_FILES,
    });
    for (const f of report.findings) {
      expect(f.evidence.length).toBeGreaterThan(3);
      expect(f.recommendation.length).toBeGreaterThan(3);
    }
  });
});

describe('QualityEvaluator (Phase 9)', () => {
  it('produces all ten dimensions with scores and evidence', () => {
    const critic = CRITIC.critique({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      designSystem: DESIGN.derive({ applicationId: 'app-1', archetype: 'restaurant-app' }),
      blueprint: BLUEPRINT.derive({ applicationId: 'app-1', archetype: 'restaurant-app' }),
      files: GOOD_FILES,
    });
    const evaluation = QUALITY.evaluate({ applicationId: 'app-1', files: GOOD_FILES, critic });
    expect(evaluation.dimensions).toHaveLength(10);
    const dimensions = new Set(evaluation.dimensions.map((d) => d.dimension));
    for (const d of [
      'FUNCTIONAL',
      'UX',
      'VISUAL',
      'ACCESSIBILITY',
      'SECURITY',
      'PERFORMANCE',
      'AI',
      'RAG',
      'DATA',
      'ARCHITECTURE',
    ]) {
      expect(dimensions.has(d as (typeof evaluation.dimensions)[number]['dimension'])).toBe(true);
    }
    expect(evaluation.overall).toBeGreaterThan(0);
    expect(evaluation.verdict).toBeDefined();
    expect(evaluation.verdictReason.length).toBeGreaterThan(0);
  });

  it('a high aggregate score NEVER hides a critical failure', () => {
    const critic = CRITIC.critique({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      designSystem: DESIGN.derive({ applicationId: 'app-1', archetype: 'restaurant-app' }),
      blueprint: BLUEPRINT.derive({ applicationId: 'app-1', archetype: 'restaurant-app' }),
      files: GOOD_FILES,
    });
    const evaluation = QUALITY.evaluate({
      applicationId: 'app-1',
      files: GOOD_FILES,
      critic,
      securityFindings: [
        {
          severity: 'CRITICAL',
          description: 'Secrets committed to the frontend bundle',
          filePath: 'src/ui/env.ts',
        },
      ],
      validationEvidence: [{ gate: 'build', passed: true, detail: 'build passes' }],
    });
    expect(evaluation.verdict).toBe('NOT_READY');
    expect(evaluation.blockingDimensions).toContain('SECURITY');
    expect(evaluation.verdictReason).toContain('NOT READY');
  });

  it('failing validation gates make FUNCTIONAL not ready', () => {
    const critic = CRITIC.critique({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      designSystem: DESIGN.derive({ applicationId: 'app-1', archetype: 'restaurant-app' }),
      blueprint: BLUEPRINT.derive({ applicationId: 'app-1', archetype: 'restaurant-app' }),
      files: GOOD_FILES,
    });
    const evaluation = QUALITY.evaluate({
      applicationId: 'app-1',
      files: GOOD_FILES,
      critic,
      validationEvidence: [{ gate: 'typecheck', passed: false, detail: 'type error in app.tsx' }],
    });
    expect(evaluation.blockingDimensions).toContain('FUNCTIONAL');
    expect(evaluation.verdict).toBe('NOT_READY');
  });
});

describe('EvidenceClassifier (Phase 10)', () => {
  it('never manufactures confidence — insufficient evidence says so', () => {
    const uncertain = EVIDENCE.classify({
      finding: {
        id: 'VC-001',
        severity: 'HIGH',
        area: 'spacing',
        location: 'cart',
        issue: 'possible spacing drift',
        evidence: 'visual inspection only',
        recommendation: 'review spacing tokens',
        evidenceClass: 'UNCERTAIN',
        autoFixable: false,
      },
      sourceEvidence: [],
    });
    expect(uncertain).toBe('UNCERTAIN');
    const summary = EVIDENCE.evidenceSummary({
      id: 'VC-001',
      severity: 'HIGH',
      area: 'spacing',
      location: 'cart',
      issue: 'possible spacing drift',
      evidence: 'visual inspection only',
      recommendation: 'review',
      evidenceClass: 'UNCERTAIN',
      autoFixable: false,
    });
    expect(summary).toContain('Insufficient evidence');
  });

  it('classifies absence-of-marker findings as CONFIRMED when evidence is specific', () => {
    const cls = EVIDENCE.classify({
      finding: {
        id: 'VC-002',
        severity: 'HIGH',
        area: 'responsiveness',
        location: 'global',
        issue: 'no breakpoints',
        evidence: 'no @media query appears in the source',
        recommendation: 'add breakpoints',
        evidenceClass: 'CONFIRMED',
        autoFixable: true,
      },
      sourceEvidence: ['no @media query appears'],
    });
    expect(cls).toBe('CONFIRMED');
  });
});

describe('RefinementPlanner (Phase 12/13)', () => {
  it('produces a targeted plan touching only affected files — never regenerate-all', () => {
    const system = DESIGN.derive({ applicationId: 'app-1', archetype: 'restaurant-app' });
    const blueprint = BLUEPRINT.derive({ applicationId: 'app-1', archetype: 'restaurant-app' });
    const report = CRITIC.critique({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      designSystem: system,
      blueprint,
      files: BAD_FILES,
    });
    const finding = report.findings.find((f) => f.area === 'responsiveness') ?? report.findings[0]!;
    const plan = REFINE.plan({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      designSystem: system,
      blueprint,
      finding,
      files: BAD_FILES,
    });
    expect(plan.fileOperations.length).toBeGreaterThan(0);
    expect(plan.fileOperations.every((op) => op.kind === 'patch')).toBe(true);
    expect(plan.impact.targeted).toBe(true);
    expect(plan.impact.affectedScreens.length).toBeGreaterThan(0);
    expect(plan.impact.securityImpact.some((s) => s.includes('None'))).toBe(true);
    expect(plan.untouched).toBeDefined();
    expect(plan.requiresApproval).toBe(true);
  });

  it('keeps unrelated working functionality untouched', () => {
    const files = [
      {
        path: 'src/ui/app.tsx',
        content: 'export const App = () => (<div><button>hi</button></div>);',
      },
      {
        path: 'src/lib/orders.ts',
        content: 'export const placeOrder = async () => { /* working */ };',
      },
    ];
    const system = DESIGN.derive({ applicationId: 'app-1', archetype: 'restaurant-app' });
    const blueprint = BLUEPRINT.derive({ applicationId: 'app-1', archetype: 'restaurant-app' });
    const report = CRITIC.critique({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      designSystem: system,
      blueprint,
      files,
    });
    const plan = REFINE.plan({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      designSystem: system,
      blueprint,
      finding: report.findings[0]!,
      files,
    });
    expect(plan.untouched).toContain('src/lib/orders.ts');
    expect(plan.fileOperations.some((op) => op.path.includes('orders'))).toBe(false);
  });
});

describe('TraceabilityEngine (Phase 16)', () => {
  it('answers why-a-component-was-designed-this-way', () => {
    const blueprint = BLUEPRINT.derive({ applicationId: 'app-1', archetype: 'restaurant-app' });
    const decisions = new DesignDecisionEngine().derive({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      designSpec: {
        sessionId: 's',
        visualPersonality: 'warm',
        targetAudience: 'd',
        brandDirection: 'b',
        colorSystem: [],
        typography: 't',
        spacing: 's',
        components: [],
        iconography: 'i',
        motion: 'm',
        responsiveStrategy: 'r',
        accessibility: 'a',
        interactionStates: [],
        emptyStates: [],
        loadingStates: [],
        errorStates: [],
        rationale: [],
      },
    });
    const links = TRACE.index({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      blueprint,
      decisions,
      files: GOOD_FILES,
    });
    expect(links.length).toBe(decisions.length);
    const explanations = TRACE.explain(links, 'All screens');
    expect(explanations.length).toBeGreaterThan(0);
    expect(explanations[0]).toContain('DESIGN-');
  });
});

describe('ExperienceEngine (Phase 11/14/17 orchestration)', () => {
  it('evaluates a generated app end-to-end into a quality bundle', () => {
    const bundle = ENGINE.evaluate({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      files: GOOD_FILES,
    });
    expect(bundle.designSystem.tokens.length).toBeGreaterThan(0);
    expect(bundle.blueprint.screens.length).toBeGreaterThan(0);
    expect(bundle.designDecisions.length).toBeGreaterThan(0);
    expect(bundle.critic.score).toBeGreaterThanOrEqual(0);
    expect(bundle.quality.overall).toBeGreaterThan(0);
    expect(bundle.traceability.length).toBe(bundle.designDecisions.length);
  });

  it('classifies every finding with an evidence summary', () => {
    const bundle = ENGINE.evaluate({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      files: BAD_FILES,
    });
    const classified = ENGINE.classify(bundle.critic.findings);
    expect(classified.length).toBe(bundle.critic.findings.length);
    for (const f of classified) {
      expect(f.summary.length).toBeGreaterThan(0);
    }
  });

  it('plans targeted refinement from a finding id', () => {
    const bundle = ENGINE.evaluate({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      files: BAD_FILES,
    });
    const plan = ENGINE.planRefinement({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      findingId: bundle.critic.findings[0]!.id,
      files: BAD_FILES,
    });
    expect(plan.findingId).toBe(bundle.critic.findings[0]!.id);
    expect(plan.fileOperations.length).toBeGreaterThan(0);
  });

  it('refuses to plan refinement for an unknown finding id', () => {
    expect(() =>
      ENGINE.planRefinement({
        applicationId: 'app-1',
        archetype: 'restaurant-app',
        findingId: 'VC-999',
        files: GOOD_FILES,
      }),
    ).toThrow(/no critic finding/);
  });
});
