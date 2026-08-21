// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Founder Command Center Component Tests (SPRINT-034 + SPRINT-035)
//
// Proves the command center is presentation/composition ONLY:
//   - TODAY / PORTFOLIO / INTELLIGENCE / AUTOMATION / APPROVALS tabs render
//     from the EXISTING read models (no new engine)
//   - no-spam TODAY state (no fabricated urgency)
//   - SPRINT-035 drill-downs: revenue-stream cards, opportunity cards,
//     bounded timeline, cost evidence (UNKNOWN never zero)
//   - approvals route ONLY through the existing authority mutation
//     (decideBlueprintApproval → Brain approve/reject)
//   - the boundary notice (never executes/spends/authorizes) is always present
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CommandCenter } from '../CommandCenter.js';

const mocks = vi.hoisted(() => ({
  commandRefetch: vi.fn(),
  rankingRefetch: vi.fn(),
  streamsRefetch: vi.fn(),
  pipelineRefetch: vi.fn(),
  timelineRefetch: vi.fn(),
  radarRefetch: vi.fn(),
  drilldownRefetch: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test fixture
  drilldownData: null as { success: boolean; data: unknown } | null,
  decideMutate: vi.fn(),
  problemRegisterMutate: vi.fn(),
  observationRecordMutate: vi.fn(),
  prospectRegisterMutate: vi.fn(),
  prospectAdvanceMutate: vi.fn(),
}));

vi.mock('../../stores/auth-store.js', () => ({
  useAuthStore: (selector: (s: { user: { userId: string } | null }) => string) =>
    selector({ user: { userId: 'user-1' } }),
}));

vi.mock('../../lib/trpc.js', () => ({
  api: {
    world: {
      commandCenter: {
        useQuery: () => ({ refetch: mocks.commandRefetch }),
      },
      revenueRanking: {
        useQuery: () => ({ refetch: mocks.rankingRefetch }),
      },
      listRevenueStreams: {
        useQuery: () => ({ refetch: mocks.streamsRefetch }),
      },
      opportunityPipeline: {
        useQuery: () => ({ refetch: mocks.pipelineRefetch }),
      },
      timeline: {
        useQuery: () => ({ refetch: mocks.timelineRefetch }),
      },
      opportunityRadar: {
        useQuery: () => ({ refetch: mocks.radarRefetch }),
      },
      opportunityDrilldownView: {
        useQuery: () => ({
          refetch: mocks.drilldownRefetch,
          data: mocks.drilldownData,
          error: null,
          isLoading: false,
        }),
      },
      decideBlueprintApproval: {
        useMutation: () => ({ mutateAsync: mocks.decideMutate }),
      },
      // SPRINT-042 — founder evidence entry (mounted in INTELLIGENCE tab).
      problemList: {
        useQuery: () => ({
          data: { success: true, data: [] },
          refetch: vi.fn(),
          error: null,
          isLoading: false,
        }),
      },
      prospectsList: {
        useQuery: () => ({
          data: { success: true, data: [] },
          refetch: vi.fn(),
          error: null,
          isLoading: false,
        }),
      },
      problemRegister: {
        useMutation: () => ({ mutateAsync: mocks.problemRegisterMutate }),
      },
      observationRecord: {
        useMutation: () => ({ mutateAsync: mocks.observationRecordMutate }),
      },
      prospectRegister: {
        useMutation: () => ({ mutateAsync: mocks.prospectRegisterMutate }),
      },
      prospectAdvance: {
        useMutation: () => ({ mutateAsync: mocks.prospectAdvanceMutate }),
      },
    },
  },
}));

