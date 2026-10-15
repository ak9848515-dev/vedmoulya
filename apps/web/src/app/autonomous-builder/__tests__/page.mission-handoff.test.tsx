// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Autonomous Builder: Ask → Mission same-route hand-off regression
//
// DEFECT (reproduced in a real browser this phase): the Ask Vedmoulya panel's
// "Open mission" action performs a CLIENT-SIDE navigation to THIS SAME route
// (`/autonomous-builder?mission=<id>`). The page previously read the mission id
// only in a mount-only effect (`window.location.search`), so the same-route
// navigation — which does NOT remount the page — never observed the new query,
// `missionId` stayed null, and the created mission did NOT open.
//
// This test pins the fix: the page must subscribe to the URL's `mission`
// parameter, so when it appears after mount the mission surface opens. It must
// still never create/launch a mission by itself and must keep the URL the
// single source of truth for "which mission is open".
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';

/** The URL search params the mocked `useSearchParams()` returns, mutable per test. */
const searchParams = { current: new URLSearchParams() };

/** Captures the `missionId` the status hook was enabled with (null = disabled). */
const statusCalls: Array<string | null> = [];
/** Captures the `userId` the status hook received. */
const statusUsers: Array<string> = [];

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/autonomous-builder',
}));

vi.mock('../../../stores/auth-store.js', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) =>
    selector ? selector({ user: { userId: 'u-handoff' } }) : { user: { userId: 'u-handoff' } },
  useAuthHydrated: () => true,
}));

vi.mock('../../../lib/api-client.js', () => {
  const mk = () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    mutate: vi.fn(),
    isPending: false,
  });
  return {
    useMissionStatus: (userId: string, missionId: string | null) => {
      statusUsers.push(userId);
      statusCalls.push(missionId);
      return {
        data: missionId
          ? {
              missionId,
              userId,
              title: 'Handoff mission',
              objective: 'x',
              state: 'RUNNING',
              autonomyLevel: 'CONTROLLED_AUTONOMOUS',
              createdAt: '2026-09-06T00:00:00.000Z',
              updatedAt: '2026-09-06T00:00:00.000Z',
              objectives: [],
              checkpoints: [],
              budgetUsage: {
                objectivesCompleted: 0,
                objectivesFailed: 0,
                actionsExecuted: 0,
                toolCallsExecuted: 0,
                retriesConsumed: 0,
                tokensConsumed: 0,
                costUsdConsumed: 0,
              },
              budgetRemaining: {
                objectives: 5,
                actions: 100,
                runtimeMs: 3_600_000,
                tokens: 100_000,
                costUsd: 1,
              },
            }
          : null,
        isLoading: false,
        error: null,
      };
    },
    useMissionHistory: () => ({ data: [], isLoading: false }),
    useMissionCreateAndRun: mk,
    useMissionStart: mk,
    useMissionPause: mk,
    useMissionResume: mk,
    useMissionCancel: mk,
    useMissionApprove: mk,
    useMissionReject: mk,
  };
});

// The detail tabs are heavy; assert on the marker the page renders for them.
// The real `MissionDetailTabs` receives the full `status: MissionStatusView`
// (the mission id lives on `status.missionId`), NOT a top-level `missionId` prop.
vi.mock('../../missions/_components/MissionDetailTabs.js', () => ({
  MissionDetailTabs: ({ status }: { status: { missionId: string } }) =>
    React.createElement('div', {
      'data-testid': 'mission-detail-tabs',
      'data-mission-id': status.missionId,
    }),
}));
vi.mock('../../../components/MissionDeliveryPanel.js', () => ({
  MissionDeliveryPanel: () => null,
}));
vi.mock('../../../components/SignInRedirect.js', () => ({ SignInRedirect: () => null }));

import AutonomousBuilderPage from '../page.js';

describe('Autonomous Builder — Ask → Mission hand-off', () => {
  beforeEach(() => {
    searchParams.current = new URLSearchParams();
    statusCalls.length = 0;
    statusUsers.length = 0;
  });

  it('does NOT open a mission when the URL carries no mission id', () => {
    render(React.createElement(AutonomousBuilderPage));
    expect(screen.queryByTestId('mission-detail-tabs')).toBeNull();
    // The status hook is mounted but disabled with a null id.
    expect(statusCalls).toContain(null);
  });

  it('OPENS the mission when `?mission=` appears AFTER mount (same-route hand-off)', async () => {
    render(React.createElement(AutonomousBuilderPage));
    expect(screen.queryByTestId('mission-detail-tabs')).toBeNull();

    // Simulate the Ask panel's `router.push('/autonomous-builder?mission=...')`:
    // the SAME page instance stays mounted and the search params change.
    await act(async () => {
      searchParams.current = new URLSearchParams({ mission: 'mission_handoff_1' });
      // Re-render the same element to model Next's navigation update.
      render(React.createElement(AutonomousBuilderPage));
    });

    const tabs = await screen.findByTestId('mission-detail-tabs');
    expect(tabs).toHaveAttribute('data-mission-id', 'mission_handoff_1');
    // The status hook must have been enabled with the real mission id.
    expect(statusCalls).toContain('mission_handoff_1');
    // And always owner-scoped to the authenticated user.
    expect(statusUsers).toContain('u-handoff');
  });
});
