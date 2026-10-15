// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider quota PROVENANCE (regression)
//
// The audit's core finding: the registry catalog ships health constants
// (quota 45 / 38 / 30 / 55 / 40, status 'healthy', latency, success counts)
// captured at CATALOG_EPOCH, and NOTHING at runtime refreshes them — the
// provider-usage ingestor is not wired into the gateway. They were nevertheless
// presented downstream as provider-reported account usage ("Provider usage ·
// 55% remaining", `source: 'PROVIDER_ACCOUNT'`).
//
// These tests pin the provenance flag that makes that impossible:
//   • catalog figures are tagged 'SEED'
//   • only an INGESTED sample (recordHealthSample with a quota) promotes a
//     quota to 'PROVIDER_REPORTED'
//   • a runtime outcome sample WITHOUT a quota never promotes it
//
// Same treatment for the health RECORD itself (status / score / latency): the
// catalog's 'healthy' is SEED data and must never read as a live check.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { createCatalogProviders } from '../provider-catalog.js';
import { Provider } from '../../domain/entities/Provider.js';

const ALL = createCatalogProviders();

/** A minimal provider carrying a catalog-shaped (SEED) health record. */
function sampleProvider(): { provider: Provider } {
  const provider = new Provider({
    id: 'sample-provider',
    family: 'openai',
    name: 'Sample',
    description: 'provenance test',
    owner: 'test',
    models: [],
    capabilities: [],
    supportedModalities: [],
    cost: { inputPerMillionTokens: 0, outputPerMillionTokens: 0, currency: 'USD', tier: 'free' },
    latency: { p50Ms: 0, p95Ms: 0 },
    rateLimits: {
      requestsPerMinute: 0,
      tokensPerMinute: 0,
      requestsPerDay: 0,
      maxConcurrentRequests: 0,
    },
    availability: 1,
    health: {
      status: 'healthy',
      healthScore: 0,
      latencyMs: 0,
      successCount: 0,
      failureCount: 0,
      quotaUsedPercent: 45,
      quotaSource: 'SEED',
      healthSource: 'SEED',
      rateLimitRemaining: 0,
      rateLimitResetAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastCheckedAt: '2026-08-03T00:00:00.000Z',
    },
    lifecycleStatus: 'active',
    version: { toString: () => '1.0.0' },
    tags: [],
    matrix: [],
  } as unknown as ConstructorParameters<typeof Provider>[0]);
  return { provider };
}

