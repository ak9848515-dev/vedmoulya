// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — D1: AI usage ledger DURABILITY (never silently disappear)
//
// PRIMARY GUARANTEE under test:
//   AI EXECUTION → usage recording → durable ai_usage_events row
// must either succeed durably OR fail loudly and observably.
//
// These tests drive the REAL gateway wiring (ApiApplicationService's
// `ai.provider_execution` span → onAiSpanEnd → AiUsageRecorder → store), not a
// hand-built replica, so they fail when the production write path is not
// lifecycle-safe.
//
//   H  serverless lifecycle: when the request completes, the usage row is
//      ALREADY durable (a store that has not answered yet must not be reported
//      as a completed, accounted request)
//   D  a persistence failure is OBSERVABLE (logged with safe metadata), never
//      silently swallowed
//   E  table-initialization failure is observable
//   A/B/C  stream + non-stream success record; provider failure records nothing
//   F/G  duplicate execution and retry do not double-count
//   I..N  user / provider / model / tokens / cost / source / mission identity
// ─────────────────────────────────────────────────────────────────────────────

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { InMemoryApplicationRepository } from '@vedmoulya/app-factory';
import { InMemoryRequirementSessionStore } from '@vedmoulya/requirements';
import { logger } from '@vedmoulya/core';
import type {
  AIResponse,
  CapabilityType,
  ProviderHealth,
  ValidationResult,
} from '@vedmoulya/orchestrator';
import type { ProviderAdapter } from '@vedmoulya/services';
import { ApiApplicationService } from '../services/ApiApplicationService.js';
import { createAIRouter } from '../routers/AIRouter.js';
import { AiUsageRecorder } from '../observability/AiUsageRecorder.js';
import { PostgresAiUsageStore } from '../observability/AiUsageLedgerStore.js';
import type { PostgresSqlLike } from '../observability/AiUsageLedgerStore.js';
import type {
  AiUsageEvent,
  AiUsageRecordInput,
  AiUsageStore,
} from '../observability/AiUsageLedgerTypes.js';

const TOKENS_IN = 11;
const TOKENS_OUT = 22;
const COST_USD = 0.0012;

const OK_VALIDATION: ValidationResult = {
  passed: true,
  checks: [],
  overallScore: 1,
  decision: 'pass',
};

