// ──────────────────────────────────────────────────────────────────
// VedMoulya — EPIC-010: Optional AI Critique Seam (Phase 8/11)
// Deterministic tests for the AICritiquePort seam on the
// VisualCriticEngine: the deterministic path is NEVER weakened, AI
// findings are merged evidence-first (confidence is a claim, never a
// fact), empty-evidence findings are dropped (never invented),
// unverifiable claims stay UNCERTAIN, duplicates are skipped, and the
// whole engine + service work with and without the seam.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { VisualCriticEngine } from '../VisualCriticEngine.js';
import { ExperienceEngine } from '../ExperienceEngine.js';
import { ExperienceApplicationService } from '../../application/ExperienceApplicationService.js';
import { DesignSystemEngine } from '../DesignSystemEngine.js';
import { UIBlueprintEngine } from '../UIBlueprintEngine.js';
import type { AICritiquePort, AICritiqueResult } from '../../contracts/AICritiquePort.js';

const DESIGN = new DesignSystemEngine();
const BLUEPRINT = new UIBlueprintEngine();

const FILES = [
  {
    path: 'src/ui/app.tsx',
    content:
      'export const App = () => (<main role="main"><h1>Menu</h1><button className="btn-primary">Order</button><div className="loading" /></main>);',
  },
  {
    path: 'src/ui/styles.css',
    content:
      '@media (max-width: 640px) { .btn-primary { width: 100%; } } :root { --primary: #C2410C; } .btn-primary { min-height: 44px; }',
  },
];

function system() {
  return DESIGN.derive({ applicationId: 'app-1', archetype: 'restaurant-app' });
}
function blueprint() {
  return BLUEPRINT.derive({ applicationId: 'app-1', archetype: 'restaurant-app' });
}
function input() {
  return {
    applicationId: 'app-1',
    archetype: 'restaurant-app' as const,
    designSystem: system(),
    blueprint: blueprint(),
    files: FILES,
  };
}

/** Deterministic fake port — returns exactly what the test tells it to. */
function fakePort(result: AICritiqueResult): AICritiquePort {
  return { critique: async () => result };
}

function okResult(
  findings: AICritiqueResult['findings'],
  overrides: Partial<AICritiqueResult> = {},
): AICritiqueResult {
  return {
    provider: 'fake',
    model: 'fake-v1',
    tokens: { input: 100, output: 50, total: 150 },
    costUsd: 0.001,
    latencyMs: 10,
    abstained: false,
    findings,
    ...overrides,
  };
}

function finding(
  overrides: Partial<AICritiqueResult['findings'][number]> = {},
): AICritiqueResult['findings'][number] {
  return {
    severity: 'HIGH',
    area: 'hierarchy',
    location: 'app',
    issue: 'Primary action competes visually with secondary actions',
    evidence:
      'The "Order" button references class `btn-primary` (present in styles.css) but secondary buttons share its emphasis.',
    recommendation: 'Increase primary CTA prominence and reduce secondary emphasis',
    confidence: 'HIGH',
    ...overrides,
  };
}

describe('VisualCriticEngine AI seam (Phase 8/11)', () => {
  it('without a seam, critiqueWithAI is identical to deterministic critique', async () => {
    const engine = new VisualCriticEngine();
    const deterministic = engine.critique(input());
    const withAI = await engine.critiqueWithAI(input());
    expect(withAI.findings).toEqual(deterministic.findings);
    expect(withAI.score).toBe(deterministic.score);
  });

  it('merges evidence-backed AI findings into the deterministic report', async () => {
    const port = fakePort(okResult([finding()]));
    const engine = new VisualCriticEngine({ aiCritique: port });
    const report = await engine.critiqueWithAI(input());

    const deterministicCount = new VisualCriticEngine().critique(input()).findings.length;
    expect(report.findings.length).toBe(deterministicCount + 1);
    const aiFinding = report.findings.find((f) => f.issue.includes('Primary action'));
    expect(aiFinding).toBeDefined();
    expect(aiFinding?.evidenceClass).toBe('CONFIRMED'); // grounded + HIGH
    expect(aiFinding?.autoFixable).toBe(false); // proposed, never auto-applied
    expect(aiFinding?.id).toMatch(/^VC-\d{3}$/);
  });

  it('a HIGH-confirmed AI finding flips the report to blocking', async () => {
    const port = fakePort(okResult([finding({ severity: 'CRITICAL' })]));
    const engine = new VisualCriticEngine({ aiCritique: port });
    const report = await engine.critiqueWithAI(input());
    expect(report.blocking).toBe(true);
  });

  it('drops empty-evidence findings — the critic never invents defects', async () => {
    const port = fakePort(okResult([finding({ evidence: '   ' })]));
    const engine = new VisualCriticEngine({ aiCritique: port });
    const report = await engine.critiqueWithAI(input());
    expect(report.findings.some((f) => f.issue.includes('Primary action'))).toBe(false);
  });

  it('keeps unverifiable generic claims UNCERTAIN — never manufactures confidence', async () => {
    const port = fakePort(
      okResult([
        finding({
          confidence: 'HIGH',
          evidence: 'The overall visual density feels high for a restaurant app.',
        }),
      ]),
    );
    const engine = new VisualCriticEngine({ aiCritique: port });
    const report = await engine.critiqueWithAI(input());
    const aiFinding = report.findings.find((f) => f.issue.includes('Primary action'));
    expect(aiFinding?.evidenceClass).toBe('UNCERTAIN');
  });

  it('absence claims are treated as verifiable evidence (CONFIRMED)', async () => {
    const port = fakePort(
      okResult([
        finding({
          area: 'accessibility',
          issue: 'No aria-label on the menu list',
          evidence: 'No aria-label attribute appears in the generated app source',
          confidence: 'HIGH',
        }),
      ]),
    );
    const engine = new VisualCriticEngine({ aiCritique: port });
    const report = await engine.critiqueWithAI(input());
    const aiFinding = report.findings.find((f) => f.issue.includes('No aria-label'));
    expect(aiFinding?.evidenceClass).toBe('CONFIRMED');
  });

  it('skips AI findings that duplicate deterministic findings', async () => {
    const deterministic = new VisualCriticEngine().critique(input());
    const first = deterministic.findings[0];
    const port = fakePort(
      okResult([
        finding({
          issue: first.issue,
          evidence: `The issue "${first.issue}" is present in ${first.location}`,
        }),
      ]),
    );
    const engine = new VisualCriticEngine({ aiCritique: port });
    const report = await engine.critiqueWithAI(input());
    expect(report.findings.filter((f) => f.issue === first.issue)).toHaveLength(1);
  });

  it('an abstaining port returns the deterministic report unchanged', async () => {
    const port = fakePort(okResult([], { abstained: true }));
    const engine = new VisualCriticEngine({ aiCritique: port });
    const deterministic = new VisualCriticEngine().critique(input());
    const report = await engine.critiqueWithAI(input());
    expect(report.findings).toEqual(deterministic.findings);
  });

  it('a failing port is non-fatal — deterministic evaluation stands', async () => {
    const port: AICritiquePort = {
      critique: async () => {
        throw new Error('provider down');
      },
    };
    const engine = new VisualCriticEngine({ aiCritique: port });
    const deterministic = new VisualCriticEngine().critique(input());
    const report = await engine.critiqueWithAI(input());
    expect(report.findings).toEqual(deterministic.findings);
  });
});

