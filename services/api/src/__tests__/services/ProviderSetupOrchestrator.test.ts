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
