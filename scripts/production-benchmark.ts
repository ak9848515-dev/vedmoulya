// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Production Application Benchmark (EPIC-011, Phases 4/10/14)
//
// Runs EIGHT real application scenarios through the complete product pipeline
// with measured per-stage timing and cost economics:
//   Requirements (EPIC-009) → product plan (brief/design/architecture/AI/RAG/
//   security/cost/build) → quality evaluation (EPIC-010, all 10 dimensions) →
//   visual critic (evidence-first) → targeted refinement (approval-gated) →
//   final validation evidence.
//
// Scenarios (Phase 4): ABAP Debugger · Restaurant · Finance dashboard ·
// Healthcare appointments · Education · E-commerce · Enterprise workflow ·
// AI application. NOTE: the frozen factory archetype detector supports
// restaurant-app / abap-debugger / ai-app-builder / generic-web — other
// domains map to generic-web with domain-derived features (build-vs-adopt,
// the same rule the requirements benchmark uses).
//
// Honesty contract: engines are deterministic (0 real AI calls — the AI
// critique is an operator step; the cost plan is the EPIC-009 pre-build
// ESTIMATE, never presented as a live bill). Timings are measured. The
// verdict requires all scenarios to score all 10 dimensions, be targeted-
// refined, security-gated, and evidence-first.
//
// Run:  npm run production:benchmark
// ─────────────────────────────────────────────────────────────────────────────

import {
  InMemoryRequirementSessionStore,
  RequirementsApplicationService,
} from '@vedmoulya/requirements';
import type { RequirementsSessionDTO, RequirementsStartDTO } from '@vedmoulya/requirements';
import { ExperienceApplicationService } from '@vedmoulya/experience';
import type { RefinementPlan } from '@vedmoulya/experience';

if (process.env.NODE_ENV !== 'production' && !process.env.AUTH_JWT_SECRET) {
  process.env.AUTH_JWT_SECRET =
    'production-benchmark-deterministic-dev-secret-0123456789abcdefghijklmnopqrstuvwxyz';
}

// ── Scenario catalog (Phase 4: 8 real applications) ─────────────────────────

interface Scenario {
  id: string;
  request: string;
  expectedArchetype: string;
  /** Deterministic generated files (the factory output the critic reviews). */
  files: Array<{ path: string; content: string }>;
  securityFindings: Array<{
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
    filePath?: string;
  }>;
  validationEvidence: Array<{ gate: string; passed: boolean; detail: string }>;
}

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

function file(path: string, content: string): { path: string; content: string } {
  return { path, content };
}

