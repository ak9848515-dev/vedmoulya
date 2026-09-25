// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — ProviderConnectFlow tests (G9: the ONE setup experience)
//
// Proves the surface contract of the one-click flow:
//   - Connect runs the ONE setup call with the registry family and the pasted
//     key (the family is the gateway's closed union, never a widened string),
//   - a genuine SUCCESS renders the connected card (provider + model + kind),
//     and Disconnect forgets the credential for the SAME family,
//   - a named failure renders ONE message and exactly ONE next action,
//   - a transport failure is surfaced honestly and is never rendered as
//     connected.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ProviderConnectFlow } from '../ProviderConnectFlow.js';
import type { ProviderSetupResultDTO } from '../../../lib/api-client.js';

const mocks = vi.hoisted(() => ({
  setupMutate: vi.fn(),
  disconnectMutate: vi.fn(),
  status: null as unknown,
  googleConnect: vi.fn(),
  // Mutated per-test to drive the OAuth branches (connected / connecting / error).
  google: { connected: false, connecting: false, error: null as string | null },
  // The setup mutation's in-flight state (drives the Connect button spinner).
  setupPending: false,
}));

// The flow owns no networking of its own — everything goes through the G9
// client hooks, so the hooks are the only thing that needs a double.
vi.mock('../../../lib/api-client.js', () => ({
  useSetupProvider: () => ({ mutateAsync: mocks.setupMutate, isPending: mocks.setupPending }),
  useDisconnectProvider: () => ({ mutateAsync: mocks.disconnectMutate }),
  useProviderSetupStatus: () => ({ data: mocks.status }),
}));

// Google's Connect drives the existing sign-in redirect; no browser navigation
// happens in these tests.
vi.mock('../google-account-connection.js', () => ({
  useGoogleAccountConnection: () => ({
    connected: mocks.google.connected,
    connecting: mocks.google.connecting,
    error: mocks.google.error,
    connect: mocks.googleConnect,
    disconnect: vi.fn(),
  }),
}));

function setupResult(overrides: Partial<ProviderSetupResultDTO>): ProviderSetupResultDTO {
  return {
    outcome: 'SUCCESS',
    connected: true,
    providerId: 'openai',
    stage: 'refresh_state',
    credentialSource: 'USER',
    selectedModel: { id: 'gpt-4o-mini', name: 'gpt-4o-mini' },
    availableModels: [],
    hasModelChoice: false,
    modelSelectionSource: 'provider_default',
    message: 'OpenAI connected',
    credentialStored: true,
    preferencesApplied: true,
    completedAt: '2026-09-23T00:00:00.000Z',
    ...overrides,
  };
}

function typeKey(family: string, value: string): void {
  fireEvent.change(screen.getByTestId(`provider-connect-key-${family}`), {
    target: { value },
  });
}

