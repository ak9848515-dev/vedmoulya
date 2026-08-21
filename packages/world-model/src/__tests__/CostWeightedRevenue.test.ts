// SPRINT-034 — CostWeightedRevenue
// Margin-aware revenue ranking composing CostLedger evidence. UNKNOWN revenue
// is NOT zero; UNKNOWN cost is NOT zero; UNKNOWN margin is NOT zero. Every
// calculation exposes its assumptions; ranking is advisory.

import { describe, expect, it } from 'vitest';
import { CostWeightedRevenue, rankScoreOf } from '../domain/CostWeightedRevenue.js';
import type { WorldCostPort } from '../contracts/world-ports.js';
import type { RevenueStream } from '../types/world-types.js';

const now = (): string => '2026-08-15T10:00:00.000Z';

function stream(overrides: Partial<RevenueStream> & { id: string; name: string }): RevenueStream {
  return {
    ownerId: 'alice',
    stableKey: `alice:${overrides.id}`,
    kind: 'SERVICE',
    status: 'ACTIVE',
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  } as RevenueStream;
}

const noCost: WorldCostPort = {
  measuredCostUsd: () => undefined,
};

describe('CostWeightedRevenue', () => {
  it('ranks margin-aware — a lower-revenue high-margin stream beats a higher-revenue low-margin one', () => {
    const ranking = new CostWeightedRevenue(noCost, now).rank('alice', [
      stream({
        id: 'high-margin',
        name: 'High margin',
        estimatedMonthlyRevenueUsd: { value: 1000, status: 'ESTIMATED', evidence: ['deal'] },
        estimatedMonthlyCostUsd: { value: 100, status: 'ESTIMATED', evidence: ['costs'] },
      }),
      stream({
        id: 'high-revenue',
        name: 'High revenue',
        estimatedMonthlyRevenueUsd: { value: 12000, status: 'ESTIMATED', evidence: ['deal'] },
        estimatedMonthlyCostUsd: { value: 5000, status: 'ESTIMATED', evidence: ['costs'] },
      }),
    ]);
    const [first, second] = ranking.entries;
    expect(first?.streamId).toBe('high-margin');
    expect(second?.streamId).toBe('high-revenue');
    expect(first?.roiUsd).toBeGreaterThan(second?.roiUsd ?? 0);
    // High-margin: (1000−100)/100 = 9; high-revenue: (12000−5000)/5000 = 1.4.
    expect(first?.roiUsd).toBeCloseTo(9, 1);
    expect(second?.roiUsd).toBeCloseTo(1.4, 1);
    // Rank score is the clamped ROI (a single outlier cannot dominate).
    expect(first?.rankScore).toBeCloseTo(9, 1);
    expect(second?.rankScore).toBeCloseTo(1.4, 1);
  });

  it('UNKNOWN cost is NOT zero — an entry without cost evidence is listed, not ranked', () => {
    const ranking = new CostWeightedRevenue(noCost, now).rank('alice', [
      stream({
        id: 'no-cost',
        name: 'No cost evidence',
        estimatedMonthlyRevenueUsd: { value: 10000, status: 'ESTIMATED', evidence: ['deal'] },
      }),
    ]);
    const entry = ranking.entries[0];
    if (!entry) throw new Error('no entry');
    expect(entry.rankScore).toBeUndefined();
    expect(entry.roiUsd).toBeUndefined();
    expect(entry.assumptions.some((a) => a.includes('No cost evidence'))).toBe(true);
    expect(ranking.unknownCost).toContain('No cost evidence');
    // The stream is NOT ranked as if cost were 0 (that would fabricate ROI).
    expect(entry.assumptions.some((a) => a.includes('never treated as zero'))).toBe(true);
  });

  it('UNKNOWN revenue is NOT zero — no fabricated margin', () => {
    const ranking = new CostWeightedRevenue(noCost, now).rank('alice', [
      stream({
        id: 'no-revenue',
        name: 'No revenue evidence',
        estimatedMonthlyCostUsd: { value: 100, status: 'ESTIMATED', evidence: ['costs'] },
      }),
    ]);
    expect(ranking.unknownRevenue).toContain('No revenue evidence');
    expect(ranking.entries[0]?.rankScore).toBeUndefined();
    expect(ranking.entries[0]?.assumptions.some((a) => a.includes('never treated as zero'))).toBe(
      true,
    );
  });

  it('uses CostLedger measured cost when present (verified accounting overrides estimates)', () => {
    // A stream-scoped cost port provides REAL ledger evidence for this stream.
    const costPort: WorldCostPort = {
      measuredCostUsd: (ownerId, scope) =>
        scope?.streamId === 'measured'
          ? { value: 50, evidence: ['cost-ledger:stream-measured'] }
          : undefined,
    };
    const ranking = new CostWeightedRevenue(costPort, now).rank('alice', [
      stream({
        id: 'measured',
        name: 'Measured',
        estimatedMonthlyRevenueUsd: { value: 1000, status: 'ESTIMATED', evidence: ['deal'] },
        estimatedMonthlyCostUsd: { value: 900, status: 'ESTIMATED', evidence: ['stale'] },
      }),
    ]);
    const entry = ranking.entries[0];
    if (!entry) throw new Error('no entry');
    expect(entry.measuredCostUsd).toBe(50);
    // ROI computed from the MEASURED cost: (1000−50)/50 = 19 (raw ROI), rank
    // score clamped to 10.
    expect(entry.roiUsd).toBeCloseTo(19, 1);
    expect(entry.rankScore).toBeCloseTo(10, 1);
    expect(entry.assumptions.some((a) => a.includes('CostLedger'))).toBe(true);
  });

  it('exposes every assumption — the arithmetic is never hidden', () => {
    const ranking = new CostWeightedRevenue(noCost, now).rank('alice', [
      stream({
        id: 's1',
        name: 'Stream',
        estimatedMonthlyRevenueUsd: { value: 1000, status: 'VERIFIED', evidence: ['actuals'] },
        estimatedMonthlyCostUsd: { value: 200, status: 'ESTIMATED', evidence: ['costs'] },
        automationPercentage: { value: 0.5, status: 'ESTIMATED', evidence: ['estimate'] },
      }),
    ]);
    const entry = ranking.entries[0];
    if (!entry) throw new Error('no entry');
    expect(entry.assumptions.length).toBeGreaterThan(0);
    expect(entry.assumptions.some((a) => a.includes('verified'))).toBe(true);
    expect(entry.assumptions.some((a) => a.includes('estimated'))).toBe(true);
  });

  it('rankScoreOf returns undefined when either side is UNKNOWN and clamps the rank', () => {
    expect(
      rankScoreOf(
        { value: 100, status: 'UNKNOWN', evidence: [] },
        { value: 10, status: 'ESTIMATED', evidence: ['c'] },
      ),
    ).toBeUndefined();
    expect(
      rankScoreOf(
        { value: 100, status: 'VERIFIED', evidence: ['r'] },
        { value: 10, status: 'UNKNOWN', evidence: [] },
      ),
    ).toBeUndefined();
    expect(
      rankScoreOf(
        { value: 100, status: 'VERIFIED', evidence: ['r'] },
        { value: 10, status: 'VERIFIED', evidence: ['c'] },
      ),
    ).toBeCloseTo(9, 1);
    // Rank score is clamped to 10 — an outlier ROI cannot dominate ranking.
    expect(
      rankScoreOf(
        { value: 1000, status: 'VERIFIED', evidence: ['r'] },
        { value: 1, status: 'VERIFIED', evidence: ['c'] },
      ),
    ).toBe(10);
  });
});
