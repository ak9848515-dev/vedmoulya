// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Mission: per-user runtime cache reliability (PROVIDER-01 → Mission)
//
// Regression coverage for the cache used to build a mission owner's provider
// runtime:
//   - a SUCCESSFUL initialization stays cached (one registration per user);
//   - a FAILED initialization is EVICTED, so a transient credential failure
//     cannot poison the cache for the process lifetime;
//   - after a failure a later call retries cleanly and can succeed;
//   - concurrent callers for the SAME user share ONE initialization promise;
//   - different users stay independently cached and isolated;
//   - the ORIGINAL initialization error is still propagated (never swallowed).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { MockProvider } from '@vedmoulya/orchestrator';
import type { AgentPlan } from '@vedmoulya/agent-execution';
import { cacheUserInitialization, createMissionRuntime } from '../composition/MissionRuntime.js';

const EMPTY_PLAN = { planId: 'plan-noop', objective: 'noop', steps: [] } as unknown as AgentPlan;

describe('cacheUserInitialization — per-user lazy init cache', () => {
  it('keeps a successful initialization cached', async () => {
    const cache = new Map<string, Promise<string>>();
    let calls = 0;
    const initialize = async (): Promise<string> => {
      calls += 1;
      return 'ready';
    };

    const first = cacheUserInitialization(cache, 'userA', initialize);
    const second = cacheUserInitialization(cache, 'userA', initialize);

    expect(second).toBe(first);
    await expect(first).resolves.toBe('ready');
    expect(calls).toBe(1);
    expect(cache.get('userA')).toBe(first);
  });

  it('evicts the cache entry when initialization fails', async () => {
    const cache = new Map<string, Promise<string>>();
    const failure = new Error('credential resolution failed');

    const attempt = cacheUserInitialization(cache, 'userA', async () => {
      throw failure;
    });

    await expect(attempt).rejects.toThrow('credential resolution failed');
    expect(cache.has('userA')).toBe(false);
  });

  it('propagates the ORIGINAL error (never swallowed)', async () => {
    const cache = new Map<string, Promise<string>>();
    const failure = new Error('original failure');

    let caught: unknown;
    try {
      await cacheUserInitialization(cache, 'userA', async () => {
        throw failure;
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(failure);
  });

  it('retries cleanly after a failure and can succeed', async () => {
    const cache = new Map<string, Promise<string>>();
    let calls = 0;
    const flaky = async (): Promise<string> => {
      calls += 1;
      if (calls === 1) throw new Error('transient failure');
      return 'recovered';
    };

    await expect(cacheUserInitialization(cache, 'userA', flaky)).rejects.toThrow(
      'transient failure',
    );
    await expect(cacheUserInitialization(cache, 'userA', flaky)).resolves.toBe('recovered');
    expect(calls).toBe(2);
    expect(cache.has('userA')).toBe(true);
  });

  it('shares ONE initialization promise across concurrent callers for the same user', async () => {
    const cache = new Map<string, Promise<string>>();
    let calls = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const initialize = async (): Promise<string> => {
      calls += 1;
      await gate;
      return 'ready';
    };

    const first = cacheUserInitialization(cache, 'userA', initialize);
    const second = cacheUserInitialization(cache, 'userA', initialize);
    expect(second).toBe(first);

    release();
    await expect(Promise.all([first, second])).resolves.toEqual(['ready', 'ready']);
    expect(calls).toBe(1);
  });

  it('keeps different users independently cached', async () => {
    const cache = new Map<string, Promise<string>>();
    const callsByUser = new Map<string, number>();
    const initialize = (userId: string) => async (): Promise<string> => {
      callsByUser.set(userId, (callsByUser.get(userId) ?? 0) + 1);
      return `ready:${userId}`;
    };

    const a = cacheUserInitialization(cache, 'userA', initialize('userA'));
    const b = cacheUserInitialization(cache, 'userB', initialize('userB'));

    expect(a).not.toBe(b);
    await expect(a).resolves.toBe('ready:userA');
    await expect(b).resolves.toBe('ready:userB');
    // A second call per user reuses the cache.
    cacheUserInitialization(cache, 'userA', initialize('userA'));
    cacheUserInitialization(cache, 'userB', initialize('userB'));
    expect(callsByUser.get('userA')).toBe(1);
    expect(callsByUser.get('userB')).toBe(1);
  });

  it('never evicts a replacement entry when a superseded attempt fails', async () => {
    const cache = new Map<string, Promise<string>>();
    let rejectFirst: (error: Error) => void = () => {};
    const firstAttempt = new Promise<string>((_resolve, reject) => {
      rejectFirst = reject;
    });

    const attempt = cacheUserInitialization(cache, 'userA', () => firstAttempt);
    // Simulate a fresh retry replacing the in-flight entry.
    const replacement = Promise.resolve('replacement');
    cache.set('userA', replacement);

    rejectFirst(new Error('superseded attempt failed'));
    await expect(attempt).rejects.toThrow('superseded attempt failed');
    expect(cache.get('userA')).toBe(replacement);
  });
});

describe('MissionRuntime — per-user provider runtime cache', () => {
  it('registers a user runtime once and reuses it', async () => {
    let registrations = 0;
    const runtime = createMissionRuntime({
      registerUserProviders: async (orchestrator) => {
        registrations += 1;
        orchestrator.registerProvider(new MockProvider());
      },
    });

    await runtime.ports.providerAvailability.getProviderStatus([], 'userA');
    await runtime.ports.providerAvailability.getProviderStatus([], 'userA');

    expect(registrations).toBe(1);
  });

  it('evicts a failed user runtime so the next call retries and succeeds', async () => {
    let attempts = 0;
    const runtime = createMissionRuntime({
      registerUserProviders: async (orchestrator) => {
        attempts += 1;
        if (attempts === 1) throw new Error('credential resolution failed');
        orchestrator.registerProvider(new MockProvider());
      },
    });

    await expect(runtime.ports.providerAvailability.getProviderStatus([], 'userA')).rejects.toThrow(
      'credential resolution failed',
    );

    const status = await runtime.ports.providerAvailability.getProviderStatus([], 'userA');
    expect(attempts).toBe(2);
    expect(status.available).toBe(true);
  });

  it('shares one initialization across concurrent calls for the same user', async () => {
    let registrations = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const runtime = createMissionRuntime({
      registerUserProviders: async (orchestrator) => {
        registrations += 1;
        await gate;
        orchestrator.registerProvider(new MockProvider());
      },
    });

    const first = runtime.ports.providerAvailability.getProviderStatus([], 'userA');
    const second = runtime.ports.providerAvailability.getProviderStatus([], 'userA');
    release();
    const [a, b] = await Promise.all([first, second]);

    expect(registrations).toBe(1);
    expect(a.available).toBe(true);
    expect(b.available).toBe(true);
  });

  it('keeps different users independently cached', async () => {
    const seen: string[] = [];
    const runtime = createMissionRuntime({
      registerUserProviders: async (orchestrator, userId) => {
        seen.push(userId);
        orchestrator.registerProvider(new MockProvider());
      },
    });

    await runtime.ports.providerAvailability.getProviderStatus([], 'userA');
    await runtime.ports.providerAvailability.getProviderStatus([], 'userB');
    await runtime.ports.providerAvailability.getProviderStatus([], 'userA');
    await runtime.ports.providerAvailability.getProviderStatus([], 'userB');

    expect(seen).toEqual(['userA', 'userB']);
  });

  it('does not permanently poison the user AGENT cache on initialization failure', async () => {
    let attempts = 0;
    const runtime = createMissionRuntime({
      registerUserProviders: async (orchestrator) => {
        attempts += 1;
        if (attempts === 1) throw new Error('credential resolution failed');
        orchestrator.registerProvider(new MockProvider());
      },
    });

    // The agent resolver reaches the same (failing) user-orchestrator init.
    await expect(runtime.ports.executor.executePlan(EMPTY_PLAN, 'userA')).rejects.toThrow(
      'credential resolution failed',
    );

    // The failed initialization was evicted → the retry re-initializes and
    // reaches the agent run instead of failing again at initialization.
    const result = await runtime.ports.executor.executePlan(EMPTY_PLAN, 'userA');
    expect(attempts).toBe(2);
    expect(result.success).toBe(false);
  });

  it('does not resolve a user runtime when no registrar is wired', async () => {
    const runtime = createMissionRuntime({});
    const status = await runtime.ports.providerAvailability.getProviderStatus([], 'userA');
    expect(status.available).toBe(false);
  });
});
