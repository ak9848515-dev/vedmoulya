import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createGovernedToolRegistry } from '../index.js';
import { WorkspaceRootBinding } from '../adapters/WorkspaceTools.js';

const NL = String.fromCharCode(10);
const CSV =
  'date,product,region,quantity,sales_amount' +
  NL +
  '2025-08-01,Chair,North,1,10' +
  NL +
  '2025-08-02,Desk,South,1,3000' +
  NL +
  '2025-08-03,Desk,East,1,2500' +
  NL;

describe('REVENUE-004A gated end-to-end', () => {
  it('rejects the contradictory East-vs-South report (fail-closed)', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'rev004a-'));
    try {
      mkdirSync(path.join(dir, 'input'), { recursive: true });
      mkdirSync(path.join(dir, 'output'), { recursive: true });
      writeFileSync(path.join(dir, 'input', 'sales.csv'), CSV, 'utf8');
      writeFileSync(
        path.join(dir, 'output', 'report.md'),
        '# Report' +
          NL +
          NL +
          'Total ,500. North had the highest sales, followed by South and East.' +
          NL,
        'utf8',
      );
      const binding = new WorkspaceRootBinding();
      binding.setRoot(dir);
      const registry = createGovernedToolRegistry({ workspace: { binding, toolOptions: {} } });
      const args = {
        sourceRelativePath: 'input/sales.csv',
        amountColumn: 'sales_amount',
        reportRelativePath: 'output/report.md',
        groupBy: ['product', 'region'],
        monthOf: 'date',
      };
      const r = await registry.execute({ toolName: 'data_narrative_check', arguments: args });
      expect(r.ok).toBe(false);
      expect(r.error).toContain('ranking-contradiction');
      expect(r.error).toContain('North');
      expect(r.error).toContain('South');
      expect(r.denied).toBe(false);
      // The handler THROWS on contradiction, so ToolRuntime reports a classified
      // failure (never 'success') with ok=false: fail-closed is exactly the
      // point of this check.
      expect(r.outcome).toBe('internal_error');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
