// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Profile field contract (UX-07 · SPRINT-041B)
//
// ONE place for the identity profile's closed vocabularies and client-side
// validation. The first-login screen (/onboarding/profile) and
// Settings → Profile are two views of the SAME `PATCH /me/profile` contract —
// never two profiles with two sets of options.
//
// Client-side validation only mirrors the server zod contract for UX; the
// Identity Service remains authoritative and its errors are shown verbatim.
// ─────────────────────────────────────────────────────────────────────────────

export const GENDER_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const PURPOSE_OPTIONS = [
  { value: 'learning', label: 'Learning & skill building' },
  { value: 'building', label: 'Building products / apps' },
  { value: 'career', label: 'Career growth' },
  { value: 'business', label: 'Business / freelancing' },
  { value: 'personal', label: 'Personal organisation' },
  { value: 'other', label: 'Something else' },
];

export const AGE_MIN = 13;
export const AGE_MAX = 120;

export const DISPLAY_NAME_MAX = 100;
export const PRIMARY_GOAL_MAX = 200;

export interface ProfileFieldErrors {
  displayName?: string;
  age?: string;
  gender?: string;
  purpose?: string;
  primaryGoal?: string;
}

/** The profile values as edited in a form (numbers stay strings while typing). */
export interface ProfileFormValues {
  displayName: string;
  age: string;
  gender: string;
  purpose: string;
  primaryGoal: string;
}

/** Human label for a stored vocabulary value (never a fabricated default). */
export function labelForOption(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string | undefined,
): string {
  if (!value) return '—';
  return options.find((option) => option.value === value)?.label ?? value;
}

/**
 * Mirrors the server contract for UX only. Returns an empty object when the
 * form is valid.
 */
export function validateProfile(values: ProfileFormValues): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};
  const displayName = values.displayName.trim();

  if (!displayName) {
    errors.displayName = 'Enter your name.';
  } else if (displayName.length < 2) {
    errors.displayName = 'Name must be at least 2 characters.';
  } else if (displayName.length > DISPLAY_NAME_MAX) {
    errors.displayName = `Name must be ${DISPLAY_NAME_MAX} characters or fewer.`;
  }

  if (!values.age.trim()) {
    errors.age = 'Enter your age.';
  } else {
    const age = Number(values.age);
    if (!Number.isInteger(age) || age < AGE_MIN || age > AGE_MAX) {
      errors.age = `Age must be a whole number between ${AGE_MIN} and ${AGE_MAX}.`;
    }
  }

  if (!values.gender) {
    errors.gender = 'Select your gender.';
  }

  if (!values.purpose) {
    errors.purpose = 'Select your primary purpose.';
  }

  if (!values.primaryGoal.trim()) {
    errors.primaryGoal = 'Enter your primary goal.';
  } else if (values.primaryGoal.trim().length > PRIMARY_GOAL_MAX) {
    errors.primaryGoal = `Primary goal must be ${PRIMARY_GOAL_MAX} characters or fewer.`;
  }

  return errors;
}
