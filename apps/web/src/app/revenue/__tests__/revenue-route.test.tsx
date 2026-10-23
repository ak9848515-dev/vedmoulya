// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — /revenue route tests (LEARN-REVENUE-002)
//
// Proves the earning surface is now a real, guarded, navigable route:
//   • unauthenticated → sign-in redirect (never a blank/disabled screen)
//   • authenticated   → the EXISTING CommandCenter mounts, opened on the
//                       revenue section rather than the briefing tab
//   • /revenue is owned by Life in the one navigation model, so breadcrumbs
//     and active state cannot disagree with it
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { destinationForPathname } from '../../../lib/navigation-model.js';

const mocks = vi.hoisted(() => ({
  user: null as { userId: string } | null,
  hydrated: true,
  sessionReady: true,
  initialTabs: [] as Array<string | undefined>,
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({}) }));

vi.mock('../../../stores/auth-store.js', () => ({
  useAuthStore: (selector?: (state: unknown) => unknown) => {
    const state = {
      user: mocks.user,
      sessionReady: mocks.sessionReady,
    };
    return selector ? selector(state) : state;
  },
  useAuthHydrated: () => mocks.hydrated,
}));

vi.mock('../../../components/SignInRedirect.js', () => ({
  SignInRedirect: () => React.createElement('div', { 'data-testid': 'sign-in-redirect' }),
}));

vi.mock('../../../components/ErrorBoundary.js', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

// The command center itself is covered by CommandCenter.test.tsx; here we only
// prove THIS route mounts it on the earning section.
vi.mock('../../../components/CommandCenter.js', () => ({
  CommandCenter: ({ initialTab }: { initialTab?: string }) => {
    mocks.initialTabs.push(initialTab);
    return React.createElement('div', { 'data-testid': 'command-center' });
  },
}));

const RevenuePage = (await import('../page.js')).default;

describe('/revenue — access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.initialTabs = [];
    mocks.user = { userId: 'u1' };
    mocks.hydrated = true;
    mocks.sessionReady = true;
  });

  it('shows the loading state until auth has hydrated', () => {
    mocks.hydrated = false;
    render(React.createElement(RevenuePage));
    expect(screen.getByText('Loading your revenue...')).toBeDefined();
    expect(screen.queryByTestId('command-center')).toBeNull();
  });

  it('redirects to sign-in when there is no session', () => {
    mocks.user = null;
    render(React.createElement(RevenuePage));
    expect(screen.getByTestId('sign-in-redirect')).toBeDefined();
    expect(screen.queryByTestId('command-center')).toBeNull();
  });
});

describe('/revenue — earning surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.initialTabs = [];
    mocks.user = { userId: 'u1' };
    mocks.hydrated = true;
    mocks.sessionReady = true;
  });

  it('mounts the existing command center on the revenue section', () => {
    render(React.createElement(RevenuePage));
    expect(screen.getByTestId('command-center')).toBeDefined();
    expect(mocks.initialTabs).toEqual(['portfolio']);
  });

  it('is owned by Life in the one navigation model', () => {
    expect(destinationForPathname('/revenue').id).toBe('life');
  });
});