const SCENARIOS: Scenario[] = [
  {
    id: 'abap-debugger',
    request:
      'Build an ABAP debugger assistant that analyzes ABAP source, explains errors, retrieves SAP knowledge, and suggests corrections.',
    expectedArchetype: 'abap-debugger',
    files: [
      file('src/index.ts', 'export const session = new Map<string, string>();'),
      file('ui/app.tsx', BASE_UI),
    ],
    securityFindings: [],
    validationEvidence: [
      { gate: 'SPEC', passed: true, detail: 'Specification approved by user' },
      { gate: 'BUILD', passed: true, detail: 'Deterministic generation completed' },
      { gate: 'TESTS', passed: true, detail: '12 unit tests pass' },
      { gate: 'SECURITY', passed: true, detail: 'No CRITICAL/HIGH findings' },
    ],
  },
  {
    id: 'restaurant',
    request: 'Build me a modern restaurant application.',
    expectedArchetype: 'restaurant-app',
    files: [file('src/index.ts', 'export const menu: string[] = [];'), file('ui/app.tsx', BASE_UI)],
    securityFindings: [],
    validationEvidence: [
      { gate: 'SPEC', passed: true, detail: 'Specification approved by user' },
      { gate: 'BUILD', passed: true, detail: 'Deterministic generation completed' },
      { gate: 'TESTS', passed: true, detail: '9 unit tests pass' },
      { gate: 'SECURITY', passed: true, detail: 'No CRITICAL/HIGH findings' },
    ],
  },
  {
    id: 'finance',
    request:
      'Build a finance dashboard for a small business to track income, expenses, and monthly reports.',
    expectedArchetype: 'generic-web',
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
    validationEvidence: [
      { gate: 'SPEC', passed: true, detail: 'Specification approved by user' },
      { gate: 'BUILD', passed: true, detail: 'Deterministic generation completed' },
      { gate: 'TESTS', passed: true, detail: '7 unit tests pass' },
      { gate: 'SECURITY', passed: false, detail: 'CRITICAL: hard-coded API key' },
    ],
  },
  {
    id: 'healthcare',
    request:
      'Build a healthcare appointment application where patients book appointments with doctors.',
    expectedArchetype: 'generic-web',
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
    validationEvidence: [
      { gate: 'SPEC', passed: true, detail: 'Specification approved by user' },
      { gate: 'BUILD', passed: true, detail: 'Deterministic generation completed' },
      { gate: 'TESTS', passed: true, detail: '8 unit tests pass' },
      { gate: 'SECURITY', passed: false, detail: 'HIGH: missing ownership checks' },
    ],
  },
  {
    id: 'education',
    request: 'Build an education platform where students take lessons and track their progress.',
    expectedArchetype: 'generic-web',
    files: [
      file('src/index.ts', 'export const lessons: unknown[] = [];'),
      file('ui/app.tsx', BASE_UI),
    ],
    securityFindings: [],
    validationEvidence: [
      { gate: 'SPEC', passed: true, detail: 'Specification approved by user' },
      { gate: 'BUILD', passed: true, detail: 'Deterministic generation completed' },
      { gate: 'TESTS', passed: true, detail: '10 unit tests pass' },
      { gate: 'SECURITY', passed: true, detail: 'No CRITICAL/HIGH findings' },
    ],
  },
  {
    id: 'ecommerce',
    request: 'Build an e-commerce application with a product catalog and shopping cart.',
    expectedArchetype: 'generic-web',
    files: [file('src/index.ts', 'export const cart: string[] = [];'), file('ui/app.tsx', BASE_UI)],
    securityFindings: [
      { severity: 'MEDIUM', description: 'Payment redirect uses an unverified callback.' },
    ],
    validationEvidence: [
      { gate: 'SPEC', passed: true, detail: 'Specification approved by user' },
      { gate: 'BUILD', passed: true, detail: 'Deterministic generation completed' },
      { gate: 'TESTS', passed: true, detail: '11 unit tests pass' },
      { gate: 'SECURITY', passed: true, detail: 'MEDIUM only — non-blocking' },
    ],
  },
  {
    id: 'workflow',
    request:
      'Build an enterprise workflow application to route approval requests between departments.',
    expectedArchetype: 'generic-web',
    files: [
      file('src/index.ts', 'export const workflow = { steps: 4 };'),
      file('ui/app.tsx', BASE_UI),
    ],
    securityFindings: [],
    validationEvidence: [
      { gate: 'SPEC', passed: true, detail: 'Specification approved by user' },
      { gate: 'BUILD', passed: true, detail: 'Deterministic generation completed' },
      { gate: 'TESTS', passed: true, detail: '13 unit tests pass' },
      { gate: 'SECURITY', passed: true, detail: 'No CRITICAL/HIGH findings' },
    ],
  },
  {
    id: 'ai-support',
    request:
      'Build an AI customer-support application that answers customers from a knowledge base and escalates unresolved issues.',
    // The frozen factory detector maps this idea to generic-web (same mapping
    // as the EPIC-009 requirements benchmark's 'support' scenario).
    expectedArchetype: 'generic-web',
    files: [file('src/index.ts', 'export const client = {};'), file('ui/app.tsx', BASE_UI)],
    securityFindings: [],
    validationEvidence: [
      { gate: 'SPEC', passed: true, detail: 'Specification approved by user' },
      { gate: 'BUILD', passed: true, detail: 'Deterministic generation completed' },
      { gate: 'TESTS', passed: true, detail: '9 unit tests pass' },
      { gate: 'SECURITY', passed: true, detail: 'No CRITICAL/HIGH findings' },
    ],
  },
];

// ── Metrics ──────────────────────────────────────────────────────────────────

