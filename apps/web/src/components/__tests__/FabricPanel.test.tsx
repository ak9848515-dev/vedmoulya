// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — FabricPanel Component Tests (SPRINT-030)
//
// Proves the intelligence-fabric surface:
//   - renders observed provider health (UNKNOWN never fabricated)
//   - honest empty state: no observations → "UNKNOWN until real calls"
//   - error state + retry
//   - accessible controls (refresh button)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { FabricPanel } from '../FabricPanel.js';

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
}));

vi.mock('../../stores/auth-store.js', () => ({
  useAuthStore: (selector: (s: { user: { userId: string } | null }) => string) =>
    selector({ user: { userId: 'user-1' } }),
}));

vi.mock('../../lib/trpc.js', () => ({
  api: {
    fabric: {
      allProviderHealth: {
        useQuery: () => ({
          refetch: mocks.refetch,
        }),
      },
    },
  },
}));

function health(overrides: Record<string, unknown> = {}) {
  return {
    providerId: 'openai',
    state: 'HEALTHY',
    observedCalls: 12,
    recentSuccessRate: 1,
    avgLatencyMs: 540,
    evidence: ['12/12 recent calls succeeded'],
    ...overrides,
  };
}

beforeEach(() => {
  mocks.refetch.mockReset();
});

describe('FabricPanel', () => {
  it('renders observed provider health with honest states', async () => {
    mocks.refetch.mockResolvedValue({
      data: {
        success: true,
        data: [health(), health({ providerId: 'anthropic', state: 'UNKNOWN', observedCalls: 0 })],
      },
    });
    render(<FabricPanel />);

    await waitFor(() => {
      expect(screen.getByText('openai')).toBeDefined();
    });
    expect(screen.getByText('HEALTHY')).toBeDefined();
    // UNKNOWN providers render too, but never fabricated as healthy.
    expect(screen.getByText('anthropic')).toBeDefined();
    expect(screen.getByText('UNKNOWN')).toBeDefined();
  });

  it('shows an honest empty state when no calls have been observed', async () => {
    mocks.refetch.mockResolvedValue({ data: { success: true, data: [] } });
    render(<FabricPanel />);
    await waitFor(() => {
      expect(screen.getByText(/UNKNOWN until real calls are observed/i)).toBeDefined();
    });
  });

  it('shows a readable error and allows retry when the service fails', async () => {
    mocks.refetch.mockResolvedValue({ data: { success: false, data: null } });
    render(<FabricPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Could not reach the intelligence fabric/i)).toBeDefined();
    });
    mocks.refetch.mockResolvedValue({ data: { success: true, data: [health()] } });
    fireEvent.click(screen.getByLabelText('Refresh provider health'));
    await waitFor(() => {
      expect(screen.getByText('openai')).toBeDefined();
    });
  });

  it('never claims autonomy — the gating notice is always present', async () => {
    mocks.refetch.mockResolvedValue({ data: { success: true, data: [] } });
    render(<FabricPanel />);
    await waitFor(() => {
      expect(
        screen.getByText(/nothing executes without the existing approval authority/i),
      ).toBeDefined();
    });
  });
});
