// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — UX-07 Settings Experience Tests
//
// Pins the Settings contract:
//   1. /settings renders (as the Settings destination)
//   2. /settings?tab=profile renders the Profile destination
//   3. Settings vs Profile active state stays distinct
//   4. every declared section is reachable, one at a time
//   5. Profile shows REAL profile data (no fabricated defaults)
//   6. Profile loading state
//   7. Profile empty (incomplete) state
//   8. Profile error state + retry
//   9. Profile save behaviour (and validation refusing a bad save)
//  10. preferences that ARE supported persist (haptics, notifications, theme)
//  11. provider configuration has ONE destination (AI → /providers)
//  12. mobile navigation: the tab strip is the only section control
//  13. deep-link behaviour (query in → section out; tab click → query updated)
//
// These tests use the real components, the real section registry and the real
// query hook. Only the network/session boundaries are mocked.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import type { ProfileView } from '../../../auth/auth-api.js';
import { ThemeProvider } from '@vedmoulya/ui';
import { SETTINGS_SECTIONS, sectionFromSearch, urlForSection } from '../settings-sections.js';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  user: {
    userId: 'u-1',
    email: 'anya@vedmoulya.com',
    role: 'founder',
    displayName: 'Anya',
    profileComplete: true,
  } as {
    userId: string;
    email: string;
    role: string;
    displayName?: string;
    profileComplete?: boolean;
  } | null,
  accessToken: 'token-1' as string | null,
  hydrated: true,
  sessionReady: true,
  expiresAt: Date.now() + 3_600_000,
  setActiveSection: vi.fn(),
  setBreadcrumbs: vi.fn(),
  getProfile: vi.fn(),
  completeProfile: vi.fn(),
  logout: vi.fn(),
  prefs: undefined as
    | {
        budgetPolicy: 'never_paid' | 'ask_before_paid' | 'allow_within_budget';
        budgets: { dailyUsd?: number; monthlyUsd?: number };
      }
    | undefined,
  prefsLoading: false,
  setPrefs: { mutateAsync: vi.fn(() => Promise.resolve()), isPending: false },
  runtimeData: undefined as
    | {
        mode: string;
        defaultProvider: string;
        defaultProviderSupported: boolean;
        providers: Array<{ family: string; name: string; status: string }>;
      }
    | undefined,
  runtimeLoading: false,
  runtimeError: false,
  setHapticsEnabled: vi.fn(),
  hapticTap: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../stores/auth-store.js', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      user: mocks.user,
      accessToken: mocks.accessToken,
      expiresAt: mocks.expiresAt,
      sessionReady: mocks.sessionReady,
      offline: false,
    };
    return selector ? selector(state) : state;
  },
  useAuthHydrated: () => mocks.hydrated,
}));

vi.mock('../../../stores/navigation-store.js', () => ({
  useNavigationStore: () => ({
    setActiveSection: mocks.setActiveSection,
    setBreadcrumbs: mocks.setBreadcrumbs,
  }),
}));

vi.mock('../../../auth/auth-api.js', () => ({
  getProfile: (...args: unknown[]) => mocks.getProfile(...args) as Promise<ProfileView>,
}));

vi.mock('../../../auth/session-manager.js', () => ({
  completeProfile: (...args: unknown[]) =>
    mocks.completeProfile(...args) as Promise<{ ok: true } | { ok: false; error: string }>,
  logout: () => mocks.logout() as Promise<void>,
}));

vi.mock('../../../lib/api-client.js', () => ({
  useProviderPreferences: () => ({ data: mocks.prefs, isLoading: mocks.prefsLoading }),
  useSetProviderPreferences: () => mocks.setPrefs,
  useProviderRuntimeStatus: () => ({
    data: mocks.runtimeData,
    isLoading: mocks.runtimeLoading,
    isError: mocks.runtimeError,
  }),
}));

vi.mock('../../../lib/haptics.js', () => ({
  setHapticsEnabled: (value: boolean) => {
    mocks.setHapticsEnabled(value);
  },
  hapticTap: () => mocks.hapticTap() as Promise<void>,
}));

const SettingsPage = (await import('../page.js')).default;

// ── Fixtures ─────────────────────────────────────────────────────────────────

