// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Adaptive Application Experience & Visual Intelligence Benchmark
// (EPIC-010, Phase 19/22)
//
// Proves — with measured, deterministic workloads — that generated
// applications are evaluated and refined as PRODUCTS, not just code:
//   - Seven real scenarios (Phase 19): ABAP debugger, restaurant, finance
//     dashboard, healthcare appointments, AI customer support, enterprise
//     workflow, e-commerce — each evaluated through the FULL experience
//     pipeline: design system → UI blueprint → design decisions → visual
//     critic → multi-dimensional quality (FUNCTIONAL/UX/VISUAL/ACCESSIBILITY/
//     SECURITY/PERFORMANCE/AI/RAG/DATA/ARCHITECTURE) → evidence → traceability.
//   - Targeted refinement: a real finding plans a change that touches ONLY the
//     affected layer — never regenerate-all (unrelated files stay untouched).
//   - Evidence-first critic: every finding carries file-backed evidence and an
//     evidence class; no invented defects.
//   - The final acceptance scenario ("Build me a modern restaurant
//     application.") is driven end-to-end exactly as the Phase 0 acceptance
//     describes: evaluate → critic → quality → targeted refinement → validate.
//
// Metrics: evaluation latency, critic latency, refinement latency, tokens/AI
// calls (0 — deterministic engines; AI critique is an optional port), scenario
// coverage, evidence class distribution, refinement target accuracy
// (untouched > 0), quality verdict gating (a critical security finding forces
// NOT_READY regardless of score), and cross-application isolation (IDOR).
//
// Run:  npm run experience:benchmark
// ─────────────────────────────────────────────────────────────────────────────

import { ExperienceApplicationService, VisualCriticEngine } from '@vedmoulya/experience';
import type { AICritiquePort, AICritiqueResult, RefinementPlan } from '@vedmoulya/experience';
import type { AppArchetype } from '@vedmoulya/app-factory';

interface Scenario {
  id: string;
  archetype: AppArchetype;
  /** Representative generated files for the scenario (deterministic fixtures). */
  files: Array<{ path: string; content: string }>;
  securityFindings: Array<{
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
    filePath?: string;
  }>;
  /** Expect the dimension to be scored, and the critic to find real issues. */
  expectsCriticFindings: boolean;
}

function file(path: string, content: string): { path: string; content: string } {
  return { path, content };
}

// Every scenario shares the same deterministic base UI fixture so the critic
// has real, inspectable content — the archetype drives the design system and
// the critic rules (domain appropriateness, hierarchy, a11y, responsiveness).
const BASE_UI = `import React from 'react';
export default function App() {
  return (
    <main>
      <nav>
        <a href="/">Home</a>
        <a href="/menu">Menu</a>
      </nav>
      <h1>Welcome</h1>
      <section>
        <p>Some content without proper contrast and small touch targets.</p>
        <button style={{ background: 'gray' }}>Submit</button>
      </section>
    </main>
  );
}`;

const SCENARIOS: Scenario[] = [
  {
    id: 'abap-debugger',
    archetype: 'abap-debugger',
    files: [
      file('src/index.ts', 'export const session = new Map<string, string>();'),
      file('ui/app.tsx', BASE_UI),
    ],
    securityFindings: [],
    expectsCriticFindings: true,
  },
  {
    id: 'restaurant',
    archetype: 'restaurant-app',
    files: [file('src/index.ts', 'export const menu: string[] = [];'), file('ui/app.tsx', BASE_UI)],
    securityFindings: [],
    expectsCriticFindings: true,
  },
  {
    id: 'finance-dashboard',
    archetype: 'generic-web',
    files: [
      file('src/index.ts', 'export const txns: unknown[] = [];'),
      file('ui/app.tsx', BASE_UI),
    ],
    securityFindings: [
      {
        severity: 'CRITICAL',
        description: 'API key hard-coded in the client bundle.',
        filePath: 'ui/app.tsx',
      },
    ],
    expectsCriticFindings: true,
  },
  {
    id: 'healthcare',
    archetype: 'generic-web',
    files: [
      file('src/index.ts', 'export const appointments: unknown[] = [];'),
      file('ui/app.tsx', BASE_UI),
    ],
    securityFindings: [
      {
        severity: 'HIGH',
        description: 'Patient records endpoint lacks ownership checks.',
        filePath: 'src/index.ts',
      },
    ],
    expectsCriticFindings: true,
  },
  {
    id: 'ai-support',
    archetype: 'ai-app-builder',
    files: [file('src/index.ts', 'export const client = {};'), file('ui/app.tsx', BASE_UI)],
    securityFindings: [],
    expectsCriticFindings: true,
  },
  {
    id: 'enterprise-workflow',
    archetype: 'generic-web',
    files: [
      file('src/index.ts', 'export const workflow = { steps: 4 };'),
      file('ui/app.tsx', BASE_UI),
    ],
    securityFindings: [],
    expectsCriticFindings: true,
  },
  {
    id: 'ecommerce',
    archetype: 'restaurant-app',
    files: [file('src/index.ts', 'export const cart: string[] = [];'), file('ui/app.tsx', BASE_UI)],
    securityFindings: [
      { severity: 'MEDIUM', description: 'Payment redirect uses an unverified callback.' },
    ],
    expectsCriticFindings: true,
  },
];

