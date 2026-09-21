// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — UX-03 Home Experience Tests
//
// Verifies the Home hierarchy, real data usage, empty states, loading,
// navigation behavior, and accessibility structure.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  user: { userId: 'u1', email: 'anya@vedmoulya.com' } as { userId: string; email: string } | null,
  hydrated: true,
  sessionReady: true,
  offline: false,
  snapshotData: null as Record<string, unknown> | null,
  snapshotLoading: false,
  snapshotError: false,
  snapshotErrorMsg: '',
  refetch: vi.fn(),
  dataUpdatedAt: Date.now(),
  missionHistory: [] as Array<{ missionId: string; state: string }>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('../../stores/auth-store.js', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => (selector ? selector(mocks) : mocks),
  useAuthHydrated: () => mocks.hydrated,
}));

vi.mock('../../lib/api-client.js', () => ({
  useLifeOSSnapshot: () => ({
    data: mocks.snapshotData
      ? { success: true, data: mocks.snapshotData }
      : mocks.snapshotError
        ? { success: false }
        : undefined,
    isLoading: mocks.snapshotLoading,
    isError: mocks.snapshotError,
    error: mocks.snapshotErrorMsg ? { message: mocks.snapshotErrorMsg } : undefined,
    refetch: mocks.refetch,
    dataUpdatedAt: mocks.dataUpdatedAt,
  }),
  useMissionHistory: () => ({
    data: mocks.missionHistory,
    isLoading: false,
    isError: false,
  }),
  useProviderRuntimeStatus: () => ({ data: undefined, isLoading: true, isError: false }),
}));

vi.mock('../../lib/use-pull-to-refresh.js', () => ({
  usePullToRefresh: () => ({
    pageRef: { current: null },
    pullDistance: 0,
    refreshing: false,
  }),
}));

vi.mock('../../lib/startup.js', () => ({
  markStartup: vi.fn(),
  STARTUP_MARKS: { firstData: 'firstData' },
}));

vi.mock('../../lib/dashboard-cache.js', () => ({
  cacheDashboardSnapshot: vi.fn(),
  readCachedDashboard: () => null,
}));

vi.mock('../../components/SignInRedirect.js', () => ({
  SignInRedirect: () => React.createElement('div', { 'data-testid': 'sign-in-redirect' }),
}));

