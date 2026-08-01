// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Decision Utils unit tests
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  generateDecisionId,
  generateOptionId,
  generateEvidenceId,
  clamp,
  calculateOffset,
  calculateTotalPages,
  safeDateToString,
  parseDate,
  sleep,
  withRetry,
  truncate,
  isBlank,
  deepMerge,
} from '../DecisionUtils.js';

describe('DecisionUtils id generators', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generateDecisionId delegates to the domain generator', () => {
    const id = generateDecisionId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('generateOptionId prefixes with opt_', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    // replace(/-/g, '') => 'aaaaaaaabbbbccccddddeeeeeeeeeeee', slice(0, 8) => 'aaaaaaaa'
    expect(generateOptionId()).toBe('opt_aaaaaaaa');
  });

  it('generateEvidenceId prefixes with ev_', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(generateEvidenceId()).toBe('ev_aaaaaaaa');
  });
});

describe('DecisionUtils numeric helpers', () => {
  it('clamp bounds values within min/max', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('calculateOffset computes pagination offsets', () => {
    expect(calculateOffset(1, 20)).toBe(0);
    expect(calculateOffset(3, 20)).toBe(40);
  });

  it('calculateTotalPages computes page counts', () => {
    expect(calculateTotalPages(0, 20)).toBe(0);
    expect(calculateTotalPages(20, 20)).toBe(1);
    expect(calculateTotalPages(21, 20)).toBe(2);
  });
});

describe('DecisionUtils date helpers', () => {
  it('safeDateToString formats dates safely', () => {
    expect(safeDateToString(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01T00:00:00.000Z');
    expect(safeDateToString(undefined)).toBeUndefined();
    expect(safeDateToString(null)).toBeUndefined();
  });

  it('parseDate handles strings, Dates, and invalid input', () => {
    expect(parseDate('2026-01-01T00:00:00Z')?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    const d = new Date('2026-01-02T00:00:00Z');
    expect(parseDate(d)).toBe(d);
    expect(parseDate('not-a-date')).toBeUndefined();
    expect(parseDate(undefined)).toBeUndefined();
    expect(parseDate(null)).toBeUndefined();
  });
});

describe('DecisionUtils async helpers', () => {
  it('sleep resolves after the given ms', async () => {
    const start = Date.now();
    await sleep(5);
    expect(Date.now() - start).toBeGreaterThanOrEqual(4);
  });

  it('withRetry returns the resolved value on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 1 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('withRetry rethrows after exhausting retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(withRetry(fn, { maxRetries: 1, baseDelayMs: 1 })).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('withRetry succeeds on a later attempt', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('first')).mockResolvedValueOnce('recovered');
    await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 1 })).resolves.toBe('recovered');
  });

  it('withRetry wraps non-Error rejections', async () => {
    const fn = vi.fn().mockRejectedValue('string error');
    await expect(withRetry(fn, { maxRetries: 0, baseDelayMs: 1 })).rejects.toThrow('string error');
  });
});

describe('DecisionUtils string helpers', () => {
  it('truncate shortens long strings with an ellipsis', () => {
    expect(truncate('short')).toBe('short');
    expect(truncate('a'.repeat(50), 10)).toBe('aaaaaaa...');
  });

  it('isBlank detects empty/whitespace strings', () => {
    expect(isBlank('')).toBe(true);
    expect(isBlank('   ')).toBe(true);
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank(null)).toBe(true);
    expect(isBlank('x')).toBe(false);
  });
});

describe('DecisionUtils.deepMerge', () => {
  it('merges scalar values', () => {
    expect(deepMerge({ a: 1, b: 2 }, { b: 3 })).toEqual({ a: 1, b: 3 });
  });

  it('recursively merges nested objects', () => {
    const merged = deepMerge({ a: { x: 1, y: 2 }, b: 1 }, { a: { y: 3, z: 4 } });
    expect(merged).toEqual({ a: { x: 1, y: 3, z: 4 }, b: 1 });
  });

  it('replaces arrays and keeps undefined values untouched', () => {
    expect(deepMerge({ a: [1, 2] }, { a: [3] })).toEqual({ a: [3] });
    expect(deepMerge({ a: 1 }, { a: undefined })).toEqual({ a: 1 });
  });
});
