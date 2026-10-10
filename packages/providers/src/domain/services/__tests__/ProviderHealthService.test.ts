import { describe, expect, it } from 'vitest';
import { Provider } from '../../entities/Provider.js';
import type { ProviderHealth } from '../../entities/Provider.js';
import { createProviderId } from '../../value-objects/ProviderId.js';
import { ProviderLifecycleStatus } from '../../value-objects/ProviderLifecycleStatus.js';
import { ProviderHealthService } from '../ProviderHealthService.js';

/**
 * Simulate a status hydrated from unvalidated storage. The Postgres provider
 * repository casts the stored JSONB column (`row.health as ProviderEntity['health']`),
 * so at runtime a stale / cross-vocabulary value can reach this service even
 * though the declared type is the canonical `ProviderStatus` union.
 */
function unrecognizedStatus(value: string): ProviderHealth['status'] {
  return value as unknown as ProviderHealth['status'];
}

/** Build a provider with a specific health status (recognized or not). */
function makeProviderWithStatus(
  id: string,
  status: ProviderHealth['status'],
  lifecycle: 'active' | 'maintenance' | 'deprecated' = 'active',
): Provider {
  return Provider.create({
    id: createProviderId(id),
    family: 'mock',
    name: id,
    description: `${id} provider`,
    owner: 'test',
    lifecycleStatus: ProviderLifecycleStatus.fromStatus(lifecycle),
    capabilities: ['content_generation'],
    health: {
      status,
      healthScore: 0.9,
      latencyMs: 100,
      successCount: 90,
      failureCount: 10,
      quotaUsedPercent: 30,
      rateLimitRemaining: 100,
      rateLimitResetAt: null,
      lastSuccessAt: '2026-08-03T00:00:00.000Z',
      lastFailureAt: null,
      lastCheckedAt: '2026-08-03T00:00:00.000Z',
    },
  });
}

function makeProvider(
  id: string,
  healthScore: number,
  lifecycle: 'active' | 'maintenance' | 'deprecated' = 'active',
): Provider {
  return Provider.create({
    id: createProviderId(id),
    family: 'mock',
    name: id,
    description: `${id} provider`,
    owner: 'test',
    lifecycleStatus: ProviderLifecycleStatus.fromStatus(lifecycle),
    capabilities: ['content_generation'],
    health: {
      status: healthScore >= 0.7 ? 'healthy' : healthScore >= 0.4 ? 'degraded' : 'unstable',
      healthScore,
      latencyMs: 100,
      successCount: 100,
      failureCount: healthScore < 0.7 ? 50 : 5,
      quotaUsedPercent: 30,
      rateLimitRemaining: 100,
      rateLimitResetAt: null,
      lastSuccessAt: '2026-08-03T00:00:00.000Z',
      lastFailureAt: null,
      lastCheckedAt: '2026-08-03T00:00:00.000Z',
    },
  });
}

