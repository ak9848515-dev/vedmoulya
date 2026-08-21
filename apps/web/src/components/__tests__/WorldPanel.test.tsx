// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — WorldPanel Component Tests (SPRINT-032)
//
// Proves the world-model surface:
//   - renders the bounded MY WORLD snapshot (entities / units / roles)
//   - opportunity pipeline with zero/low-capital budget filters
//   - honest external-signal status (UNAVAILABLE never SUCCESS)
//   - error state + retry + no-execute/no-authorize notice
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { WorldPanel } from '../WorldPanel.js';

const mocks = vi.hoisted(() => ({
  overviewRefetch: vi.fn(),
  pipelineRefetch: vi.fn(),
  briefingRefetch: vi.fn(),
  revenueRefetch: vi.fn(),
}));

vi.mock('../../stores/auth-store.js', () => ({
  useAuthStore: (selector: (s: { user: { userId: string } | null }) => string) =>
    selector({ user: { userId: 'user-1' } }),
}));

vi.mock('../../lib/trpc.js', () => ({
  api: {
    world: {
      overview: {
        useQuery: () => ({ refetch: mocks.overviewRefetch }),
      },
      opportunityPipeline: {
        useQuery: () => ({ refetch: mocks.pipelineRefetch }),
        refetch: mocks.pipelineRefetch,
      },
      // SPRINT-033 — founder briefing + revenue snapshot.
      founderBriefing: {
        useQuery: () => ({ refetch: mocks.briefingRefetch }),
      },
      revenueSnapshot: {
        useQuery: () => ({ refetch: mocks.revenueRefetch }),
      },
    },
  },
}));

function overviewData(overrides: Record<string, unknown> = {}) {
  return {
    bounded: true,
    entityCount: 12,
    relationCount: 30,
    businessUnits: 2,
    roles: 3,
    activeOpportunities: 4,
    emergencyStopEngaged: false,
    autonomyLevel: 1,
    settingsConfirmed: true,
    signals: [
      { kind: 'market_trends', status: 'UNAVAILABLE' },
      { kind: 'ai_model_releases', status: 'UNAVAILABLE' },
    ],
    ...overrides,
  };
}

function pipelineEntry(overrides: Record<string, unknown> = {}) {
  return {
    opportunityId: 'opp-1',
    title: 'AI automation service',
    category: 'Consulting / services',
    status: 'PRESENTED',
    score: 0.6,
    capitalMode: 'LOW_COST',
    riskLevel: 'MEDIUM',
    firstStep: 'Research the market.',
    approvalRequired: true,
    ...overrides,
  };
}

function briefingData(overrides: Record<string, unknown> = {}) {
  return {
    advisory: true,
    hasContent: true,
    today: {
      pendingApprovals: [
        { title: 'AI automation service', category: 'business', status: 'PRESENTED' },
      ],
      activeOpportunities: 1,
      highRiskOpportunities: 0,
      revenueStreams: 1,
      totalEstimatedMonthlyRevenueUsd: 5000,
      emergencyStopEngaged: false,
      settingsConfirmed: true,
    },
    whatChanged: [],
    attention: [],
    signals: [{ kind: 'market_trends', status: 'UNAVAILABLE' }],
    ...overrides,
  };
}

function revenueData(overrides: Record<string, unknown> = {}) {
  return {
    advisory: true,
    streamCount: 1,
    activeStreamCount: 1,
    totalEstimatedMonthlyRevenueUsd: 5000,
    estimatedMargin: 0.6,
    averageAutomationPercentage: 0.8,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.overviewRefetch.mockReset();
  mocks.pipelineRefetch.mockReset();
  mocks.briefingRefetch.mockReset();
  mocks.revenueRefetch.mockReset();
});