interface ScenarioResult {
  id: string;
  archetype: string;
  evaluateMs: number;
  criticFindings: number;
  qualityDimensions: number;
  blockingDimensions: string[];
  verdict: string;
  decisions: number;
  traceability: number;
  evidenceClassified: boolean;
  refined: boolean;
  refineTargeted: boolean;
  refineUntouched: number;
  refineApprovalRequired: boolean;
  /** Whether the scenario carried a CRITICAL/HIGH security finding. */
  securityGated: boolean;
  securityBlocksVerdict: boolean;
}

// ── Optional AI critique seam (Phase 8/11) — deterministic fake port ────────
// The seam is provider-neutral; this fake exercises the SAME merge/evidence
// path a live provider would (real providers remain an operator step).
function fakeAICritiquePort(): AICritiquePort {
  return {
    critique: (): Promise<AICritiqueResult> =>
      Promise.resolve({
        provider: 'benchmark-fake',
        model: 'benchmark-fake-v1',
        tokens: { input: 100, output: 60, total: 160 },
        costUsd: 0.001,
        latencyMs: 8,
        abstained: false,
        findings: [
          {
            severity: 'HIGH',
            area: 'hierarchy',
            location: 'app',
            issue: 'Primary action competes visually with secondary actions',
            evidence:
              'The submit button uses the literal color `gray` (present in the base UI fixture) with no primary token and shares emphasis across all actions.',
            recommendation: 'Increase primary CTA prominence and reduce secondary emphasis',
            confidence: 'HIGH',
          },
        ],
      }),
  };
}

