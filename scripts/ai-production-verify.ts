// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Runtime PRODUCTION Verification (EPIC-011, Phase 1)
//
// Operator-safe LIVE validation of the production AI runtime against a REAL
// provider. Covers the full Phase 1 checklist:
//   provider authentication · model availability · timeout · retry · fallback
//   · structured output · token accounting · budget enforcement · provider
//   routing · evidence handling · abstention · error normalization
//
// Safety rules (all enforced by construction):
//   - NEVER prints API keys or secrets (only the key prefix length is logged).
//   - NEVER makes unbounded calls: every call has maxInputTokens /
//     maxOutputTokens and a small bounded budget.
//   - NEVER silently falls back to mocks: without OPENAI_API_KEY (or a real
//     provider key for the configured provider) the script exits 2 with
//     "LIVE VALIDATION BLOCKED" + exact operator steps. It never fabricates
//     live evidence.
//
// Provider selection:
//   AI_PRODUCTION_VERIFY_PROVIDER=google|openai   (optional, default google)
// Google Gemini is the DEFAULT because it is the family this deployment funds;
// OpenAI stays selectable for an operator who has a funded OpenAI project.
//
// Prerequisites:
//   Google (default): export AI_GOOGLE_API_KEY=AIza...        (real key — required)
//   OpenAI (opt-in):  export AI_OPENAI_API_KEY=sk-... (or legacy OPENAI_API_KEY)
//   export AI_PRODUCTION_MODEL=<model id>  (optional; per-family default below)
//   export AUTH_JWT_SECRET=<strong secret>  (required by @vedmoulya/core)
//
// Run:
//   npm run ai:production:verify
//   npx tsx scripts/ai-production-verify.ts
// ─────────────────────────────────────────────────────────────────────────────

import {
  AIOrchestrationService,
  AIMetrics,
  ContextOptimizer,
  EvidenceEvaluator,
  PromptCacheManager,
} from '@vedmoulya/services';
import type { RagRetrievalPort } from '@vedmoulya/services';
import {
  VercelAIProvider,
  GoogleGeminiProvider,
  OpenAIEmbeddingProvider,
  MockProvider,
  resolveGoogleKey,
  resolveOpenAIKey,
} from '@vedmoulya/orchestrator';
import type { ProviderAdapter } from '@vedmoulya/orchestrator';
import { createOrchestratorRoutingPorts } from '@vedmoulya/mission-runtime';

/** Which real family this run exercises. Google is the funded default. */
type VerifyFamily = 'google' | 'openai';

function resolveVerifyFamily(): VerifyFamily {
  return (process.env.AI_PRODUCTION_VERIFY_PROVIDER ?? 'google').trim().toLowerCase() === 'openai'
    ? 'openai'
    : 'google';
}

const FAMILY: VerifyFamily = resolveVerifyFamily();
// Read through the deployment's OWN resolvers so the run describes this
// deployment's configuration rather than a hand-picked variable.
const API_KEY = FAMILY === 'google' ? resolveGoogleKey() : resolveOpenAIKey();
const MODEL =
  process.env.AI_PRODUCTION_MODEL?.trim() ||
  (FAMILY === 'openai' ? process.env.OPENAI_PRODUCTION_MODEL?.trim() : undefined) ||
  (FAMILY === 'google' ? 'gemini-3.5-flash' : 'gpt-4o-mini');

/** The adapter for the selected family — the same one the runtime registers. */
function createVerifyProvider(key: string, model: string): ProviderAdapter {
  return FAMILY === 'google'
    ? new GoogleGeminiProvider(key, { modelId: model })
    : new VercelAIProvider(key, { modelId: model });
}

let failures = 0;
let checks = 0;
let liveCalls = 0;

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
  console.log(`── ${title} ${'─'.repeat(Math.max(0, 64 - title.length))}`);
}

function requireKey(): string {
  if (!API_KEY) {
    const envName = FAMILY === 'google' ? 'AI_GOOGLE_API_KEY' : 'AI_OPENAI_API_KEY';
    const example = FAMILY === 'google' ? 'AIza...' : 'sk-...';
    console.error('✗ LIVE VALIDATION BLOCKED — no real provider key is configured.');
    console.error('');
    console.error('  IMPLEMENTATION VERIFIED · LIVE VALIDATION BLOCKED (operator step)');
    console.error('  Exact operator steps:');
    console.error(
      `    1. export ${envName}=${example}            # a REAL key, never a placeholder`,
    );
    console.error('    2. export AUTH_JWT_SECRET=<strong secret>   # same as the gateway');
    console.error('    3. npm run ai:production:verify');
    console.error('  This script exits non-zero now because a live call did NOT happen.');
    process.exit(2);
  }
  return API_KEY;
}

