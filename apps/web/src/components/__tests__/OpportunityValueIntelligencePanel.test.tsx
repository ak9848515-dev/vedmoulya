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
  authUserId: 'user-1',
}));

vi.mock('../../lib/api-client.js', () => ({
  useOpportunityValueIntelligence: (...args: unknown[]) => mocks.useQuery(...args),
  useRequestOpportunityApproval: () => ({
    mutateAsync: mocks.requestApproval,
    isPending: false,
  }),
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
});
