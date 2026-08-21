// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — ControlPanel Component Tests (SPRINT-031)
//
// Proves the autonomy-control surface:
//   - emergency stop state renders (engaged → halted messaging)
//   - autonomy settings save path calls the server (explicit confirmation)
//   - TODAY briefing shows pending approvals and no-spam empty state
//   - accessible controls (labels + aria)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ControlPanel } from '../ControlPanel.js';

const mocks = vi.hoisted(() => ({
  settingsRefetch: vi.fn(),
  briefingRefetch: vi.fn(),
  stopRefetch: vi.fn(),
  updateSettings: vi.fn(),
  engageStop: vi.fn(),
  releaseStop: vi.fn(),
}));

vi.mock('../../stores/auth-store.js', () => ({
  useAuthStore: (selector: (s: { user: { userId: string } | null }) => string) =>
    selector({ user: { userId: 'user-1' } }),
}));

vi.mock('../../lib/trpc.js', () => ({
  api: {
    control: {
      getSettings: { useQuery: () => ({ refetch: mocks.settingsRefetch, data: { data: null } }) },
      todayBriefing: { useQuery: () => ({ refetch: mocks.briefingRefetch, data: undefined }) },
      stopStatus: { useQuery: () => ({ refetch: mocks.stopRefetch, data: undefined }) },
      updateSettings: { useMutation: () => ({ mutateAsync: mocks.updateSettings }) },
      engageStop: { useMutation: () => ({ mutateAsync: mocks.engageStop }) },
      releaseStop: { useMutation: () => ({ mutateAsync: mocks.releaseStop }) },
    },
  },
}));

const confirmedSettings = {
  success: true,
  data: {
    autonomyLevel: 3,
    userConfirmed: true,
    maxDailyCostUsd: 5,
    maxTaskCostUsd: 1,
    privateOnly: false,
    notificationPreference: 'briefing-only',
  },
};

beforeEach(() => {
  mocks.settingsRefetch.mockReset();
  mocks.briefingRefetch.mockReset();
  mocks.stopRefetch.mockReset();
  mocks.updateSettings.mockReset();
  mocks.engageStop.mockReset();
  mocks.releaseStop.mockReset();
  mocks.settingsRefetch.mockResolvedValue({ data: { success: true, data: null } });
  mocks.briefingRefetch.mockResolvedValue({
    data: {
      success: true,
      data: {
        hasContent: false,
        pendingApprovals: [],
        opportunities: [],
        recommendedNextAction: 'Nothing.',
      },
    },
  });
  mocks.stopRefetch.mockResolvedValue({ data: { success: true, data: { engaged: false } } });
  mocks.updateSettings.mockResolvedValue(confirmedSettings);
  mocks.engageStop.mockResolvedValue({ success: true, data: { engaged: true } });
  mocks.releaseStop.mockResolvedValue({ success: true, data: { engaged: false } });
});

describe('ControlPanel', () => {
  it('shows the no-spam TODAY state and accessible controls', async () => {
    render(<ControlPanel />);
    await waitFor(() => {
      expect(screen.getByText(/nothing requires attention/i)).toBeDefined();
    });
    expect(screen.getByLabelText('Global autonomy level')).toBeDefined();
    expect(screen.getByLabelText('Engage emergency stop')).toBeDefined();
    expect(
      screen.getByLabelText(
        'Save autonomy settings (explicit confirmation)'.replace(' (explicit confirmation)', ''),
      ),
    ).toBeDefined();
  });

  it('saves explicit confirmed settings through the server', async () => {
    mocks.settingsRefetch.mockResolvedValue({ data: confirmedSettings });
    render(<ControlPanel />);
    await waitFor(() => {
      expect(screen.getByText('Autonomy')).toBeDefined();
    });
    fireEvent.change(screen.getByLabelText('Global autonomy level'), { target: { value: '4' } });
    fireEvent.click(screen.getByLabelText('Save autonomy settings'));
    await waitFor(() => {
      expect(mocks.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', autonomyLevel: 4, userConfirmed: true }),
      );
    });
    await waitFor(() => {
      expect(screen.getByText('Settings saved.')).toBeDefined();
    });
  });

  it('shows emergency-stop engaged state with a release path', async () => {
    mocks.stopRefetch.mockResolvedValue({ data: { success: true, data: { engaged: true } } });
    render(<ControlPanel />);
    await waitFor(() => {
      expect(screen.getByText(/emergency stop engaged/i)).toBeDefined();
    });
    expect(screen.getByText(/autonomous pathways are halted/i)).toBeDefined();
    fireEvent.click(screen.getByLabelText('Release emergency stop'));
    await waitFor(() => {
      expect(mocks.releaseStop).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
    });
  });

  it('shows pending approvals in the TODAY briefing when content exists', async () => {
    mocks.briefingRefetch.mockResolvedValue({
      data: {
        success: true,
        data: {
          hasContent: true,
          pendingApprovals: [
            { taskId: 't1', title: 'Publish the report', approvalRequired: ['publish'] },
          ],
          opportunities: [],
          recommendedNextAction: 'Review pending approvals',
        },
      },
    });
    render(<ControlPanel />);
    await waitFor(() => {
      expect(
        screen.getAllByText((content) => content.includes('pending approval')).length,
      ).toBeGreaterThan(0);
    });
    expect(screen.getByText(/Publish the report/i)).toBeDefined();
  });
});
