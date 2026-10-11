import { describe, it, expect } from 'vitest';
import {
  mockFn,
  expectAsyncError,
  waitForCondition,
  ok,
  fail,
  createMock,
  createMockService,
  createId,
  daysAgo,
  daysFromNow,
} from '../index.js';

describe('@vedmoulya/testing — mockFn', () => {
  it('records calls and returns the configured value', () => {
    const fn = mockFn<[number], number>().mockReturnValue(42);
    expect(fn(1)).toBe(42);
    expect(fn(2)).toBe(42);
    expect(fn.calls).toEqual([[1], [2]]);
  });

  it('resolves with the configured value', async () => {
    const fn = mockFn<[], Promise<string>>().mockResolvedValue('hi');
    await expect(fn()).resolves.toBe('hi');
  });

  it('rejects with the configured error', async () => {
    const fn = mockFn<[], Promise<string>>().mockRejectedValue(new Error('boom'));
    await expect(fn()).rejects.toThrow('boom');
  });

  it('mockClear resets calls but keeps the implementation', () => {
    const fn = mockFn<[number], number>().mockImplementation((n) => n * 2);
    expect(fn(3)).toBe(6);
    fn.mockClear();
    expect(fn.calls).toEqual([]);
    expect(fn(4)).toBe(8);
  });
});

describe('@vedmoulya/testing — helpers', () => {
  it('ok/fail produce tagged Results', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(fail('e')).toEqual({ ok: false, error: 'e' });
  });

  it('expectAsyncError returns the thrown error', async () => {
    const err = await expectAsyncError(async () => {
      throw new Error('nope');
    });
    expect(err.message).toBe('nope');
  });

  it('waitForCondition resolves when true and rejects on timeout', async () => {
    let flag = false;
    setTimeout(() => {
      flag = true;
    }, 20);
    await expect(waitForCondition(() => flag, 500, 10)).resolves.toBeUndefined();
    await expect(waitForCondition(() => false, 30, 10)).rejects.toThrow(
      'Condition not met within timeout',
    );
  });

  it('daysAgo / daysFromNow are in the past / future', () => {
    expect(daysAgo(2).getTime()).toBeLessThan(Date.now());
    expect(daysFromNow(2).getTime()).toBeGreaterThan(Date.now());
  });

  it('createId is prefixed and unique', () => {
    const a = createId('user');
    const b = createId('user');
    expect(a.startsWith('user_')).toBe(true);
    expect(a).not.toBe(b);
  });

  it('createMock lazily creates stable mock methods', () => {
    const m = createMock<{ greet: () => string }>();
    expect(m.greet).toBe(m.greet);
    expect(m.greet()).toBeUndefined();
  });

  it('createMockService mocks only the named methods', () => {
    const svc = createMockService<{ a: () => number; b: () => number }>(['a']);
    expect(typeof svc.a).toBe('function');
    expect(svc.a()).toBeUndefined();
  });
});
