// ──────────────────────────────────────────────────────────────────
// REVENUE-004A — narrative consistency regression tests
//
// The failure this file pins: numerical verification PASSED while the
// report claimed "the East region had the highest sales" although the
// verified aggregate data put South ($7,636) above East ($4,809).
//
// These tests assert the deterministic claim checker:
//   - flags the East-versus-South contradiction (the original bug);
//   - accepts a ranking claim that matches the verified order;
//   - flags numeric totals that disagree with the aggregates;
//   - flags unsupported claims for human review rather than blessing them.
//
// They deliberately do NOT duplicate data-report-template.test.ts (plan
// shape) or the governed aggregation tests (the arithmetic itself).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { verifyReportNarrative } from '../adapters/DataNarrativeCheck.js';
import type { AggregateResult } from '../adapters/DataAggregateTool.js';

/** The verified aggregates for the Sunrise Traders shape (South > East). */
function sunriseAggregate(): AggregateResult {
  return {
    relativePath: 'input/sales.csv',
    recordCount: 40,
    amountColumn: 'sales_amount',
    total: 17855,
    groups: [
      {
        column: 'region',
        values: [
          { key: 'South', total: 7636 },
          { key: 'East', total: 4809 },
          { key: 'Central', total: 2292 },
          { key: 'North', total: 2124 },
          { key: 'West', total: 994 },
        ],
      },
      {
        column: 'product',
        values: [
          { key: 'Ergonomic Office Chair', total: 8688 },
          { key: 'Standing Desk Frame', total: 3320 },
          { key: 'LED Desk Lamp', total: 1421 },
        ],
      },
    ],
  };
}

/** A report body whose claims are all consistent with the aggregate. */
function consistentReport(): string {
  return [
    '# Sunrise Traders Sales Report',
    '',
    '## Executive Summary',
    'Total sales were $17,855. The South region had the highest sales,',
    'followed by the East and Central regions. The Ergonomic Office Chair',
    'was the top-selling product.',
    '',
    '## Top-Performing Regions',
    '- South: $7,636',
    '- East: $4,809',
    '- Central: $2,292',
    '- North: $2,124',
    '- West: $994',
    '',
    '## Top-Performing Products',
    '- Ergonomic Office Chair: $8,688',
    '- Standing Desk Frame: $3,320',
    '- LED Desk Lamp: $1,421',
    '',
  ].join('\n');
}