function commandData(overrides: Record<string, unknown> = {}) {
  return {
    ownerId: 'user-1',
    generatedAt: '2026-08-15T00:00:00.000Z',
    advisory: true,
    today: {
      briefingHasContent: true,
      pendingApprovals: [
        { title: 'AI automation service', category: 'business', status: 'PRESENTED' },
      ],
      highRiskOpportunities: 0,
      attention: [
        {
          category: 'business',
          title: 'Review the AI automation service',
          reason: 'Requires a founder decision.',
          approvalRequired: true,
        },
      ],
      changes: [
        {
          type: 'business_unit',
          label: 'New business unit added',
          updatedAt: '2026-08-15T00:00:00.000Z',
        },
      ],
      emergencyStopEngaged: false,
      settingsConfirmed: true,
    },
    portfolio: {
      businessUnits: 2,
      revenueStreams: 1,
      activeRevenueStreams: 1,
      totalEstimatedMonthlyRevenueUsd: 5000,
      costDailyUsd: 1.2,
      costProviderUsd: 0.8,
      revenueVsCost: {
        label:
          'monthly revenue 5000.00 USD vs measured cost 1.200 USD/day — figures only, margin never claimed without evidence',
        status: 'ESTIMATED',
      },
      pipelineOpportunities: 3,
    },
    intelligence: {
      signals: [{ kind: 'market_trends', status: 'UNAVAILABLE' }],
      signalHealth: [{ kind: 'market_trends', status: 'UNAVAILABLE', configured: true }],
      entityCount: 12,
      relationCount: 30,
    },
    automation: {
      workflows: 2,
      blueprintApprovals: [
        {
          id: 'req-1',
          blueprintId: 'bp-1',
          action: 'Deploy workflow',
          status: 'WAITING_FOR_APPROVAL',
        },
      ],
    },
    approvals: [
      {
        id: 'req-1',
        action: 'Deploy workflow',
        reason: 'Blueprint approval required (class C).',
        businessUnitId: 'bu-1',
        workflowId: 'wf-1',
        providerId: 'provider-a',
        estimatedCostUsd: 2.5,
        riskLevel: 'MEDIUM',
        expectedOutcome: 'Workflow deployed',
        reversibility: 'REVERSIBLE',
        authorityRequired: 'BRAIN_APPROVE',
      },
    ],
    ...overrides,
  };
}

function rankingData(overrides: Record<string, unknown> = {}) {
  return {
    entries: [
      {
        streamId: 'rs-1',
        streamName: 'AI automation service',
        kind: 'ai_services',
        estimatedMonthlyRevenueUsd: 10000,
        estimatedMonthlyCostUsd: 500,
        estimatedMargin: 0.95,
        roiUsd: 20,
        rankScore: 0.9,
        assumptions: ['Estimated figures only — never a promise.'],
        advisory: true,
      },
    ],
    ...overrides,
  };
}

function streamRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rs-1',
    name: 'AI automation service',
    kind: 'SERVICE',
    status: 'ACTIVE',
    estimatedMonthlyRevenueUsd: { value: 10000, status: 'ESTIMATED', evidence: ['market sizing'] },
    actualMonthlyRevenueUsd: undefined,
    estimatedMonthlyCostUsd: { value: 500, status: 'ESTIMATED', evidence: ['unit economics'] },
    automationPercentage: { value: 0.8, status: 'ESTIMATED', evidence: ['workflow audit'] },
    note: 'Advisory only.',
    createdAt: '2026-08-15T00:00:00.000Z',
    updatedAt: '2026-08-15T00:00:00.000Z',
    ...overrides,
  };
}

function pipelineRow(overrides: Record<string, unknown> = {}) {
  return {
    opportunityId: 'opp-1',
    title: 'AI automation service',
    category: 'ai_services',
    status: 'PRESENTED',
    score: 0.6,
    capitalMode: 'LOW_COST',
    riskLevel: 'MEDIUM',
    estimatedCost: { label: '₹5,000', status: 'ESTIMATED' },
    firstStep: 'Research the market.',
    approvalRequired: true,
    evidence: ['market scan'],
    ...overrides,
  };
}

