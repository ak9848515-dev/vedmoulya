// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Sign Up Page Tests (SPRINT-041A)
//
// Covers the first-login account-creation contract:
//   - the form collects exactly the Identity API fields (displayName, email,
//     password, confirm, optional given/family name)
//   - client-side validation mirrors the backend zod schema (email format,
//     display name 2–100, password ≥8 with upper/lower/digit, confirm match)
//   - successful sign-up calls the EXISTING sign-up API via session-manager,
//     applies the returned session, and redirects to the preserved ?next=
//   - backend errors (duplicate email 409, validation) are displayed verbatim
//   - the form is hardened against pre-hydration native submit leaks (POST)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  signUpWithEmailAndPassword: vi.fn(),
  beginGoogleSignIn: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock('../../../auth/session-manager.js', () => ({
  signUpWithEmailAndPassword: mocks.signUpWithEmailAndPassword,
  beginGoogleSignIn: mocks.beginGoogleSignIn,
}));

// Fresh auth state: no user, session not ready — the already-authenticated
// redirect effect must not fire during these tests.
vi.mock('../../../stores/auth-store.js', () => ({
  useAuthHydrated: () => false,
  useAuthStore: () => ({ user: null, sessionReady: false, offline: false }),
}));

import SignUpPage from '../page.js';

function fillValidForm(): void {
  fireEvent.change(screen.getByLabelText('Display Name'), {
    target: { value: 'Local Test Founder' },
  });
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'local-test-founder@vedmoulya.local' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'Sprint041Test1' },
  });
  fireEvent.change(screen.getByLabelText('Confirm Password'), {
    target: { value: 'Sprint041Test1' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'location', {
    value: { search: '', pathname: '/signup' },
    writable: true,
  });
});

describe('SignUpPage — form hardening (SPRINT-041A)', () => {
  it('declares POST action=/signup so pre-hydration submits never leak credentials into the URL', () => {
    render(<SignUpPage />);
    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    expect(form?.getAttribute('action')).toBe('/signup');
    expect(form?.getAttribute('method')).toBe('post');
  });

  it('collects the fields required by the existing sign-up API', () => {
    render(<SignUpPage />);
    expect(screen.getByLabelText('Display Name')).not.toBeNull();
    expect(screen.getByLabelText('Email')).not.toBeNull();
    expect(screen.getByLabelText('Password')).not.toBeNull();
    expect(screen.getByLabelText('Confirm Password')).not.toBeNull();
    // Optional name parts supported by the API.
    expect(screen.getByLabelText('Given Name (optional)')).not.toBeNull();
    expect(screen.getByLabelText('Family Name (optional)')).not.toBeNull();
  });
});

describe('SignUpPage — validation (SPRINT-041A)', () => {
  it('rejects empty required fields without calling the API', async () => {
    render(<SignUpPage />);
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText('Enter your display name.')).not.toBeNull();
    });
    expect(screen.getByText('Enter your email address.')).not.toBeNull();
    expect(screen.getByText('Create a password.')).not.toBeNull();
    expect(screen.getByText('Confirm your password.')).not.toBeNull();
    expect(mocks.signUpWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('rejects an invalid email', async () => {
    render(<SignUpPage />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText('Enter a valid email address.')).not.toBeNull();
    });
    expect(mocks.signUpWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('rejects a password missing the required character classes', async () => {
    render(<SignUpPage />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'alllowercase' },
    });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'alllowercase' },
    });
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Password must contain an uppercase letter, a lowercase letter, and a number.',
        ),
      ).not.toBeNull();
    });
    expect(mocks.signUpWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('rejects a password that is too short', async () => {
    render(<SignUpPage />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Ab1' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Ab1' } });
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters.')).not.toBeNull();
    });
    expect(mocks.signUpWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('rejects a confirm-password mismatch', async () => {
    render(<SignUpPage />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'Sprint041Test2' },
    });
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match.')).not.toBeNull();
    });
    expect(mocks.signUpWithEmailAndPassword).not.toHaveBeenCalled();
  });
});

