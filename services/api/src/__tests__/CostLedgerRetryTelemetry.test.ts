// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — CostLedger retry telemetry regression
//
// A retry is a retry whether or not it also happens to carry provider-execution
// attributes. `ai.retry` accounting must therefore be independent of the
// provider-execution/cache-hit guard: two retry spans on a trace must yield
// `retries: 2` while exactly ONE provider execution is counted as an AI call.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { CostLedger } from '../observability/CostLedger.js';

type LedgerStore = Parameters<CostLedger['compute']>[0];

function storeWith(spans: Array<Record<string, unknown>>): LedgerStore {
  return {
    list: () => [
      {
        traceId: 'trace-retry',
        executionId: 'exec-retry',
        userId: 'user-a',
        name: 'ai.request',
        status: 'ok',
        startedAt: 0,
        endedAt: 10,
        spans: spans.map((span) => ({ events: [], ...span })),
      },
    ],
  } as unknown as LedgerStore;
}

describe('CostLedger — retry telemetry (independent of provider-execution counting)', () => {
  it('counts every ai.retry span in EconomicsTotals.retries', () => {
    const ledger = new CostLedger();
    const snapshot = ledger.compute(
      storeWith([
        {
          name: 'ai.provider_execution',
          kind: 'ai',
          attributes: { provider: 'p1', status: 'success', cost: 0.01 },
          durationMs: 5,
        },
        { name: 'ai.retry', kind: 'ai', attributes: { provider: 'p1' }, durationMs: 2 },
        { name: 'ai.retry', kind: 'ai', attributes: { provider: 'p1' }, durationMs: 2 },
      ]),
    );

    expect(snapshot.totals.retries).toBe(2);
    // Retries are NOT provider executions: exactly one provider call is counted.
    expect(snapshot.totals.aiCalls).toBe(1);
  });

  it('counts retries even when the trace has no provider execution at all', () => {
    const ledger = new CostLedger();
    const snapshot = ledger.compute(
      storeWith([{ name: 'ai.retry', kind: 'ai', attributes: { provider: 'p1' }, durationMs: 1 }]),
    );

    expect(snapshot.totals.retries).toBe(1);
    expect(snapshot.totals.aiCalls).toBe(0);
  });
});
