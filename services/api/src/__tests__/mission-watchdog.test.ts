// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — FINAL-04: Mission provider-wait watchdog
//
// Two deterministic layers:
//   1. the cadence DRIVER (services/api/observability/mission-watchdog.ts) —
//      enabled/disabled, immediate first pass, bounded backoff while idle,
//      base cadence while work is waiting, overlap/error isolation, stop;
//   2. the MissionService pass over the REAL composed runtime — a mission that
//      honestly reached WAITING_FOR_PROVIDER is discovered and resumed through
//      the frozen state machine when a provider becomes available, with NO
//      human re-prompt, and the recovery is recorded on the durable trail.
// ─────────────────────────────────────────────────────────────────────────────

import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { MockProvider, AIOrchestrationService } from '@vedmoulya/orchestrator';
import { MissionService } from '../services/MissionService.js';
import {
  getMissionWatchdog,
  startMissionWatchdog,
  stopMissionWatchdog,
} from '../observability/mission-watchdog.js';

afterEach(() => {
  stopMissionWatchdog();
});

const silentLog = { info: () => undefined, warn: () => undefined };

async function waitFor(condition: () => boolean, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('timeout waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

const idleOutcome = {
  considered: 0,
  resumed: 0,
  stillWaiting: 0,
  skipped: 0,
  resumedMissionIds: [] as string[],
};

describe('FINAL-04 — mission watchdog cadence driver', () => {
  it('runs one pass immediately and reports honest runtime status', async () => {
    let calls = 0;
    const driver = startMissionWatchdog({
      intervalMs: 10_000,
      runImmediately: true,
      getTarget: () => ({
        runWatchdogPass: async () => {
          calls += 1;
          return idleOutcome;
        },
      }),
      log: silentLog,
    });
    await waitFor(() => driver.lastTick !== undefined);
    expect(calls).toBe(1);
    const status = driver.status();
    expect(status.active).toBe(true);
    expect(status.reason).toBe('enabled');
    expect(status.intervalMs).toBe(10_000);
    // Nothing to reconcile → the cadence backs off (bounded, never stops).
    expect((status.nextTickAt ?? 0) - (driver.lastTick?.finishedAt ?? 0)).toBeGreaterThanOrEqual(
      19_999,
    );
    expect((status.nextTickAt ?? 0) - (driver.lastTick?.finishedAt ?? 0)).toBeLessThanOrEqual(
      20_001,
    );
  });

  it('returns to the base cadence while missions are genuinely waiting', async () => {
    const driver = startMissionWatchdog({
      intervalMs: 1_000,
      maxIntervalMs: 8_000,
      runImmediately: true,
      getTarget: () => ({
        runWatchdogPass: async () => ({ ...idleOutcome, considered: 1, stillWaiting: 1 }),
      }),
      log: silentLog,
    });
    await waitFor(() => driver.lastTick !== undefined);
    const status = driver.status();
    expect(status.lastTick?.stillWaiting).toBe(1);
    // Base cadence (1s), not backed off.
    expect((status.nextTickAt ?? 0) - (driver.lastTick?.finishedAt ?? 0)).toBeGreaterThanOrEqual(
      999,
    );
    expect((status.nextTickAt ?? 0) - (driver.lastTick?.finishedAt ?? 0)).toBeLessThanOrEqual(
      1_001,
    );
  });

  it('backoff is bounded by maxIntervalMs', async () => {
    const driver = startMissionWatchdog({
      intervalMs: 1_000,
      maxIntervalMs: 1_500,
      runImmediately: true,
      getTarget: () => ({ runWatchdogPass: async () => idleOutcome }),
      log: silentLog,
    });
    await waitFor(() => driver.lastTick !== undefined);
    const status = driver.status();
    // 2 × 1000 would exceed the 1500 ceiling → clamped.
    expect((status.nextTickAt ?? 0) - (driver.lastTick?.finishedAt ?? 0)).toBeLessThanOrEqual(
      1_501,
    );
  });

  it('a failing pass is isolated — recorded, logged, never thrown, cadence preserved', async () => {
    const warnings: string[] = [];
    const driver = startMissionWatchdog({
      intervalMs: 10_000,
      runImmediately: true,
      getTarget: () => ({
        runWatchdogPass: () => Promise.reject(new Error('mission runtime unavailable')),
      }),
      log: {
        info: () => undefined,
        warn: (message) => {
          warnings.push(message);
        },
      },
    });
    await waitFor(() => driver.lastTick !== undefined);
    expect(driver.status().active).toBe(true);
    expect(driver.lastTick?.resumed).toBe(0);
    expect(warnings.some((w) => w.includes('Mission watchdog pass failed'))).toBe(true);
  });

  it('is disabled on request and is an idempotent singleton', () => {
    const disabled = startMissionWatchdog({ enabled: false });
    expect(disabled.status()).toEqual({ active: false, reason: 'disabled' });
    expect(getMissionWatchdog()).toBeUndefined();

    const first = startMissionWatchdog({
      intervalMs: 60_000,
      runImmediately: false,
      log: silentLog,
    });
    const second = startMissionWatchdog({
      intervalMs: 60_000,
      runImmediately: false,
      log: silentLog,
    });
    expect(second).toBe(first);
    expect(getMissionWatchdog()).toBe(first);
    stopMissionWatchdog();
    expect(getMissionWatchdog()).toBeUndefined();
  });
});

describe('FINAL-04 — MissionService watchdog pass over the real runtime', () => {
  it('discovers a WAITING_FOR_PROVIDER mission, resumes it when a provider appears, and records the recovery durably', async () => {
    const workspace = mkdtempSync(path.join(tmpdir(), 'vedmoulya-watchdog-'));
    try {
      let orchestrator: AIOrchestrationService | undefined;
      const service = new MissionService({
        workspaceRoot: workspace,
        runtimeOptions: {
          // Initially NOTHING is registered — the mission must honestly wait.
          registerProviders: (instance) => {
            orchestrator = instance;
          },
          orchestratorOptions: { retryBaseDelayMs: 1 },
        },
      });
      const created = await service.createAndRun('watch-user', {
        title: 'Watchdog mission',
        objective: 'Improve the workspace autonomously',
        initialObjectives: ['Create the workspace file watchdog-1.md with the content'],
      });

      const runtime = service.getComposedRuntime();
      if (!runtime) throw new Error('runtime not composed');
      // The detached loop settles into the honest provider hold.
      await waitFor(
        () =>
          runtime.stores.missions.getSync?.(created.missionId)?.state === 'WAITING_FOR_PROVIDER',
      );
      const waiting = await runtime.stores.missions.get(created.missionId);
      expect(waiting?.state).toBe('WAITING_FOR_PROVIDER');

      // The provider comes back.
      if (!orchestrator) throw new Error('orchestrator not captured');
      orchestrator.registerProvider(new MockProvider());

      const pass = await service.runWatchdogPass();
      expect(pass.considered).toBe(1);
      expect(pass.resumed).toBe(1);
      expect(pass.resumedMissionIds).toEqual([created.missionId]);

      // The watchdog relaunched the SAME autonomous loop (detached) — the
      // mission proceeds to verified completion with no further prompting.
      await waitFor(
        () => runtime.stores.missions.getSync?.(created.missionId)?.state === 'COMPLETED',
      );

      const final = await runtime.stores.missions.get(created.missionId);
      expect(final?.state).toBe('COMPLETED');
      expect(final?.objectives[0]?.state).toBe('VERIFIED');
      // The watchdog action is on the durable trail (survives restart).
      const kinds = (final?.activity ?? []).map((event) => event.kind);
      expect(kinds).toContain('WATCHDOG_RESUMED');
      expect(kinds).toContain('MISSION_RESUMED');
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('FINAL-05: rescues an ABANDONED execution (crashed owner, expired lease) and finishes it', async () => {
    const workspace = mkdtempSync(path.join(tmpdir(), 'vedmoulya-abandoned-'));
    try {
      const service = new MissionService({
        workspaceRoot: workspace,
        runtimeOptions: {
          registerProviders: (orchestrator) => {
            orchestrator.registerProvider(new MockProvider());
          },
          orchestratorOptions: { retryBaseDelayMs: 1 },
        },
      });
      const created = await service.createMission('crash-user', {
        title: 'Abandoned mission',
        objective: 'Improve the workspace autonomously',
        initialObjectives: ['Create the workspace file abandoned-1.md with the content'],
      });
      await service.start('crash-user', created.missionId);

      const runtime = service.getComposedRuntime();
      if (!runtime) throw new Error('runtime not composed');
      // Model the crash exactly as the durable state records it: the objective
      // is RUNNING under a lease whose owner is gone and whose TTL expired.
      const persisted = await runtime.stores.missions.get(created.missionId);
      const objective = persisted?.objectives[0];
      if (!persisted || !objective) throw new Error('objective missing');
      objective.state = 'RUNNING';
      objective.stateHistory.push('RUNNING');
      objective.lease = {
        owner: 'dead-worker',
        acquiredAt: '2020-01-01T00:00:00.000Z',
        expiresAt: '2020-01-01T00:01:00.000Z', // long expired
      };
      await runtime.stores.missions.save(persisted);

      const pass = await service.runWatchdogPass();
      expect(pass.abandonedRecovered).toBe(1);
      expect(pass.resumedMissionIds).toEqual([created.missionId]);
      expect(pass.stillOwned).toBe(0);

      // The SAME detached loop finishes the healed mission, with no human.
      await waitFor(
        () => runtime.stores.missions.getSync?.(created.missionId)?.state === 'COMPLETED',
      );
      const final = await runtime.stores.missions.get(created.missionId);
      expect(final?.state).toBe('COMPLETED');
      expect(final?.objectives[0]?.state).toBe('VERIFIED');
      const kinds = (final?.activity ?? []).map((event) => event.kind);
      expect(kinds).toContain('RECOVERY_LEASE_EXPIRED');
      expect(kinds).toContain('MISSION_COMPLETED');
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
