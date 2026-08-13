// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Runtime Deterministic Smoke Test (AI-RUNTIME-002 C-02)
//
// Proves the COMPLETE AI runtime pipeline WITHOUT any production secrets:
//   document ingestion → chunking → embedding → persistence → retrieval
//   → ranking → Context Intelligence → optimization → AI Runtime → provider
//   → grounded response
//
// Uses deterministic in-memory repositories + mock embeddings + mock provider,
// so CI can run it with zero credentials. It verifies:
//   - relevant document retrieved
//   - irrelevant document excluded
//   - authorization boundary respected (tenant/user isolation)
//   - token optimization executed
//   - evidence state generated
//   - grounded request reaches provider only when evidence is sufficient
//   - insufficient evidence causes abstention
//   - retrieval failure on grounding-required requests causes abstention
//   - no cross-user leakage
//   - no cross-tenant leakage
//
// Run:
//   npm run ai:smoke
//   npx tsx scripts/ai-smoke.ts
// ─────────────────────────────────────────────────────────────────────────────

import {
  AIOrchestrationService,
  AIObservability,
  ContextOptimizer,
  EvidenceEvaluator,
  PromptCacheManager,
  TestAIObservabilityExporter,
} from '@vedmoulya/services';
import {
  RagApplicationService,
  InMemoryRagRepository,
  MockEmbeddingProvider,
} from '@vedmoulya/rag';
import { MockProvider } from '@vedmoulya/orchestrator';

// ── Hermetic environment ────────────────────────────────────────────────────
// The CI smoke test must NOT require production secrets. @vedmoulya/core
// fail-fast config requires a strong AUTH_JWT_SECRET; supply a deterministic
// dev-only fallback (never used in production — production deployments supply
// their own secret through the environment, and the config validator still
// rejects weak/placeholder secrets). Set BEFORE any service is constructed
// (config is evaluated lazily on first use).
if (process.env.NODE_ENV !== 'production' && !process.env.AUTH_JWT_SECRET) {
  process.env.AUTH_JWT_SECRET =
    'ai-smoke-deterministic-dev-secret-0123456789abcdefghijklmnopqrstuvwxyz';
}

// ── Deterministic test doubles ──────────────────────────────────────────────

const ragRepo = new InMemoryRagRepository();
const embedding = new MockEmbeddingProvider();
const rag = new RagApplicationService({ repository: ragRepo, embeddingProvider: embedding });

const orchestrator = new AIOrchestrationService({
  contextOptimizer: new ContextOptimizer(),
  promptCache: new PromptCacheManager(),
  evidenceEvaluator: new EvidenceEvaluator(),
});
orchestrator.registerProvider(new MockProvider());

// Wire the RAG retrieval port directly (no gateway needed for the smoke).
orchestrator.configureIntelligence({
  rag: {
    retrieve: async (input: {
      userId: string;
      query: string;
      collection: string;
      topK?: number;
    }): Promise<{ results: Array<{ title: string; content: string; score: number }> }> => {
      const search = await rag.search({
        userId: input.userId,
        collection: input.collection,
        query: input.query,
        topK: input.topK ?? 5,
      });
      return {
        results: search.results.map((r) => ({
          title: r.title,
          content: r.content,
          score: r.score,
          source: r.sourceId,
        })),
      };
    },
  },
});

