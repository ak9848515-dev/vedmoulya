// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — First-Login Profile Setup Page Tests (SPRINT-041B)
//
// Covers the first-login profile contract:
//   - the page collects exactly Name / Age / Gender / Purpose / Primary Goal
//   - client-side validation mirrors the server zod contract (name 2–100, age
//     13–120, gender/purpose in the closed vocabularies, goal 1–200)
//   - saving calls the EXISTING PATCH /me/profile path via session-manager and
//     applies the server-returned completion state
//   - on success the page routes to the preserved ?next= destination (default /)
//   - a completed user is routed away (never sees onboarding again)
//   - the form is hardened against pre-hydration native submit leaks (POST)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  completeProfile: vi.fn(),
  replace: vi.fn(),
  useAuthHydrated: vi.fn(),
  useAuthStore: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock('../../../../auth/session-manager.js', () => ({
  completeProfile: mocks.completeProfile,
}));

vi.mock('../../../../components/SignInRedirect.js', () => ({
  SignInRedirect: () => null,
}));

vi.mock('../../../../stores/auth-store.js', () => ({
  useAuthHydrated: mocks.useAuthHydrated,
  useAuthStore: mocks.useAuthStore,
}));

import OnboardingProfilePage from '../page.js';

// An authenticated, INCOMPLETE user (server-derived profileComplete=false).
function mockIncompleteUser(): void {
  mocks.useAuthHydrated.mockReturnValue(true);
  mocks.useAuthStore.mockReturnValue({
    user: { userId: 'usr_1', email: 'new@vedmoulya.local', role: 'user', profileComplete: false },
    sessionReady: true,
    offline: false,
  });
}

// A COMPLETED user — the onboarding screen is not for them.
function mockCompletedUser(): void {
  mocks.useAuthHydrated.mockReturnValue(true);
  mocks.useAuthStore.mockReturnValue({
    user: { userId: 'usr_2', email: 'done@vedmoulya.local', role: 'user', profileComplete: true },
    sessionReady: true,
    offline: false,
  });
}

function setLocation(search: string, pathname = '/onboarding/profile'): void {
  Object.defineProperty(window, 'location', {
    value: { search, pathname },
    writable: true,
  });
}

function fillValidForm(gender = 'female'): void {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Local Test Founder' } });
  fireEvent.change(screen.getByLabelText('Age'), { target: { value: '28' } });
  fireEvent.change(screen.getByLabelText('Gender'), { target: { value: gender } });
  fireEvent.change(screen.getByLabelText('Purpose'), { target: { value: 'career' } });
  fireEvent.change(screen.getByLabelText('Primary Goal'), {
    target: { value: 'Become a senior engineer' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIncompleteUser();
  setLocation('');
});

describe('OnboardingProfilePage — first-login profile setup (SPRINT-041B)', () => {
  it('declares POST action so pre-hydration submits never leak into the URL', () => {
    render(<OnboardingProfilePage />);
    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    expect(form?.getAttribute('action')).toBe('/onboarding/profile');
    expect(form?.getAttribute('method')).toBe('post');
  });

  it('collects exactly the five required profile fields', () => {
    render(<OnboardingProfilePage />);
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect(screen.getByLabelText('Age')).toBeTruthy();
    expect(screen.getByLabelText('Gender')).toBeTruthy();
    expect(screen.getByLabelText('Purpose')).toBeTruthy();
    expect(screen.getByLabelText('Primary Goal')).toBeTruthy();
  });

  it('blocks submission until all required fields are valid', async () => {
    render(<OnboardingProfilePage />);
    fireEvent.click(screen.getByRole('button', { name: /Save profile/i }));

    await waitFor(() => {
      expect(screen.getByText(/Enter your name/i)).toBeTruthy();
      expect(screen.getByText(/Enter your age/i)).toBeTruthy();
      expect(screen.getByText(/Select your gender/i)).toBeTruthy();
      expect(screen.getByText(/Select your primary purpose/i)).toBeTruthy();
      expect(screen.getByText(/Enter your primary goal/i)).toBeTruthy();
    });
    expect(mocks.completeProfile).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range age', async () => {
    render(<OnboardingProfilePage />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Local Test Founder' } });
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: /Save profile/i }));

    await waitFor(() => {
      expect(screen.getByText(/Age must be a whole number between 13 and 120/i)).toBeTruthy();
    });
    expect(mocks.completeProfile).not.toHaveBeenCalled();
  });

  it('saves a valid profile through the existing API and routes to ?next=', async () => {
    mocks.completeProfile.mockResolvedValue({ ok: true });
    setLocation('?next=/intelligence');
    render(<OnboardingProfilePage />);

    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /Save profile/i }));

    await waitFor(() => {
      expect(mocks.completeProfile).toHaveBeenCalledWith({
        displayName: 'Local Test Founder',
        age: 28,
        gender: 'female',
        purpose: 'career',
        primaryGoal: 'Become a senior engineer',
      });
    });
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/intelligence');
    });
  });

  it('routes to the existing default destination when there is no ?next=', async () => {
    mocks.completeProfile.mockResolvedValue({ ok: true });
    render(<OnboardingProfilePage />);

    fillValidForm('male');
    fireEvent.click(screen.getByRole('button', { name: /Save profile/i }));

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/');
    });
  });

  it('resolves ?next= AT SUBMIT TIME — a late-settling query must not be lost (client-side landing)', async () => {
    // Regression (SPRINT-041B deep verification): the onboarding gate lands
    // here via client-side navigation; the query can be unsettled during first
    // render. A mount-time capture (useMemo with [] deps) read '/' and
    // redirected the founder away from their intended destination after save.
    // The page must read ?next= in the submit handler, not at mount.
    mocks.completeProfile.mockResolvedValue({ ok: true });
    setLocation(''); // no query at mount (route still settling)
    render(<OnboardingProfilePage />);

    fillValidForm();
    // Query settles AFTER mount — before the user submits.
    setLocation('?next=/intelligence');
    fireEvent.click(screen.getByRole('button', { name: /Save profile/i }));

    await waitFor(() => {
      expect(mocks.completeProfile).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/intelligence');
    });
  });

  it('surfaces backend validation errors verbatim and does not redirect', async () => {
    mocks.completeProfile.mockResolvedValue({ ok: false, error: 'Invalid input' });
    render(<OnboardingProfilePage />);

    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /Save profile/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid input')).toBeTruthy();
    });
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});

describe('OnboardingProfilePage — completed user', () => {
  it('redirects a completed user away (never shows onboarding again)', async () => {
    mockCompletedUser();
    setLocation('?next=/intelligence');
    render(<OnboardingProfilePage />);
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/intelligence');
    });
  });
});
