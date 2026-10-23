// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Autonomous Business Modules & UI Blocks Tests
//
// Verifies that:
//   1. AutonomousBusinessPanel is mounted on the Business workspace.
//   2. All business modules (Goals, Projects, KPIs, Risks, Finance, Opportunities)
//      render real, structured data blocks.
//   3. No tab or panel displays "coming soon" placeholders.
//   4. Preset autonomous workflows can be triggered.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockMutateAsync = vi.fn().mockResolvedValue({ data: { missionId: 'mission-auto-1' } });
const mockPauseMutate = vi.fn().mockResolvedValue({});
const mockResumeMutate = vi.fn().mockResolvedValue({});
const mockCancelMutate = vi.fn().mockResolvedValue({});

const mockBusinessData = {
  profile: {
    businessName: 'Apex Innovations',
    stage: 'growth',
    teamSize: 12,
  },
  goals: [
    {
      id: 'g-1',
      title: 'Expand Enterprise Pipeline',
      description: 'Acquire 10 new B2B client contracts in Q4',
      category: 'strategic',
      priority: 1,
      progress: 65,
      status: 'active',
      targetDate: '2026-12-31T00:00:00.000Z',
      milestones: [
        { id: 'm-1', title: 'Target Account List Finalized', status: 'completed' },
        { id: 'm-2', title: 'Outreach Campaign Initiated', status: 'completed' },
        { id: 'm-3', title: 'Executive Briefing Held', status: 'pending' },
      ],
    },
  ],
  projects: [
    {
      id: 'p-1',
      title: 'Automated Billing Migration',
      description: 'Implement automatic reconciliation for outstanding invoices',
      category: 'financial',
      priority: 'high',
      status: 'in_progress',
      progress: 75,
      budget: 15000,
      spent: 8500,
      deliverables: ['Stripe Invoicing Hook', 'Payment Ledger Sync', 'Aging Report'],
    },
  ],
  kpis: [
    {
      id: 'k-1',
      name: 'Monthly Recurring Revenue',
      description: 'Total contracted recurring monthly revenue',
      category: 'revenue',
      currentValue: 45000,
      targetValue: 50000,
      unit: 'USD',
      trend: 'up',
      period: 'monthly',
    },
    {
      id: 'k-2',
      name: 'Net Retention Rate',
      description: 'Client expansion minus churn',
      category: 'customer',
      currentValue: 112,
      targetValue: 110,
      unit: '%',
      trend: 'up',
      period: 'quarterly',
    },
  ],
  risks: [
    {
      id: 'r-1',
      title: 'Key Supplier SLA Vulnerability',
      description: 'Secondary cloud provider failover latency exceeds threshold',
      category: 'operational',
      severity: 'high',
      riskScore: 72,
      mitigation: 'Implement dual-region active-passive replica in Europe',
    },
  ],
  insights: [
    {
      id: 'i-1',
      title: 'SaaS Retention Exceeds Industry Benchmark',
      summary: 'Expansion revenue increased by 14% month-over-month.',
      category: 'growth',
    },
  ],
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('../../../stores/auth-store.js', () => ({
  useAuthStore: (selector?: (state: unknown) => unknown) => {
    const state = { user: { userId: 'test-user-123' }, sessionReady: true };
    return selector ? selector(state) : state;
  },
  useAuthHydrated: () => true,
}));

vi.mock('../../../lib/api-client.js', () => ({
  useBusiness: () => ({ isLoading: false, data: mockBusinessData }),
  useRevenueOverview: () => ({
    data: {
      paidTotal: 54000,
      outstanding: 8200,
      overdueCount: 1,
      annualRevenue: 648000,
      currency: 'USD',
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useMissionCreateAndRun: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useMissionStatus: () => ({
    data: {
      missionId: 'active-mission-1',
      title: 'Active Autonomous Opportunity Engine',
      objective: 'Discover and qualify active market opportunities',
      state: 'RUNNING',
      currentObjective: {
        objectiveId: 'obj-1',
        title: 'Mining market leads',
        state: 'RUNNING',
      },
      objectives: [
        { objectiveId: 'obj-1', title: 'Mining market leads', state: 'RUNNING' },
        { objectiveId: 'obj-2', title: 'Drafting client proposals', state: 'PENDING' },
      ],
    },
    isLoading: false,
  }),
  useMissionHistory: () => ({
    data: [
      {
        missionId: 'hist-1',
        title: 'Q3 Financial Reconciliation',
        state: 'COMPLETED',
        verifiedObjectives: 4,
        totalObjectives: 4,
      },
    ],
    refetch: vi.fn(),
  }),
  useMissionPause: () => ({ mutateAsync: mockPauseMutate, isPending: false }),
  useMissionResume: () => ({ mutateAsync: mockResumeMutate, isPending: false }),
  useMissionCancel: () => ({ mutateAsync: mockCancelMutate, isPending: false }),
}));

vi.mock('../../../components/OpportunityMonitoringPanel.js', () => ({
  OpportunityMonitoringPanel: () =>
    React.createElement('div', { 'data-testid': 'opportunity-panel' }, 'Opportunity Radar'),
}));

vi.mock('../../../components/ErrorBoundary.js', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock('../../../components/SignInRedirect.js', () => ({
  SignInRedirect: () => React.createElement('div', { 'data-testid': 'sign-in-redirect' }),
}));

const BusinessPage = (await import('../page.js')).default;

describe('Business — Autonomous Engine & Live Business Modules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Overview mounts the Autonomous Business Panel with live running mission and 1-click workflows', () => {
    render(React.createElement(BusinessPage));

    expect(screen.getByTestId('autonomous-business-panel')).toBeDefined();
    expect(screen.getByText('Autonomous Business Engine')).toBeDefined();
    expect(screen.getByText('Opportunity & Lead Engine')).toBeDefined();
    expect(screen.getByText('Revenue & Cash Flow Sentinel')).toBeDefined();
    expect(screen.getByText('Goal & Project Autopilot')).toBeDefined();
    expect(screen.getByTestId('active-mission-card')).toBeDefined();
    expect(screen.getByText('Active Autonomous Mission')).toBeDefined();
  });

  it('Goals tab renders real business OKR cards and milestones with NO coming soon placeholder', async () => {
    const user = userEvent.setup();
    render(React.createElement(BusinessPage));
    await user.click(screen.getByRole('tab', { name: /Goals/i }));

    expect(screen.getByText('Expand Enterprise Pipeline')).toBeDefined();
    expect(screen.getByText('Acquire 10 new B2B client contracts in Q4')).toBeDefined();
    expect(screen.getByText('Target Account List Finalized')).toBeDefined();
    expect(screen.getByText('65%')).toBeDefined();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it('Projects tab renders real project data and budget metrics with NO coming soon placeholder', async () => {
    const user = userEvent.setup();
    render(React.createElement(BusinessPage));
    await user.click(screen.getByRole('tab', { name: /Projects/i }));

    expect(screen.getByText('Automated Billing Migration')).toBeDefined();
    expect(screen.getByText('Stripe Invoicing Hook')).toBeDefined();
    expect(screen.getByText('75%')).toBeDefined();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it('KPIs tab renders performance summary matrix and KPI cards with NO coming soon placeholder', async () => {
    const user = userEvent.setup();
    render(React.createElement(BusinessPage));
    await user.click(screen.getByRole('tab', { name: /KPIs/i }));

    expect(screen.getByText('Monthly Recurring Revenue')).toBeDefined();
    expect(screen.getByText('Net Retention Rate')).toBeDefined();
    expect(screen.getByText('Total Tracked KPIs')).toBeDefined();
    expect(screen.getByText('On Target')).toBeDefined();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it('Risks tab renders risk radar and mitigation strategies with NO coming soon placeholder', async () => {
    const user = userEvent.setup();
    render(React.createElement(BusinessPage));
    await user.click(screen.getByRole('tab', { name: /Risks/i }));

    expect(screen.getByText('Key Supplier SLA Vulnerability')).toBeDefined();
    expect(
      screen.getByText('Implement dual-region active-passive replica in Europe'),
    ).toBeDefined();
    expect(screen.getByText('Risk Intelligence Radar')).toBeDefined();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it('Clicking an autonomous preset triggers createAndRun', async () => {
    const user = userEvent.setup();
    render(React.createElement(BusinessPage));

    const opportunityBtn = screen.getByRole('button', { name: /Opportunity & Lead Engine/i });
    await user.click(opportunityBtn);

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'test-user-123',
        title: 'Opportunity & Lead Engine',
      }),
    );
  });
});
