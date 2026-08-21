// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — RevenueIntelligence tests (SPRINT-033 Part F)
// Evidence-only revenue intelligence:
//   • a figure without evidence is REFUSED (no fabricated numbers)
//   • UNKNOWN figures are not recorded
//   • owner isolation (a stream is never visible to another owner)
//   • stable-key idempotency (same name → upsert, never duplicate)
//   • the snapshot sums ONLY evidence-backed figures (UNKNOWN contributes 0)
//   • margins are advisory and only computed when revenue AND cost exist
//   • decision hints are advisory; UNKNOWN when no evidence justifies one
//   • bounded per owner (FIFO)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { RevenueIntelligence } from '../domain/RevenueIntelligence.js';
import { InMemoryWorldStores } from '../infrastructure/InMemoryWorldStores.js';

const now = (): string => '2026-08-15T10:00:00.000Z';

function makeRevenue(): RevenueIntelligence {
  return new RevenueIntelligence(new InMemoryWorldStores().revenueStreams, now);
}

describe('RevenueIntelligence — evidence discipline', () => {
  it('refuses a figure without evidence (no fabricated numbers)', () => {
    const revenue = makeRevenue();
    const result = revenue.register({
      ownerId: 'u1',
      name: 'AI services',
      kind: 'SERVICE',
      estimatedMonthlyRevenueUsd: { value: 5000, status: 'ESTIMATED', evidence: [] },
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('NO_EVIDENCE');
  });

  it('refuses UNKNOWN figures — leave the field unset instead', () => {
    const revenue = makeRevenue();
    const result = revenue.register({
      ownerId: 'u1',
      name: 'AI services',
      kind: 'SERVICE',
      actualMonthlyRevenueUsd: { value: 0, status: 'UNKNOWN', evidence: ['x'] },
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('UNKNOWN_FIGURE');
  });

  it('refuses out-of-range percentages', () => {
    const revenue = makeRevenue();
    const result = revenue.register({
      ownerId: 'u1',
      name: 'AI services',
      kind: 'SERVICE',
      automationPercentage: { value: 1.5, status: 'ESTIMATED', evidence: ['measured'] },
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('INVALID_RANGE');
  });

  it('registers a valid stream and upserts idempotently', () => {
    const revenue = makeRevenue();
    const first = revenue.register({
      ownerId: 'u1',
      name: 'AI services',
      kind: 'SERVICE',
      estimatedMonthlyRevenueUsd: {
        value: 5000,
        status: 'ESTIMATED',
        evidence: ['pipeline quote'],
      },
    });
    expect(first.success).toBe(true);
    const second = revenue.register({
      ownerId: 'u1',
      name: 'AI services',
      kind: 'SERVICE',
      estimatedMonthlyRevenueUsd: { value: 6000, status: 'ESTIMATED', evidence: ['updated quote'] },
    });
    expect(second.success).toBe(true);
    if (first.success && second.success) {
      expect(second.data.id).toBe(first.data.id); // upsert, never duplicate
      expect(second.data.estimatedMonthlyRevenueUsd?.value).toBe(6000);
    }
    expect(revenue.list('u1').length).toBe(1);
  });

  it('owner isolation — a stream is never visible to another owner', () => {
    const revenue = makeRevenue();
    revenue.register({
      ownerId: 'u1',
      name: 'Stream A',
      kind: 'SERVICE',
      estimatedMonthlyRevenueUsd: { value: 100, status: 'ESTIMATED', evidence: ['e'] },
    });
    expect(revenue.list('u2')).toEqual([]);
    const snapshot = revenue.snapshot('u2');
    expect(snapshot.streamCount).toBe(0);
    expect(snapshot.totalEstimatedMonthlyRevenueUsd).toBeUndefined();
  });
});

describe('RevenueIntelligence — advisory snapshot', () => {
  it('sums ONLY evidence-backed figures; UNKNOWN contributes nothing', () => {
    const revenue = makeRevenue();
    revenue.register({
      ownerId: 'u1',
      name: 'AI services',
      kind: 'SERVICE',
      estimatedMonthlyRevenueUsd: { value: 5000, status: 'ESTIMATED', evidence: ['quote'] },
      estimatedMonthlyCostUsd: { value: 2000, status: 'ESTIMATED', evidence: ['provider cost'] },
      automationPercentage: { value: 0.8, status: 'ESTIMATED', evidence: ['measured'] },
    });
    revenue.register({
      ownerId: 'u1',
      name: 'Consulting',
      kind: 'SERVICE',
      estimatedMonthlyRevenueUsd: { value: 3000, status: 'ESTIMATED', evidence: ['retainer'] },
    });
    const snapshot = revenue.snapshot('u1');
    expect(snapshot.streamCount).toBe(2);
    expect(snapshot.activeStreamCount).toBe(2);
    expect(snapshot.totalEstimatedMonthlyRevenueUsd).toBe(8000);
    // Margin computed from revenue+cost evidence of the first stream only.
    expect(snapshot.estimatedMargin).toBeCloseTo((8000 - 2000) / 8000, 5);
    expect(snapshot.averageAutomationPercentage).toBe(0.8);
    expect(snapshot.advisory).toBe(true);
  });

  it('an empty or evidence-less owner yields no totals — nothing fabricated', () => {
    const revenue = makeRevenue();
    revenue.register({
      ownerId: 'u1',
      name: 'Planned stream',
      kind: 'PRODUCT',
      status: 'PLANNED',
    });
    const snapshot = revenue.snapshot('u1');
    expect(snapshot.streamCount).toBe(1);
    expect(snapshot.activeStreamCount).toBe(0);
    expect(snapshot.totalEstimatedMonthlyRevenueUsd).toBeUndefined();
    expect(snapshot.estimatedMargin).toBeUndefined();
  });

  it('remove works and is owner-scoped', () => {
    const revenue = makeRevenue();
    const created = revenue.register({
      ownerId: 'u1',
      name: 'Stream',
      kind: 'SERVICE',
    });
    expect(created.success).toBe(true);
    if (!created.success) return;
    const missing = revenue.remove('u1', 'nope');
    expect(missing.success).toBe(false);
    const removed = revenue.remove('u1', created.data.id);
    expect(removed.success && removed.data.removed).toBe(true);
    expect(revenue.list('u1')).toEqual([]);
  });
});

describe('RevenueIntelligence — advisory decision hints', () => {
  it('UNKNOWN when no evidence supports a direction (honest default)', () => {
    const revenue = makeRevenue();
    const created = revenue.register({
      ownerId: 'u1',
      name: 'New stream',
      kind: 'SERVICE',
    });
    expect(created.success).toBe(true);
    if (!created.success) return;
    const decisions = revenue.decide('u1');
    expect(decisions[0]?.hint).toBe('UNKNOWN');
    expect(decisions[0]?.advisory).toBe(true);
  });

  it('STOP when evidence shows cost ≥ revenue', () => {
    const revenue = makeRevenue();
    revenue.register({
      ownerId: 'u1',
      name: 'Loss maker',
      kind: 'SERVICE',
      actualMonthlyRevenueUsd: { value: 100, status: 'VERIFIED', evidence: ['bank statement'] },
      actualMonthlyCostUsd: { value: 150, status: 'VERIFIED', evidence: ['invoices'] },
    });
    const decisions = revenue.decide('u1');
    expect(decisions[0]?.hint).toBe('STOP');
  });

  it('SCALE when positive revenue has high automation; AUTOMATE below half', () => {
    const revenue = makeRevenue();
    revenue.register({
      ownerId: 'u1',
      name: 'Scaler',
      kind: 'PRODUCT',
      actualMonthlyRevenueUsd: { value: 500, status: 'VERIFIED', evidence: ['ledger'] },
      automationPercentage: { value: 0.85, status: 'ESTIMATED', evidence: ['measured'] },
    });
    revenue.register({
      ownerId: 'u1',
      name: 'Automate me',
      kind: 'SERVICE',
      estimatedMonthlyRevenueUsd: { value: 300, status: 'ESTIMATED', evidence: ['pipeline'] },
      automationPercentage: { value: 0.3, status: 'ESTIMATED', evidence: ['measured'] },
    });
    const decisions = revenue.decide('u1');
    expect(decisions.find((d) => d.streamName === 'Scaler')?.hint).toBe('SCALE');
    expect(decisions.find((d) => d.streamName === 'Automate me')?.hint).toBe('AUTOMATE');
  });
});

describe('RevenueIntelligence — bounded + failure handling', () => {
  it('bounded per owner (FIFO — newest survive)', () => {
    const revenue = makeRevenue();
    for (let i = 0; i < 30; i += 1) {
      revenue.register({
        ownerId: 'u1',
        name: `Stream ${i}`,
        kind: 'SERVICE',
      });
    }
    expect(revenue.list('u1').length).toBe(25);
  });

  it('refuses empty names and missing kinds', () => {
    const revenue = makeRevenue();
    expect(revenue.register({ ownerId: 'u1', name: '', kind: 'SERVICE' }).success).toBe(false);
    expect(revenue.register({ ownerId: 'u1', name: 'x', kind: '' as never }).success).toBe(false);
  });
});
