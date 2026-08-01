// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Shared utilities unit tests
// Implements BLP-001/D02 — clean architecture shared utilities
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, afterEach } from 'vitest';

let timerMode: 'real' | 'fake' = 'real';

function useFakeTimers(): void {
  timerMode = 'fake';
  vi.useFakeTimers();
}

function restoreTimers(): void {
  if (timerMode === 'fake') {
    vi.useRealTimers();
    timerMode = 'real';
  }
}

afterEach(() => {
  restoreTimers();
});
import {
  sleep,
  now,
  clamp,
  generateId,
  pick,
  omit,
  deepFreeze,
  debounce,
  throttle,
  retry,
  isUuid,
  isEmail,
} from '../index.js';

describe('sleep', () => {
  it('resolves after the given delay', async () => {
    useFakeTimers();
    const promise = sleep(100);
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBeUndefined();
  });
});

describe('now', () => {
  it('returns a valid ISO timestamp', () => {
    const value = now();
    expect(new Date(value).toISOString()).toBe(value);
  });
});

describe('clamp', () => {
  it('clamps above the max', () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });
  it('clamps below the min', () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });
  it('returns the value when within range', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });
});

describe('generateId', () => {
  it('generates an id without prefix', () => {
    const id = generateId();
    expect(id).toHaveLength(24);
    expect(id).not.toContain('-');
  });
  it('prefixes the id when given', () => {
    const id = generateId('usr');
    expect(id.startsWith('usr_')).toBe(true);
    expect(id).toHaveLength(28);
  });
  it('generates unique ids', () => {
    expect(generateId()).not.toBe(generateId());
  });
});

describe('pick', () => {
  it('picks only the requested keys', () => {
    expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 });
  });
  it('skips keys not present on the object', () => {
    expect(pick({ a: 1 }, ['a', 'missing' as never])).toEqual({ a: 1 });
  });
  it('returns an empty object for an empty key list', () => {
    expect(pick({ a: 1 }, [])).toEqual({});
  });
});

describe('omit', () => {
  it('removes the requested keys', () => {
    expect(omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 });
  });
  it('returns the same object when omitting nothing', () => {
    expect(omit({ a: 1 }, [])).toEqual({ a: 1 });
  });
});

describe('deepFreeze', () => {
  it('freezes the object and nested objects', () => {
    const frozen = deepFreeze({ a: { b: 1 }, c: [1, 2] });
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.a)).toBe(true);
    expect(Object.isFrozen(frozen.c)).toBe(true);
  });
  it('freezes a flat object', () => {
    const frozen = deepFreeze({ a: 1 });
    expect(Object.isFrozen(frozen)).toBe(true);
  });
});

describe('debounce', () => {
  it('calls the function once after the delay with the latest args', async () => {
    useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 50);
    debounced('a');
    debounced('b');
    debounced('c');
    expect(fn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(50);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });
});

describe('throttle', () => {
  it('calls immediately then suppresses calls within the limit', async () => {
    useFakeTimers();
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled(1);
    throttled(2);
    throttled(3);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    throttled(4);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('retry', () => {
  it('resolves on the first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(retry(fn, { maxRetries: 3 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries until success', async () => {
    useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('ok');
    const promise = retry(fn, { maxRetries: 3, baseDelay: 10 });
    await vi.advanceTimersByTimeAsync(200);
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws the last error after exhausting retries', async () => {
    useFakeTimers();
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));
    const promise = retry(fn, { maxRetries: 2, baseDelay: 5 });
    const rejection = expect(promise).rejects.toThrow('always fails');
    await vi.advanceTimersByTimeAsync(200);
    await rejection;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('stops retrying when shouldRetry returns false', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('no retry')).mockResolvedValue('ok');
    await expect(
      retry(fn, {
        maxRetries: 3,
        baseDelay: 1,
        shouldRetry: (err) => err.message !== 'no retry',
      }),
    ).rejects.toThrow('no retry');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('caps the delay at maxDelay', async () => {
    useFakeTimers();
    const fn = vi.fn().mockRejectedValue(new Error('x'));
    const promise = retry(fn, { maxRetries: 5, baseDelay: 1000, maxDelay: 1500 });
    const rejection = expect(promise).rejects.toThrow('x');
    await vi.advanceTimersByTimeAsync(100000);
    await rejection;
  });
});

describe('isUuid', () => {
  it('accepts a valid UUID', () => {
    expect(isUuid('123e4567-e89b-42d3-a456-426614174000')).toBe(true);
  });
  it('rejects non-UUID strings', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('')).toBe(false);
  });
});

describe('isEmail', () => {
  it('accepts a valid email', () => {
    expect(isEmail('user@example.com')).toBe(true);
  });
  it('rejects invalid emails', () => {
    expect(isEmail('nope')).toBe(false);
    expect(isEmail('user@')).toBe(false);
    expect(isEmail('')).toBe(false);
  });
});
