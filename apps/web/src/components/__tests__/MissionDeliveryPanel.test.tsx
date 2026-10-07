// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — REVENUE-001 · MissionDeliveryPanel
//
// Proves the last inch of the first-revenue path stays human-controlled:
//   • a VERIFIED objective yields a deterministic draft (no fabrication)
//   • no action fires on render
//   • the human prepares a DRAFT (mission.deliver) and then explicitly records
//     the COMMERCIAL_PENDING outcome
//   • with no VERIFIED objective the panel states that and offers NO action
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MissionDeliveryPanel } from '../MissionDeliveryPanel.js';
import { deriveDeliverableContent } from '../../lib/api-client.js';
import type { MissionStatusView } from '../../lib/api-client.js';

const mocks = vi.hoisted(() => ({
  deliver: vi.fn(),
  recordOutcome: vi.fn(),
}));

vi.mock('../../lib/api-client.js', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/api-client.js')>('../../lib/api-client.js');
  return {
    ...actual,
    useMissionDeliver: () => ({ mutateAsync: mocks.deliver, isPending: false }),
    useRecordCommercialOutcome: () => ({ mutateAsync: mocks.recordOutcome, isPending: false }),
  };
});

function mission(overrides: Partial<MissionStatusView> = {}): MissionStatusView {
  return {
    missionId: 'm-1',
    userId: 'user-1',
    title: 'Build the greeting asset',
    objective: 'Build the greeting asset',
    state: 'COMPLETED',
    autonomyLevel: 'CONTROLLED_AUTONOMOUS',
    createdAt: '2026-10-07T00:00:00.000Z',
    updatedAt: '2026-10-07T00:01:00.000Z',
    objectives: [
      {
        objectiveId: 'obj-1',
        title: 'Write greeting.md',
        state: 'VERIFIED',
        reason: 'File written and read back with exact content.',
        evidence: ['workspace_read ok'],
        verificationMethod: 'command',
        verifiedAt: '2026-10-07T00:01:00.000Z',
        retryCount: 0,
      },
    ],
    checkpoints: [],
    budgetUsage: {
      objectivesCompleted: 1,
      objectivesFailed: 0,
      actionsExecuted: 1,
      toolCallsExecuted: 1,
      retriesConsumed: 0,
      tokensConsumed: 0,
      costUsdConsumed: 0,
    },
    budgetRemaining: { objectives: 0, actions: 0, runtimeMs: 0, tokens: 0, costUsd: 0 },
    activity: [],
    loopRunning: false,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.deliver.mockReset();
  mocks.recordOutcome.mockReset();
});

describe('REVENUE-001 — MissionDeliveryPanel', () => {
  it('derives a deterministic draft from the verified objective', () => {
    const view = mission();
    const draft = deriveDeliverableContent(view);
    expect(draft?.objectiveId).toBe('obj-1');
    expect(draft?.content).toContain('Write greeting.md');
    expect(draft?.content).toContain('workspace_read ok');
  });

  it('returns no draft when nothing is VERIFIED (never fabricated)', () => {
    const view = mission({
      objectives: [
        {
          objectiveId: 'obj-1',
          title: 'Pending work',
          state: 'PENDING',
          reason: '',
          evidence: [],
          retryCount: 0,
        },
      ],
    });
    expect(deriveDeliverableContent(view)).toBeUndefined();

    render(<MissionDeliveryPanel mission={view} clientId="client-1" />);
    expect(screen.getByText(/No VERIFIED objective yet/)).toBeDefined();
    expect(screen.queryByLabelText('prepare-deliverable')).toBeNull();
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it('prepares a DRAFT only after an explicit human action, then records COMMERCIAL_PENDING', async () => {
    mocks.deliver.mockResolvedValue({ success: true, data: { documentId: 'doc_1' } });
    mocks.recordOutcome.mockResolvedValue({ success: true, data: { outcomeId: 'co_1' } });
    render(<MissionDeliveryPanel mission={mission()} clientId="client-1" />);

    // Nothing is delivered merely by rendering.
    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(mocks.recordOutcome).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('prepare-deliverable'));
    await waitFor(() => {
      expect(mocks.deliver).toHaveBeenCalledWith(
        expect.objectContaining({
          missionId: 'm-1',
          objectiveId: 'obj-1',
          clientId: 'client-1',
        }),
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('deliverable-draft')).toBeDefined();
    });

    // The commercial outcome is a SEPARATE explicit human action.
    expect(mocks.recordOutcome).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('record-commercial-outcome'));
    await waitFor(() => {
      expect(mocks.recordOutcome).toHaveBeenCalledWith({
        missionId: 'm-1',
        objectiveId: 'obj-1',
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId('commercial-pending')).toBeDefined();
    });
  });
});
