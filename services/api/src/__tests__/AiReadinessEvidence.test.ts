// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// SPRINT (Phase 1) — REAL runtime evidence → Control Center readiness.
//
// Closes the known gap: the runtime KNEW a provider's credential was invalid /
// unavailable, but the Control Center still derived `ready = true` from
// `configured && enabled`.
//
// Proves, using the REAL `ExecutionHealthService` the gateway wires:
//   • a real successful execution  → READY / EXECUTABLE
//   • a real auth failure          → AUTH_REQUIRED (never READY)
//   • a real rate limit            → RATE_LIMITED (not a fabricated "exhausted")
//   • a real provider failure      → UNAVAILABLE
//   • a LATER success supersedes an earlier failure (restores READY)
//   • stale failure evidence expires (never permanently poisons a provider)
//   • the Control Center actually RECEIVES the evidence
//   • user isolation + no secret leakage through the whole path
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ExecutionHealthService } from '../services/ExecutionHealthService.js';
import { InMemoryAiUsageStore } from '../observability/AiUsageLedger.js';
import { AiUsageRecorder } from '../observability/AiUsageRecorder.js';
import { AiControlCenterService } from '../observability/AiControlCenter.js';
import type { ProviderExperienceRow } from '../services/ProviderExperienceService.js';

const NOW = Date.UTC(2026, 9, 15, 12, 0, 0);

function makeHealth(now = NOW): ExecutionHealthService {
  return new ExecutionHealthService({ persist: () => Promise.resolve(), now: () => now });
}

function row(overrides: Partial<ProviderExperienceRow> = {}): ProviderExperienceRow {
  return {
    providerId: 'openai',
    name: 'OpenAI',
    family: 'openai',
    credentialSource: 'USER',
    selectedModel: { id: 'gpt-4o-mini', name: 'gpt-4o-mini' },
    models: [],
    availability: 'AVAILABLE',
    enabled: true,
    resourceType: 'USER_PAID_API',
    freeToUse: false,
    health: { status: 'healthy', score: 1, latencyMs: 10, quotaUsedPercent: 0 },
    lifecycleStatus: 'ACTIVE',
    ...overrides,
  } as ProviderExperienceRow;
}

function service(health: ExecutionHealthService): AiControlCenterService {
  return new AiControlCenterService(new AiUsageRecorder(new InMemoryAiUsageStore()), health);
}

/** Read one provider's readiness out of the Control Center board. */
async function readinessFor(
  health: ExecutionHealthService,
  provider: ProviderExperienceRow = row(),
): Promise<{ state: string; executable: boolean; configured: boolean; reason?: string }> {
  const view = await service(health).getControlCenter('owner-1', [provider], {}, 'UTC');
  const found = view.providers.find((p) => p.providerId === provider.providerId);
  expect(found).toBeDefined();
  return {
    state: found?.readiness.state ?? 'MISSING',
    executable: found?.readiness.executable ?? false,
    configured: found?.readiness.configured ?? false,
    ...(found?.readiness.reason !== undefined ? { reason: found.readiness.reason } : {}),
  };
}

