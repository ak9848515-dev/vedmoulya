// ──────────────────────────────────────────────────────────────────
// REVENUE-002A — data → report template + governed aggregation tool
//
// The template must match a data-analysis goal that names BOTH a source
// data file and an output deliverable, build a structurally valid
// aggregate→author→write plan, take the source/output paths and the
// aggregation columns as literals, and reference the model-authored
// content (never copy a literal) so the write and the deterministic
// read-back use the same real value. The aggregation tool must compute
// the figures deterministically and never depend on a model.
// ──────────────────────────────────────────────────────────────────

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { validatePlanStructure } from '@vedmoulya/agent-execution';
import { GoalUnderstandingService } from '@vedmoulya/planning';
import {
  createDataReportTemplate,
  extractDataReportTarget,
} from '../adapters/DataReportTemplate.js';
import { parseCsv, computeAggregates } from '../adapters/DataAggregateTool.js';

const understandingService = new GoalUnderstandingService();

const SOURCE = 'input/sales.csv';
const OUTPUT = 'output/sunrise-traders-sales-report.md';
const BRIEF =
  `Analyze the Sunrise Traders monthly sales data in ${SOURCE} ` +
  '(40 rows; columns date, product, region, quantity, unit_price, sales_amount). ' +
  `The client needs the monthly sales analysis as a Markdown report at ${OUTPUT}: ` +
  'total sales, the top-performing products and their totals, the top-performing regions ' +
  `and their totals, the monthly sales trend, and three actionable business recommendations. ` +
  `Every figure must come from ${SOURCE}.`;

describe('data-report target extraction', () => {
  it('extracts the source, output and aggregation columns from a natural brief', () => {
    expect(extractDataReportTarget(BRIEF)).toMatchObject({
      sourcePath: SOURCE,
      outputPath: OUTPUT,
      amountColumn: 'sales_amount',
      groupBy: ['product', 'region'],
      monthOf: 'date',
      quantityColumn: 'quantity',
    });
  });

  it('refuses goals that do not name both a source and an output', () => {
    expect(
      extractDataReportTarget('Analyze the overall market trends for the board'),
    ).toBeUndefined();
  });

  it('refuses paths that are not bounded, jail-safe relative paths', () => {
    expect(
      extractDataReportTarget(
        `Analyze the data in data/../secrets.csv (columns a, amount) and write a report at out.md`,
      ),
    ).toBeUndefined();
  });
});

describe('data-report template', () => {
  const template = createDataReportTemplate();
  const understanding = understandingService.derive({ goal: BRIEF });

  it('matches a data-analysis goal and builds a structurally valid 4-step plan', () => {
    expect(template.matches(understanding)).toBe(true);
    const plan = template.build(understanding, 'plan-data-report');
    expect(plan.steps.map((s) => s.stepId)).toEqual(['step-1', 'step-2', 'step-3', 'step-4']);
    expect(plan.steps[0]?.actions[0]).toMatchObject({
      kind: 'tool',
      toolName: 'data_aggregate',
      arguments: {
        relativePath: SOURCE,
        amountColumn: 'sales_amount',
        groupBy: ['product', 'region'],
        monthOf: 'date',
      },
    });
    expect(plan.steps[1]?.actions[0]).toMatchObject({ kind: 'ai' });
    expect(plan.steps[2]?.actions[0]).toMatchObject({
      kind: 'tool',
      toolName: 'workspace_write',
      arguments: { relativePath: OUTPUT, content: '{outputOf:step-2}' },
    });
    // REVENUE-004A — the narrative check must run against the REAL source
    // and output paths through a command verification (fail-closed).
    expect(plan.steps[3]?.actions[0]).toMatchObject({
      kind: 'tool',
      toolName: 'data_narrative_check',
      arguments: {
        sourceRelativePath: SOURCE,
        reportRelativePath: OUTPUT,
        amountColumn: 'sales_amount',
        groupBy: ['product', 'region'],
        monthOf: 'date',
      },
    });
    // EXACT arguments: the narrative-check schema is `additionalProperties:
    // false`, so an extra key (e.g. the aggregate tool's `relativePath`) is
    // rejected by schema validation — surfaced by the security chain as a
    // denial that blocks the run instead of checking the narrative.
    expect((plan.steps[3]?.actions[0] as { arguments: Record<string, unknown> }).arguments).toEqual(
      {
        sourceRelativePath: SOURCE,
        reportRelativePath: OUTPUT,
        amountColumn: 'sales_amount',
        groupBy: ['product', 'region'],
        monthOf: 'date',
        quantityColumn: 'quantity',
      },
    );
    expect(plan.steps[3]?.verificationPolicy).toMatchObject({
      kind: 'command',
      command: {
        toolName: 'data_narrative_check',
        expect: 'ok',
        arguments: { sourceRelativePath: SOURCE, reportRelativePath: OUTPUT },
      },
    });
    const issues = validatePlanStructure(plan).filter((issue) => issue.severity === 'error');
    expect(issues, `structural issues: ${JSON.stringify(issues)}`).toEqual([]);
  });

  it('does not match a goal with no source/output artifact', () => {
    const other = understandingService.derive({ goal: 'Analyze the overall market trends' });
    expect(template.matches(other)).toBe(false);
  });

  it('verifies the write by reading back the exact authored content (never a literal)', () => {
    const plan = template.build(understanding, 'plan-data-report');
    expect(plan.steps[2]?.verificationPolicy).toMatchObject({
      kind: 'command',
      command: {
        toolName: 'workspace_read',
        arguments: { relativePath: OUTPUT, expectedContent: '{outputOf:step-2}' },
        expect: 'ok',
      },
    });
    expect(plan.finalVerification).toMatchObject({
      kind: 'command',
      command: {
        toolName: 'workspace_read',
        arguments: { relativePath: OUTPUT, expectedContent: '{outputOf:step-2}' },
        expect: 'ok',
      },
    });
  });
});

describe('governed deterministic aggregation', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'rev002a-agg-'));
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('computes totals, groups and derived months deterministically', () => {
    const csv =
      'date,product,region,quantity,sales_amount\n' +
      '2025-08-01,Chair,North,1,10\n' +
      '2025-08-02,Desk,North,2,20\n' +
      '2025-09-01,Chair,South,1,5\n';
    writeFileSync(path.join(dir, 'data.csv'), csv, 'utf8');
    const { header, rows } = parseCsv(csv);
    const result = computeAggregates(header, rows, {
      relativePath: 'data.csv',
      amountColumn: 'sales_amount',
      groupBy: ['product', 'region'],
      monthOf: 'date',
      quantityColumn: 'quantity',
    });
    expect(result.total).toBe(35);
    expect(result.recordCount).toBe(3);
    const product = result.groups.find((group) => group.column === 'product');
    expect(product?.values.map((value) => [value.key, value.total])).toEqual([
      ['Desk', 20],
      ['Chair', 15],
    ]);
    const month = result.groups.find((group) => group.column === 'month');
    expect(month?.values.map((value) => [value.key, value.total])).toEqual([
      ['2025-08', 30],
      ['2025-09', 5],
    ]);
  });

  it('refuses a non-numeric amount instead of returning a silent partial', () => {
    const { header, rows } = parseCsv('date,sales_amount\n2025-08-01,oops\n');
    expect(() =>
      computeAggregates(header, rows, { relativePath: 'x.csv', amountColumn: 'sales_amount' }),
    ).toThrow(/non-numeric/);
  });
});
