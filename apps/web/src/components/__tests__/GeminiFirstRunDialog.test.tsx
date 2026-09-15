// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — GeminiFirstRunDialog Tests (FINAL-02)
//
// Proves the first-login "Connect your AI" contract:
//   - shown ONCE after sign-in when no provider setup happened (intro step
//     is honest: "Your Google sign-in is separate from Gemini API access")
//   - never shown when signed out, dismissed, or already connected
//   - returning users with a completed connect never see it again
//   - the connect step embeds the REAL SimpleProviderConfig flow (credential
//     only if required → test → discovery → Save & Enable)
//   - success shows the checklist; skipping persists and never blocks
//     VedMoulya (providers can be configured later from /providers)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { GeminiFirstRunDialog } from '../GeminiFirstRunDialog.js';
import { useFirstRunStore } from '../../stores/first-run-store.js';
import type { ProviderConnectionResultDTO } from '../../../lib/api-client.js';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  user: { userId: 'u1', email: 'founder@example.com' } as { userId: string; email: string } | null,
  connectMutate: vi.fn(),
  setEnabledMutate: vi.fn(),
  setPrefsMutate: vi.fn(),
  runtimeProviders: [] as Array<{ family: string; status: string }>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('../../stores/auth-store.js', () => ({
  useAuthStore: (selector: (s: { user: typeof mocks.user }) => unknown) => selector(mocks),
}));

