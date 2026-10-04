// ─────────────────────────────────────────────────────────────────────────────
// SPRINT — Dynamic AI Usage Ledger tests
// Proves the ONE canonical accounting spine is honest:
//   • durable write + idempotency (streaming counted ONCE, replays are no-ops)
//   • user isolation (user A never sees user B's usage)
//   • TRUE calendar-day aggregation in the user's timezone (boundary aware)
//   • real calendar-month aggregation (never a retained trace window)
//   • provider / model / source aggregation
//   • LOCAL AI excluded from cloud totals but still visible
//   • unknown cost stays UNKNOWN (never an invented number)
//   • fallback: a failed attempt with zero billable usage records ZERO
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { InMemoryAiUsageStore } from '../observability/AiUsageLedger.js';
import { aggregateAiUsage } from '../observability/AiUsageBoard.js';
import { startOfDayInTimeZone, startOfMonthInTimeZone } from '../observability/AiUsageCalendar.js';
import { AiUsageRecorder } from '../observability/AiUsageRecorder.js';
import {
  buildEventId,
  isLocalProvider,
  type AiUsageEvent,
} from '../observability/AiUsageLedgerTypes.js';

function event(overrides: Partial<AiUsageEvent> = {}): AiUsageEvent {
  return {
    eventId: 'evt-1',
    userId: 'user-a',
    providerFamily: 'google',
    provider: 'google',
    model: 'gemini-2.5-flash',
    executionId: 'exec-1',
    source: 'ASK',
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    costUsd: 0.01,
    costUnknown: false,
    currency: 'USD',
    timestamp: Date.UTC(2026, 9, 15, 12, 0, 0),
    status: 'success',
    cached: false,
    retry: false,
    local: false,
    ...overrides,
  };
}

describe('AiUsageLedger — durable write + idempotency', () => {
  it('records an event and reports it back', async () => {
    const store = new InMemoryAiUsageStore();
    const recorder = new AiUsageRecorder(store);
    expect(await recorder.record(event())).toBe(true);
    const listed = await store.list({ userId: 'user-a' });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.totalTokens).toBe(150);
  });

  it('counts a streaming run EXACTLY once (terminal usage replays are no-ops)', async () => {
    const store = new InMemoryAiUsageStore();
    const recorder = new AiUsageRecorder(store);
    const id = buildEventId({ executionId: 'stream-1', provider: 'google', model: 'gemini' });
    // Chunks emit nothing; the terminal usage event arrives once.
    expect(await recorder.record(event({ eventId: id }))).toBe(true);
    // A replay of the SAME terminal event must not double count.
    expect(await recorder.record(event({ eventId: id }))).toBe(false);
    expect(await store.count('user-a')).toBe(1);
  });

  it('records ONE event per real provider call when a fallback occurs', async () => {
    const store = new InMemoryAiUsageStore();
    const recorder = new AiUsageRecorder(store);
    // OpenAI attempt failed and generated ZERO billable usage -> record zero.
    await recorder.record(
      event({
        eventId: buildEventId({ executionId: 'req-1', provider: 'openai', attempt: 0 }),
        provider: 'openai',
        providerFamily: 'openai',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        costUnknown: false,
        status: 'error',
      }),
    );
    // Google attempt succeeded.
    await recorder.record(
      event({
        eventId: buildEventId({ executionId: 'req-1', provider: 'google', attempt: 0 }),
        provider: 'google',
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
        costUsd: 0.002,
      }),
    );
    const board = aggregateAiUsage(await store.list({ userId: 'user-a' }));
    expect(board.cloud.executions).toBe(2);
    expect(board.cloud.totalTokens).toBe(30);
    expect(board.byProvider.find((p) => p.provider === 'openai')?.totalTokens).toBe(0);
    expect(board.byProvider.find((p) => p.provider === 'google')?.totalTokens).toBe(30);
  });

  it('records TWO events when two attempts REALLY happened (no dedupe by request)', async () => {
    const store = new InMemoryAiUsageStore();
    const recorder = new AiUsageRecorder(store);
    await recorder.record(
      event({ eventId: buildEventId({ executionId: 'r', provider: 'p', attempt: 0 }) }),
    );
    await recorder.record(
      event({ eventId: buildEventId({ executionId: 'r', provider: 'p', attempt: 1 }) }),
    );
    expect(await store.count('user-a')).toBe(2);
  });
});

