// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S7.1 Opportunity monitoring panel
//
// Proves the human workspace preserves BACKEND TRUTH and the human boundary:
//   • the monitoring pass result is rendered VERBATIM (no optimistic count)
//   • a source failure is a FAILURE with "nothing was imported" — never an
//     empty success
//   • RECOMMENDED / NOT RECOMMENDED and the Why lines come from the backend
//   • the proposal is an editable DRAFT and the panel states explicitly that
//     VedMoulya does not submit bids or contact the client
//   • the ranked read is scoped to the session user
//   • empty and failure states are honest
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { OpportunityMonitoringPanel } from '../OpportunityMonitoringPanel.js';

const mocks = vi.hoisted(() => ({
  monitor: vi.fn(),
  ranked: vi.fn(),
  draft: vi.fn(),
  authUserId: 'user-1',
}));

vi.mock('../../lib/api-client.js', () => ({
  useMonitorOpportunities: () => ({ mutateAsync: mocks.monitor, isPending: false }),
  useRankedOpportunities: (...args: unknown[]) => mocks.ranked(...args),
  useOpportunityProposalDraft: () => ({ mutateAsync: mocks.draft, isPending: false }),
}));

vi.mock('../../stores/auth-store.js', () => ({
  useAuthStore: (selector: (s: { user: { userId: string } }) => string) =>
    selector({ user: { userId: mocks.authUserId } }),
}));

function rankedState(data: unknown, overrides: Record<string, unknown> = {}) {
  return { data, isLoading: false, isError: false, ...overrides };
}

function recommendation(overrides: Record<string, unknown> = {}) {
  return {
    opportunityId: 'opp-1',
    source: 'freelancer',
    sourceReference: 'project:123456',
    title: 'Build a TypeScript reporting CLI',
    category: 'fixed',
    status: 'DISCOVERED',
    score: 0.72,
    riskLevel: 'LOW',
    recommended: true,
    reasons: [
      'Capability fit 100% (3 available of 3 required capabilities).',
      '2 related tasks within the last 90 days.',
    ],
    authorizationRequired: true,
    approved: false,
    ...overrides,
  };
}

function passResult(overrides: Record<string, unknown> = {}) {
  return {
    source: 'freelancer',
    sourceConfigured: true,
    startedAt: '2026-10-07T09:00:00.000Z',
    finishedAt: '2026-10-07T09:00:01.000Z',
    candidatesFetched: 3,
    normalized: 3,
    created: 1,
    existing: 1,
    filtered: 1,
    rejected: 0,
    rejectedSample: [],
    createdIds: ['opp-1'],
    truncated: false,
    usedCachedCandidates: false,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.monitor.mockReset();
  mocks.ranked.mockReset();
  mocks.draft.mockReset();
  mocks.authUserId = 'user-1';
  mocks.ranked.mockReturnValue(
    rankedState({ recommendations: [recommendation()], authorizationRequired: true }),
  );
});