vi.mock('../../components/ErrorBoundary.js', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock('../sections/DashboardSkeleton.js', () => ({
  DashboardSkeleton: () => React.createElement('div', { 'data-testid': 'dashboard-skeleton' }),
}));

vi.mock('../sections/AskAIInput.js', () => ({
  AskAIInput: ({ userId }: { userId: string }) =>
    React.createElement('div', { 'data-testid': 'ask-ai-input', 'data-user-id': userId }),
}));

vi.mock('../sections/LifeMomentum.js', () => ({
  LifeMomentum: () => React.createElement('div', { 'data-testid': 'life-momentum' }),
}));

vi.mock('../sections/RecentActivity.js', () => ({
  RecentActivity: () => React.createElement('div', { 'data-testid': 'recent-activity' }),
}));

vi.mock('../sections/TodayMissionCard.js', () => ({
  TodayMissionCard: ({
    priority,
    execution,
  }: {
    priority?: { title: string };
    execution: { completedToday: number };
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'today-mission' },
      priority
        ? React.createElement('span', { 'data-testid': 'mission-title' }, priority.title)
        : React.createElement('span', { 'data-testid': 'no-mission' }, 'No mission'),
      React.createElement(
        'span',
        { 'data-testid': 'completed-today' },
        String(execution.completedToday),
      ),
    ),
}));

vi.mock('../sections/AISummaryCard.js', () => ({
  AISummaryCard: ({ aiContext }: { aiContext: { contextSummary: string } }) =>
    React.createElement('div', { 'data-testid': 'ai-summary' }, aiContext.contextSummary),
}));

vi.mock('../sections/JourneyOverview.js', () => ({
  JourneyOverview: () => React.createElement('div', { 'data-testid': 'journey-overview' }),
}));

vi.mock('../sections/ExecutionCenter.js', () => ({
  ExecutionCenter: () => React.createElement('div', { 'data-testid': 'execution-center' }),
}));

vi.mock('../sections/DecisionCenter.js', () => ({
  DecisionCenter: () => React.createElement('div', { 'data-testid': 'decision-center' }),
}));

vi.mock('../sections/AIInsights.js', () => ({
  AIInsights: () => React.createElement('div', { 'data-testid': 'ai-insights' }),
}));

vi.mock('../sections/RecommendationsPanel.js', () => ({
  RecommendationsPanel: () =>
    React.createElement('div', { 'data-testid': 'recommendations-panel' }),
}));

vi.mock('../sections/NotificationsPanel.js', () => ({
  NotificationsPanel: () => React.createElement('div', { 'data-testid': 'notifications-panel' }),
}));

vi.mock('../sections/ModuleStatusGrid.js', () => ({
  ModuleStatusGrid: () => React.createElement('div', { 'data-testid': 'module-status-grid' }),
}));

vi.mock('../sections/MemoryTimeline.js', () => ({
  MemoryTimeline: () => React.createElement('div', { 'data-testid': 'memory-timeline' }),
}));

vi.mock('../sections/PrioritiesList.js', () => ({
  PrioritiesList: () => React.createElement('div', { 'data-testid': 'priorities-list' }),
}));

// ── Import after mocks ───────────────────────────────────────────────────────

const Home = (await import('../page.js')).default;

// ── Helper ───────────────────────────────────────────────────────────────────

function snapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    identity: {
      displayName: 'Anya',
      email: 'anya@vedmoulya.com',
      purpose: 'Building a sustainable livelihood',
      primaryGoal: 'Launch MVP',
      currentJourney: 'Week 3',
    },
    metrics: { lifeScore: 72 },
    execution: { activePlans: 3, completedToday: 2, blockedPlans: 0, totalEstimatedMinutes: 120 },
    decisions: { pendingDecisions: 1, decisionsToday: 3, averageConfidence: 85, highRiskCount: 0 },
    memory: { totalMemories: 42, recentCount: 5, importantEvents: 2, aiObservations: ['Obs 1'] },
    aiContext: {
      contextSummary: 'You are making strong progress this week.',
      currentFocus: 'MVP launch',
      recentActivity: ['Completed goal'],
      suggestedQuestions: [],
      topPriorities: [],
      crossDomainInsights: [],
    },
    priorities: [
      {
        id: 'p1',
        title: 'Ship landing page',
        description: 'Finalize design and deploy',
        source: 'mission',
        priority: 1,
        isBlocked: false,
        category: 'execution',
      },
    ],
    crossDomainRecommendations: [],
    globalNotifications: [],
    career: { module: 'career', status: 'available', summary: 'Career is on track' },
    learning: { module: 'learning', status: 'available', summary: 'Learning actively' },
    business: { module: 'business', status: 'degraded', summary: 'Needs attention' },
    marketplace: { module: 'marketplace', status: 'available', summary: '' },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('UX-03 Home - loading and auth states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { userId: 'u1', email: 'anya@vedmoulya.com' };
    mocks.hydrated = true;
    mocks.sessionReady = true;
    mocks.snapshotData = null;
    mocks.snapshotLoading = true;
    mocks.snapshotError = false;
  });

  it('shows loading skeleton while data loads', () => {
    render(React.createElement(Home));
    expect(screen.getByTestId('dashboard-skeleton')).toBeDefined();
  });

  it('shows sign-in redirect when not authenticated', () => {
    mocks.user = null;
    render(React.createElement(Home));
    expect(screen.getByTestId('sign-in-redirect')).toBeDefined();
  });

  it('shows error state when snapshot fails', () => {
    mocks.snapshotLoading = false;
    mocks.snapshotError = true;
    mocks.snapshotErrorMsg = 'Network error';
    render(React.createElement(Home));
    expect(screen.getByText('Unable to Load Home')).toBeDefined();
    expect(screen.getByText('Network error')).toBeDefined();
  });
});

describe('UX-03 Home - greeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { userId: 'u1', email: 'anya@vedmoulya.com' };
    mocks.hydrated = true;
    mocks.sessionReady = true;
    mocks.snapshotLoading = false;
    mocks.snapshotError = false;
    mocks.snapshotData = snapshot();
  });

  it('uses real authenticated name, not hard-coded', () => {
    render(React.createElement(Home));
    expect(screen.getByText(/Anya/)).toBeDefined();
  });

  it('shows time-of-day greeting', () => {
    render(React.createElement(Home));
    const hour = new Date().getHours();
    const expected = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    expect(screen.getByText(new RegExp(expected))).toBeDefined();
  });

  it('shows purpose from real profile data', () => {
    render(React.createElement(Home));
    expect(screen.getByText(/Building a sustainable livelihood/)).toBeDefined();
  });
});

describe('UX-03 Home - priority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { userId: 'u1', email: 'anya@vedmoulya.com' };
    mocks.hydrated = true;
    mocks.sessionReady = true;
    mocks.snapshotLoading = false;
    mocks.snapshotError = false;
  });

  it('shows the top priority title when priorities exist', () => {
    mocks.snapshotData = snapshot();
    render(React.createElement(Home));
    expect(screen.getAllByText('Ship landing page').length).toBeGreaterThan(0);
    expect(screen.getByText("Today's Priority")).toBeDefined();
  });

  it('shows honest empty state when no priorities', () => {
    mocks.snapshotData = snapshot({ priorities: [] });
    render(React.createElement(Home));
    expect(screen.getByText(/All caught up/)).toBeDefined();
  });
});

describe('UX-03 Home - mission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { userId: 'u1', email: 'anya@vedmoulya.com' };
    mocks.hydrated = true;
    mocks.sessionReady = true;
    mocks.snapshotLoading = false;
    mocks.snapshotError = false;
    mocks.snapshotData = snapshot();
  });

  it('renders the TodayMissionCard with real data', () => {
    render(React.createElement(Home));
    expect(screen.getByTestId('today-mission')).toBeDefined();
    expect(screen.getByTestId('mission-title').textContent).toBe('Ship landing page');
  });

  it('shows completion count from real execution data', () => {
    render(React.createElement(Home));
    expect(screen.getByTestId('completed-today').textContent).toBe('2');
  });
});