describe('AiUsageLedger — user isolation', () => {
  it('never exposes one owner usage to another', async () => {
    const store = new InMemoryAiUsageStore();
    const recorder = new AiUsageRecorder(store);
    await recorder.record(event({ userId: 'user-a', eventId: 'a-1' }));
    await recorder.record(event({ userId: 'user-b', eventId: 'b-1', totalTokens: 999 }));
    expect((await store.list({ userId: 'user-a' })).map((e) => e.eventId)).toEqual(['a-1']);
    expect(aggregateAiUsage(await store.list({ userId: 'user-a' })).cloud.totalTokens).toBe(150);
    expect(aggregateAiUsage(await store.list({ userId: 'user-b' })).cloud.totalTokens).toBe(999);
  });

  it('stores no secrets in metadata', async () => {
    const store = new InMemoryAiUsageStore();
    await store.record(event({ metadata: { capability: 'reasoning', mode: 'text' } }));
    const [row] = await store.list({ userId: 'user-a' });
    expect(row?.metadata).toEqual({ capability: 'reasoning', mode: 'text' });
    expect(JSON.stringify(row)).not.toMatch(/sk-|AIza|Bearer /);
  });
});

describe('AiUsageCalendar — TRUE calendar day/month in the user timezone', () => {
  it('places a late-UTC event inside the user local day when it belongs there', () => {
    // 2026-10-15T23:30Z is 2026-10-16 in Asia/Tokyo (UTC+9) → a NEW local day.
    const now = Date.UTC(2026, 9, 15, 23, 30, 0);
    const tokyoDayStart = startOfDayInTimeZone(now, 'Asia/Tokyo');
    expect(new Date(tokyoDayStart).toISOString()).toBe('2026-10-15T15:00:00.000Z');
    // 14:30Z on the same day is still 2026-10-15 in Tokyo (before the boundary).
    const before = Date.UTC(2026, 9, 15, 14, 30, 0);
    expect(tokyoDayStart > before).toBe(true);
  });

  it('falls back to UTC for an invalid timezone (never crashes, never shifts silently)', () => {
    const now = Date.UTC(2026, 9, 15, 12, 0, 0);
    expect(startOfDayInTimeZone(now, 'Not/AZone')).toBe(startOfDayInTimeZone(now, 'UTC'));
  });

  it('computes the calendar month start (never a rolling 30-day window)', () => {
    const now = Date.UTC(2026, 9, 15, 12, 0, 0);
    expect(new Date(startOfMonthInTimeZone(now, 'UTC')).toISOString()).toBe(
      '2026-10-01T00:00:00.000Z',
    );
  });
});

describe('aggregateAiUsage — day/month/provider/model/source', () => {
  it('aggregates today vs this month from durable events', async () => {
    const store = new InMemoryAiUsageStore();
    const recorder = new AiUsageRecorder(store);
    const now = Date.UTC(2026, 9, 15, 12, 0, 0);
    // Yesterday, same month -> monthCloud only.
    await recorder.record(
      event({
        eventId: 'y',
        timestamp: now - 24 * 3_600_000,
        totalTokens: 400,
        inputTokens: 300,
        outputTokens: 100,
      }),
    );
    // Today -> monthCloud AND todayCloud.
    await recorder.record(
      event({ eventId: 't', timestamp: now, totalTokens: 150, inputTokens: 100, outputTokens: 50 }),
    );
    const board = aggregateAiUsage(await store.list({ userId: 'user-a' }), {
      now,
      timezone: 'UTC',
    });
    expect(board.monthCloud.totalTokens).toBe(550);
    expect(board.todayCloud.totalTokens).toBe(150);
  });

  it('aggregates by provider, model and source', async () => {
    const store = new InMemoryAiUsageStore();
    const recorder = new AiUsageRecorder(store);
    const now = Date.UTC(2026, 9, 15, 12, 0, 0);
    await recorder.record(
      event({
        eventId: 'p1',
        timestamp: now,
        provider: 'google',
        model: 'gemini',
        source: 'MISSION',
        totalTokens: 300,
      }),
    );
    await recorder.record(
      event({
        eventId: 'p2',
        timestamp: now,
        provider: 'google',
        model: 'gemini',
        source: 'ASK',
        totalTokens: 200,
      }),
    );
    await recorder.record(
      event({
        eventId: 'p3',
        timestamp: now,
        provider: 'openrouter',
        providerFamily: 'openrouter',
        model: 'auto',
        source: 'BRAIN',
        totalTokens: 700,
      }),
    );
    const board = aggregateAiUsage(await store.list({ userId: 'user-a' }), {
      now,
      timezone: 'UTC',
    });
    expect(board.cloud.totalTokens).toBe(1200);
    expect(board.byProvider.find((p) => p.provider === 'google')?.totalTokens).toBe(500);
    expect(board.byProvider.find((p) => p.provider === 'openrouter')?.totalTokens).toBe(700);
    expect(
      board.byModel.find((m) => m.provider === 'google' && m.model === 'gemini')?.totalTokens,
    ).toBe(500);
    expect(board.bySource.find((s) => s.source === 'BRAIN')?.totalTokens).toBe(700);
    expect(board.bySource.find((s) => s.source === 'MISSION')?.totalTokens).toBe(300);
  });

  it('keeps UNKNOWN cost unknown instead of inventing a number', async () => {
    const store = new InMemoryAiUsageStore();
    const recorder = new AiUsageRecorder(store);
    const now = Date.UTC(2026, 9, 15, 12, 0, 0);
    await recorder.record(
      event({ eventId: 'u1', timestamp: now, costUsd: 0, costUnknown: true, totalTokens: 800 }),
    );
    const board = aggregateAiUsage(await store.list({ userId: 'user-a' }), {
      now,
      timezone: 'UTC',
    });
    expect(board.cloud.costUnknown).toBe(true);
    expect(board.cloud.costUsd).toBe(0);
  });
});