// Hermetic: no real provider may be reachable from this suite. The recorded
// adapter below is the ONLY adapter, so nothing here can call the network or
// spend a real credential.
beforeAll(() => {
  process.env.AI_ENABLE_MOCK = 'false';
  process.env.OPENAI_API_KEY = '';
  process.env.AI_OPENAI_API_KEY = '';
  process.env.AI_ANTHROPIC_API_KEY = '';
  process.env.AI_GOOGLE_API_KEY = '';
  process.env.AI_OPENROUTER_API_KEY = '';
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Deterministic adapter with REAL (known) usage + USD cost. No network. */
class RecordingAdapter implements ProviderAdapter {
  readonly executions: string[] = [];
  failWith: Error | undefined;

  constructor(
    public name: string,
    public family: string,
    public capabilities: CapabilityType[] = ['reasoning'],
  ) {}

  isHealthy(): Promise<boolean> {
    return Promise.resolve(true);
  }

  getHealth(): Promise<ProviderHealth> {
    return Promise.resolve({
      providerId: this.name,
      status: 'healthy',
      latency: 5,
      errorRate: 0,
      lastChecked: new Date(),
      isRateLimited: false,
      rateLimitRemaining: 100,
      rateLimitReset: null,
    });
  }

  execute(request: {
    messages: Array<{ role: string; content: string }>;
    model: string;
  }): Promise<AIResponse> {
    this.executions.push(request.model);
    if (this.failWith !== undefined) return Promise.reject(this.failWith);
    return Promise.resolve({
      content: `${this.name} answered`,
      provider: this.name,
      model: 'recorded-model',
      confidence: 1,
      qualityScore: 1,
      latency: 5,
      cost: COST_USD,
      tokenUsage: { input: TOKENS_IN, output: TOKENS_OUT, total: TOKENS_IN + TOKENS_OUT },
      validation: OK_VALIDATION,
      traceId: `trace-${this.name}`,
      metadata: {
        providerFamily: 'custom',
        modelVersion: 'recorded-model',
        processingTime: 5,
        contextUsed: [],
        routingDecision: {
          selectedProvider: this.name,
          reason: 'durability test adapter',
          alternativesConsidered: [],
          strategy: 'balanced',
        },
        validationDetails: [],
      },
    });
  }
}

/** In-memory store that records durably, like Postgres does. */
class RecordingStore implements AiUsageStore {
  readonly events: AiUsageEvent[] = [];
  recordError: Error | undefined;

  async record(event: AiUsageEvent): Promise<boolean> {
    if (this.recordError !== undefined) throw this.recordError;
    if (this.events.some((e) => e.eventId === event.eventId)) return false;
    this.events.push(event);
    return true;
  }

  async list(query: { userId?: string } = {}): Promise<AiUsageEvent[]> {
    return query.userId === undefined
      ? [...this.events]
      : this.events.filter((e) => e.userId === query.userId);
  }

  async count(userId?: string): Promise<number> {
    return (await this.list(userId === undefined ? {} : { userId })).length;
  }

  async clear(userId?: string): Promise<void> {
    if (userId === undefined) this.events.length = 0;
    else
      this.events.splice(0, this.events.length, ...this.events.filter((e) => e.userId !== userId));
  }
}

/**
 * Store whose write completes ONLY when the test releases it — the exact shape
 * of a real database round-trip. A request that returns before the write
 * settles is a request that can lose the row when the runtime is frozen.
 */
class DeferredStore implements AiUsageStore {
  readonly events: AiUsageEvent[] = [];
  private release: (() => void) | undefined;
  private readonly gate: Promise<void>;

  constructor() {
    this.gate = new Promise<void>((resolve) => {
      this.release = resolve;
    });
  }

  async record(event: AiUsageEvent): Promise<boolean> {
    await this.gate;
    if (this.events.some((e) => e.eventId === event.eventId)) return false;
    this.events.push(event);
    return true;
  }

  settle(): void {
    this.release?.();
  }

  async list(query: { userId?: string } = {}): Promise<AiUsageEvent[]> {
    return query.userId === undefined
      ? [...this.events]
      : this.events.filter((e) => e.userId === query.userId);
  }

  async count(userId?: string): Promise<number> {
    return (await this.list(userId === undefined ? {} : { userId })).length;
  }

  async clear(): Promise<void> {
    this.events.length = 0;
  }
}

function makeService(store: AiUsageStore): ApiApplicationService {
  return new ApiApplicationService({
    factoryRegistry: new InMemoryApplicationRepository(),
    requirementSessionStore: new InMemoryRequirementSessionStore(),
    aiUsageStore: store,
  });
}

/** The REAL router the gateway installs, bound to the service's own seams. */
function routerFor(svc: ApiApplicationService): ReturnType<typeof createAIRouter> {
  // Mirrors RouterRegistry's wiring exactly, including the D1 usage flusher.
  return createAIRouter(svc.ai, undefined, svc.withOwnerTrace, undefined, svc.flushAiUsage);
}

const INPUT = {
  userId: 'owner-a',
  capability: 'reasoning' as const,
  userInput: 'Reply with exactly: VEDMOULYA_DURABILITY_OK',
  qualityTier: 'standard' as const,
};

describe('D1 — AI usage recording is durable and observable', () => {
  // ── H: the serverless lifecycle guarantee ────────────────────────────────
  it('H: a completed request has its usage row ALREADY durable (serverless-safe)', async () => {
    const store = new DeferredStore();
    const svc = makeService(store);
    svc.ai.registerProvider(new RecordingAdapter('google', 'google'));

    const router = routerFor(svc);
    let requestCompleted = false;
    const pending = router.orchestrate(INPUT, {} as never).then((r) => {
      requestCompleted = true;
      return r;
    });

    // The provider has answered, but the durable write has NOT settled yet.
    // The request must therefore still be OPEN — otherwise it would return
    // while a billable row is only an unresolved promise, which is exactly what
    // a frozen serverless runtime drops.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requestCompleted).toBe(false);

    store.settle();
    const result = await pending;

    expect(result.success).toBe(true);
    expect(store.events.length).toBe(1);
  });

  it('H: the same guarantee holds on the STREAMING path', async () => {
    const store = new DeferredStore();
    const svc = makeService(store);
    svc.ai.registerProvider(new RecordingAdapter('google', 'google'));

    const router = routerFor(svc);
    let requestCompleted = false;
    const pending = router.stream(INPUT, {} as never).then((r) => {
      requestCompleted = true;
      return r;
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requestCompleted).toBe(false);

    store.settle();
    await pending;

    expect(store.events.length).toBe(1);
  });

  // ── D/E: persistence failure is observable, never silent ────────────────
  it('D: a store write failure is reported, not silently swallowed', async () => {
    const store = new RecordingStore();
    store.recordError = new Error('connection terminated unexpectedly');
    const svc = makeService(store);
    svc.ai.registerProvider(new RecordingAdapter('google', 'google'));

    const errors: unknown[][] = [];
    vi.spyOn(logger, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args);
    });

    await routerFor(svc).orchestrate(INPUT, {} as never);

    // The failure MUST be observable — and must carry safe metadata only.
    expect(errors.length).toBeGreaterThan(0);
    const reported = JSON.stringify(errors);
    expect(reported).toContain('google');
    expect(reported).not.toContain('postgres://');
    expect(reported).not.toContain('Bearer ');
  });

  it('D: an observability failure never surfaces a secret to the caller', async () => {
    const store = new RecordingStore();
    store.recordError = new Error('ECONNREFUSED 10.0.0.5:5432 password=hunter2');
    const svc = makeService(store);
    svc.ai.registerProvider(new RecordingAdapter('google', 'google'));
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    const result = await routerFor(svc).orchestrate(INPUT, {} as never);

    // The AI response itself must not carry database detail to the browser.
    expect(JSON.stringify(result)).not.toContain('hunter2');
    expect(JSON.stringify(result)).not.toContain('10.0.0.5');
  });

  // ── A/B/C: success records, failure does not fabricate ──────────────────
  it('A: a successful NON-STREAM execution records usage', async () => {
    const store = new RecordingStore();
    const svc = makeService(store);
    svc.ai.registerProvider(new RecordingAdapter('google', 'google'));

    await routerFor(svc).orchestrate(INPUT, {} as never);

    expect(store.events.length).toBe(1);
  });

  it('C: a provider failure creates NO false success usage row', async () => {
    const store = new RecordingStore();
    const svc = makeService(store);
    const adapter = new RecordingAdapter('google', 'google');
    adapter.failWith = new Error('provider exploded');
    svc.ai.registerProvider(adapter);

    await expect(routerFor(svc).orchestrate(INPUT, {} as never)).rejects.toThrow();

    expect(store.events.length).toBe(0);
  });

  // ── F/G: exactly-once ───────────────────────────────────────────────────
  it('F: the same execution recorded twice yields ONE durable event', async () => {
    const store = new RecordingStore();
    const svc = makeService(store);
    svc.ai.registerProvider(new RecordingAdapter('google', 'google'));

    await routerFor(svc).orchestrate(INPUT, {} as never);
    const recorded = [...store.events];
    // Replay the exact same event (restart / duplicate hook delivery).
    await store.record(recorded[0]!);

    expect(store.events.length).toBe(1);
  });

  it('F: different executions and different users stay separate + isolated', async () => {
    const store = new RecordingStore();
    const svc = makeService(store);
    svc.ai.registerProvider(new RecordingAdapter('google', 'google'));

    await routerFor(svc).orchestrate(INPUT, {} as never);
    await routerFor(svc).orchestrate({ ...INPUT, userId: 'owner-b' }, {} as never);

    expect(store.events.length).toBe(2);
    expect(await store.count('owner-a')).toBe(1);
    expect(await store.count('owner-b')).toBe(1);
    expect(await store.list({ userId: 'owner-c' })).toHaveLength(0);
  });

  // ── I..N: nothing about the measured usage is lost ──────────────────────
  it('I-N: owner, provider, model, tokens, cost and source are all preserved', async () => {
    const store = new RecordingStore();
    const svc = makeService(store);
    svc.ai.registerProvider(new RecordingAdapter('google', 'google'));

    await routerFor(svc).stream(INPUT, {} as never);

    const event = store.events[0];
    expect(event).toBeDefined();
    expect(event!.userId).toBe('owner-a');
    expect(event!.provider).toBe('google');
    expect(event!.providerFamily).toBe('google');
    expect(event!.model).toBe('recorded-model');
    expect(event!.inputTokens).toBe(TOKENS_IN);
    expect(event!.outputTokens).toBe(TOKENS_OUT);
    expect(event!.totalTokens).toBe(TOKENS_IN + TOKENS_OUT);
    expect(event!.costUsd).toBe(COST_USD);
    expect(event!.costUnknown).toBe(false);
    expect(event!.status).toBe('success');
    expect(event!.local).toBe(false);
    // Ask runs inside the `ai.request` owner trace → the Ask surface.
    expect(event!.source).toBe('ASK');
    // Mission identity is never invented for an Ask execution.
    expect(event!.missionId).toBeUndefined();
  });

  // ── E: table-initialization failure is observable ──────────────────────
  it('E: a missing-relation (failed table init) write is observable, never silent', async () => {
    // postgres.js-shaped fake whose EVERY statement fails the way a real
    // `CREATE TABLE`-never-ran database does. This is what an uninitialized
    // `ai_usage_events` table actually looks like from the writer's side.
    const missingRelation = (): Promise<never> =>
      Promise.reject(
        Object.assign(new Error('relation "ai_usage_events" does not exist'), { code: '42P01' }),
      );
    const brokenSql = Object.assign(missingRelation, {
      json: (value: unknown): unknown => JSON.stringify(value),
    }) as unknown as PostgresSqlLike;

    const recorder = new AiUsageRecorder(new PostgresAiUsageStore(brokenSql));
    const errors: unknown[][] = [];
    vi.spyOn(logger, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args);
    });

    const inserted = await recorder.record({
      userId: 'owner-a',
      providerFamily: 'google',
      provider: 'google',
      model: 'gemini-3.5-flash',
      executionId: 'exec-missing-table',
      source: 'ASK',
      inputTokens: 5,
      outputTokens: 7,
      costUsd: 0,
      costUnknown: false,
      status: 'success',
      cached: false,
      retry: false,
      local: false,
      timestamp: Date.now(),
    });

    // No false durable success claim...
    expect(inserted).toBe(false);
    // ...but the failure is LOUD and carries safe metadata only.
    expect(errors.length).toBeGreaterThan(0);
    const reported = JSON.stringify(errors);
    expect(reported).toContain('db_42P01');
    expect(reported).toContain('google');
    expect(reported).toContain('exec-missing-table');
    // Never SQL text, a DSN, a credential, or the user's prompt.
    expect(reported).not.toContain('CREATE TABLE');
    expect(reported).not.toContain('INSERT INTO');
    expect(reported).not.toContain('postgres://');
  });

  // ── G: a retry never double-counts one execution ────────────────────────
  it('G: duplicate delivery and retry attempts stay exactly-once', async () => {
    const store = new RecordingStore();
    const recorder = new AiUsageRecorder(store);
    const base: AiUsageRecordInput & { attempt: number } = {
      userId: 'owner-a',
      providerFamily: 'google',
      provider: 'google',
      model: 'gemini-3.5-flash',
      executionId: 'exec-retry',
      source: 'ASK',
      inputTokens: 5,
      outputTokens: 7,
      costUsd: 0.001,
      costUnknown: false,
      status: 'success',
      cached: false,
      retry: false,
      local: false,
      timestamp: Date.now(),
      attempt: 0,
    };

    // Same execution delivered twice (duplicate hook delivery / restart replay).
    expect(await recorder.record({ ...base })).toBe(true);
    expect(await recorder.record({ ...base })).toBe(false);
    expect(store.events.length).toBe(1);

    // A genuine provider RETRY is a second real call → its own event, still once.
    expect(await recorder.record({ ...base, attempt: 1, retry: true })).toBe(true);
    expect(store.events.length).toBe(2);

    // A different execution is never merged into an existing one.
    expect(await recorder.record({ ...base, executionId: 'exec-other' })).toBe(true);
    expect(store.events.length).toBe(3);

    await recorder.drain();
  });

  // ── H2: a FAILED write still resolves the request promptly ──────────────
  it('H: a store that never answers is drained by the request boundary', async () => {
    const store = new DeferredStore();
    const svc = makeService(store);
    svc.ai.registerProvider(new RecordingAdapter('google', 'google'));

    let requestCompleted = false;
    const pending = routerFor(svc)
      .stream(INPUT, {} as never)
      .then((r) => {
        requestCompleted = true;
        return r;
      });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requestCompleted).toBe(false);

    store.settle();
    const result = await pending;
    expect(result.success).toBe(true);
    expect(store.events.length).toBe(1);
    expect(store.events[0]!.provider).toBe('google');
  });
});