vi.mock('../../lib/api-client.js', () => ({
  useProviderRuntimeStatus: () => ({ data: { providers: mocks.runtimeProviders } }),
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

function connectedGemini(): ProviderConnectionResultDTO {
  return {
    connected: true,
    status: 'connected',
    message:
      "Connected to Google Gemini via this server's configured credential — 1 model available.",
    latencyMs: 210,
    modelCount: 1,
    models: [{ id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }],
    testedAt: new Date().toISOString(),
    serverManagedKey: true,
    runtimeConfigured: true,
  };
}

describe('GeminiFirstRunDialog (FINAL-02 — first-login connect)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { userId: 'u1', email: 'founder@example.com' };
    mocks.runtimeProviders = [];
    mocks.setEnabledMutate.mockResolvedValue({});
    mocks.setPrefsMutate.mockResolvedValue({});
    useFirstRunStore.setState({
      geminiPromptDismissed: false,
      geminiConnectDone: false,
      ollamaPromptDismissed: false,
    });
    window.localStorage.clear();
  });

  it('shows the intro exactly once after sign-in (fresh browser)', () => {
    render(<GeminiFirstRunDialog />);
    expect(screen.getByTestId('gemini-intro')).toBeDefined();
    expect(screen.getByText("Let's connect your AI")).toBeDefined();
    expect(screen.getByText('Google Gemini')).toBeDefined();
    expect(screen.getByText('Recommended')).toBeDefined();
    expect(screen.getByRole('button', { name: /Connect Gemini/i })).toBeDefined();
  });

  it('is honest: states that Google sign-in ≠ Gemini API access', () => {
    render(<GeminiFirstRunDialog />);
    expect(screen.getByText(/separate from Gemini API access/i)).toBeDefined();
  });

  it('never appears when signed out', () => {
    mocks.user = null;
    render(<GeminiFirstRunDialog />);
    expect(screen.queryByTestId('gemini-dialog')).toBeNull();
  });

  it('never re-appears once dismissed (persisted "not now")', () => {
    const { unmount } = render(<GeminiFirstRunDialog />);
    fireEvent.click(screen.getByRole('button', { name: /Not now/i }));
    expect(useFirstRunStore.getState().geminiPromptDismissed).toBe(true);

    unmount();
    render(<GeminiFirstRunDialog />);
    expect(screen.queryByTestId('gemini-dialog')).toBeNull();
  });

  it('never re-appears once Gemini was connected (returning user)', () => {
    useFirstRunStore.setState({ geminiConnectDone: true, geminiPromptDismissed: true });
    render(<GeminiFirstRunDialog />);
    expect(screen.queryByTestId('gemini-dialog')).toBeNull();
  });

  it('does not block VedMoulya: dismissing never navigates and never shows a blocker', () => {
    render(<GeminiFirstRunDialog />);
    fireEvent.click(screen.getByRole('button', { name: /Not now/i }));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('advances to the real connect flow (SimpleProviderConfig embed) from Connect Gemini', () => {
    render(<GeminiFirstRunDialog />);
    fireEvent.click(screen.getByRole('button', { name: /Connect Gemini/i }));

    expect(screen.getByTestId('gemini-connect')).toBeDefined();
    // The embedded SimpleProviderConfig — no endpoint/protocol/deployment ask.
    expect(screen.getByTestId('simple-provider-config')).toBeDefined();
  });

  it('asks for NO credential when the deployment has the server-managed Gemini key', () => {
    mocks.runtimeProviders = [{ family: 'google', status: 'CONFIGURED' }];
    render(<GeminiFirstRunDialog />);
    fireEvent.click(screen.getByRole('button', { name: /Connect Gemini/i }));

    expect(screen.queryByTestId('simple-provider-key')).toBeNull();
    expect(screen.getByText(/server's configured Gemini credential/i)).toBeDefined();
  });

  it('completes: test → discovery → Save & Enable → success checklist', async () => {
    mocks.runtimeProviders = [{ family: 'google', status: 'CONFIGURED' }];
    mocks.connectMutate.mockResolvedValue(connectedGemini());
    render(<GeminiFirstRunDialog />);
    fireEvent.click(screen.getByRole('button', { name: /Connect Gemini/i }));

    fireEvent.click(screen.getByTestId('simple-provider-test'));
    await waitFor(() => screen.getByTestId('simple-provider-model'));
    fireEvent.click(screen.getByTestId('simple-provider-save'));

    await waitFor(() => expect(screen.getByTestId('gemini-success')).toBeDefined());
    const checklist = screen.getByTestId('gemini-success-checklist').textContent ?? '';
    expect(checklist).toContain('Gemini connected');
    expect(checklist).toContain('Model detected');
    expect(checklist).toContain('Provider enabled');
    // Runtime is CONFIGURED in this scenario → "Ready to use" is honest.
    expect(checklist).toContain('Ready to use');
    expect(useFirstRunStore.getState().geminiConnectDone).toBe(true);
  });

  it('success shows the runtime-caveat (not "Ready to use") when the deployment lacks the runtime key', async () => {
    mocks.connectMutate.mockResolvedValue(
      connectedGemini().connected
        ? {
            ...connectedGemini(),
            runtimeConfigured: false,
            runtimeNote:
              'No Gemini credential is configured for this deployment — set AI_GOOGLE_API_KEY server-side to activate AI execution.',
          }
        : connectedGemini(),
    );
    render(<GeminiFirstRunDialog />);
    fireEvent.click(screen.getByRole('button', { name: /Connect Gemini/i }));
    fireEvent.click(screen.getByTestId('simple-provider-test'));
    await waitFor(() => screen.getByTestId('simple-provider-model'));
    fireEvent.click(screen.getByTestId('simple-provider-save'));

    await waitFor(() => expect(screen.getByTestId('gemini-success')).toBeDefined());
    const checklist = screen.getByTestId('gemini-success-checklist').textContent ?? '';
    expect(checklist).not.toContain('Ready to use');
    expect(screen.getByText(/AI_GOOGLE_API_KEY/i)).toBeDefined();
  });

  it('"Start using VedMoulya" navigates to the dashboard and marks the flow done', async () => {
    mocks.connectMutate.mockResolvedValue(connectedGemini());
    mocks.runtimeProviders = [{ family: 'google', status: 'CONFIGURED' }];
    render(<GeminiFirstRunDialog />);
    fireEvent.click(screen.getByRole('button', { name: /Connect Gemini/i }));
    fireEvent.click(screen.getByTestId('simple-provider-test'));
    await waitFor(() => screen.getByTestId('simple-provider-model'));
    fireEvent.click(screen.getByTestId('simple-provider-save'));
    await waitFor(() => screen.getByTestId('gemini-success'));

    fireEvent.click(screen.getByTestId('gemini-success-done'));
    expect(mocks.push).toHaveBeenCalledWith('/dashboard');
    expect(useFirstRunStore.getState().geminiConnectDone).toBe(true);
  });

  it('"Review AI Providers" deep-links to the providers page with the Gemini provider selected', async () => {
    mocks.connectMutate.mockResolvedValue(connectedGemini());
    mocks.runtimeProviders = [{ family: 'google', status: 'CONFIGURED' }];
    render(<GeminiFirstRunDialog />);
    fireEvent.click(screen.getByRole('button', { name: /Connect Gemini/i }));
    fireEvent.click(screen.getByTestId('simple-provider-test'));
    await waitFor(() => screen.getByTestId('simple-provider-model'));
    fireEvent.click(screen.getByTestId('simple-provider-save'));
    await waitFor(() => screen.getByTestId('gemini-success'));

    fireEvent.click(screen.getByRole('button', { name: /Review AI Providers/i }));
    expect(mocks.push).toHaveBeenCalledWith('/providers?provider=google');
    expect(useFirstRunStore.getState().geminiPromptDismissed).toBe(true);
  });
});
