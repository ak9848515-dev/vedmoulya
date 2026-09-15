// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — ProvidersRouter Connect/Test Handlers (FINAL-02)
//
// Covers the gateway contract the friendly provider UX depends on:
//   - connectProvider returns the standardized success envelope carrying the
//     family-aware connection result (models, latency, runtime truth)
//   - testConnection delegates the `google-gemini` protocol to the family-aware
//     tester (Gemini uses x-goog-api-key, NOT Bearer) and reports REAL models
//   - no API key material ever appears in any response payload
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createProvidersRouter } from '../routers/ProvidersRouter.js';
import type { ProviderApplicationService } from '@vedmoulya/providers';

function makeRouter() {
  const svc = {
    getMarketplace: vi.fn(),
    searchProviders: vi.fn(),
  } as unknown as ProviderApplicationService;
  return createProvidersRouter(svc);
}

const CTX = {} as never;

describe('ProvidersRouter — connectProvider / testConnection (FINAL-02)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('connectProvider (family-aware)', () => {
    it('returns a success envelope with real discovered models', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              models: [{ name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' }],
            }),
            { status: 200 },
          ),
        ),
      );

      const res = await makeRouter().connectProvider(
        { userId: 'u1', family: 'google', apiKey: 'gem-key' },
        CTX,
      );

      expect(res.success).toBe(true);
      const data = (res as { data: { connected: boolean; models?: Array<{ id: string }> } }).data;
      expect(data.connected).toBe(true);
      expect(data.models?.map((m) => m.id)).toEqual(['gemini-2.5-flash']);
      expect(JSON.stringify(res)).not.toContain('gem-key');
    });

    it('propagates friendly failures (invalid key) without leaking the key', async () => {
      const secret = 'sk-fail-test-abcdef';
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 401 })));

      const res = await makeRouter().connectProvider(
        { userId: 'u1', family: 'openai', apiKey: secret },
        CTX,
      );

      const data = (res as { data: { connected: boolean; errorKind?: string; message: string } })
        .data;
      expect(data.connected).toBe(false);
      expect(data.errorKind).toBe('invalid_api_key');
      expect(data.message).toMatch(/invalid api key/i);
      expect(JSON.stringify(res)).not.toContain(secret);
    });

    it('passes the user endpoint through for Ollama', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ models: [{ name: 'llama3.2' }] }), { status: 200 }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const res = await makeRouter().connectProvider(
        { userId: 'u1', family: 'ollama', endpointUrl: 'http://127.0.0.1:11434' },
        CTX,
      );

      expect(res.success).toBe(true);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:11434/api/tags');
    });
  });

  describe('testConnection (SPRINT-049 custom providers)', () => {
    it('delegates the google-gemini protocol to the family-aware tester with real model discovery', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            models: [
              { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
              { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' },
            ],
          }),
          { status: 200 },
        ),
      );
      vi.stubGlobal('fetch', fetchMock);

      const res = await makeRouter().testConnection(
        {
          userId: 'u1',
          endpointUrl: 'https://ignored.example.com',
          apiKey: 'gem-key',
          protocol: 'google-gemini',
        },
        CTX,
      );

      const data = (res as { data: { connected: boolean; modelCount?: number; message: string } })
        .data;
      expect(data.connected).toBe(true);
      expect(data.modelCount).toBe(2);
      expect(data.message).toMatch(/Google Gemini/);
      // The Gemini endpoint was probed (x-goog-api-key family probe), NOT the
      // generic endpoint URL with a Bearer header.
      expect(fetchMock.mock.calls[0]?.[0]).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models',
      );
      const headers = fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> };
      expect(headers.headers['x-goog-api-key']).toBe('gem-key');
    });

    it('requires endpoint URL and key for non-Gemini protocols', async () => {
      const res = await makeRouter().testConnection(
        { userId: 'u1', endpointUrl: '', apiKey: '', protocol: 'openai-compatible' },
        CTX,
      );

      const data = (res as { data: { connected: boolean; message: string } }).data;
      expect(data.connected).toBe(false);
      expect(data.message).toMatch(/required/i);
    });

    it('probes <endpoint>/models with a Bearer header for openai-compatible endpoints', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);

      const res = await makeRouter().testConnection(
        {
          userId: 'u1',
          endpointUrl: 'https://gw.example.com/v1',
          apiKey: 'k',
          protocol: 'openai-compatible',
        },
        CTX,
      );

      const data = (res as { data: { connected: boolean; message: string } }).data;
      expect(data.connected).toBe(true);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://gw.example.com/v1/models');
      const headers = fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> };
      expect(headers.headers['Authorization']).toBe('Bearer k');
    });

    it('maps a failed OpenAI-compatible probe to a failed result with status detail', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('denied', { status: 403 })));

      const res = await makeRouter().testConnection(
        {
          userId: 'u1',
          endpointUrl: 'https://gw.example.com/v1',
          apiKey: 'k',
          protocol: 'openai-compatible',
        },
        CTX,
      );

      const data = (res as { data: { connected: boolean; message: string } }).data;
      expect(data.connected).toBe(false);
      expect(data.message).toContain('403');
    });
  });
});