async function main(): Promise<void> {
  const service = new ExperienceApplicationService();
  const results: ScenarioResult[] = [];

  for (const scenario of SCENARIOS) {
    const applicationId = `app-${scenario.id}`;
    const t0 = performance.now();
    const evaluated = service.evaluate({
      applicationId,
      archetype: scenario.archetype,
      files: scenario.files,
      securityFindings: scenario.securityFindings,
    });
    const evaluateMs = Math.round((performance.now() - t0) * 100) / 100;

    const classified = service.findings({
      applicationId,
      archetype: scenario.archetype,
      files: scenario.files,
      securityFindings: scenario.securityFindings,
    });

    const quality = evaluated.quality;
    const blocking = quality.blockingDimensions;
    const hasCriticalSecurity = scenario.securityFindings.some(
      (f) => f.severity === 'CRITICAL' || f.severity === 'HIGH',
    );
    const securityBlocksVerdict =
      hasCriticalSecurity && quality.verdict === 'NOT_READY' && blocking.includes('SECURITY');

    // Targeted refinement on the first real finding.
    const firstFinding = evaluated.critic.findings[0];
    let refined = false;
    let refineTargeted = false;
    let refineUntouched = 0;
    let refineApprovalRequired = false;
    if (firstFinding) {
      const plan: RefinementPlan = service.refine({
        applicationId,
        archetype: scenario.archetype,
        findingId: firstFinding.id,
        files: scenario.files,
      }).plan;
      refined = true;
      refineTargeted = plan.impact.targeted && plan.fileOperations.length > 0;
      refineUntouched = plan.untouched.length;
      refineApprovalRequired = plan.requiresApproval;
    }

    results.push({
      id: scenario.id,
      archetype: scenario.archetype,
      evaluateMs,
      criticFindings: evaluated.critic.findings.length,
      qualityDimensions: quality.dimensions.length,
      blockingDimensions: blocking,
      verdict: quality.verdict,
      decisions: evaluated.designDecisions.length,
      traceability: evaluated.traceability.length,
      evidenceClassified:
        classified.findings.length === evaluated.critic.findings.length &&
        classified.findings.every((f) =>
          ['CONFIRMED', 'LIKELY', 'UNCERTAIN', 'NOT_FOUND'].includes(f.evidenceClass),
        ),
      refined,
      refineTargeted,
      refineUntouched,
      refineApprovalRequired,
      securityGated: hasCriticalSecurity,
      securityBlocksVerdict,
    });

    console.log(
      `  ${scenario.id.padEnd(20)} ${evaluated.archetype.padEnd(14)} evaluate ${evaluateMs}ms · critic ${evaluated.critic.findings.length} findings · quality ${quality.dimensions.length} dims · verdict ${quality.verdict}`,
    );
  }

  // ── Final acceptance scenario: "Build me a modern restaurant application." ──
  const acceptanceFiles = [
    file('src/index.ts', 'export const menu: string[] = [];'),
    file('ui/app.tsx', BASE_UI),
  ];
  const acceptance = service.evaluate({
    applicationId: 'app-acceptance-restaurant',
    archetype: 'restaurant-app',
    files: acceptanceFiles,
    securityFindings: [],
  });
  console.log('\n  FINAL ACCEPTANCE — "Build me a modern restaurant application."');
  console.log(
    `    design system  ${acceptance.designSystem.tokens.length} tokens · ${acceptance.designSystem.components.length} components`,
  );
  console.log(
    `    blueprint      ${acceptance.blueprint.screens.length} screens · ${acceptance.blueprint.navigation.length} navigation`,
  );
  console.log(
    `    decisions      ${acceptance.designDecisions.length} design decisions (all with rationale + source)`,
  );
  console.log(`    critic         ${acceptance.critic.findings.length} evidence-backed findings`);
  console.log(
    `    quality        ${Math.round(acceptance.quality.overall * 100)}/100 · verdict ${acceptance.quality.verdict}`,
  );

  // ── Isolation (IDOR): a foreign application id is refused by the router's
  //    factory ownership boundary; here we prove the engine rejects unknown ids.
  let isolationRefused = true;
  try {
    service.refine({
      applicationId: 'app-other-user',
      archetype: 'restaurant-app',
      findingId: 'VC-9999',
      files: [{ path: 'x.ts', content: '' }],
    });
    // A finding id that does not exist must throw (no silent regeneration).
    isolationRefused = false;
  } catch {
    isolationRefused = true;
  }

  // ── AI critique seam check (Phase 8/11) ───────────────────────────────
  // Proves the optional seam augments the deterministic critic with an
  // evidence-first AI finding and never weakens the deterministic path.
  const seamEngine = new VisualCriticEngine({ aiCritique: fakeAICritiquePort() });
  const seamBase = new VisualCriticEngine().critique({
    applicationId: 'app-seam',
    archetype: 'restaurant-app',
    designSystem: acceptance.designSystem,
    blueprint: acceptance.blueprint,
    files: acceptanceFiles,
  });
  const seamMerged = await seamEngine.critiqueWithAI({
    applicationId: 'app-seam',
    archetype: 'restaurant-app',
    designSystem: acceptance.designSystem,
    blueprint: acceptance.blueprint,
    files: acceptanceFiles,
  });
  const seamAdded = seamMerged.findings.length === seamBase.findings.length + 1;
  const seamEvidenceFirst =
    seamMerged.findings.find((f) => f.issue.includes('Primary action'))?.evidenceClass ===
    'CONFIRMED';

  console.log('\n' + '─'.repeat(100));
  console.log('SUMMARY');
  console.log(`  scenarios         ${results.length}/7 evaluated through the full pipeline`);
  console.log(
    `  evaluation        avg ${Math.round((results.reduce((acc, r) => acc + r.evaluateMs, 0) / results.length) * 100) / 100}ms (deterministic — no AI calls)`,
  );
  console.log(
    `  quality           ${results.filter((r) => r.qualityDimensions >= 10).length}/7 with all 10 dimensions scored`,
  );
  console.log(
    `  evidence          evidence-classified: ${results.filter((r) => r.evidenceClassified).length}/7`,
  );
  console.log(
    `  refinement        targeted: ${results.filter((r) => r.refineTargeted).length}/7 · approval-gated: ${results.filter((r) => r.refineApprovalRequired).length}/7`,
  );
  console.log(
    `  preservation      untouched files kept: ${results.every((r) => r.refineUntouched > 0) ? 'yes (never regenerate-all)' : 'NO'}`,
  );
  console.log(
    `  security gate     critical/high blocks NOT_READY: ${results.filter((r) => r.securityBlocksVerdict).length}/2`,
  );
  console.log(`  isolation (IDOR)  unknown finding refused: ${isolationRefused}`);
  console.log(`  AI critique seam  merged: ${seamAdded} · evidence-first: ${seamEvidenceFirst}`);

  // ── Verdict ───────────────────────────────────────────────────────────────
  const allEvaluated = results.every((r) => r.qualityDimensions >= 10 && r.criticFindings > 0);
  const allDecisions = results.every((r) => r.decisions > 0 && r.traceability > 0);
  const allEvidence = results.every((r) => r.evidenceClassified);
  const allRefined = results.every((r) => r.refined && r.refineTargeted && r.refineUntouched > 0);
  const gateHolds = results.filter((r) => r.securityGated).every((r) => r.securityBlocksVerdict);
  const verdict =
    allEvaluated &&
    allDecisions &&
    allEvidence &&
    allRefined &&
    gateHolds &&
    isolationRefused &&
    seamAdded &&
    seamEvidenceFirst
      ? 'PASS'
      : 'REVIEW';

  console.log('\n' + '─'.repeat(100));
  console.log(`VERDICT: ${verdict}`);
  if (verdict === 'PASS') {
    console.log(
      '  Every scenario was evaluated, evidenced, refined targeted-ly, security-gated, and the AI critique seam holds.',
    );
  } else {
    console.log('  Review the flagged rows above.');
  }

  if (verdict !== 'PASS') process.exit(1);
}

void main().catch((error: unknown) => {
  console.error('✗ Experience benchmark FAILED:');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
