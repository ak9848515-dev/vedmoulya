// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Governed Data Aggregation Tool (REVENUE-002A)
//
// A bounded, DETERMINISTIC, read-only tool that computes the totals a
// data-analysis deliverable needs directly from a CSV file in the
// authorized workspace. It exists so the FIGURES in a deliverable never
// depend on a model's arithmetic: the model authors the narrative, while
// the numbers come from this governed computation and are reproduced
// verbatim in the artifact.
//
// Governance is the same as every other workspace tool: the path is
// resolved through the operator-held WorkspaceRootBinding (path jail,
// no absolute paths, no '..'), the call passes the full ToolRuntime
// chain (capability → schema validation → timeout → rate limit → audit),
// and the tool is read-only — it never writes and never executes
// anything. The column names and the file path are plan literals; the
// model never supplies them.
// ──────────────────────────────────────────────────────────────────

import * as fs from 'node:fs';
import type { ToolDefinition } from '@vedmoulya/services/ai/runtime/ToolRuntime';
import { WorkspaceRootBinding } from './WorkspaceTools.js';

export const DATA_AGGREGATE_TOOL = 'data_aggregate';

const MAX_FILE_BYTES = 256 * 1024;
const MAX_ROWS = 20_000;
const MAX_GROUPS = 200;

/**
 * Prototype-safe group key: CSV cell values are data-influenced strings and
 * must never become `__proto__`/`constructor`/`prototype` keys on a plain
 * object. Map lookups are safe already; this keeps the emitted JSON keys
 * honest too.
 */
function safeGroupKey(raw: string): string {
  const key = raw.trim() || '(blank)';
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') return `(unsafe:${key})`;
  return key;
}

/** Minimal RFC4180-ish CSV parse (quoted fields, CRLF) bounded by MAX_ROWS. */
export function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const records: string[][] = [];
  let field = '';
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] ?? '';
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((value) => value.length > 0)) records.push(row);
      row = [];
      if (records.length > MAX_ROWS + 1) break;
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((value) => value.length > 0)) records.push(row);
  const header = (records.shift() ?? []).map((name) => name.trim());
  return { header, rows: records };
}

export interface AggregateGroup {
  column: string;
  values: Array<{ key: string; total: number; quantity?: number }>;
}

export interface AggregateResult {
  relativePath: string;
  recordCount: number;
  amountColumn: string;
  total: number;
  groups: AggregateGroup[];
}

