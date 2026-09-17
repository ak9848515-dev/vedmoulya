// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Configure AI screen tests
// AI PROVIDER UX SIMPLIFICATION
//
// Proves the acceptance criteria of the simplified configuration screen:
//   - Connection is the FIRST section, with API KEY and OAUTH side by side,
//   - built-in providers never ask for an endpoint / protocol / deployment,
//   - Advanced is collapsed by default and shows managed configuration,
//   - the model list is the AI's REAL models with Automatic preferred,
//   - capabilities are auto-detected and read-only (no manual routing),
//   - Usage exposes only "Use this AI" / "Use as primary AI" (no priorities),
//   - failures are friendly (no raw technical text) and OAuth reuses the
//     EXISTING Google authorization flow.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { ProviderConfigScreen } from '../ProviderConfigScreen.js';
import type {
  ProviderConnectionResultDTO,
  ProviderExperienceRowDTO,
  ProviderRuntimeStateDTO,
} from '../../../lib/api-client.js';

const mocks = vi.hoisted(() => ({
  connectMutate: vi.fn(),
  setPrefsMutate: vi.fn(),
  refreshIntelligenceMutate: vi.fn(),
  beginGoogleSignIn: vi.fn(),
  intelligence: null as unknown,
}));

vi.mock('../../../lib/api-client.js', () => ({
  useConnectProvider: () => ({ mutateAsync: mocks.connectMutate }),
  useSetProviderPreferences: () => ({ mutateAsync: mocks.setPrefsMutate }),
  useRefreshProviderIntelligence: () => ({
    mutateAsync: mocks.refreshIntelligenceMutate,
    isPending: false,
  }),
  useProviderIntelligenceStatus: () => mocks.intelligence ?? { data: undefined, isLoading: false },
}));

vi.mock('../../../auth/session-manager.js', () => ({
  beginGoogleSignIn: mocks.beginGoogleSignIn,
}));

// The custom-provider panel is only rendered for Custom AI; it talks to the
// gateway through the tRPC client, which needs no provider in these tests.
vi.mock('../../../lib/trpc.js', () => ({
  api: {
    providers: {
      testConnection: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      registerProvider: { useMutation: () => ({ mutateAsync: vi.fn() }) },
    },
  },
}));

const GOOGLE_PROVIDER: ProviderExperienceRowDTO = {
  providerId: 'google',
  name: 'Google (Gemini)',
  family: 'google',
  selectedModel: { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  models: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', capabilities: ['Reasoning'] },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', capabilities: ['Reasoning'] },
  ],
  availability: 'AVAILABLE',
  enabled: true,
  resourceType: 'FREE_API_QUOTA',
  freeToUse: true,
  health: { status: 'healthy', score: 1, latencyMs: 120, quotaUsedPercent: 0 },
  lifecycleStatus: 'active',
};

const OPENAI_PROVIDER: ProviderExperienceRowDTO = {
  ...GOOGLE_PROVIDER,
  providerId: 'openai',
  name: 'OpenAI',
  family: 'openai',
  selectedModel: { id: 'gpt-4o', name: 'GPT-4o' },
  models: [{ id: 'gpt-4o', name: 'GPT-4o', capabilities: ['Reasoning'] }],
};

const CUSTOM_PROVIDER: ProviderExperienceRowDTO = {
  ...GOOGLE_PROVIDER,
  providerId: 'acme-ai',
  name: 'Acme AI',
  family: 'acme-ai',
  selectedModel: { id: 'acme-1', name: 'Acme 1' },
  models: [{ id: 'acme-1', name: 'Acme 1', capabilities: ['Reasoning'] }],
};

const CONFIGURED_RUNTIME: ProviderRuntimeStateDTO = {
  family: 'google',
  name: 'Google Gemini',
  status: 'CONFIGURED',
  reason: 'AI_GOOGLE_API_KEY is set',
  adapterImplemented: true,
  registered: true,
  canExecute: true,
  freeTier: true,
  defaultEligible: true,
  envKeys: ['AI_GOOGLE_API_KEY'],
};