describe('UX-03 Home - insight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { userId: 'u1', email: 'anya@vedmoulya.com' };
    mocks.hydrated = true;
    mocks.sessionReady = true;
    mocks.snapshotLoading = false;
    mocks.snapshotError = false;
  });

  it('shows AI summary when real insight exists', () => {
    mocks.snapshotData = snapshot();
    render(React.createElement(Home));
    expect(screen.getByTestId('ai-summary')).toBeDefined();
    expect(screen.getByText(/strong progress/)).toBeDefined();
  });

  it('shows honest fallback when no insight exists', () => {
    mocks.snapshotData = snapshot({
      aiContext: {
        contextSummary: '',
        currentFocus: '',
        recentActivity: [],
        suggestedQuestions: [],
        topPriorities: [],
        crossDomainInsights: [],
      },
    });
    render(React.createElement(Home));
    expect(screen.getByText(/Ask VedMoulya what to focus on/)).toBeDefined();
  });
});

describe('UX-03 Home - momentum and activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { userId: 'u1', email: 'anya@vedmoulya.com' };
    mocks.hydrated = true;
    mocks.sessionReady = true;
    mocks.snapshotLoading = false;
    mocks.snapshotError = false;
    mocks.snapshotData = snapshot();
  });

  it('renders LifeMomentum component', () => {
    render(React.createElement(Home));
    expect(screen.getByTestId('life-momentum')).toBeDefined();
  });

  it('renders RecentActivity component', () => {
    render(React.createElement(Home));
    expect(screen.getByTestId('recent-activity')).toBeDefined();
  });
});

describe('UX-03 Home - Ask VedMoulya', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { userId: 'u1', email: 'anya@vedmoulya.com' };
    mocks.hydrated = true;
    mocks.sessionReady = true;
    mocks.snapshotLoading = false;
    mocks.snapshotError = false;
    mocks.snapshotData = snapshot();
  });

  it('renders AskAIInput with the correct userId', () => {
    render(React.createElement(Home));
    const ask = screen.getByTestId('ask-ai-input');
    expect(ask.getAttribute('data-user-id')).toBe('u1');
  });
});

describe('UX-03 Home - deep dive collapsed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { userId: 'u1', email: 'anya@vedmoulya.com' };
    mocks.hydrated = true;
    mocks.sessionReady = true;
    mocks.snapshotLoading = false;
    mocks.snapshotError = false;
    mocks.snapshotData = snapshot();
  });

  it('has a details/summary for the deep dive section', () => {
    render(React.createElement(Home));
    const details = document.querySelector('details');
    expect(details).toBeDefined();
    // In test environment, mocked dynamic imports resolve immediately.
    // The key assertion is that the details element exists as the progressive-disclosure container.
    expect(details?.querySelector('summary')).toBeDefined();
  });
});

describe('UX-03 Home - no fabricated data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { userId: 'u1', email: 'anya@vedmoulya.com' };
    mocks.hydrated = true;
    mocks.sessionReady = true;
    mocks.snapshotLoading = false;
    mocks.snapshotError = false;
    mocks.snapshotData = snapshot();
  });

  it('does not contain hard-coded fake quotes', () => {
    const { container } = render(React.createElement(Home));
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/Small steps lead to great achievements/);
    expect(text).not.toMatch(/99% complete/);
  });
});

describe('UX-03 Home - navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { userId: 'u1', email: 'anya@vedmoulya.com' };
    mocks.hydrated = true;
    mocks.sessionReady = true;
    mocks.snapshotLoading = false;
    mocks.snapshotError = false;
    mocks.snapshotData = snapshot();
    mocks.missionHistory = [];
  });

  // UX-03: Home → Mission. "Continue" leads into the canonical mission
  // journey — the mission's operational detail when a real mission exists,
  // the Missions landing page otherwise. It never pretends a mission exists.
  it('Continue deep-links to the live mission when one exists', () => {
    mocks.missionHistory = [{ missionId: 'm-7', state: 'RUNNING' }];
    render(React.createElement(Home));
    const continueBtn = screen.getByRole('button', { name: /Continue/ });
    continueBtn.click();
    expect(mocks.push).toHaveBeenCalledWith('/autonomous-builder?mission=m-7');
  });

  it('Continue falls back to /missions when there is no mission', () => {
    render(React.createElement(Home));
    const continueBtn = screen.getByRole('button', { name: /Continue/ });
    continueBtn.click();
    expect(mocks.push).toHaveBeenCalledWith('/missions');
  });

  it('never routes to the legacy goals list', () => {
    mocks.missionHistory = [{ missionId: 'm-9', state: 'WAITING_FOR_APPROVAL' }];
    render(React.createElement(Home));
    screen.getByRole('button', { name: /Continue/ }).click();
    expect(mocks.push).not.toHaveBeenCalledWith('/goals');
  });
});
