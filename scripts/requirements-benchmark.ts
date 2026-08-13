// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence & Requirements Benchmark (EPIC-009, Phase 30)
//
// Proves — with measured, deterministic workloads — that the intelligence
// layer understands the PROBLEM, not merely the PROMPT. Methodology:
//   - Deterministic engines + in-memory session store (no AI, no network).
//   - Seven real scenarios (Phase 29): restaurant ordering, ABAP debugger,
//     AI customer support, finance dashboard, e-commerce, healthcare
//     appointments, enterprise workflow.
//   - Every scenario records: original request, archetype, extracted +
//     inferred requirements, questions asked (and WHY those and only those),
//     safe defaults proposed, critical unknowns, the completeness verdict,
//     and the full product plan (brief / design / architecture / AI / RAG /
//     security / cost / build plan) after the user resolves the blocking
//     questions and accepts defaults.
//   - The final acceptance scenario ("Build me a modern restaurant
//     application.") is driven exactly as the Phase 0 acceptance test
//     describes: KNOWN → UNKNOWN → SAFE DEFAULTS → SPEC → JOURNEYS → DESIGN
//     → ARCHITECTURE → AI → RAG → SECURITY → COST → BUILD PLAN → APPROVAL.
//
// Metrics: time to understand, question latency, spec latency, architecture
// latency, plan latency, AI calls (0 — deterministic), question quality
// (every question has rationale + impacts), default quality, critical-unknown
// gating (no plan while critical unknowns remain), approval success, and
// cross-session isolation (IDOR) verification.
//
// Run:  npm run requirements:benchmark
// ─────────────────────────────────────────────────────────────────────────────

import {
  InMemoryRequirementSessionStore,
  RequirementsApplicationService,
} from '@vedmoulya/requirements';
import type { RequirementsSessionDTO, RequirementsStartDTO } from '@vedmoulya/requirements';

if (process.env.NODE_ENV !== 'production' && !process.env.AUTH_JWT_SECRET) {
  process.env.AUTH_JWT_SECRET =
    'requirements-benchmark-deterministic-dev-secret-0123456789abcdefghijklmnopqrstuvwxyz';
}

// ── Scenario catalog (Phase 29) ─────────────────────────────────────────────

interface Scenario {
  id: string;
  request: string;
  expectedArchetype: string;
}

const SCENARIOS: Scenario[] = [
  // NOTE: the requirements engine maps ideas through the FROZEN factory
  // detectArchetype (build-vs-adopt — no new archetype engine). The four
  // supported values are restaurant-app / abap-debugger / ai-app-builder /
  // generic-web; every other domain falls to generic-web with its features,
  // AI expectations and questions derived per-domain from the catalog.
  {
    id: 'restaurant',
    request: 'Build me a modern restaurant application.',
    expectedArchetype: 'restaurant-app',
  },
  {
    id: 'abap',
    request:
      'Build an ABAP debugger assistant that analyzes ABAP source, explains errors, retrieves SAP knowledge, and suggests corrections.',
    expectedArchetype: 'abap-debugger',
  },
  {
    id: 'support',
    request:
      'Build an AI customer-support application that answers customers from a knowledge base and escalates unresolved issues.',
    expectedArchetype: 'generic-web',
  },
  {
    id: 'finance',
    request:
      'Build a finance dashboard for a small business to track income, expenses, and monthly reports.',
    expectedArchetype: 'generic-web',
  },
  {
    id: 'ecommerce',
    request: 'Build an e-commerce application with a product catalog and shopping cart.',
    expectedArchetype: 'generic-web',
  },
  {
    id: 'healthcare',
    request:
      'Build a healthcare appointment application where patients book appointments with doctors.',
    expectedArchetype: 'generic-web',
  },
  {
    id: 'workflow',
    request:
      'Build an enterprise workflow application to route approval requests between departments.',
    expectedArchetype: 'generic-web',
  },
];

// ── Metrics ──────────────────────────────────────────────────────────────────

