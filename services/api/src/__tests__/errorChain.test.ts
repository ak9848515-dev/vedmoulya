// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — describeErrorChain tests (QUALITY-SPRINT-005, D-08b)
//
// Regression guard: the DDL-bootstrap failure logging MUST surface the real
// driver cause (e.g. ECONNREFUSED) hidden behind drizzle's generic
// "Failed query" wrapper. These are pure, hermetic assertions.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { describeErrorChain } from '../infrastructure/errorChain.js';

describe('describeErrorChain', () => {
  it('renders a plain error as Name: message', () => {
    expect(describeErrorChain(new Error('boom'))).toBe('Error: boom');
  });

  it('walks the cause chain and surfaces the driver code/severity', () => {
    const inner = Object.assign(new Error(''), { code: 'ECONNREFUSED', name: 'AggregateError' });
    const outer = new Error('Failed query: CREATE TABLE knowledge_nodes', { cause: inner });

    const described = describeErrorChain(outer);

    // Both the wrapper and the real root cause must be present.
    expect(described).toContain('Failed query: CREATE TABLE knowledge_nodes');
    expect(described).toContain('code=ECONNREFUSED');
  });

  it('includes a database severity when present', () => {
    const inner = Object.assign(new Error('permission denied for table knowledge_nodes'), {
      code: '42501',
      severity: 'ERROR',
    });
    const outer = new Error('Failed query: CREATE TABLE', { cause: inner });

    expect(describeErrorChain(outer)).toContain('code=42501 severity=ERROR');
  });

  it('keeps only the first non-empty line of a multi-line message', () => {
    const inner = new Error('\n  relation "knowledge_nodes" does not exist\n  second line');
    expect(describeErrorChain(inner)).toBe('Error: relation "knowledge_nodes" does not exist');
  });

  it('handles a non-Error cause', () => {
    const outer = new Error('wrapped', { cause: 'string-cause' });
    expect(describeErrorChain(outer)).toBe('Error: wrapped <- string-cause');
  });

  it('stops on a circular cause chain', () => {
    const a = new Error('a');
    const b = new Error('b', { cause: a });
    (a as { cause?: unknown }).cause = b;

    const described = describeErrorChain(a);
    expect(described).toContain('circular cause');
  });

  it('stringifies non-error inputs', () => {
    expect(describeErrorChain('plain')).toBe('plain');
    expect(describeErrorChain(undefined)).toBe('undefined');
  });

  it('renders numeric, boolean and bigint driver codes without truncation', () => {
    const numeric = Object.assign(new Error('numeric code'), { code: 42501 });
    expect(describeErrorChain(numeric)).toBe('Error(code=42501): numeric code');

    const booleanSeverity = Object.assign(new Error('boolean severity'), { severity: false });
    expect(describeErrorChain(booleanSeverity)).toBe('Error(severity=false): boolean severity');

    const bigintCode = Object.assign(new Error('bigint code'), { code: 4294967296n });
    expect(describeErrorChain(bigintCode)).toBe('Error(code=4294967296): bigint code');
  });

  it('renders symbol codes via their description', () => {
    const symbolCode = Object.assign(new Error('symbol code'), { code: Symbol('E_CONN') });
    expect(describeErrorChain(symbolCode)).toBe('Error(code=Symbol(E_CONN)): symbol code');
  });

  it('tags a non-scalar code by type instead of printing [object Object]', () => {
    // A driver that sets `code` to a nested object must not leak an unclear
    // `[object Object]` into operator logs.
    const objectCode = Object.assign(new Error('object code'), { code: { sqlState: '42601' } });
    const described = describeErrorChain(objectCode);
    expect(described).toBe('Error(code=[object Object]): object code');
    expect(described).not.toContain('42601');
  });
});
