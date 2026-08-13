import { describe, expect, it } from 'vitest';
import { Provider } from '../../entities/Provider.js';
import { createProviderId } from '../../value-objects/ProviderId.js';
import { ProviderLifecycleStatus } from '../../value-objects/ProviderLifecycleStatus.js';
import { ProviderHealthService } from '../ProviderHealthService.js';

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
});
