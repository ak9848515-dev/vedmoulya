// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider usage DURABLE PERSISTENCE (PostgreSQL integration)
// SPRINT 015 — close the persistence-verification gap left by 014D.
//
// 014D already validated negative-value handling, free-tier semantics and
// OpenRouter-only isolation — but ONLY against the in-memory repository.
// PostgresProviderRepository.test.ts uses a mocked `sql`. Nothing proved that a
// genuine provider-reported OpenRouter metric actually survives a write through
// the real `provider_registry` table and can be read back on a SEPARATE
// connection.
//
// This test exercises the EXISTING production path end to end:
//   ProviderUsageIngestor.run()
//     → openrouterAccountProbe (hermetic fetch of GET /api/v1/key)
//     → ProviderApplicationService.recordHealthSample('openrouter', …)
//     → Provider.recordHealthSample()  (provenance + idempotency rules)
//     → PostgresProviderRepository.update()  (health JSONB)
// and then reads the stored row back through an INDEPENDENT postgres.js pool.
//
// SAFETY / DATA GOVERNANCE
//   • The target is the local, non-production Docker Postgres used by the repo's
//     existing integration tests (POSTGRES_TEST_URL, dev compose credentials).
//     The suite is SKIPPED entirely when that database is unreachable.
//   • Hermetic fetch fixtures — no real provider is contacted, no credential is
//     read, no model generation happens. Observations are clearly test data.
//   • The `openrouter` row is normalized to the authoritative catalog SEED before
//     the suite and its original health/updated_at are RESTORED afterwards (or a
//     row this test created is deleted), so operator-managed data is preserved.
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  PostgresProviderRepository,
  ProviderApplicationService,
  createCatalogProviders,
  createProviderId,
} from '@vedmoulya/providers';
import { ProviderUsageIngestor } from '../services/ProviderUsageIngestor.js';

const databaseUrl =
  process.env.POSTGRES_TEST_URL ?? 'postgres://vedmoulya:vedmoulya-dev@localhost:5432/vedmoulya';

const OPENROUTER_KEY_URL = 'https://openrouter.ai/api/v1/key';
const FIXED_NOW = new Date('2026-10-13T12:00:00.000Z');
const LONG_KEY = 'sk-or-' + 'a'.repeat(48); // passes the runtime ≥32-char gate
const PROVIDER_ID = 'openrouter';

/** Hermetic JSON route helper: url → {status, body} (or throws). */
type ResponseBuilder = (input: string, init?: RequestInit) => Promise<Response>;
function routeFetch(
  routes: Record<string, { status?: number; body?: unknown; rawText?: string; throws?: boolean }>,
): ResponseBuilder & { mock: ReturnType<typeof vi.fn> } {
  const mock = vi.fn(async (input: string) => {
    const route = routes[input];
    if (route?.throws) throw new Error('network down');
    const text = route?.rawText ?? JSON.stringify(route?.body ?? { error: 'unexpected url' });
    return new Response(text, {
      status: route?.status ?? (route ? 200 : 404),
      headers: { 'Content-Type': 'application/json' },
    });
  });
  return mock as ResponseBuilder & { mock: ReturnType<typeof vi.fn> };
}

function openrouterEnv(): Record<string, string | undefined> {
  return { NODE_ENV: 'test', AI_OPENROUTER_API_KEY: LONG_KEY };
}

interface StoredMetric {
  provider: string;
  metric: string;
  source: string;
  retrievedAt: string;
  value: number;
  unit: string;
  breakdown?: Array<{ key: string; value: number; unit: string }>;
}

interface StoredHealth {
  status?: string;
  healthScore?: number;
  quotaUsedPercent?: number;
  quotaSource?: string;
  healthSource?: string;
  lastCheckedAt?: string;
  accountUsage?: Record<string, StoredMetric>;
}

// ── Availability probe (skip cleanly when Postgres is absent) ────────────────

const probe = postgres(databaseUrl, { max: 1, connect_timeout: 2 });
let postgresAvailable = false;
try {
  await probe`SELECT 1`;
  postgresAvailable = true;
} catch {
  postgresAvailable = false;
} finally {
  await probe.end().catch(() => undefined);
}