describe('ProviderHealthService', () => {
  it('aggregates fleet health across providers', () => {
    const svc = new ProviderHealthService();
    const fleet = svc.fleetHealth([
      makeProvider('healthy-a', 0.95),
      makeProvider('degraded', 0.55),
      makeProvider('unstable', 0.2),
    ]);
    expect(fleet.totalCount).toBe(3);
    expect(fleet.healthyCount).toBe(1);
    expect(fleet.degradedCount).toBe(1);
    expect(fleet.unstableCount).toBe(1);
    expect(fleet.downCount).toBe(0);
    expect(fleet.averageHealthScore).toBeCloseTo((0.95 + 0.55 + 0.2) / 3, 5);
    expect(fleet.totalFailures).toBe(5 + 50 + 50);
    expect(fleet.snapshots).toHaveLength(3);
    expect(fleet.snapshots[0]?.healthScore).toBeGreaterThanOrEqual(
      fleet.snapshots[1]?.healthScore ?? 1,
    );
  });

  it('counts down providers separately', () => {
    const svc = new ProviderHealthService();
    // A freshly registered provider (no history) that fails 5 consecutive
    // samples crosses the >50% failure ratio and drops to 'down'.
    const down = Provider.create({
      id: createProviderId('down'),
      family: 'mock',
      name: 'down',
      description: 'down provider',
      owner: 'test',
      lifecycleStatus: ProviderLifecycleStatus.fromStatus('active'),
      capabilities: ['content_generation'],
      health: {
        status: 'healthy',
        healthScore: 1,
        latencyMs: 0,
        successCount: 0,
        failureCount: 0,
        quotaUsedPercent: 0,
        rateLimitRemaining: 100,
        rateLimitResetAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastCheckedAt: '2026-08-03T00:00:00.000Z',
      },
    });
    for (let i = 0; i < 5; i += 1) {
      down.recordHealthSample({ ok: false, latencyMs: 5000 });
    }
    const fleet = svc.fleetHealth([down]);
    expect(fleet.downCount).toBe(1);
    expect(down.health.status).toBe('down');
  });

  it('classifies availability tiers from health + lifecycle', () => {
    const svc = new ProviderHealthService();
    expect(svc.availabilityTier(makeProvider('ready', 0.95))).toBe('ready');
    expect(svc.availabilityTier(makeProvider('caution', 0.55))).toBe('caution');
    expect(svc.availabilityTier(makeProvider('caution-maintenance', 0.95, 'maintenance'))).toBe(
      'caution',
    );
    expect(svc.availabilityTier(makeProvider('risk', 0.2))).toBe('risk');
    expect(svc.availabilityTier(makeProvider('risk-deprecated', 0.95, 'deprecated'))).toBe('risk');
  });

  it('handles an empty fleet', () => {
    const svc = new ProviderHealthService();
    const fleet = svc.fleetHealth([]);
    expect(fleet.totalCount).toBe(0);
    expect(fleet.averageHealthScore).toBe(0);
    expect(fleet.averageLatencyMs).toBe(0);
    expect(fleet.snapshots).toHaveLength(0);
  });

  // ── F-R2 regression: an unrecognized status must never read as healthy ────

  it('never counts an unrecognized status as healthy (F-R2)', () => {
    const svc = new ProviderHealthService();
    const fleet = svc.fleetHealth([
      makeProviderWithStatus('healthy-a', 'healthy'),
      makeProviderWithStatus('mystery', unrecognizedStatus('unhealthy')),
    ]);
    expect(fleet.totalCount).toBe(2);
    // Only the genuinely healthy provider is counted healthy; the unrecognized
    // value is NOT silently folded into healthyCount.
    expect(fleet.healthyCount).toBe(1);
    expect(fleet.unstableCount).toBe(1);
    expect(fleet.degradedCount).toBe(0);
    expect(fleet.downCount).toBe(0);
  });

  it('never reports an unrecognized status as ready (F-R2)', () => {
    const svc = new ProviderHealthService();
    expect(svc.availabilityTier(makeProviderWithStatus('a', unrecognizedStatus('unhealthy')))).toBe(
      'risk',
    );
    expect(svc.availabilityTier(makeProviderWithStatus('b', unrecognizedStatus('unknown')))).toBe(
      'risk',
    );
    expect(svc.availabilityTier(makeProviderWithStatus('c', unrecognizedStatus('critical')))).toBe(
      'risk',
    );
  });

  it('keeps every recognized status unchanged (F-R2 control)', () => {
    const svc = new ProviderHealthService();
    expect(svc.availabilityTier(makeProviderWithStatus('h', 'healthy'))).toBe('ready');
    expect(svc.availabilityTier(makeProviderWithStatus('d', 'degraded'))).toBe('caution');
    expect(svc.availabilityTier(makeProviderWithStatus('u', 'unstable'))).toBe('risk');
    expect(svc.availabilityTier(makeProviderWithStatus('x', 'down'))).toBe('risk');

    const fleet = svc.fleetHealth([
      makeProviderWithStatus('h', 'healthy'),
      makeProviderWithStatus('d', 'degraded'),
      makeProviderWithStatus('u', 'unstable'),
      makeProviderWithStatus('x', 'down'),
    ]);
    expect(fleet).toMatchObject({
      healthyCount: 1,
      degradedCount: 1,
      unstableCount: 1,
      downCount: 1,
      totalCount: 4,
    });
  });

  it('treats a provider with no recorded health as the documented entity default', () => {
    // "Missing" health is not representable in this contract: `Provider.create`
    // defaults a fresh provider to status 'healthy'. That is a recognized value
    // and is unchanged — it is not an unknown status being folded into healthy.
    const fresh = Provider.create({
      id: createProviderId('fresh'),
      family: 'mock',
      name: 'fresh',
      description: 'fresh provider',
      owner: 'test',
      capabilities: ['content_generation'],
    });
    expect(fresh.health.status).toBe('healthy');
    expect(new ProviderHealthService().fleetHealth([fresh]).healthyCount).toBe(1);
  });
});
