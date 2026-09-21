// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Settings → Profile (UX-07)
//
// The Profile destination (`/settings?tab=profile`) shows and edits the REAL
// identity profile: it loads the authenticated user's own record
// (GET /me — userId derived from the verified token, no IDOR surface), renders
// exactly what the server returned, and saves through the SAME
// `PATCH /me/profile` path the first-login screen uses.
//
// There are NO hard-coded profile values. Before UX-07 this tab shipped
// "User" / "user@vedmoulya.com" / "Product Engineer" / "America/New_York" with a
// Save button that did nothing — the most dishonesty-prone surface in the app.
// Loading, error, empty and save states are all explicit.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Loading, Select, TextField } from '@vedmoulya/ui';
import { AlertTriangle, Calendar, Loader2, RefreshCw, Save, Target, User } from 'lucide-react';
import { getProfile, type ProfileView } from '../../../auth/auth-api.js';
import { completeProfile } from '../../../auth/session-manager.js';
import { useAuthStore } from '../../../stores/auth-store.js';
import {
  AGE_MAX,
  AGE_MIN,
  DISPLAY_NAME_MAX,
  GENDER_OPTIONS,
  PRIMARY_GOAL_MAX,
  PURPOSE_OPTIONS,
  validateProfile,
  type ProfileFieldErrors,
  type ProfileFormValues,
} from '../../../lib/profile-fields.js';

const EMPTY_FORM: ProfileFormValues = {
  displayName: '',
  age: '',
  gender: '',
  purpose: '',
  primaryGoal: '',
};

function toForm(profile: ProfileView): ProfileFormValues {
  return {
    displayName: profile.displayName,
    age: profile.age === undefined ? '' : String(profile.age),
    gender: profile.gender ?? '',
    purpose: profile.purpose ?? '',
    primaryGoal: profile.primaryGoal ?? '',
  };
}

export function ProfileSection(): React.JSX.Element {
  const { user, accessToken } = useAuthStore();

  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [form, setForm] = useState<ProfileFormValues>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Load the server-authoritative profile ──────────────────────────────
  const load = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const next = await getProfile(accessToken);
      setProfile(next);
      setForm(toForm(next));
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Could not load your profile. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = (patch: Partial<ProfileFormValues>): void => {
    setForm((prev) => ({ ...prev, ...patch }));
    setSaved(false);
    setFormError(null);
  };

  const handleSave = async (event: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (saving) return;

    const errors = validateProfile(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    setFormError(null);
    const outcome = await completeProfile({
      displayName: form.displayName.trim(),
      age: Number(form.age),
      gender: form.gender,
      purpose: form.purpose,
      primaryGoal: form.primaryGoal.trim(),
    });

    if (!outcome.ok) {
      setSaving(false);
      setFormError(
        outcome.error === 'offline'
          ? 'You appear to be offline. Check your connection and try again.'
          : outcome.error,
      );
      return;
    }

    // Re-read the server's own copy so the screen shows persisted values, not
    // the optimistic form state.
    await load();
    setSaving(false);
    setSaved(true);
  };

  if (!user) {
    return (
      <Card variant="standard" padding="lg">
        <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
          Sign in to see and edit your profile.
        </p>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card variant="standard" padding="lg">
        <div className="flex items-center justify-center py-8" data-testid="profile-loading">
          <Loading label="Loading your profile…" size="md" />
        </div>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card variant="standard" padding="lg" data-testid="profile-error">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#EF4444]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
              Unable to load your profile
            </h3>
            <p className="mt-1 text-[13px] text-[#64748B] dark:text-[#94A3B8]">{loadError}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                void load();
              }}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" /> Try again
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const incomplete = profile?.profileComplete === false;

  return (
    <Card variant="standard" padding="lg" data-testid="settings-profile">
      <div className="mb-4">
        <h3 className="text-[18px] font-semibold text-[#111827] dark:text-[#F8FAFC]">Profile</h3>
        <p className="mt-1 text-[13px] text-[#64748B] dark:text-[#94A3B8]">
          Your identity, goals and purpose — the profile VedMoulya works from.
        </p>
      </div>

      {incomplete ? (
        <div
          className="mb-5 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 dark:border-[#78350F] dark:bg-[#451A03]"
          data-testid="profile-incomplete"
        >
          <p className="text-[13px] text-[#92400E] dark:text-[#FDE68A]">
            Your profile is not complete yet. Fill in the details below so VedMoulya can plan from
            real goals instead of assumptions.
          </p>
        </div>
      ) : null}

      <form
        onSubmit={(event) => {
          void handleSave(event);
        }}
        noValidate
        className="space-y-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TextField
            label="Name"
            type="text"
            name="displayName"
            autoComplete="name"
            placeholder="How should we address you?"
            size="md"
            leftIcon={<User className="h-4 w-4" aria-hidden="true" />}
            maxLength={DISPLAY_NAME_MAX}
            value={form.displayName}
            onChange={(event) => {
              update({ displayName: event.target.value });
            }}
            error={fieldErrors.displayName}
            disabled={saving}
          />
          <TextField
            label="Age"
            type="number"
            name="age"
            inputMode="numeric"
            min={AGE_MIN}
            max={AGE_MAX}
            placeholder={`${AGE_MIN}–${AGE_MAX}`}
            size="md"
            leftIcon={<Calendar className="h-4 w-4" aria-hidden="true" />}
            value={form.age}
            onChange={(event) => {
              update({ age: event.target.value });
            }}
            error={fieldErrors.age}
            disabled={saving}
          />
          <Select
            label="Gender"
            name="gender"
            placeholder="Select…"
            options={GENDER_OPTIONS}
            value={form.gender}
            onChange={(event) => {
              update({ gender: event.target.value });
            }}
            error={fieldErrors.gender}
            disabled={saving}
            aria-label="Gender"
          />
          <Select
            label="Purpose"
            name="purpose"
            placeholder="Select…"
            options={PURPOSE_OPTIONS}
            value={form.purpose}
            onChange={(event) => {
              update({ purpose: event.target.value });
            }}
            error={fieldErrors.purpose}
            disabled={saving}
            aria-label="Purpose"
          />
          <TextField
            label="Primary Goal"
            type="text"
            name="primaryGoal"
            autoComplete="off"
            placeholder="What is the main thing you want to achieve?"
            size="md"
            leftIcon={<Target className="h-4 w-4" aria-hidden="true" />}
            maxLength={PRIMARY_GOAL_MAX}
            value={form.primaryGoal}
            onChange={(event) => {
              update({ primaryGoal: event.target.value });
            }}
            error={fieldErrors.primaryGoal}
            disabled={saving}
          />
          {/* Email is owned by the Identity Service and cannot be edited here. */}
          <TextField
            label="Email"
            type="email"
            name="email"
            value={profile?.email ?? user.email}
            size="md"
            readOnly
            disabled
            hint="Your sign-in email is managed by your account."
          />
        </div>

        {formError ? (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            data-testid="profile-save-error"
          >
            {formError}
          </div>
        ) : null}

        <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#334155] flex items-center gap-3">
          <Button type="submit" variant="primary" size="md" disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" aria-hidden="true" />
            )}
            {saving ? 'Saving…' : 'Save profile'}
          </Button>
          {saved ? (
            <span
              className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400"
              data-testid="profile-saved"
            >
              Profile saved
            </span>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