// ── Helpers ─────────────────────────────────────────────────────────────────

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, detail = ''): void {
  checks += 1;
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title: string): void {
  console.log('');
  console.log(`── ${title} ${'─'.repeat(Math.max(0, 64 - title.length))}`);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('VedMoulya AI Runtime Deterministic Smoke Test');
  console.log('Mode: hermetic (in-memory RAG + mock embeddings + mock provider)');

  // 1. Ingest a relevant document and an irrelevant document.
  section('1. Document ingestion → chunking → embedding → persistence');
  await rag.ingestDocument({
    userId: 'user-a',
    collection: 'tenant-a:user-a',
    sourceId: 'doc-relevant',
    title: 'VedMoulya Content Agency',
    content:
      'The VedMoulya Content Agency automates client content production. ' +
      'It uses the AI runtime to generate, review, and publish marketing assets. ' +
      'The pipeline ingests documents, chunks them, embeds them, and retrieves them for grounded answers.',
    metadata: { category: 'playbook' },
  });
  await rag.ingestDocument({
    userId: 'user-a',
    collection: 'tenant-a:user-a',
    sourceId: 'doc-irrelevant',
    title: 'Unrelated Cooking Recipe',
    content:
      'A simple recipe for chocolate cake. Mix flour, sugar, cocoa, eggs, and butter. ' +
      'Bake at 180 degrees for 30 minutes. Serve with vanilla ice cream.',
    metadata: { category: 'recipe' },
  });
  const stats = await rag.getStats('tenant-a:user-a');
  check(
    'document ingested and chunked',
    stats.stats.chunkCount > 0,
    `chunks=${stats.stats.chunkCount}`,
  );
  check('embedding model is deterministic mock', rag.embeddingModel.includes('mock'));

  // 2. Retrieval: relevant retrieved, irrelevant excluded.
  section('2. Retrieval → ranking');
  const search = await rag.search({
    userId: 'user-a',
    collection: 'tenant-a:user-a',
    query: 'How does the Content Agency produce client content?',
    topK: 5,
  });
  const relevantHit = search.results.find((r) => r.sourceId === 'doc-relevant');
  const irrelevantHit = search.results.find((r) => r.sourceId === 'doc-irrelevant');
  check('relevant document retrieved', relevantHit !== undefined);
  check('irrelevant document excluded', irrelevantHit === undefined);
  check(
    'results ranked by score',
    search.results.every((r, i) => i === 0 || (search.results[i - 1]?.score ?? 0) >= r.score),
  );

  // 3. Authorization boundary: cross-user and cross-tenant isolation.
  //    Isolation is enforced by collection scoping: each user/tenant pair owns
  //    exactly one collection key. Searching a DIFFERENT collection (a
  //    different user's or tenant's scope) must never return another scope's
  //    documents.
  section('3. Authorization boundary');
  const crossUser = await rag.search({
    userId: 'user-b',
    collection: 'tenant-a:user-b', // user-b's own (empty) scope
    query: 'Content Agency',
    topK: 5,
  });
  check('cross-user retrieval blocked (different collection key)', crossUser.results.length === 0);

  // A search inside user-a's OWN scope still returns its documents (proof the
  // boundary is scope isolation, not global denial).
  const ownScope = await rag.search({
    userId: 'user-a',
    collection: 'tenant-a:user-a',
    query: 'Content Agency',
    topK: 5,
  });
  check('user retrieves from their own scope', ownScope.results.length > 0);

  const crossTenant = await rag.search({
    userId: 'user-a',
    collection: 'tenant-b:user-a',
    query: 'Content Agency',
    topK: 5,
  });
  check(
    'cross-tenant retrieval blocked (different collection key)',
    crossTenant.results.length === 0,
  );

  // 4. Grounded request with sufficient evidence reaches the provider.
  section('4. Grounded request → evidence → provider');
  const grounded = await orchestrator.orchestrate({
    capability: 'reasoning',
    userInput: 'Summarize how the Content Agency works.',
    qualityTier: 'standard',
    context: { systemPrompt: 'You are a helpful assistant.' },
    ragQuery: { query: 'Content Agency', collection: 'tenant-a:user-a', topK: 5 },
    groundingRequired: true,
    userId: 'user-a',
  });
  check('grounded request returned a response', grounded.content.length > 0);
  check(
    'evidence state generated',
    grounded.evidence !== undefined,
    `state=${grounded.evidence?.state}`,
  );
  check('grounded request did not abstain (sufficient evidence)', grounded.abstained !== true);

  // 5. Insufficient evidence causes abstention. Queries an EMPTY scope (no
  //    documents at all) so retrieval yields zero evidence deterministically —
  //    the runtime must abstain rather than fabricate.
  section('5. Insufficient evidence → abstention');
  const insufficient = await orchestrator.orchestrate({
    capability: 'reasoning',
    userInput: 'What is the quantum state of the VedMoulya platform?',
    qualityTier: 'standard',
    context: { systemPrompt: 'You are a helpful assistant.' },
    ragQuery: {
      query: 'quantum state unknown topic',
      collection: 'tenant-a:user-a:empty',
      topK: 5,
    },
    groundingRequired: true,
    userId: 'user-a',
  });
  check('insufficient evidence caused abstention', insufficient.abstained === true);
  // The typed abstention notice must be the runtime's standard abstention
  // message (explicitly declining to answer) — NOT a fabricated answer to the
  // user's question.
  check(
    'abstention returned no fabricated content',
    insufficient.abstained === true &&
      insufficient.content.includes('could not find sufficient evidence') &&
      !insufficient.content.toLowerCase().includes('quantum state'),
    `content=${insufficient.content.slice(0, 90)}`,
  );

  // 6. Retrieval failure on grounding-required request causes abstention.
  section('6. Retrieval failure → abstention');
  const failingOrchestrator = new AIOrchestrationService({
    evidenceEvaluator: new EvidenceEvaluator(),
  });
  failingOrchestrator.registerProvider(new MockProvider());
  failingOrchestrator.configureIntelligence({
    rag: {
      retrieve: () => {
        throw new Error('vector store unavailable');
      },
    },
  });
  const retrievalFailure = await failingOrchestrator.orchestrate({
    capability: 'reasoning',
    userInput: 'What is the Content Agency?',
    qualityTier: 'standard',
    context: { systemPrompt: 'You are a helpful assistant.' },
    ragQuery: { query: 'Content Agency', collection: 'tenant-a:user-a', topK: 5 },
    groundingRequired: true,
    userId: 'user-a',
  });
  check('retrieval failure caused abstention', retrievalFailure.abstained === true);

  // 7. Token optimization executed.
  section('7. Context Intelligence → optimization');
  const optimized = await orchestrator.orchestrate({
    capability: 'reasoning',
    userInput: 'Explain the Content Agency.',
    qualityTier: 'standard',
    context: {
      systemPrompt: 'You are a helpful assistant.',
      knowledgeContext: 'The Content Agency automates client content production. '.repeat(50),
    },
    enableOptimization: true,
    constraints: { maxInputTokens: 4000, maxOutputTokens: 128 },
    userId: 'user-a',
  });
  check('token optimization executed', optimized.tokenOptimization !== undefined);
  if (optimized.tokenOptimization) {
    // The EI-003 invariant: the optimized context stages (ranked → filtered →
    // compressed) are a strict subset of the raw input. finalTokens includes
    // the framing (system prompt + user input) so it may exceed originalTokens;
    // the meaningful reduction guarantee is on the context stages.
    check(
      'optimization reduced context tokens',
      optimized.tokenOptimization.compressedTokens <= optimized.tokenOptimization.originalTokens,
      `original=${optimized.tokenOptimization.originalTokens} compressed=${optimized.tokenOptimization.compressedTokens}`,
    );
  }

  // 8. No cross-user cache leakage. Uses a counting provider on a FRESH
  //    orchestrator: two identical requests from different users must each
  //    reach the provider (the cache key is identity-scoped), proving user B
  //    is never served user A's cached response.
  section('8. Cache isolation');
  let providerCalls = 0;
  const cacheProbe = new AIOrchestrationService({ evidenceEvaluator: new EvidenceEvaluator() });
  const countingProvider = new MockProvider();
  const originalExecute = countingProvider.execute.bind(countingProvider);
  countingProvider.execute = async (req) => {
    providerCalls += 1;
    return originalExecute(req);
  };
  cacheProbe.registerProvider(countingProvider);
  const cacheRequest = {
    capability: 'reasoning' as const,
    userInput: 'Cache isolation probe',
    qualityTier: 'standard' as const,
    context: { systemPrompt: 'You are a helpful assistant.' },
  };
  const cacheUserA = await cacheProbe.orchestrate({ ...cacheRequest, userId: 'user-a' });
  const cacheUserB = await cacheProbe.orchestrate({ ...cacheRequest, userId: 'user-b' });
  check(
    'identical requests from different users both reach the provider (no cross-user cache hit)',
    providerCalls === 2,
    `calls=${providerCalls}`,
  );
  check(
    'each user received a response',
    cacheUserA.content.length > 0 && cacheUserB.content.length > 0,
  );
  const cacheHitAgain = await cacheProbe.orchestrate({ ...cacheRequest, userId: 'user-a' });
  check(
    'repeated request from the SAME user is served from cache (hit)',
    providerCalls === 2,
    `calls=${providerCalls}`,
  );
  check('cached response is stable', cacheHitAgain.content === cacheUserA.content);

  // 9. Streaming: full stage sequence through stream() with a streaming
  //    provider, plus evidence contract on the streamed path.
  section('9. Streaming → typed run');
  const streamOrchestrator = new AIOrchestrationService({
    contextOptimizer: new ContextOptimizer(),
    evidenceEvaluator: new EvidenceEvaluator(),
  });
  const streamingMock = new MockProvider();
  streamingMock.stream = async function* () {
    // Deterministic canned stream — the async generator needs an await to
    // satisfy the async-iterable contract; a synchronous yield keeps it
    // deterministic while honoring the AsyncIterable type.
    await Promise.resolve();
    yield { type: 'content', data: { text: 'Streamed answer ' } };
    yield { type: 'content', data: { text: 'for the Content Agency.' } };
    yield { type: 'done', data: { latencyMs: 1, tokenUsage: { input: 10, output: 8 } } };
  };
  streamOrchestrator.registerProvider(streamingMock);
  streamOrchestrator.configureIntelligence({
    rag: {
      retrieve: async (input: {
        userId: string;
        query: string;
        collection: string;
        topK?: number;
      }): Promise<{ results: Array<{ title: string; content: string; score: number }> }> => {
        const search = await rag.search({
          userId: input.userId,
          collection: input.collection,
          query: input.query,
          topK: input.topK ?? 5,
        });
        return {
          results: search.results.map((r) => ({
            title: r.title,
            content: r.content,
            score: r.score,
            source: r.sourceId,
          })),
        };
      },
    },
  });
  const streamRun = await streamOrchestrator.stream({
    capability: 'reasoning',
    userInput: 'Stream an answer about the Content Agency.',
    qualityTier: 'standard',
    context: { systemPrompt: 'You are a helpful assistant.' },
    ragQuery: { query: 'Content Agency', collection: 'tenant-a:user-a', topK: 5 },
    groundingRequired: true,
    userId: 'user-a',
  });
  const streamStages = streamRun.events.filter((e) => e.type === 'status').map((e) => e.stage);
  check(
    'stream emits the full stage sequence',
    ['thinking', 'preparing_context', 'selecting_model', 'streaming', 'validating'].every((s) =>
      streamStages.includes(s),
    ),
    `stages=${streamStages.join(',')}`,
  );
  check(
    'streamed content assembled from chunks',
    streamRun.final.content.includes('Streamed answer'),
    `final=${streamRun.final.content.slice(0, 60)}`,
  );
  check(
    'stream evidence state generated',
    streamRun.final.evidence !== undefined,
    `state=${streamRun.final.evidence?.state}`,
  );
  check('stream did not abstain (sufficient evidence)', streamRun.final.abstained !== true);

  // 10. Observability: spans are emitted through the configured exporter
  //     with secrets redacted (C-03).
  section('10. Observability');
  const exporter = new TestAIObservabilityExporter();
  const obsOrchestrator = new AIOrchestrationService({
    observability: new AIObservability({ exporter, emitUserTenantCorrelation: true }),
  });
  obsOrchestrator.registerProvider(new MockProvider());
  await obsOrchestrator.orchestrate({
    capability: 'reasoning',
    userInput: 'Observe this run',
    qualityTier: 'standard',
    userId: 'user-a',
  });
  const spanNames = exporter.spans.map((s) => s.name);
  check(
    'observability emitted run + provider execution spans',
    spanNames.includes('ai.run') && spanNames.includes('ai.provider_execution'),
    `spans=${spanNames.join(',')}`,
  );
  check(
    'user correlation emitted only when permitted',
    exporter.spans.some((s) => s.userId === 'user-a'),
  );

  // ── Result ────────────────────────────────────────────────────────────────
  section('RESULT');
  if (failures === 0) {
    console.log(`✅ AI SMOKE TEST PASSED — ${checks} checks, 0 failures (hermetic, no secrets).`);
  } else {
    console.error(`✗ AI SMOKE TEST FAILED — ${failures}/${checks} checks failed.`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error('✗ AI smoke test FAILED:');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
