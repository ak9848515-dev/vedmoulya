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
  // The AddProviderPanel (the custom/OpenAI-compatible registration surface)
  // talks to the gateway through the tRPC client, so those two mutations are
  // controllable doubles too.
  testConnectionMutate: vi.fn(),
  registerProviderMutate: vi.fn(),
  // Model-discovery pending state (drives the discover button's spinner).
  refreshPending: false,
}));

vi.mock('../../../lib/api-client.js', () => ({
  useConnectProvider: () => ({ mutateAsync: mocks.connectMutate }),
  useSetProviderPreferences: () => ({ mutateAsync: mocks.setPrefsMutate }),
  useRefreshProviderIntelligence: () => ({
    mutateAsync: mocks.refreshIntelligenceMutate,
    isPending: mocks.refreshPending,
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
      testConnection: { useMutation: () => ({ mutateAsync: mocks.testConnectionMutate }) },
      registerProvider: { useMutation: () => ({ mutateAsync: mocks.registerProviderMutate }) },
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

// A REGISTRY-only family: not part of the gateway's closed connect contract,
// so the advanced screen probes it as an OpenAI-compatible endpoint.
const OPENROUTER_PROVIDER: ProviderExperienceRowDTO = {
  ...GOOGLE_PROVIDER,
  providerId: 'openrouter',
  name: 'OpenRouter',
  family: 'openrouter',
  selectedModel: { id: 'openrouter/auto', name: 'OpenRouter Auto' },
  models: [{ id: 'openrouter/auto', name: 'OpenRouter Auto', capabilities: ['Reasoning'] }],
};

// A built-in whose preset DECLARES a user-configurable endpoint — the only
// shipped case where the probe carries the preset's own endpoint URL.
const OLLAMA_PROVIDER: ProviderExperienceRowDTO = {
  ...GOOGLE_PROVIDER,
  providerId: 'ollama',
  name: 'Ollama (Local)',
  family: 'ollama',
  selectedModel: { id: 'llama3.2', name: 'llama3.2' },
  models: [{ id: 'llama3.2', name: 'llama3.2', capabilities: ['Reasoning'] }],
  availability: 'LOCAL',
};

/** A successful probe result, so tests only state what they care about. */
function connectedResult(
  overrides: Partial<ProviderConnectionResultDTO> = {},
): ProviderConnectionResultDTO {
  return {
    connected: true,
    status: 'connected',
    message: 'Connected',
    latencyMs: 120,
    models: [],
    testedAt: '2026-09-23T00:00:00.000Z',
    serverManagedKey: false,
    runtimeConfigured: true,
    ...overrides,
  };
}

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
    // The OAuth round trip persists a device-local marker, and jsdom keeps
    // localStorage across tests in a file — clear it so no test inherits a
    // previous test's "already authorised" state.
    window.localStorage.clear();
    mocks.intelligence = intelligenceWithTwoModels();
    mocks.setPrefsMutate.mockResolvedValue({});
    mocks.refreshIntelligenceMutate.mockResolvedValue({});
    mocks.beginGoogleSignIn.mockResolvedValue({ ok: true });
    mocks.testConnectionMutate.mockResolvedValue({ connected: true, message: 'ok' });
    mocks.registerProviderMutate.mockResolvedValue({ success: true });
    mocks.refreshPending = false;
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

  it('announces a failed probe by focusing the alert (keyboard users land on Try Again)', async () => {
    mocks.connectMutate.mockResolvedValue({
      connected: false,
      status: 'failed',
      message: 'boom',
      errorKind: 'unreachable',
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
    expect(document.activeElement).toBe(error);
  });

  it('runs the connection test when the key field is submitted (Enter)', async () => {
    mocks.connectMutate.mockResolvedValue({
      connected: false,
      status: 'failed',
      message: 'nope',
      errorKind: 'invalid_api_key',
      testedAt: new Date().toISOString(),
      serverManagedKey: false,
      runtimeConfigured: false,
    } satisfies ProviderConnectionResultDTO);
    renderScreen({ runtime: null });

    const input = screen.getByTestId('provider-api-key-input');
    fireEvent.change(input, { target: { value: 'sk-test-key' } });
    const form = input.closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(mocks.connectMutate).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', family: 'google', apiKey: 'sk-test-key' }),
      );
    });
  });

  it('associates the credential help text with the API key field', () => {
    renderScreen({ runtime: null });

    const input = screen.getByTestId('provider-api-key-input');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    // The help text is real help for assistive tech, not decoration only.
    expect(document.getElementById(describedBy as string)?.textContent).toMatch(/create a key/i);
  });

  it('labels each section with its heading (accessible landmarks)', () => {
    renderScreen();
    for (const [sectionTestId, headingId] of [
      ['config-section-connection', 'connection-heading'],
      ['config-section-model', 'model-heading'],
      ['config-section-capabilities', 'capabilities-heading'],
      ['config-section-usage', 'usage-heading'],
    ] as const) {
      const section = screen.getByTestId(sectionTestId);
      expect(section.getAttribute('aria-labelledby')).toBe(headingId);
      expect(document.getElementById(headingId)).not.toBeNull();
    }
  });

  it('counts discovered models in plain language (no "1 models")', async () => {
    mocks.connectMutate.mockResolvedValue({
      connected: true,
      status: 'connected',
      message: 'Connected',
      latencyMs: 90,
      models: [{ id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }],
      testedAt: new Date().toISOString(),
      serverManagedKey: false,
      runtimeConfigured: true,
    } satisfies ProviderConnectionResultDTO);
    renderScreen({ runtime: null });

    fireEvent.change(screen.getByTestId('provider-api-key-input'), {
      target: { value: 'sk-test-key' },
    });
    fireEvent.click(screen.getByTestId('provider-test-connection'));

    const success = await waitFor(() => screen.getByTestId('provider-connection-success'));
    expect(success.textContent).toMatch(/1 model available/);
    expect(success.textContent).not.toMatch(/1 models/);
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

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCED / OpenAI-compatible path.
//
// This screen is the deliberate advanced path for a family the gateway's
// one-click contract does not cover. These tests pin the contract mapping (a
// registry-only family probes as `openai-compatible`, never as a raw registry
// id), the endpoint rule, the model-discovery fallbacks and every failure
// branch — so the advanced path is as verified as the primary one.
// ─────────────────────────────────────────────────────────────────────────────

describe('ProviderConfigScreen (advanced / OpenAI-compatible path)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/providers?provider=google');
    mocks.intelligence = intelligenceWithTwoModels();
    mocks.setPrefsMutate.mockResolvedValue({});
    mocks.refreshIntelligenceMutate.mockResolvedValue({});
    mocks.beginGoogleSignIn.mockResolvedValue({ ok: true });
    mocks.testConnectionMutate.mockResolvedValue({ connected: true, message: 'ok' });
    mocks.registerProviderMutate.mockResolvedValue({ success: true });
  });

  // ── The connect contract mapping ─────────────────────────────────────────
  it('probes a registry-only provider as the OpenAI-compatible contract family', async () => {
    mocks.connectMutate.mockResolvedValue(connectedResult());
    renderScreen({ provider: OPENROUTER_PROVIDER, runtime: null });

    fireEvent.change(screen.getByTestId('provider-api-key-input'), {
      target: { value: 'sk-test-key' },
    });
    fireEvent.click(screen.getByTestId('provider-test-connection'));

    await waitFor(() => expect(mocks.connectMutate).toHaveBeenCalledTimes(1));
    const payload = mocks.connectMutate.mock.calls[0]?.[0];
    // The gateway only accepts its closed contract — the registry id is mapped.
    expect(payload.family).toBe('openai-compatible');
    // …and no endpoint is invented: this preset declares no default endpoint.
    expect(payload).not.toHaveProperty('endpointUrl');
  });

  it('keeps a contract provider on its own family and sends its preset endpoint', async () => {
    mocks.connectMutate.mockResolvedValue(connectedResult());
    renderScreen({ provider: OLLAMA_PROVIDER, runtime: null });

    fireEvent.change(screen.getByTestId('provider-api-key-input'), {
      target: { value: 'sk-test-key' },
    });
    fireEvent.click(screen.getByTestId('provider-test-connection'));

    await waitFor(() => expect(mocks.connectMutate).toHaveBeenCalledTimes(1));
    expect(mocks.connectMutate.mock.calls[0]?.[0]).toMatchObject({
      family: 'ollama',
      apiKey: 'sk-test-key',
      endpointUrl: 'http://localhost:11434',
    });
  });

  it('switches a registry-only provider on once the advanced probe succeeds', async () => {
    mocks.connectMutate.mockResolvedValue(connectedResult({ latencyMs: 88 }));
    const { onToggle, onChanged } = renderScreen({
      provider: OPENROUTER_PROVIDER,
      runtime: null,
      enabled: false,
    });

    fireEvent.change(screen.getByTestId('provider-api-key-input'), {
      target: { value: 'sk-test-key' },
    });
    fireEvent.click(screen.getByTestId('provider-test-connection'));

    const success = await waitFor(() => screen.getByTestId('provider-connection-success'));
    expect(success.textContent).toMatch(/88 ms/);
    expect(onToggle).toHaveBeenCalledWith('openrouter', true);
    expect(onChanged).toHaveBeenCalled();
  });

  // ── Model discovery / fallbacks ─────────────────────────────────────────
  it('falls back to the registry model list while intelligence has no profile', () => {
    mocks.intelligence = { data: { record: { profile: { models: [] } } }, isLoading: false };
    renderScreen({
      provider: {
        ...GOOGLE_PROVIDER,
        models: [
          { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', capabilities: ['Reasoning'] },
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', capabilities: ['Vision'] },
        ],
      },
    });

    const group = screen.getByTestId('provider-model-choices');
    expect(within(group).getByText('Gemini 2.5 Pro')).toBeDefined();
    // Subtitle comes from the registry capability data, never from marketing copy.
    expect(group.textContent).toMatch(/Thinking & reasoning/);
    expect(group.textContent).toMatch(/Understanding images/);
  });

  it('offers model discovery when nothing is known yet, and reads the registry on demand', async () => {
    mocks.intelligence = { data: { record: { profile: { models: [] } } }, isLoading: false };
    renderScreen({ provider: { ...GOOGLE_PROVIDER, models: [] } });

    expect(screen.queryByTestId('provider-model-choices')).toBeNull();
    expect(screen.queryByTestId('provider-model-single')).toBeNull();

    fireEvent.click(screen.getByTestId('provider-discover-models'));
    await waitFor(() =>
      expect(mocks.refreshIntelligenceMutate).toHaveBeenCalledWith({ userId: 'u1', id: 'google' }),
    );
  });

  it('says so when model discovery fails instead of staying silent', async () => {
    mocks.intelligence = { data: { record: { profile: { models: [] } } }, isLoading: false };
    mocks.refreshIntelligenceMutate.mockRejectedValue(new Error('gateway ECONNREFUSED'));
    renderScreen({ provider: { ...GOOGLE_PROVIDER, models: [] } });

    fireEvent.click(screen.getByTestId('provider-discover-models'));

    const alert = await waitFor(() => screen.getByRole('alert'));
    expect(alert.textContent).toMatch(/Couldn't refresh this AI's models/);
    expect(alert.textContent).not.toMatch(/ECONNREFUSED/);
  });

  it('shows the loading shell while model intelligence is still loading', () => {
    mocks.intelligence = { data: undefined, isLoading: true };
    renderScreen({ provider: { ...GOOGLE_PROVIDER, models: [] } });

    expect(screen.queryByTestId('config-section-connection')).toBeNull();
    expect(document.body.textContent).toMatch(/Loading this AI/);
  });

  // ── Model + usage interactions ───────────────────────────────────────────
  it('names the stored model in the routing summary', () => {
    renderScreen({ preferredProviderId: 'google', preferredModelId: 'gemini-2.5-pro' });
    expect(screen.getByTestId('config-section-usage').textContent).toMatch(/Gemini 2.5 Pro/);
    // …and the stored choice is what the radio group shows as selected.
    const group = screen.getByTestId('provider-model-choices');
    const radios = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(radios.filter((radio) => radio.checked)).toHaveLength(1);
    expect(radios[0]?.checked).toBe(false);
  });

  it('returns to Automatic without touching which AI is primary', async () => {
    renderScreen({ preferredProviderId: 'google', preferredModelId: 'gemini-2.5-pro' });

    fireEvent.click(within(screen.getByTestId('provider-model-choices')).getByText('Automatic'));

    await waitFor(() =>
      expect(mocks.setPrefsMutate).toHaveBeenCalledWith({ userId: 'u1', preferredModelId: null }),
    );
  });

  it('reports a failed model save in plain language', async () => {
    mocks.setPrefsMutate.mockRejectedValue(new Error('constraint violated'));
    renderScreen();

    fireEvent.click(
      within(screen.getByTestId('provider-model-choices')).getByText('Gemini 2.5 Pro'),
    );

    const alert = await waitFor(() => screen.getByRole('alert'));
    expect(alert.textContent).toMatch(/Couldn't save that model/);
    expect(alert.textContent).not.toMatch(/constraint/);
  });

  it('explains that choosing a model also makes this AI primary', () => {
    renderScreen({ preferredProviderId: 'openai' });
    expect(screen.getByTestId('config-section-model').textContent).toMatch(
      /Choosing a specific model makes this AI your primary AI/,
    );
  });

  // ── Usage switches ───────────────────────────────────────────────────────
  it('switches this AI off through the existing preferences service', () => {
    const { onToggle } = renderScreen();
    fireEvent.click(document.getElementById('provider-enabled') as HTMLElement);
    expect(onToggle).toHaveBeenCalledWith('google', false);
  });

  it('unsets the stored primary through the preferences service', async () => {
    renderScreen({ preferredProviderId: 'google' });

    const primary = document.getElementById('provider-primary') as HTMLButtonElement;
    expect(primary).not.toBeNull();
    fireEvent.click(primary);

    await waitFor(() =>
      expect(mocks.setPrefsMutate).toHaveBeenCalledWith({
        userId: 'u1',
        preferredProviderId: null,
        preferredModelId: null,
      }),
    );
  });

  it('surfaces a failed primary change instead of pretending it worked', async () => {
    mocks.setPrefsMutate.mockRejectedValue(new Error('nope'));
    renderScreen({ preferredProviderId: 'google' });

    fireEvent.click(document.getElementById('provider-primary') as HTMLElement);

    const alert = await waitFor(() => screen.getByRole('alert'));
    expect(alert.textContent).toMatch(/Couldn't update the primary AI/);
  });

  // ── Connection: key handling + OAuth failure ─────────────────────────────
  it('can reveal and re-hide the pasted key', () => {
    renderScreen({ runtime: null });

    expect((screen.getByTestId('provider-api-key-input') as HTMLInputElement).type).toBe(
      'password',
    );
    fireEvent.click(screen.getByLabelText('Show API key'));
    expect((screen.getByTestId('provider-api-key-input') as HTMLInputElement).type).toBe('text');
    fireEvent.click(screen.getByLabelText('Hide API key'));
    expect((screen.getByTestId('provider-api-key-input') as HTMLInputElement).type).toBe(
      'password',
    );
  });

  it('lets the user switch from the server credential to their own key', () => {
    renderScreen();

    expect(screen.getByTestId('config-section-connection').textContent).toMatch(
      /server already holds a working credential/,
    );
    expect(screen.queryByTestId('provider-api-key-input')).toBeNull();

    fireEvent.click(screen.getByTestId('provider-use-own-key'));

    expect(screen.getByTestId('provider-api-key-input')).toBeDefined();
    expect(screen.getByTestId('provider-use-own-key').textContent).toMatch(
      /Use the configured credential/,
    );
  });

  it('turns a transport failure into a friendly message, never raw text', async () => {
    mocks.connectMutate.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:4000'));
    renderScreen({ runtime: null });

    fireEvent.change(screen.getByTestId('provider-api-key-input'), {
      target: { value: 'sk-test-key' },
    });
    fireEvent.click(screen.getByTestId('provider-test-connection'));

    const error = await waitFor(() => screen.getByTestId('provider-connection-error'));
    expect(error.textContent).toMatch(/Couldn't connect to Gemini\./);
    expect(error.textContent).not.toMatch(/ECONNREFUSED/);
  });

  it('announces an OAuth failure instead of leaving the user guessing', async () => {
    mocks.beginGoogleSignIn.mockResolvedValue({ ok: false, error: 'offline' });
    renderScreen();

    fireEvent.click(screen.getByTestId('auth-option-oauth'));
    fireEvent.click(screen.getByTestId('provider-oauth-connect'));

    const alert = await waitFor(() => screen.getByRole('alert'));
    expect(alert.textContent).toMatch(/You appear to be offline/);
  });

  // ── Advanced: custom AI registration + detail hand-off ───────────────────
  it('registers a custom AI and refreshes the view model', async () => {
    const { onChanged } = renderScreen({ provider: CUSTOM_PROVIDER, runtime: null });
    fireEvent.click(screen.getByTestId('provider-advanced-toggle'));

    fireEvent.change(screen.getByPlaceholderText('e.g., My Company AI'), {
      target: { value: 'My AI' },
    });
    fireEvent.change(screen.getByPlaceholderText('https://api.example.com/v1'), {
      target: { value: 'https://ai.example.com/v1' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g., gpt-4o, claude-3-sonnet, custom-model'), {
      target: { value: 'my-model' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Provider/ }));

    await waitFor(() => expect(mocks.registerProviderMutate).toHaveBeenCalledTimes(1));
    // The chosen protocol maps onto a family the registry really supports —
    // never a fabricated custom family.
    expect(mocks.registerProviderMutate.mock.calls[0]?.[0]).toMatchObject({
      userId: 'u1',
      family: 'openai',
    });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('opens the full provider detail view from Advanced', () => {
    const { onOpenDetails } = renderScreen();

    fireEvent.click(screen.getByTestId('provider-advanced-toggle'));
    fireEvent.click(screen.getByText('Open provider details'));

    expect(onOpenDetails).toHaveBeenCalledWith('google');
  });

  // ── Probe result rendering ───────────────────────────────────────────────
  it('counts several discovered models in plain language', async () => {
    mocks.connectMutate.mockResolvedValue(
      connectedResult({
        models: [
          { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
        ],
      }),
    );
    renderScreen({ runtime: null });

    fireEvent.change(screen.getByTestId('provider-api-key-input'), {
      target: { value: 'sk-test-key' },
    });
    fireEvent.click(screen.getByTestId('provider-test-connection'));

    const success = await waitFor(() => screen.getByTestId('provider-connection-success'));
    expect(success.textContent).toMatch(/2 models available/);
  });

  it('still reports a passed check when the probe returns no latency or model list', async () => {
    mocks.connectMutate.mockResolvedValue(
      connectedResult({ latencyMs: undefined, models: undefined }),
    );
    renderScreen({ runtime: null });

    fireEvent.change(screen.getByTestId('provider-api-key-input'), {
      target: { value: 'sk-test-key' },
    });
    fireEvent.click(screen.getByTestId('provider-test-connection'));

    const success = await waitFor(() => screen.getByTestId('provider-connection-success'));
    expect(success.textContent).toMatch(/Connected/);
    // Nothing is invented from a measurement that was not reported.
    expect(success.textContent).not.toMatch(/ms/);
    expect(success.textContent).not.toMatch(/model/);
  });

  // ── Capability edges (never fabricate a subtitle) ─────────────────────────
  it('treats a profile model with no capability list as having none', () => {
    mocks.intelligence = {
      data: {
        record: {
          profile: {
            models: [
              { modelId: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', capabilities: {} },
              {
                modelId: 'gemini-2.5-flash',
                name: 'Gemini 2.5 Flash',
                capabilities: { value: ['reasoning'] },
              },
            ],
          },
        },
      },
      isLoading: false,
    };
    renderScreen();

    const group = screen.getByTestId('provider-model-choices');
    expect(within(group).getByText('Gemini 2.5 Pro')).toBeDefined();
    // The one that really reports capabilities still gets plain-language text.
    expect(group.textContent).toMatch(/Thinking & reasoning/);
  });

  it('renders registry models without inventing subtitles for missing capabilities', () => {
    mocks.intelligence = { data: { record: { profile: { models: [] } } }, isLoading: false };
    renderScreen({
      provider: {
        ...GOOGLE_PROVIDER,
        models: [
          { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', capabilities: ['Reasoning'] },
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', capabilities: [] },
        ],
      },
    });

    const group = screen.getByTestId('provider-model-choices');
    expect(within(group).getByText('Gemini 2.5 Flash')).toBeDefined();
    expect(group.textContent).toMatch(/Thinking & reasoning/);
  });

  it('names a stored model the provider no longer offers instead of guessing', () => {
    renderScreen({ preferredProviderId: 'google', preferredModelId: 'retired-model' });
    expect(screen.getByTestId('config-section-usage').textContent).toMatch(/Selected model/);
  });

  it('disables model discovery while a refresh is already in flight', () => {
    mocks.intelligence = { data: { record: { profile: { models: [] } } }, isLoading: false };
    mocks.refreshPending = true;
    renderScreen({ provider: { ...GOOGLE_PROVIDER, models: [] } });

    expect((screen.getByTestId('provider-discover-models') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
