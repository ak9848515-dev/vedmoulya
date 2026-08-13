// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Data Accessor tests
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  asRecord,
  numOf,
  strOf,
  arrOf,
  objOf,
  totalsNum,
  countBy,
  byTypeNum,
  pipelineSummaryNum,
  firstNum,
  firstTotalsNum,
  arrLen,
  countOf,
} from '../os-data.js';

describe('os-data accessors', () => {
  it('asRecord accepts plain objects and rejects nulls/arrays/scalars', () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
    expect(asRecord(null)).toBeUndefined();
    expect(asRecord(undefined)).toBeUndefined();
    expect(asRecord([1, 2])).toBeUndefined();
    expect(asRecord('x')).toBeUndefined();
    expect(asRecord(42)).toBeUndefined();
  });

  it('numOf reads numbers only', () => {
    const data = { n: 3, s: '3', b: true };
    expect(numOf(data, 'n')).toBe(3);
    expect(numOf(data, 's')).toBeUndefined();
    expect(numOf(data, 'b')).toBeUndefined();
    expect(numOf(data, 'missing')).toBeUndefined();
    expect(numOf(null, 'n')).toBeUndefined();
  });

  it('strOf reads strings only', () => {
    expect(strOf({ s: 'x' }, 's')).toBe('x');
    expect(strOf({ s: 3 }, 's')).toBeUndefined();
    expect(strOf(null, 's')).toBeUndefined();
  });

  it('arrOf reads arrays only', () => {
    expect(arrOf({ a: [1] }, 'a')).toEqual([1]);
    expect(arrOf({ a: 'x' }, 'a')).toBeUndefined();
    expect(arrOf(null, 'a')).toBeUndefined();
  });

  it('objOf reads nested objects only', () => {
    expect(objOf({ o: { k: 1 } }, 'o')).toEqual({ k: 1 });
    expect(objOf({ o: [1] }, 'o')).toBeUndefined();
    expect(objOf(null, 'o')).toBeUndefined();
  });

  it('totalsNum reads data.totals[key]', () => {
    const data = { totals: { items: 7 } };
    expect(totalsNum(data, 'items')).toBe(7);
    expect(totalsNum(data, 'missing')).toBeUndefined();
    expect(totalsNum({ totals: 'x' }, 'items')).toBeUndefined();
    expect(totalsNum({}, 'items')).toBeUndefined();
  });

  it('countBy reads data.<bucket>[key]', () => {
    const data = { countBySource: { knowledge_base: 5 } };
    expect(countBy(data, 'countBySource', 'knowledge_base')).toBe(5);
    expect(countBy(data, 'countBySource', 'missing')).toBeUndefined();
    expect(countBy(data, 'countByCategory', 'x')).toBeUndefined();
  });

  it('byTypeNum reads data.byType[key]', () => {
    expect(byTypeNum({ byType: { learning: 2 } }, 'learning')).toBe(2);
    expect(byTypeNum({}, 'learning')).toBeUndefined();
  });

  it('pipelineSummaryNum reads data.pipelineSummary[key]', () => {
    expect(pipelineSummaryNum({ pipelineSummary: { ready: 3 } }, 'ready')).toBe(3);
    expect(pipelineSummaryNum({ pipelineSummary: 'x' }, 'ready')).toBeUndefined();
  });

  it('firstNum returns the first defined number across keys', () => {
    const data = { totalGoals: 5 };
    expect(firstNum(data, ['totalGoals'])).toBe(5);
    expect(firstNum({}, ['totalGoals', 'total'])).toBeUndefined();
  });

  it('firstTotalsNum returns the first defined totals number', () => {
    expect(firstTotalsNum({ totals: { consumers: 3 } }, ['consumers'])).toBe(3);
    expect(firstTotalsNum({ totals: {} }, ['consumers'])).toBeUndefined();
  });

  it('arrLen returns array lengths or undefined', () => {
    expect(arrLen({ a: [1, 2] }, 'a')).toBe(2);
    expect(arrLen({ a: 'x' }, 'a')).toBeUndefined();
    expect(arrLen({}, 'a')).toBeUndefined();
  });

  it('countOf tolerates top-level, totals and array shapes', () => {
    expect(countOf({ total: 4 }, 'total')).toBe(4);
    expect(countOf({ totals: { items: 4 } }, 'items')).toBe(4);
    expect(countOf({ items: [1, 2, 3] }, 'items')).toBe(3);
    expect(countOf({}, 'items')).toBeUndefined();
  });
});
