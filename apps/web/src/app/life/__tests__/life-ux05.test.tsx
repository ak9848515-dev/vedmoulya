// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — UX-05 Life Experience Tests
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  user: { userId: 'u1', email: 'anya@vedmoulya.com' } as { userId: string; email: string } | null,
  hydrated: true,
  sessionReady: true,
  snapshotData: null as Record<string, unknown> | null,
  snapshotLoading: false,
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({}) }));
vi.mock('../../../stores/auth-store.js', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => (selector ? selector(mocks) : mocks),
  useAuthHydrated: () => mocks.hydrated,
}));
vi.mock('../../../lib/api-client.js', () => ({
  useLifeOSSnapshot: () => ({
    data: mocks.snapshotData ? { success: true, data: mocks.snapshotData } : undefined,
    isLoading: mocks.snapshotLoading,
    isError: false,
  }),
}));
vi.mock('../../../components/SignInRedirect.js', () => ({
  SignInRedirect: () => React.createElement('div', { 'data-testid': 'sign-in-redirect' }),
}));
vi.mock('../../../components/ErrorBoundary.js', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

const LifePage = (await import('../page.js')).default;

function snapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    identity: { displayName: 'Anya', purpose: 'Building a livelihood' },
    career: { status: 'available', summary: 'Career is on track' },
    learning: { status: 'available', summary: 'Learning actively' },
    business: { status: 'degraded', summary: 'Needs attention' },
    marketplace: { status: 'available', summary: '' },
    priorities: [
      {
        id: 'p1',
        title: 'Ship landing page',
        source: 'mission',
        priority: 1,
        isBlocked: false,
        category: 'execution',
        description: 'Finalize',
        deadline: '',
      },
    ],
    ...overrides,
  };
}

describe('UX-05 Life — loading and auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { userId: 'u1', email: 'a@b.com' };
    mocks.hydrated = true;
    mocks.sessionReady = true;
    mocks.snapshotLoading = true;
    mocks.snapshotData = null;
  });

  it('shows loading skeleton', () => {
    render(React.createElement(LifePage));
    expect(document.querySelector('.skeleton')).toBeDefined();
  });

  it('shows sign-in redirect when not authenticated', () => {
    mocks.user = null;
    render(React.createElement(LifePage));
    expect(screen.getByTestId('sign-in-redirect')).toBeDefined();
  });
});

describe('UX-05 Life — landing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { userId: 'u1', email: 'a@b.com' };
    mocks.hydrated = true;
    mocks.sessionReady = true;
    mocks.snapshotLoading = false;
    mocks.snapshotData = snapshot();
  });

  it('shows the Life heading', () => {
    render(React.createElement(LifePage));
    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
  });

  it('shows real user name when focus exists', () => {
    mocks.snapshotData = snapshot({
      identity: {
        displayName: 'Anya',
        purpose: 'Building',
        primaryGoal: 'Launch MVP',
        currentJourney: 'Week 3',
      },
    });
    const { container } = render(React.createElement(LifePage));
    const text = container.textContent ?? '';
    expect(text).toContain('Anya');
  });

  it('renders all four area cards', () => {
    render(React.createElement(LifePage));
    expect(screen.getAllByText('Career').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Learning').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Business').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Marketplace').length).toBeGreaterThan(0);
  });

  it('shows real module status', () => {
    render(React.createElement(LifePage));
    const activeElements = screen.getAllByText('Active');
    expect(activeElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows attention banner for degraded modules', () => {
    render(React.createElement(LifePage));
    const attentionElements = screen.getAllByText('Needs attention');
    expect(attentionElements.length).toBeGreaterThanOrEqual(1);
  });
});

describe('UX-05 Life — goals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { userId: 'u1', email: 'a@b.com' };
    mocks.hydrated = true;
    mocks.sessionReady = true;
    mocks.snapshotLoading = false;
  });

  it('shows real goals when priorities exist', () => {
    mocks.snapshotData = snapshot();
    render(React.createElement(LifePage));
    expect(screen.getByText('Ship landing page')).toBeDefined();
  });

  it('shows empty state when no goals', () => {
    mocks.snapshotData = snapshot({ priorities: [] });
    render(React.createElement(LifePage));
    expect(screen.getByText(/No active goals yet/)).toBeDefined();
  });
});

describe('UX-05 Life — no fake data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { userId: 'u1', email: 'a@b.com' };
    mocks.hydrated = true;
    mocks.sessionReady = true;
    mocks.snapshotLoading = false;
    mocks.snapshotData = snapshot();
  });

  it('does not contain fabricated stats', () => {
    const { container } = render(React.createElement(LifePage));
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/99%/);
    expect(text).not.toMatch(/\$12\.4k/);
    expect(text).not.toMatch(/72%/);
    expect(text).not.toMatch(/Project Alpha/);
  });
});