function timelineData(overrides: Record<string, unknown> = {}) {
  return {
    ownerId: 'user-1',
    events: [
      {
        eventId: 'ev-1',
        type: 'APPROVAL',
        label: 'Deploy workflow',
        status: 'WAITING_FOR_APPROVAL',
        at: '2026-08-15T00:00:00.000Z',
        stableKey: 'approval:x',
      },
    ],
    hasMore: false,
    offset: 0,
    limit: 10,
    ...overrides,
  };
}

function radarData(overrides: Record<string, unknown> = {}) {
  return {
    ownerId: 'user-1',
    generatedAt: '2026-08-15T00:00:00.000Z',
    entries: [
      {
        problemId: 'problem-1',
        problemStatement: 'Manual invoice reconciliation is slow and error-prone',
        status: 'EXPERIMENT_CANDIDATE',
        revenueState: 'INTEREST',
        level: 2,
        levelLabel: 'COSTLY',
        scores: { problemScore: 0.72, opportunityScore: 0.6, experimentScore: 0.8 },
        evidenceCount: 3,
        hasVerifiedPayment: false,
        nextAction: 'Design the cheapest validation experiment (NO_COST preferred).',
      },
    ],
    counts: {
      newProblems: 1,
      validatedProblems: 0,
      highValueProblems: 1,
      experimentCandidates: 1,
      runningExperiments: 0,
      completedExperiments: 0,
      paymentEvidence: 0,
      businessCandidates: 0,
      rejectedOpportunities: 0,
    },
    advisory: true,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.commandRefetch.mockReset();
  mocks.rankingRefetch.mockReset();
  mocks.streamsRefetch.mockReset();
  mocks.pipelineRefetch.mockReset();
  mocks.timelineRefetch.mockReset();
  mocks.radarRefetch.mockReset();
  mocks.drilldownRefetch.mockReset();
  mocks.drilldownData = null;
  mocks.decideMutate.mockReset();
  mocks.decideMutate.mockResolvedValue({ success: true });
  mocks.problemRegisterMutate.mockReset();
  mocks.problemRegisterMutate.mockResolvedValue({ success: true });
  mocks.observationRecordMutate.mockReset();
  mocks.observationRecordMutate.mockResolvedValue({ success: true });
  mocks.prospectRegisterMutate.mockReset();
  mocks.prospectRegisterMutate.mockResolvedValue({ success: true });
  mocks.prospectAdvanceMutate.mockReset();
  mocks.prospectAdvanceMutate.mockResolvedValue({ success: true });
});

/** Resolve the command/ranking/streams/pipeline/timeline/radar queries with data. */
function primeQueries(
  command = commandData(),
  rank = rankingData(),
  timeline = timelineData(),
  radar = radarData(),
) {
  mocks.commandRefetch.mockResolvedValue({ data: { success: true, data: command } });
  mocks.rankingRefetch.mockResolvedValue({ data: { success: true, data: rank } });
  mocks.streamsRefetch.mockResolvedValue({ data: { success: true, data: [streamRow()] } });
  mocks.pipelineRefetch.mockResolvedValue({ data: { success: true, data: [pipelineRow()] } });
  mocks.timelineRefetch.mockResolvedValue({ data: { success: true, data: timeline } });
  mocks.radarRefetch.mockResolvedValue({ data: { success: true, data: radar } });
}

