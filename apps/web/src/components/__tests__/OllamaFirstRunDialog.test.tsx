// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — First-Run "Your Private AI Option" Dialog Tests (SPRINT-048)
//
// Proves the Ollama first-run prompt is:
//   - shown once after sign-in (and only when signed in)
//   - never re-shown once dismissed (persisted, no nagging on every login)
//   - non-blocking: "Skip for now" dismisses without navigating
//   - composable: "Set Up Ollama" deep-links to the existing AI Providers page
//   - honest: it never claims Ollama is detected or connected
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { OllamaFirstRunDialog } from '../OllamaFirstRunDialog.js';
import { useFirstRunStore } from '../../stores/first-run-store.js';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  user: { userId: 'u1', email: 'founder@example.com' } as { userId: string; email: string } | null,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('../../stores/auth-store.js', () => ({
  useAuthStore: (selector: (s: { user: { userId: string; email: string } | null }) => unknown) =>
    selector({ user: mocks.user }),
}));

// Stub the heavy @vedmoulya/ui Dialog primitives so the test renders the real
// dialog content deterministically (Radix portal behaviour is not under test).
vi.mock('@vedmoulya/ui', () => ({
  Dialog: ({ open, children }: { open: boolean; children?: React.ReactNode }) =>
    open ? <div data-testid="ollama-dialog">{children}</div> : null,
  DialogPortal: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  DialogOverlay: () => <div aria-hidden="true" />,
  DialogContent: ({ children }: { children?: React.ReactNode }) => (
    <div role="dialog" aria-label="Your Private AI Option">
      {children}
    </div>
  ),
}));

describe('OllamaFirstRunDialog (SPRINT-048 first-run prompt)', () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.user = { userId: 'u1', email: 'founder@example.com' };
    useFirstRunStore.setState({ ollamaPromptDismissed: false });
    window.localStorage.clear();
  });

  it('shows the private-AI prompt once after sign-in', () => {
    render(<OllamaFirstRunDialog />);
    expect(screen.getByText('Run AI locally with Ollama')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Skip for now/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Set Up Ollama/i })).toBeTruthy();
  });

  it('does not claim Ollama is installed or connected (honesty)', () => {
    render(<OllamaFirstRunDialog />);
    expect(screen.queryByText(/Connected/i)).toBeNull();
    expect(screen.queryByText(/Detected/i)).toBeNull();
  });

  it('is never shown again once skipped (persisted dismissal)', () => {
    const { unmount } = render(<OllamaFirstRunDialog />);
    fireEvent.click(screen.getByRole('button', { name: /Skip for now/i }));
    expect(useFirstRunStore.getState().ollamaPromptDismissed).toBe(true);
    unmount();
    render(<OllamaFirstRunDialog />);
    expect(screen.queryByTestId('ollama-dialog')).toBeNull();
  });

  it('deep-links to AI Providers configuration from Set Up Ollama', () => {
    render(<OllamaFirstRunDialog />);
    fireEvent.click(screen.getByRole('button', { name: /Set Up Ollama/i }));
    expect(mocks.push).toHaveBeenCalledWith('/providers?provider=ollama');
    expect(useFirstRunStore.getState().ollamaPromptDismissed).toBe(true);
  });

  it('never appears when signed out', () => {
    mocks.user = null;
    render(<OllamaFirstRunDialog />);
    expect(screen.queryByTestId('ollama-dialog')).toBeNull();
  });
});
