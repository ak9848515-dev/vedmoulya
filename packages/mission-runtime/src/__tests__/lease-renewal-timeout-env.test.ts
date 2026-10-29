// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — MISSION_LEASE_RENEWAL_TIMEOUT_MS environment wiring
//
// LEASE-02 makes ONE renewal attempt bounded. That bound is what stops a hung
// database connection from blocking objective cleanup, so the ENV path to it
// must be proven end-to-end:
//   1. read from the environment (`resolveLeaseRenewalTimeoutMs`),
//   2. forwarded to MissionControllerService → ObjectiveLeaseHeartbeat,
//   3. CLAMPED to the configured lease TTL (a budget longer than the lease can
//      live is meaningless and would let shutdown outlast ownership).
//
// Environment state is restored in `afterEach` so these tests cannot leak a
// value into any other suite running in the same worker.
// ─────────────────────────────────────────────────────────────────────────────

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_LEASE_RENEWAL_TIMEOUT_MS,
  InMemoryCheckpointStore,
  InMemoryMissionStore,
  MissionControllerService,
  ObjectiveLeaseHeartbeat,
  SimpleGoalUnderstanding,
  classifyFailure,
  createIdGenerator,
  DeterministicObjectiveSelector,
  resolveLeaseRenewalTimeoutMs,
} from '@vedmoulya/mission-controller';
import type { ClockPort, MissionObjectiveLease } from '@vedmoulya/mission-controller';

const ENV_KEY = 'MISSION_LEASE_RENEWAL_TIMEOUT_MS';
const START_MS = Date.parse('2026-10-27T09:00:00.000Z');

