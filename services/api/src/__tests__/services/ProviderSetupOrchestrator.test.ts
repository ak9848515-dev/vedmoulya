import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderSetupOrchestrator } from '../../services/ProviderSetupOrchestrator.js';
import type { ProviderCredentialService, ProviderPreferencesService } from '@vedmoulya/providers';

describe('ProviderSetupOrchestrator', () => {
  let credentials: vi.Mocked<ProviderCredentialService>;
  let preferences: vi.Mocked<
    Pick<ProviderPreferencesService, 'setProviderEnabled' | 'updatePreferences'>
  >;
  let probe: vi.Mock;
  let generate: vi.Mock;
  let orchestrator: ProviderSetupOrchestrator;

  beforeEach(() => {
    credentials = {
      resolve: vi.fn(),
      store: vi.fn(),
      delete: vi.fn(),
      hasCredential: vi.fn(),
    } as unknown as vi.Mocked<ProviderCredentialService>;

    preferences = {
      setProviderEnabled: vi.fn(),
      updatePreferences: vi.fn(),
    };

    probe = vi.fn();
    generate = vi.fn();

    orchestrator = new ProviderSetupOrchestrator({
      credentials,
      preferences,
      probe,
      generate,
    });
  });

  describe('Ollama', () => {
    it('successfully connects with one-click setup', async () => {
      credentials.resolve.mockResolvedValue({ source: 'NONE' });
      probe.mockResolvedValue({
        connected: true,
        credentialSource: 'NONE',
        models: [{ id: 'qwen2.5-coder:7b-instruct', name: 'qwen2.5-coder:7b-instruct' }],
      });
      generate.mockResolvedValue({ ok: true, latencyMs: 150 });
      preferences.setProviderEnabled.mockResolvedValue({ success: true });
      preferences.updatePreferences.mockResolvedValue({ success: true });
      credentials.hasCredential.mockResolvedValue(true);

      const result = await orchestrator.setup({
        userId: 'user-1',
        family: 'ollama',
      });

      expect(result.outcome).toBe('SUCCESS');
      expect(result.connected).toBe(true);
      expect(result.selectedModel?.id).toBe('qwen2.5-coder:7b-instruct');
      expect(preferences.setProviderEnabled).toHaveBeenCalledWith('user-1', 'ollama', true);
    });

    it('returns ACTION_REQUIRED when Ollama is unreachable', async () => {
      credentials.resolve.mockResolvedValue({ source: 'NONE' });
      probe.mockResolvedValue({
        connected: false,
        errorKind: 'unreachable',
        message: 'fetch failed',
        credentialSource: 'NONE',
      });

      const result = await orchestrator.setup({
        userId: 'user-1',
        family: 'ollama',
      });

      expect(result.outcome).toBe('ACTION_REQUIRED');
      expect(result.message).toContain("Ollama isn't running");
      expect(result.recovery?.kind).toBe('start_local_provider');
    });
  });

  describe('Google', () => {
    it('successfully connects after OAuth callback', async () => {
      // Mock that the platform/user already has a token stored (oauthCompleted)
      credentials.resolve.mockResolvedValue({ source: 'USER', secret: 'oauth-token' });
      credentials.hasCredential.mockResolvedValue(true);

      probe.mockResolvedValue({
        connected: true,
        credentialSource: 'USER',
        models: [{ id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' }],
      });
      generate.mockResolvedValue({ ok: true, latencyMs: 200 });
      preferences.setProviderEnabled.mockResolvedValue({ success: true });
      preferences.updatePreferences.mockResolvedValue({ success: true });

      const result = await orchestrator.setup({
        userId: 'user-1',
        family: 'google',
        oauthCompleted: true,
      });

      expect(result.outcome).toBe('SUCCESS');
      expect(result.connected).toBe(true);
      expect(result.selectedModel?.id).toBe('gemini-1.5-pro');
      expect(preferences.setProviderEnabled).toHaveBeenCalledWith('user-1', 'google', true);
    });

    it('returns AUTH_REQUIRED if oauth is missing', async () => {
      credentials.resolve.mockResolvedValue({ source: 'NONE' });
      probe.mockResolvedValue({
        connected: false,
        errorKind: 'no_credential',
        message: 'No key',
        credentialSource: 'NONE',
      });

      const result = await orchestrator.setup({
        userId: 'user-1',
        family: 'google',
      });

      expect(result.outcome).toBe('AUTH_REQUIRED');
    });
  });

  // ── Google one-click, end to end through the REAL probes ────────────────
  // REGRESSION: the Gemini generation parser looked up `content.content`, so
  // even a real completion was read as "the provider produced no reply" — the
  // one-click Google flow could never reach READY. These tests deliberately do
  // NOT stub `probe`/`generate`: only `fetch` is doubled, so the pipeline runs
  // the production tester AND the production generation validation, and the
  // parser really is the thing under test.
  describe('Google one-click — real Gemini generation validation', () => {
    const GEMINI_LIST = {
      models: [
        { name: 'models/gemini-3.5-flash', displayName: 'Gemini 3.5 Flash' },
        { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' },
      ],
    };

    /**
     * Serves the two Gemini endpoints the real probes call: the ListModels
     * discovery GET and the tiny generateContent validation POST. `completion`
     * is what decides READY vs "produced no reply".
     */
    function geminiFetch(completion: unknown) {
      return vi.fn((url: string, init?: RequestInit) => {
        const body = (init?.method ?? 'GET') === 'POST' ? completion : GEMINI_LIST;
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      });
    }

    /** The orchestrator under test: production probe + production validation. */
    function realOrchestrator(): ProviderSetupOrchestrator {
      return new ProviderSetupOrchestrator({ credentials, preferences });
    }

    beforeEach(() => {
      credentials.resolve.mockResolvedValue({ source: 'USER', secret: 'oauth-google-token' });
      credentials.hasCredential.mockResolvedValue(true);
      preferences.setProviderEnabled.mockResolvedValue({ success: true });
      preferences.updatePreferences.mockResolvedValue({ success: true });
    });

    it('reaches SUCCESS once Gemini actually answers the chosen model', async () => {
      const fetchFn = geminiFetch({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] });

      const result = await realOrchestrator().setup({
        userId: 'user-1',
        family: 'google',
        oauthCompleted: true,
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      // READY — only a provider that really answered may be called connected.
      expect(result.outcome).toBe('SUCCESS');
      expect(result.connected).toBe(true);
      expect(result.stage).toBe('refresh_state');
      expect(result.credentialSource).toBe('USER');
      expect(result.availableModels.map((model) => model.id)).toEqual([
        'gemini-3.5-flash',
        'gemini-2.5-pro',
      ]);
      expect(result.hasModelChoice).toBe(true);
      expect(result.selectedModel).toEqual({ id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' });
      expect(result.modelSelectionSource).toBe('provider_default');
      expect(typeof result.validationLatencyMs).toBe('number');
      expect(result.preferencesApplied).toBe(true);
      expect(result.message).toContain('connected');
      // OAuth supplied the credential — nothing new was persisted.
      expect(credentials.store).not.toHaveBeenCalled();

      // The validation generation really ran, on the CHOSEN model, with the
      // stored Google token, carrying the tiny one-word prompt.
      const postCall = fetchFn.mock.calls.find(([, init]) => init?.method === 'POST');
      expect(postCall?.[0]).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent',
      );
      expect((postCall?.[1]?.headers as Record<string, string>)['x-goog-api-key']).toBe(
        'oauth-google-token',
      );
      expect(String(postCall?.[1]?.body)).toContain('Reply with the single word');

      // The discovery probe authenticated with the same credential.
      const listCall = fetchFn.mock.calls.find(([, init]) => (init?.method ?? 'GET') === 'GET');
      expect((listCall?.[1]?.headers as Record<string, string>)['x-goog-api-key']).toBe(
        'oauth-google-token',
      );
    });

    it('never reports SUCCESS when Gemini lists models but produces no reply', async () => {
      // Negative control: same real code path, only the completion differs — so
      // a green SUCCESS above cannot come from a stubbed validator.
      const fetchFn = geminiFetch({ candidates: [] });

      const result = await realOrchestrator().setup({
        userId: 'user-1',
        family: 'google',
        oauthCompleted: true,
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      expect(result.outcome).not.toBe('SUCCESS');
      expect(result.connected).toBe(false);
      expect(result.stage).toBe('validate');
      expect(result.selectedModel?.id).toBe('gemini-3.5-flash');
      // A provider that never answered is never enabled as the default.
      expect(preferences.setProviderEnabled).not.toHaveBeenCalled();
      expect(preferences.updatePreferences).not.toHaveBeenCalled();
    });

    it('reaches SUCCESS and persists a pasted key through the same real path', async () => {
      credentials.resolve.mockResolvedValue({ source: 'NONE' });
      const fetchFn = geminiFetch({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] });

      const result = await realOrchestrator().setup({
        userId: 'user-1',
        family: 'google',
        apiKey: '  personal-gemini-key  ',
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      expect(result.outcome).toBe('SUCCESS');
      expect(result.connected).toBe(true);
      // Trimmed, encrypted before storage, and never returned in the result.
      expect(credentials.store).toHaveBeenCalledWith('user-1', 'google', 'personal-gemini-key');
      expect(result.credentialStored).toBe(true);
      expect(JSON.stringify(result)).not.toContain('personal-gemini-key');

      const postCall = fetchFn.mock.calls.find(([, init]) => init?.method === 'POST');
      expect((postCall?.[1]?.headers as Record<string, string>)['x-goog-api-key']).toBe(
        'personal-gemini-key',
      );
    });
  });

  // ── Failure taxonomy: every classified failure becomes plain language plus
  //    exactly ONE recovery action (never a developer instruction) ─────────
  describe('failure taxonomy + recovery', () => {
    it('turns a blocked local runtime into ACTION_REQUIRED with Advanced setup', async () => {
      credentials.resolve.mockResolvedValue({ source: 'NONE' });
      probe.mockResolvedValue({
        connected: false,
        errorKind: 'browser_origin_blocked',
        message: 'origin policy refused the browser',
        credentialSource: 'NONE',
      });

      const result = await orchestrator.setup({ userId: 'user-1', family: 'ollama' });

      expect(result.outcome).toBe('ACTION_REQUIRED');
      expect(result.connected).toBe(false);
      expect(result.message).toMatch(/browser access is blocked/i);
      // The one technical dead end gets the Advanced escape hatch.
      expect(result.recovery?.kind).toBe('go_advanced');
    });

    it('reports an unreachable cloud provider as UNAVAILABLE with a retry', async () => {
      credentials.resolve.mockResolvedValue({ source: 'NONE' });
      probe.mockResolvedValue({
        connected: false,
        errorKind: 'unreachable',
        message: 'fetch failed',
        credentialSource: 'USER',
      });

      const result = await orchestrator.setup({
        userId: 'user-1',
        family: 'openai',
        apiKey: 'sk-1',
      });

      expect(result.outcome).toBe('UNAVAILABLE');
      expect(result.message).toMatch(/could not be reached/i);
      expect(result.recovery?.kind).toBe('retry');
    });

    it('keeps a provider\u2019s own message for an unclassified failure', async () => {
      credentials.resolve.mockResolvedValue({ source: 'NONE' });
      probe.mockResolvedValue({
        connected: false,
        // No classified kind (e.g. an HTTP status the taxonomy does not map).
        message: 'Gateway said something odd but safe.',
        credentialSource: 'USER',
      });

      const result = await orchestrator.setup({
        userId: 'user-1',
        family: 'openai',
        apiKey: 'sk-1',
      });

      expect(result.outcome).toBe('VALIDATION_FAILED');
      expect(result.message).toBe('Gateway said something odd but safe.');
      expect(result.recovery?.kind).toBe('retry');
    });

    it('reports a provider that connected but served no models', async () => {
      credentials.resolve.mockResolvedValue({ source: 'NONE' });
      probe.mockResolvedValue({
        connected: true,
        credentialSource: 'USER',
        // The probe omits `models` entirely — never treated as a model list.
      });

      const result = await orchestrator.setup({
        userId: 'user-1',
        family: 'openai',
        apiKey: 'sk-1',
      });

      expect(result.outcome).toBe('MODEL_DISCOVERY_FAILED');
      expect(result.availableModels).toEqual([]);
      expect(result.message).toMatch(/reported no models/i);
      expect(result.recovery?.kind).toBe('retry');
      expect(generate).not.toHaveBeenCalled();
    });

    it('refuses a family this build does not support, without probing it', async () => {
      const result = await orchestrator.setup({ userId: 'user-1', family: 'acme-ai' });

      expect(result.outcome).toBe('UNAVAILABLE');
      expect(result.providerId).toBe('acme-ai');
      expect(result.message).toMatch(/not available in this VedMoulya/i);
      expect(probe).not.toHaveBeenCalled();
      expect(credentials.resolve).not.toHaveBeenCalled();
    });

    // REGRESSION (shared pipeline): OpenRouter was absent from the connect
    // contract entirely, so its Connect action could only ever fail. It is now
    // a first-class family on the SHARED OpenAI-compatible path.
    it('accepts OpenRouter as a first-class family through the shared pipeline', async () => {
      credentials.resolve.mockResolvedValue({ source: 'USER', secret: 'sk-or-1' });
      credentials.hasCredential.mockResolvedValue(true);
      probe.mockResolvedValue({
        connected: true,
        credentialSource: 'USER',
        models: [{ id: 'openai/gpt-4o-mini', name: 'openai/gpt-4o-mini' }],
      });
      generate.mockResolvedValue({ ok: true, latencyMs: 120 });
      preferences.setProviderEnabled.mockResolvedValue({ success: true });
      preferences.updatePreferences.mockResolvedValue({ success: true });

      const result = await orchestrator.setup({
        userId: 'user-1',
        family: 'openrouter',
        apiKey: 'sk-or-1',
      });

      expect(result.outcome).toBe('SUCCESS');
      expect(result.providerId).toBe('openrouter');
      expect(probe).toHaveBeenCalledWith(expect.objectContaining({ family: 'openrouter' }));
    });
  });

  // ── Persistence/preference honesty: a verified provider is never reported
  //    as a completed setup when the runtime still cannot use it ───────────
  describe('preference writes + runtime resolvability', () => {
    function stubVerifiedProbe(): void {
      credentials.resolve.mockResolvedValue({ source: 'NONE' });
      credentials.hasCredential.mockResolvedValue(true);
      probe.mockResolvedValue({
        connected: true,
        credentialSource: 'USER',
        models: [{ id: 'gpt-4o-mini', name: 'gpt-4o-mini' }],
      });
      generate.mockResolvedValue({ ok: true, latencyMs: 42 });
    }

    it('reports SUCCESS without preferences when no preference service is composed', async () => {
      stubVerifiedProbe();
      const withoutPreferences = new ProviderSetupOrchestrator({ credentials, probe, generate });

      const result = await withoutPreferences.setup({
        userId: 'user-1',
        family: 'openai',
        apiKey: 'sk-1',
      });

      expect(result.outcome).toBe('SUCCESS');
      expect(result.connected).toBe(true);
      expect(result.preferencesApplied).toBe(false);
    });

    it('reports PERSISTENCE_FAILED when the provider cannot be turned on', async () => {
      stubVerifiedProbe();
      preferences.setProviderEnabled.mockResolvedValue({ success: false });

      const result = await orchestrator.setup({
        userId: 'user-1',
        family: 'openai',
        apiKey: 'sk-1',
      });

      expect(result.outcome).toBe('PERSISTENCE_FAILED');
      expect(result.connected).toBe(false);
      expect(result.preferenceStage).toBe('enable_provider');
      expect(result.recovery?.kind).toBe('retry');
      expect(preferences.updatePreferences).not.toHaveBeenCalled();
    });

    it('reports PERSISTENCE_FAILED when the default cannot be saved', async () => {
      stubVerifiedProbe();
      preferences.setProviderEnabled.mockResolvedValue({ success: true });
      preferences.updatePreferences.mockResolvedValue({ success: false });

      const result = await orchestrator.setup({
        userId: 'user-1',
        family: 'openai',
        apiKey: 'sk-1',
      });

      expect(result.outcome).toBe('PERSISTENCE_FAILED');
      expect(result.preferenceStage).toBe('set_preferred');
      expect(result.recovery?.kind).toBe('retry');
    });

    it('accepts a PLATFORM probe credential without any stored key', async () => {
      credentials.resolve.mockResolvedValue({ source: 'NONE' });
      credentials.hasCredential.mockResolvedValue(false);
      probe.mockResolvedValue({
        connected: true,
        credentialSource: 'PLATFORM',
        models: [{ id: 'gpt-4o-mini', name: 'gpt-4o-mini' }],
      });
      generate.mockResolvedValue({ ok: true, latencyMs: 12 });
      preferences.setProviderEnabled.mockResolvedValue({ success: true });
      preferences.updatePreferences.mockResolvedValue({ success: true });

      const result = await orchestrator.setup({ userId: 'user-1', family: 'openai' });

      expect(result.outcome).toBe('SUCCESS');
      expect(result.credentialSource).toBe('PLATFORM');
      expect(result.credentialStored).toBe(false);
    });

    it('asks for a key when the runtime cannot resolve one at all', async () => {
      const keyless = new ProviderSetupOrchestrator({ preferences, probe, generate });
      probe.mockResolvedValue({
        connected: true,
        credentialSource: 'NONE',
        models: [{ id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' }],
      });
      generate.mockResolvedValue({ ok: true, latencyMs: 20 });
      preferences.setProviderEnabled.mockResolvedValue({ success: true });
      preferences.updatePreferences.mockResolvedValue({ success: true });

      const result = await keyless.setup({ userId: 'user-1', family: 'google' });

      expect(result.outcome).toBe('AUTH_REQUIRED');
      expect(result.connected).toBe(false);
      expect(result.message).toMatch(/no key it can use/i);
      expect(result.recovery?.kind).toBe('check_credential');
    });

    it('threads endpointUrl, env and timeout through both probes', async () => {
      credentials.resolve.mockResolvedValue({ source: 'NONE' });
      credentials.hasCredential.mockResolvedValue(false);
      probe.mockResolvedValue({
        connected: true,
        credentialSource: 'NONE',
        models: [{ id: 'llama3.2', name: 'llama3.2' }],
      });
      generate.mockResolvedValue({ ok: true, latencyMs: 30 });
      preferences.setProviderEnabled.mockResolvedValue({ success: true });
      preferences.updatePreferences.mockResolvedValue({ success: true });

      const env = { AI_OLLAMA_BASE_URL: 'http://localhost:11434' };
      const result = await orchestrator.setup({
        userId: 'user-1',
        family: 'ollama',
        endpointUrl: 'http://127.0.0.1:11434',
        env,
        timeoutMs: 1234,
      });

      expect(result.outcome).toBe('SUCCESS');
      expect(probe).toHaveBeenCalledWith(
        expect.objectContaining({ endpointUrl: 'http://127.0.0.1:11434', env, timeoutMs: 1234 }),
      );
      expect(generate).toHaveBeenCalledWith(
        expect.objectContaining({ endpointUrl: 'http://127.0.0.1:11434', env, timeoutMs: 1234 }),
      );
    });

    it('reports a rejected generation without a provider message honestly', async () => {
      stubVerifiedProbe();
      // No `message` on the validation result — the taxonomy still answers.
      generate.mockResolvedValue({ ok: false, errorKind: 'unauthorized' });

      const result = await orchestrator.setup({
        userId: 'user-1',
        family: 'openai',
        apiKey: 'sk-1',
      });

      expect(result.outcome).toBe('VALIDATION_FAILED');
      expect(result.stage).toBe('validate');
      expect(result.message).toMatch(/did not answer/i);
      expect(preferences.setProviderEnabled).not.toHaveBeenCalled();
    });
  });

  // ── The ONE resolved status (what every surface renders) ───────────────
  describe('getStatus — the single resolved provider status', () => {
    it('is CONNECTED only with a resolvable credential and runtime truth', async () => {
      credentials.resolve.mockResolvedValue({ source: 'USER', secret: 'k' });

      const status = await orchestrator.getStatus('user-1', 'google', {
        runtimeStatus: 'CONFIGURED',
        enabled: true,
        selectedModel: { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
        availableModels: [{ id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' }],
        capabilities: ['Answer questions', 'Draft text'],
      });

      expect(status.connectionState).toBe('CONNECTED');
      expect(status.credentialSource).toBe('USER');
      expect(status.runtimeConfigured).toBe(true);
      expect(status.selectedModel?.id).toBe('gemini-3.5-flash');
      expect(status.capabilities).toEqual(['Answer questions', 'Draft text']);
    });

    it('records the last verification and surfaces a real failure as ERROR', async () => {
      credentials.resolve.mockResolvedValue({ source: 'USER', secret: 'k' });

      const verified = await orchestrator.getStatus('user-1', 'google', {
        runtimeStatus: 'CONFIGURED',
        lastVerification: { ok: true, at: '2026-05-01T10:00:00.000Z' },
      });
      expect(verified.lastValidatedAt).toBe('2026-05-01T10:00:00.000Z');
      expect(verified.connectionState).toBe('CONNECTED');

      const failed = await orchestrator.getStatus('user-1', 'google', {
        runtimeStatus: 'CONFIGURED',
        lastVerification: {
          ok: false,
          failureKind: 'invalid_api_key',
          at: '2026-05-01T10:05:00.000Z',
          message: 'raw provider text',
        },
      });
      expect(failed.connectionState).toBe('ERROR');
      expect(failed.actionableError?.message).toMatch(/did not answer/i);
      expect(failed.actionableError?.recovery?.kind).toBe('check_credential');

      // A failure with no message at all is still actionable, never raw text.
      const silent = await orchestrator.getStatus('user-1', 'google', {
        lastVerification: { ok: false, failureKind: 'unreachable' },
      });
      expect(silent.connectionState).toBe('ERROR');
      expect(silent.actionableError?.message).toMatch(/could not be reached/i);
    });

    it('is CONNECTING while a setup is in flight — never "disconnected"', async () => {
      credentials.resolve.mockResolvedValue({ source: 'NONE' });

      const status = await orchestrator.getStatus('user-1', 'google', { connecting: true });

      expect(status.connectionState).toBe('CONNECTING');
    });

    it('surfaces a runtime that cannot execute the provider as an actionable ERROR', async () => {
      credentials.resolve.mockResolvedValue({ source: 'USER', secret: 'k' });

      const status = await orchestrator.getStatus('user-1', 'anthropic', {
        runtimeStatus: 'UNSUPPORTED_RUNTIME',
        enabled: true,
      });

      expect(status.connectionState).toBe('ERROR');
      expect(status.actionableError?.message).toMatch(/cannot run it yet/i);
      expect(status.actionableError?.recovery?.kind).toBe('go_advanced');
    });

    it('stays DISCONNECTED for a keyed family with no credential', async () => {
      credentials.resolve.mockResolvedValue({ source: 'NONE' });

      const status = await orchestrator.getStatus('user-1', 'openai', {
        runtimeStatus: 'CONFIGURED',
        enabled: true,
        capabilities: [],
      });

      expect(status.connectionState).toBe('DISCONNECTED');
      expect(status.credentialSource).toBe('NONE');
      expect(status.actionableError).toBeUndefined();
    });
  });

  describe('API-Key Providers', () => {
    it('successfully connects with valid API key and persists', async () => {
      credentials.resolve.mockResolvedValue({ source: 'NONE' });
      probe.mockResolvedValue({
        connected: true,
        credentialSource: 'USER',
        models: [{ id: 'gpt-4o', name: 'GPT-4o' }],
      });
      generate.mockResolvedValue({ ok: true, latencyMs: 120 });
      preferences.setProviderEnabled.mockResolvedValue({ success: true });
      preferences.updatePreferences.mockResolvedValue({ success: true });
      credentials.store.mockResolvedValue(undefined);
      credentials.hasCredential.mockResolvedValue(true); // after storing

      const result = await orchestrator.setup({
        userId: 'user-1',
        family: 'openai',
        apiKey: 'sk-1234',
      });

      expect(result.outcome).toBe('SUCCESS');
      expect(result.connected).toBe(true);
      expect(result.credentialStored).toBe(true);
      expect(credentials.store).toHaveBeenCalledWith('user-1', 'openai', 'sk-1234');
    });

    it('returns VALIDATION_FAILED on invalid API key', async () => {
      credentials.resolve.mockResolvedValue({ source: 'NONE' });
      probe.mockResolvedValue({
        connected: false,
        errorKind: 'unauthorized',
        message: 'Invalid key',
        credentialSource: 'NONE',
      });

      const result = await orchestrator.setup({
        userId: 'user-1',
        family: 'openai',
        apiKey: 'sk-invalid',
      });

      expect(result.outcome).toBe('VALIDATION_FAILED');
      expect(credentials.store).not.toHaveBeenCalled();
    });
  });
});