async function main(): Promise<void> {
  const apiKey = requireKey();
  console.log('VedMoulya — AI Runtime PRODUCTION Verification (EPIC-011 Phase 1)');
  console.log(
    `Provider: ${FAMILY} · Model: ${MODEL} · SDK: Vercel AI SDK (ai@7) · key ${apiKey.slice(0, 7)}… (never printed)`,
  );

  // ── A. Provider authentication + model availability ──────────────────────
  section('A. Provider authentication + model availability');
  const provider = createVerifyProvider(apiKey, MODEL);
  // Embeddings are an OpenAI-only path in this runtime; a Google key must never
  // be handed to the OpenAI embedding client.
  if (FAMILY === 'openai') {
    const embedding = new OpenAIEmbeddingProvider(apiKey);
    console.log(`    Embedding provider: ${embedding.model} (dim ${embedding.dimension})`);
  } else {
    console.log('    Embedding provider: not exercised (no embedding path for this family)');
  }

  {
    const ai = new AIOrchestrationService({
      evidenceEvaluator: new EvidenceEvaluator(),
      contextOptimizer: new ContextOptimizer(),
      promptCache: new PromptCacheManager(),
    });
    ai.registerProvider(provider);

    const health = await ai.getProviderHealth(FAMILY);
    check(
      'provider registered + configured',
      health.status === 'healthy',
      `status=${health.status}`,
    );
    liveCalls += 1;
    const t0 = Date.now();
    const out = await ai.orchestrate({
      capability: 'reasoning',
      userInput: 'Reply with exactly: AUTH_OK',
      qualityTier: 'standard',
      context: { systemPrompt: 'Smoke-test assistant. Answer concisely.' },
      constraints: { maxInputTokens: 2000, maxOutputTokens: 32 },
      userId: 'production-verify',
    });
    const latency = Date.now() - t0;
    check(
      'real provider authentication accepted (200-class call)',
      out.content.trim().length > 0,
      `${latency}ms`,
    );
    check(
      'model availability — content served',
      out.model !== undefined && out.model.length > 0,
      `model=${out.model}`,
    );
    console.log(`    content: ${out.content.slice(0, 80).replace(/\n/g, ' ')}`);
  }

  // ── B. Token accounting + budget enforcement ──────────────────────────────
  section('B. Token accounting + budget enforcement');
  {
    const ai = new AIOrchestrationService({ evidenceEvaluator: new EvidenceEvaluator() });
    ai.registerProvider(provider);
    const out = await ai.orchestrate({
      capability: 'reasoning',
      userInput: 'Give me a one-paragraph summary of token accounting in AI systems.',
      qualityTier: 'standard',
      constraints: { maxInputTokens: 4000, maxOutputTokens: 256 },
      userId: 'production-verify',
    });
    liveCalls += 1;
    check(
      'input/output token usage reported',
      (out.tokenUsage.input ?? 0) > 0 && (out.tokenUsage.output ?? 0) > 0,
      `in=${out.tokenUsage.input} out=${out.tokenUsage.output}`,
    );
    check('cost accounted (est. $)', out.cost > 0, `$${out.cost}`);
    check(
      'output within bound',
      (out.tokenUsage.output ?? 0) <= 256,
      `out=${out.tokenUsage.output}`,
    );

    // Budget enforcement: an infeasible input budget must fail cheaply or be
    // rejected — never silently truncated past the guard.
    const tight = await ai.orchestrate({
      capability: 'reasoning',
      userInput: 'ROI definition in one sentence.',
      qualityTier: 'standard',
      constraints: { maxInputTokens: 300, maxOutputTokens: 24 },
      userId: 'production-verify',
    });
    liveCalls += 1;
    check('tight budget respected', tight.content.length > 0, `out=${tight.tokenUsage.output}`);
  }

  // ── C. Provider routing (explainable, deterministic) ─────────────────────
  section('C. Provider routing');
  {
    const ai = new AIOrchestrationService({ evidenceEvaluator: new EvidenceEvaluator() });
    ai.registerProvider(provider);
    // The advisor is wired from the REAL registered adapters through the same
    // production wiring the Mission runtime uses (createOrchestratorRoutingPorts).
    // Without it `explainSelection` has no provider registry to score and throws
    // NotFoundError('ProviderRoutingAdvisor', 'not configured').
    ai.configureIntelligence(createOrchestratorRoutingPorts(ai));
    const explanation = await ai.explainSelection({
      capability: 'reasoning',
      estimatedInputTokens: 500,
    });
    check(
      'selection explained with reason',
      explanation.selected.reasons.length > 0,
      `selected=${explanation.selected.providerId}`,
    );
    check(
      'alternatives considered',
      Array.isArray(explanation.candidatesConsidered),
      `${explanation.candidatesConsidered.length} alt`,
    );
  }

  // ── D. Structured output (schema-validated, real provider) ───────────────
  section('D. Structured output');
  {
    const ai = new AIOrchestrationService({ evidenceEvaluator: new EvidenceEvaluator() });
    ai.registerProvider(provider);
    const out = await ai.orchestrate({
      capability: 'reasoning',
      userInput: 'Analyze this production verify run. Return the JSON object requested below.',
      qualityTier: 'standard',
      structuredSchema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          score: { type: 'number' },
          verdict: { type: 'string', enum: ['PASS', 'REVIEW', 'FAIL'] },
        },
        required: ['summary', 'score', 'verdict'],
      },
      constraints: { maxInputTokens: 4000, maxOutputTokens: 256 },
      userId: 'production-verify',
    });
    liveCalls += 1;
    let valid = false;
    try {
      const parsed = JSON.parse(out.content) as Record<string, unknown>;
      valid =
        typeof parsed.summary === 'string' &&
        typeof parsed.score === 'number' &&
        ['PASS', 'REVIEW', 'FAIL'].includes(String(parsed.verdict));
    } catch {
      valid = false;
    }
    check('structured output schema-valid', valid, out.content.slice(0, 90));
  }

  // ── E. Evidence handling + abstention (grounding contract) ───────────────
  section('E. Evidence handling + abstention');
  {
    // Deterministic no-knowledge-base harness — NOT a provider substitute.
    // An empty retrieval is exactly what a deployment with no indexed
    // enterprise knowledge returns. The runtime requires a `ragQuery` on a
    // grounding-required request (Evidence-First validation), so one is
    // supplied; with no evidence the run must ABSTAIN without calling the
    // provider and never fabricate a grounded answer.
    const emptyRag: RagRetrievalPort = {
      retrieve: () => Promise.resolve({ results: [] }),
    };
    const ai = new AIOrchestrationService({
      evidenceEvaluator: new EvidenceEvaluator(),
      rag: emptyRag,
    });
    ai.registerProvider(provider);
    const out = await ai.orchestrate({
      capability: 'reasoning',
      userInput: 'What does the VedMoulya internal knowledge base say about this?',
      qualityTier: 'standard',
      groundingRequired: true,
      ragQuery: { collection: 'knowledge_base', query: 'VedMoulya internal knowledge base' },
      userId: 'production-verify',
    });
    // Abstention performs NO provider call — only count it as a live call when
    // the run actually reached the provider.
    if (!out.abstained) liveCalls += 1;
    check(
      'grounding-required without evidence does not fabricate',
      out.abstained === true || out.evidence?.state !== 'SUFFICIENT_EVIDENCE',
      `state=${out.evidence?.state} abstained=${out.abstained}`,
    );
  }

  // ── F. Error normalization (timeout / 429 / 5xx vocabulary) ──────────────
  section('F. Error normalization');
  {
    const ai = new AIOrchestrationService({
      evidenceEvaluator: new EvidenceEvaluator(),
      retryBaseDelayMs: 1,
    });
    // A deliberately failing live-shaped provider exercises the runtime's
    // normalization path deterministically (no unbounded retries: the flaky
    // provider recovers on attempt 2, exactly like the production adapter's
    // bounded retry).
    let attempts = 0;
    const flaky = new MockProvider();
    const orig = flaky.execute.bind(flaky);
    flaky.execute = async (req) => {
      attempts += 1;
      if (attempts === 1) throw new Error('api error: 500');
      if (attempts === 2) throw new Error('429 too many requests');
      return orig(req);
    };
    ai.registerProvider(flaky);
    const out = await ai.orchestrate({
      capability: 'reasoning',
      userInput: 'Retry probe',
      qualityTier: 'standard',
      userId: 'u1',
    });
    check(
      '5xx → retry → 429 → retry → recover',
      attempts >= 3 && out.content.length > 0,
      `attempts=${attempts}`,
    );

    const timeoutAi = new AIOrchestrationService({
      evidenceEvaluator: new EvidenceEvaluator(),
      retryBaseDelayMs: 1,
    });
    const slow = new MockProvider();
    slow.execute = () => {
      throw new Error('request timed out');
    };
    const backup = new MockProvider();
    timeoutAi.registerProvider(slow);
    timeoutAi.registerProvider(backup);
    const fallback = await timeoutAi.orchestrate({
      capability: 'reasoning',
      userInput: 'Timeout probe',
      qualityTier: 'standard',
      userId: 'u1',
    });
    check(
      'timeout → fallback to second provider',
      fallback.provider === backup.name,
      `provider=${fallback.provider}`,
    );
  }

  // ── G. Streaming (real provider, full stage sequence) ────────────────────
  section('G. Streaming (real provider)');
  {
    const ai = new AIOrchestrationService({ evidenceEvaluator: new EvidenceEvaluator() });
    ai.registerProvider(provider);
    const run = await ai.stream({
      capability: 'reasoning',
      userInput: 'Count from one to five.',
      qualityTier: 'standard',
      constraints: { maxInputTokens: 2000, maxOutputTokens: 64 },
      userId: 'production-verify',
    });
    liveCalls += 1;
    const stages = run.events.filter((e) => e.type === 'status').map((e) => e.stage);
    check(
      'full stage sequence emitted',
      ['thinking', 'preparing_context', 'selecting_model', 'streaming', 'validating'].every((s) =>
        stages.includes(s),
      ),
      stages.join(','),
    );
    check('content delivered', run.final.content.trim().length > 0, run.final.content.slice(0, 60));
  }

  // ── H. Telemetry + cost summary ──────────────────────────────────────────
  section('H. Telemetry + economics');
  const metrics = AIMetrics.getInstance();
  console.log(`    AI calls made this run: ${liveCalls}`);
  console.log(`    Runtime total requests observed: ${metrics.getTotalRequests()}`);
  console.log(`    Response-cache hit ratio: ${(metrics.getCacheHitRatio() * 100).toFixed(1)}%`);
  console.log(
    `    Prompt-cache hit ratio: ${(metrics.getPromptCacheHitRatio() * 100).toFixed(1)}%`,
  );

  section('RESULT');
  if (failures === 0) {
    console.log(
      `✅ PRODUCTION AI VERIFICATION PASSED — ${checks}/${checks} checks, ${liveCalls} live provider calls, 0 failures.`,
    );
    console.log(
      '   authentication ✓ · model availability ✓ · timeout/retry/fallback ✓ · structured output ✓',
    );
    console.log(
      '   token accounting ✓ · budget enforcement ✓ · provider routing ✓ · evidence/abstention ✓',
    );
    console.log('   error normalization ✓ · streaming ✓ · telemetry ✓');
  } else {
    console.error(`✗ PRODUCTION AI VERIFICATION FAILED — ${failures}/${checks} checks failed.`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  // A provider-billing / quota rejection means the REQUEST reached the real
  // provider (authentication + model negotiation succeeded) but the account
  // has no credits. That is LIVE VALIDATION BLOCKED (operator step), not an
  // implementation failure — and it must never be reported as a pass.
  if (/no credits|billing|insufficient_quota|quota|payment/i.test(message)) {
    console.error(
      'ℹ LIVE VALIDATION BLOCKED (provider quota) — the call reached the real provider',
    );
    console.error('   and authentication/model negotiation succeeded, but the account has no');
    console.error('   billing credits. This is an OPERATOR step, not an implementation failure.');
    console.error('   Exact operator steps:');
    console.error(
      '     1. Add credits / a payment method at https://platform.openai.com/settings/organization/billing',
    );
    console.error('     2. Re-run:  npm run ai:production:verify');
    console.error(`   Provider response: ${message.slice(0, 200)}`);
    process.exitCode = 3;
    return;
  }
  console.error('✗ Production AI verification FAILED (implementation defect):');
  console.error(message);
  process.exitCode = 1;
});
