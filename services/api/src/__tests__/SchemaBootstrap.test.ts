// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — SCHEMA-01 · dedicated schema bootstrap
//
// The bootstrap is ADDITIVE: request-time DDL in the gateway stays enabled.
// These tests lock down the properties that make a deploy-time path safe:
//   1. the PLAN is the complete idempotent-DDL surface (every store with an
//      ensureTable(), the proactive table included);
//   2. a dry run performs NO database work;
//   3. real runs are sequential and one failing store never hides the rest;
//   4. concurrent callers share ONE pass (no doubled DDL storm);
//   5. a bundle that cannot execute DDL never reports success.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  createSchemaBootstrap,
  resolvePersistenceBundle,
} from '../infrastructure/PersistenceStores.js';

function recordingTargets(labels: string[], failing: string[] = []) {
  const calls: string[] = [];
  return {
    calls,
    targets: labels.map((label) => ({
      label,
      ensureTable: async (): Promise<void> => {
        calls.push(label);
        if (failing.includes(label)) throw new Error(`${label} exploded`);
      },
    })),
  };
}

describe('SCHEMA-01 · createSchemaBootstrap', () => {
  it('plans every store and performs NO work on a dry run', async () => {
    const { calls, targets } = recordingTargets(['A', 'B', 'C']);
    const bootstrap = createSchemaBootstrap(targets);

    const report = await bootstrap({ dryRun: true });

    expect(report.dryRun).toBe(true);
    expect(report.planned).toEqual(['A', 'B', 'C']);
    expect(report.applied).toEqual([]);
    expect(report.failed).toEqual([]);
    expect(calls).toEqual([]); // nothing touched the database
  });

  it('applies sequentially, isolates failures, and never claims a failed store', async () => {
    const { calls, targets } = recordingTargets(['A', 'B', 'C'], ['B']);
    const bootstrap = createSchemaBootstrap(targets);

    const report = await bootstrap();

    expect(calls).toEqual(['A', 'B', 'C']); // order preserved, no abort
    expect(report.applied).toEqual(['A', 'C']);
    expect(report.failed).toEqual([{ label: 'B', error: 'B exploded' }]);
    expect(report.dryRun).toBe(false);
  });

  it('shares ONE pass between concurrent callers', async () => {
    const { calls, targets } = recordingTargets(['A', 'B']);
    const bootstrap = createSchemaBootstrap(targets);

    const [first, second] = await Promise.all([bootstrap(), bootstrap()]);

    expect(calls).toEqual(['A', 'B']); // exactly one DDL pass
    expect(first).toBe(second); // the same report object — one execution
  });
});

describe('SCHEMA-01 · the persistence bundle', () => {
  it('plans the COMPLETE store surface, including the proactive table', async () => {
    const bundle = resolvePersistenceBundle({}, 'production');
    expect(bundle.bootstrapSchema).toBeDefined();

    const report = await bundle.bootstrapSchema?.({ dryRun: true });

    expect(report?.dryRun).toBe(true);
    // 38 stores are wired into the bundle (scheduler 5, brain 6, ecosystem 5,
    // bridge 1, audit 1, voice 1, proactive 1, control 4, commercial 1,
    // world 12, discovery 1). If a store is added without being bootstrapped,
    // this expectation must be updated deliberately — that is the point.
    expect(report?.planned).toHaveLength(38);
    expect(report?.planned).toContain('PostgresProactiveStore(proactive_recommendations)');
    expect(report?.planned.some((label) => label.startsWith('PostgresScheduleStore'))).toBe(true);
    expect(report?.planned.some((label) => label.startsWith('PostgresProblemStore'))).toBe(true);
    // Labels are UNIQUE even where two packages export the same class name
    // (the two `PostgresOpportunityStore`s are told apart by their table).
    expect(new Set(report?.planned).size).toBe(report?.planned.length);
    expect(
      report?.planned.filter((label) => label.startsWith('PostgresOpportunityStore')),
    ).toHaveLength(2);
  });

  it('never reports success when the environment suppressed DDL execution', async () => {
    // The suite runs with NODE_ENV=test: the bundle's execution list is empty,
    // so an APPLY call must say so instead of returning an empty "applied".
    const bundle = resolvePersistenceBundle({}, 'production');
    const report = await bundle.bootstrapSchema?.();

    expect(report?.dryRun).toBe(false);
    expect(report?.applied).toEqual([]);
    expect(report?.failed).toHaveLength(1);
    expect(report?.failed[0]?.label).toBe('schema-bootstrap');
    expect(report?.failed[0]?.error).toContain('NOT a success');
  });

  it('an in-memory bundle exposes no schema bootstrap at all', () => {
    const bundle = resolvePersistenceBundle({}, 'development');
    expect(bundle.bootstrapSchema).toBeUndefined();
  });
});