describe('ProviderConnectFlow (G9 one-click setup)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.status = null;
    mocks.google = { connected: false, connecting: false, error: null };
    mocks.setupPending = false;
    mocks.setupMutate.mockResolvedValue(setupResult({}));
    mocks.disconnectMutate.mockResolvedValue({});
  });

  // ── Connect ──────────────────────────────────────────────────────────────
  it('connect: sends the pasted key and the registry family through the ONE setup call', async () => {
    render(<ProviderConnectFlow userId="u1" family="openai" />);

    // The normal path is a provider card plus ONE action — no endpoint or
    // protocol fields anywhere on it.
    expect(screen.getByTestId('provider-connect-flow')).toBeDefined();
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/endpoint/i);
    expect(html).not.toMatch(/protocol/i);

    // A keyed family cannot connect until the key is supplied.
    expect((screen.getByTestId('provider-connect-openai') as HTMLButtonElement).disabled).toBe(
      true,
    );
    typeKey('openai', 'sk-test-key');
    expect((screen.getByTestId('provider-connect-openai') as HTMLButtonElement).disabled).toBe(
      false,
    );

    fireEvent.click(screen.getByTestId('provider-connect-openai'));

    await waitFor(() =>
      expect(mocks.setupMutate).toHaveBeenCalledWith({
        userId: 'u1',
        family: 'openai',
        apiKey: 'sk-test-key',
      }),
    );
    // The key is never echoed into the DOM.
    expect(document.body.innerHTML).not.toMatch(/sk-test-key/);
  });

  it('connect: a local provider needs no key and passes its own discovery step', async () => {
    mocks.setupMutate.mockResolvedValue(
      setupResult({
        providerId: 'ollama',
        message: 'Ollama connected',
        credentialSource: 'NONE',
        selectedModel: { id: 'llama3.2', name: 'llama3.2' },
      }),
    );
    render(<ProviderConnectFlow userId="u1" family="ollama" />);

    expect(screen.queryByTestId('provider-connect-key-ollama')).toBeNull();
    fireEvent.click(screen.getByTestId('provider-connect-ollama'));

    await waitFor(() =>
      expect(mocks.setupMutate).toHaveBeenCalledWith({ userId: 'u1', family: 'ollama' }),
    );
  });

  // ── Success ──────────────────────────────────────────────────────────────
  it('success: renders the connected card and Disconnect forgets the SAME family', async () => {
    mocks.setupMutate.mockResolvedValue(
      setupResult({ selectedModel: { id: 'gpt-4o-mini', name: 'GPT-4o mini' } }),
    );
    render(<ProviderConnectFlow userId="u1" family="openai" />);

    typeKey('openai', 'sk-test-key');
    fireEvent.click(screen.getByTestId('provider-connect-openai'));

    const card = await waitFor(() => screen.getByTestId('provider-connect-success'));
    expect(card.textContent).toMatch(/OpenAI connected/);
    expect(card.textContent).toMatch(/GPT-4o mini/);
    expect(card.textContent).toMatch(/Cloud/);
    expect(screen.queryByTestId('provider-connect-failure')).toBeNull();

    fireEvent.click(screen.getByTestId('provider-connect-disconnect'));
    await waitFor(() =>
      expect(mocks.disconnectMutate).toHaveBeenCalledWith({ userId: 'u1', family: 'openai' }),
    );
    // The screen returns to the Connect state once the credential is forgotten.
    await waitFor(() => expect(screen.getByTestId('provider-connect-flow')).toBeDefined());
  });

  it('success: the connected card reflects the model the gateway really chose', async () => {
    mocks.setupMutate.mockResolvedValue(
      setupResult({
        hasModelChoice: true,
        selectedModel: { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      }),
    );
    render(<ProviderConnectFlow userId="u1" family="deepseek" />);

    typeKey('deepseek', 'sk-test-key');
    fireEvent.click(screen.getByTestId('provider-connect-deepseek'));

    const card = await waitFor(() => screen.getByTestId('provider-connect-success'));
    expect(card.textContent).toMatch(/DeepSeek Chat/);
    // More than one model existed, so the advanced model choice is offered.
    expect(screen.getByTestId('provider-connect-change-model')).toBeDefined();
  });

  // ── Failure ──────────────────────────────────────────────────────────────
  it('failure: renders the exact stage message and exactly ONE next action', async () => {
    mocks.setupMutate.mockResolvedValue(
      setupResult({
        outcome: 'VALIDATION_FAILED',
        connected: false,
        providerId: 'ollama',
        stage: 'validate',
        credentialSource: 'NONE',
        selectedModel: null,
        modelSelectionSource: 'none',
        message: 'The model did not answer. Start your local server and try again.',
        credentialStored: false,
        preferencesApplied: false,
        recovery: {
          kind: 'start_local_provider',
          actionLabel: 'Start Ollama',
          detail: 'VedMoulya could not reach http://localhost:11434.',
        },
      }),
    );
    render(<ProviderConnectFlow userId="u1" family="ollama" />);

    fireEvent.click(screen.getByTestId('provider-connect-ollama'));

    const failure = await waitFor(() => screen.getByTestId('provider-connect-failure'));
    expect(failure.textContent).toMatch(/did not answer/);
    expect(failure.textContent).toMatch(/localhost:11434/);
    const actions = screen.getAllByTestId('provider-connect-recovery');
    expect(actions).toHaveLength(1);
    expect(actions[0]?.textContent).toMatch(/Start Ollama/);
    expect(screen.queryByTestId('provider-connect-success')).toBeNull();
  });

  it('failure: a transport error is surfaced honestly, never as connected', async () => {
    mocks.setupMutate.mockRejectedValue(
      new Error('VedMoulya could not reach its own gateway. Try again.'),
    );
    render(<ProviderConnectFlow userId="u1" family="openai" />);

    typeKey('openai', 'sk-test-key');
    fireEvent.click(screen.getByTestId('provider-connect-openai'));

    const failure = await waitFor(() => screen.getByTestId('provider-connect-failure'));
    expect(failure.textContent).toMatch(/could not reach its own gateway/);
    expect(screen.queryByTestId('provider-connect-success')).toBeNull();
    // BUGFIX (transport dead end): a transport failure may not be dressed up as
    // a provider verdict — but it must still leave the user a way forward. The
    // gateway attaches a recovery action to every verdict it returns, and this
    // locally-built result has no gateway behind it, so it supplies its own
    // retry. Without it the card was a dead end: the recovery button only
    // renders when an action label exists.
    const recovery = screen.getByTestId('provider-connect-recovery');
    expect(recovery.textContent).toMatch(/Try again/);
    expect(mocks.setupMutate).toHaveBeenCalledTimes(1);

    // And that action really retries — it does not just dismiss the card.
    fireEvent.click(recovery);
    await waitFor(() => expect(mocks.setupMutate).toHaveBeenCalledTimes(2));
  });

  // ── OAuth (Google IDENTITY — a separate action from the Gemini key) ───────
  //
  // BUGFIX (Gemini credential confusion): the `google` family id is the Gemini
  // MODEL VENDOR. Its Connect/"Add key" action takes a GEMINI API KEY, because a
  // Google identity consent can never satisfy a Gemini API call. The account
  // authorization stays reachable as its own explicit action.
  it('oauth: the primary action is the Gemini API key, NOT the Google authorization', async () => {
    render(<ProviderConnectFlow userId="u1" family="google" />);

    // The keyed field is offered up front — this is the Gemini credential.
    expect(screen.getByTestId('provider-connect-key-google')).toBeDefined();
    expect(screen.getByTestId('provider-connect-google').textContent).toMatch(/Add key/);

    // Clicking it can never launch consent when no key is supplied it stays disabled.
    fireEvent.click(screen.getByTestId('provider-connect-google'));
    expect(mocks.googleConnect).not.toHaveBeenCalled();
  });

  it('oauth: the Google IDENTITY authorization has its own explicit action', async () => {
    render(<ProviderConnectFlow userId="u1" family="google" />);

    // Identity is still fully available — it is simply not the way Gemini is
    // connected, so it is never conflated with the API-key path.
    fireEvent.click(screen.getByTestId('provider-connect-google-account'));

    await waitFor(() => expect(mocks.googleConnect).toHaveBeenCalledTimes(1));
    // Authorization alone is not setup — the keyed pipeline has not run.
    expect(mocks.setupMutate).not.toHaveBeenCalled();
  });

  it('oauth: a supplied Gemini key runs the setup pipeline, never the consent flow', async () => {
    mocks.setupMutate.mockResolvedValue(
      setupResult({ providerId: 'google', message: 'Gemini connected' }),
    );
    render(<ProviderConnectFlow userId="u1" family="google" />);

    typeKey('google', 'AIza-test-key');
    fireEvent.click(screen.getByTestId('provider-connect-google'));

    await waitFor(() =>
      expect(mocks.setupMutate).toHaveBeenCalledWith({
        userId: 'u1',
        family: 'google',
        apiKey: 'AIza-test-key',
      }),
    );
    // Consent is not part of connecting Gemini.
    expect(mocks.googleConnect).not.toHaveBeenCalled();
    expect(await waitFor(() => screen.getByTestId('provider-connect-success'))).toBeDefined();
  });

  it('oauth: the OAuth return finishes the pipeline on load (consent → connected, not "not configured")', async () => {
    mocks.setupMutate.mockResolvedValue(
      setupResult({ providerId: 'google', message: 'Google connected' }),
    );
    render(<ProviderConnectFlow userId="u1" family="google" oauthJustCompleted />);

    // No click: the round trip completing is what runs the pipeline.
    await waitFor(() =>
      expect(mocks.setupMutate).toHaveBeenCalledWith({
        userId: 'u1',
        family: 'google',
        oauthCompleted: true,
      }),
    );
    expect(await waitFor(() => screen.getByTestId('provider-connect-success'))).toBeDefined();
  });

  it('oauth: a Gemini failure offers the API KEY as the ONE next action', async () => {
    mocks.setupMutate.mockResolvedValue(
      setupResult({
        outcome: 'VALIDATION_FAILED',
        connected: false,
        providerId: 'google',
        stage: 'validate',
        credentialSource: 'NONE',
        selectedModel: null,
        modelSelectionSource: 'none',
        message: 'Gemini needs a key before VedMoulya can use it.',
        credentialStored: false,
        preferencesApplied: false,
        recovery: { kind: 'check_credential', actionLabel: 'Add key' },
      }),
    );
    render(<ProviderConnectFlow userId="u1" family="google" oauthJustCompleted />);

    const failure = await waitFor(() => screen.getByTestId('provider-connect-failure'));
    expect(failure.textContent).toMatch(/needs a key/);

    const actions = screen.getAllByTestId('provider-connect-recovery');
    expect(actions).toHaveLength(1);
    expect(actions[0]?.textContent).toMatch(/Add key/);

    // The recovery returns to the KEY field — it must never re-run consent,
    // which could not produce a Gemini credential in the first place.
    fireEvent.click(actions[0] as HTMLElement);
    await waitFor(() => expect(screen.getByTestId('provider-connect-key-google')).toBeDefined());
    expect(mocks.googleConnect).not.toHaveBeenCalled();
  });

  it('oauth: an authorization error is announced to the user', () => {
    mocks.google.error = 'You appear to be offline. Check your connection and try again.';
    render(<ProviderConnectFlow userId="u1" family="google" />);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/You appear to be offline/);
    // No provider verdict was reached, so the flow never claims to be connected.
    expect(screen.queryByTestId('provider-connect-success')).toBeNull();
  });

  // ── Advanced ─────────────────────────────────────────────────────────────
  it('advanced: technical details stay hidden until Advanced is opened', () => {
    render(<ProviderConnectFlow userId="u1" family="openai" />);

    // The normal path shows the one primary action and nothing technical.
    expect(screen.getByTestId('provider-connect-openai')).toBeDefined();
    expect(screen.queryByTestId('provider-connect-advanced')).toBeNull();

    fireEvent.click(screen.getByTestId('provider-connect-advanced-toggle'));

    const panel = screen.getByTestId('provider-connect-advanced');
    expect(panel.textContent).toMatch(/Connection/);
    expect(panel.textContent).toMatch(/Managed automatically/);
    expect(panel.textContent).toMatch(/Key stored/);
  });

  it('advanced: the toggled panel reflects the real credential and validation state', () => {
    mocks.status = {
      providerId: 'openai',
      connectionState: 'CONNECTED',
      credentialSource: 'USER',
      selectedModel: null,
      availableModels: [],
      capabilities: [],
      lastValidatedAt: '2026-09-23T00:00:00.000Z',
      runtimeConfigured: true,
    };
    render(<ProviderConnectFlow userId="u1" family="openai" />);

    // A live CONNECTED status is shown on the provider card without claiming setup ran.
    expect(screen.getByTestId('provider-connect-flow').textContent).toMatch(/Connected/);

    fireEvent.click(screen.getByTestId('provider-connect-advanced-toggle'));
    const panel = screen.getByTestId('provider-connect-advanced');
    expect(panel.textContent).toMatch(/Encrypted/);
    expect(panel.textContent).toMatch(/Last checked/);
  });

  it('advanced: an unvalidated provider says "Not yet" rather than inventing a key', () => {
    mocks.status = {
      providerId: 'openai',
      connectionState: 'DISCONNECTED',
      credentialSource: 'NONE',
      selectedModel: null,
      availableModels: [],
      capabilities: [],
      runtimeConfigured: false,
    };
    render(<ProviderConnectFlow userId="u1" family="openai" />);

    fireEvent.click(screen.getByTestId('provider-connect-advanced-toggle'));
    const panel = screen.getByTestId('provider-connect-advanced');
    expect(panel.textContent).toMatch(/Not yet/);
    expect(panel.textContent).not.toMatch(/Last checked/);
  });

  it('advanced: "Open provider details" hands off to the existing detailed surfaces', () => {
    const onAdvanced = vi.fn();
    render(<ProviderConnectFlow userId="u1" family="openai" onAdvanced={onAdvanced} />);

    // The hand-off only exists behind the explicit affordance.
    expect(onAdvanced).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('provider-connect-advanced-toggle'));
    fireEvent.click(screen.getByText('Open provider details'));

    expect(onAdvanced).toHaveBeenCalledTimes(1);
  });

  it('connect: the key field can be revealed and hidden again', () => {
    render(<ProviderConnectFlow userId="u1" family="openai" />);

    const input = screen.getByTestId('provider-connect-key-openai') as HTMLInputElement;
    expect(input.type).toBe('password');

    fireEvent.click(screen.getByLabelText('Show key'));
    expect((screen.getByTestId('provider-connect-key-openai') as HTMLInputElement).type).toBe(
      'text',
    );
    // The control now offers the inverse action, so its name stays truthful.
    expect(screen.getByLabelText('Hide key')).toBeDefined();

    fireEvent.click(screen.getByLabelText('Hide key'));
    expect((screen.getByTestId('provider-connect-key-openai') as HTMLInputElement).type).toBe(
      'password',
    );
  });

  it('advanced: "Change model" hands off to the surfaces that own model choice', async () => {
    mocks.setupMutate.mockResolvedValue(setupResult({ hasModelChoice: true }));
    const onAdvanced = vi.fn();
    render(<ProviderConnectFlow userId="u1" family="deepseek" onAdvanced={onAdvanced} />);

    typeKey('deepseek', 'sk-test-key');
    fireEvent.click(screen.getByTestId('provider-connect-deepseek'));
    await waitFor(() => screen.getByTestId('provider-connect-success'));

    // The model action is an ADVANCED action — it opens the existing advanced
    // surfaces rather than inventing a second model chooser here.
    expect(onAdvanced).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('provider-connect-change-model'));
    expect(onAdvanced).toHaveBeenCalledTimes(1);
  });

  it('failure: a recovery action with no provider-specific step returns to the Connect form', async () => {
    mocks.setupMutate.mockResolvedValue(
      setupResult({
        outcome: 'VALIDATION_FAILED',
        connected: false,
        providerId: 'openai',
        stage: 'validate',
        credentialSource: 'USER',
        selectedModel: null,
        modelSelectionSource: 'none',
        message: 'This AI did not accept the key.',
        credentialStored: false,
        preferencesApplied: false,
        recovery: { kind: 'go_advanced', actionLabel: 'Open advanced settings' },
      }),
    );
    render(<ProviderConnectFlow userId="u1" family="openai" />);

    typeKey('openai', 'sk-test-key');
    fireEvent.click(screen.getByTestId('provider-connect-openai'));

    const failure = await waitFor(() => screen.getByTestId('provider-connect-failure'));
    expect(failure.textContent).toMatch(/did not accept the key/);
    // While the failure is on screen the key field is hidden.
    expect(screen.queryByTestId('provider-connect-key-openai')).toBeNull();

    // A recovery with no provider-specific step (not Google consent, not a
    // local server) returns the user to the form so a corrected key can be
    // supplied — it does not silently re-run the same probe.
    fireEvent.click(screen.getByTestId('provider-connect-recovery'));

    await waitFor(() => expect(screen.getByTestId('provider-connect-key-openai')).toBeDefined());
    expect(mocks.setupMutate).toHaveBeenCalledTimes(1);
  });

  it('failure: a local runtime "not reached" recovery re-runs the scan (never claims it is absent)', async () => {
    mocks.setupMutate.mockResolvedValue(
      setupResult({
        outcome: 'ACTION_REQUIRED',
        connected: false,
        providerId: 'ollama',
        stage: 'validate',
        credentialSource: 'NONE',
        selectedModel: null,
        modelSelectionSource: 'none',
        message: 'VedMoulya could not reach Ollama on this computer.',
        credentialStored: false,
        preferencesApplied: false,
        recovery: { kind: 'start_local_provider', actionLabel: 'Try again' },
      }),
    );
    render(<ProviderConnectFlow userId="u1" family="ollama" />);

    fireEvent.click(screen.getByTestId('provider-connect-ollama'));
    const action = await waitFor(() => screen.getByTestId('provider-connect-recovery'));

    // A local provider's single next action is the local setup itself — the
    // flow re-runs it rather than pointing at a form that cannot help.
    //
    // BUGFIX (local-runtime recovery dead end): the gateway's `retry` recovery
    // was honoured for every family, but `start_local_provider` — the kind a
    // local runtime actually produces — fell through to a bare `setPhase('idle')`.
    // The button then dismissed the card and did nothing, so "Try again" never
    // retried. Both kinds must re-run the scan.
    expect(action.textContent).toMatch(/Try again/);
    fireEvent.click(action);
    await waitFor(() => expect(mocks.setupMutate).toHaveBeenCalledTimes(2));
  });

  it('failure: a local-runtime recovery never claims Ollama is absent', async () => {
    mocks.setupMutate.mockResolvedValue(
      setupResult({
        outcome: 'ACTION_REQUIRED',
        connected: false,
        providerId: 'ollama',
        stage: 'validate',
        credentialSource: 'NONE',
        selectedModel: null,
        modelSelectionSource: 'none',
        message: 'VedMoulya could not reach Ollama on this computer.',
        credentialStored: false,
        preferencesApplied: false,
        recovery: {
          kind: 'start_local_provider',
          actionLabel: 'Try again',
          detail: 'Ollama may not be installed or running — or the address may be wrong.',
        },
      }),
    );
    render(<ProviderConnectFlow userId="u1" family="ollama" />);

    fireEvent.click(screen.getByTestId('provider-connect-ollama'));
    const failure = await waitFor(() => screen.getByTestId('provider-connect-failure'));

    // Only what was MEASURED may be stated: an unanswered request can never
    // prove the runtime is absent, so "isn't installed" is not allowed here.
    expect(failure.textContent).toMatch(/could not reach Ollama/);
    expect(failure.textContent).not.toMatch(/isn't installed/i);
    expect(failure.textContent).not.toMatch(/isn't running/i);

    fireEvent.click(screen.getByTestId('provider-connect-recovery'));
    await waitFor(() => expect(mocks.setupMutate).toHaveBeenCalledTimes(2));
  });

  it('connect: shows the pipeline progress while the setup call is running', async () => {
    // A never-settling promise keeps the flow in its connecting phase.
    mocks.setupMutate.mockReturnValue(new Promise(() => {}));
    render(<ProviderConnectFlow userId="u1" family="ollama" />);

    fireEvent.click(screen.getByTestId('provider-connect-ollama'));

    const progress = await waitFor(() => screen.getByTestId('provider-connect-progress'));
    expect(progress.textContent).toMatch(/Connecting Ollama/);
    expect(progress.textContent).toMatch(/Finding your AI/);
    // The step list is announced, not decorative.
    expect(progress.getAttribute('aria-live')).toBe('polite');
  });

  it('connect: the Connect action reports its in-flight state', () => {
    mocks.setupPending = true;
    render(<ProviderConnectFlow userId="u1" family="ollama" />);

    const action = screen.getByTestId('provider-connect-ollama');
    // A pending pipeline disables the action and shows progress, not the idle icon.
    expect((action as HTMLButtonElement).disabled).toBe(true);
    expect(action.querySelector('.animate-spin')).not.toBeNull();
  });

  it('failure: a non-Error transport rejection still explains the gateway, not the provider', async () => {
    // Some transports reject with a plain value; the flow must neither crash
    // nor invent a provider verdict from it.
    mocks.setupMutate.mockRejectedValue('boom');
    render(<ProviderConnectFlow userId="u1" family="openai" />);

    typeKey('openai', 'sk-test-key');
    fireEvent.click(screen.getByTestId('provider-connect-openai'));

    const failure = await waitFor(() => screen.getByTestId('provider-connect-failure'));
    expect(failure.textContent).toMatch(/could not reach its own gateway/);
    expect(screen.queryByTestId('provider-connect-success')).toBeNull();
  });

  it('success: notes when the deployment\u2019s own credential did the work', async () => {
    mocks.setupMutate.mockResolvedValue(setupResult({ credentialSource: 'PLATFORM' }));
    render(<ProviderConnectFlow userId="u1" family="openai" />);

    typeKey('openai', 'sk-test-key');
    fireEvent.click(screen.getByTestId('provider-connect-openai'));

    const card = await waitFor(() => screen.getByTestId('provider-connect-success'));
    expect(card.textContent).toMatch(/Using this server/);
  });
});