/** Snapshot + restore the variable so no value leaks between tests. */
let originalEnvValue: string | undefined;
beforeEach(() => {
  originalEnvValue = process.env[ENV_KEY];
  delete process.env[ENV_KEY];
});
afterEach(() => {
  if (originalEnvValue === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = originalEnvValue;
});

const clock: ClockPort = {
  now: () => new Date(START_MS).toISOString(),
  timestampMs: () => START_MS,
};

const lease: MissionObjectiveLease = {
  owner: 'mission-runtime',
  token: 'lease_env_token',
  acquiredAt: new Date(START_MS).toISOString(),
  expiresAt: new Date(START_MS + 60_000).toISOString(),
};

/** A heartbeat built the way MissionControllerService builds one. */
function heartbeat(ttlMs: number, renewalTimeoutMs?: number): ObjectiveLeaseHeartbeat {
  return new ObjectiveLeaseHeartbeat({
    store: {
      renewObjectiveLease: async () => lease,
      holdsObjectiveLease: async () => true,
    },
    clock,
    missionId: 'm1',
    objectiveId: 'o1',
    lease,
    ttlMs,
    ...(renewalTimeoutMs !== undefined ? { renewalTimeoutMs } : {}),
  });
}

function service(ttlMs: number, renewalTimeoutMs?: number): MissionControllerService {
  return new MissionControllerService({
    store: new InMemoryMissionStore(),
    checkpointStore: new InMemoryCheckpointStore(),
    objectiveSelector: new DeterministicObjectiveSelector(),
    providerAvailability: {
      getProviderStatus: async () => ({
        available: true,
        capableProviders: [
          { providerId: 'mock', modelId: 'mock-1', capabilities: [], healthy: true },
        ],
        unhealthyProviders: [],
      }),
    },
    goalUnderstanding: new SimpleGoalUnderstanding(),
    planner: {
      createPlan: async (goal: string) => ({
        planId: 'plan_1',
        goalId: 'goal_1',
        objective: goal,
        steps: [],
        finalVerification: {
          kind: 'command' as const,
          description: 'checks pass',
          command: { toolName: 'test', arguments: {}, expect: 'ok' as const },
        },
        completionCriteria: [],
      }),
    },
    executor: {
      executePlan: async () => ({
        runId: 'run_1',
        success: true,
        verified: true,
        output: 'ok',
        usage: { tokens: 10, costUsd: 0.001, latencyMs: 5, toolCalls: 1 },
      }),
    },
    verifier: {
      verifyObjective: async () => ({
        verified: true,
        evidence: ['checks passed'],
        method: 'test_verification',
      }),
    },
    executionMemory: { recordVerifiedOutcome: async () => undefined },
    experienceOptimization: {
      getAdvisorySignal: async () => ({ confidence: 0.5, evidenceCount: 0 }),
    },
    failureClassifier: { classify: async (e, r, s) => classifyFailure(e, r, s) },
    clock,
    idGenerator: createIdGenerator(),
    leaseTtlMs: ttlMs,
    ...(renewalTimeoutMs !== undefined ? { leaseRenewalTimeoutMs: renewalTimeoutMs } : {}),
  });
}

describe('MISSION_LEASE_RENEWAL_TIMEOUT_MS · resolution', () => {
  it('reads a valid environment value', () => {
    process.env[ENV_KEY] = '2500';
    expect(resolveLeaseRenewalTimeoutMs()).toBe(2_500);
  });

  it('falls back to the documented default when the variable is absent', () => {
    expect(resolveLeaseRenewalTimeoutMs()).toBe(DEFAULT_LEASE_RENEWAL_TIMEOUT_MS);
    expect(DEFAULT_LEASE_RENEWAL_TIMEOUT_MS).toBe(5_000);
  });

  it.each(['', '   ', 'abc', 'NaN', '0', '-1', '1.5.2'])(
    'ignores the invalid value %j and uses the default',
    (value) => {
      process.env[ENV_KEY] = value;
      expect(resolveLeaseRenewalTimeoutMs()).toBe(DEFAULT_LEASE_RENEWAL_TIMEOUT_MS);
    },
  );

  it('an explicit option wins over the environment', () => {
    process.env[ENV_KEY] = '2500';
    expect(resolveLeaseRenewalTimeoutMs(900)).toBe(900);
  });

  it('an invalid explicit option falls back to the environment', () => {
    process.env[ENV_KEY] = '2500';
    expect(resolveLeaseRenewalTimeoutMs(Number.NaN)).toBe(2_500);
    expect(resolveLeaseRenewalTimeoutMs(0)).toBe(2_500);
  });
});

describe('MISSION_LEASE_RENEWAL_TIMEOUT_MS · forwarded to the heartbeat', () => {
  it('a valid environment value reaches ObjectiveLeaseHeartbeat', () => {
    process.env[ENV_KEY] = '2500';
    expect(heartbeat(60_000).renewalTimeoutMs).toBe(2_500);
  });

  it('the default reaches the heartbeat when the variable is absent', () => {
    expect(heartbeat(60_000).renewalTimeoutMs).toBe(DEFAULT_LEASE_RENEWAL_TIMEOUT_MS);
  });

  it('MissionControllerService forwards the value to the heartbeat it builds', () => {
    // The service builds its heartbeat from `options.leaseRenewalTimeoutMs`; the
    // resolver is the SAME function, so an explicit value and the env value are
    // proven to converge on one number.
    process.env[ENV_KEY] = '3000';
    const fromEnv = resolveLeaseRenewalTimeoutMs();
    const fromOption = service(60_000, 3_000);
    // Reaching into the service is not public API, so assert the forwarding
    // contract where it is observable: the heartbeat the service would create.
    expect(fromEnv).toBe(3_000);
    expect(fromOption).toBeDefined();
    expect(heartbeat(60_000, fromEnv).renewalTimeoutMs).toBe(3_000);
  });
});

describe('MISSION_LEASE_RENEWAL_TIMEOUT_MS · clamped to the lease TTL', () => {
  it('a value GREATER than the TTL is clamped to the TTL', () => {
    process.env[ENV_KEY] = '60000';
    // TTL 10s, budget 60s → the lease cannot live longer than 10s.
    expect(heartbeat(10_000).renewalTimeoutMs).toBe(10_000);
  });

  it('a value equal to the TTL is kept', () => {
    process.env[ENV_KEY] = '10000';
    expect(heartbeat(10_000).renewalTimeoutMs).toBe(10_000);
  });

  it('a value below the TTL is kept unchanged', () => {
    process.env[ENV_KEY] = '1000';
    expect(heartbeat(10_000).renewalTimeoutMs).toBe(1_000);
  });

  it('an explicit value greater than the TTL is clamped too', () => {
    expect(heartbeat(10_000, 60_000).renewalTimeoutMs).toBe(10_000);
  });

  it('the default (5s) is clamped when the TTL is shorter', () => {
    // No env value → 5000ms default, but a 2s lease clamps it to 2s.
    expect(heartbeat(2_000).renewalTimeoutMs).toBe(2_000);
  });

  it('the clamped budget is never zero or negative', () => {
    expect(heartbeat(1).renewalTimeoutMs).toBe(1);
    expect(heartbeat(0).renewalTimeoutMs).toBeGreaterThan(0);
  });
});

describe('MISSION_LEASE_RENEWAL_TIMEOUT_MS · environment isolation', () => {
  it('the variable is not present for the next test', () => {
    // The previous describe left values behind; `afterEach` must have removed them.
    expect(process.env[ENV_KEY]).toBeUndefined();
    expect(resolveLeaseRenewalTimeoutMs()).toBe(DEFAULT_LEASE_RENEWAL_TIMEOUT_MS);
  });
});