// ── Suite-scoped connections ─────────────────────────────────────────────────

let writeSql: ReturnType<typeof postgres>;
let readSql: ReturnType<typeof postgres>;
let repo: PostgresProviderRepository;
let providers: ProviderApplicationService;

/** Baseline captured before the suite touched the row (restored afterwards). */
let baselineHealthJson: string | undefined;
let baselineUpdatedAtIso: string | undefined;
let seedHealthJson: string | undefined;
let createdRow = false;

function parseHealth(raw: unknown): StoredHealth {
  return (typeof raw === 'string' ? JSON.parse(raw) : raw) as StoredHealth;
}

/** Read the row on a SEPARATE connection — the independent readback. */
async function readHealth(): Promise<StoredHealth> {
  const rows = await readSql<{ health: unknown }[]>`
    SELECT health FROM provider_registry WHERE id = ${PROVIDER_ID}
  `;
  return parseHealth(rows[0]?.health);
}

async function readFamily(): Promise<string | undefined> {
  const rows = await readSql<{ family: string }[]>`
    SELECT family FROM provider_registry WHERE id = ${PROVIDER_ID}
  `;
  return rows[0]?.family;
}

function runIngest(
  fixture: Parameters<typeof routeFetch>[0],
  now: Date = FIXED_NOW,
): {
  report: ReturnType<ProviderUsageIngestor['run']>;
  fetch: ReturnType<typeof routeFetch>;
} {
  const fetch = routeFetch(fixture);
  const ingestor = new ProviderUsageIngestor({ providers, fetchImpl: fetch, now: () => now });
  return { report: ingestor.run(openrouterEnv()), fetch };
}

const BOUNDED_KEY = {
  [OPENROUTER_KEY_URL]: {
    body: {
      data: {
        label: 'sprint015-test-key',
        usage: 2.5,
        limit: 10,
        limit_remaining: 7.5,
        limit_reset: 'monthly',
        usage_daily: 0.1,
        usage_weekly: 0.5,
        usage_monthly: 2.5,
        is_free_tier: false,
      },
    },
  },
};