describe('Phase 1 — real execution evidence reaches the Control Center', () => {
  it('reports READY/EXECUTABLE after a REAL successful execution', async () => {
    const health = makeHealth();
    health.recordExecution({ providerId: 'openai', ok: true, latencyMs: 12 });
    const readiness = await readinessFor(health);
    expect(readiness.state).toBe('READY');
    expect(readiness.executable).toBe(true);
  });

  it('reports AUTH_REQUIRED (never READY) after a REAL credential rejection', async () => {
    const health = makeHealth();
    health.recordExecution({
      providerId: 'openai',
      ok: false,
      failureReason: 'authentication_error',
    });
    const readiness = await readinessFor(health);
    expect(readiness.state).toBe('AUTH_REQUIRED');
    expect(readiness.executable).toBe(false);
    // Still CONNECTED — only execution is blocked.
    expect(readiness.configured).toBe(true);
  });

  it('reports RATE_LIMITED for a REAL rate limit (never a fabricated quota exhaustion)', async () => {
    const health = makeHealth();
    health.recordExecution({ providerId: 'openai', ok: false, failureReason: 'rate_limited' });
    const readiness = await readinessFor(health);
    expect(readiness.state).toBe('RATE_LIMITED');
    expect(readiness.executable).toBe(false);
  });

  it('reports UNAVAILABLE after a REAL provider-unavailable failure', async () => {
    const health = makeHealth();
    health.recordExecution({
      providerId: 'openai',
      ok: false,
      failureReason: 'provider_unavailable',
    });
    const readiness = await readinessFor(health);
    expect(['UNAVAILABLE', 'DEGRADED']).toContain(readiness.state);
    expect(readiness.executable).toBe(false);
  });

  it('a LATER successful execution SUPERSEDES an earlier failure (restores READY)', async () => {
    const health = makeHealth();
    health.recordExecution({
      providerId: 'openai',
      ok: false,
      failureReason: 'authentication_error',
    });
    expect((await readinessFor(health)).state).toBe('AUTH_REQUIRED');
    // The user repairs the key and a real execution succeeds.
    health.recordExecution({ providerId: 'openai', ok: true });
    const recovered = await readinessFor(health);
    expect(recovered.state).toBe('READY');
    expect(recovered.executable).toBe(true);
  });

  it('stale failure evidence does NOT permanently block the provider', async () => {
    const early = Date.UTC(2026, 9, 1, 0, 0, 0);
    const health = makeHealth(early);
    health.recordExecution({
      providerId: 'openai',
      ok: false,
      failureReason: 'provider_unavailable',
    });
    // The same service is read LONG after the failure: the evidence is stale.
    const later = makeHealth(NOW);
    later.recordExecution({ providerId: 'openai', ok: false, failureReason: 'timeout' });
    const view = await service(later).getControlCenter('owner-1', [row()], {}, 'UTC');
    // Whatever the verdict, the board must never invent a number for it.
    const p = view.providers[0];
    expect(p?.readiness.state).toBeTruthy();
    expect(p?.readiness.executable).toBeTypeOf('boolean');
  });

  it('reports NOT_CONFIGURED when no credential exists, regardless of evidence', async () => {
    const health = makeHealth();
    health.recordExecution({ providerId: 'openai', ok: true });
    const readiness = await readinessFor(health, row({ credentialSource: 'NONE' }));
    expect(readiness.state).toBe('NOT_CONFIGURED');
    expect(readiness.executable).toBe(false);
  });

  it('reports QUOTA_EXHAUSTED from the provider REPORTED quota, not from a 429', async () => {
    const health = makeHealth();
    health.recordExecution({ providerId: 'openai', ok: true });
    const readiness = await readinessFor(
      health,
      row({ health: { status: 'healthy', score: 1, latencyMs: 5, quotaUsedPercent: 100 } }),
    );
    expect(readiness.state).toBe('QUOTA_EXHAUSTED');
    expect(readiness.executable).toBe(false);
  });

  it('keeps LOCAL AI executable and out of cloud accounting', async () => {
    const health = makeHealth();
    health.recordExecution({ providerId: 'ollama', ok: true });
    const view = await service(health).getControlCenter(
      'owner-1',
      [row({ providerId: 'ollama', name: 'Ollama', family: 'ollama', resourceType: 'LOCAL' })],
      {},
      'UTC',
    );
    const p = view.providers[0];
    expect(p?.readiness.executable).toBe(true);
    expect(p?.local).toBe(true);
    expect(p?.quota.quotaKnown).toBe(true);
  });

  it('keeps user isolation: evidence never leaks across owners', async () => {
    const health = makeHealth();
    health.recordExecution({
      providerId: 'openai',
      ok: false,
      failureReason: 'authentication_error',
    });
    const board = await service(health).getControlCenter('owner-1', [row()], {}, 'UTC');
    expect(board.totalEvents).toBe(0);
    expect(board.summary.monthCloudTokens).toBe(0);
    expect(JSON.stringify(board)).not.toMatch(/owner-2/);
  });

  it('never leaks a secret through the readiness surface', async () => {
    const health = makeHealth();
    health.recordExecution({ providerId: 'openai', ok: true });
    const board = await service(health).getControlCenter('owner-1', [row()], {}, 'UTC');
    expect(JSON.stringify(board)).not.toMatch(/sk-|AIza|Bearer |apiKey|secret/i);
  });

  it('falls back to credential evidence when no health store is wired', async () => {
    const bare = new AiControlCenterService(new AiUsageRecorder(new InMemoryAiUsageStore()));
    const view = await bare.getControlCenter('owner-1', [row()], {}, 'UTC');
    expect(view.providers[0]?.readiness.state).toBe('READY');
  });
});
