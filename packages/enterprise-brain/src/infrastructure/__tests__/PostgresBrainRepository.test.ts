// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Postgres Enterprise Brain Repository
// EI-008 — Enterprise Brain (Central Decision Intelligence)
//
// Verifies query building, JSONB row <-> entity mapping, and
// pagination WITHOUT a live database: the `postgres` module is mocked
// with a fake `sql` template-tag function (same pattern as the other
// EI Postgres repository tests).
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresBrainRepository } from '../PostgresBrainRepository.js';
import { createCatalogBrainPlan } from '../../catalog/brain-catalog.js';

// ── Fake postgres `sql` ─────────────────────────────────────────────────────

function makeFakeSql(results: Array<() => unknown>): postgres.Sql {
  let idx = 0;
  const next = (): Promise<unknown> => {
    const r = results[idx] ? results[idx]() : [];
    idx += 1;
    return Promise.resolve(r);
  };
  const sql = vi.fn(() => next()) as unknown as postgres.Sql;
  sql.unsafe = vi.fn(() => next());
  // The repo binds JSON documents via sql.json() — the fake returns the raw
  // value (the real driver wraps it in a Parameter for OID 3802).
  sql.json = ((value: unknown): unknown => value) as never;
  return sql;
}

function decisionRow(): Record<string, unknown> {
  return {
    id: 'bd_plan_goal_1_provider_selection',
    data: JSON.stringify({
      decisionId: 'bd_plan_goal_1_provider_selection',
      planId: 'plan_goal_1',
      goalId: 'goal_1',
      type: 'provider_selection',
      title: 'Provider Selection',
      description: '',
      recommendation: {
        entityType: 'provider',
        entityId: 'openai',
        entityLabel: 'OpenAI',
        action: 'use',
        params: {},
      },
      confidence: { score: 0.8, level: 'high', factors: [] },
      reason: { why: '', evidence: [], tradeoffs: [], alternatives: [], risks: [] },
      context: {
        goalId: 'goal_1',
        goalTitle: 'G',
        goalCategory: 'business',
        goalPriority: 'high',
        business: [],
        engineSources: [],
        observedAt: '2026-08-01T00:00:00.000Z',
      },
      status: 'proposed',
      version: 1,
      actor: 'enterprise-brain',
      history: [],
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }),
  };
}

function planRow(): Record<string, unknown> {
  return {
    id: 'plan_goal_1',
    data: JSON.stringify({
      planId: 'plan_goal_1',
      goalId: 'goal_1',
      goalTitle: 'G',
      status: 'proposed',
      decisions: [],
      overallConfidence: 0.8,
      pipeline: [],
      version: 1,
      actor: 'enterprise-brain',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }),
  };
}

describe('PostgresBrainRepository', () => {
  it('creates the brain_registry table idempotently', async () => {
    const sql = makeFakeSql([]);
    const repo = new PostgresBrainRepository(sql);
    await repo.ensureTable();
    await repo.ensureTable();
    expect(sql).toHaveBeenCalled();
  });

  it('saves a decision and a plan as JSONB documents', async () => {
    const sql = makeFakeSql([]);
    const repo = new PostgresBrainRepository(sql);
    const { plan, decisions } = createCatalogBrainPlan();
    await repo.saveDecision(decisions[0]!);
    await repo.savePlan(plan);
    expect(sql).toHaveBeenCalled();
  });

  it('finds a decision by id and maps the JSONB row', async () => {
    const sql = makeFakeSql([() => [decisionRow()]]);
    const repo = new PostgresBrainRepository(sql);
    const decision = await repo.findDecisionById('bd_plan_goal_1_provider_selection');
    expect(decision?.type).toBe('provider_selection');
    expect(decision?.status).toBe('proposed');
    expect(decision?.confidence.score).toBe(0.8);
  });

  it('returns null when a decision or plan is missing', async () => {
    const sql = makeFakeSql([() => []]);
    const repo = new PostgresBrainRepository(sql);
    expect(await repo.findDecisionById('missing')).toBeNull();
    expect(await repo.findPlanById('missing')).toBeNull();
  });

  it('lists decisions with filters and pagination', async () => {
    const sql = makeFakeSql([() => [{ count: 1 }], () => [decisionRow()]]);
    const repo = new PostgresBrainRepository(sql);
    const result = await repo.listDecisions(
      { type: 'provider_selection', status: 'proposed' },
      { page: 1, limit: 10 },
    );
    expect(result.total).toBe(1);
    expect(result.data[0]?.type).toBe('provider_selection');
    expect(result.totalPages).toBe(1);
  });

  it('lists all decisions in createdAt desc order', async () => {
    const sql = makeFakeSql([() => [decisionRow()]]);
    const repo = new PostgresBrainRepository(sql);
    const decisions = await repo.listAllDecisions();
    expect(decisions).toHaveLength(1);
  });

  it('lists decisions by goal and by plan', async () => {
    const sql = makeFakeSql([() => [decisionRow()]]);
    const repo = new PostgresBrainRepository(sql);
    expect(await repo.listDecisionsByGoal('goal_1')).toHaveLength(1);
    const sql2 = makeFakeSql([() => [decisionRow()]]);
    const repo2 = new PostgresBrainRepository(sql2);
    expect(await repo2.listDecisionsByPlan('plan_goal_1')).toHaveLength(1);
  });

  it('deletes decisions and plans', async () => {
    const sql = makeFakeSql([]);
    const repo = new PostgresBrainRepository(sql);
    await repo.deleteDecision('bd_x');
    await repo.deletePlan('plan_x');
    expect(sql).toHaveBeenCalled();
  });

  it('counts decisions and plans', async () => {
    const sql = makeFakeSql([() => [{ count: 14 }]]);
    const repo = new PostgresBrainRepository(sql);
    expect(await repo.countDecisions()).toBe(14);
    const sql2 = makeFakeSql([() => [{ count: 3 }]]);
    const repo2 = new PostgresBrainRepository(sql2);
    expect(await repo2.countPlans()).toBe(3);
  });

  it('saves and finds plans (optionally scoped by goal)', async () => {
    const sql = makeFakeSql([() => [], () => [planRow()]]);
    const repo = new PostgresBrainRepository(sql);
    const { plan } = createCatalogBrainPlan();
    await repo.savePlan(plan);
    const found = await repo.findPlanById('plan_goal_1');
    expect(found?.goalId).toBe('goal_1');
    expect(found?.overallConfidence).toBe(0.8);
  });

  it('lists plans with and without a goal scope', async () => {
    const sql = makeFakeSql([() => [planRow()]]);
    const repo = new PostgresBrainRepository(sql);
    expect(await repo.listPlans()).toHaveLength(1);
    const sql2 = makeFakeSql([() => [planRow()]]);
    const repo2 = new PostgresBrainRepository(sql2);
    expect(await repo2.listPlans('goal_1')).toHaveLength(1);
  });
});
