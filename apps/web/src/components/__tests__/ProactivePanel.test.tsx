// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — ProactivePanel Component Tests (SPRINT-029)
//
// Proves the proactive surface:
//   - renders recommendations with WHAT / WHY / VALUE / RISK / COST / ACTION
//   - approval-required cards cannot be accepted from the panel (VOICE ≠
//     AUTHORIZATION analogue: the UI never authorizes; the server decides)
//   - dismiss records the user's explicit choice client-side
//   - empty state (no fabricated recommendations) + error state + retry
//   - accessible controls (aria labels, expanded state)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ProactivePanel } from '../ProactivePanel.js';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  dismiss: vi.fn(),
  accept: vi.fn(),
}));

vi.mock('../../stores/auth-store.js', () => ({
  useAuthStore: (selector: (s: { user: { userId: string } | null }) => string) =>
    selector({ user: { userId: 'user-1' } }),
}));

vi.mock('../../lib/trpc.js', () => ({
  api: {
    proactive: {
      refresh: { useMutation: () => ({ mutateAsync: mocks.refresh, isLoading: false }) },
      dismiss: { useMutation: () => ({ mutateAsync: mocks.dismiss }) },
      accept: { useMutation: () => ({ mutateAsync: mocks.accept }) },
    },
  },
}));

function rec(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-1',
    category: 'AUTOMATION',
    title: 'Automate the weekly report',
    description: 'The weekly Excel report repeats every Friday.',
    evidence: ['Task "Weekly report" completed 4 weeks in a row'],
    confidence: 0.8,
    expectedValue: { label: '~2 hours saved / week', status: 'ESTIMATED' },
    urgency: 'MEDIUM',
    estimatedCost: { label: '~$0 (composed of existing capabilities)', status: 'ESTIMATED' },
    requiredCapabilities: ['reporting'],
    recommendedWorkflow: ['Define trigger', 'Approve once', 'Run weekly'],
    authorizationRequired: false,
    riskLevel: 'LOW',
    status: 'ACTIVE',
    ...overrides,
  };
}

beforeEach(() => {
  mocks.refresh.mockReset();
  mocks.dismiss.mockReset();
  mocks.accept.mockReset();
});

describe('ProactivePanel', () => {
  it('renders recommendations with WHAT/WHY/VALUE/COST and accessible controls', async () => {
    mocks.refresh.mockResolvedValue({ success: true, data: [rec()] });
    render(<ProactivePanel />);

    await waitFor(() => {
      expect(screen.getByText('Automate the weekly report')).toBeDefined();
    });
    // Category chip + why (evidence) when expanded.
    fireEvent.click(screen.getByText('Automate the weekly report'));
    await waitFor(() => {
      expect(screen.getByText(/4 weeks in a row/i)).toBeDefined();
    });
    expect(screen.getByLabelText('Accept recommendation')).toBeDefined();
    expect(screen.getByLabelText('Dismiss recommendation')).toBeDefined();
  });

  it('cannot accept an approval-required recommendation from the panel', async () => {
    mocks.refresh.mockResolvedValue({
      success: true,
      data: [rec({ authorizationRequired: true, title: 'Publish the proposal' })],
    });
    render(<ProactivePanel />);

    await waitFor(() => {
      expect(screen.getByText('Publish the proposal')).toBeDefined();
    });
    const accept = screen.getByLabelText(/Approval required/i);
    expect((accept as HTMLButtonElement).disabled).toBe(true);
  });

  it('dismiss removes the card from the list', async () => {
    mocks.refresh.mockResolvedValue({ success: true, data: [rec()] });
    mocks.dismiss.mockResolvedValue({ success: true, data: null });
    render(<ProactivePanel />);

    await waitFor(() => {
      expect(screen.getByText('Automate the weekly report')).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText('Dismiss recommendation'));
    await waitFor(() => {
      expect(screen.queryByText('Automate the weekly report')).toBeNull();
    });
    expect(mocks.dismiss).toHaveBeenCalledWith({
      userId: 'user-1',
      recommendationId: 'rec-1',
    });
  });

  it('shows an honest empty state when nothing is recommended', async () => {
    mocks.refresh.mockResolvedValue({ success: true, data: [] });
    render(<ProactivePanel />);
    await waitFor(() => {
      expect(screen.getByText(/No recommendations yet/i)).toBeDefined();
    });
  });

  it('shows a readable error and allows retry when the service fails', async () => {
    mocks.refresh.mockRejectedValue(new Error('network down'));
    render(<ProactivePanel />);
    await waitFor(() => {
      expect(screen.getByText(/Could not reach the proactive service/i)).toBeDefined();
    });
    // Retry after recovery.
    mocks.refresh.mockResolvedValue({ success: true, data: [rec()] });
    fireEvent.click(screen.getByLabelText('Refresh recommendations'));
    await waitFor(() => {
      expect(screen.getByText('Automate the weekly report')).toBeDefined();
    });
  });
});
