// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gemini vs Google IDENTITY credential separation (BUGFIX tests)
//
// THE BUG THIS PINS
//   The Gemini family id is the internal string `google`, which is a MODEL
//   VENDOR id — not an authentication method. The one-click flow treated
//   `family === 'google'` as "use the Google identity OAuth", so:
//
//     AI Providers → Gemini → "Add key" → Google consent screen → Continue
//     → back on the Gemini card → still "Gemini needs a key"
//
//   Consent yields an IDENTITY session. Gemini needs an API KEY. They are
//   different credentials, and a Google sign-in can never satisfy a Gemini API
//   call.
//
// WHAT THESE TESTS GUARANTEE
//   1. Gemini's primary action opens API-KEY configuration.
//   2. Gemini's primary action NEVER calls beginGoogleSignIn().
//   3. The Google identity OAuth remains REACHABLE (its own explicit action).
//   4. The key is never echoed into the DOM, and never persisted client-side.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ProviderConnectFlow } from '../ProviderConnectFlow.js';
import { connectActionLabel, providerNeedsKeyUpFront } from '../provider-setup-copy.js';
import { supportsOAuth } from '../provider-ux.js';
import type { ProviderSetupResultDTO } from '../../../lib/api-client.js';

const mocks = vi.hoisted(() => ({
  setupMutate: vi.fn(),
  disconnectMutate: vi.fn(),
  status: null as unknown,
  googleConnect: vi.fn(),
  google: { connected: false, connecting: false, error: null as string | null },
  setupPending: false,
}));

vi.mock('../../../lib/api-client.js', () => ({
  useSetupProvider: () => ({ mutateAsync: mocks.setupMutate, isPending: mocks.setupPending }),
  useDisconnectProvider: () => ({ mutateAsync: mocks.disconnectMutate }),
  useProviderSetupStatus: () => ({ data: mocks.status }),
}));

vi.mock('../google-account-connection.js', () => ({
  useGoogleAccountConnection: () => ({
    connected: mocks.google.connected,
    connecting: mocks.google.connecting,
    error: mocks.google.error,
    connect: mocks.googleConnect,
    disconnect: vi.fn(),
  }),
}));