describe('S7.1 — OpportunityMonitoringPanel', () => {
  it('1. renders the monitoring workspace and scopes the ranked read to the session user', () => {
    render(<OpportunityMonitoringPanel />);
    expect(screen.getByTestId('opportunity-monitoring')).toBeDefined();
    expect(screen.getByText(/External opportunity monitoring/)).toBeDefined();
    expect(mocks.ranked).toHaveBeenCalledWith('user-1');
  });

  it('2. renders the pass outcome verbatim (created / known / filtered / rejected)', async () => {
    mocks.monitor.mockResolvedValue({ success: true, data: passResult() });
    render(<OpportunityMonitoringPanel />);
    fireEvent.click(screen.getByLabelText('Check external sources for new opportunities'));
    await waitFor(() => {
      expect(screen.getByTestId('monitoring-result')).toBeDefined();
    });
    expect(screen.getByTestId('monitoring-counts').textContent).toContain('1 new');
    expect(screen.getByTestId('monitoring-counts').textContent).toContain('1 already known');
    expect(screen.getByTestId('monitoring-counts').textContent).toContain('1 filtered');
    expect(screen.getByTestId('monitoring-counts').textContent).toContain('0 refused');
    // Nothing was approved, bid on or submitted.
    expect(screen.getByText(/nothing was approved, bid on or submitted/i)).toBeDefined();
  });

  it('3. a source failure is shown as a FAILURE with nothing imported — never an empty success', async () => {
    mocks.monitor.mockRejectedValue(
      new Error('The Freelancer API rate-limited this deployment (429).'),
    );
    render(<OpportunityMonitoringPanel />);
    fireEvent.click(screen.getByLabelText('Check external sources for new opportunities'));
    await waitFor(() => {
      expect(screen.getByTestId('monitoring-failure')).toBeDefined();
    });
    expect(screen.getByText(/rate-limited this deployment \(429\)/)).toBeDefined();
    expect(screen.getByText(/No opportunity was imported/i)).toBeDefined();
    // Honest: no success line and no fabricated result card.
    expect(screen.queryByText(/Pass complete/i)).toBeNull();
    expect(screen.queryByTestId('monitoring-result')).toBeNull();
  });

  it('4. an unconfigured source is reported honestly (no request is faked)', async () => {
    mocks.monitor.mockRejectedValue(
      new Error(
        'No Freelancer API credential is configured (FREELANCER_OAUTH_TOKEN). Discovery is disabled until an operator provisions it.',
      ),
    );
    render(<OpportunityMonitoringPanel />);
    fireEvent.click(screen.getByLabelText('Check external sources for new opportunities'));
    await waitFor(() => {
      expect(screen.getByTestId('monitoring-failure')).toBeDefined();
    });
    expect(screen.getByText(/no freelancer api credential is configured/i)).toBeDefined();
  });

  it('5. renders RECOMMENDED and the backend Why lines verbatim', () => {
    render(<OpportunityMonitoringPanel />);
    expect(screen.getByTestId('recommended-opp-1').textContent).toBe('RECOMMENDED');
    expect(screen.getByText(/score 0.72/)).toBeDefined();
    const reasons = screen.getByTestId('reasons-opp-1').textContent ?? '';
    expect(reasons).toContain('Capability fit 100%');
    expect(reasons).toContain('2 related tasks within the last 90 days.');
  });

  it('6. a not-recommended opportunity is labeled as such (the backend verdict, not the UI truth)', () => {
    mocks.ranked.mockReturnValue(
      rankedState({
        recommendations: [recommendation({ recommended: false, score: 0.1, riskLevel: 'HIGH' })],
        authorizationRequired: true,
      }),
    );
    render(<OpportunityMonitoringPanel />);
    expect(screen.getByTestId('recommended-opp-1').textContent).toBe('NOT RECOMMENDED');
    expect(screen.getByText(/risk/)).toBeDefined();
    expect(screen.getByText('HIGH')).toBeDefined();
  });

  it('7. the draft is editable and the human submission boundary is stated', async () => {
    mocks.draft.mockResolvedValue({
      success: true,
      data: { document: '# Draft proposal\n\nApproach…', submitted: false, provider: 'fake' },
    });
    render(<OpportunityMonitoringPanel />);
    fireEvent.click(screen.getByLabelText('Prepare a proposal draft for opp-1'));
    await waitFor(() => {
      expect(screen.getByTestId('draft-opp-1')).toBeDefined();
    });

    const textarea = screen.getByLabelText('Proposal draft for opp-1') as HTMLTextAreaElement;
    expect(textarea.value).toContain('# Draft proposal');

    // Editable: the human owns the final text.
    fireEvent.change(textarea, { target: { value: '# Draft proposal\n\nMy own edits' } });
    expect(textarea.value).toContain('My own edits');

    // The boundary is explicit and structural.
    expect(screen.getByTestId('boundary-opp-1').textContent).toMatch(/DRAFT/);
    expect(screen.getByTestId('boundary-opp-1').textContent).toMatch(
      /does not submit bids, contact the client or accept work/i,
    );
  });

  it('8. a draft failure is honest — no draft textarea and no fake document', async () => {
    mocks.draft.mockRejectedValue(
      new Error('No AI orchestrator is configured, so no proposal draft can be generated.'),
    );
    render(<OpportunityMonitoringPanel />);
    fireEvent.click(screen.getByLabelText('Prepare a proposal draft for opp-1'));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/no ai orchestrator is configured/i);
    });
    expect(screen.queryByTestId('draft-opp-1')).toBeNull();
  });

  it('9. empty and failing ranked states are honest (never a fabricated verdict)', () => {
    mocks.ranked.mockReturnValue(rankedState({ recommendations: [], authorizationRequired: true }));
    const { unmount } = render(<OpportunityMonitoringPanel />);
    expect(screen.getByText(/No opportunities to rank yet/i)).toBeDefined();
    expect(screen.queryByText(/RECOMMENDED/)).toBeNull();
    unmount();

    mocks.ranked.mockReturnValue(rankedState(undefined, { isError: true }));
    render(<OpportunityMonitoringPanel />);
    expect(screen.getByText(/Recommendations are unavailable right now/i)).toBeDefined();
  });

  it('10. renders no submission, bid or contact CONTROL (the boundary is structural)', () => {
    render(<OpportunityMonitoringPanel />);
    // Prose may NARRATE the human boundary ("you review, edit and submit") —
    // what must not exist is a control that performs an external action.
    for (const forbidden of ['submit', 'bid', 'contact', 'pay', 'send']) {
      expect(screen.queryAllByRole('button', { name: new RegExp(forbidden, 'i') })).toHaveLength(0);
      expect(screen.queryAllByRole('link', { name: new RegExp(forbidden, 'i') })).toHaveLength(0);
    }
    // The only controls are the monitoring pass, the draft preparation and copy.
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Check for opportunities',
      'Prepare proposal draft',
    ]);
  });
});
