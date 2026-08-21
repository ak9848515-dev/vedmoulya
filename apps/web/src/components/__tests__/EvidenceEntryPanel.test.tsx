// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Founder Evidence Entry Panel Tests (SPRINT-042)
//
// PURE COMPOSITION tests — every mutation maps 1:1 to an EXISTING gateway
// procedure and the UI NEVER reimplements business rules:
//   - Add Evidence entry renders; drawer opens with the mode tabs
//   - Problem registration requires evidence (no fabricated problems)
//   - Observation form: provenance REQUIRED, VERIFIED never offered as a tag,
//     valid observations call world.observationRecord with provenance
//   - Prospect creation calls world.prospectRegister (provenance required)
//   - Advance shows ONLY the valid next states from the bounded chain; an
//     illegal jump cannot even be requested (display-only, backend
//     authoritative); VERIFIED_PAYMENT requires real payment evidence
//   - Backend validation errors display verbatim
//   - Successful mutations call onSaved() (parent refreshes radar/NBA)
//   - Empty datasets stay honest (no problems → guided to register one)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { EvidenceEntryPanel } from '../EvidenceEntryPanel.js';

const mocks = vi.hoisted(() => ({
  onSaved: vi.fn(),
  problemListData: [] as unknown[],
  prospectsListData: [] as unknown[],
  problemRegisterMutate: vi.fn(),
  observationRecordMutate: vi.fn(),
  prospectRegisterMutate: vi.fn(),
  prospectAdvanceMutate: vi.fn(),
  problemsRefetch: vi.fn(),
  prospectsRefetch: vi.fn(),
}));

vi.mock('../../stores/auth-store.js', () => ({
  useAuthStore: (selector: (s: { user: { userId: string } | null }) => string) =>
    selector({ user: { userId: 'user-1' } }),
}));

