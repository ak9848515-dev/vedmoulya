// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Execution Utils unit tests
// BLD-009 — Execution Intelligence Engine
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi } from 'vitest';
import {
  generatePlanId,
  generateMissionId,
  generateTaskId,
  generateStepId,
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
} from '../ExecutionUtils.js';

describe('ExecutionUtils', () => {
  describe('ID generation', () => {
    it('generates prefixed plan IDs', () => {
      expect(generatePlanId()).toMatch(/^plan_[0-9a-f]{24}$/);
    });

    it('generates prefixed mission IDs', () => {
      expect(generateMissionId()).toMatch(/^mis_[0-9a-f]{12}$/);
    });

    it('generates prefixed task IDs', () => {
      expect(generateTaskId()).toMatch(/^task_[0-9a-f]{12}$/);
    });

    it('generates prefixed step IDs', () => {
      expect(generateStepId()).toMatch(/^step_[0-9a-f]{8}$/);
    });
  });

  describe('clamp', () => {
    it('clamps below min', () => expect(clamp(-5, 0, 10)).toBe(0));
    it('clamps above max', () => expect(clamp(15, 0, 10)).toBe(10));
    it('keeps in-range values', () => expect(clamp(5, 0, 10)).toBe(5));
  });

  describe('pagination', () => {
    it('calculates offsets', () => {
      expect(calculateOffset(1, 20)).toBe(0);
      expect(calculateOffset(2, 20)).toBe(20);
    });

    it('calculates total pages', () => {
      expect(calculateTotalPages(0, 20)).toBe(0);
      expect(calculateTotalPages(20, 20)).toBe(1);
      expect(calculateTotalPages(21, 20)).toBe(2);
    });
  });

  describe('date helpers', () => {
    it('safeDateToString converts dates', () => {
      const d = new Date('2026-01-01T00:00:00Z');
      expect(safeDateToString(d)).toBe('2026-01-01T00:00:00.000Z');
      expect(safeDateToString(undefined)).toBeUndefined();
      expect(safeDateToString(null)).toBeUndefined();
    });

    it('parseDate handles strings, dates, and nulls', () => {
      const d = new Date('2026-01-01T00:00:00Z');
      expect(parseDate('2026-01-01T00:00:00Z')?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(parseDate(d)).toBe(d);
      expect(parseDate(undefined)).toBeUndefined();
      expect(parseDate(null)).toBeUndefined();
      expect(parseDate('not-a-date')).toBeUndefined();
    });
  });

  describe('sleep', () => {
    it('resolves after the delay', async () => {
      vi.useFakeTimers();
      const promise = sleep(100);
      await vi.advanceTimersByTimeAsync(100);
      await expect(promise).resolves.toBeUndefined();
      vi.useRealTimers();
    });
  });

  describe('withRetry', () => {
    it('returns the result on the first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      await expect(withRetry(fn)).resolves.toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries and eventually succeeds', async () => {
      vi.useFakeTimers();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('nope'))
        .mockRejectedValueOnce(new Error('nope'))
        .mockResolvedValue('ok');
      const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
      await vi.advanceTimersByTimeAsync(1000);
      await expect(promise).resolves.toBe('ok');
      expect(fn).toHaveBeenCalledTimes(3);
      vi.useRealTimers();
    });

    it('throws the last error after exhausting retries', async () => {
      vi.useFakeTimers();
      const fn = vi.fn().mockRejectedValue(new Error('boom'));
      const promise = withRetry(fn, { maxRetries: 2, baseDelayMs: 5 });
      const rejection = expect(promise).rejects.toThrow('boom');
      await vi.advanceTimersByTimeAsync(1000);
      await rejection;
      expect(fn).toHaveBeenCalledTimes(3);
      vi.useRealTimers();
    });

    it('wraps non-Error rejections', async () => {
      vi.useFakeTimers();
      const fn = vi.fn().mockRejectedValue('string error');
      const promise = withRetry(fn, { maxRetries: 1, baseDelayMs: 5 });
      const rejection = expect(promise).rejects.toThrow('string error');
      await vi.advanceTimersByTimeAsync(1000);
      await rejection;
      vi.useRealTimers();
    });
  });

  describe('truncate', () => {
    it('returns short strings unchanged', () => {
      expect(truncate('hello')).toBe('hello');
    });

    it('truncates long strings with ellipsis', () => {
      const result = truncate('x'.repeat(50), 10);
      expect(result).toBe('xxxxxxx...');
      expect(result.length).toBe(10);
    });
  });

  describe('isBlank', () => {
    it('detects blank strings', () => {
      expect(isBlank('')).toBe(true);
      expect(isBlank('   ')).toBe(true);
      expect(isBlank(undefined)).toBe(true);
      expect(isBlank(null)).toBe(true);
      expect(isBlank('x')).toBe(false);
    });
  });

  describe('deepMerge', () => {
    it('deeply merges nested objects', () => {
      const merged = deepMerge({ a: { x: 1, y: 2 }, b: 1 }, { a: { y: 3, z: 4 }, c: 5 });
      expect(merged).toEqual({ a: { x: 1, y: 3, z: 4 }, b: 1, c: 5 });
    });

    it('replaces non-object values', () => {
      const merged = deepMerge({ a: 1, b: { x: 1 } }, { a: 2, b: { x: 2 } });
      expect(merged).toEqual({ a: 2, b: { x: 2 } });
    });

    it('replaces arrays instead of merging', () => {
      const merged = deepMerge({ tags: ['a'] }, { tags: ['b', 'c'] });
      expect(merged.tags).toEqual(['b', 'c']);
    });

    it('ignores undefined source values', () => {
      const merged = deepMerge({ a: 1 }, { a: undefined, b: 2 });
      expect(merged).toEqual({ a: 1, b: 2 });
    });
  });
});