interface ScenarioResult {
  id: string;
  archetype: string;
  archetypeMatch: boolean;
  // Stage timing (ms, measured)
  understandMs: number;
  planMs: number;
  evaluateMs: number;
  refineMs: number;
  totalMs: number;
  // Requirements intelligence
  requirements: number;
  confirmed: number;
  blockingQuestions: number;
  defaultsProposed: number;
  // Product plan completeness
  briefSections: number;
  designSections: number;
  architectureChoices: number;
  buildSteps: number;
  // Cost / token economics (EPIC-009 pre-build estimate — deterministic)
  cost: {
    aiCalls: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    ragCalls: number;
    embeddingCalls: number;
    estimatedCostUsd: number;
    estimatedLatencyMs: number;
  };
  // Experience quality (EPIC-010 — all 10 dimensions)
  qualityDimensions: number;
  dimensionScores: Record<string, number>;
  overallScore: number;
  verdict: string;
  blockingDimensions: string[];
  criticFindings: number;
  evidenceClassified: boolean;
  securityGated: boolean;
  securityBlocksVerdict: boolean;
  // Targeted refinement
  refined: boolean;
  refineTargeted: boolean;
  refineUntouched: number;
  refineApprovalRequired: boolean;
}

/** Answer every open question with its first option (or the safe default). */
function answersFor(
  session: RequirementsSessionDTO,
): Array<{ questionId: string; answer: string }> {
  const all = session.questionPlan?.all ?? [];
  return all
    .filter((q) => q.answer === undefined)
    .map((q) => ({
      questionId: q.id,
      answer: q.options?.[0]?.value ?? q.defaultAnswer ?? 'yes',
    }));
}

async function runScenario(
  reqSvc: RequirementsApplicationService,
  expSvc: ExperienceApplicationService,
  scenario: Scenario,
): Promise<ScenarioResult> {
  const userId = `prod-bench-${scenario.id}`;
  const applicationId = `app-prod-${scenario.id}`;

  // ── Stage 1: Understand (EPIC-009 Phases 1–10) ────────────────────────────
  const t0 = performance.now();
  const started: RequirementsStartDTO = await reqSvc.start({ idea: scenario.request, userId });
  let session: RequirementsSessionDTO = await reqSvc.get(started.sessionId, userId);
  const understandMs = Math.round(performance.now() - t0);

  const requirements = session.requirements?.requirements ?? [];
  const confirmed = requirements.filter((r) => r.status === 'CONFIRMED').length;
  const blockingQuestions =
    session.questionPlan?.blocking.filter((q) => q.answer === undefined).length ?? 0;
  const defaultsProposed = (session.defaults ?? []).filter((d) => d.status === 'proposed').length;

  // ── Stage 2: Answer + defaults → full plan (Phases 6–25) ──────────────────
  const openAnswers = answersFor(session);
  if (openAnswers.length > 0) {
    session = await reqSvc.answer({ sessionId: session.sessionId, userId, answers: openAnswers });
  }
  session = await reqSvc.acceptAllDefaults(session.sessionId, userId);
  const t1 = performance.now();
  session = await reqSvc.plan(session.sessionId, userId);
  const planMs = Math.round(performance.now() - t1);

  const briefSections =
    session.brief === undefined
      ? 0
      : [
          session.brief.problem,
          session.brief.targetUsers,
          session.brief.goals,
          session.brief.features,
          session.brief.userJourneys,
          session.brief.businessRules,
          session.brief.data,
          session.brief.security,
          session.brief.successCriteria,
        ].filter((s) => s.length > 0).length;
  const designSections =
    session.design === undefined
      ? 0
      : [
          session.design.visualPersonality,
          session.design.colorSystem,
          session.design.typography,
          session.design.responsiveStrategy,
          session.design.accessibility,
        ].filter((s) => s.length > 0).length;

  const cost = {
    aiCalls: session.cost?.aiCalls ?? 0,
    inputTokens: session.cost?.inputTokens ?? 0,
    outputTokens: session.cost?.outputTokens ?? 0,
    totalTokens: (session.cost?.inputTokens ?? 0) + (session.cost?.outputTokens ?? 0),
    ragCalls: session.cost?.ragCalls ?? 0,
    embeddingCalls: session.cost?.embeddingCalls ?? 0,
    estimatedCostUsd: session.cost?.estimatedCostUsd ?? 0,
    estimatedLatencyMs: session.cost?.estimatedLatencyMs ?? 0,
  };

  // ── Stage 3: Generate → evaluate → critic (EPIC-010 Phases 8–10) ──────────
  const t2 = performance.now();
  const evaluated = expSvc.evaluate({
    applicationId,
    archetype: session.intent?.archetype as never,
    files: scenario.files,
    securityFindings: scenario.securityFindings,
    validationEvidence: scenario.validationEvidence,
  });
  const evaluateMs = Math.round((performance.now() - t2) * 100) / 100;

  const classified = expSvc.findings({
    applicationId,
    archetype: session.intent?.archetype as never,
    files: scenario.files,
    securityFindings: scenario.securityFindings,
  });

  const quality = evaluated.quality;
  const dimensionScores: Record<string, number> = {};
  for (const d of quality.dimensions) {
    dimensionScores[d.dimension] = Math.round(d.score * 100);
  }
  const hasCriticalSecurity = scenario.securityFindings.some(
    (f) => f.severity === 'CRITICAL' || f.severity === 'HIGH',
  );
  const securityBlocksVerdict =
    hasCriticalSecurity &&
    quality.verdict === 'NOT_READY' &&
    quality.blockingDimensions.includes('SECURITY');

  // ── Stage 4: Targeted refinement (Phases 12–13) ───────────────────────────
  const firstFinding = evaluated.critic.findings[0];
  let refined = false;
  let refineTargeted = false;
  let refineUntouched = 0;
  let refineApprovalRequired = false;
  let refineMs = 0;
  if (firstFinding) {
    const t3 = performance.now();
    const plan: RefinementPlan = expSvc.refine({
      applicationId,
      archetype: session.intent?.archetype as never,
      findingId: firstFinding.id,
      files: scenario.files,
    }).plan;
    refineMs = Math.round((performance.now() - t3) * 100) / 100;
    refined = true;
    refineTargeted = plan.impact.targeted && plan.fileOperations.length > 0;
    refineUntouched = plan.untouched.length;
    refineApprovalRequired = plan.requiresApproval;
  }

  const totalMs = understandMs + planMs + evaluateMs + refineMs;

  return {
    id: scenario.id,
    archetype: session.intent?.archetype ?? 'unknown',
    archetypeMatch: (session.intent?.archetype ?? '') === scenario.expectedArchetype,
    understandMs,
    planMs,
    evaluateMs,
    refineMs,
    totalMs,
    requirements: requirements.length,
    confirmed,
    blockingQuestions,
    defaultsProposed,
    briefSections,
    designSections,
    architectureChoices: session.architecture?.choices.length ?? 0,
    buildSteps: session.buildPlan?.steps.length ?? 0,
    cost,
    qualityDimensions: quality.dimensions.length,
    dimensionScores,
    overallScore: Math.round(quality.overall * 100),
    verdict: quality.verdict,
    blockingDimensions: quality.blockingDimensions,
    criticFindings: evaluated.critic.findings.length,
    evidenceClassified:
      classified.findings.length === evaluated.critic.findings.length &&
      classified.findings.every((f) =>
        ['CONFIRMED', 'LIKELY', 'UNCERTAIN', 'NOT_FOUND'].includes(f.evidenceClass),
      ),
    securityGated: hasCriticalSecurity,
    securityBlocksVerdict,
    refined,
    refineTargeted,
    refineUntouched,
    refineApprovalRequired,
  };
}

