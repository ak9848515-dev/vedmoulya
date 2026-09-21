// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — GeminiFirstRunDialog tests (PROVIDER-01 first-login onboarding)
//
// Proves the rebuilt first-login contract against the REAL component, with the
// provider endpoints mocked at the api-client boundary (the same boundary the
// component and the embedded SimpleProviderConfig both use):
//   - a new user with a server-managed credential is NEVER asked to connect —
//     the flow verifies automatically and shows the model that was really
//     selected,
//   - an extra step appears ONLY when it is genuinely required, explained in one
//     sentence,
//   - "ready" is unreachable without a real successful connection test,
//   - a failure produces WHAT/WHY/WHAT-next with Retry or Reconnect,
//   - a returning account (including a new device) is not walked through setup
//     again, and is only interrupted if Gemini's credential was really rejected,
//   - nothing here ever asks for or prints a credential.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { GeminiFirstRunDialog } from '../GeminiFirstRunDialog.js';
import { useFirstRunStore } from '../../stores/first-run-store.js';
import type { ProviderConnectionResultDTO } from '../../lib/api-client.js';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  user: { userId: 'u1', email: 'founder@example.com' } as { userId: string; email: string } | null,
  connectMutate: vi.fn(),
  setEnabledMutate: vi.fn(),
  setPrefsMutate: vi.fn(),
  runtimeProviders: [] as Array<{ family: string; status: string }>,
  runtimeLoaded: true,
  preferredModelId: undefined as string | undefined,
  preferredProviderId: 'google' as string | undefined,
  disabledProviderIds: [] as string[],
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('../../stores/auth-store.js', () => ({
  useAuthStore: (selector: (s: { user: typeof mocks.user }) => unknown) => selector(mocks),
}));