function intelligenceWithTwoModels(): unknown {
  return {
    data: {
      record: {
        profile: {
          models: [
            {
              modelId: 'gemini-2.5-pro',
              name: 'Gemini 2.5 Pro',
              capabilities: { value: ['reasoning', 'vision'] },
            },
            {
              modelId: 'gemini-2.5-flash',
              name: 'Gemini 2.5 Flash',
              capabilities: { value: ['reasoning', 'content_generation'] },
            },
          ],
        },
      },
    },
    isLoading: false,
  };
}

function renderScreen(
  overrides: {
    provider?: ProviderExperienceRowDTO;
    /** `null` = explicitly no runtime report (key input instead of a banner). */
    runtime?: ProviderRuntimeStateDTO | null;
    preferredProviderId?: string;
    preferredModelId?: string;
    enabled?: boolean;
    /** Simulate an account that never stored a preference (domain default). */
    noStoredPreference?: boolean;
  } = {},
) {
  const onBack = vi.fn();
  const onOpenDetails = vi.fn();
  const onToggle = vi.fn();
  const onSetPrimary = vi.fn();
  const onChanged = vi.fn();
  const provider = overrides.provider ?? GOOGLE_PROVIDER;
  render(
    <ProviderConfigScreen
      userId="u1"
      provider={{ ...provider, enabled: overrides.enabled ?? provider.enabled }}
      preferences={{
        ...(overrides.noStoredPreference
          ? {}
          : overrides.preferredProviderId !== undefined
            ? { preferredProviderId: overrides.preferredProviderId }
            : provider.family === 'google'
              ? { preferredProviderId: 'google' }
              : {}),
        ...(overrides.preferredModelId !== undefined
          ? { preferredModelId: overrides.preferredModelId }
          : {}),
        disabledProviderIds: [],
      }}
      runtime={
        overrides.runtime === undefined
          ? provider.family === 'google'
            ? CONFIGURED_RUNTIME
            : undefined
          : (overrides.runtime ?? undefined)
      }
      onBack={onBack}
      onOpenDetails={onOpenDetails}
      onToggle={onToggle}
      onSetPrimary={onSetPrimary}
      onChanged={onChanged}
    />,
  );
  return { onBack, onOpenDetails, onToggle, onSetPrimary, onChanged };
}