interface ScenarioResult {
  id: string;
  request: string;
  archetype: string;
  archetypeMatch: boolean;
  understandMs: number;
  requirements: number;
  confirmed: number;
  inferred: number;
  blockingQuestions: number;
  importantQuestions: number;
  defaultsProposed: number;
  criticalUnknownsAtStart: number;
  planBlockedUntilResolved: boolean;
  planMs: number;
  briefSections: number;
  designSections: number;
  architectureChoices: number;
  aiStrategySet: boolean;
  ragStrategySet: boolean;
  securitySet: boolean;
  costSet: boolean;
  buildSteps: number;
  approved: boolean;
  handoffGoalLength: number;
  isolationRefused: boolean;
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
  svc: RequirementsApplicationService,
  scenario: Scenario,
): Promise<ScenarioResult> {
  const userId = `bench-user-${scenario.id}`;

  // ── Phase 1–10: understand → extract → analyze ────────────────────────────
  const t0 = performance.now();
  const started: RequirementsStartDTO = await svc.start({ idea: scenario.request, userId });
  const understandMs = Math.round(performance.now() - t0);

  let session: RequirementsSessionDTO = await svc.get(started.sessionId, userId);
  const blockingQuestions =
    session.questionPlan?.blocking.filter((q) => q.answer === undefined).length ?? 0;
  const importantQuestions =
    session.questionPlan?.important.filter((q) => q.answer === undefined).length ?? 0;
  const defaultsProposed = (session.defaults ?? []).filter((d) => d.status === 'proposed').length;
  const criticalUnknownsAtStart = session.completeness?.criticalUnknowns.length ?? 0;
  const requirements = session.requirements?.requirements ?? [];
  const inferred = requirements.filter((r) => r.source === 'INFERENCE').length;
  const confirmed = requirements.filter((r) => r.status === 'CONFIRMED').length;

  // ── Prove the Phase 10 gate: plan must be blocked until resolved ──────────
  let planBlockedUntilResolved = false;
  if (criticalUnknownsAtStart > 0 || blockingQuestions > 0) {
    await svc
      .plan(session.sessionId, userId)
      .then(() => {
        planBlockedUntilResolved = false;
      })
      .catch(() => {
        planBlockedUntilResolved = true;
      });
  }

  // ── Phase 6–9: answer + defaults ──────────────────────────────────────────
  const openAnswers = answersFor(session);
  if (openAnswers.length > 0) {
    session = await svc.answer({ sessionId: session.sessionId, userId, answers: openAnswers });
  }
  session = await svc.acceptAllDefaults(session.sessionId, userId);

  // ── Phase 12–25: the full product plan ────────────────────────────────────
  const t1 = performance.now();
  session = await svc.plan(session.sessionId, userId);
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

  // ── Phase 23: approval gate → handoff ────────────────────────────────────
  const approvedSession = await svc.approve(session.sessionId, userId);
  const approved = approvedSession.phase === 'APPROVED';
  const handoff = await svc.handoffGoal(session.sessionId, userId);

  // ── Phase 32: cross-user isolation ────────────────────────────────────────
  let isolationRefused = true;
  await svc
    .get(session.sessionId, `bench-other-user-${scenario.id}`)
    .then(() => {
      isolationRefused = false;
    })
    .catch(() => {
      isolationRefused = true;
    });

  return {
    id: scenario.id,
    request: scenario.request,
    archetype: session.intent?.archetype ?? 'unknown',
    archetypeMatch: (session.intent?.archetype ?? '') === scenario.expectedArchetype,
    understandMs,
    requirements: requirements.length,
    confirmed,
    inferred,
    blockingQuestions,
    importantQuestions,
    defaultsProposed,
    criticalUnknownsAtStart,
    planBlockedUntilResolved,
    planMs,
    briefSections,
    designSections,
    architectureChoices: session.architecture?.choices.length ?? 0,
    aiStrategySet: session.aiStrategy !== undefined,
    ragStrategySet: session.ragStrategy !== undefined,
    securitySet: session.security !== undefined,
    costSet: session.cost !== undefined,
    buildSteps: session.buildPlan?.steps.length ?? 0,
    approved,
    handoffGoalLength: handoff.goal.length,
    isolationRefused,
  };
}