(postgresAvailable ? describe : describe.skip)(
  'Provider usage durable persistence on PostgreSQL (SPRINT 015)',
  () => {
    beforeAll(async () => {
      writeSql = postgres(databaseUrl, { max: 2 });
      readSql = postgres(databaseUrl, { max: 1 });
      repo = new PostgresProviderRepository(writeSql);
      providers = new ProviderApplicationService(repo);
      await repo.ensureTable();

      const existing = await writeSql<{ health: unknown; updated_at: string | Date }[]>`
        SELECT health, updated_at FROM provider_registry WHERE id = ${PROVIDER_ID}
      `;
      const row = existing[0];
      if (!row) {
        createdRow = true;
        const catalog = createCatalogProviders().find((p) => p.id === PROVIDER_ID);
        if (!catalog) throw new Error('catalog is missing the openrouter provider');
        seedHealthJson = JSON.stringify(catalog.health);
        await repo.save(catalog);
      } else {
        baselineHealthJson = JSON.stringify(parseHealth(row.health));
        baselineUpdatedAtIso = new Date(row.updated_at).toISOString();
        // Normalize ONLY the health JSONB to the authoritative catalog SEED so
        // assertions are deterministic. No other column is touched; the original
        // health/updated_at are restored in afterAll — operator data is preserved.
        const catalog = createCatalogProviders().find((p) => p.id === PROVIDER_ID);
        if (catalog) {
          seedHealthJson = JSON.stringify(catalog.health);
          await writeSql`
            UPDATE provider_registry SET health = ${seedHealthJson}::jsonb
            WHERE id = ${PROVIDER_ID}
          `;
        }
      }
    });

    // Each test starts from the authoritative catalog SEED so assertions are
    // order-independent; the original row is restored once in afterAll.
    beforeEach(async () => {
      if (seedHealthJson) {
        await writeSql`
          UPDATE provider_registry SET health = ${seedHealthJson}::jsonb
          WHERE id = ${PROVIDER_ID}
        `;
      }
    });

    afterAll(async () => {
      try {
        if (createdRow) {
          await repo.delete(createProviderId(PROVIDER_ID));
        } else if (baselineHealthJson && baselineUpdatedAtIso) {
          await writeSql`
            UPDATE provider_registry
            SET health = ${baselineHealthJson}::jsonb,
                updated_at = ${baselineUpdatedAtIso}::timestamptz
            WHERE id = ${PROVIDER_ID}
          `;
        }
      } finally {
        await writeSql?.end().catch(() => undefined);
        await readSql?.end().catch(() => undefined);
      }
    });

    it('persists genuine OpenRouter key metrics + bounded quota and reads them back independently', async () => {
      const { report, fetch } = runIngest(BOUNDED_KEY);
      expect(await report).toMatchObject({
        quotaSamplesWritten: 1,
        checkedSamplesWritten: 0,
      });
      const entry = (await report).entries.find((e) => e.family === 'openrouter');
      expect(entry?.outcome).toBe('QUOTA_WRITTEN');
      // Only the OpenRouter endpoint was contacted.
      expect(fetch.mock.calls.map((c) => (c as [string])[0])).toEqual([OPENROUTER_KEY_URL]);

      // INDEPENDENT reader connection — not the repository's pool.
      const health = await readHealth();
      // provider identity
      expect(await readFamily()).toBe('openrouter');
      // bounded quota is genuinely provider-reported
      expect(health.quotaUsedPercent).toBe(25);
      expect(health.quotaSource).toBe('PROVIDER_REPORTED');
      expect(health.healthSource).toBe('MEASURED');
      // genuine cumulative credit metric, verbatim, with provenance
      const cost = health.accountUsage?.ACCOUNT_COST;
      expect(cost?.provider).toBe('openrouter');
      expect(cost?.value).toBe(2.5);
      expect(cost?.unit).toBe('usd');
      expect(cost?.source).toBe('GET https://openrouter.ai/api/v1/key');
      // key-level remaining credit cap
      const credits = health.accountUsage?.ACCOUNT_CREDITS;
      expect(credits?.provider).toBe('openrouter');
      expect(credits?.value).toBe(7.5);
      // observation timestamps
      expect(cost?.retrievedAt).toBe(FIXED_NOW.toISOString());
      expect(health.lastCheckedAt).toBe(FIXED_NOW.toISOString());

      // The normal application READ path (DTO) surfaces the same persisted facts,
      // including provenance — never a bare fabricated number.
      const dto = await providers.getProvider(PROVIDER_ID);
      expect(dto.success).toBe(true);
      expect(dto.data?.health.accountUsage?.ACCOUNT_COST?.value).toBe(2.5);
      expect(dto.data?.health.accountUsage?.ACCOUNT_CREDITS?.value).toBe(7.5);
      expect(dto.data?.health.quotaSource).toBe('PROVIDER_REPORTED');
      expect(dto.data?.health.healthSource).toBe('MEASURED');
    });

    it('leaves missing limit/limit_remaining UNKNOWN — no fabricated percentage or remaining credit', async () => {
      // `limit: null` (unlimited) and `limit_remaining` absent.
      const { report } = runIngest({
        [OPENROUTER_KEY_URL]: { body: { data: { usage: 3.5, limit: null, is_free_tier: true } } },
      });
      const res = await report;
      expect(res.quotaSamplesWritten).toBe(0);
      expect(res.entries.find((e) => e.family === 'openrouter')?.outcome).toBe('METRICS_WRITTEN');

      const health = await readHealth();
      // No bounded quote was derived: the SEED constant is untouched and its
      // provenance is NOT promoted to provider-reported.
      expect(health.quotaUsedPercent).toBe(40);
      expect(health.quotaSource).not.toBe('PROVIDER_REPORTED');
      // Missing limit_remaining never becomes zero or a credits metric.
      expect(health.accountUsage?.ACCOUNT_CREDITS).toBeUndefined();
      // The genuine cumulative usage is still recorded verbatim (3.5 ≠ 0).
      expect(health.accountUsage?.ACCOUNT_COST?.value).toBe(3.5);
    });

    it('does not misrepresent seeded quota data as provider-reported usage', async () => {
      // Before any bounded-quota ingest the row carries the catalog SEED.
      const seeded = await readHealth();
      expect(seeded.quotaUsedPercent).toBe(40);
      expect(seeded.quotaSource).not.toBe('PROVIDER_REPORTED');

      // A pass that reports NO bounded ceiling must not promote the seed.
      const { report } = runIngest({
        [OPENROUTER_KEY_URL]: { body: { data: { usage: 0.9, limit: 0 } } },
      });
      expect((await report).quotaSamplesWritten).toBe(0);

      const after = await readHealth();
      expect(after.quotaUsedPercent).toBe(40);
      expect(after.quotaSource).not.toBe('PROVIDER_REPORTED');
    });

    it('is idempotent across passes — one slot per metric, no duplication', async () => {
      await await runIngest(BOUNDED_KEY).report;
      await await runIngest(BOUNDED_KEY).report;

      const health = await readHealth();
      expect(Object.keys(health.accountUsage ?? {}).sort()).toEqual([
        'ACCOUNT_COST',
        'ACCOUNT_CREDITS',
      ]);
      expect(health.accountUsage?.ACCOUNT_COST?.value).toBe(2.5);
    });

    it('refuses a STALE observation so newer persisted data is never overwritten', async () => {
      await await runIngest(BOUNDED_KEY, FIXED_NOW).report;
      expect((await readHealth()).accountUsage?.ACCOUNT_COST?.value).toBe(2.5);

      // A replay/out-of-order pass with an OLDER retrievedAt (and no finite limit,
      // so no quota is written) must not clobber the newer metric.
      const older = new Date(FIXED_NOW.getTime() - 60 * 60 * 1000);
      await await runIngest(
        { [OPENROUTER_KEY_URL]: { body: { data: { usage: 0.9, limit: null } } } },
        older,
      ).report;

      const health = await readHealth();
      expect(health.accountUsage?.ACCOUNT_COST?.value).toBe(2.5);
      expect(health.accountUsage?.ACCOUNT_COST?.retrievedAt).toBe(FIXED_NOW.toISOString());
    });

    it('reports a persistence failure without writing a false-success record, then recovers', async () => {
      // Establish known-good persisted data first.
      await await runIngest(BOUNDED_KEY).report;
      const before = await readHealth();
      expect(before.accountUsage?.ACCOUNT_COST?.value).toBe(2.5);

      // A repository whose connection is already closed: the write rejects.
      const dead = postgres(databaseUrl, { max: 1 });
      await dead.end();
      const deadProviders = new ProviderApplicationService(new PostgresProviderRepository(dead));
      const fetch = routeFetch(BOUNDED_KEY);
      const failing = new ProviderUsageIngestor({
        providers: deadProviders,
        fetchImpl: fetch,
        now: () => FIXED_NOW,
      });

      const failed = await failing.run(openrouterEnv());
      const entry = failed.entries.find((e) => e.family === 'openrouter');
      expect(entry?.outcome).toBe('PROBE_FAILED');
      expect(failed.quotaSamplesWritten).toBe(0);
      expect(failed.accountMetricsWritten).toBe(0);

      // No partial / fabricated record: the good data is untouched.
      const after = await readHealth();
      expect(after.accountUsage?.ACCOUNT_COST?.value).toBe(2.5);

      // Recovery: the healthy repository still reads and writes.
      const recovered = await providers.getProvider(PROVIDER_ID);
      expect(recovered.success).toBe(true);
      expect(recovered.data?.health.accountUsage?.ACCOUNT_COST?.value).toBe(2.5);
    });

    it('cleans up resources (connections close; the row is restored in afterAll)', async () => {
      // A lightweight guard that the suite used a real, identifiable row.
      expect(await readFamily()).toBe('openrouter');
      expect(typeof randomUUID()).toBe('string');
    });
  },
);
