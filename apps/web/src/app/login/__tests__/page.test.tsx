// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Login Page Regression Tests (SPRINT-040 LOGIN BUG)
//
// Regression coverage for the two browser defects discovered during the
// SPRINT-040 login verification:
//
//   1. PRE-HYDRATION NATIVE SUBMIT LEAK — the email/password form previously
//      had no action/method, so before React attached its onSubmit handler a
//      native form submission navigated the browser to
//      `/login?email=...&password=...`, placing credentials in the URL /
//      history / server logs. The form must declare `action="/login"` and
//      `method="post"` so credentials always travel in the request body, never
//      the query string.
//   2. REDIRECT CONTRACT — a successful email/password sign-in must call
//      router.replace(next) so the browser leaves /login for the intended
//      screen; a failed sign-in must stay put and surface an error.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  signInWithEmailAndPassword: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock('../../../auth/session-manager.js', () => ({
  signInWithEmailAndPassword: mocks.signInWithEmailAndPassword,
  beginGoogleSignIn: vi.fn(),
}));

// The auth store must hydrate so the "already authenticated → redirect" effect
// does not fire during these tests (fresh state: no user, sessionReady false).
vi.mock('../../../stores/auth-store.js', () => ({
  useAuthHydrated: () => false,
  useAuthStore: () => ({ user: null, sessionReady: false, offline: false }),
}));

import LoginPage from '../page.js';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: /login with no `next` parameter.
  Object.defineProperty(window, 'location', {
    value: { search: '', pathname: '/login' },
    writable: true,
  });
});

describe('LoginPage — credential form hardening (SPRINT-040)', () => {
  it('declares POST action=/login so pre-hydration submits never leak credentials into the URL', () => {
    render(<LoginPage />);
    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    expect(form?.getAttribute('action')).toBe('/login');
    expect(form?.getAttribute('method')).toBe('post');
  });

  it('calls router.replace(next) with / when no next param is present', async () => {
    mocks.signInWithEmailAndPassword.mockResolvedValueOnce({ ok: true });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'founder@vedmoulya.local' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Sprint040Test1' } });
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(mocks.signInWithEmailAndPassword).toHaveBeenCalledWith(
        'founder@vedmoulya.local',
        'Sprint040Test1',
      );
    });
    expect(mocks.replace).toHaveBeenCalledWith('/');
  });

  it('stays on /login and shows an error when sign-in fails', async () => {
    mocks.signInWithEmailAndPassword.mockResolvedValueOnce({
      ok: false,
      error: 'Invalid email or password',
    });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'founder@vedmoulya.local' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'WrongPassword123!' } });
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Invalid email or password');
    });
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});

describe('LoginPage — ?next= resolved at point of use (SPRINT-043E D1)', () => {
  it('uses the ?next= query when it settles AFTER mount (protected-route soft nav)', async () => {
    // Regression for the SPRINT-043E D1 defect: the protected-route redirect
    // (SignInRedirect → router.replace('/login?next=...')) can land the login
    // page with the query settling after first render. A mount-time capture
    // keeps next='/' and the user is sent to the dashboard instead of the
    // intended destination after signing in. The destination must be resolved
    // at the point of use.
    mocks.signInWithEmailAndPassword.mockResolvedValueOnce({ ok: true });
    render(<LoginPage />);
    // Simulate the client-side redirect arriving after mount.
    Object.defineProperty(window, 'location', {
      value: { search: '?next=%2Fintelligence', pathname: '/login' },
      writable: true,
    });

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'founder@vedmoulya.local' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Sprint040Test1' },
    });
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(mocks.signInWithEmailAndPassword).toHaveBeenCalled();
    });
    expect(mocks.replace).toHaveBeenCalledWith('/intelligence');
  });
});

describe('LoginPage — first-login account creation (SPRINT-041A)', () => {
  it('shows the New to VedMoulya / Create an account option', () => {
    render(<LoginPage />);
    expect(screen.getByText('New to VedMoulya?')).not.toBeNull();
    const link = screen.getByRole('link', { name: 'Create an account' });
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('/signup');
  });

  it('points to /signup without a next param', () => {
    render(<LoginPage />);
    expect(screen.getByRole('link', { name: 'Create an account' }).getAttribute('href')).toBe(
      '/signup',
    );
  });

  it('preserves the ?next= parameter when present', () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?next=%2Fintelligence', pathname: '/login' },
      writable: true,
    });
    render(<LoginPage />);
    expect(screen.getByRole('link', { name: 'Create an account' }).getAttribute('href')).toBe(
      '/signup?next=%2Fintelligence',
    );
  });
});