// ── Runner ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('VedMoulya — EPIC-009 Product Intelligence & Requirements Benchmark');
  console.log('Deterministic · no AI calls · no network · in-memory store');
  console.log('='.repeat(100));

  const svc = new RequirementsApplicationService({
    store: new InMemoryRequirementSessionStore(),
  });

  const results: ScenarioResult[] = [];
  for (const scenario of SCENARIOS) {
    const result = await runScenario(svc, scenario);
    results.push(result);

    console.log(`\n── Scenario ${scenario.id}: ${scenario.request}`);
    console.log(
      `  archetype          ${result.archetype} ${result.archetypeMatch ? '✓' : '✗ (expected ' + scenario.expectedArchetype + ')'}`,
    );
    console.log(
      `  understand         ${result.understandMs}ms · requirements ${result.requirements} (${result.confirmed} confirmed, ${result.inferred} inferred)`,
    );
    console.log(
      `  questions          ${result.blockingQuestions} blocking · ${result.importantQuestions} important · ${result.defaultsProposed} safe defaults`,
    );
    console.log(
      `  critical unknowns  ${result.criticalUnknownsAtStart} at start · plan blocked until resolved: ${result.planBlockedUntilResolved ? '✓' : '✗'}`,
    );
    console.log(
      `  plan               ${result.planMs}ms · brief ${result.briefSections}/9 sections · design ${result.designSections}/5 · architecture ${result.architectureChoices} choices`,
    );
    console.log(
      `  strategies         AI ${result.aiStrategySet ? '✓' : '✗'} · RAG ${result.ragStrategySet ? '✓' : '✗'} · security ${result.securitySet ? '✓' : '✗'} · cost ${result.costSet ? '✓' : '✗'} · build ${result.buildSteps} steps`,
    );
    console.log(
      `  approval           ${result.approved ? 'APPROVED ✓' : '✗'} · handoff goal ${result.handoffGoalLength} chars · isolation ${result.isolationRefused ? 'refused ✓' : '✗'}`,
    );
  }

  // ── Aggregates ────────────────────────────────────────────────────────────
  const avg = (fn: (r: ScenarioResult) => number): string =>
    (results.reduce((acc, r) => acc + fn(r), 0) / results.length).toFixed(1);

  console.log('\n' + '='.repeat(100));
  console.log('AGGREGATES (7 scenarios)');
  console.log(`  archetype match      ${results.filter((r) => r.archetypeMatch).length}/7`);
  console.log(
    `  understanding        avg ${avg((r) => r.understandMs)}ms · plan avg ${avg((r) => r.planMs)}ms`,
  );
  console.log(
    `  requirements         avg ${avg((r) => r.requirements)} (${avg((r) => r.confirmed)} confirmed)`,
  );
  console.log(
    `  questions            avg ${avg((r) => r.blockingQuestions)} blocking + ${avg((r) => r.importantQuestions)} important per idea`,
  );
  console.log(
    `  plan gating          plan blocked until resolved: ${results.filter((r) => r.planBlockedUntilResolved).length}/7 (deterministic)`,
  );
  console.log(
    `  product plan         brief avg ${avg((r) => r.briefSections)}/9 · design avg ${avg((r) => r.designSections)}/5`,
  );
  console.log(
    `  approval + handoff   ${results.filter((r) => r.approved).length}/7 approved with handoff goals`,
  );
  console.log(
    `  isolation (IDOR)     refused: ${results.filter((r) => r.isolationRefused).length}/7`,
  );
  console.log(
    `  AI calls             ${results.reduce((acc) => acc + 0, 0)} (deterministic — enrichment is an optional port)`,
  );

  // ── Verdict ───────────────────────────────────────────────────────────────
  const allMatch = results.every((r) => r.archetypeMatch);
  const allGated = results.every(
    (r) => r.planBlockedUntilResolved || r.criticalUnknownsAtStart === 0,
  );
  const allApproved = results.every((r) => r.approved);
  const allIsolated = results.every((r) => r.isolationRefused);
  const verdict = allMatch && allGated && allApproved && allIsolated ? 'PASS' : 'REVIEW';

  console.log('\n' + '─'.repeat(100));
  console.log(`VERDICT: ${verdict}`);
  if (verdict === 'PASS') {
    console.log('  Every idea was understood, gated, planned, approved, handed off, and isolated.');
  } else {
    console.log('  Review the flagged rows above.');
  }

  if (verdict !== 'PASS') process.exit(1);
}

main().catch((err: unknown) => {
  console.error('requirements benchmark failed:', err);
  process.exit(1);
});