describe('WorldPanel', () => {
  it('renders the bounded MY WORLD snapshot', async () => {
    mocks.overviewRefetch.mockResolvedValue({
      data: { success: true, data: overviewData() },
    });
    mocks.pipelineRefetch.mockResolvedValue({
      data: { success: true, data: [pipelineEntry()] },
    });
    mocks.briefingRefetch.mockResolvedValue({
      data: { success: true, data: briefingData() },
    });
    mocks.revenueRefetch.mockResolvedValue({
      data: { success: true, data: revenueData() },
    });
    render(<WorldPanel />);
    await waitFor(() => {
      expect(screen.getByText('12')).toBeDefined(); // entities
      expect(screen.getByText('2')).toBeDefined(); // business units
      expect(screen.getByText('3')).toBeDefined(); // AI roles
    });
  });

  it('renders the founder briefing (advisory) when it has content', async () => {
    mocks.overviewRefetch.mockResolvedValue({
      data: { success: true, data: overviewData() },
    });
    mocks.pipelineRefetch.mockResolvedValue({
      data: { success: true, data: [pipelineEntry()] },
    });
    mocks.briefingRefetch.mockResolvedValue({
      data: { success: true, data: briefingData() },
    });
    mocks.revenueRefetch.mockResolvedValue({
      data: { success: true, data: revenueData() },
    });
    render(<WorldPanel />);
    await waitFor(() => {
      expect(screen.getByText('FOUNDER BRIEFING')).toBeDefined();
      expect(screen.getByText(/1 pending approval/i)).toBeDefined();
    });
    // Advisory-only — the panel never claims execution or authorization.
    expect(
      screen.getByText(/Advisory only — nothing here approves, spends or executes/i),
    ).toBeDefined();
  });

  it('renders the revenue snapshot with evidence-only figures', async () => {
    mocks.overviewRefetch.mockResolvedValue({
      data: { success: true, data: overviewData() },
    });
    mocks.pipelineRefetch.mockResolvedValue({
      data: { success: true, data: [pipelineEntry()] },
    });
    mocks.briefingRefetch.mockResolvedValue({
      data: { success: true, data: briefingData() },
    });
    mocks.revenueRefetch.mockResolvedValue({
      data: { success: true, data: revenueData() },
    });
    render(<WorldPanel />);
    await waitFor(() => {
      expect(screen.getByText('Revenue snapshot')).toBeDefined();
      expect(screen.getByText(/advisory margin 60%/i)).toBeDefined();
    });
    expect(screen.getByText(/Evidence-only figures — never a promise/i)).toBeDefined();
  });

  it('renders the opportunity pipeline with capital-mode chips and approval posture', async () => {
    mocks.overviewRefetch.mockResolvedValue({
      data: { success: true, data: overviewData() },
    });
    mocks.pipelineRefetch.mockResolvedValue({
      data: { success: true, data: [pipelineEntry()] },
    });
    mocks.briefingRefetch.mockResolvedValue({
      data: { success: true, data: briefingData({ hasContent: false }) },
    });
    mocks.revenueRefetch.mockResolvedValue({
      data: { success: true, data: revenueData({ streamCount: 0 }) },
    });
    render(<WorldPanel />);
    await waitFor(() => {
      expect(screen.getByText('AI automation service')).toBeDefined();
    });
    expect(screen.getByText('LOW_COST')).toBeDefined();
    expect(screen.getByText('MEDIUM risk')).toBeDefined();
    expect(screen.getByText('approval required')).toBeDefined();
  });

  it('offers the zero/low-capital budget tiers (₹0 … ₹25,000)', async () => {
    mocks.overviewRefetch.mockResolvedValue({
      data: { success: true, data: overviewData() },
    });
    mocks.pipelineRefetch.mockResolvedValue({
      data: { success: true, data: [] },
    });
    mocks.briefingRefetch.mockResolvedValue({
      data: { success: true, data: briefingData({ hasContent: false }) },
    });
    mocks.revenueRefetch.mockResolvedValue({
      data: { success: true, data: revenueData({ streamCount: 0 }) },
    });
    render(<WorldPanel />);
    await waitFor(() => {
      expect(screen.getByText('₹0')).toBeDefined();
      expect(screen.getByText('₹5,000')).toBeDefined();
      expect(screen.getByText('₹25,000')).toBeDefined();
    });
    // Selecting a tier re-queries the pipeline with that budget.
    fireEvent.click(screen.getByText('₹5,000'));
    await waitFor(() => {
      expect(mocks.pipelineRefetch).toHaveBeenCalled();
    });
  });

  it('shows an honest empty pipeline state (no income promises)', async () => {
    mocks.overviewRefetch.mockResolvedValue({
      data: { success: true, data: overviewData() },
    });
    mocks.pipelineRefetch.mockResolvedValue({ data: { success: true, data: [] } });
    mocks.briefingRefetch.mockResolvedValue({
      data: { success: true, data: briefingData({ hasContent: false }) },
    });
    mocks.revenueRefetch.mockResolvedValue({
      data: { success: true, data: revenueData({ streamCount: 0 }) },
    });
    render(<WorldPanel />);
    await waitFor(() => {
      expect(screen.getByText(/scores are advisory, never promises/i)).toBeDefined();
    });
  });

  it('reports external signals as UNAVAILABLE — never fabricated SUCCESS', async () => {
    mocks.overviewRefetch.mockResolvedValue({
      data: { success: true, data: overviewData() },
    });
    mocks.pipelineRefetch.mockResolvedValue({ data: { success: true, data: [] } });
    mocks.briefingRefetch.mockResolvedValue({
      data: { success: true, data: briefingData({ hasContent: false }) },
    });
    mocks.revenueRefetch.mockResolvedValue({
      data: { success: true, data: revenueData({ streamCount: 0 }) },
    });
    render(<WorldPanel />);
    await waitFor(() => {
      expect(screen.getByText(/status is UNAVAILABLE, never fabricated/i)).toBeDefined();
    });
  });

  it('shows a readable error and allows retry when the service fails', async () => {
    mocks.overviewRefetch.mockResolvedValue({ data: { success: false, data: null } });
    mocks.pipelineRefetch.mockResolvedValue({ data: { success: false, data: null } });
    mocks.briefingRefetch.mockResolvedValue({ data: { success: false, data: null } });
    mocks.revenueRefetch.mockResolvedValue({ data: { success: false, data: null } });
    render(<WorldPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Could not reach the world model/i)).toBeDefined();
    });
    mocks.overviewRefetch.mockResolvedValue({
      data: { success: true, data: overviewData() },
    });
    mocks.pipelineRefetch.mockResolvedValue({
      data: { success: true, data: [pipelineEntry()] },
    });
    mocks.briefingRefetch.mockResolvedValue({
      data: { success: true, data: briefingData() },
    });
    mocks.revenueRefetch.mockResolvedValue({
      data: { success: true, data: revenueData() },
    });
    fireEvent.click(screen.getByLabelText('Refresh world model'));
    await waitFor(() => {
      expect(screen.getByText('AI automation service')).toBeDefined();
    });
  });

  it('never claims execution or authorization — the boundary notice is always present', async () => {
    mocks.overviewRefetch.mockResolvedValue({
      data: { success: true, data: overviewData() },
    });
    mocks.pipelineRefetch.mockResolvedValue({ data: { success: true, data: [] } });
    mocks.briefingRefetch.mockResolvedValue({
      data: { success: true, data: briefingData({ hasContent: false }) },
    });
    mocks.revenueRefetch.mockResolvedValue({
      data: { success: true, data: revenueData({ streamCount: 0 }) },
    });
    render(<WorldPanel />);
    await waitFor(() => {
      expect(screen.getByText(/never executes, spends or authorizes/i)).toBeDefined();
    });
  });
});