function geminiResult(overrides: Partial<ProviderSetupResultDTO> = {}): ProviderSetupResultDTO {
  return {
    outcome: 'SUCCESS',
    connected: true,
    providerId: 'google',
    stage: 'refresh_state',
    credentialSource: 'USER',
    selectedModel: { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    availableModels: [],
    hasModelChoice: false,
    modelSelectionSource: 'provider_default',
    message: 'Gemini connected.',
    credentialStored: true,
    preferencesApplied: true,
    completedAt: '2026-09-25T00:00:00.000Z',
    ...overrides,
  };
}

describe('Gemini does NOT use the Google identity OAuth (credential separation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.status = null;
    mocks.google = { connected: false, connecting: false, error: null };
    mocks.setupPending = false;
    mocks.setupMutate.mockResolvedValue(geminiResult());
  });

  // ── The classification itself ─────────────────────────────────────────────

  it('classifies `google` as an API-KEY family (its Connect action is the Gemini key)', () => {
    // THE root-cause assertion: this predicate drives whether the card asks for
    // a key or launches consent. Excluding `google` was the bug.
    expect(providerNeedsKeyUpFront('google')).toBe(true);
    expect(connectActionLabel('google')).toBe('Add key');
  });

  it('keeps only Google IDENTITY as the OAuth-capable family', () => {
    // supportsOAuth answers "can this family offer the Google ACCOUNT
    // authorization?" — it says nothing about the required credential.
    expect(supportsOAuth('google')).toBe(true);
    expect(supportsOAuth('openai')).toBe(false);
  });

  it('still treats the other keyed families as key-up-front', () => {
    for (const family of ['openai', 'anthropic', 'deepseek', 'openrouter']) {
      expect(providerNeedsKeyUpFront(family)).toBe(true);
    }
    // A local provider discovers instead of asking for a key.
    expect(providerNeedsKeyUpFront('ollama')).toBe(false);
  });

  // ── The UI behaviour ──────────────────────────────────────────────────────

  it('Gemini "Add key" opens the API-key field and does NOT start Google OAuth', async () => {
    render(<ProviderConnectFlow userId="u1" family="google" />);

    // The key field is present up front — this is the Gemini API key, not consent.
    expect(screen.getByTestId('provider-connect-key-google')).toBeDefined();
    // The primary action is labelled for what it does.
    expect(screen.getByTestId('provider-connect-google').textContent).toMatch(/Add key/);

    // With no key supplied the action cannot run, so no request is made at all.
    expect((screen.getByTestId('provider-connect-google') as HTMLButtonElement).disabled).toBe(
      true,
    );
    // THE regression must never launch the identity consent screen.
    fireEvent.click(screen.getByTestId('provider-connect-google'));
    expect(mocks.googleConnect).not.toHaveBeenCalled();
  });

  it('entering a Gemini key runs the SETUP pipeline, never beginGoogleSignIn()', async () => {
    render(<ProviderConnectFlow userId="u1" family="google" />);

    fireEvent.change(screen.getByTestId('provider-connect-key-google'), {
      target: { value: 'AIza-test-gemini-key' },
    });
    fireEvent.click(screen.getByTestId('provider-connect-google'));

    await waitFor(() =>
      expect(mocks.setupMutate).toHaveBeenCalledWith({
        userId: 'u1',
        family: 'google',
        apiKey: 'AIza-test-gemini-key',
      }),
    );
    // Consent is not part of connecting Gemini.
    expect(mocks.googleConnect).not.toHaveBeenCalled();
    // The key never appears in the rendered document.
    expect(document.body.innerHTML).not.toMatch(/AIza-test-gemini-key/);
  });

  it('a successful Gemini key reaches the connected state (needs-key → connected)', async () => {
    render(<ProviderConnectFlow userId="u1" family="google" />);

    fireEvent.change(screen.getByTestId('provider-connect-key-google'), {
      target: { value: 'AIza-test-gemini-key' },
    });
    fireEvent.click(screen.getByTestId('provider-connect-google'));

    const card = await waitFor(() => screen.getByTestId('provider-connect-success'));
    expect(card.textContent).toMatch(/Gemini connected/);
    expect(card.textContent).toMatch(/Gemini 2.0 Flash/);
    // The key field is cleared once the credential is stored server-side.
    expect(screen.queryByTestId('provider-connect-key-google')).toBeNull();
  });

  it('an invalid Gemini key surfaces the actionable failure and returns to the key field', async () => {
    mocks.setupMutate.mockResolvedValue(
      geminiResult({
        outcome: 'VALIDATION_FAILED',
        connected: false,
        stage: 'validate',
        credentialStored: false,
        preferencesApplied: false,
        selectedModel: null,
        modelSelectionSource: 'none',
        message: 'Gemini did not accept this key.',
        recovery: { kind: 'check_credential', actionLabel: 'Check key' },
      }),
    );
    render(<ProviderConnectFlow userId="u1" family="google" />);

    fireEvent.change(screen.getByTestId('provider-connect-key-google'), {
      target: { value: 'AIza-wrong' },
    });
    fireEvent.click(screen.getByTestId('provider-connect-google'));

    const failure = await waitFor(() => screen.getByTestId('provider-connect-failure'));
    expect(failure.textContent).toMatch(/did not accept this key/);
    expect(screen.queryByTestId('provider-connect-success')).toBeNull();

    // The recovery must go back to the KEY field, not to a consent screen.
    fireEvent.click(screen.getByTestId('provider-connect-recovery'));
    await waitFor(() => expect(screen.getByTestId('provider-connect-key-google')).toBeDefined());
    expect(mocks.googleConnect).not.toHaveBeenCalled();
  });

  // ── Google identity is preserved, as its own explicit action ──────────────

  it('Google identity login stays REACHABLE through its own explicit action', async () => {
    render(<ProviderConnectFlow userId="u1" family="google" />);

    const accountButton = screen.getByTestId('provider-connect-google-account');
    expect(accountButton.textContent).toMatch(/Connect Google account/);

    fireEvent.click(accountButton);
    // The identity flow is intact and unchanged — just no longer the Connect path.
    await waitFor(() => expect(mocks.googleConnect).toHaveBeenCalledTimes(1));
  });

  it('an OAuth round-trip return runs the keyed pipeline (consent never marks Gemini connected)', async () => {
    // A user who connected their Google account must still supply a Gemini key:
    // identity is not the Gemini credential.
    mocks.setupMutate.mockResolvedValue(
      geminiResult({
        outcome: 'VALIDATION_FAILED',
        connected: false,
        stage: 'validate',
        credentialSource: 'NONE',
        credentialStored: false,
        preferencesApplied: false,
        selectedModel: null,
        modelSelectionSource: 'none',
        message: 'Gemini needs a key before VedMoulya can use it.',
        recovery: { kind: 'check_credential', actionLabel: 'Add key' },
      }),
    );
    render(<ProviderConnectFlow userId="u1" family="google" oauthJustCompleted />);

    const failure = await waitFor(() => screen.getByTestId('provider-connect-failure'));
    expect(failure.textContent).toMatch(/needs a key/);
    // Consent completed, yet the provider is correctly NOT connected.
    expect(screen.queryByTestId('provider-connect-success')).toBeNull();
    // The OAuth return is honoured exactly ONCE. This is the loop guard: the
    // keyless auto-run must never re-arm itself, or the recovery action below
    // would bounce straight back to this failure card forever.
    expect(mocks.setupMutate).toHaveBeenCalledTimes(1);
    const callsBeforeRecovery = mocks.setupMutate.mock.calls.length;

    // And the offered action is the API key, never a second consent round trip.
    fireEvent.click(screen.getByTestId('provider-connect-recovery'));
    await waitFor(() => expect(screen.getByTestId('provider-connect-key-google')).toBeDefined());
    // Returning to the key field must be a STABLE state: the fact that the key
    // field now exists must not itself re-trigger the keyless pipeline.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mocks.setupMutate.mock.calls.length).toBe(callsBeforeRecovery);
    expect(screen.getByTestId('provider-connect-key-google')).toBeDefined();
    expect(mocks.googleConnect).not.toHaveBeenCalled();
  });

  it('does not offer the Google account action for a non-Google family', () => {
    render(<ProviderConnectFlow userId="u1" family="openai" />);
    expect(screen.queryByTestId('provider-connect-google-account')).toBeNull();
  });

  // ── Credential hygiene ────────────────────────────────────────────────────

  it('never writes the Gemini key to browser storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    render(<ProviderConnectFlow userId="u1" family="google" />);

    fireEvent.change(screen.getByTestId('provider-connect-key-google'), {
      target: { value: 'AIza-secret-value' },
    });
    fireEvent.click(screen.getByTestId('provider-connect-google'));
    await waitFor(() => expect(mocks.setupMutate).toHaveBeenCalled());

    // The credential is sent to the server once; it is never persisted client-side.
    const written = setItem.mock.calls.map((call) => String(call[1])).join('\n');
    expect(written).not.toMatch(/AIza-secret-value/);
    setItem.mockRestore();
  });
});
