// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — providers.getUsageIngestStatus (in-product ingest visibility)
//
// The provider-account usage endpoints are reached by the gateway's scheduled
// ingest pass. Without a status read, a row that says "Unavailable from
// provider" cannot be explained: is nothing scheduled, is there no usage
// endpoint for that provider, is no credential configured, or did the probe
// fail? This procedure answers that, and it must never invent a pass that did
// not happen.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import type { ProviderApplicationService } from '@vedmoulya/providers';
import { createProvidersRouter } from '../routers/ProvidersRouter.js';
import type { ProviderUsageIngestStatus } from '../services/ProviderUsageIngestor.js';

const CTX = {} as never;

function svc(): ProviderApplicationService {
  return {} as ProviderApplicationService;
}

const REPORT: ProviderUsageIngestStatus = {
  scheduleEnabled: true,
  scheduleIntervalMs: 600_000,
  lastRunAt: '2026-10-12T10:00:00.000Z',
  entries: [
    {
      providerId: 'openai',
      family: 'openai',
      outcome: 'QUOTA_WRITTEN',
      detail: '80% of the hard limit',
    },
    { providerId: 'google', family: 'google', outcome: 'NO_PROBE', detail: 'no usage endpoint' },
    {
      providerId: 'deepseek',
      family: 'deepseek',
      outcome: 'PROBE_FAILED',
      detail: 'balance endpoint down',
    },
  ],
  quotaSamplesWritten: 1,
  checkedSamplesWritten: 0,
};

describe('providers.getUsageIngestStatus', () => {
  it('reports the schedule and the real per-family outcomes verbatim', async () => {
    const router = createProvidersRouter(svc(), undefined, undefined, undefined, undefined, {
      status: () => REPORT,
    });
    const response = await router.getUsageIngestStatus({ userId: 'u1' }, CTX);

    expect(response.success).toBe(true);
    expect(response.data).toMatchObject({
      scheduleEnabled: true,
      scheduleIntervalMs: 600_000,
      lastRunAt: '2026-10-12T10:00:00.000Z',
      quotaSamplesWritten: 1,
    });
    const entries = (response.data as { entries: Array<{ outcome: string }> }).entries;
    expect(entries.map((e) => e.outcome)).toEqual(['QUOTA_WRITTEN', 'NO_PROBE', 'PROBE_FAILED']);
  });

  it('without a wired source it reports "not scheduled, never ran" (no fabricated pass)', async () => {
    const router = createProvidersRouter(svc());
    const response = await router.getUsageIngestStatus({ userId: 'u1' }, CTX);

    expect(response.success).toBe(true);
    expect(response.data).toEqual({
      scheduleEnabled: false,
      entries: [],
      quotaSamplesWritten: 0,
      checkedSamplesWritten: 0,
    });
  });
});