describe('CommandCenter', () => {
  it('renders the TODAY tab with briefing content and pending approvals', async () => {
    primeQueries();
    render(<CommandCenter />);
    await waitFor(() => {
      expect(screen.getByText('FOUNDER COMMAND CENTER')).toBeDefined();
      expect(screen.getByText('AI automation service')).toBeDefined();
      expect(screen.getByText('What changed')).toBeDefined();
      expect(screen.getByText('New business unit added')).toBeDefined();
    });
  });

  it('shows the no-spam TODAY state when the briefing has no content', async () => {
    primeQueries(
      commandData({
        today: {
          ...commandData().today,
          briefingHasContent: false,
          attention: [],
          pendingApprovals: [],
        },
      }),
    );
    render(<CommandCenter />);
    await waitFor(() => {
      expect(
        screen.getByText(/No briefing content yet — nothing urgent needs attention/i),
      ).toBeDefined();
    });
  });

  it('warns when emergency stop is engaged and settings are unconfirmed', async () => {
    primeQueries(
      commandData({
        today: { ...commandData().today, emergencyStopEngaged: true, settingsConfirmed: false },
      }),
    );
    render(<CommandCenter />);
    await waitFor(() => {
      expect(screen.getByText(/Emergency stop is engaged/i)).toBeDefined();
      expect(screen.getByText(/Autonomy settings are not confirmed/i)).toBeDefined();
    });
  });

  it('renders the PORTFOLIO tab with business units, streams, cost view and cost-weighted ranking', async () => {
    primeQueries();
    render(<CommandCenter />);
    await waitFor(() => {
      expect(screen.getByText('FOUNDER COMMAND CENTER')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Portfolio'));
    await waitFor(() => {
      expect(screen.getByText('business units')).toBeDefined();
      expect(screen.getByText('revenue streams')).toBeDefined();
      expect(screen.getByText(/Cost-weighted revenue ranking/i)).toBeDefined();
      expect(screen.getByText('ROI 20.0×')).toBeDefined();
      expect(screen.getByText(/never pure revenue/i)).toBeDefined();
      // SPRINT-035 cost view: measured provider cost + revenue-vs-cost line.
      expect(screen.getByText(/Measured provider cost \(observed\)/i)).toBeDefined();
      expect(screen.getByText(/ESTIMATED:/i)).toBeDefined();
    });
  });

  it('treats UNKNOWN cost as never-zero in the ranking empty state', async () => {
    primeQueries(commandData(), { entries: [] });
    render(<CommandCenter />);
    await waitFor(() => {
      expect(screen.getByText('FOUNDER COMMAND CENTER')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Portfolio'));
    await waitFor(() => {
      expect(screen.getByText(/UNKNOWN cost is never treated as zero/i)).toBeDefined();
    });
  });

  it('expands a revenue-stream card with identity and evidence detail (SPRINT-035 drill-down)', async () => {
    primeQueries();
    render(<CommandCenter />);
    await waitFor(() => {
      expect(screen.getByText('FOUNDER COMMAND CENTER')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Portfolio'));
    await waitFor(() => {
      expect(screen.getAllByText('AI automation service').length).toBeGreaterThan(0);
    });
    // Collapsed by default — detail hidden.
    expect(screen.queryByText(/kind: SERVICE/i)).toBeNull();
    // The stream card is the LAST 'AI automation service' element in PORTFOLIO
    // (the ranking entry renders first) — expand the card itself.
    fireEvent.click(screen.getAllByText('AI automation service').at(-1) as HTMLElement);
    await waitFor(() => {
      expect(screen.getByText(/kind: SERVICE/i)).toBeDefined();
      expect(screen.getByText(/revenue \(actual\): UNKNOWN/i)).toBeDefined();
      expect(screen.getByText(/Unknown figures are never treated as zero/i)).toBeDefined();
    });
  });

  it('reports world signals as UNAVAILABLE — never fabricated SUCCESS', async () => {
    primeQueries();
    render(<CommandCenter />);
    await waitFor(() => {
      expect(screen.getByText('FOUNDER COMMAND CENTER')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Intelligence'));
    await waitFor(() => {
      expect(screen.getByText(/No live world-data source is reachable/i)).toBeDefined();
      expect(screen.getByText(/status is UNAVAILABLE\/ERROR, never fabricated/i)).toBeDefined();
    });
  });

  it('expands an opportunity card with category/evidence/next-action (SPRINT-035 drill-down)', async () => {
    primeQueries();
    render(<CommandCenter />);
    await waitFor(() => {
      expect(screen.getByText('FOUNDER COMMAND CENTER')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Intelligence'));
    await waitFor(() => {
      expect(screen.getByText('Opportunity pipeline')).toBeDefined();
    });
    // Collapsed by default.
    expect(screen.queryByText(/capital mode: LOW_COST/i)).toBeNull();
    fireEvent.click(screen.getByText('AI automation service'));
    await waitFor(() => {
      expect(screen.getByText(/capital mode: LOW_COST/i)).toBeDefined();
      expect(screen.getByText(/next action: Research the market/i)).toBeDefined();
      expect(screen.getByText(/evidence: market scan/i)).toBeDefined();
      expect(screen.getByText(/Advisory score — never a promise, never a launch/i)).toBeDefined();
    });
  });

  it('renders the AUTOMATION tab with workflows, blueprint approvals and the bounded timeline', async () => {
    primeQueries();
    render(<CommandCenter />);
    await waitFor(() => {
      expect(screen.getByText('FOUNDER COMMAND CENTER')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Automation'));
    await waitFor(() => {
      expect(screen.getByText(/2 defined workflows/)).toBeDefined();
      // 'Deploy workflow' appears in both the blueprint list and the timeline.
      expect(screen.getAllByText('Deploy workflow').length).toBeGreaterThan(0);
      expect(screen.getAllByText('WAITING_FOR_APPROVAL').length).toBeGreaterThan(0);
      expect(screen.getByText(/Blueprints never execute/i)).toBeDefined();
      // SPRINT-035 bounded timeline.
      expect(screen.getByText('Recent activity')).toBeDefined();
      expect(screen.getByText(/Bounded history — never an unbounded query/i)).toBeDefined();
    });
  });

  it('routes APPROVALS decisions only through the existing authority mutation', async () => {
    primeQueries();
    render(<CommandCenter />);
    await waitFor(() => {
      expect(screen.getByText('FOUNDER COMMAND CENTER')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Approvals'));
    await waitFor(() => {
      expect(screen.getByText('Deploy workflow')).toBeDefined();
      expect(screen.getByText('MEDIUM risk')).toBeDefined();
      expect(screen.getByText(/est\. cost: \$2\.50/)).toBeDefined();
      expect(screen.getByText('reversibility: REVERSIBLE')).toBeDefined();
      expect(screen.getByText('authority required: BRAIN_APPROVE')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Approve'));
    await waitFor(() => {
      expect(mocks.decideMutate).toHaveBeenCalledWith({
        userId: 'user-1',
        requestId: 'req-1',
        decision: 'APPROVED',
      });
    });
    expect(screen.getByText(/no voice shortcut, no implicit approval/i)).toBeDefined();
  });

  it('surfaces a rejection from the approval authority without executing anything', async () => {
    primeQueries();
    mocks.decideMutate.mockResolvedValue({
      success: false,
      error: { message: 'Approval refused: class D action.' },
    });
    render(<CommandCenter />);
    await waitFor(() => {
      expect(screen.getByText('FOUNDER COMMAND CENTER')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Approvals'));
    await waitFor(() => {
      expect(screen.getByText('Deploy workflow')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Reject'));
    await waitFor(() => {
      expect(screen.getByText(/Approval refused: class D action/i)).toBeDefined();
    });
    // A rejected approval must not be reported as executed or approved.
    expect(screen.queryByText(/approved and executed/i)).toBeNull();
  });

  it('renders the Opportunity Radar with stage counts and evidence honesty (SPRINT-038)', async () => {
    primeQueries();
    render(<CommandCenter />);
    await waitFor(() => {
      expect(screen.getByText('FOUNDER COMMAND CENTER')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Intelligence'));
    await waitFor(() => {
      expect(screen.getByText('Opportunity radar')).toBeDefined();
      expect(screen.getByText('experiment candidates')).toBeDefined();
      expect(
        screen.getByText('Manual invoice reconciliation is slow and error-prone'),
      ).toBeDefined();
      expect(screen.getByText(/COSTLY/)).toBeDefined();
    });
    // Interest is NOT revenue — the radar never claims verified payment.
    fireEvent.click(screen.getByText('Manual invoice reconciliation is slow and error-prone'));
    await waitFor(() => {
      expect(screen.getByText(/revenue state: INTEREST/i)).toBeDefined();
      expect(screen.getByText(/Interest is not revenue/i)).toBeDefined();
    });
  });

  it('shows the radar EMPTY state — never fabricated problems', async () => {
    primeQueries(commandData(), rankingData(), timelineData(), {
      ...radarData(),
      entries: [],
      counts: radarData().counts,
    });
    render(<CommandCenter />);
    await waitFor(() => {
      expect(screen.getByText('FOUNDER COMMAND CENTER')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Intelligence'));
    await waitFor(() => {
      expect(
        screen.getByText(/No radar entries yet — the dataset is EMPTY by design/i),
      ).toBeDefined();
    });
  });

  it('toggles the radar between List and Spatial over the SAME data — no duplicate fetching (SPRINT-043D)', async () => {
    primeQueries();
    render(<CommandCenter />);
    await waitFor(() => {
      expect(screen.getByText('FOUNDER COMMAND CENTER')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Intelligence'));
    await waitFor(() => {
      expect(screen.getByText('Opportunity radar')).toBeDefined();
    });
    // List is the default (a11y/information-dense fallback) — no SVG yet.
    expect(screen.getByText('Manual invoice reconciliation is slow and error-prone')).toBeDefined();
    expect(screen.queryByTestId('radar-spatial')).toBeNull();
    const refetchesBefore = mocks.radarRefetch.mock.calls.length;

    // Switch to the spatial Radar view — the same entries, a different projection.
    fireEvent.click(screen.getByRole('button', { name: 'Radar' }));
    await waitFor(() => {
      expect(screen.getByTestId('radar-spatial')).toBeDefined();
    });
    expect(screen.getByRole('button', { name: 'Radar' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'List' }).getAttribute('aria-pressed')).toBe('false');
    // The list and the SVG are never rendered simultaneously.
    expect(screen.queryByText('Manual invoice reconciliation is slow and error-prone')).toBeNull();
    // Switching views must NOT trigger another gateway fetch.
    expect(mocks.radarRefetch.mock.calls.length).toBe(refetchesBefore);

    // Back to the dense list — the fallback returns, still no refetch.
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    await waitFor(() => {
      expect(
        screen.getByText('Manual invoice reconciliation is slow and error-prone'),
      ).toBeDefined();
    });
    expect(screen.queryByTestId('radar-spatial')).toBeNull();
    expect(mocks.radarRefetch.mock.calls.length).toBe(refetchesBefore);
  });

  it('reveals Digital Twin dimensions only from already-loaded data (SPRINT-043D)', async () => {
    primeQueries();
    render(<CommandCenter />);
    await waitFor(() => {
      expect(screen.getByText('FOUNDER COMMAND CENTER')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Intelligence'));
    await waitFor(() => {
      // Section header + SVG <title> both carry the label.
      expect(screen.getAllByText('Digital Twin').length).toBeGreaterThan(0);
      // The twin forms while reads are loading, then reveals real dimensions —
      // no new queries, no invented state (hooks-order regression: this path
      // crashed when dimensions changed from empty to populated).
      expect(screen.getByTestId('twin-spatial')).toBeDefined();
    });
    // Composed from the SAME reads: opportunities + evidence (radar), progress (pipeline).
    expect(screen.getAllByTestId(/^twin-node-/)).toHaveLength(3);
    // Selecting a dimension exposes its honest value from the same data.
    fireEvent.click(screen.getByTestId('twin-node-evidence'));
    expect(screen.getAllByText(/3 evidence records/).length).toBeGreaterThan(0);
  });

  it('loads the SPRINT-039 drill-down — evidence, prospects and next best action', async () => {
    primeQueries();
    mocks.drilldownData = {
      success: true,
      data: {
        problem: {
          problemStatement: 'Manual follow-up',
          status: 'VALIDATED_PROBLEM',
          revenueState: 'INTEREST',
        },
        assessment: null,
        observations: [
          {
            observedStatement: 'Four clinic owners said follow-up eats staff time',
            state: 'REPORTED_BY_CUSTOMER',
            sourceType: 'customer_conversation',
            sourceReference: 'clinic-owner-01',
            provenance: { source: 'founder-interview', observedAt: '2026-08-15' },
          },
        ],
        prospects: [
          {
            prospectReference: 'clinic-owner-01',
            customerSegment: 'clinics',
            problemDiscussed: 'follow-up',
            discoveryStatus: 'PROBLEM_CONFIRMED',
          },
        ],
        nextBestAction: {
          action: 'TALK_TO_CUSTOMERS',
          why: 'More independent reports reduce uncertainty',
          cost: 'NO_COST',
          risk: 'LOW',
        },
        revenueState: 'INTEREST',
        verifiedPaymentCount: 0,
        advisory: true,
      },
    };
    render(<CommandCenter />);
    await waitFor(() => {
      expect(screen.getByText('FOUNDER COMMAND CENTER')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Intelligence'));
    await waitFor(() => {
      expect(screen.getByText(/Manual invoice reconciliation/)).toBeDefined();
    });
    const row = screen.getByText(/Manual invoice reconciliation/).closest('li');
    expect(row).toBeDefined();
    if (row) {
      const button = row.querySelector('button');
      expect(button).toBeDefined();
      if (button) fireEvent.click(button);
    }
    await waitFor(() => {
      expect(screen.getByText(/Four clinic owners said follow-up eats staff time/i)).toBeDefined();
    });
    expect(screen.getByText(/TALK_TO_CUSTOMERS/)).toBeDefined();
    expect(screen.getByText(/0 verified payment/)).toBeDefined();
  });

  it('shows a readable error and recovers on refresh', async () => {
    mocks.commandRefetch.mockResolvedValue({ data: { success: false, data: null } });
    mocks.rankingRefetch.mockResolvedValue({ data: { success: true, data: rankingData() } });
    mocks.streamsRefetch.mockResolvedValue({ data: { success: true, data: [] } });
    mocks.pipelineRefetch.mockResolvedValue({ data: { success: true, data: [] } });
    mocks.timelineRefetch.mockResolvedValue({ data: { success: true, data: timelineData() } });
    mocks.radarRefetch.mockResolvedValue({ data: { success: true, data: radarData() } });
    render(<CommandCenter />);
    await waitFor(() => {
      expect(screen.getByText(/Could not reach the command center/i)).toBeDefined();
    });
    primeQueries();
    fireEvent.click(screen.getByLabelText('Refresh command center'));
    await waitFor(() => {
      expect(screen.getByText('AI automation service')).toBeDefined();
    });
  });

  it('exposes the SPRINT-042 Add Evidence entry point in the INTELLIGENCE tab', async () => {
    primeQueries();
    render(<CommandCenter />);
    await waitFor(() => {
      expect(screen.getByText('FOUNDER COMMAND CENTER')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Intelligence'));
    await waitFor(() => {
      expect(screen.getByText('Founder evidence')).toBeDefined();
      expect(screen.getByRole('button', { name: /Add Evidence/i })).toBeDefined();
    });
  });

  it('never claims execution, spending or authorization — the boundary notice is always present', async () => {
    primeQueries();
    render(<CommandCenter />);
    await waitFor(() => {
      expect(screen.getByText('FOUNDER COMMAND CENTER')).toBeDefined();
    });
    expect(screen.getByText(/never executes, spends or authorizes by itself/i)).toBeDefined();
  });
});