describe('REVENUE-004A narrative consistency', () => {
  const aggregate = sunriseAggregate();

  it('flags the East-versus-South ranking contradiction that passed numeric verification', () => {
    // The exact defect: all figures correct, but the summary inverts the order.
    const report =
      consistentReport() +
      '\nThe East region had the highest sales, followed by the South and Central regions.\n';
    const result = verifyReportNarrative(report, aggregate);
    expect(result.ok).toBe(false);
    const contradiction = result.contradictions.find((c) => c.check === 'ranking-contradiction');
    expect(contradiction, JSON.stringify(result.contradictions)).toBeDefined();
    expect(contradiction?.claim).toContain('East');
    expect(contradiction?.reason).toContain('South');
    expect(contradiction?.reason).toContain('7636');
  });

  it('accepts ranking claims that match the verified aggregate order', () => {
    const result = verifyReportNarrative(consistentReport(), aggregate);
    expect(result.contradictions, JSON.stringify(result.contradictions)).toEqual([]);
    expect(result.ok).toBe(true);
    const ranking = result.findings.filter((f) => f.name === 'ranking-claim');
    expect(ranking.length).toBeGreaterThan(0);
    expect(ranking.every((f) => f.status === 'pass')).toBe(true);
  });

  it('flags a named comparison whose stated order is inverted', () => {
    const report = consistentReport().replace(
      'followed by the East and Central regions',
      'ahead of the East and Central regions',
    );
    // South ($7,636) IS ahead of East ($4,809) — this one must PASS.
    const good = verifyReportNarrative(report, aggregate);
    expect(good.contradictions.filter((c) => c.check === 'comparison-contradiction')).toEqual([]);

    // Inverted: East claimed ahead of South must FAIL.
    const badReport = report.replace('the East and Central', 'East ahead of South');
    const bad = verifyReportNarrative(badReport, aggregate);
    const inverted = bad.contradictions.find((c) => c.check === 'comparison-contradiction');
    expect(inverted, JSON.stringify(bad.contradictions)).toBeDefined();
    expect(inverted?.claim).toContain('East');
    expect(inverted?.claim).toContain('South');
  });

  it('flags a numeric total that disagrees with the verified aggregate', () => {
    const report = consistentReport().replace('- South: $7,636', '- South: $8,636');
    const result = verifyReportNarrative(report, aggregate);
    const mismatch = result.contradictions.find((c) => c.check === 'region-total-mismatch');
    expect(mismatch, JSON.stringify(result.contradictions)).toBeDefined();
    expect(mismatch?.reason).toContain('7636');
    expect(result.ok).toBe(false);
  });

  it('flags an unsupported ranking claim for human review (not a contradiction)', () => {
    // A claim about a group that is not in the verified data cannot be
    // deterministically resolved: it is REPORTED for human review, never
    // blessed as verified — but it is not a contradiction, so it does not by
    // itself block the deliverable.
    const report = consistentReport() + '\nThe Acme region had the highest sales.\n';
    const result = verifyReportNarrative(report, aggregate);
    const unsupported = result.needsReview.find((r) => r.includes('ranking-unsupported'));
    expect(unsupported, JSON.stringify(result.needsReview)).toBeDefined();
    expect(unsupported).toContain('Acme');
    expect(
      result.findings.some((f) => f.name === 'ranking-unsupported' && f.status === 'review'),
    ).toBe(true);
    expect(result.contradictions).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('flags an absent group entry rather than letting it slide silently', () => {
    const report = consistentReport().replace('- West: $994\n', '');
    const result = verifyReportNarrative(report, aggregate);
    expect(result.contradictions.some((c) => c.check === 'region-entry-missing')).toBe(true);
    expect(result.ok).toBe(false);
  });

  it('flags the real-artifact claim whose subject follows a money figure', () => {
    // The published delivery contained "...a total sales amount of $17,855 in
    // November 2025. The East region had the highest sales...". A subject scan
    // that crossed the sentence boundary absorbed the month and resolved the
    // claim to the peak MONTH, silently passing. It must resolve to the REGION
    // and contradict the verified order.
    const report = consistentReport()
      .replace(
        'Total sales were $17,855.',
        'Sunrise Traders had a total sales amount of $17,855 in 2025.',
      )
      .replace('The South region had the highest sales,', 'The East region had the highest sales,');
    const result = verifyReportNarrative(report, aggregate);
    const contradiction = result.contradictions.find((c) => c.check === 'ranking-contradiction');
    expect(contradiction, JSON.stringify(result.contradictions)).toBeDefined();
    expect(contradiction?.claim).toContain('East');
    expect(contradiction?.reason).toContain('South');
    expect(contradiction?.reason).toContain('7636');
  });

  it('never silently resolves an ambiguous subject to one verified entry', () => {
    // A subject naming several verified entries (here a month AND a region) is
    // ambiguous: it must be flagged for human review, never resolved to
    // whichever entry happens to rank first.
    const withMonths: AggregateResult = {
      ...aggregate,
      groups: [
        ...aggregate.groups,
        {
          column: 'month',
          values: [
            { key: '2025-11', total: 6053 },
            { key: '2025-10', total: 200 },
          ],
        },
      ],
    };
    const report =
      consistentReport() +
      '\n## Monthly Sales Trend\n- 2025-11: $6,053\n- 2025-10: $200\n' +
      '\nNovember 2025 and the East region had the highest sales.\n';
    const result = verifyReportNarrative(report, withMonths);
    expect(result.contradictions.some((c) => c.check === 'ranking-contradiction')).toBe(false);
    expect(
      result.findings.some((f) => f.name === 'ranking-unsupported' && f.status === 'review'),
    ).toBe(true);
    expect(result.needsReview.length).toBeGreaterThan(0);
  });
});
