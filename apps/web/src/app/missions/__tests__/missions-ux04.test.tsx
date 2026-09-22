// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — UX-04 Missions Hardening Tests
//
// Pins the missions experience contract:
//   1. /missions landing renders real history only
//   2. mission filtering / history narrowing is state-driven (no invented groups)
//   3. MissionDetailTabs exposes Overview · Plan · Activity · Result · Advanced
//   4-8. each tab renders the real MissionStatusView fields
//   9. mission deep-linking uses the canonical operational route
//  10. state handling covers every mission state
//
// No backend, autonomy or execution semantics are exercised or changed here —
// these tests only pin what the UI shows and where it links.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import type { MissionStatusView, MissionHistoryEntry } from '../../../lib/api-client.js';

// React Testing Library does not auto-clean between tests in this workspace,
// so every test unmounts its tree explicitly (otherwise accumulated DOM makes
// `getByText` ambiguous across tests).
afterEach(() => {
  cleanup();
});

vi.mock('../../../stores/auth-store.js', () => ({
  useAuthStore: () => ({ user: { userId: 'u-1', email: 'a@b.com' }, sessionReady: true }),
  useAuthHydrated: () => true,
}));

vi.mock('../../../components/SignInRedirect.js', () => ({
  SignInRedirect: () => React.createElement('div', { 'data-testid': 'sign-in-redirect' }),
}));

const historyData = vi.hoisted(() => ({ current: [] as MissionHistoryEntry[] }));
vi.mock('../../../lib/api-client.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../../lib/api-client.js');
  return {
    ...actual,
    useMissionHistory: () => ({ data: historyData.current, isLoading: false, isError: false }),
  };
});

const MissionsPage = (await import('../page.js')).default;
// Filtering helpers live outside the route module (a Next.js page may only
// export its route contract), so they are imported from their own module.
const { filterMissions, missionFilterCounts } = await import('../mission-filters.js');
const { MissionDetailTabs } = await import('../_components/MissionDetailTabs.js');

// ── Fixtures (real DTO shapes) ─────────────────────────────────────────────

function historyEntry(overrides: Partial<MissionHistoryEntry> = {}): MissionHistoryEntry {
  return {
    missionId: 'm-1',
    title: 'Ship the landing page',
    objective: 'Publish a production landing page',
    state: 'RUNNING',
    createdAt: '2026-09-06T00:00:00.000Z',
    verifiedObjectives: 1,
    totalObjectives: 3,
    ...overrides,
  };
}

function statusView(overrides: Partial<MissionStatusView> = {}): MissionStatusView {
  return {
    missionId: 'm-1',
    userId: 'u-1',
    title: 'Certification mission',
    objective: 'Improve the workspace autonomously',
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
      tokens: 1_000_000,
      costUsd: 10,
    },
    activity: [],
    loopRunning: true,
    ...overrides,
  };
}

const noop = (): Promise<void> => Promise.resolve();

function renderMissions(): ReturnType<typeof render> {
  return render(React.createElement(MissionsPage));
}

// ── 1. /missions landing ──────────────────────────────────────────────────

describe('UX-04 — /missions landing', () => {
  it('renders the Missions heading and the journey language', () => {
    historyData.current = [historyEntry()];
    renderMissions();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Missions');
    expect(screen.getByText(/Goal → Mission → Plan → Execute → Verify → Result/)).toBeDefined();
  });

  it('shows the honest empty state when there are no missions', () => {
    historyData.current = [];
    renderMissions();
    expect(screen.getByText('No missions yet')).toBeDefined();
  });

  it('shows the real mission title and verified objective count', () => {
    historyData.current = [historyEntry({ verifiedObjectives: 2, totalObjectives: 4 })];
    renderMissions();
    expect(screen.getByText('Ship the landing page')).toBeDefined();
    expect(screen.getByText(/2\/4 verified/)).toBeDefined();
  });

  it('declares its parent context (Missions → All Missions)', () => {
    historyData.current = [historyEntry()];
    renderMissions();
    expect(screen.getByTestId('page-context-bar')).toBeDefined();
  });
});

// ─ 2. filtering / history ─────────────────────────────────────────────────

