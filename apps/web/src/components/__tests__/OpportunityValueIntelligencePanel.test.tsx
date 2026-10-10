// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S6.4 Opportunity Value Intelligence panel
//
// Proves the human workspace preserves BACKEND TRUTH:
//   • qualification + value intelligence render from the read model
//   • delivery and commercial evidence stay SEPARATE
//   • PAID is shown only from the canonical commercial evidence
//   • INSUFFICIENT is shown as INSUFFICIENT (never LOW, never "0"/"FAILED")
//   • reasons and missing-evidence render verbatim
//   • the decision action calls the EXISTING authority-backed mutation and can
//     never manufacture approval
//   • loading, no-value-intelligence and API-failure states are honest
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { OpportunityValueIntelligencePanel } from '../OpportunityValueIntelligencePanel.js';

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  requestApproval: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  startMission: vi.fn(),
  missionStatus: vi.fn(),
  authUserId: 'user-1',
}));

vi.mock('../../lib/api-client.js', () => ({
  useOpportunityValueIntelligence: (...args: unknown[]) => mocks.useQuery(...args),
  useRequestOpportunityApproval: () => ({
    mutateAsync: mocks.requestApproval,
    isPending: false,
  }),
  useOpportunityApprove: () => ({
    mutateAsync: mocks.approve,
    isPending: false,
  }),
  useOpportunityReject: () => ({
    mutateAsync: mocks.reject,
    isPending: false,
  }),
  useStartMissionForOpportunity: () => ({
    mutateAsync: mocks.startMission,
    isPending: false,
  }),
  useMissionStatus: (...args: unknown[]) => mocks.missionStatus(...args),
}));

vi.mock('../../stores/auth-store.js', () => ({
  useAuthStore: (selector: (s: { user: { userId: string } }) => string) =>
    selector({ user: { userId: mocks.authUserId } }),
}));

function baseValue(overrides: Record<string, unknown> = {}) {
  return {
    assessment: {
      score: 0.62,
      businessCase: [],
      riskLevel: 'MEDIUM',
      evidence: [],
      authorizationRequired: true,
      status: 'RESEARCHED',
    },
    inputsUsed: {
      requiredCapabilities: 2,
      availableCapabilities: 3,
      relatedWork: 1,
      marketSignals: 2,
    },
    authorizationRequired: true,
    approved: false,
    status: 'ASSESSED',
    valueIntelligence: {
      deliveryEvidence: { level: 'MEDIUM', successCount: 3, failureCount: 0, sampleCount: 3 },
      commercialEvidence: {
        level: 'LOW',
        paidCount: 2,
        pendingCount: 1,
        cancelledCount: 0,
        sampleCount: 3,
      },
      overallAssessment: 'STRONG_CANDIDATE',
      confidence: 'MEDIUM',
      evidenceCount: 6,
      reasons: ['3 verified delivery outcome(s) linked to this opportunity.'],
      generatedAt: '2026-10-06T09:00:00.000Z',
    },
    ...overrides,
  };
}

function queryState(data: unknown, overrides: Record<string, unknown> = {}) {
  return { data, isLoading: false, isError: false, ...overrides };
}

beforeEach(() => {
  mocks.useQuery.mockReset();
  mocks.requestApproval.mockReset();
  mocks.approve.mockReset();
  mocks.reject.mockReset();
  mocks.startMission.mockReset();
  mocks.missionStatus.mockReset();
  // Default: no Mission yet (the panel only polls once a missionId is known).
  mocks.missionStatus.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  mocks.authUserId = 'user-1';
});

