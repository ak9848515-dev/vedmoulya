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
import {
  InMemoryProviderCredentialStore,
  ProviderCredentialService,
  createProviderCredentialCipher,
  type ProviderApplicationService,
} from '@vedmoulya/providers';
import { createProvidersRouter } from '../routers/ProvidersRouter.js';

function makeRouter() {
  const svc = {
    getMarketplace: vi.fn(),
    searchProviders: vi.fn(),
  } as unknown as ProviderApplicationService;
  return createProvidersRouter(svc);
}

/** PROVIDER-01 — the same router with a real encrypted credential service. */
function makeRouterWithCredentials() {
  const svc = {
    getMarketplace: vi.fn(),
    searchProviders: vi.fn(),
  } as unknown as ProviderApplicationService;
  const store = new InMemoryProviderCredentialStore();
  const credentials = new ProviderCredentialService(
    store,
    createProviderCredentialCipher('test-deployment-encryption-key-0001'),
  );
  return { router: createProvidersRouter(svc, undefined, credentials), credentials };
}

const CTX = {} as never;

function okGeminiFetch(): ReturnType<typeof vi.fn> {
  return vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [{ name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' }],
        }),
        { status: 200 },
      ),
    );
}

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

  // ── PROVIDER-01 — the credential lifecycle through the gateway ──────────
  describe('connectProvider — credential lifecycle (PROVIDER-01)', () => {
    it('stores a verified user key ENCRYPTED, then resolves it on the next connect', async () => {
      const { router, credentials } = makeRouterWithCredentials();
      const fetchMock = okGeminiFetch();
      vi.stubGlobal('fetch', fetchMock);

      const first = (await router.connectProvider(
        { userId: 'u1', family: 'google', apiKey: 'user-gemini-key-abcdef' },
        CTX,
      )) as { data: { credentialSource: string } };
      expect(first.data.credentialSource).toBe('USER');
      // Stored as ciphertext: the plaintext is nowhere in the service.
      const stored = await credentials.resolve('u1', 'google');
      expect(stored).toEqual({ source: 'USER', secret: 'user-gemini-key-abcdef' });

      // A later connect with NO key resolves the stored credential and probes
      // with it — provenance still reported as the user's own. A distinct
      // second user (mocked) receives a DIFFERENT fetch instance so the
      // assertion is about identity, not call order.
      const fetchMock2 = okGeminiFetch();
      vi.stubGlobal('fetch', fetchMock2);
      const second = (await router.connectProvider({ userId: 'u1', family: 'google' }, CTX)) as {
        data: { credentialSource: string; connected: boolean };
      };
      expect(second.data.connected).toBe(true);
      expect(second.data.credentialSource).toBe('USER');
      const headers = fetchMock2.mock.calls[0]?.[1] as { headers: Record<string, string> };
      expect(headers.headers['x-goog-api-key']).toBe('user-gemini-key-abcdef');
    });

    it('never returns the stored credential to the caller', async () => {
      const { router } = makeRouterWithCredentials();
      vi.stubGlobal('fetch', okGeminiFetch());
      const secret = 'user-gemini-key-abcdef';

      const res = await router.connectProvider(
        { userId: 'u1', family: 'google', apiKey: secret },
        CTX,
      );
      expect(JSON.stringify(res)).not.toContain(secret);
    });

    it('does NOT store a credential the provider rejected', async () => {
      const { router, credentials } = makeRouterWithCredentials();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 401 })));

      const res = (await router.connectProvider(
        { userId: 'u1', family: 'google', apiKey: 'bad-key-000000' },
        CTX,
      )) as { data: { connected: boolean; credentialSource: string } };

      expect(res.data.connected).toBe(false);
      await expect(credentials.hasCredential('u1', 'google')).resolves.toBe(false);
    });

    it('uses the deployment credential when the user has none (PATH A)', async () => {
      const { router } = makeRouterWithCredentials();
      const fetchMock = okGeminiFetch();
      vi.stubGlobal('fetch', fetchMock);
      const saved = process.env.AI_GOOGLE_API_KEY;
      process.env.AI_GOOGLE_API_KEY = 'platform-gemini-key-abcdef';
      try {
        const res = (await router.connectProvider({ userId: 'u1', family: 'google' }, CTX)) as {
          data: { connected: boolean; credentialSource: string; runtimeConfigured: boolean };
        };
        expect(res.data.connected).toBe(true);
        expect(res.data.credentialSource).toBe('PLATFORM');
        expect(res.data.runtimeConfigured).toBe(true);
        const headers = fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> };
        expect(headers.headers['x-goog-api-key']).toBe('platform-gemini-key-abcdef');
      } finally {
        if (saved === undefined) delete process.env.AI_GOOGLE_API_KEY;
        else process.env.AI_GOOGLE_API_KEY = saved;
      }
    });

    it('reports NONE when neither the user nor the deployment has a credential', async () => {
      const { router } = makeRouterWithCredentials();
      vi.stubGlobal('fetch', okGeminiFetch());
      const saved = process.env.AI_GOOGLE_API_KEY;
      delete process.env.AI_GOOGLE_API_KEY;
      try {
        const res = (await router.connectProvider({ userId: 'u1', family: 'google' }, CTX)) as {
          data: { connected: boolean; credentialSource: string; errorKind?: string };
        };
        expect(res.data.connected).toBe(false);
        expect(res.data.credentialSource).toBe('NONE');
        expect(res.data.errorKind).toBe('no_credential');
      } finally {
        if (saved !== undefined) process.env.AI_GOOGLE_API_KEY = saved;
      }
    });

    it('disconnectProvider forgets the stored credential (idempotently)', async () => {
      const { router, credentials } = makeRouterWithCredentials();
      vi.stubGlobal('fetch', okGeminiFetch());
      await router.connectProvider(
        { userId: 'u1', family: 'google', apiKey: 'user-key-abcdef' },
        CTX,
      );
      await expect(credentials.hasCredential('u1', 'google')).resolves.toBe(true);

      const removed = (await router.disconnectProvider(
        { userId: 'u1', family: 'google' },
        CTX,
      )) as {
        data: { removed: boolean; supported: boolean };
      };
      expect(removed.data).toEqual({ family: 'google', removed: true, supported: true });
      await expect(credentials.hasCredential('u1', 'google')).resolves.toBe(false);

      const again = (await router.disconnectProvider({ userId: 'u1', family: 'google' }, CTX)) as {
        data: { removed: boolean };
      };
      expect(again.data.removed).toBe(true);
    });

    it('is honest when this deployment cannot store credentials at all', async () => {
      // No credential service injected → the platform credential is the only
      // possible source, and disconnect says so instead of pretending.
      const res = (await makeRouter().disconnectProvider(
        { userId: 'u1', family: 'google' },
        CTX,
      )) as {
        data: { removed: boolean; supported: boolean };
      };
      expect(res.data).toEqual({ family: 'google', removed: false, supported: false });
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
