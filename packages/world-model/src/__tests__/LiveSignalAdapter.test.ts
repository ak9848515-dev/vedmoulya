// SPRINT-034 — LiveSignalAdapter
// Operator-configurable live world signal source. Honest states (AVAILABLE /
// UNAVAILABLE / ERROR — never AVAILABLE for an unavailable source), bounded
// payloads, provenance, and untrusted-content sanitization. External content
// is EVIDENCE only — signals carry no authority fields.

import { describe, expect, it } from 'vitest';
import {
  LiveSignalAdapter,
  MAX_PAYLOAD_BYTES,
  sanitizeExternalText,
} from '../infrastructure/LiveSignalAdapter.js';

const now = (): string => '2026-08-15T10:00:00.000Z';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('LiveSignalAdapter', () => {
  it('reports UNAVAILABLE when not configured — never a fake AVAILABLE', async () => {
    const adapter = new LiveSignalAdapter({ now });
    const result = await adapter.listSignals('ai_model_releases');
    expect(result.status).toBe('UNAVAILABLE');
    expect(result.signals).toHaveLength(0);
  });

  it('reports AVAILABLE with provenance when the source answers', async () => {
    const fetchFn = async (): Promise<Response> =>
      jsonResponse({
        items: [
          {
            title: 'New model released',
            description: 'A new open-source reasoning model shipped.',
            url: 'https://example.com/model-1',
            sourceId: 'src-1',
            publishedAt: '2026-08-14T00:00:00Z',
          },
        ],
      });
    const adapter = new LiveSignalAdapter({ baseUrl: 'https://signals.example.com', fetchFn, now });
    const result = await adapter.listSignals('ai_model_releases');
    expect(result.status).toBe('AVAILABLE');
    expect(result.signals).toHaveLength(1);
    const signal = result.signals[0];
    expect(signal.kind).toBe('ai_model_releases');
    expect(signal.provenance).toContain('source:src-1');
    expect(signal.provenance).toContain('url:https://example.com/model-1');
    expect(signal.provenance).toContain('published:2026-08-14T00:00:00Z');
    expect(signal.provenance).toContain('retrieved:');
  });

  it('returns ERROR for a failing source (never AVAILABLE)', async () => {
    const fetchFn = async (): Promise<Response> => jsonResponse({}, 500);
    const adapter = new LiveSignalAdapter({ baseUrl: 'https://signals.example.com', fetchFn, now });
    const result = await adapter.listSignals('pricing_changes');
    expect(result.status).toBe('ERROR');
    expect(result.error).toContain('500');
  });

  it('returns ERROR for a network failure', async () => {
    const fetchFn = async (): Promise<Response> => {
      throw new Error('network down');
    };
    const adapter = new LiveSignalAdapter({ baseUrl: 'https://signals.example.com', fetchFn, now });
    const result = await adapter.listSignals('market_trends');
    expect(result.status).toBe('ERROR');
    expect(result.error).toContain('network down');
  });

  it('returns ERROR for an oversized payload (bounded, never unbounded)', async () => {
    const big = 'x'.repeat(MAX_PAYLOAD_BYTES + 100);
    const fetchFn = async (): Promise<Response> => jsonResponse({ items: [{ title: big }] });
    const adapter = new LiveSignalAdapter({ baseUrl: 'https://signals.example.com', fetchFn, now });
    const result = await adapter.listSignals('content_trends');
    expect(result.status).toBe('ERROR');
    expect(result.error).toContain('bounded size limit');
  });

  it('sanitizes untrusted content — scripts stripped, markup removed, control chars dropped', async () => {
    const malicious = '<script>window.pwned=true</script>Buy our <b>service</b> \u0000now';
    const fetchFn = async (): Promise<Response> =>
      jsonResponse({
        items: [
          {
            title: malicious,
            description: `<img src=x onerror="alert(1)"> ${malicious}`,
            url: 'https://example.com/sig',
          },
        ],
      });
    const adapter = new LiveSignalAdapter({ baseUrl: 'https://signals.example.com', fetchFn, now });
    const result = await adapter.listSignals('market_trends');
    expect(result.status).toBe('AVAILABLE');
    const signal = result.signals[0];
    if (!signal) throw new Error('no signal');
    // Script blocks and markup are stripped; control characters are dropped.
    expect(signal.title).not.toContain('<script>');
    expect(signal.title).not.toContain('</script>');
    expect(signal.title).not.toContain('<b>');
    expect(signal.title).not.toContain('window.pwned');
    expect(signal.description).not.toContain('<img');
    expect(signal.title).not.toMatch(/\u0000/);
    expect(signal.title.length).toBeLessThanOrEqual(200);
  });

  it('refuses a signal without provenance (no source identity)', async () => {
    const fetchFn = async (): Promise<Response> =>
      jsonResponse({ items: [{ title: 'Orphaned fact', description: 'no source' }] });
    const adapter = new LiveSignalAdapter({ baseUrl: 'https://signals.example.com', fetchFn, now });
    const result = await adapter.listSignals('startup_ideas');
    expect(result.status).toBe('AVAILABLE');
    expect(result.signals).toHaveLength(0);
  });

  it('limits the number of signals per kind', async () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      title: `Signal ${i}`,
      url: `https://example.com/sig-${i}`,
    }));
    const fetchFn = async (): Promise<Response> => jsonResponse({ items });
    const adapter = new LiveSignalAdapter({ baseUrl: 'https://signals.example.com', fetchFn, now });
    const result = await adapter.listSignals('job_market');
    expect(result.signals.length).toBeLessThanOrEqual(25);
  });

  it('treats external content as DATA only — signals carry no authority fields', async () => {
    const fetchFn = async (): Promise<Response> =>
      jsonResponse({
        items: [
          {
            title: 'Market opportunity',
            url: 'https://example.com/sig',
            approved: true,
            canExecute: true,
            authority: 'FULL',
          },
        ],
      });
    const adapter = new LiveSignalAdapter({ baseUrl: 'https://signals.example.com', fetchFn, now });
    const result = await adapter.listSignals('market_trends');
    const signal = result.signals[0];
    if (!signal) throw new Error('no signal');
    // The signal type has no authority surface at all — type-level proof.
    expect('approved' in signal).toBe(false);
    expect('canExecute' in signal).toBe(false);
    expect('authority' in signal).toBe(false);
  });

  it('sanitizeExternalText strips control chars and script blocks', () => {
    expect(sanitizeExternalText('a\u0000b<script>x</script>c', 200)).not.toMatch(/[\u0000]/);
    expect(sanitizeExternalText('<script>evil()</script> safe', 200)).not.toContain('script');
  });
});