function profile(overrides: Partial<ProfileView> = {}): ProfileView {
  return {
    userId: 'u-1',
    email: 'anya@vedmoulya.com',
    displayName: 'Anya',
    age: 31,
    gender: 'female',
    purpose: 'building',
    primaryGoal: 'Launch the MVP',
    profileComplete: true,
    ...overrides,
  };
}

function runtime(): NonNullable<typeof mocks.runtimeData> {
  return {
    mode: 'production',
    defaultProvider: 'gemini',
    defaultProviderSupported: true,
    providers: [
      { family: 'gemini', name: 'Google Gemini', status: 'CONFIGURED' },
      { family: 'openai', name: 'OpenAI', status: 'ERROR' },
      { family: 'ollama', name: 'Ollama', status: 'UNCONFIGURED' },
    ],
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function goto(path: string): void {
  window.history.replaceState(null, '', path);
}

function renderSettings(path = '/settings'): ReturnType<typeof render> {
  goto(path);
  return render(React.createElement(SettingsPage));
}

function renderSettingsWithTheme(path = '/settings'): ReturnType<typeof render> {
  goto(path);
  return render(React.createElement(ThemeProvider, null, React.createElement(SettingsPage)));
}

/**
 * Radix tabs activate on MOUSEDOWN (that is where onValueChange fires), so a
 * plain `click` would leave the section unchanged and the test would be
 * asserting nothing.
 */
function selectTab(label: string): void {
  fireEvent.mouseDown(screen.getByRole('tab', { name: label }));
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mocks.user = {
    userId: 'u-1',
    email: 'anya@vedmoulya.com',
    role: 'founder',
    displayName: 'Anya',
    profileComplete: true,
  };
  mocks.accessToken = 'token-1';
  mocks.hydrated = true;
  mocks.sessionReady = true;
  mocks.getProfile.mockResolvedValue(profile());
  mocks.completeProfile.mockResolvedValue({ ok: true });
  mocks.logout.mockResolvedValue(undefined);
  mocks.prefs = undefined;
  mocks.prefsLoading = false;
  mocks.setPrefs.mutateAsync.mockReset();
  mocks.setPrefs.mutateAsync.mockResolvedValue(undefined);
  mocks.setPrefs.isPending = false;
  mocks.runtimeData = runtime();
  mocks.runtimeLoading = false;
  mocks.runtimeError = false;
});

afterEach(() => {
  cleanup();
  goto('/settings');
});

// ── 1-3. Destination + active state ──────────────────────────────────────────

describe('UX-07 — Settings destination', () => {
  it('renders the Settings destination at /settings', async () => {
    renderSettings('/settings');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Settings');
    expect(screen.getByTestId('settings-page')).toBeDefined();
    await waitFor(() => {
      expect(mocks.setActiveSection).toHaveBeenCalledWith('settings');
    });
    expect(mocks.setBreadcrumbs).toHaveBeenCalledWith([{ label: 'Settings' }]);
  });

  it('renders the Profile destination at /settings?tab=profile', async () => {
    renderSettings('/settings?tab=profile');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Profile');
    await waitFor(() => {
      expect(screen.getByTestId('settings-profile')).toBeDefined();
    });
    await waitFor(() => {
      expect(mocks.setActiveSection).toHaveBeenLastCalledWith('profile');
    });
    expect(mocks.setBreadcrumbs).toHaveBeenCalledWith([{ label: 'Profile' }]);
  });

  // The query is read AFTER mount (see lib/use-client-search.ts: reading it
  // during render would desync hydration), so the base destination shows for one
  // tick and then corrects — the documented, pre-existing shell behaviour. What
  // must never happen is the WRONG destination being the settled one, so these
  // assertions pin the final state of each URL.
  it('keeps Settings and Profile active state distinct', async () => {
    renderSettings('/settings?tab=profile');
    await waitFor(() => {
      expect(mocks.setActiveSection).toHaveBeenLastCalledWith('profile');
    });
    cleanup();
    mocks.setActiveSection.mockClear();

    renderSettings('/settings');
    await waitFor(() => {
      expect(mocks.setActiveSection).toHaveBeenLastCalledWith('settings');
    });
    expect(mocks.setActiveSection).not.toHaveBeenCalledWith('profile');
  });

  it('does not add a second settings route', () => {
    // The Profile destination reuses the same pathname with a query fragment.
    for (const section of SETTINGS_SECTIONS) {
      const url = urlForSection(section.id);
      expect(url.startsWith('/settings')).toBe(true);
      expect(url.split('?')[0]).toBe('/settings');
    }
  });
});

// ── 4. Sections ──────────────────────────────────────────────────────────────

describe('UX-07 — settings sections', () => {
  it('exposes every declared section in one tab strip', () => {
    renderSettings('/settings');
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(SETTINGS_SECTIONS.length);
    for (const section of SETTINGS_SECTIONS) {
      expect(screen.getByRole('tab', { name: section.label })).toBeDefined();
    }
  });

  it('renders exactly one section at a time', () => {
    renderSettings('/settings');
    expect(screen.getByTestId('settings-account')).toBeDefined();
    expect(screen.queryByTestId('settings-profile')).toBeNull();
    expect(screen.queryByTestId('settings-advanced')).toBeNull();
  });

  it('renders the honest sections for capabilities that do not exist yet', () => {
    renderSettings('/settings?tab=data');
    expect(screen.getByTestId('settings-data')).toBeDefined();
    expect(screen.getByText(/Data controls are not available yet/)).toBeDefined();
    // No control is offered for a capability that does not exist.
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
  });

  it('links Memory and Knowledge to their owning screens instead of duplicating them', () => {
    renderSettings('/settings?tab=memory');
    expect(screen.getByTestId('settings-memory')).toBeDefined();
    expect(screen.getByRole('link', { name: /Open memory/ }).getAttribute('href')).toBe('/memory');
    cleanup();

    renderSettings('/settings?tab=knowledge');
    expect(screen.getByTestId('settings-knowledge')).toBeDefined();
    expect(screen.getByRole('link', { name: /Open knowledge/ }).getAttribute('href')).toBe(
      '/knowledge',
    );
  });

  it('shows Security facts without a dead two-factor control', () => {
    renderSettings('/settings?tab=security');
    expect(screen.getByTestId('settings-security')).toBeDefined();
    expect(screen.getByTestId('security-session-type').textContent).toContain('JWT');
    expect(screen.getByText(/Two-factor authentication is not available yet/)).toBeDefined();
    expect(screen.queryByRole('button', { name: /Enable/ })).toBeNull();
  });

  it('keeps sign out to a single owner (Account)', () => {
    renderSettings('/settings?tab=account');
    expect(screen.getAllByTestId('account-sign-out')).toHaveLength(1);
    cleanup();

    renderSettings('/settings?tab=security');
    expect(screen.queryByTestId('account-sign-out')).toBeNull();
  });
});

// ── 5-9. Profile ─────────────────────────────────────────────────────────────

describe('UX-07 — Profile uses real profile data', () => {
  it('renders the values the server returned', async () => {
    renderSettings('/settings?tab=profile');
    await waitFor(() => {
      expect(screen.getByTestId('settings-profile')).toBeDefined();
    });

    expect(mocks.getProfile).toHaveBeenCalledWith('token-1');
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Anya');
    expect(screen.getByLabelText('Age')).toHaveProperty('value', '31');
    expect(screen.getByLabelText('Primary Goal')).toHaveProperty('value', 'Launch the MVP');
    expect(screen.getByLabelText('Email')).toHaveProperty('value', 'anya@vedmoulya.com');
  });

  it('never falls back to fabricated profile defaults', async () => {
    renderSettings('/settings?tab=profile');
    await waitFor(() => {
      expect(screen.getByTestId('settings-profile')).toBeDefined();
    });

    const text = document.body.textContent ?? '';
    expect(text).not.toContain('user@vedmoulya.com');
    expect(text).not.toContain('Product Engineer');
    expect(text).not.toContain('America/New_York');
    expect(text).not.toContain('Timezone');
  });

  it('shows a loading state while the profile is being read', () => {
    mocks.getProfile.mockReturnValue(new Promise(() => {}));
    renderSettings('/settings?tab=profile');
    expect(screen.getByTestId('profile-loading')).toBeDefined();
    expect(screen.queryByTestId('settings-profile')).toBeNull();
  });

  it('shows the empty state when the profile is incomplete', async () => {
    mocks.getProfile.mockResolvedValue(
      profile({ displayName: 'Anya', age: undefined, purpose: undefined, profileComplete: false }),
    );
    renderSettings('/settings?tab=profile');
    await waitFor(() => {
      expect(screen.getByTestId('profile-incomplete')).toBeDefined();
    });
    expect(screen.getByLabelText('Age')).toHaveProperty('value', '');
  });

  it('shows an error state and retries on request', async () => {
    mocks.getProfile.mockRejectedValueOnce(new Error('Profile service unavailable'));
    renderSettings('/settings?tab=profile');
    await waitFor(() => {
      expect(screen.getByTestId('profile-error')).toBeDefined();
    });
    expect(screen.getByText('Profile service unavailable')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    await waitFor(() => {
      expect(screen.getByTestId('settings-profile')).toBeDefined();
    });
    expect(mocks.getProfile.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('saves through the real profile endpoint and reflects the stored result', async () => {
    renderSettings('/settings?tab=profile');
    await waitFor(() => {
      expect(screen.getByTestId('settings-profile')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Primary Goal'), {
      target: { value: 'Ship the first paying customer' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save profile/ }));

    await waitFor(() => {
      expect(mocks.completeProfile).toHaveBeenCalledWith({
        displayName: 'Anya',
        age: 31,
        gender: 'female',
        purpose: 'building',
        primaryGoal: 'Ship the first paying customer',
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId('profile-saved')).toBeDefined();
    });
  });

  it('refuses an invalid profile instead of sending it', async () => {
    renderSettings('/settings?tab=profile');
    await waitFor(() => {
      expect(screen.getByTestId('settings-profile')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Save profile/ }));

    await waitFor(() => {
      expect(screen.getByText('Enter your name.')).toBeDefined();
    });
    expect(screen.getByText(/Age must be a whole number between/)).toBeDefined();
    expect(mocks.completeProfile).not.toHaveBeenCalled();
  });

  it('surfaces a backend save failure verbatim', async () => {
    mocks.completeProfile.mockResolvedValue({ ok: false, error: 'PROFILE_UPDATE_REJECTED' });
    renderSettings('/settings?tab=profile');
    await waitFor(() => {
      expect(screen.getByTestId('settings-profile')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Save profile/ }));
    await waitFor(() => {
      expect(screen.getByTestId('profile-save-error').textContent).toBe('PROFILE_UPDATE_REJECTED');
    });
  });
});

// ── 10. Persisted preferences ────────────────────────────────────────────────

describe('UX-07 — preferences that are supported persist', () => {
  it('persists the haptics preference on the device', () => {
    renderSettings('/settings?tab=appearance');
    const toggle = screen.getByRole('switch', { name: 'Haptic feedback' });

    fireEvent.click(toggle);
    expect(window.localStorage.getItem('vedmoulya-haptics')).toBe('off');
    expect(mocks.setHapticsEnabled).toHaveBeenCalledWith(false);

    fireEvent.click(toggle);
    expect(window.localStorage.getItem('vedmoulya-haptics')).toBe('on');
    expect(mocks.setHapticsEnabled).toHaveBeenCalledWith(true);
  });

  it('restores a previously saved haptics preference', () => {
    window.localStorage.setItem('vedmoulya-haptics', 'off');
    renderSettings('/settings?tab=appearance');
    expect(
      screen.getByRole('switch', { name: 'Haptic feedback' }).getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('persists notification preferences and says delivery is not live', () => {
    renderSettings('/settings?tab=notifications');
    const weekly = screen.getByRole('switch', { name: 'Weekly digest' });

    fireEvent.click(weekly);

    const stored = JSON.parse(
      window.localStorage.getItem('vedmoulya-notifications') ?? '{}',
    ) as Record<string, boolean>;
    expect(stored.weeklyDigest).toBe(true);
    expect(screen.getByText(/Delivery is not live yet/)).toBeDefined();
  });

  it('persists the theme through the design-system provider', () => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    renderSettingsWithTheme('/settings?tab=appearance');
    fireEvent.click(screen.getByTestId('theme-dark'));

    expect(window.localStorage.getItem('vedmoulya-theme')).toBe('dark');
  });

  it('saves AI cost policy through the real preferences mutation', async () => {
    mocks.prefs = { budgetPolicy: 'never_paid', budgets: { dailyUsd: 1, monthlyUsd: 10 } };
    renderSettings('/settings?tab=ai');

    fireEvent.click(screen.getByRole('radio', { name: /Allow within budget/ }));
    fireEvent.change(screen.getByLabelText('Daily budget'), { target: { value: '0.5' } });
    fireEvent.click(screen.getByRole('button', { name: /Save AI preferences/ }));

    await waitFor(() => {
      expect(mocks.setPrefs.mutateAsync).toHaveBeenCalledWith({
        userId: 'u-1',
        budgetPolicy: 'allow_within_budget',
        budgets: { dailyUsd: 0.5, monthlyUsd: 10 },
      });
    });
  });
});

// ── 11. One provider destination ─────────────────────────────────────────────

describe('UX-07 — provider configuration has one destination', () => {
  it('never offers a second provider configuration surface', async () => {
    mocks.prefs = { budgetPolicy: 'never_paid', budgets: {} };
    renderSettings('/settings?tab=ai');
    await waitFor(() => {
      expect(screen.getByTestId('settings-ai')).toBeDefined();
    });

    const hrefs = Array.from(document.querySelectorAll('a')).map((anchor) =>
      anchor.getAttribute('href'),
    );
    expect(hrefs.filter((href) => href === '/providers').length).toBeGreaterThan(0);
    // No provider CONFIGURATION controls: only the link out.
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    expect(screen.queryByText(/API key/i)).toBeNull();
  });

  it('reports Connected Services from the real runtime registry', async () => {
    renderSettings('/settings?tab=services');
    await waitFor(() => {
      expect(screen.getByTestId('settings-services')).toBeDefined();
    });

    expect(screen.getByTestId('services-mode').textContent).toBe('production');
    expect(screen.getByTestId('services-known').textContent).toBe('3');
    expect(screen.getByTestId('services-connected').textContent).toBe('1');
    expect(screen.getByTestId('services-attention').textContent).toBe('1');
    expect(screen.getByTestId('services-unconfigured').textContent).toBe('1');
    expect(screen.getByRole('link', { name: /Manage AI providers/ }).getAttribute('href')).toBe(
      '/providers',
    );
  });

  it('never fabricates connected services when the registry is unavailable', () => {
    mocks.runtimeData = undefined;
    mocks.runtimeError = true;
    renderSettings('/settings?tab=services');

    expect(screen.getByTestId('services-error')).toBeDefined();
    expect(document.body.textContent ?? '').not.toMatch(/providers configured/);
    expect(document.body.textContent ?? '').not.toMatch(/Connected via tRPC/);
  });
});

// ── 12-13. Mobile navigation + deep links ────────────────────────────────────

describe('UX-07 — mobile navigation and deep links', () => {
  it('navigates every section from the single tab strip (any viewport)', async () => {
    renderSettings('/settings');
    for (const section of SETTINGS_SECTIONS) {
      selectTab(section.label);
      expect(window.location.search).toBe(section.id === 'account' ? '' : `?tab=${section.id}`);
      const testId = section.id === 'services' ? 'settings-services' : `settings-${section.id}`;
      await waitFor(() => {
        expect(screen.getByTestId(testId)).toBeDefined();
      });
    }
  });

  it('deep-links straight into a non-default section', () => {
    renderSettings('/settings?tab=advanced');
    expect(screen.getByTestId('settings-advanced')).toBeDefined();
    expect(screen.getByTestId('advanced-runtime-mode').textContent).toBe('production');
    expect(screen.getByTestId('advanced-user-id').textContent).toBe('u-1');
  });

  it('falls back to Account for an unknown tab', () => {
    renderSettings('/settings?tab=not-a-section');
    expect(screen.getByTestId('settings-account')).toBeDefined();
    expect(sectionFromSearch('?tab=not-a-section')).toBe('account');
  });

  it('keeps the Profile fragment canonical', async () => {
    expect(urlForSection('profile')).toBe('/settings?tab=profile');
    expect(urlForSection('account')).toBe('/settings');
    expect(sectionFromSearch('?tab=profile')).toBe('profile');

    renderSettings('/settings');
    selectTab('Profile');
    expect(window.location.search).toBe('?tab=profile');
    await waitFor(() => {
      expect(screen.getByTestId('settings-profile')).toBeDefined();
    });
  });
});