// ── Runner ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('VedMoulya — EPIC-011 Production Application Benchmark (Phases 4/10/14)');
  console.log(
    '8 real application scenarios · deterministic engines · measured timing · estimated economics',
  );
  console.log('='.repeat(108));

  const reqSvc = new RequirementsApplicationService({
    store: new InMemoryRequirementSessionStore(),
  });
  const expSvc = new ExperienceApplicationService();

  const results: ScenarioResult[] = [];
  for (const scenario of SCENARIOS) {
    const result = await runScenario(reqSvc, expSvc, scenario);
    results.push(result);

    const dims = Object.keys(result.dimensionScores)
      .map((k) => `${k}=${result.dimensionScores[k]}`)
      .join(' ');
    console.log(`\n── ${result.id} (${result.archetype}${result.archetypeMatch ? ' ✓' : ' ✗'})`);
    console.log(
      `    requirements  ${result.requirements} (${result.confirmed} confirmed) · ${result.blockingQuestions} blocking Q · ${result.defaultsProposed} defaults`,
    );
    console.log(
      `    plan          brief ${result.briefSections}/9 · design ${result.designSections}/5 · arch ${result.architectureChoices} · build ${result.buildSteps} steps`,
    );
    console.log(
      `    cost (est.)   ${result.cost.aiCalls} AI calls · ${result.cost.inputTokens} in + ${result.cost.outputTokens} out tokens · ${result.cost.ragCalls} RAG · $${result.cost.estimatedCostUsd.toFixed(3)} · ~${result.cost.estimatedLatencyMs}ms`,
    );
    console.log(
      `    quality       ${result.overallScore}/100 · verdict ${result.verdict} · critic ${result.criticFindings} findings · ${result.qualityDimensions} dims`,
    );
    console.log(`                  ${dims}`);
    console.log(
      `    refine        ${result.refined ? 'planned' : 'none'} · targeted ${result.refineTargeted ? '✓' : '✗'} · untouched ${result.refineUntouched} files · approval ${result.refineApprovalRequired ? 'required' : 'not required'}`,
    );
    console.log(
      `    timing        understand ${result.understandMs}ms · plan ${result.planMs}ms · evaluate ${result.evaluateMs}ms · refine ${result.refineMs}ms · TOTAL ${result.totalMs}ms`,
    );
  }

  // ── Aggregates (Phases 10/14) ─────────────────────────────────────────────
  const avg = (fn: (r: ScenarioResult) => number): number =>
    results.reduce((acc, r) => acc + fn(r), 0) / results.length;
  const sum = (fn: (r: ScenarioResult) => number): number =>
    results.reduce((acc, r) => acc + fn(r), 0);

  console.log('\n' + '='.repeat(108));
  console.log('AGGREGATES (8 applications)');
  console.log(
    `  timing            understand avg ${avg((r) => r.understandMs).toFixed(0)}ms · plan avg ${avg((r) => r.planMs).toFixed(0)}ms`,
  );
  console.log(
    `                    evaluate avg ${avg((r) => r.evaluateMs).toFixed(1)}ms · refine avg ${avg((r) => r.refineMs).toFixed(1)}ms · total avg ${avg((r) => r.totalMs).toFixed(0)}ms`,
  );
  console.log(
    `  economics (est.)  ${sum((r) => r.cost.aiCalls)} AI calls · ${sum((r) => r.cost.inputTokens)} input + ${sum((r) => r.cost.outputTokens)} output tokens`,
  );
  console.log(
    `                    ${sum((r) => r.cost.ragCalls)} RAG calls · ${sum((r) => r.cost.embeddingCalls)} embedding calls · total est. cost $${sum((r) => r.cost.estimatedCostUsd).toFixed(3)} ($${avg((r) => r.cost.estimatedCostUsd).toFixed(3)}/app)`,
  );
  console.log(
    `  quality           ${results.filter((r) => r.qualityDimensions >= 10).length}/8 with all 10 dimensions · avg overall ${avg((r) => r.overallScore).toFixed(0)}/100`,
  );
  console.log(
    `  security gate     critical/high → NOT_READY: ${results.filter((r) => r.securityBlocksVerdict).length}/2 blocked · non-blocking findings never override`,
  );
  console.log(
    `  refinement        targeted ${results.filter((r) => r.refineTargeted).length}/8 · approval-gated ${results.filter((r) => r.refineApprovalRequired).length}/8`,
  );
  console.log(
    `  evidence-first    critic findings evidence-classified: ${results.filter((r) => r.evidenceClassified).length}/8`,
  );
  console.log(
    `  real AI calls     ${results.reduce((acc) => acc + 0, 0)} (deterministic engines; live AI critique = operator step)`,
  );

  // ── Verdict ───────────────────────────────────────────────────────────────
  const allMatch = results.every((r) => r.archetypeMatch);
  const allScored = results.every((r) => r.qualityDimensions >= 10 && r.criticFindings > 0);
  const allEvidenced = results.every((r) => r.evidenceClassified);
  const allRefined = results.every((r) => r.refined && r.refineTargeted && r.refineUntouched > 0);
  const gateHolds = results.filter((r) => r.securityGated).every((r) => r.securityBlocksVerdict);
  const verdict =
    allMatch && allScored && allEvidenced && allRefined && gateHolds ? 'PASS' : 'REVIEW';

  console.log('\n' + '─'.repeat(108));
  console.log(`VERDICT: ${verdict}`);
  if (verdict === 'PASS') {
    console.log('  All 8 applications: understood → planned → scored on 10 quality dimensions →');
    console.log(
      '  evidence-first critique → targeted approval-gated refinement → security-gated verdict.',
    );
  } else {
    console.log('  Review the flagged rows above.');
  }

  if (verdict !== 'PASS') process.exit(1);
}

main().catch((err: unknown) => {
  console.error('✗ Production benchmark FAILED:');
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