describe('catalog quota provenance', () => {
  it('tags every catalog provider quota as SEED (a constant, not a measurement)', () => {
    expect(ALL.length).toBeGreaterThan(0);
    for (const provider of ALL) {
      expect(provider.health.quotaSource, provider.id).toBe('SEED');
    }
  });

  it('carries real, non-zero seed quotas that MUST NOT be read as account usage', () => {
    // The precise values the UI used to render as "N% remaining".
    const byId = new Map(ALL.map((p) => [p.id, p.health.quotaUsedPercent]));
    expect(byId.get('openai')).toBe(45);
    expect(byId.get('anthropic')).toBe(38);
    expect(byId.get('google')).toBe(30);
    expect(byId.get('deepseek')).toBe(55);
    // Every one of them is a SEED figure (asserted above), so no consumer may
    // turn these into a quota, a remaining balance or a "% used".
  });

  it('tags every catalog health RECORD as SEED too (status/score/latency are unmeasured here)', () => {
    for (const provider of ALL) {
      expect(provider.health.healthSource, provider.id).toBe('SEED');
    }
    // The catalog also stamps `lastCheckedAt` at build time, so the timestamp is
    // NOT evidence of a check — which is exactly why the SEED tag exists.
    const openai = ALL.find((p) => p.id === 'openai');
    expect(openai?.health.status).toBe('healthy');
    expect(openai?.health.healthSource).toBe('SEED');
  });

  it('promotes the health record to MEASURED only on a RUNTIME sample', () => {
    const { provider } = sampleProvider();
    // The record as constructed (catalog data) is unproven.
    expect(provider.health.healthSource).toBe('SEED');

    provider.recordHealthSample({ ok: true, latencyMs: 10 });

    // A runtime write is the measurement: status/score/latency may now be
    // presented as checked...
    expect(provider.health.healthSource).toBe('MEASURED');
    // ...while the QUOTA keeps its own (still unproven) provenance.
    expect(provider.health.quotaSource).toBe('SEED');
  });

  it('never promotes a quota on a runtime outcome sample that carries no quota', () => {
    const provider = new Provider({
      id: 'sample-provider',
      family: 'openai',
      name: 'Sample',
      description: 'provenance test',
      owner: 'test',
      models: [],
      capabilities: [],
      supportedModalities: [],
      cost: { inputPerMillionTokens: 0, outputPerMillionTokens: 0, currency: 'USD', tier: 'free' },
      latency: { p50Ms: 0, p95Ms: 0 },
      rateLimits: {
        requestsPerMinute: 0,
        tokensPerMinute: 0,
        requestsPerDay: 0,
        maxConcurrentRequests: 0,
      },
      availability: 1,
      health: {
        status: 'healthy',
        healthScore: 0,
        latencyMs: 0,
        successCount: 0,
        failureCount: 0,
        quotaUsedPercent: 45,
        quotaSource: 'SEED',
        rateLimitRemaining: 0,
        rateLimitResetAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastCheckedAt: '2026-08-03T00:00:00.000Z',
      },
      lifecycleStatus: 'active',
      version: { toString: () => '1.0.0' },
      tags: [],
      matrix: [],
    } as unknown as ConstructorParameters<typeof Provider>[0]);

    provider.recordHealthSample({ ok: true, latencyMs: 10 });
    expect(provider.health.quotaSource).toBe('SEED');

    // ONLY an ingested, provider-reported quota promotes the provenance.
    provider.recordHealthSample({ ok: true, quotaUsedPercent: 60 });
    expect(provider.health.quotaSource).toBe('PROVIDER_REPORTED');
    expect(provider.health.quotaUsedPercent).toBe(60);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 013 — provider-reported ACCOUNT usage metrics (entity idempotency).
//
// The registry persists genuine provider responses (account tokens / cost /
// credits / bounded-quota-used) keyed by metric. These pin the storage rule:
// one slot per metric, never overwritten by an older reading, and never
// conflated with the quota percentage or with runtime tokens.
// ─────────────────────────────────────────────────────────────────────────────

describe('provider account-usage metrics (idempotent, distinct)', () => {
  function entity(): Provider {
    return sampleProvider().provider;
  }

  it('stores each account metric verbatim with source, time and window', () => {
    const provider = entity();
    provider.recordHealthSample({
      ok: true,
      accountUsage: [
        {
          provider: 'openai',
          metric: 'ACCOUNT_TOKENS',
          source: 'GET /v1/organization/usage/completions',
          retrievedAt: '2026-08-15T12:00:00.000Z',
          window: { startEpochSec: 1_754_006_400, endEpochSec: 1_755_158_400 },
          value: 1500,
          unit: 'tokens',
        },
        {
          provider: 'openai',
          metric: 'ACCOUNT_COST',
          source: 'GET /v1/organization/costs',
          retrievedAt: '2026-08-15T12:00:00.000Z',
          window: { startEpochSec: 1_754_006_400, endEpochSec: 1_755_158_400 },
          value: 12.34,
          unit: 'usd',
        },
      ],
    });

    const metrics = provider.health.accountUsage;
    expect(metrics?.ACCOUNT_TOKENS?.value).toBe(1500);
    expect(metrics?.ACCOUNT_TOKENS?.source).toContain('usage');
    expect(metrics?.ACCOUNT_COST?.value).toBe(12.34);
    // Distinct from the quota — the seed quota/provenance are untouched.
    expect(provider.health.quotaUsedPercent).toBe(45);
    expect(provider.health.quotaSource).toBe('SEED');
  });

  it('keeps ONE slot per metric (re-ingest does not duplicate)', () => {
    const provider = entity();
    const metric = {
      provider: 'openai',
      metric: 'ACCOUNT_COST' as const,
      source: 'GET /v1/organization/costs',
      retrievedAt: '2026-08-15T12:00:00.000Z',
      value: 5,
      unit: 'usd' as const,
    };
    provider.recordHealthSample({ ok: true, accountUsage: [metric] });
    provider.recordHealthSample({ ok: true, accountUsage: [metric] });
    expect(Object.keys(provider.health.accountUsage ?? {})).toEqual(['ACCOUNT_COST']);
  });

  it('refuses a STALE reading (older retrievedAt) so a newer value survives', () => {
    const provider = entity();
    provider.recordHealthSample({
      ok: true,
      accountUsage: [
        {
          provider: 'openai',
          metric: 'ACCOUNT_TOKENS',
          source: 'GET /v1/organization/usage/completions',
          retrievedAt: '2026-08-15T12:00:00.000Z',
          value: 1000,
          unit: 'tokens',
        },
      ],
    });
    provider.recordHealthSample({
      ok: true,
      accountUsage: [
        {
          provider: 'openai',
          metric: 'ACCOUNT_TOKENS',
          source: 'GET /v1/organization/usage/completions',
          retrievedAt: '2026-08-01T00:00:00.000Z',
          value: 9,
          unit: 'tokens',
        },
      ],
    });
    expect(provider.health.accountUsage?.ACCOUNT_TOKENS?.value).toBe(1000);
    expect(provider.health.accountUsage?.ACCOUNT_TOKENS?.retrievedAt).toBe(
      '2026-08-15T12:00:00.000Z',
    );
  });

  it('accepts a NEWER reading (fresher ingestion wins)', () => {
    const provider = entity();
    provider.recordHealthSample({
      ok: true,
      accountUsage: [
        {
          provider: 'openai',
          metric: 'ACCOUNT_TOKENS',
          source: 'GET /v1/organization/usage/completions',
          retrievedAt: '2026-08-01T00:00:00.000Z',
          value: 10,
          unit: 'tokens',
        },
      ],
    });
    provider.recordHealthSample({
      ok: true,
      accountUsage: [
        {
          provider: 'openai',
          metric: 'ACCOUNT_TOKENS',
          source: 'GET /v1/organization/usage/completions',
          retrievedAt: '2026-08-15T12:00:00.000Z',
          value: 2000,
          unit: 'tokens',
        },
      ],
    });
    expect(provider.health.accountUsage?.ACCOUNT_TOKENS?.value).toBe(2000);
  });

  it('ignores a metric reported for a DIFFERENT family (no cross-provider leak)', () => {
    const provider = entity(); // family: openai
    provider.recordHealthSample({
      ok: true,
      accountUsage: [
        {
          provider: 'anthropic',
          metric: 'ACCOUNT_COST',
          source: 'GET /v1/organizations/cost_report',
          retrievedAt: '2026-08-15T12:00:00.000Z',
          value: 99,
          unit: 'usd',
        },
      ],
    });
    expect(provider.health.accountUsage).toBeUndefined();
  });
});