/** Derive a `YYYY-MM` month key from a date/datetime cell (best effort). */
function monthKey(value: string): string {
  const iso = /^(\d{4})-(\d{2})/.exec(value.trim());
  if (iso) return `${iso[1]}-${iso[2]}`;
  const parsed = new Date(value.trim());
  if (!Number.isNaN(parsed.getTime())) {
    return `${String(parsed.getUTCFullYear())}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  return value.trim();
}

export interface AggregateOptions {
  relativePath: string;
  amountColumn: string;
  groupBy?: string[];
  monthOf?: string;
  quantityColumn?: string;
}

/** Schema-validated input for the `data_aggregate` tool handler (fixed keys). */
interface DataAggregateToolInput {
  relativePath: unknown;
  amountColumn: unknown;
  groupBy?: unknown;
  monthOf?: unknown;
  quantityColumn?: unknown;
}

/**
 * Pure, deterministic aggregation over parsed CSV records. Throws a typed
 * error when a referenced column is absent or the amount column holds a
 * non-numeric value — a bad computation never returns a silent partial.
 */
export function computeAggregates(
  header: string[],
  rows: string[][],
  options: AggregateOptions,
): AggregateResult {
  const { relativePath, amountColumn } = options;
  const amountIndex = header.indexOf(amountColumn);
  if (amountIndex < 0) {
    throw new Error(`amount column "${amountColumn}" is not present in ${relativePath}`);
  }
  const quantityIndex =
    options.quantityColumn !== undefined ? header.indexOf(options.quantityColumn) : -1;

  const groupBy = (options.groupBy ?? []).filter((value) => value.length > 0);
  const groupIndexes = groupBy.map((column) => {
    const index = header.indexOf(column);
    if (index < 0) {
      throw new Error(`group column "${column}" is not present in ${relativePath}`);
    }
    return { column, index };
  });
  const monthIndex = options.monthOf !== undefined ? header.indexOf(options.monthOf) : -1;
  if (options.monthOf !== undefined && monthIndex < 0) {
    throw new Error(`month column "${options.monthOf}" is not present in ${relativePath}`);
  }

  const amountOf = (row: string[]): number | undefined => {
    const raw = row[amountIndex];
    if (raw === undefined || raw.trim() === '') return undefined;
    const amount = Number(raw.replace(/[,$\s]/g, ''));
    if (!Number.isFinite(amount)) {
      throw new Error(`non-numeric value in amount column "${amountColumn}": ${raw}`);
    }
    return amount;
  };

  let total = 0;
  const groups: AggregateGroup[] = groupIndexes.map((group) => ({
    column: group.column,
    values: [],
  }));
  if (monthIndex >= 0) groups.push({ column: 'month', values: [] });
  const maps = groups.map(() => new Map<string, { total: number; quantity: number }>());

  for (const row of rows) {
    const amount = amountOf(row);
    if (amount === undefined) continue;
    total += amount;
    const quantity =
      quantityIndex >= 0 ? Number((row[quantityIndex] ?? '0').replace(/[,$\s]/g, '')) || 0 : 0;
    groupIndexes.forEach((group, position) => {
      const key = safeGroupKey(row[group.index] ?? '');
      const entry = maps[position]?.get(key) ?? { total: 0, quantity: 0 };
      entry.total += amount;
      entry.quantity += quantity;
      maps[position]?.set(key, entry);
    });
    if (monthIndex >= 0) {
      const key = safeGroupKey(monthKey(row[monthIndex] ?? ''));
      const monthMap = maps[maps.length - 1];
      const entry = monthMap?.get(key) ?? { total: 0, quantity: 0 };
      entry.total += amount;
      monthMap?.set(key, entry);
    }
  }

  groups.forEach((group, position) => {
    const map = maps[position];
    if (!map) return;
    group.values = [...map.entries()]
      .map(([key, value]) => ({
        key,
        total: value.total,
        ...(quantityIndex >= 0 ? { quantity: value.quantity } : {}),
      }))
      .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key))
      .slice(0, MAX_GROUPS);
  });

  return { relativePath, recordCount: rows.length, amountColumn, total, groups };
}

export function createDataAggregateTool(
  binding: WorkspaceRootBinding,
): ToolDefinition<DataAggregateToolInput, AggregateResult> {
  return {
    name: DATA_AGGREGATE_TOOL,
    description:
      'Deterministically computes totals from a CSV file in the authorized workspace: ' +
      'the overall amount total plus, for each requested column, the amount total grouped ' +
      'by that column value (and optionally a derived month for a date column). Read-only.',
    capability: 'calculation',
    inputSchema: {
      type: 'object',
      properties: {
        relativePath: { type: 'string', required: true, minLength: 1, maxLength: 300 },
        amountColumn: { type: 'string', required: true, minLength: 1, maxLength: 120 },
        groupBy: { type: 'array', items: { type: 'string', maxLength: 120 } },
        monthOf: { type: 'string', maxLength: 120 },
        quantityColumn: { type: 'string', maxLength: 120 },
      },
      additionalProperties: false,
    },
    timeoutMs: 5_000,
    rateLimit: { max: 120, windowMs: 60_000 },
    handler: (args): AggregateResult => {
      // Fixed schema keys only — the ToolRuntime schema already rejects
      // additional properties, so never index by a caller-controlled string.
      const relativePath = String(args.relativePath);
      // Path is resolved through the operator-held WorkspaceRootBinding (path
      // jail: no absolute paths, no '..') — never a raw fs path from the caller.
      const resolved = binding.resolveInside(relativePath);
      if (fs.statSync(resolved).size > MAX_FILE_BYTES) {
        throw new Error(`file exceeds the bounded aggregation size: ${relativePath}`);
      }
      const { header, rows } = parseCsv(fs.readFileSync(resolved, 'utf8'));
      const groupByRaw = args.groupBy;
      const monthOf = args.monthOf;
      const quantityColumn = args.quantityColumn;
      return computeAggregates(header, rows, {
        relativePath,
        amountColumn: String(args.amountColumn),
        ...(Array.isArray(groupByRaw) ? { groupBy: groupByRaw.map((value) => String(value)) } : {}),
        ...(typeof monthOf === 'string' ? { monthOf } : {}),
        ...(typeof quantityColumn === 'string' ? { quantityColumn } : {}),
      });
    },
  };
}
