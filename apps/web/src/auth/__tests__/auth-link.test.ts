// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — tRPC Auth Refresh Link Tests
// MOB-001 — Mobile Authentication
// Verifies the link placed in front of httpBatchLink:
//   • 401 + successful refresh  → the operation retries once and succeeds
//   • 401 + failed refresh      → the original error propagates
//   • non-401 errors            → no refresh, error propagates
// ─────────────────────────────────────────────────────────────────────────────

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observable } from '@trpc/server/observable';
import { authRefreshLink } from '../auth-link.js';
import { refreshWithLock } from '../session-manager.js';

vi.mock('../session-manager.js', () => ({
  refreshWithLock: vi.fn(),
}));

type ObserverLike = {
  next: (value: unknown) => void;
  error: (error: unknown) => void;
  complete: () => void;
};

interface FakeLinkContext {
  op: unknown;
  next: (op: unknown) => ReturnType<typeof observable<unknown>>;
}

function unauthorizedError(): Error & { shape: { httpStatus: number } } {
  return Object.assign(new Error('UNAUTHORIZED'), { shape: { httpStatus: 401 } });
}

function otherError(): Error {
  return new Error('INTERNAL_SERVER_ERROR');
}

/**
 * Build a link invocation whose `next` behaves per call: first → err, then → value.
 * The link plumbing is typed loosely here — the test only exercises runtime
 * behavior (retry / refresh / error propagation).
 */
function buildLink(behaviors: Array<(observer: ObserverLike) => void>): {
  subscribe: (handlers: Partial<ObserverLike>) => void;
  nextCalls: () => number;
} {
  const operationLink = authRefreshLink()({} as never) as (ctx: {
    op: unknown;
    next: (op: unknown) => unknown;
  }) => unknown;
  let calls = 0;

  const context: FakeLinkContext = {
    op: { id: 1, type: 'query', path: 'health.check', input: undefined },
    next: () =>
      observable((observer) => {
        const behavior = behaviors[Math.min(calls, behaviors.length - 1)] as (
          observer: ObserverLike,
        ) => void;
        calls += 1;
        behavior(observer as ObserverLike);
        return () => undefined;
      }),
  };

  const result = operationLink(context) as ReturnType<typeof observable<unknown>>;
  return {
    subscribe: (handlers) => {
      result.subscribe(handlers as never);
    },
    nextCalls: () => calls,
  };
}

let refreshMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  refreshMock = vi.mocked(refreshWithLock);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('authRefreshLink', () => {
  it('retries once with a fresh token when the first attempt is 401', async () => {
    refreshMock.mockResolvedValue(true);

    const link = buildLink([
      (observer) => observer.error(unauthorizedError()),
      (observer) => {
        observer.next({ result: { data: 'ok' } });
        observer.complete();
      },
    ]);

    const received: unknown[] = [];
    let completed = false;
    let failed: unknown = null;

    link.subscribe({
      next: (v) => received.push(v),
      error: (e) => {
        failed = e;
      },
      complete: () => {
        completed = true;
      },
    });

    await vi.waitFor(() => {
      expect(completed).toBe(true);
    });

    expect(failed).toBeNull();
    expect(received).toEqual([{ result: { data: 'ok' } }]);
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(link.nextCalls()).toBe(2);
  });

  it('propagates the original 401 when the refresh fails', async () => {
    refreshMock.mockResolvedValue(false);

    const error = unauthorizedError();
    const link = buildLink([(observer) => observer.error(error)]);

    let failed: unknown = null;
    let completed = false;

    link.subscribe({
      next: () => undefined,
      error: (e) => {
        failed = e;
      },
      complete: () => {
        completed = true;
      },
    });

    await vi.waitFor(() => {
      expect(failed).not.toBeNull();
    });

    expect(failed).toBe(error);
    expect(completed).toBe(false);
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(link.nextCalls()).toBe(1); // no retry
  });

  it('does not refresh for non-auth errors', async () => {
    const error = otherError();
    const link = buildLink([(observer) => observer.error(error)]);

    let failed: unknown = null;
    link.subscribe({
      next: () => undefined,
      error: (e) => {
        failed = e;
      },
      complete: () => undefined,
    });

    await vi.waitFor(() => {
      expect(failed).not.toBeNull();
    });

    expect(failed).toBe(error);
    expect(refreshMock).not.toHaveBeenCalled();
    expect(link.nextCalls()).toBe(1);
  });

  it('delivers values without refresh when the request succeeds immediately', async () => {
    const link = buildLink([
      (observer) => {
        observer.next({ result: { data: 'ok' } });
        observer.complete();
      },
    ]);

    const received: unknown[] = [];
    let completed = false;

    link.subscribe({
      next: (v) => received.push(v),
      error: () => undefined,
      complete: () => {
        completed = true;
      },
    });

    await vi.waitFor(() => {
      expect(completed).toBe(true);
    });

    expect(received).toEqual([{ result: { data: 'ok' } }]);
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