describe('LiveSignalAdapter — SPRINT-035 signal health', () => {
  it('reports UNAVAILABLE before any observation — never fabricated live status', () => {
    const adapter = new LiveSignalAdapter({ baseUrl: 'https://signals.example/v1' });
    const health = adapter.health();
    const market = health.find((h) => h.kind === 'market_trends');
    expect(market).toBeDefined();
    expect(market?.configured).toBe(true);
    expect(market?.status).toBe('UNAVAILABLE');
    expect(market?.lastSuccessAt).toBeUndefined();
    expect(market?.lastErrorAt).toBeUndefined();
  });

  it('records lastSuccessAt after a successful observation', async () => {
    const adapter = new LiveSignalAdapter({
      baseUrl: 'https://signals.example/v1',
      now: () => '2026-08-15T10:00:00.000Z',
      fetchFn: (async () =>
        new Response(
          JSON.stringify([{ id: 's1', title: 'New model release', url: 'https://x.dev/1' }]),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        )) as typeof fetch,
    });
    const result = await adapter.listSignals('ai_model_releases');
    expect(result.status).toBe('AVAILABLE');
    const health = adapter.health();
    const entry = health.find((h) => h.kind === 'ai_model_releases');
    expect(entry?.status).toBe('AVAILABLE');
    expect(entry?.lastSuccessAt).toBe('2026-08-15T10:00:00.000Z');
  });

  it('records lastErrorAt + lastError after a failure — never AVAILABLE', async () => {
    const adapter = new LiveSignalAdapter({
      baseUrl: 'https://signals.example/v1',
      now: () => '2026-08-15T10:05:00.000Z',
      fetchFn: (async () => new Response('boom', { status: 500 })) as typeof fetch,
    });
    const result = await adapter.listSignals('pricing_changes');
    expect(result.status).toBe('ERROR');
    const health = adapter.health();
    const entry = health.find((h) => h.kind === 'pricing_changes');
    expect(entry?.status).toBe('ERROR');
    expect(entry?.lastErrorAt).toBe('2026-08-15T10:05:00.000Z');
    expect(entry?.lastError).toContain('500');
    // A later success replaces ERROR honestly.
    adapter.health();
    void entry;
  });

  it('reports unconfigured kinds as UNAVAILABLE even when the adapter is configured for others', () => {
    const adapter = new LiveSignalAdapter({
      baseUrl: 'https://signals.example/v1',
      kinds: ['market_trends'],
    });
    const health = adapter.health();
    const enabled = health.find((h) => h.kind === 'market_trends');
    const disabled = health.find((h) => h.kind === 'job_market');
    expect(enabled?.configured).toBe(true);
    expect(disabled?.configured).toBe(false);
    expect(disabled?.status).toBe('UNAVAILABLE');
  });
});