describe('UX-04 — mission filtering and history', () => {
  it('narrows by real state only', () => {
    const missions = [
      historyEntry({ missionId: 'a', state: 'RUNNING' }),
      historyEntry({ missionId: 'b', state: 'COMPLETED' }),
      historyEntry({ missionId: 'c', state: 'FAILED' }),
      historyEntry({ missionId: 'd', state: 'WAITING_FOR_APPROVAL' }),
      historyEntry({ missionId: 'e', state: 'CANCELLED' }),
      historyEntry({ missionId: 'f', state: 'PAUSED' }),
    ];

    expect(filterMissions(missions, 'all')).toHaveLength(6);
    expect(filterMissions(missions, 'active').map((m) => m.missionId)).toEqual(['a', 'd', 'f']);
    expect(filterMissions(missions, 'attention').map((m) => m.missionId)).toEqual(['d', 'f']);
    expect(filterMissions(missions, 'completed').map((m) => m.missionId)).toEqual(['b']);
    expect(filterMissions(missions, 'failed').map((m) => m.missionId)).toEqual(['c']);
    expect(filterMissions(missions, 'cancelled').map((m) => m.missionId)).toEqual(['e']);
  });

  it('counts every filter from the caller’s real list', () => {
    const counts = missionFilterCounts([
      historyEntry({ missionId: 'a', state: 'RUNNING' }),
      historyEntry({ missionId: 'b', state: 'BLOCKED' }),
      historyEntry({ missionId: 'c', state: 'COMPLETED' }),
    ]);
    expect(counts).toEqual({
      all: 3,
      active: 2,
      attention: 1,
      completed: 1,
      failed: 0,
      cancelled: 0,
    });
  });

  it('exposes a filter control per state and narrows the rendered list', () => {
    historyData.current = [
      historyEntry({ missionId: 'a', title: 'Running mission', state: 'RUNNING' }),
      historyEntry({ missionId: 'b', title: 'Completed mission', state: 'COMPLETED' }),
    ];
    renderMissions();

    expect(screen.getByTestId('mission-filter-completed')).toBeDefined();
    expect(screen.getByText('Running mission')).toBeDefined();
    expect(screen.getByText('Completed mission')).toBeDefined();

    fireEvent.click(screen.getByTestId('mission-filter-completed'));
    expect(screen.queryByText('Running mission')).toBeNull();
    expect(screen.getByText('Completed mission')).toBeDefined();
  });

  it('shows the filter-empty state instead of a blank list', () => {
    historyData.current = [historyEntry({ missionId: 'a', state: 'RUNNING' })];
    renderMissions();
    fireEvent.click(screen.getByTestId('mission-filter-failed'));
    expect(screen.getByTestId('mission-filter-empty')).toBeDefined();
  });
  // ── 3. MissionDetailTabs structure ─────────────────────────────────────────

  describe('UX-04 — MissionDetailTabs', () => {
    function renderTabs(overrides: Partial<MissionStatusView> = {}) {
      return render(
        React.createElement(MissionDetailTabs, {
          status: statusView(overrides),
          onStart: noop,
          onPause: noop,
          onResume: noop,
          onCancel: noop,
          onApprove: noop,
          onReject: noop,
          loopPending: false,
        }),
      );
    }

    // Tabs are queried by ROLE: the tab labels also appear as section headings
    // inside the tab content, so a raw text query is ambiguous. Radix activates a
    // tab on MOUSEDOWN — a plain `click` would leave the section unchanged and the
    // assertion would be checking the Overview content.
    function selectTab(label: string): void {
      fireEvent.mouseDown(screen.getByRole('tab', { name: label }));
    }

    it('offers Overview · Plan · Activity · Result · Advanced', () => {
      renderTabs();
      for (const label of ['Overview', 'Plan', 'Activity', 'Result', 'Advanced']) {
        expect(screen.getByRole('tab', { name: label }), label).toBeDefined();
      }
    });

    it('reuses the production LiveMissionView for live controls', () => {
      renderTabs();
      expect(screen.getByRole('heading', { name: /Mission controls & live status/ })).toBeDefined();
    });

    // G8 regression. The Overview tab renders the human summary (MissionOverview)
    // AND the live view side by side, and both describe the same mission. They
    // previously published the SAME ids (`mission-state`, `mission-outcome`,
    // `approval-panel`, `objective-timeline`), so a page-level
    // `getByTestId('mission-state')` resolved to two elements — a Playwright
    // strict-mode violation that failed the E2E gate. Each region must own a
    // unique id, so this test fails if a future edit reintroduces a collision.
    it('publishes unique test ids for the summary and the live view', () => {
      renderTabs({
        objectives: [
          {
            objectiveId: 'o1',
            title: 'First',
            state: 'VERIFIED',
            reason: 'Verified by the runtime',
            evidence: [],
            retryCount: 0,
          },
        ] as MissionStatusView['objectives'],
      });
      // The live view keeps the canonical ids the E2E spec asserts on...
      expect(screen.getAllByTestId('mission-state')).toHaveLength(1);
      expect(screen.getAllByTestId('objective-timeline')).toHaveLength(1);
      // ...and the Overview summary is namespaced separately.
      expect(screen.getAllByTestId('overview-state')).toHaveLength(1);
      expect(screen.getAllByTestId('overview-objective-timeline')).toHaveLength(1);
    });

    it('Overview shows the real objective and truthful progress', () => {
      renderTabs({
        // Real MissionObjectiveView shape.
        objectives: [
          {
            objectiveId: 'o1',
            title: 'First',
            state: 'VERIFIED',
            reason: 'Verified by the runtime',
            evidence: [],
            retryCount: 0,
          },
          {
            objectiveId: 'o2',
            title: 'Second',
            state: 'PENDING',
            reason: 'Not started yet',
            evidence: [],
            retryCount: 0,
          },
        ] as MissionStatusView['objectives'],
      });
      expect(screen.getByText(/1\/2 objectives verified/)).toBeDefined();
    });

    it('Plan renders real plan detail without inventing content', () => {
      renderTabs({ objectives: [] });
      selectTab('Plan');
      // With no objectives there is no plan to show — it says exactly that. The
      // copy is unique to the Plan tab, so this fails if the tab did not switch.
      expect(
        screen.getByText(/The mission plan will appear here once objectives are selected/),
      ).toBeDefined();
    });

    it('Activity renders the real activity stream', () => {
      renderTabs({
        activity: [
          // Real MissionActivityEvent shape: { id, at, kind, message }.
          {
            id: 'a1',
            kind: 'OBJECTIVE_STARTED',
            message: 'Started objective one',
            at: '2026-09-06T00:01:00.000Z',
          },
        ] as MissionStatusView['activity'],
      });
      selectTab('Activity');
      expect(screen.getByTestId('activity-list').textContent).toContain('Started objective one');
    });

    it('Result shows the real terminal outcome', () => {
      renderTabs({ state: 'COMPLETED', outcome: 'SUCCESS' });
      selectTab('Result');
      expect(screen.getByText('Mission Completed')).toBeDefined();
      expect(screen.getByText(/1|0\/0 objectives verified|objectives verified/)).toBeDefined();
    });

    it('Advanced keeps the technical detail available', () => {
      renderTabs();
      selectTab('Advanced');
      expect(screen.getByText('Budget Usage')).toBeDefined();
      expect(screen.getByText('Autonomy Level')).toBeDefined();
    });
  });
});
// ─ 9. deep linking ─────────────────────────────────────────────────────────