describe('ExperienceEngine + service AI seam', () => {
  it('evaluateWithAI without a seam equals evaluate', async () => {
    const engine = new ExperienceEngine();
    const a = engine.evaluate({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      files: FILES,
    });
    const b = await engine.evaluateWithAI({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      files: FILES,
    });
    expect(b.critic.findings).toEqual(a.critic.findings);
    expect(b.quality.overall).toBe(a.quality.overall);
  });

  it('evaluateWithAI merges AI findings and recomputes quality', async () => {
    const port = fakePort(
      okResult([
        finding({
          severity: 'CRITICAL',
          area: 'consistency',
          issue: 'Primary token color is never used',
        }),
      ]),
    );
    const engine = new ExperienceEngine({ aiCritique: port });
    const bundle = await engine.evaluateWithAI({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      files: FILES,
    });
    const deterministic = new ExperienceEngine().evaluate({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      files: FILES,
    });
    expect(bundle.critic.findings.length).toBe(deterministic.critic.findings.length + 1);
    // A confirmed critical AI finding can never be hidden by the aggregate.
    expect(bundle.quality.verdict).toBe('NOT_READY');
    expect(bundle.quality.blockingDimensions).toContain('VISUAL');
  });

  it('service.evaluateWithAI works and the DTO exposes the merged critic', async () => {
    const port = fakePort(okResult([finding()]));
    const service = new ExperienceApplicationService({ aiCritique: port });
    const dto = await service.evaluateWithAI({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      files: FILES,
    });
    expect(dto.critic.findings.length).toBeGreaterThan(0);
    expect(dto.quality.verdict).toBeDefined();
    // Deterministic evaluate is untouched and remains synchronous.
    const plain = service.evaluate({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      files: FILES,
    });
    expect(plain.critic.findings.length).toBeLessThan(dto.critic.findings.length);
  });

  it('custom critic injection still honors the engine-level seam', async () => {
    const custom = new VisualCriticEngine({ aiCritique: fakePort(okResult([finding()])) });
    const engine = new ExperienceEngine({ critic: custom, aiCritique: undefined });
    // Engine has no seam of its own, but the injected critic does.
    const deterministic = engine.evaluate({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      files: FILES,
    });
    const bundle = await engine.evaluateWithAI({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      files: FILES,
    });
    expect(bundle.critic.findings.length).toBe(deterministic.critic.findings.length);
    // Engine-level seam wins when BOTH are provided.
    const engine2 = new ExperienceEngine({
      critic: custom,
      aiCritique: fakePort(okResult([finding({ issue: 'Engine-level finding' })])),
    });
    const merged = await engine2.evaluateWithAI({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      files: FILES,
    });
    expect(merged.critic.findings.some((f) => f.issue.includes('Engine-level finding'))).toBe(true);
  });

  it('evidence classifier still classifies merged AI findings with summaries', async () => {
    const port = fakePort(okResult([finding()]));
    const service = new ExperienceApplicationService({ aiCritique: port });
    const dto = await service.evaluateWithAI({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      files: FILES,
    });
    const classified = new ExperienceEngine().classify(dto.critic.findings);
    expect(classified.length).toBe(dto.critic.findings.length);
    for (const f of classified) {
      expect(f.summary.length).toBeGreaterThan(0);
    }
  });
});
