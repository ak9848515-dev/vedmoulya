// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Settings section registry (UX-07)
//
// ONE source of truth for the settings experience: the sections, their order,
// and how a section maps to a URL. Lives outside `page.tsx` because a Next.js
// route module may only export its route contract.
//
// IA rules pinned here:
//   • Profile keeps `/settings?tab=profile` — it is its own navigation
//     destination (see navigation-model.ts), NOT a second route.
//   • Every other section is reached with `?tab=<id>` on the SAME `/settings`
//     path, so the shell keeps highlighting Settings.
//   • `/settings` with no (or an unknown) tab is Account — the base settings
//     destination must not silently render the Profile destination's content.
// ─────────────────────────────────────────────────────────────────────────────

export type SettingsSectionId =
  | 'account'
  | 'profile'
  | 'appearance'
  | 'notifications'
  | 'ai'
  | 'data'
  | 'memory'
  | 'knowledge'
  | 'services'
  | 'security'
  | 'privacy'
  | 'advanced';

export interface SettingsSection {
  id: SettingsSectionId;
  label: string;
  description: string;
}

/**
 * The settings IA, in the order a person expects to read it: identity first,
 * then how the product looks and behaves, then what it knows, then trust, then
 * engineering detail.
 */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    id: 'account',
    label: 'Account',
    description: 'The identity you are signed in as, and signing out.',
  },
  {
    id: 'profile',
    label: 'Profile',
    description: 'Your name, age, purpose and primary goal.',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Theme and haptic feedback on this device.',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Which updates you want to be sent.',
  },
  {
    id: 'ai',
    label: 'AI',
    description: 'Cost policy and budget limits for AI usage.',
  },
  {
    id: 'data',
    label: 'Data',
    description: 'Export, retention and deletion of your data.',
  },
  {
    id: 'memory',
    label: 'Memory',
    description: 'What VedMoulya remembers about your journey.',
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    description: 'What you have taught VedMoulya.',
  },
  {
    id: 'services',
    label: 'Connected Services',
    description: 'Which providers and integrations are reachable.',
  },
  {
    id: 'security',
    label: 'Security',
    description: 'How your session is protected.',
  },
  {
    id: 'privacy',
    label: 'Privacy',
    description: 'Visibility and data-sharing preferences.',
  },
  {
    id: 'advanced',
    label: 'Advanced',
    description: 'Read-only diagnostics and engineering surfaces.',
  },
];

/** `/settings` on its own is Account, not Profile. */
export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = 'account';

/** The Profile destination keeps its own query fragment. */
export const PROFILE_TAB_QUERY = 'tab=profile';

export function isSettingsSectionId(value: string | null | undefined): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some((section) => section.id === value);
}

/** Resolve the active section from a raw query string (`?tab=…` or ''). */
export function sectionFromSearch(search: string): SettingsSectionId {
  if (!search) return DEFAULT_SETTINGS_SECTION;
  const requested = new URLSearchParams(search).get('tab');
  return isSettingsSectionId(requested) ? requested : DEFAULT_SETTINGS_SECTION;
}

/** The canonical URL for a section. Account is the bare `/settings` route. */
export function urlForSection(id: SettingsSectionId): string {
  return id === DEFAULT_SETTINGS_SECTION ? '/settings' : `/settings?tab=${id}`;
}

/** True when the section is the Profile navigation destination. */
export function isProfileSection(id: SettingsSectionId): boolean {
  return id === 'profile';
}
