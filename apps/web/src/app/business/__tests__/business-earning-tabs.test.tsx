// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Business earning tabs (LEARN-REVENUE-002)
//
// The Business screen used to answer "Opportunities" and "Finance" with
// "coming soon" while real earning surfaces existed elsewhere. These tests pin
// the replacement: the Finance tab renders the SAME owner-scoped revenue read
// the operations workspace uses, and the Opportunities tab mounts the existing
// opportunity monitoring panel.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  revenue: {
    paidTotal: 1200,
    outstanding: 300,
    overdueCount: 2,
    annualRevenue: 14400,
    currency: 'USD',
  } as Record<string, unknown> | undefined,
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({}) }));

vi.mock('../../../stores/auth-store.js', () => ({
  useAuthStore: (selector?: (state: unknown) => unknown) => {
    const state = { user: { userId: 'u1' }, sessionReady: true };
    return selector ? selector(state) : state;
  },
  useAuthHydrated: () => true,
}));

vi.mock('../../../lib/api-client.js', () => ({
  useBusiness: () => ({ isLoading: false, data: {} }),
  useRevenueOverview: () => ({
    data: mocks.revenue,
    isLoading: false,
    isError: false,
    refetch: mocks.refetch,
  }),
}));

vi.mock('../../../components/OpportunityMonitoringPanel.js', () => ({
  OpportunityMonitoringPanel: () =>
    React.createElement('div', { 'data-testid': 'opportunity-panel' }),
}));

vi.mock('../../../components/AutonomousBusinessPanel.js', () => ({
  AutonomousBusinessPanel: () =>
    React.createElement('div', { 'data-testid': 'autonomous-business-panel' }),
}));

vi.mock('../../../components/ErrorBoundary.js', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock('../../../components/SignInRedirect.js', () => ({
  SignInRedirect: () => React.createElement('div', { 'data-testid': 'sign-in-redirect' }),
}));

const BusinessPage = (await import('../page.js')).default;

describe('Business — earning tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.revenue = {
      paidTotal: 1200,
      outstanding: 300,
      overdueCount: 2,
      annualRevenue: 14400,
      currency: 'USD',
    };
  });

  it('Finance renders the real revenue read instead of a placeholder', async () => {
    const user = userEvent.setup();
    render(React.createElement(BusinessPage));
    await user.click(screen.getByRole('tab', { name: /Finance/i }));

    expect(screen.getByText('$1,200')).toBeDefined();
    expect(screen.getByText('$300')).toBeDefined();
    expect(screen.getByText('$14,400')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it('Opportunities mounts the existing monitoring panel', async () => {
    const user = userEvent.setup();
    render(React.createElement(BusinessPage));
    await user.click(screen.getByRole('tab', { name: /Opportunities/i }));

    expect(screen.getByTestId('opportunity-panel')).toBeDefined();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it('Finance fails honestly — no figures rather than fabricated ones', async () => {
    mocks.revenue = undefined;
    const user = userEvent.setup();
    render(React.createElement(BusinessPage));
    await user.click(screen.getByRole('tab', { name: /Finance/i }));

    // No data yet renders real zeroes (never an estimate) and still no promise.
    expect(screen.getAllByText('$0').length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });
});
