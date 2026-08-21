// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway router branch coverage tests
//
// Direct handler-level tests for the thin router adapters — the branch paths
// the full-pipeline router walker cannot reach with a hermetic in-memory
// stack (RAG store down, strict-environment verdicts, voice provider failure
// codes, context default arguments). Deterministic fakes only.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, afterEach } from 'vitest';
import { createRagRouter } from '../routers/RagRouter.js';
import { createVoiceRouter } from '../routers/VoiceRouter.js';
import { createContextRouter } from '../routers/ContextRouter.js';
import type { ApiResponse } from '../services/ResponseMapper.js';

const ctx = { userId: 'u1', email: 'u1@vm.local', role: 'user' } as never;

// ── RagRouter: health + readiness branches ──────────────────────────────────

describe('RagRouter health/readiness', () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  const fakeRag = (overrides: { statsThrows?: boolean; embeddingModel?: string }) => ({
    getStats: overrides.statsThrows
      ? vi.fn(async () => {
          throw new Error('store down');
        })
      : vi.fn(async () => ({ chunks: 3, collections: 1 })),
    embeddingModel: overrides.embeddingModel ?? 'mock-embedding-model',
    ingestDocument: vi.fn(async (input: unknown) => ({ ok: true, ...(input as object) })),
    search: vi.fn(async (input: unknown) => ({ results: [], ...(input as object) })),
    deleteSource: vi.fn(async () => ({ deleted: true })),
  });

  it('reports degraded (non-strict) when the vector store is unreachable', async () => {
    process.env.NODE_ENV = 'development';
    const router = createRagRouter(fakeRag({ statsThrows: true }) as never);
    const result = (await router.getHealth({ userId: 'u1' }, ctx)) as ApiResponse & {
      data: { status: string; vectorStoreReady: boolean };
    };
    expect(result.data.status).toBe('degraded');
    expect(result.data.vectorStoreReady).toBe(false);
    expect(result.data.embeddingConfigured).toBe(false); // mock embedding
    expect(result.data.productionRepository).toBe(false);
  });

  it('reports unhealthy (strict) when the vector store is unreachable', async () => {
    process.env.NODE_ENV = 'production';
    const router = createRagRouter(fakeRag({ statsThrows: true }) as never);
    const result = (await router.getHealth({ userId: 'u1' }, ctx)) as ApiResponse & {
      data: { status: string };
    };
    expect(result.data.status).toBe('unhealthy');
    expect(result.data.productionRepository).toBe(true);
  });

  it('reports unhealthy in strict mode when only the mock embedding provider is wired', async () => {
    process.env.NODE_ENV = 'production';
    const router = createRagRouter(fakeRag({}) as never);
    const result = (await router.getHealth({ userId: 'u1' }, ctx)) as ApiResponse & {
      data: { status: string; embeddingConfigured: boolean };
    };
    expect(result.data.status).toBe('unhealthy');
    expect(result.data.embeddingConfigured).toBe(false);
  });

  it('reports healthy with a real embedding provider and reachable store', async () => {
    process.env.NODE_ENV = 'production';
    const router = createRagRouter(fakeRag({ embeddingModel: 'text-embedding-3-small' }) as never);
    const result = (await router.getHealth({ userId: 'u1' }, ctx)) as ApiResponse & {
      data: { status: string; embeddingConfigured: boolean };
    };
    expect(result.data.status).toBe('healthy');
    expect(result.data.embeddingConfigured).toBe(true);
  });

  it('readiness is a boolean verdict over the health report', async () => {
    process.env.NODE_ENV = 'development';
    const down = createRagRouter(fakeRag({ statsThrows: true }) as never);
    const notReady = (await down.getReadiness({ userId: 'u1' }, ctx)) as ApiResponse & {
      data: { ready: boolean };
    };
    expect(notReady.data.ready).toBe(false);

    const up = createRagRouter(fakeRag({ embeddingModel: 'real-model' }) as never);
    const ready = (await up.getReadiness({ userId: 'u1' }, ctx)) as ApiResponse & {
      data: { ready: boolean };
    };
    expect(ready.data.ready).toBe(true);
  });

  it('ingest/search/delete/getStats delegate to the RAG service', async () => {
    const rag = fakeRag({});
    const router = createRagRouter(rag as never);
    await router.ingest(
      { userId: 'u1', collection: 'c', sourceId: 's', title: 't', content: 'body' },
      ctx,
    );
    await router.search({ userId: 'u1', collection: 'c', query: 'q', topK: 3, minScore: 0.2 }, ctx);
    await router.deleteSource({ userId: 'u1', collection: 'c', sourceId: 's' }, ctx);
    await router.getStats({ userId: 'u1', collection: 'c' }, ctx);
    expect(rag.ingestDocument).toHaveBeenCalled();
    expect(rag.search).toHaveBeenCalled();
    expect(rag.deleteSource).toHaveBeenCalled();
    expect(rag.getStats).toHaveBeenCalledWith('c');
  });
});