describe('LOCAL AI separation', () => {
  it('excludes local usage from cloud totals but keeps it visible', async () => {
    const store = new InMemoryAiUsageStore();
    const recorder = new AiUsageRecorder(store);
    const now = Date.UTC(2026, 9, 15, 12, 0, 0);
    await recorder.record(
      event({ eventId: 'c1', timestamp: now, provider: 'google', totalTokens: 500, local: false }),
    );
    await recorder.record(
      event({
        eventId: 'l1',
        timestamp: now,
        provider: 'ollama',
        providerFamily: 'ollama',
        model: 'qwen2.5-coder:7b',
        totalTokens: 18_000,
        costUsd: 0,
        costUnknown: false,
        source: 'LOCAL_AGENT',
        local: true,
      }),
    );
    const board = aggregateAiUsage(await store.list({ userId: 'user-a' }), {
      now,
      timezone: 'UTC',
    });
    expect(board.cloud.totalTokens).toBe(500);
    expect(board.monthCloud.totalTokens).toBe(500);
    expect(board.local.totalTokens).toBe(18_000);
    expect(board.monthLocal.totalTokens).toBe(18_000);
    const ollama = board.byProvider.find((p) => p.provider === 'ollama');
    expect(ollama?.local).toBe(true);
    expect(ollama?.totalTokens).toBe(18_000);
  });

  it('classifies ollama / local-agent providers as local automatically', () => {
    expect(isLocalProvider('ollama', 'ollama')).toBe(true);
    expect(isLocalProvider('local-agent-1', 'custom')).toBe(true);
    expect(isLocalProvider('google', 'google')).toBe(false);
  });

  it('the recorder marks an ollama execution local even without an explicit flag', async () => {
    const store = new InMemoryAiUsageStore();
    const recorder = new AiUsageRecorder(store);
    await recorder.record(
      event({ eventId: 'auto', provider: 'ollama', providerFamily: 'ollama', local: false }),
    );
    const [row] = await store.list({ userId: 'user-a' });
    expect(row?.local).toBe(true);
  });
});

describe('AiUsageRecorder — span backfill (the single write path)', () => {
  it('records a completed provider execution exactly once, keyed by trace:span', async () => {
    const store = new InMemoryAiUsageStore();
    const recorder = new AiUsageRecorder(store);
    const span = {
      traceId: 'tr-1',
      spanId: 'sp-1',
      userId: 'user-a',
      attributes: {
        provider: 'google',
        provider_family: 'google',
        model: 'gemini-2.5-flash',
        status: 'success',
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
        cost: 0.01,
        attempt: 0,
      },
    };
    expect(await recorder.recordFromSpan(span)).toBe(true);
    expect(await recorder.recordFromSpan(span)).toBe(false);
    expect(await store.count('user-a')).toBe(1);
  });

  it('refuses a FAILED span (never invents usage for a failed call)', async () => {
    const store = new InMemoryAiUsageStore();
    const recorder = new AiUsageRecorder(store);
    const recorded = await recorder.recordFromSpan({
      traceId: 'tr-2',
      spanId: 'sp-2',
      userId: 'user-a',
      attributes: { provider: 'openai', status: 'error', error_reason: 'rate_limited' },
    });
    expect(recorded).toBe(false);
    expect(await store.count('user-a')).toBe(0);
  });

  it('refuses an unattributed span (no owner = no accounting guess)', async () => {
    const store = new InMemoryAiUsageStore();
    const recorder = new AiUsageRecorder(store);
    const recorded = await recorder.recordFromSpan({
      traceId: 'tr-3',
      spanId: 'sp-3',
      attributes: { provider: 'google', status: 'success', total_tokens: 10 },
    });
    expect(recorded).toBe(false);
  });

  it('honours an explicit ai_source attribute', async () => {
    const store = new InMemoryAiUsageStore();
    const recorder = new AiUsageRecorder(store);
    await recorder.recordFromSpan({
      traceId: 'tr-4',
      spanId: 'sp-4',
      userId: 'user-a',
      attributes: { provider: 'google', status: 'success', total_tokens: 20, ai_source: 'MISSION' },
    });
    const [row] = await store.list({ userId: 'user-a' });
    expect(row?.source).toBe('MISSION');
  });
});
