// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — First-Login Profile Setup
// SPRINT-041B — First-Login Profile Setup Verification
// The mandatory first-login profile screen for NEW/incomplete users. Collects
// exactly the SPRINT-041B profile contract — Name, Age, Gender, Purpose,
// Primary Goal — and saves through the EXISTING Identity Service
// (PATCH /api/v1/identity/auth/me/profile — JWT-authenticated, userId derived
// from the token, no IDOR surface). On success the server-derived completion
// state is applied to the auth store and the user is routed to the intended
// destination (`?next=` preserved; default `/`).
//
// The backend remains authoritative: client-side validation only mirrors the
// server zod contract (updateProfileSchema) for UX; backend errors display
// verbatim. No duplicate authentication/session/persistence — everything
// composes session-manager → auth-store → the existing Identity Service.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Select, TextField } from '@vedmoulya/ui';
import { Loader2, Sparkles, User, Calendar, Target, Compass } from 'lucide-react';
import { completeProfile } from '../../../auth/session-manager.js';
import { useAuthHydrated, useAuthStore } from '../../../stores/auth-store.js';
import { SignInRedirect } from '../../../components/SignInRedirect.js';
// The closed vocabularies and client-side validation live in ONE shared module
// (lib/profile-fields.ts) because Settings → Profile edits the SAME
// `PATCH /me/profile` contract. Two screens, one profile — never two copies of
// the options that could drift apart.
import {
  AGE_MAX,
  AGE_MIN,
  GENDER_OPTIONS,
  PURPOSE_OPTIONS,
  validateProfile,
  type ProfileFieldErrors,
} from '../../../lib/profile-fields.js';

// ── Onboarding Profile Page ──────────────────────────────────────────────────

export default function OnboardingProfilePage(): React.JSX.Element {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();

  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [purpose, setPurpose] = useState('');
  const [primaryGoal, setPrimaryGoal] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [namePrefilled, setNamePrefilled] = useState(false);

  // Resolved AT THE POINT OF USE, never cached — the client-side navigation
  // from the onboarding gate can land here with the query not yet settled
  // during first render, so a mount-time useMemo ([] deps) would capture a
  // stale '/' and redirect the user away from their intended destination.
  // Reading it in the submit handler and in the complete-user effect (both run
  // after the route is fully in place) keeps ?next= correct.
  const resolveNext = (): string => {
    if (typeof window === 'undefined') return '/';
    const param = new URLSearchParams(window.location.search).get('next');
    return param && param.startsWith('/') ? param : '/';
  };

  // Prefill the name from the authenticated session once it is available.
  useEffect(() => {
    if (!namePrefilled && user?.displayName && !displayName) {
      setDisplayName(user.displayName);
      setNamePrefilled(true);
    }
  }, [user, displayName, namePrefilled]);

  // Already complete → the onboarding screen is not for this user; route them
  // to their intended destination (same convention as /login for authenticated
  // visitors). ?next= is resolved here (post-mount) so a client-side landing
  // with a late-settling query still routes correctly.
  useEffect(() => {
    if (hydrated && sessionReady && user && user.profileComplete) {
      router.replace(resolveNext());
    }
  }, [hydrated, sessionReady, user, router]);

  // Unauthenticated → login (same rule as every protected screen).
  if (hydrated && sessionReady && !user) {
    return <SignInRedirect />;
  }

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (submitting) return;

    const errors = validateProfile({ displayName, age, gender, purpose, primaryGoal });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setFormError(null);
    setSubmitting(true);
    const outcome = await completeProfile({
      displayName: displayName.trim(),
      age: Number(age),
      gender,
      purpose,
      primaryGoal: primaryGoal.trim(),
    });
    if (!outcome.ok) {
      setSubmitting(false);
      setFormError(
        outcome.error === 'offline'
          ? 'You appear to be offline. Check your connection and try again.'
          : outcome.error,
      );
      return;
    }
    router.replace(resolveNext());
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#1E4AA8] via-[#2B5FD9] to-[#5B8AEB] px-4 py-10">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, white 0%, transparent 45%), radial-gradient(circle at 80% 75%, white 0%, transparent 40%)',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 mb-8 text-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-[20px] bg-white/15 backdrop-blur-md border border-white/25 shadow-xl">
            <Sparkles className="h-7 w-7 text-[#F59E0B]" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-[28px] font-heading font-bold text-white tracking-tight">
              Complete your profile
            </h1>
            <p className="text-[15px] text-[#D4E1FC] mt-1">
              A few details help VedMoulya work for you — you can change them anytime.
            </p>
          </div>
        </div>

        <Card variant="standard" padding="lg" className="shadow-2xl">
          {/* action/method make any PRE-HYDRATION or no-JS native submission a
              POST — nothing sensitive goes into the URL/query string. */}
          <form
            action="/onboarding/profile"
            method="post"
            onSubmit={(e) => void handleSubmit(e)}
            noValidate
            className="space-y-4"
          >
            <TextField
              label="Name"
              type="text"
              name="displayName"
              autoComplete="name"
              placeholder="How should we address you?"
              size="lg"
              leftIcon={<User className="h-4 w-4" aria-hidden="true" />}
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
              }}
              error={fieldErrors.displayName}
              disabled={submitting}
            />
            <TextField
              label="Age"
              type="number"
              name="age"
              inputMode="numeric"
              min={AGE_MIN}
              max={AGE_MAX}
              placeholder={`${AGE_MIN}–${AGE_MAX}`}
              size="lg"
              leftIcon={<Calendar className="h-4 w-4" aria-hidden="true" />}
              value={age}
              onChange={(e) => {
                setAge(e.target.value);
              }}
              error={fieldErrors.age}
              disabled={submitting}
            />
            <Select
              label="Gender"
              name="gender"
              placeholder="Select…"
              options={GENDER_OPTIONS}
              value={gender}
              onChange={(e) => {
                setGender(e.target.value);
              }}
              error={fieldErrors.gender}
              disabled={submitting}
              aria-label="Gender"
            />
            <Select
              label="Purpose"
              name="purpose"
              placeholder="Select…"
              options={PURPOSE_OPTIONS}
              value={purpose}
              onChange={(e) => {
                setPurpose(e.target.value);
              }}
              error={fieldErrors.purpose}
              disabled={submitting}
              aria-label="Purpose"
            />
            <TextField
              label="Primary Goal"
              type="text"
              name="primaryGoal"
              autoComplete="off"
              placeholder="What is the main thing you want to achieve?"
              size="lg"
              leftIcon={<Target className="h-4 w-4" aria-hidden="true" />}
              value={primaryGoal}
              onChange={(e) => {
                setPrimaryGoal(e.target.value);
              }}
              error={fieldErrors.primaryGoal}
              disabled={submitting}
            />

            {formError && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700"
              >
                {formError}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full flex items-center justify-center gap-2"
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Compass className="h-4 w-4" aria-hidden="true" />
              )}
              {submitting ? 'Saving…' : 'Save profile'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
