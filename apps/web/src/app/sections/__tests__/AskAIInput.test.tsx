// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — "Ask VedMoulya anything" Dashboard Section Tests (SPRINT-048)
//
// Proves the immediate-AI-readiness entry point:
//   - typing a question and submitting opens the EXISTING AI Companion with
//     the question queued (no provider setup required to ask)
//   - sample question chips hand off the same way
//   - the readiness chip is HONEST: "AI Ready" only when a registered provider
//     can actually execute; "AI setup needed" otherwise; neutral while loading
//   - the setup-needed state links to AI Providers
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AskAIInput } from '../AskAIInput.js';

const mocks = vi.hoisted(() => ({
  setAiPanelOpen: vi.fn(),
  setPendingQuestion: vi.fn(),
  push: vi.fn(),
  runtimeProviders: [{ canExecute: true }] as Array<{ canExecute: boolean }>,
  runtimeLoading: false,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('../../../stores/ui-store.js', () => ({
  useUIStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      setAiPanelOpen: mocks.setAiPanelOpen,
      setPendingQuestion: mocks.setPendingQuestion,
    }),
}));

vi.mock('../../../lib/api-client.js', () => ({
  useProviderRuntimeStatus: () => ({
    data: { providers: mocks.runtimeProviders },
    isLoading: mocks.runtimeLoading,
    isError: false,
  }),
}));

describe('AskAIInput (SPRINT-048 immediate AI readiness)', () => {
  beforeEach(() => {
    mocks.setAiPanelOpen.mockReset();
    mocks.setPendingQuestion.mockReset();
    mocks.push.mockReset();
    mocks.runtimeProviders = [{ canExecute: true }];
    mocks.runtimeLoading = false;
  });

  it('opens the existing AI Companion with the typed question on submit', () => {
    render(<AskAIInput userId="u1" />);
    fireEvent.change(screen.getByRole('textbox', { name: /Ask VedMoulya anything/i }), {
      target: { value: 'What should I do next?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Ask$/i }));
    expect(mocks.setPendingQuestion).toHaveBeenCalledWith('What should I do next?');
    expect(mocks.setAiPanelOpen).toHaveBeenCalledWith(true);
  });

  it('handles sample question chips directly (no typing needed)', () => {
    render(<AskAIInput userId="u1" />);
    fireEvent.click(screen.getByRole('button', { name: /What should I focus on today/i }));
    expect(mocks.setPendingQuestion).toHaveBeenCalledWith('What should I focus on today?');
    expect(mocks.setAiPanelOpen).toHaveBeenCalledWith(true);
  });

  it('shows an honest AI Ready state when a provider can execute', () => {
    render(<AskAIInput userId="u1" />);
    expect(screen.getByText('AI Ready')).toBeTruthy();
    expect(screen.queryByText(/AI setup needed/i)).toBeNull();
  });

  it('shows AI setup needed when no provider can execute (honesty)', () => {
    mocks.runtimeProviders = [{ canExecute: false }];
    render(<AskAIInput userId="u1" />);
    expect(screen.getByText('AI setup needed')).toBeTruthy();
    expect(screen.queryByText('AI Ready')).toBeNull();
  });

  it('links to AI Providers from the setup-needed state', () => {
    mocks.runtimeProviders = [{ canExecute: false }];
    render(<AskAIInput userId="u1" />);
    fireEvent.click(screen.getByRole('button', { name: /AI setup needed/i }));
    expect(mocks.push).toHaveBeenCalledWith('/providers');
  });

  it('stays neutral while the runtime status is still loading', () => {
    mocks.runtimeLoading = true;
    render(<AskAIInput userId="u1" />);
    expect(screen.getByText('Checking AI…')).toBeTruthy();
    expect(screen.queryByText('AI Ready')).toBeNull();
  });
});