// ── VoiceRouter: honest error-code mapping ──────────────────────────────────

describe('VoiceRouter error mapping', () => {
  const fakeVoice = (overrides: {
    transcribeResult?: { success: boolean; code?: string; error?: string; data?: unknown };
    synthesizeResult?: { success: boolean; code?: string; error?: string; data?: unknown };
    appendResult?: { success: boolean; code?: string; error?: string; data?: unknown };
  }) => ({
    speechStatus: vi.fn(() => ({ stt: 'MOCK', tts: 'MOCK' })),
    transcribe: vi.fn(
      async () => overrides.transcribeResult ?? { success: true, data: { text: 'x' } },
    ),
    synthesize: vi.fn(
      async () =>
        overrides.synthesizeResult ?? {
          success: true,
          data: { audio: new Uint8Array(0), format: 'audio/wav' },
        },
    ),
    assessAction: vi.fn(() => ({ decision: 'NO_EXECUTION' })),
    createConversation: vi.fn(() => ({ id: 'c1' })),
    listConversations: vi.fn(() => []),
    appendTurn: vi.fn(() => overrides.appendResult ?? { success: true, data: { turn: 't' } }),
    clearConversation: vi.fn(() => {}),
  });

  it.each([
    ['NOT_CONFIGURED', 'SERVICE_UNAVAILABLE', 503],
    ['INVALID_INPUT', 'VALIDATION_ERROR', 400],
    ['CANCELLED', 'INTERNAL_ERROR', 499],
    ['NOT_FOUND', 'NOT_FOUND', 404],
    ['PROVIDER_FAILURE', 'DEPENDENCY_FAILURE', 502],
  ] as const)('maps code %s → %s with status %d', async (code, expectedCode, statusCode) => {
    const voice = fakeVoice({ transcribeResult: { success: false, code, error: 'boom' } });
    const router = createVoiceRouter(voice as never);
    const result = (await router.transcribe(
      { userId: 'u1', format: 'audio/wav', audioBase64: 'c21hbGw=' },
      ctx,
    )) as ApiResponse & {
      error: { code: string; statusCode: number; details?: { voiceCode?: string } };
    };
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(expectedCode);
    expect(result.error.statusCode).toBe(statusCode);
    expect(result.error.details?.voiceCode).toBe(code);
  });

  it('maps an unknown code to INTERNAL_ERROR/500', async () => {
    const voice = fakeVoice({
      transcribeResult: { success: false, code: 'WHATEVER', error: 'x' } as never,
    });
    const router = createVoiceRouter(voice as never);
    const result = (await router.transcribe(
      { userId: 'u1', format: 'audio/wav', audioBase64: 'c21hbGw=' },
      ctx,
    )) as ApiResponse & { error: { code: string; statusCode: number } };
    expect(result.error.code).toBe('INTERNAL_ERROR');
    expect(result.error.statusCode).toBe(500);
  });

  it('refuses an over-limit transcribe payload before decoding', async () => {
    const voice = fakeVoice({});
    const router = createVoiceRouter(voice as never);
    const result = (await router.transcribe(
      { userId: 'u1', format: 'audio/wav', audioBase64: 'A'.repeat(15 * 1024 * 1024) },
      ctx,
    )) as ApiResponse & { error: { code: string } };
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('VALIDATION_ERROR');
    expect(voice.transcribe).not.toHaveBeenCalled();
  });

  it('synthesize wraps audio as base64 and maps provider failure honestly', async () => {
    const ok = fakeVoice({});
    const router = createVoiceRouter(ok as never);
    const okResult = (await router.synthesize({ userId: 'u1', text: 'hi' }, ctx)) as ApiResponse & {
      data: { format: string };
    };
    expect(okResult.success).toBe(true);
    expect(okResult.data.format).toBe('audio/wav');

    const failing = fakeVoice({
      synthesizeResult: { success: false, code: 'PROVIDER_FAILURE', error: 'tts down' },
    });
    const failRouter = createVoiceRouter(failing as never);
    const failResult = (await failRouter.synthesize(
      { userId: 'u1', text: 'hi' },
      ctx,
    )) as ApiResponse & { error: { code: string } };
    expect(failResult.success).toBe(false);
    expect(failResult.error.code).toBe('DEPENDENCY_FAILURE');
  });
});

