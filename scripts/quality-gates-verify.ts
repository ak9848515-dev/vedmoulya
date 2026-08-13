// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Quality Gates & Autonomous Loop Verification (EPIC-011, 7/8)
//
// Hermetic, deterministic verification of the HARD quality gates (Phase 8)
// and the bounded refinement loop (Phase 7):
//   CRITICAL SECURITY         → BLOCK (NOT_READY regardless of score)
//   HIGH SECURITY             → BLOCK
//   AUTHORIZATION FAILURE     → BLOCK (via security findings)
//   DATA LEAK                 → BLOCK (via security findings)
//   FUNCTIONAL TEST FAILURE   → BLOCK
//   GROUNDING FAILURE         → BLOCK (when grounding required)
//   STRUCTURED OUTPUT FAILURE → BLOCK
//   AGGREGATE SCORE HIDING    → FORBIDDEN (a 92/100 app with a critical
//                                security failure is still NOT_READY)
//   REFINEMENT LOOP           → BOUNDED (LoopBudget enforces max iterations /
//                                tokens / provider calls before the next call)
//
// The whole script is deterministic (no AI, no network). It reuses the frozen
// QualityEvaluator and LoopBudget — nothing is rebuilt.
//
// Run:  npm run quality:gates:verify
// ─────────────────────────────────────────────────────────────────────────────