describe('ProviderConfigScreen (simplified Configure AI)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/providers?provider=google');
    mocks.intelligence = intelligenceWithTwoModels();
    mocks.setPrefsMutate.mockResolvedValue({});
    mocks.refreshIntelligenceMutate.mockResolvedValue({});
    mocks.beginGoogleSignIn.mockResolvedValue({ ok: true });
  });

  // ── Structure ────────────────────────────────────────────────────────────
  it('puts Connection first, with API KEY and OAUTH side by side', () => {
    renderScreen();

    expect(screen.getByTestId('config-section-connection')).toBeDefined();
    expect(screen.getByTestId('auth-option-api_key')).toBeDefined();
    expect(screen.getByTestId('auth-option-oauth')).toBeDefined();
    expect(screen.getByTestId('auth-option-api_key').textContent).toMatch(/API KEY/i);
    expect(screen.getByTestId('auth-option-oauth').textContent).toMatch(/OAUTH/i);

    // Connection is the first section on the screen.
    const html = document.body.innerHTML;
    expect(html.indexOf('Connection')).toBeLessThan(html.indexOf('Model</h2>'));
    expect(html.indexOf('Model</h2>')).toBeLessThan(html.indexOf('Usage</h2>'));
  });

  it('hides infrastructure: no endpoint, protocol or deployment for built-in providers', () => {
    renderScreen();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/endpoint/i);
    expect(text).not.toMatch(/protocol/i);
    expect(text).not.toMatch(/deployment/i);
    expect(text).not.toMatch(/api version/i);
    expect(document.querySelector('input[id*="endpoint" i]')).toBeNull();
  });

  it('collapses Advanced by default and shows managed configuration when opened', () => {
    renderScreen();
    expect(screen.queryByTestId('provider-advanced-panel')).toBeNull();

    fireEvent.click(screen.getByTestId('provider-advanced-toggle'));

    const panel = screen.getByTestId('provider-advanced-panel');
    expect(panel.textContent).toMatch(/Managed automatically/);
    expect(panel.textContent).toMatch(/Automatic/);
    // Built-in providers expose no editable infrastructure fields.
    expect(panel.querySelector('input')).toBeNull();
  });

  // ── Model ────────────────────────────────────────────────────────────────
  it('lists the AI real models with Automatic as the default choice', async () => {
    renderScreen();
    const group = screen.getByTestId('provider-model-choices');
    expect(within(group).getByText('Automatic')).toBeDefined();
    expect(within(group).getByText('Gemini 2.5 Pro')).toBeDefined();
    expect(within(group).getByText('Gemini 2.5 Flash')).toBeDefined();

    const radios = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(radios[0]?.checked).toBe(true);

    fireEvent.click(within(group).getByText('Gemini 2.5 Pro'));
    await waitFor(() => {
      expect(mocks.setPrefsMutate).toHaveBeenCalledWith({
        userId: 'u1',
        preferredProviderId: 'google',
        preferredModelId: 'gemini-2.5-pro',
      });
    });
  });

  it('selects the only available model automatically without asking', () => {
    mocks.intelligence = {
      data: {
        record: {
          profile: {
            models: [{ modelId: 'gpt-4o', name: 'GPT-4o', capabilities: { value: ['reasoning'] } }],
          },
        },
      },
      isLoading: false,
    };
    renderScreen({ provider: OPENAI_PROVIDER });
    expect(screen.getByTestId('provider-model-single').textContent).toMatch(/GPT-4o/);
    expect(screen.queryByTestId('provider-model-choices')).toBeNull();
  });

  // ── Capabilities ─────────────────────────────────────────────────────────
  it('shows auto-detected capabilities as read-only text', () => {
    renderScreen();
    const section = screen.getByTestId('config-section-capabilities');
    expect(section.textContent).toMatch(/Thinking & reasoning/);
    expect(section.textContent).toMatch(/Understanding images/);
    expect(section.textContent).toMatch(/Automatically detected/);
    // No manual capability toggles — routing belongs to the orchestrator.
    expect(section.querySelectorAll('input').length).toBe(0);
    expect(section.querySelectorAll('button[role="switch"]').length).toBe(0);
  });

  // ── Usage ────────────────────────────────────────────────────────────────
  it('offers only user-facing usage controls — never manual priorities', () => {
    renderScreen();
    const section = screen.getByTestId('config-section-usage');
    expect(section.textContent).toMatch(/Use this AI/);
    expect(section.textContent).toMatch(/Use as primary AI/);
    expect(section.textContent).toMatch(/Automatic routing/);
    expect(section.textContent).toMatch(/Fallback[\s\S]*Automatic/);
    expect(section.textContent).not.toMatch(/priority\s*\d/i);
  });

  it('explains the default primary AI instead of silently ignoring the switch', () => {
    renderScreen({ noStoredPreference: true });
    const primarySwitch = document.getElementById('provider-primary') as HTMLButtonElement;
    expect(primarySwitch.disabled).toBe(true);
    expect(screen.getByTestId('provider-default-primary-note').textContent).toMatch(
      /default primary AI/i,
    );
  });

  it('makes an AI the primary one through the existing preferences service', () => {
    const { onSetPrimary } = renderScreen({ preferredProviderId: 'openai' });
    const primarySwitch = document.getElementById('provider-primary');
    expect(primarySwitch).not.toBeNull();
    fireEvent.click(primarySwitch as HTMLElement);
    expect(onSetPrimary).toHaveBeenCalledWith('google');
  });

  // ── Connection: API key ──────────────────────────────────────────────────
  it('connects with an API key, shows a friendly failure and offers Try Again', async () => {
    mocks.connectMutate.mockResolvedValue({
      connected: false,
      status: 'failed',
      message: 'Error: 401 UNAUTHORIZED — invalid key sk-live-123',
      errorKind: 'invalid_api_key',
      testedAt: new Date().toISOString(),
      serverManagedKey: false,
      runtimeConfigured: false,
    } satisfies ProviderConnectionResultDTO);
    renderScreen({ runtime: null });

    fireEvent.change(screen.getByTestId('provider-api-key-input'), {
      target: { value: 'sk-test-key' },
    });
    fireEvent.click(screen.getByTestId('provider-test-connection'));

    const error = await waitFor(() => screen.getByTestId('provider-connection-error'));
    expect(error.textContent).toMatch(/Couldn't connect to Gemini\./);
    expect(error.textContent).toMatch(/Check your API key and try again\./);
    // The provider's raw technical error text is never surfaced.
    expect(error.textContent).not.toMatch(/401|UNAUTHORIZED/);
    expect(within(error).getByText('Try Again')).toBeDefined();
    expect(mocks.connectMutate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', family: 'google', apiKey: 'sk-test-key' }),
    );
  });

  it('shows ✓ Connected on success and switches the AI on when it was off', async () => {
    mocks.connectMutate.mockResolvedValue({
      connected: true,
      status: 'connected',
      message: 'Connected — 2 models available',
      latencyMs: 184,
      models: [{ id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }],
      testedAt: new Date().toISOString(),
      serverManagedKey: false,
      runtimeConfigured: true,
    } satisfies ProviderConnectionResultDTO);
    const { onToggle } = renderScreen({ runtime: null, enabled: false });

    fireEvent.change(screen.getByTestId('provider-api-key-input'), {
      target: { value: 'sk-test-key' },
    });
    fireEvent.click(screen.getByTestId('provider-test-connection'));

    const success = await waitFor(() => screen.getByTestId('provider-connection-success'));
    expect(success.textContent).toMatch(/Connected/);
    expect(success.textContent).toMatch(/184 ms/);
    expect(onToggle).toHaveBeenCalledWith('google', true);
    // The key is used for the probe only — it never appears in the DOM output.
    expect(success.innerHTML).not.toContain('sk-test-key');
  });

  // ── Connection: OAuth ────────────────────────────────────────────────────
  it('runs the EXISTING Google authorization flow from the OAuth option', async () => {
    renderScreen();
    fireEvent.click(screen.getByTestId('auth-option-oauth'));

    const connect = screen.getByTestId('provider-oauth-connect');
    expect(connect.textContent).toMatch(/Continue with Google/);
    fireEvent.click(connect);

    await waitFor(() => {
      expect(mocks.beginGoogleSignIn).toHaveBeenCalledWith(
        '/providers?provider=google&oauth=google',
      );
    });
  });

  it('shows the connected account with a Disconnect action after the round trip', () => {
    window.history.replaceState({}, '', '/providers?provider=google&oauth=google');
    renderScreen();
    fireEvent.click(screen.getByTestId('auth-option-oauth'));

    expect(screen.getByTestId('provider-oauth-disconnect')).toBeDefined();
    expect(screen.getByTestId('provider-oauth-panel').textContent).toMatch(/Account connected/);
  });

  it('never offers OAuth for a provider that has none', () => {
    renderScreen({ provider: OPENAI_PROVIDER, runtime: null });
    const oauthOption = screen.getByTestId('auth-option-oauth');
    const radio = oauthOption.querySelector('input') as HTMLInputElement;
    expect(radio.disabled).toBe(true);
    expect(screen.getByTestId('auth-option-oauth-unavailable').textContent).toMatch(
      /OAuth isn't available/i,
    );
    // The API-key flow stays the active one.
    expect(screen.getByTestId('provider-api-key-input')).toBeDefined();
  });

  // ── Custom AI exception ──────────────────────────────────────────────────
  it('lets Custom AI configure its own endpoint and protocol', () => {
    renderScreen({ provider: CUSTOM_PROVIDER, runtime: null });
    // Built-in "managed automatically" rows do not apply to Custom AI.
    expect(document.body.textContent).not.toMatch(/Managed automatically/);

    fireEvent.click(screen.getByTestId('provider-advanced-toggle'));
    const panel = screen.getByTestId('provider-advanced-panel');
    expect(panel.textContent).toMatch(/endpoint/i);
    expect(panel.textContent).toMatch(/protocol/i);
  });
});