// ── ContextRouter: default-argument branches ────────────────────────────────

describe('ContextRouter default arguments', () => {
  const svc = (() => {
    const fns: Record<string, ReturnType<typeof vi.fn>> = {};
    const make = (name: string) => {
      fns[name] = vi.fn(async () => ({ ok: true }));
      return fns[name];
    };
    return {
      getContext: make('getContext'),
      registerContext: make('registerContext'),
      bulkRegisterContext: make('bulkRegisterContext'),
      deleteContext: make('deleteContext'),
      getContextSummary: make('getContextSummary'),
      getContextMetrics: make('getContextMetrics'),
      rankContext: make('rankContext'),
      filterContext: make('filterContext'),
      compressContext: make('compressContext'),
      assembleContext: make('assembleContext'),
      discoverContext: make('discoverContext'),
      searchContext: make('searchContext'),
      previewContext: make('previewContext'),
      explainContext: make('explainContext'),
      listBySource: make('listBySource'),
      listByCategory: make('listByCategory'),
      listByPriority: make('listByPriority'),
      listByCapability: make('listByCapability'),
    };
  })();

  const router = createContextRouter(svc as never);

  it('compress applies the default targetTokens when omitted', async () => {
    await router.compress({ userId: 'u1', items: [] }, ctx);
    expect(svc.compressContext).toHaveBeenCalledWith(
      { userId: 'u1', items: [] },
      4000,
      undefined,
      undefined,
      undefined,
    );
  });

  it('assemble applies the documented defaults when omitted', async () => {
    await router.assemble({ userId: 'u1', items: [] }, ctx);
    expect(svc.assembleContext).toHaveBeenCalledWith(
      { userId: 'u1', items: [] },
      'Enterprise request',
      'general_conversation',
      '',
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it('preview/explain pass optional capability tokens through', async () => {
    await router.preview({ userId: 'u1', id: 'ctx-1', capability: 'reasoning' }, ctx);
    expect(svc.previewContext).toHaveBeenCalledWith('ctx-1', 'reasoning');
    await router.explain({ userId: 'u1', id: 'ctx-1', capability: 'coding' }, ctx);
    expect(svc.explainContext).toHaveBeenCalledWith('ctx-1', 'coding', undefined, undefined);
  });

  it('every registry + lookup procedure delegates', async () => {
    await router.getContext({ userId: 'u1', id: 'x' }, ctx);
    await router.registerContext({ userId: 'u1', name: 'n' }, ctx);
    await router.bulkRegisterContext({ userId: 'u1', items: [] }, ctx);
    await router.deleteContext({ userId: 'u1', id: 'x' }, ctx);
    await router.getSummary({ userId: 'u1' }, ctx);
    await router.getMetrics({ userId: 'u1' }, ctx);
    await router.rank({ userId: 'u1', items: [] }, ctx);
    await router.filter({ userId: 'u1', items: [] }, ctx);
    await router.discover({ userId: 'u1', query: 'q' }, ctx);
    await router.search({ userId: 'u1', query: 'q' }, ctx);
    await router.listBySource({ userId: 'u1', source: 's' }, ctx);
    await router.listByCategory({ userId: 'u1', category: 'c' }, ctx);
    await router.listByPriority({ userId: 'u1', priority: 'p' }, ctx);
    await router.listByCapability({ userId: 'u1', capability: 'cap' }, ctx);
    expect(svc.getContext).toHaveBeenCalledWith('x');
    expect(svc.listByCapability).toHaveBeenCalledWith('cap');
  });
});