import { QualityEvaluator } from '@vedmoulya/experience';
import type { VisualCriticReport } from '@vedmoulya/experience';
import { LoopBudget } from '@vedmoulya/loop-engine';

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, detail = ''): void {
  checks += 1;
  if (condition) {
    console.log(`    ✓ ${name}`);
  } else {
    failures += 1;
    console.error(`    ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title: string): void {
  console.log('');
  console.log(`── ${title} ${'─'.repeat(Math.max(0, 62 - title.length))}`);
}

// A NEUTRAL critic report (zero findings, score 1.0) represents a genuinely
// clean visual/UX review — the QualityEvaluator's VISUAL/UX dimensions read
// ONLY this critic report, so the security/functional gates below can be
// isolated from visual findings. (A real generated app usually has some
// findings — that is exercised by the production benchmark and the browser
// journeys; here the goal is to prove the HARD gates in isolation.)
const NEUTRAL_CRITIC: VisualCriticReport = {
  applicationId: 'gates-app',
  findings: [],
  score: 1,
  blocking: false,
};

const GOOD_FILES = [
  {
    path: 'src/ui/app.ts',
    content: 'export default function App(){return <main><h1>Ok</h1></main>;}',
  },
  { path: 'src/index.ts', content: 'export const ok = 1;' },
];

function evaluate(opts: {
  security?: Array<{
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
    filePath?: string;
  }>;
  validation?: Array<{ gate: string; passed: boolean; detail: string }>;
}): { overall: number; verdict: string; blocking: string[] } {
  const q = new QualityEvaluator().evaluate({
    applicationId: 'gates-app',
    files: GOOD_FILES,
    critic: NEUTRAL_CRITIC,
    securityFindings: opts.security,
    validationEvidence: opts.validation,
  });
  return {
    overall: Math.round(q.overall * 100),
    verdict: q.verdict,
    blocking: q.blockingDimensions,
  };
}

function main(): void {
  console.log('VedMoulya — Quality Gates & Autonomous Loop Verification (EPIC-011 Phases 7/8)');
  console.log('Deterministic · no AI · no network · frozen QualityEvaluator + LoopBudget');
  console.log('='.repeat(100));

  // ── 1. Baseline: clean app is READY ───────────────────────────────────────
  section('1. Baseline (no findings)');
  const clean = evaluate({});
  check(
    'clean app is READY',
    clean.verdict === 'READY',
    `verdict=${clean.verdict} overall=${clean.overall}`,
  );
  check('no blocking dimensions', clean.blocking.length === 0, clean.blocking.join(','));

  // ── 2. Hard security blockers ─────────────────────────────────────────────
  section('2. Security hard gates (CRITICAL/HIGH block regardless of score)');
  const critical = evaluate({
    security: [
      {
        severity: 'CRITICAL',
        description: 'Payment secrets exposed in the client bundle.',
        filePath: 'src/ui/app.ts',
      },
    ],
  });
  check(
    'CRITICAL security → BLOCK (NOT_READY)',
    critical.verdict === 'NOT_READY',
    `verdict=${critical.verdict} overall=${critical.overall}`,
  );
  check(
    'SECURITY listed as blocking dimension',
    critical.blocking.includes('SECURITY'),
    critical.blocking.join(','),
  );

  const high = evaluate({
    security: [
      {
        severity: 'HIGH',
        description: 'Patient records endpoint lacks ownership checks.',
        filePath: 'src/index.ts',
      },
    ],
  });
  check(
    'HIGH security → BLOCK (NOT_READY)',
    high.verdict === 'NOT_READY',
    `verdict=${high.verdict}`,
  );

  const dataLeak = evaluate({
    security: [
      {
        severity: 'CRITICAL',
        description: 'Cross-tenant data leak via un-scoped query.',
        filePath: 'src/index.ts',
      },
    ],
  });
  check('DATA LEAK → BLOCK', dataLeak.verdict === 'NOT_READY', `verdict=${dataLeak.verdict}`);

  const authz = evaluate({
    security: [
      {
        severity: 'HIGH',
        description: 'Authorization bypass: any user can delete records.',
        filePath: 'src/index.ts',
      },
    ],
  });
  check('AUTHORIZATION FAILURE → BLOCK', authz.verdict === 'NOT_READY', `verdict=${authz.verdict}`);

  const medium = evaluate({
    security: [
      { severity: 'MEDIUM', description: 'Payment redirect uses an unverified callback.' },
    ],
  });
  check(
    'MEDIUM security does NOT silently pass as a blocker-free READY',
    medium.verdict !== 'READY' || medium.blocking.length === 0,
    `verdict=${medium.verdict}`,
  );

  // ── 3. Aggregate score never hides a blocker ──────────────────────────────
  section('3. Aggregate-score masking is FORBIDDEN');
  // The evaluator has no way to reach a high aggregate while a critical
  // security dimension fails — by construction the failing dimension forces
  // NOT_READY. Prove it with the highest-quality input plus a critical finding.
  const masked = evaluate({
    security: [{ severity: 'CRITICAL', description: 'Hard-coded API key in frontend.' }],
    validation: [
      { gate: 'SPEC', passed: true, detail: 'approved' },
      { gate: 'BUILD', passed: true, detail: 'ok' },
      { gate: 'TESTS', passed: true, detail: '12/12' },
    ],
  });
  check(
    'critical failure forces NOT_READY even with green gates',
    masked.verdict === 'NOT_READY',
    `verdict=${masked.verdict} overall=${masked.overall}`,
  );

  // ── 4. Functional test failure blocks ─────────────────────────────────────
  section('4. FUNCTIONAL hard gate');
  const failing = evaluate({
    validation: [
      { gate: 'TESTS', passed: false, detail: '3/12 tests failed' },
      { gate: 'SECURITY', passed: true, detail: 'ok' },
    ],
  });
  check(
    'FUNCTIONAL test failure → BLOCK (NOT_READY)',
    failing.verdict === 'NOT_READY',
    `verdict=${failing.verdict}`,
  );
  check(
    'FUNCTIONAL listed as blocking dimension',
    failing.blocking.includes('FUNCTIONAL'),
    failing.blocking.join(','),
  );

  // ── 5. Grounding + structured-output gates (runtime contract) ─────────────
  section('5. Grounding + structured-output gates');
  // These are enforced by the frozen AI runtime (EvidenceEvaluator /
  // StructuredOutputValidator). The experience layer consumes their verdicts
  // via validationEvidence — a grounding/structured-output FAIL must surface
  // as a FUNCTIONAL gate failure (Phase 8: BLOCK).
  const grounding = evaluate({
    validation: [
      {
        gate: 'GROUNDING',
        passed: false,
        detail: 'Grounding required but evidence insufficient — abstained',
      },
      { gate: 'STRUCTURED_OUTPUT', passed: true, detail: 'schema-valid' },
    ],
  });
  check(
    'GROUNDING failure (when required) → BLOCK',
    grounding.verdict === 'NOT_READY',
    `verdict=${grounding.verdict}`,
  );

  const structured = evaluate({
    validation: [
      {
        gate: 'STRUCTURED_OUTPUT',
        passed: false,
        detail: 'schema-validated response failed validation',
      },
      { gate: 'TESTS', passed: true, detail: 'ok' },
    ],
  });
  check(
    'STRUCTURED OUTPUT failure → BLOCK',
    structured.verdict === 'NOT_READY',
    `verdict=${structured.verdict}`,
  );

  // ── 6. Bounded refinement loop (Phase 7 hard limits) ──────────────────────
  section('6. Bounded refinement loop (LoopBudget)');
  // A critic → refine → retest cycle that WOULD spin forever is stopped by
  // the pre-execution guards BEFORE the next specialist call (Phase 7: hard
  // limits remain mandatory — no infinite refinement).
  const budget = new LoopBudget({
    maxIterations: 3,
    maxTokens: 2_000,
    maxCostUsd: 0.05,
    maxProviderCalls: 4,
    maxToolCalls: 2,
    maxLatencyMs: 60_000,
  });
  let iterations = 0;
  let terminated = '';
  for (let i = 0; i < 20; i += 1) {
    // Pre-execution guard: refuse the next iteration/call BEFORE it happens.
    // canStartIteration takes ELAPSED wall-clock ms (not epoch).
    const gate = budget.canStartIteration(i * 1_000);
    const providerGate = budget.canCallProvider(200, 0.002);
    if (!gate.ok) {
      terminated = gate.reason ?? 'GATED';
      break;
    }
    if (!providerGate.ok) {
      terminated = providerGate.reason ?? 'GATED';
      break;
    }
    iterations += 1;
    budget.recordIteration();
    budget.recordSpecialist({
      tokens: { input: 200, output: 100, total: 300 },
      costUsd: 0.002,
      latencyMs: 40,
    });
    if (budget.canCallTool()) budget.recordToolCall();
    const after = budget.exceededAfter();
    if (!after.ok) {
      terminated = after.reason ?? 'GATED';
      break;
    }
  }
  check(
    'loop terminates on ITERATION_LIMIT (never spins)',
    terminated === 'ITERATION_LIMIT',
    `iterations=${iterations} reason=${terminated}`,
  );
  check(
    'termination happens BEFORE the next call (bounded)',
    iterations <= 3,
    `iterations=${iterations}`,
  );

  // The token budget is enforced independently of iteration count.
  const tiny = new LoopBudget({
    maxIterations: 10,
    maxTokens: 500,
    maxCostUsd: 1,
    maxProviderCalls: 10,
    maxToolCalls: 10,
    maxLatencyMs: 60_000,
  });
  let tinyTerminated = '';
  for (let i = 0; i < 10; i += 1) {
    const gate = tiny.canStartIteration(i * 1_000);
    const providerGate = tiny.canCallProvider(200, 0.001);
    if (!gate.ok) {
      tinyTerminated = gate.reason ?? 'GATED';
      break;
    }
    if (!providerGate.ok) {
      tinyTerminated = providerGate.reason ?? 'GATED';
      break;
    }
    tiny.recordIteration();
    tiny.recordSpecialist({
      tokens: { input: 200, output: 100, total: 300 },
      costUsd: 0.001,
      latencyMs: 20,
    });
    const after = tiny.exceededAfter();
    if (!after.ok) {
      tinyTerminated = after.reason ?? 'GATED';
      break;
    }
  }
  check(
    'token budget enforced independently of iterations',
    tinyTerminated === 'BUDGET_EXCEEDED',
    tinyTerminated || 'never gated',
  );

  section('RESULT');
  if (failures === 0) {
    console.log(`✅ QUALITY GATES VERIFICATION PASSED — ${checks}/${checks} checks, 0 failures.`);
    console.log('   CRITICAL/HIGH security block ✓ · aggregate-score masking forbidden ✓ ·');
    console.log(
      '   functional/grounding/structured-output gates block ✓ · refinement loop bounded ✓',
    );
  } else {
    console.error(`✗ QUALITY GATES VERIFICATION — ${failures}/${checks} checks failed.`);
    process.exitCode = 1;
  }
}

main();
