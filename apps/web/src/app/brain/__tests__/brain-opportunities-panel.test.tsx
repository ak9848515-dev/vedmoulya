// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — /brain Opportunities panel (EPIC-020 §12 · G8 acknowledge path)
//
// Proves the acknowledge affordance stays a NON-COMMITTING triage action:
//   • clicking "Acknowledge" sends status NOTED — never ACCEPTED. Since S5 the
//     backend refuses ACCEPTED, so the old button silently threw and the
//     "Noted" marker never appeared (G8 e2e regression).
//   • a NOTED opportunity renders the "Noted" marker the E2E journey waits for
//   • a legacy ACCEPTED opportunity still renders as "Noted"
//   • DISMISSED opportunities disappear from the inbox (never shown as noted)
// Nothing is fabricated: fixtures mirror the real Opportunity shape.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BrainOpportunitiesPanel } from '../brain-dashboard.js';

const mocks = vi.hoisted(() => ({
  listOpportunities: vi.fn(),
  updateOpportunity: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock('../../../lib/api-client.js', () => ({
  useBrainCorrectLearning: () => ({ mutateAsync: vi.fn() }),
  useBrainDashboard: () => ({ data: null, isLoading: false }),
  useBrainDailyPriorities: () => ({ data: null, isLoading: false }),
  useBrainDiscoverIntelligence: () => ({ mutateAsync: vi.fn() }),
  useBrainListOpportunities: (...args: unknown[]) => mocks.listOpportunities(...args),
  useBrainListIntelligenceEvents: () => ({ data: [], refetch: vi.fn() }),
  useBrainUpdateOpportunity: () => ({ mutateAsync: mocks.updateOpportunity }),
  useBrainUpdateIntelligenceEvent: () => ({ mutateAsync: vi.fn() }),
}));

interface OpportunityFixture {
  id: string;
  userId: string;
  category: string;
  title: string;
  description: string;
  evidence: string[];
  uncertainty: number;
  source: string;
  createdAt: string;
  status: string;
}

function opp(overrides: Partial<OpportunityFixture> = {}): OpportunityFixture {
  return {
    id: 'opp-1',
    userId: 'user-1',
    category: 'automation',
    title: 'Automate weekly reporting',
    description: 'Recurring report task detected from completed work.',
    evidence: ['3 completed report tasks'],
    uncertainty: 0.42,
    source: 'task-outcome',
    createdAt: '2026-10-06T00:00:00.000Z',
    status: 'NEW',
    ...overrides,
  };
}

function givenOpportunities(items: OpportunityFixture[]): void {
  mocks.listOpportunities.mockReturnValue({
    data: items,
    isLoading: false,
    refetch: mocks.refetch,
  });
}

beforeEach(() => {
  mocks.listOpportunities.mockReset();
  mocks.updateOpportunity.mockReset();
  mocks.refetch.mockReset();
  mocks.updateOpportunity.mockResolvedValue({ success: true });
});

describe('S5/G8 — BrainOpportunitiesPanel acknowledge path', () => {
  it('acknowledge sends NOTED (never ACCEPTED) with the session owner', () => {
    givenOpportunities([opp()]);

    render(<BrainOpportunitiesPanel userId="user-1" />);
    fireEvent.click(screen.getByTitle('Acknowledge this opportunity'));

    expect(mocks.updateOpportunity).toHaveBeenCalledTimes(1);
    expect(mocks.updateOpportunity).toHaveBeenCalledWith({
      userId: 'user-1',
      opportunityId: 'opp-1',
      status: 'NOTED',
    });
    // S5 — the UI can never attempt acceptance: the backend refuses ACCEPTED
    // and there is no other approval path in this inbox.
    expect(mocks.updateOpportunity).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACCEPTED' }),
    );
  });

  it('renders the Noted marker for a NOTED opportunity (E2E waits on this text)', () => {
    givenOpportunities([opp({ status: 'NOTED' })]);

    render(<BrainOpportunitiesPanel userId="user-1" />);

    expect(screen.getByText('Noted')).toBeDefined();
    // Noted items have no acknowledge affordance — they are already triaged.
    expect(screen.queryByTitle('Acknowledge this opportunity')).toBeNull();
  });

  it('renders a legacy ACCEPTED opportunity as Noted (pre-S5 records)', () => {
    givenOpportunities([opp({ status: 'ACCEPTED' })]);

    render(<BrainOpportunitiesPanel userId="user-1" />);

    expect(screen.getByText('Noted')).toBeDefined();
  });

  it('keeps delivery of triage states separate: DISMISSED leaves the inbox', () => {
    givenOpportunities([opp({ status: 'DISMISSED' })]);

    render(<BrainOpportunitiesPanel userId="user-1" />);

    // Empty state — a dismissed notice is never shown as "Noted".
    expect(screen.queryByText('Noted')).toBeNull();
    expect(screen.getByText(/Evidence-backed opportunities will appear here/)).toBeDefined();
  });
});
