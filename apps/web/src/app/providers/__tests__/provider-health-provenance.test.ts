// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — provider health provenance (UI)
//
// The registry catalog ships a health RECORD (status 'healthy', score 0.97,
// latency 920 ms) captured from provider documentation, and the catalog stamps
// `lastCheckedAt` with its own build time. Rendering that as a green
// "healthy · 97% health · last checked <build time>" presents a provider that
// was never checked as if it had just been verified.
//
// These tests pin the provenance treatment: a SEED record is an ESTIMATE (never
// a live check, never a check timestamp), and only a MEASURED record may be
// presented as checked.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { providerHealthDisplay } from '../provider-health-provenance.js';

describe('providerHealthDisplay — a seeded health record is never a live check', () => {
  it('labels a SEED record as a catalog estimate and shows NO check time', () => {
    const display = providerHealthDisplay({
      status: 'healthy',
      healthScore: 0.97,
      latencyMs: 920,
      healthSource: 'SEED',
      // The catalog stamps the build time here; it is NOT a check.
      lastCheckedAt: '2026-08-03T00:00:00.000Z',
    });

    expect(display.measured).toBe(false);
    expect(display.statusLabel).toBe('Catalog estimate — healthy');
    expect(display.provenanceLabel).toContain('not a live check');
    expect(display.estimateLabel).toContain('Registry estimate: healthy');
    expect(display.estimateLabel).toContain('97% health');
    expect(display.estimateLabel).toContain('920 ms');
    // The build-time stamp must never be presented as a check time.
    expect(display.lastCheckedLabel).toBeNull();
    expect(display.provenanceLabel).not.toContain('2026-08-03');
  });

  it('treats an ABSENT provenance as SEED (legacy/persisted records stay unproven)', () => {
    const display = providerHealthDisplay({
      status: 'healthy',
      healthScore: 1,
      latencyMs: 5,
      lastCheckedAt: '2026-08-03T00:00:00.000Z',
    });
    expect(display.measured).toBe(false);
    expect(display.statusLabel).toBe('Catalog estimate — healthy');
    expect(display.lastCheckedLabel).toBeNull();
  });

  it('presents a MEASURED record as checked, with the real sample time', () => {
    const display = providerHealthDisplay({
      status: 'healthy',
      healthScore: 0.99,
      latencyMs: 120,
      healthSource: 'MEASURED',
      lastCheckedAt: '2026-10-12T09:30:00.000Z',
    });

    expect(display.measured).toBe(true);
    expect(display.statusLabel).toBe('healthy');
    expect(display.provenanceLabel).toContain('Measured at runtime');
    expect(display.provenanceLabel).toContain('2026-10-12T09:30:00.000Z');
    expect(display.lastCheckedLabel).toBe('2026-10-12T09:30:00.000Z');
    // No estimate line: a measured record is not an estimate.
    expect(display.estimateLabel).toBeNull();
  });

  it('still says it was measured when a runtime sample carried no timestamp', () => {
    const display = providerHealthDisplay({
      status: 'degraded',
      healthScore: 0.5,
      latencyMs: 300,
      healthSource: 'MEASURED',
      lastCheckedAt: null,
    });
    expect(display.measured).toBe(true);
    expect(display.provenanceLabel).toContain('Measured at runtime');
    expect(display.lastCheckedLabel).toBeNull();
  });
});