describe('SignUpPage — ?next= resolved at point of use (SPRINT-043E D1)', () => {
  it('uses the ?next= query when it settles AFTER mount (protected-route soft nav)', async () => {
    // Same regression as the /login page: a mount-time ?next= capture keeps a
    // stale '/' when the query settles after first render. The destination
    // must be resolved at the point of use (submit / Google-completion handler).
    Object.defineProperty(window, 'location', {
      value: { search: '', pathname: '/signup' },
      writable: true,
    });
    mocks.signUpWithEmailAndPassword.mockResolvedValueOnce({ ok: true });
    mocks.beginGoogleSignIn.mockResolvedValueOnce({ ok: true });
    render(<SignUpPage />);
    // The ?next= query arrives after the page mounted (client-side redirect).
    Object.defineProperty(window, 'location', {
      value: { search: '?next=%2Fintelligence', pathname: '/signup' },
      writable: true,
    });
    fillValidForm();
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    // After successful sign-up, the Google completion card appears.
    await waitFor(() => {
      expect(screen.getByText('Complete with Google')).not.toBeNull();
    });
    // Click "Continue with Google" — the ?next= should be resolved at this point.
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    await waitFor(() => {
      expect(mocks.beginGoogleSignIn).toHaveBeenCalledWith('/intelligence');
    });
  });
});

describe('SignUpPage — registration flow (SPRINT-041A)', () => {
  it('calls the existing sign-up API with the collected fields and shows Google completion', async () => {
    mocks.signUpWithEmailAndPassword.mockResolvedValueOnce({ ok: true });
    mocks.beginGoogleSignIn.mockResolvedValueOnce({ ok: true });
    render(<SignUpPage />);
    fillValidForm();
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(mocks.signUpWithEmailAndPassword).toHaveBeenCalledWith({
        displayName: 'Local Test Founder',
        email: 'local-test-founder@vedmoulya.local',
        password: 'Sprint041Test1',
        givenName: undefined,
        familyName: undefined,
      });
    });
    // Mandatory Google completion: the Google completion card appears after
    // successful sign-up instead of navigating away.
    expect(screen.getByText('Complete with Google')).not.toBeNull();
    // Clicking "Continue with Google" without ?next= defaults to /.
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    await waitFor(() => {
      expect(mocks.beginGoogleSignIn).toHaveBeenCalledWith('/');
    });
  });

  it('preserves the ?next= parameter through Google completion', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?next=%2Fintelligence', pathname: '/signup' },
      writable: true,
    });
    mocks.signUpWithEmailAndPassword.mockResolvedValueOnce({ ok: true });
    mocks.beginGoogleSignIn.mockResolvedValueOnce({ ok: true });
    render(<SignUpPage />);
    fillValidForm();
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText('Complete with Google')).not.toBeNull();
    });
    // "Continue with Google" passes the ?next= parameter through.
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    await waitFor(() => {
      expect(mocks.beginGoogleSignIn).toHaveBeenCalledWith('/intelligence');
    });
  });

  it('passes optional given/family names when provided', async () => {
    mocks.signUpWithEmailAndPassword.mockResolvedValueOnce({ ok: true });
    render(<SignUpPage />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText('Given Name (optional)'), {
      target: { value: 'Local' },
    });
    fireEvent.change(screen.getByLabelText('Family Name (optional)'), {
      target: { value: 'Founder' },
    });
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(mocks.signUpWithEmailAndPassword).toHaveBeenCalledWith({
        displayName: 'Local Test Founder',
        email: 'local-test-founder@vedmoulya.local',
        password: 'Sprint041Test1',
        givenName: 'Local',
        familyName: 'Founder',
      });
    });
  });

  it('displays the backend duplicate-email error verbatim and stays put', async () => {
    mocks.signUpWithEmailAndPassword.mockResolvedValueOnce({
      ok: false,
      error: 'Email already registered',
    });
    render(<SignUpPage />);
    fillValidForm();
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Email already registered');
    });
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('displays backend validation errors verbatim', async () => {
    mocks.signUpWithEmailAndPassword.mockResolvedValueOnce({
      ok: false,
      error: 'Password must contain at least one uppercase letter',
    });
    render(<SignUpPage />);
    fillValidForm();
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'Password must contain at least one uppercase letter',
      );
    });
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('shows the offline message when the network is unreachable', async () => {
    mocks.signUpWithEmailAndPassword.mockResolvedValueOnce({ ok: false, error: 'offline' });
    render(<SignUpPage />);
    fillValidForm();
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(
        screen.getByText('You appear to be offline. Check your connection and try again.'),
      ).not.toBeNull();
    });
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('links back to /login preserving the next param', () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?next=%2Fintelligence', pathname: '/signup' },
      writable: true,
    });
    render(<SignUpPage />);
    const back = screen.getByRole('link', { name: 'Back to Sign In' });
    expect(back.getAttribute('href')).toBe('/login?next=%2Fintelligence');
  });
});