vi.mock('../../lib/trpc.js', () => ({
  api: {
    world: {
      problemList: {
        useQuery: () => ({
          data: { success: true, data: mocks.problemListData },
          refetch: mocks.problemsRefetch,
          error: null,
          isLoading: false,
        }),
      },
      prospectsList: {
        useQuery: () => ({
          data: { success: true, data: mocks.prospectsListData },
          refetch: mocks.prospectsRefetch,
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

const PROBLEM_ROW = {
  id: 'problem-1',
  problemStatement: 'Clinic owners lose hours to manual invoice reconciliation',
  status: 'OBSERVED',
  revenueState: 'INTEREST',
};

const PROSPECT_ROW = {
  id: 'prospect-1',
  problemId: 'problem-1',
  prospectReference: 'clinic-owner-3',
  customerSegment: 'clinics',
  discoveryStatus: 'PAYMENT_REQUESTED',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.onSaved.mockReset();
  mocks.problemsRefetch.mockReset();
  mocks.prospectsRefetch.mockReset();
  mocks.problemListData = [PROBLEM_ROW];
  mocks.prospectsListData = [PROSPECT_ROW];
  mocks.problemRegisterMutate.mockReset();
  mocks.problemRegisterMutate.mockResolvedValue({ success: true, data: { id: 'problem-9' } });
  mocks.observationRecordMutate.mockReset();
  mocks.observationRecordMutate.mockResolvedValue({ success: true });
  mocks.prospectRegisterMutate.mockReset();
  mocks.prospectRegisterMutate.mockResolvedValue({ success: true });
  mocks.prospectAdvanceMutate.mockReset();
  mocks.prospectAdvanceMutate.mockResolvedValue({ success: true });
});

function openDrawer(): void {
  render(<EvidenceEntryPanel onSaved={mocks.onSaved} />);
  fireEvent.click(screen.getByRole('button', { name: /Add Evidence/i }));
}

function switchMode(label: string): void {
  fireEvent.click(screen.getByRole('tab', { name: new RegExp(label) }));
}

describe('EvidenceEntryPanel — entry point', () => {
  it('renders the Add Evidence button and opens the drawer with mode tabs', () => {
    openDrawer();
    // The Radix dialog renders a visually-hidden title with the same text as
    // the panel heading — assert on the unique guidance copy instead.
    expect(screen.getAllByText('Record founder evidence').length).toBeGreaterThan(0);
    expect(screen.getByText(/backend stays authoritative/i)).toBeDefined();
    for (const label of ['Problem', 'Observation', 'Prospect', 'Advance']) {
      expect(screen.getByRole('tab', { name: new RegExp(label) })).toBeDefined();
    }
  });

  it('shows honest EMPTY state guidance when no problems exist', () => {
    mocks.problemListData = [];
    openDrawer();
    switchMode('Observation');
    expect(screen.getByText(/No problems registered yet/i)).toBeDefined();
    expect(
      (screen.getByRole('button', { name: /Record observation/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('EvidenceEntryPanel — problem registration', () => {
  it('refuses a problem without evidence (no fabricated problems)', async () => {
    openDrawer();
    fireEvent.change(screen.getByLabelText('Problem statement'), {
      target: { value: 'Founders cannot find paying customers' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Register problem/i }));
    await waitFor(() => {
      expect(screen.getByText(/A problem requires at least one evidence record/i)).toBeDefined();
    });
    expect(mocks.problemRegisterMutate).not.toHaveBeenCalled();
  });

  it('registers a problem with evidence through world.problemRegister and refreshes', async () => {
    openDrawer();
    fireEvent.change(screen.getByLabelText('Problem statement'), {
      target: { value: 'Clinic owners lose hours to manual reconciliation' },
    });
    fireEvent.change(screen.getByLabelText('What is the evidence?'), {
      target: { value: 'Two owners described it as a weekly time sink' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Register problem/i }));
    await waitFor(() => {
      expect(mocks.problemRegisterMutate).toHaveBeenCalledWith({
        userId: 'user-1',
        problemStatement: 'Clinic owners lose hours to manual reconciliation',
        evidence: [
          {
            source: 'customer_interview',
            text: 'Two owners described it as a weekly time sink',
            confidence: 'VERIFIED',
          },
        ],
      });
    });
    await waitFor(() => {
      expect(mocks.onSaved).toHaveBeenCalled();
    });
  });
});

describe('EvidenceEntryPanel — observation entry', () => {
  it('refuses an observation without provenance (provenance REQUIRED)', async () => {
    openDrawer();
    switchMode('Observation');
    fireEvent.change(screen.getByLabelText('Problem'), {
      target: { value: 'problem-1' },
    });
    fireEvent.change(screen.getByLabelText('Who / what is this about?'), {
      target: { value: '3 clinic owners' },
    });
    fireEvent.change(screen.getByLabelText('What did you observe?'), {
      target: { value: 'Reconciliation takes 4+ hours weekly' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Record observation/i }));
    await waitFor(() => {
      expect(screen.getByText(/Provenance is REQUIRED/i)).toBeDefined();
    });
    expect(mocks.observationRecordMutate).not.toHaveBeenCalled();
  });

  it('never offers VERIFIED as a self-claimable tag', () => {
    openDrawer();
    switchMode('Observation');
    const tag = screen.getByLabelText(/Tag/);
    const options = within(tag)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).not.toContain('Verified (cross-checked)');
    expect(options).toContain('Hypothesis / assumption');
  });

  it('records a valid observation through world.observationRecord with provenance and refreshes', async () => {
    openDrawer();
    switchMode('Observation');
    fireEvent.change(screen.getByLabelText('Problem'), {
      target: { value: 'problem-1' },
    });
    fireEvent.change(screen.getByLabelText('Who / what is this about?'), {
      target: { value: '3 clinic owners' },
    });
    fireEvent.change(screen.getByLabelText('What did you observe?'), {
      target: { value: 'Reconciliation takes 4+ hours weekly' },
    });
    fireEvent.change(screen.getByLabelText('Source'), {
      target: { value: 'Founder interview notes' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Record observation/i }));
    await waitFor(() => {
      expect(mocks.observationRecordMutate).toHaveBeenCalledWith({
        userId: 'user-1',
        problemId: 'problem-1',
        sourceType: 'customer_conversation',
        sourceReference: '3 clinic owners',
        observedStatement: 'Reconciliation takes 4+ hours weekly',
        context: undefined,
        affectedCustomerSegment: undefined,
        frequency: undefined,
        severity: undefined,
        claimedState: undefined,
        provenance: { source: 'Founder interview notes', observedAt: expect.any(String) },
      });
    });
    await waitFor(() => {
      expect(mocks.onSaved).toHaveBeenCalled();
    });
  });

  it('displays backend validation errors verbatim', async () => {
    mocks.observationRecordMutate.mockResolvedValue({
      success: false,
      error: { message: 'Provenance is REQUIRED — every observation needs a source.' },
    });
    openDrawer();
    switchMode('Observation');
    fireEvent.change(screen.getByLabelText('Problem'), {
      target: { value: 'problem-1' },
    });
    fireEvent.change(screen.getByLabelText('Who / what is this about?'), {
      target: { value: '3 clinic owners' },
    });
    fireEvent.change(screen.getByLabelText('What did you observe?'), {
      target: { value: 'Reconciliation takes 4+ hours weekly' },
    });
    fireEvent.change(screen.getByLabelText('Source'), {
      target: { value: 'Call log' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Record observation/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/Provenance is REQUIRED — every observation needs a source/i),
      ).toBeDefined();
    });
  });
});

describe('EvidenceEntryPanel — prospect entry', () => {
  it('creates a prospect through world.prospectRegister with provenance', async () => {
    openDrawer();
    switchMode('Prospect');
    fireEvent.change(screen.getByLabelText('Problem'), {
      target: { value: 'problem-1' },
    });
    fireEvent.change(screen.getByLabelText('Prospect reference'), {
      target: { value: 'clinic-owner-3' },
    });
    fireEvent.change(screen.getByLabelText('Customer segment'), {
      target: { value: 'Clinics < 20 staff' },
    });
    fireEvent.change(screen.getByLabelText('Problem discussed'), {
      target: { value: 'Weekly invoice reconciliation burden' },
    });
    fireEvent.change(screen.getByLabelText('Source'), {
      target: { value: 'Call log' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Record prospect/i }));
    await waitFor(() => {
      expect(mocks.prospectRegisterMutate).toHaveBeenCalledWith({
        userId: 'user-1',
        problemId: 'problem-1',
        prospectReference: 'clinic-owner-3',
        customerSegment: 'Clinics < 20 staff',
        problemDiscussed: 'Weekly invoice reconciliation burden',
        painSeverity: undefined,
        desiredOutcome: undefined,
        nextStep: undefined,
        provenance: { source: 'Call log', observedAt: expect.any(String) },
      });
    });
    await waitFor(() => {
      expect(mocks.onSaved).toHaveBeenCalled();
    });
  });

  it('shows the discovery ≠ validation honesty copy', () => {
    openDrawer();
    switchMode('Prospect');
    expect(screen.getByText(/Discovery ≠ validation/i)).toBeDefined();
    expect(screen.getByText(/interest ≠ revenue/i)).toBeDefined();
  });
});

describe('EvidenceEntryPanel — prospect advance', () => {
  it('offers ONLY valid next states from the bounded chain', () => {
    openDrawer();
    switchMode('Advance');
    fireEvent.change(screen.getByLabelText('Problem'), {
      target: { value: 'problem-1' },
    });
    fireEvent.change(screen.getByLabelText('Prospect'), {
      target: { value: 'clinic-owner-3' },
    });
    // Prospect is PAYMENT_REQUESTED → only VERIFIED_PAYMENT and LOST.
    const target = screen.getByLabelText(/Request transition to/i);
    const options = within(target)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toContain('Verified payment');
    expect(options).toContain('Lost');
    expect(options).not.toContain('Problem confirmed');
    expect(options).not.toContain('In conversation');
  });

  it('requires payment evidence for VERIFIED_PAYMENT (never fabricated)', async () => {
    openDrawer();
    switchMode('Advance');
    fireEvent.change(screen.getByLabelText('Problem'), {
      target: { value: 'problem-1' },
    });
    fireEvent.change(screen.getByLabelText('Prospect'), {
      target: { value: 'clinic-owner-3' },
    });
    fireEvent.change(screen.getByLabelText(/Request transition to/i), {
      target: { value: 'VERIFIED_PAYMENT' },
    });
    expect(screen.getByText(/Payment evidence \(required\)/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Record verified payment/i }));
    await waitFor(() => {
      expect(screen.getByText(/requires the actual payment evidence/i)).toBeDefined();
    });
    expect(mocks.prospectAdvanceMutate).not.toHaveBeenCalled();
  });

  it('advances a prospect with real payment evidence through world.prospectAdvance', async () => {
    openDrawer();
    switchMode('Advance');
    fireEvent.change(screen.getByLabelText('Problem'), {
      target: { value: 'problem-1' },
    });
    fireEvent.change(screen.getByLabelText('Prospect'), {
      target: { value: 'clinic-owner-3' },
    });
    fireEvent.change(screen.getByLabelText(/Request transition to/i), {
      target: { value: 'VERIFIED_PAYMENT' },
    });
    fireEvent.change(screen.getByLabelText('Payment evidence'), {
      target: { value: '₹4,999 paid via Razorpay on 2026-08-16 (ref INV-1042)' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Record verified payment/i }));
    await waitFor(() => {
      expect(mocks.prospectAdvanceMutate).toHaveBeenCalledWith({
        userId: 'user-1',
        problemId: 'problem-1',
        prospectReference: 'clinic-owner-3',
        to: 'VERIFIED_PAYMENT',
        verifiedPaymentText: '₹4,999 paid via Razorpay on 2026-08-16 (ref INV-1042)',
      });
    });
    await waitFor(() => {
      expect(mocks.onSaved).toHaveBeenCalled();
    });
  });
});

describe('EvidenceEntryPanel — mutation refresh correctness (live-verified defects)', () => {
  it('refreshes BOTH the problem selector and the prospect list after a save', async () => {
    // Genuine defect D1 (found in real Chrome): handleSaved only refetched
    // problemsQuery, so after a transition the drawer offered stale next
    // states (the prospect list still showed the old status).
    mocks.prospectsListData = [{ ...PROSPECT_ROW, discoveryStatus: 'CONTACTED' }];
    openDrawer();
    switchMode('Advance');
    fireEvent.change(screen.getByLabelText('Problem'), {
      target: { value: 'problem-1' },
    });
    fireEvent.change(screen.getByLabelText('Prospect'), {
      target: { value: 'clinic-owner-3' },
    });
    fireEvent.change(screen.getByLabelText(/Request transition to/i), {
      target: { value: 'CONVERSATION' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Request transition/i }));
    await waitFor(() => {
      expect(mocks.prospectAdvanceMutate).toHaveBeenCalled();
    });
    await waitFor(() => {
      // The save must refresh BOTH read models the drawer depends on.
      expect(mocks.problemsRefetch).toHaveBeenCalled();
      expect(mocks.prospectsRefetch).toHaveBeenCalled();
    });
  });

  it('does not refetch the problem list in a loop while the drawer stays open', () => {
    // Genuine defect D2 (found in real Chrome): the open-effect depended on
    // `problemsQuery` (a fresh object identity every render), so while the
    // drawer was open every render re-ran the effect and refetched in an
    // infinite loop (30+ refetches in 2s, each burning a rate-limit token
    // until the gateway correctly returned 429).
    openDrawer();
    const callsAfterOpen = mocks.problemsRefetch.mock.calls.length;
    // Re-render several times (simulating state updates while open) — the
    // effect must NOT re-fire per render.
    for (let i = 0; i < 5; i++) {
      fireEvent.change(screen.getByLabelText('Problem statement'), {
        target: { value: `typed ${i}` },
      });
    }
    expect(mocks.problemsRefetch.mock.calls.length).toBe(callsAfterOpen);
    expect(mocks.problemsRefetch.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