describe('UX-04 — mission deep-linking', () => {
  it('every mission card links to the canonical operational route', () => {
    historyData.current = [historyEntry({ missionId: 'm-42', title: 'Deep linked' })];
    renderMissions();
    const link = screen.getByText('Deep linked').closest('a');
    expect(link?.getAttribute('href')).toBe('/autonomous-builder?mission=m-42');
  });

  it('the next-action CTA deep-links to the mission that needs attention', () => {
    historyData.current = [
      historyEntry({ missionId: 'm-blocked', state: 'BLOCKED', title: 'Blocked one' }),
    ];
    renderMissions();
    const links = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('/autonomous-builder?mission=m-blocked');
  });
});

// ─ 10. state handling ─────────────────────────────────────────────────────

describe('UX-04 — every mission state has an honest presentation', () => {
  const states = [
    'CREATED',
    'RUNNING',
    'PAUSED',
    'WAITING_FOR_APPROVAL',
    'WAITING_FOR_PROVIDER',
    'BLOCKED',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
  ];

  it.each(states)('%s renders a labelled card with real progress', (state) => {
    historyData.current = [historyEntry({ missionId: `m-${state}`, state, title: `T-${state}` })];
    const { unmount } = renderMissions();
    expect(screen.getByText(`T-${state}`)).toBeDefined();
    expect(screen.getByText(/verified/)).toBeDefined();
    unmount();
  });

  it('tells the user when a mission needs their approval', () => {
    historyData.current = [
      historyEntry({ state: 'WAITING_FOR_APPROVAL', title: 'Needs approval' }),
    ];
    renderMissions();
    expect(screen.getByText(/Waiting for your approval/)).toBeDefined();
  });

  it('tells the user when a mission is blocked', () => {
    historyData.current = [historyEntry({ state: 'BLOCKED', title: 'Is blocked' })];
    renderMissions();
    expect(screen.getByText(/Blocked — needs intervention/)).toBeDefined();
  });

  it('tells the user when a mission is waiting for a provider', () => {
    historyData.current = [historyEntry({ state: 'WAITING_FOR_PROVIDER', title: 'Waits' })];
    renderMissions();
    expect(screen.getByText(/Waiting for an available AI provider/)).toBeDefined();
  });

  it('review controls remain available for active missions', () => {
    render(
      React.createElement(MissionDetailTabs, {
        status: statusView({ state: 'WAITING_FOR_APPROVAL' }),
        onStart: noop,
        onPause: noop,
        onResume: noop,
        onCancel: noop,
        onApprove: noop,
        onReject: noop,
        loopPending: false,
      }),
    );
    expect(document.body.textContent ?? '').toMatch(/approve/i);
    expect(document.body.textContent ?? '').toMatch(/reject|decline/i);
  });

  it('shows a live-pending affordance while the loop is being driven', () => {
    render(
      React.createElement(MissionDetailTabs, {
        status: statusView({ state: 'RUNNING' }),
        onStart: noop,
        onPause: noop,
        onResume: noop,
        onCancel: noop,
        onApprove: noop,
        onReject: noop,
        loopPending: true,
      }),
    );
    expect(document.body.textContent ?? '').toMatch(/working|running|in progress/i);
  });
});