describe('SignUpPage — Google completion (PART 3 PATH A)', () => {
  it('shows the Google completion card after successful sign-up with correct content', async () => {
    mocks.signUpWithEmailAndPassword.mockResolvedValueOnce({ ok: true });
    render(<SignUpPage />);
    fillValidForm();
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await waitFor(() => {
      expect(screen.getByText('Complete with Google')).not.toBeNull();
    });
    expect(screen.getByText(/Google authentication is required to finish/)).not.toBeNull();
    expect(screen.getByText(/Continue with Google/)).not.toBeNull();
    // The sign-up form is no longer visible.
    expect(screen.queryByLabelText('Display Name')).toBeNull();
  });

  it('Continue with Google triggers beginGoogleSignIn with the resolved next value', async () => {
    mocks.signUpWithEmailAndPassword.mockResolvedValueOnce({ ok: true });
    mocks.beginGoogleSignIn.mockResolvedValueOnce({ ok: true });
    render(<SignUpPage />);
    fillValidForm();
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await waitFor(() => {
      expect(screen.getByText('Complete with Google')).not.toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    await waitFor(() => {
      expect(mocks.beginGoogleSignIn).toHaveBeenCalledWith('/');
    });
  });

  it('displays Google sign-in errors and allows retry', async () => {
    mocks.signUpWithEmailAndPassword.mockResolvedValueOnce({ ok: true });
    mocks.beginGoogleSignIn.mockResolvedValueOnce({
      ok: false,
      error: 'Could not start Google sign-in. Please try again.',
    });
    render(<SignUpPage />);
    fillValidForm();
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await waitFor(() => {
      expect(screen.getByText('Complete with Google')).not.toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Could not start Google sign-in.');
    });
    // The button is still available for retry.
    expect(screen.getByRole('button', { name: /continue with google/i })).not.toBeNull();
  });

  it('shows offline message when Google sign-in fails due to network', async () => {
    mocks.signUpWithEmailAndPassword.mockResolvedValueOnce({ ok: true });
    mocks.beginGoogleSignIn.mockResolvedValueOnce({ ok: false, error: 'offline' });
    render(<SignUpPage />);
    fillValidForm();
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await waitFor(() => {
      expect(screen.getByText('Complete with Google')).not.toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    await waitFor(() => {
      expect(
        screen.getByText('You appear to be offline. Check your connection and try again.'),
      ).not.toBeNull();
    });
  });

  it('sanitizes ?next= to prevent open redirects (only allows paths starting with /)', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?next=https://evil.com', pathname: '/signup' },
      writable: true,
    });
    mocks.signUpWithEmailAndPassword.mockResolvedValueOnce({ ok: true });
    mocks.beginGoogleSignIn.mockResolvedValueOnce({ ok: true });
    render(<SignUpPage />);
    fillValidForm();
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await waitFor(() => {
      expect(screen.getByText('Complete with Google')).not.toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    await waitFor(() => {
      // External URL is rejected; next defaults to /.
      expect(mocks.beginGoogleSignIn).toHaveBeenCalledWith('/');
    });
  });

  it('the redirect is not blocked by the Google-completion loading state', async () => {
    mocks.signUpWithEmailAndPassword.mockResolvedValueOnce({ ok: true });
    mocks.beginGoogleSignIn.mockResolvedValueOnce({ ok: true });
    render(<SignUpPage />);
    fillValidForm();
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await waitFor(() => {
      expect(screen.getByText('Complete with Google')).not.toBeNull();
    });
    // The Continue with Google button is present and interactive.
    const googleBtn = screen.getByRole('button', {
      name: /continue with google/i,
    });
    expect(googleBtn).not.toBeNull();
    fireEvent.click(googleBtn);
    await waitFor(() => {
      expect(mocks.beginGoogleSignIn).toHaveBeenCalledTimes(1);
    });
  });

  it('blocks duplicate Google submissions while one is in flight', async () => {
    mocks.signUpWithEmailAndPassword.mockResolvedValueOnce({ ok: true });
    // Never resolves — simulates a slow/stuck OAuth redirect.
    mocks.beginGoogleSignIn.mockReturnValueOnce(new Promise(() => {}));
    render(<SignUpPage />);
    fillValidForm();
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await waitFor(() => {
      expect(screen.getByText('Complete with Google')).not.toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    // Button shows loading state.
    await waitFor(() => {
      expect(screen.getByText('Connecting…')).not.toBeNull();
    });
    // Second click is ignored (googleSubmitting guard).
    fireEvent.click(screen.getByRole('button', { name: /connecting/i }));
    expect(mocks.beginGoogleSignIn).toHaveBeenCalledTimes(1);
  });
});
