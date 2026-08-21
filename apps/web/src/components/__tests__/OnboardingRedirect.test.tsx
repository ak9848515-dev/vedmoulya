// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — OnboardingRedirect Gate Tests (SPRINT-041B)
//
// The SINGLE central first-login gate:
//   - routes authenticated users with EXPLICIT server-derived
//     profileComplete=false to /onboarding/profile with ?next= preserved
//   - NEVER fires on undefined completion (legacy sessions / in-flight refresh)
//   - never fires for completed users (returning users bypass onboarding)
//   - never fires on the auth-flow screens (/login, /signup, /oauth2redirect,
//     /onboarding/profile) — no redirect loop
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  useAuthHydrated: vi.fn(),
  useAuthStore: vi.fn(),
  usePathname: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => mocks.usePathname(),
}));

vi.mock('../../stores/auth-store.js', () => ({
  useAuthHydrated: mocks.useAuthHydrated,
  useAuthStore: mocks.useAuthStore,
}));

import { OnboardingRedirect } from '../OnboardingRedirect.js';

function setPath(pathname: string, search = ''): void {
  Object.defineProperty(window, 'location', {
    value: { pathname, search },
    writable: true,
  });
}

function mockState(overrides: {
  profileComplete?: boolean | undefined;
  sessionReady?: boolean;
}): void {
  mocks.useAuthHydrated.mockReturnValue(true);
  mocks.useAuthStore.mockReturnValue({
    sessionReady: overrides.sessionReady ?? true,
    user: {
      userId: 'usr_1',
      email: 'u@v.local',
      role: 'user',
      profileComplete: overrides.profileComplete,
    },
    offline: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setPath('/intelligence');
  mocks.usePathname.mockReturnValue('/intelligence');
});

describe('OnboardingRedirect — first-login gate (SPRINT-041B)', () => {
  it('routes an incomplete user to /onboarding/profile preserving ?next=', async () => {
    mockState({ profileComplete: false });
    render(<OnboardingRedirect />);
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith(
        '/onboarding/profile?next=' + encodeURIComponent('/intelligence'),
      );
    });
  });

  it('does NOT fire for a completed user (returning users bypass onboarding)', async () => {
    mockState({ profileComplete: true });
    render(<OnboardingRedirect />);
    await waitFor(() => {
      expect(mocks.replace).not.toHaveBeenCalled();
    });
  });

  it('does NOT fire when completion is UNKNOWN (legacy sessions, in-flight refresh)', async () => {
    mockState({ profileComplete: undefined });
    render(<OnboardingRedirect />);
    await waitFor(() => {
      expect(mocks.replace).not.toHaveBeenCalled();
    });
  });

  it('does NOT fire for an unauthenticated user (SignInRedirect handles that)', async () => {
    mocks.useAuthHydrated.mockReturnValue(true);
    mocks.useAuthStore.mockReturnValue({ sessionReady: true, user: null, offline: false });
    render(<OnboardingRedirect />);
    await waitFor(() => {
      expect(mocks.replace).not.toHaveBeenCalled();
    });
  });

  it('does NOT fire before the session restore completes', async () => {
    mockState({ profileComplete: false, sessionReady: false });
    render(<OnboardingRedirect />);
    await waitFor(() => {
      expect(mocks.replace).not.toHaveBeenCalled();
    });
  });

  it.each(['/login', '/signup', '/oauth2redirect', '/onboarding/profile'])(
    'never hijacks the auth-flow screen %s (no redirect loop)',
    async (path) => {
      mockState({ profileComplete: false });
      setPath(path);
      mocks.usePathname.mockReturnValue(path);
      render(<OnboardingRedirect />);
      await waitFor(() => {
        expect(mocks.replace).not.toHaveBeenCalled();
      });
    },
  );

  it('fires when the user lands on a protected route via CLIENT-SIDE navigation after signup', async () => {
    // Regression (SPRINT-041B deep verification): the gate previously only
    // depended on [hydrated, sessionReady, user, router] — the effect ran once
    // on the excluded /signup screen and never re-fired when signup's
    // router.replace(next) landed on /intelligence. The pathname must be a
    // dependency so the gate re-evaluates on every route change.
    mockState({ profileComplete: false });
    setPath('/signup');
    mocks.usePathname.mockReturnValue('/signup');
    const { rerender } = render(<OnboardingRedirect />);
    await waitFor(() => {
      expect(mocks.replace).not.toHaveBeenCalled();
    });
    // Signup completed: session applied, then router.replace('/intelligence').
    mocks.usePathname.mockReturnValue('/intelligence');
    rerender(<OnboardingRedirect />);
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith(
        '/onboarding/profile?next=' + encodeURIComponent('/intelligence'),
      );
    });
  });
});