vi.mock('../../lib/api-client.js', () => ({
  useProviderRuntimeStatus: () =>
    mocks.runtimeLoaded ? { data: { providers: mocks.runtimeProviders } } : { data: undefined },
  useProviderPreferences: () => ({
    data: {
      userId: 'u1',
      disabledProviderIds: mocks.disabledProviderIds,
      preferredProviderId: mocks.preferredProviderId,
      preferredModelId: mocks.preferredModelId,
      budgetPolicy: 'ask_before_paid',
      budgets: {},
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  }),
  useConnectProvider: () => ({ mutateAsync: mocks.connectMutate }),
  useSetProviderEnabled: () => ({ mutateAsync: mocks.setEnabledMutate }),
  useSetProviderPreferences: () => ({ mutateAsync: mocks.setPrefsMutate }),
}));

// Stub the Radix portal primitives; the dialog content is what's under test.
vi.mock('@vedmoulya/ui', () => ({
  Dialog: ({ open, children }: { open: boolean; children?: React.ReactNode }) =>
    open ? <div data-testid="gemini-dialog">{children}</div> : null,
  DialogPortal: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  DialogOverlay: () => <div aria-hidden="true" />,
  DialogContent: ({
    children,
    ...rest
  }: { children?: React.ReactNode } & Record<string, unknown>) => (
    <div
      role="dialog"
      aria-label={typeof rest['aria-label'] === 'string' ? rest['aria-label'] : 'dialog'}
    >
      {children}
    </div>
  ),
}));

/** Two models, with the registry default offered SECOND — so a passing test
 *  proves the recommendation is chosen deliberately, not by position. */
function connectedGemini(): ProviderConnectionResultDTO {
  return {
    connected: true,
    status: 'connected',
    message: "Connected to Google Gemini via this server's configured credential.",
    latencyMs: 184,
    modelCount: 2,
    models: [
      { id: 'gemini-3.5-pro', name: 'Gemini 3.5 Pro' },
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
    ],
    testedAt: '2026-01-01T00:00:00.000Z',
    serverManagedKey: true,
    runtimeConfigured: true,
  };
}

function failedGemini(
  errorKind: ProviderConnectionResultDTO['errorKind'],
): ProviderConnectionResultDTO {
  return {
    connected: false,
    status: 'failed',
    message: 'Could not connect.',
    ...(errorKind ? { errorKind } : {}),
    testedAt: '2026-01-01T00:00:00.000Z',
    serverManagedKey: true,
    runtimeConfigured: false,
  };
}

describe('GeminiFirstRunDialog (PROVIDER-01 — first-login onboarding)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { userId: 'u1', email: 'founder@example.com' };
    mocks.runtimeProviders = [];
    mocks.runtimeLoaded = true;
    mocks.preferredModelId = undefined;
    mocks.preferredProviderId = 'google';
    mocks.disabledProviderIds = [];
    mocks.setEnabledMutate.mockResolvedValue({});
    mocks.setPrefsMutate.mockResolvedValue({});
    useFirstRunStore.setState({
      geminiPromptDismissed: false,
      geminiConnectDone: false,
      ollamaPromptDismissed: false,
    });
    window.localStorage.clear();
  });

  // ── New user, server-managed credential: no extra step is asked ───────────

  it('verifies automatically and never asks for a credential when the server has one', async () => {
    mocks.runtimeProviders = [{ family: 'google', status: 'CONFIGURED' }];
    mocks.connectMutate.mockResolvedValue(connectedGemini());

    render(<GeminiFirstRunDialog />);

    await waitFor(() => expect(screen.getByTestId('gemini-ready')).toBeDefined());
    // The credential step was NEVER rendered...
    expect(screen.queryByTestId('gemini-connect')).toBeNull();
    expect(screen.queryByTestId('simple-provider-key')).toBeNull();
    // ...and the real endpoint was called with no credential at all.
    expect(mocks.connectMutate).toHaveBeenCalledTimes(1);
    expect(mocks.connectMutate).toHaveBeenCalledWith({ userId: 'u1', family: 'google' });
  });

  it('reaches ready only after a real successful connection test', async () => {
    mocks.runtimeProviders = [{ family: 'google', status: 'CONFIGURED' }];
    let release: ((value: ProviderConnectionResultDTO) => void) | undefined;
    mocks.connectMutate.mockImplementation(
      () =>
        new Promise<ProviderConnectionResultDTO>((resolve) => {
          release = resolve;
        }),
    );

    render(<GeminiFirstRunDialog />);

    // In flight: the automatic sequence is visible and NOTHING is claimed done.
    expect(screen.getByTestId('gemini-preparing')).toBeDefined();
    const pending = screen.getByTestId('gemini-preparing-steps');
    expect(within(pending).getByText('Connecting to Gemini…')).toBeDefined();
    expect(pending.querySelector('[data-step="connecting"]')?.getAttribute('data-done')).toBe(
      'false',
    );
    expect(screen.queryByTestId('gemini-ready')).toBeNull();

    release?.(connectedGemini());

    await waitFor(() => expect(screen.getByTestId('gemini-ready')).toBeDefined());
    expect(screen.queryByTestId('gemini-attention')).toBeNull();
  });

  it('shows the recommended model the provider really offered, and records the verified choice', async () => {
    mocks.runtimeProviders = [{ family: 'google', status: 'CONFIGURED' }];
    mocks.connectMutate.mockResolvedValue(connectedGemini());

    render(<GeminiFirstRunDialog />);

    await waitFor(() => expect(screen.getByTestId('gemini-ready-model')).toBeDefined());
    // The registry default, not merely the first model returned.
    expect(screen.getByTestId('gemini-ready-model').textContent).toContain('Gemini 3.5 Flash');
    expect(screen.getByText(/AI is ready for VedMoulya/i)).toBeDefined();

    await waitFor(() => expect(mocks.setPrefsMutate).toHaveBeenCalled());
    expect(mocks.setEnabledMutate).toHaveBeenCalledWith({
      userId: 'u1',
      providerId: 'google',
      enabled: true,
    });
    // Only non-secret configuration is ever written.
    expect(mocks.setPrefsMutate).toHaveBeenCalledWith({
      userId: 'u1',
      preferredProviderId: 'google',
      preferredModelId: 'gemini-3.5-flash',
    });
  });

  it('still reaches ready when recording the choice fails (verification is the truth)', async () => {
    mocks.runtimeProviders = [{ family: 'google', status: 'CONFIGURED' }];
    mocks.connectMutate.mockResolvedValue(connectedGemini());
    mocks.setEnabledMutate.mockRejectedValue(new Error('write failed'));
    mocks.setPrefsMutate.mockRejectedValue(new Error('write failed'));

    render(<GeminiFirstRunDialog />);
    await waitFor(() => expect(screen.getByTestId('gemini-ready')).toBeDefined());
  });

  it('does not claim a model was discovered when the provider returned none', async () => {
    mocks.runtimeProviders = [{ family: 'google', status: 'CONFIGURED' }];
    mocks.connectMutate.mockResolvedValue({
      ...connectedGemini(),
      modelCount: 0,
      models: [],
    });

    render(<GeminiFirstRunDialog />);
    await waitFor(() => expect(screen.getByTestId('gemini-ready')).toBeDefined());

    // The registry default is used, and NOT persisted as if it were discovered.
    expect(screen.getByTestId('gemini-ready-model').textContent).toContain('gemini-3.5-flash');
    await waitFor(() => expect(mocks.setEnabledMutate).toHaveBeenCalled());
    expect(mocks.setPrefsMutate).toHaveBeenCalledWith({
      userId: 'u1',
      preferredProviderId: 'google',
    });
  });

  // ── No credential on the deployment: exactly one extra step, explained ────

  it('explains the ONE extra step in a single sentence when a step is really needed', async () => {
    mocks.runtimeProviders = [{ family: 'google', status: 'NOT_CONFIGURED' }];
    render(<GeminiFirstRunDialog />);

    await waitFor(() => expect(screen.getByTestId('gemini-consent')).toBeDefined());
    // Nothing was probed — there is nothing to probe with.
    expect(mocks.connectMutate).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Connect Gemini so VedMoulya can use Google's AI for your missions, learning and planning.",
      ),
    ).toBeDefined();
    expect(screen.getByText(/Google sign-in is separate from Gemini/i)).toBeDefined();

    fireEvent.click(screen.getByTestId('gemini-continue'));
    expect(screen.getByTestId('simple-provider-config')).toBeDefined();
    // No endpoint, protocol or environment variable is ever shown to the user.
    expect(document.body.textContent ?? '').not.toMatch(/AI_[A-Z_]+API_KEY|endpoint|protocol/i);
  });

  it('shows the credential field only after the user chooses to continue', async () => {
    mocks.runtimeProviders = [{ family: 'google', status: 'NOT_CONFIGURED' }];
    render(<GeminiFirstRunDialog />);

    await waitFor(() => expect(screen.getByTestId('gemini-consent')).toBeDefined());
    expect(screen.queryByTestId('simple-provider-key')).toBeNull();
    fireEvent.click(screen.getByTestId('gemini-continue'));
    expect(screen.getByTestId('simple-provider-key')).toBeDefined();
  });

  it('finishes from the credential step (real test → discovery → Save & Enable → ready)', async () => {
    mocks.runtimeProviders = [{ family: 'google', status: 'NOT_CONFIGURED' }];
    mocks.connectMutate.mockResolvedValue({
      ...connectedGemini(),
      serverManagedKey: false,
      runtimeConfigured: false,
    });

    render(<GeminiFirstRunDialog />);
    await waitFor(() => expect(screen.getByTestId('gemini-consent')).toBeDefined());
    fireEvent.click(screen.getByTestId('gemini-continue'));

    fireEvent.change(screen.getByTestId('simple-provider-key'), {
      target: { value: 'user-supplied-key' },
    });
    fireEvent.click(screen.getByTestId('simple-provider-test'));
    await waitFor(() => screen.getByTestId('simple-provider-model'));
    fireEvent.click(screen.getByTestId('simple-provider-save'));

    await waitFor(() => expect(screen.getByTestId('gemini-ready')).toBeDefined());
    expect(screen.getByTestId('gemini-ready-model').textContent).toContain('Gemini');
    // Honest when the runtime still cannot execute it — without naming env vars.
    expect(screen.getByText(/server needs its own Gemini credential/i)).toBeDefined();
    expect(document.body.textContent ?? '').not.toMatch(/AI_[A-Z_]+API_KEY/);
    expect(useFirstRunStore.getState().geminiConnectDone).toBe(true);
  });

  // ── Real failures: WHAT / WHY / WHAT next ────────────────────────────────

  it('offers Retry when the verification fails for a transient reason, and retries for real', async () => {
    mocks.runtimeProviders = [{ family: 'google', status: 'CONFIGURED' }];
    mocks.connectMutate
      .mockResolvedValueOnce(failedGemini('unreachable'))
      .mockResolvedValueOnce(connectedGemini());

    render(<GeminiFirstRunDialog />);

    await waitFor(() => expect(screen.getByTestId('gemini-attention')).toBeDefined());
    expect(screen.getByText(/temporarily unavailable/i)).toBeDefined();
    expect(screen.getByText(/check your connection and try again/i)).toBeDefined();
    expect(screen.queryByTestId('gemini-ready')).toBeNull();

    fireEvent.click(screen.getByTestId('gemini-retry'));
    await waitFor(() => expect(screen.getByTestId('gemini-ready')).toBeDefined());
    expect(mocks.connectMutate).toHaveBeenCalledTimes(2);
  });

  it('offers Reconnect when the credential was really rejected', async () => {
    mocks.runtimeProviders = [{ family: 'google', status: 'CONFIGURED' }];
    mocks.connectMutate.mockResolvedValue(failedGemini('invalid_api_key'));

    render(<GeminiFirstRunDialog />);

    await waitFor(() => expect(screen.getByTestId('gemini-attention')).toBeDefined());
    fireEvent.click(screen.getByTestId('gemini-reconnect'));
    expect(screen.getByTestId('simple-provider-config')).toBeDefined();
  });

  it('never shows a raw error or a credential when the request throws', async () => {
    mocks.runtimeProviders = [{ family: 'google', status: 'CONFIGURED' }];
    mocks.connectMutate.mockRejectedValue(new Error('boom: secret-key-abc123'));

    render(<GeminiFirstRunDialog />);
    await waitFor(() => expect(screen.getByTestId('gemini-attention')).toBeDefined());
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/boom|secret-key-abc123|Error:/);
    expect(screen.getByTestId('gemini-retry')).toBeDefined();
  });

  it('does not declare ready from a failed verification', async () => {
    mocks.runtimeProviders = [{ family: 'google', status: 'CONFIGURED' }];
    mocks.connectMutate.mockResolvedValue(failedGemini('unavailable'));

    render(<GeminiFirstRunDialog />);
    await waitFor(() => expect(screen.getByTestId('gemini-attention')).toBeDefined());
    expect(screen.queryByTestId('gemini-ready')).toBeNull();
    expect(mocks.setEnabledMutate).not.toHaveBeenCalled();
    expect(mocks.setPrefsMutate).not.toHaveBeenCalled();
  });

  it('waits for the real runtime read before claiming anything', () => {
    mocks.runtimeLoaded = false;
    render(<GeminiFirstRunDialog />);
    expect(mocks.connectMutate).not.toHaveBeenCalled();
    const steps = screen.getByTestId('gemini-preparing-steps');
    expect(steps.querySelector('[data-step="workspace"]')?.getAttribute('data-done')).toBe('false');
    expect(steps.querySelector('[data-step="connecting"]')?.getAttribute('data-done')).toBe(
      'false',
    );
  });

  // ── Returning users ─────────────────────────────────────────────────────

  it('never appears for a returning account that already completed setup', () => {
    mocks.preferredModelId = 'gemini-3.5-flash';
    mocks.runtimeProviders = [{ family: 'google', status: 'CONFIGURED' }];

    render(<GeminiFirstRunDialog />);
    expect(screen.queryByTestId('gemini-dialog')).toBeNull();
    expect(mocks.connectMutate).not.toHaveBeenCalled();
  });

  it('does not reappear on a new device once the account has a verified choice', () => {
    // Fresh browser: no device flags at all — the account state alone decides.
    mocks.preferredModelId = 'gemini-3.5-flash';
    mocks.runtimeProviders = [{ family: 'google', status: 'CONFIGURED' }];
    useFirstRunStore.setState({ geminiPromptDismissed: false, geminiConnectDone: false });

    render(<GeminiFirstRunDialog />);
    expect(screen.queryByTestId('gemini-dialog')).toBeNull();
  });

  it('surfaces a genuinely rejected credential for a returning account', async () => {
    mocks.preferredModelId = 'gemini-3.5-flash';
    mocks.runtimeProviders = [{ family: 'google', status: 'ERROR' }];

    render(<GeminiFirstRunDialog />);
    expect(screen.getByTestId('gemini-attention')).toBeDefined();
    expect(screen.getByText(/needs attention/i)).toBeDefined();
    expect(screen.getByText(/needs to be renewed/i)).toBeDefined();
    expect(screen.getByTestId('gemini-reconnect')).toBeDefined();
    // The user is not probed automatically; they choose to reconnect.
    expect(mocks.connectMutate).not.toHaveBeenCalled();
  });

  it('never nags a user who switched Gemini off', () => {
    mocks.disabledProviderIds = ['google'];
    mocks.runtimeProviders = [{ family: 'google', status: 'ERROR' }];
    render(<GeminiFirstRunDialog />);
    expect(screen.queryByTestId('gemini-dialog')).toBeNull();
  });

  // ── Never a blocker ─────────────────────────────────────────────────────

  it('never appears when signed out', () => {
    mocks.user = null;
    render(<GeminiFirstRunDialog />);
    expect(screen.queryByTestId('gemini-dialog')).toBeNull();
  });

  it('never re-appears once dismissed, and dismissing never navigates', async () => {
    mocks.runtimeProviders = [{ family: 'google', status: 'NOT_CONFIGURED' }];
    const { unmount } = render(<GeminiFirstRunDialog />);
    await waitFor(() => expect(screen.getByTestId('gemini-consent')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /Not now/i }));
    expect(useFirstRunStore.getState().geminiPromptDismissed).toBe(true);
    expect(mocks.push).not.toHaveBeenCalled();

    unmount();
    render(<GeminiFirstRunDialog />);
    expect(screen.queryByTestId('gemini-dialog')).toBeNull();
  });

  it('"Enter VedMoulya" goes to the dashboard and records completion', async () => {
    mocks.runtimeProviders = [{ family: 'google', status: 'CONFIGURED' }];
    mocks.connectMutate.mockResolvedValue(connectedGemini());

    render(<GeminiFirstRunDialog />);
    await waitFor(() => expect(screen.getByTestId('gemini-ready')).toBeDefined());
    fireEvent.click(screen.getByTestId('gemini-enter'));

    expect(mocks.push).toHaveBeenCalledWith('/');
    expect(useFirstRunStore.getState().geminiConnectDone).toBe(true);
  });
});