describe('S6.4 — OpportunityValueIntelligencePanel', () => {
  it('1/2/3. renders qualification + value intelligence for the opportunity', async () => {
    mocks.useQuery.mockReturnValue(queryState(baseValue()));
    render(<OpportunityValueIntelligencePanel opportunityId="opp-1" />);
    await waitFor(() => {
      expect(screen.getByTestId('value-intelligence')).toBeDefined();
    });
    expect(screen.getByText(/Qualification score: 0.62/)).toBeDefined();
    // The read is scoped to the session user + this opportunity.
    expect(mocks.useQuery).toHaveBeenCalledWith('user-1', 'opp-1');
  });

  it('5. delivery and commercial evidence remain SEPARATE', async () => {
    mocks.useQuery.mockReturnValue(queryState(baseValue()));
    render(<OpportunityValueIntelligencePanel opportunityId="opp-1" />);
    await waitFor(() => {
      expect(screen.getByText(/Delivery evidence/)).toBeDefined();
    });
    // Delivery facts.
    expect(screen.getByText(/3 successful · 0 failed · 3 samples/)).toBeDefined();
    // Commercial facts, separate — not collapsed into one success flag.
    expect(screen.getByText(/2 paid · 1 pending · 0 cancelled/)).toBeDefined();
  });

  it('6. PAID is displayed only from the canonical commercial evidence', async () => {
    mocks.useQuery.mockReturnValue(queryState(baseValue()));
    render(<OpportunityValueIntelligencePanel opportunityId="opp-1" />);
    await waitFor(() => {
      expect(screen.getByText(/2 paid/)).toBeDefined();
    });
    // With zero paid outcomes, "paid" is never asserted.
    mocks.useQuery.mockReturnValue(
      queryState(
        baseValue({
          valueIntelligence: {
            deliveryEvidence: { level: 'LOW', successCount: 1, failureCount: 0, sampleCount: 1 },
            commercialEvidence: {
              level: 'INSUFFICIENT',
              paidCount: 0,
              pendingCount: 1,
              cancelledCount: 0,
              sampleCount: 1,
            },
            overallAssessment: 'INSUFFICIENT_EVIDENCE',
            confidence: 'LOW',
            evidenceCount: 2,
            reasons: ['1 commercial outcome(s) pending human action (not paid).'],
            generatedAt: '2026-10-06T09:00:00.000Z',
          },
        }),
      ),
    );
    render(<OpportunityValueIntelligencePanel opportunityId="opp-2" />);
    await waitFor(() => {
      expect(screen.getAllByText(/0 paid/).length).toBeGreaterThan(0);
    });
  });

  it('4/7. INSUFFICIENT renders as INSUFFICIENT — never LOW, never FAILED, never 0', async () => {
    mocks.useQuery.mockReturnValue(
      queryState(
        baseValue({
          valueIntelligence: {
            deliveryEvidence: {
              level: 'INSUFFICIENT',
              successCount: 0,
              failureCount: 0,
              sampleCount: 0,
            },
            commercialEvidence: {
              level: 'INSUFFICIENT',
              paidCount: 0,
              pendingCount: 0,
              cancelledCount: 0,
              sampleCount: 0,
            },
            overallAssessment: 'INSUFFICIENT_EVIDENCE',
            confidence: 'INSUFFICIENT',
            evidenceCount: 0,
            reasons: [
              'No canonical delivery or commercial evidence is linked to this opportunity.',
            ],
            generatedAt: '2026-10-06T09:00:00.000Z',
          },
        }),
      ),
    );
    render(<OpportunityValueIntelligencePanel opportunityId="opp-1" />);
    await waitFor(() => {
      expect(screen.getByText('Insufficient evidence')).toBeDefined();
    });
    // No verified delivery → an explicit UNKNOWN-style message, not "0 failed".
    expect(
      screen.getByText(/No verified delivery history — INSUFFICIENT, not a failure/),
    ).toBeDefined();
    expect(
      screen.getByText(/No commercial history — INSUFFICIENT, not a success and not a failure/),
    ).toBeDefined();
    // The word FAILED is never asserted for absent data.
    expect(screen.queryByText(/FAILED/)).toBeNull();
  });

  it('8/9. reasons and missing-evidence are rendered verbatim', async () => {
    mocks.useQuery.mockReturnValue(
      queryState(
        baseValue({
          valueIntelligence: {
            deliveryEvidence: { level: 'MEDIUM', successCount: 2, failureCount: 0, sampleCount: 2 },
            commercialEvidence: {
              level: 'INSUFFICIENT',
              paidCount: 0,
              pendingCount: 0,
              cancelledCount: 0,
              sampleCount: 0,
            },
            overallAssessment: 'PROMISING',
            confidence: 'MEDIUM',
            evidenceCount: 2,
            reasons: ['Repeated verified delivery history supports this candidate.'],
            generatedAt: '2026-10-06T09:00:00.000Z',
          },
        }),
      ),
    );
    render(<OpportunityValueIntelligencePanel opportunityId="opp-1" />);
    await waitFor(() => {
      expect(screen.getByTestId('value-reasons')).toBeDefined();
    });
    expect(
      screen.getByText(/Repeated verified delivery history supports this candidate/),
    ).toBeDefined();
    // Missing commercial evidence is called out explicitly.
    expect(screen.getByTestId('missing-commercial')).toBeDefined();
  });

  it('10/11. the decision action calls the EXISTING authority mutation and never fabricates approval', async () => {
    mocks.useQuery.mockReturnValue(queryState(baseValue()));
    mocks.requestApproval.mockResolvedValue({ success: true, data: { taskId: 'task-1' } });
    render(<OpportunityValueIntelligencePanel opportunityId="opp-1" />);
    await waitFor(() => {
      expect(screen.getByLabelText('Request approval for opp-1')).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText('Request approval for opp-1'));
    await waitFor(() => {
      expect(mocks.requestApproval).toHaveBeenCalledWith({
        userId: 'user-1',
        opportunityId: 'opp-1',
      });
    });
    // An approval REQUEST was registered — it is never claimed as approved.
    await waitFor(() => {
      expect(screen.getByText(/Approval requested/)).toBeDefined();
    });
    expect(screen.queryByText(/This opportunity is approved/)).toBeNull();
  });

  it('13. an already-APPROVED opportunity shows the approved state, not a request button', async () => {
    mocks.useQuery.mockReturnValue(queryState(baseValue({ status: 'APPROVED' })));
    render(<OpportunityValueIntelligencePanel opportunityId="opp-1" />);
    await waitFor(() => {
      expect(screen.getByText(/This opportunity is approved/)).toBeDefined();
    });
    expect(screen.queryByLabelText('Request approval for opp-1')).toBeNull();
  });

  it('14. an API failure shows an honest error and no fabricated verdict', async () => {
    mocks.useQuery.mockReturnValue(queryState(undefined, { isError: true }));
    render(<OpportunityValueIntelligencePanel opportunityId="opp-1" />);
    await waitFor(() => {
      expect(screen.getByText(/Value intelligence is unavailable right now/)).toBeDefined();
    });
    // No verdict is fabricated from a failed read.
    expect(screen.queryByTestId('value-intelligence-body')).toBeNull();
  });

  it('15. the loading state is honest', async () => {
    mocks.useQuery.mockReturnValue(queryState(undefined, { isLoading: true }));
    render(<OpportunityValueIntelligencePanel opportunityId="opp-1" />);
    expect(screen.getByText(/Loading value intelligence/)).toBeDefined();
  });

  it('2b. an absent value intelligence (source not configured) is stated honestly', async () => {
    mocks.useQuery.mockReturnValue(queryState(baseValue({ valueIntelligence: undefined })));
    render(<OpportunityValueIntelligencePanel opportunityId="opp-1" />);
    await waitFor(() => {
      expect(
        screen.getByText(/No value intelligence is available for this opportunity/),
      ).toBeDefined();
    });
    expect(screen.queryByTestId('value-intelligence-body')).toBeNull();
  });

  // ── REVENUE-001 — approval is explicit and human-controlled ──────────────

  it('16. approval is an explicit human action — never automatic', async () => {
    mocks.useQuery.mockReturnValue(queryState(baseValue()));
    mocks.requestApproval.mockResolvedValue({ success: true, data: { taskId: 'task-9' } });
    render(<OpportunityValueIntelligencePanel opportunityId="opp-1" />);
    await waitFor(() => {
      expect(screen.getByLabelText('Request approval for opp-1')).toBeDefined();
    });
    // Merely rendering the panel never approves anything.
    expect(mocks.approve).not.toHaveBeenCalled();
    expect(mocks.startMission).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Request approval for opp-1'));
    // The approval task id is surfaced for the human.
    await waitFor(() => {
      expect(screen.getByText(/task task-9/)).toBeDefined();
    });
    // Registering the request still does not approve.
    expect(mocks.approve).not.toHaveBeenCalled();
    expect(screen.queryByText(/This opportunity is approved/)).toBeNull();
  });

  it('17. the human approves through the authority, then explicitly starts the mission', async () => {
    mocks.useQuery.mockReturnValue(queryState(baseValue()));
    mocks.requestApproval.mockResolvedValue({ success: true, data: { taskId: 'task-9' } });
    mocks.approve.mockResolvedValue({ success: true, data: { id: 'opp-1', status: 'APPROVED' } });
    mocks.startMission.mockResolvedValue({
      success: true,
      data: { opportunityId: 'opp-1', missionId: 'm-1', created: true },
    });
    render(<OpportunityValueIntelligencePanel opportunityId="opp-1" />);
    fireEvent.click(await screen.findByLabelText('Request approval for opp-1'));
    fireEvent.click(await screen.findByLabelText('Approve opportunity opp-1'));
    await waitFor(() => {
      expect(mocks.approve).toHaveBeenCalledWith({
        userId: 'user-1',
        id: 'opp-1',
        approvalTaskId: 'task-9',
      });
    });
    // Approval does NOT auto-start the mission.
    expect(mocks.startMission).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByLabelText('Start mission for opp-1'));
    await waitFor(() => {
      expect(mocks.startMission).toHaveBeenCalledWith({ id: 'opp-1' });
    });
    await waitFor(() => {
      expect(screen.getByTestId('mission-started')).toBeDefined();
    });
  });

  it('18. a discovery-sourced (non-lifecycle) opportunity is handled honestly', async () => {
    mocks.useQuery.mockReturnValue(
      queryState(undefined, { isError: true, error: { message: 'Opportunity not found.' } }),
    );
    render(<OpportunityValueIntelligencePanel opportunityId="brain-opp-1" />);
    await waitFor(() => {
      expect(screen.getByTestId('value-intelligence-non-control')).toBeDefined();
    });
    // No fabricated verdict and no generic failure message either.
    expect(screen.queryByTestId('value-intelligence-body')).toBeNull();
    expect(screen.queryByText(/Value intelligence is unavailable right now/)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// S7.2 — APPROVED opportunity → Mission UI surface
//
// Proves the human can SEE enough to decide, APPROVE explicitly, REJECT
// explicitly, START the Mission explicitly, and that the EXISTING Mission state
// is reflected (created → running → verified / failed). Approval never
// auto-starts a Mission.
// ─────────────────────────────────────────────────────────────────────────────
describe('S7.2 — opportunity decision + Mission UI', () => {
  it('19. shows the opportunity facts needed for an informed decision', async () => {
    mocks.useQuery.mockReturnValue(
      queryState(
        baseValue({
          title: 'Build a TypeScript SDK',
          description: 'Client needs a typed SDK for their public API.',
          category: 'software',
          riskLevel: 'MEDIUM',
          sourceRef: { source: 'manual-import', sourceReference: 'https://board.example/1' },
          requiredCapabilities: ['typescript', 'api design'],
        }),
      ),
    );
    render(<OpportunityValueIntelligencePanel opportunityId="opp-1" />);
    await waitFor(() => {
      expect(screen.getByTestId('opportunity-decision-facts')).toBeDefined();
    });
    expect(screen.getByText('Build a TypeScript SDK')).toBeDefined();
    expect(screen.getByText('Client needs a typed SDK for their public API.')).toBeDefined();
    expect(screen.getByTestId('opportunity-capabilities').textContent).toContain(
      'typescript, api design',
    );
    expect(screen.getByText(/source: manual-import/)).toBeDefined();
  });

  it('20. REJECT is an explicit human action bound to the REJECTED transition', async () => {
    mocks.useQuery.mockReturnValue(queryState(baseValue()));
    mocks.requestApproval.mockResolvedValue({ success: true, data: { taskId: 'task-1' } });
    mocks.reject.mockResolvedValue({ success: true, data: { id: 'opp-1', status: 'REJECTED' } });
    render(<OpportunityValueIntelligencePanel opportunityId="opp-1" />);
    fireEvent.click(await screen.findByLabelText('Request approval for opp-1'));
    const rejectButton = await screen.findByLabelText('Reject opportunity opp-1');
    expect(mocks.reject).not.toHaveBeenCalled();
    fireEvent.click(rejectButton);
    await waitFor(() => {
      expect(mocks.reject).toHaveBeenCalledWith({ userId: 'user-1', id: 'opp-1' });
    });
    // Rejection never starts a Mission.
    expect(mocks.startMission).not.toHaveBeenCalled();
  });

  it('21. an already-REJECTED opportunity shows the rejected state', async () => {
    mocks.useQuery.mockReturnValue(queryState(baseValue({ status: 'REJECTED' })));
    render(<OpportunityValueIntelligencePanel opportunityId="opp-1" />);
    await waitFor(() => {
      expect(screen.getByText(/This opportunity was rejected/)).toBeDefined();
    });
    expect(screen.queryByLabelText('Start mission for opp-1')).toBeNull();
  });

  it('22. starting a Mission does NOT claim VERIFIED — status comes from the Mission', async () => {
    mocks.useQuery.mockReturnValue(queryState(baseValue({ status: 'APPROVED' })));
    mocks.startMission.mockResolvedValue({
      success: true,
      data: { opportunityId: 'opp-1', missionId: 'm-1', created: true },
    });
    // Mission is created + RUNNING but NOT yet verified.
    mocks.missionStatus.mockReturnValue({
      data: { missionId: 'm-1', state: 'RUNNING', objectives: [] },
      isLoading: false,
      isError: false,
    });
    render(<OpportunityValueIntelligencePanel opportunityId="opp-1" />);
    fireEvent.click(await screen.findByLabelText('Start mission for opp-1'));
    await waitFor(() => {
      expect(screen.getByTestId('mission-started')).toBeDefined();
    });
    // The status reflects the REAL Mission state.
    expect(screen.getByTestId('mission-status').textContent).toContain('RUNNING');
    // No success is fabricated while the Mission is still running.
    expect(screen.queryByTestId('mission-verified')).toBeNull();
  });

  it('23. a VERIFIED Mission is reflected in the UI', async () => {
    mocks.useQuery.mockReturnValue(queryState(baseValue({ status: 'APPROVED' })));
    mocks.startMission.mockResolvedValue({
      success: true,
      data: { opportunityId: 'opp-1', missionId: 'm-1', created: true },
    });
    mocks.missionStatus.mockReturnValue({
      data: {
        missionId: 'm-1',
        state: 'COMPLETED',
        objectives: [{ objectiveId: 'o-1', state: 'VERIFIED', title: 'T', reason: 'ok' }],
      },
      isLoading: false,
      isError: false,
    });
    render(<OpportunityValueIntelligencePanel opportunityId="opp-1" />);
    fireEvent.click(await screen.findByLabelText('Start mission for opp-1'));
    await waitFor(() => {
      expect(screen.getByTestId('mission-verified')).toBeDefined();
    });
  });

  it('24. a FAILED Mission is honest — no success claimed', async () => {
    mocks.useQuery.mockReturnValue(queryState(baseValue({ status: 'APPROVED' })));
    mocks.startMission.mockResolvedValue({
      success: true,
      data: { opportunityId: 'opp-1', missionId: 'm-1', created: true },
    });
    mocks.missionStatus.mockReturnValue({
      data: { missionId: 'm-1', state: 'FAILED', objectives: [] },
      isLoading: false,
      isError: false,
    });
    render(<OpportunityValueIntelligencePanel opportunityId="opp-1" />);
    fireEvent.click(await screen.findByLabelText('Start mission for opp-1'));
    await waitFor(() => {
      expect(screen.getByTestId('mission-failed')).toBeDefined();
    });
    expect(screen.queryByTestId('mission-verified')).toBeNull();
  });
});
