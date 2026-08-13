// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Mobile Navigation Model Tests (MOB-002)
// Verifies pathname → tab mapping (deep links), first-launch vs restore
// resolution, and last-tab persistence.
// ─────────────────────────────────────────────────────────────────────────────

// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  tabForPathname,
  resolveLaunchTab,
  persistLastTab,
  readLastTab,
  isMobileTabId,
  MOBILE_TABS,
  tabById,
} from '../mobile-nav.js';

const LAST_TAB_KEY = 'vedmoulya-last-tab';

beforeEach(() => {
  window.localStorage.clear();
});

describe('tabForPathname (deep links)', () => {
  it('maps each module route to its owning tab', () => {
    expect(tabForPathname('/').id).toBe('dashboard');
    expect(tabForPathname('/learning').id).toBe('learning');
    expect(tabForPathname('/career').id).toBe('career');
    expect(tabForPathname('/marketplace').id).toBe('marketplace');
    expect(tabForPathname('/content-agency').id).toBe('content-agency');
    expect(tabForPathname('/settings').id).toBe('settings');
  });

  it('maps nested sub-routes of a module to that module tab', () => {
    expect(tabForPathname('/career/resume').id).toBe('career');
    expect(tabForPathname('/learning/courses/123').id).toBe('learning');
    expect(tabForPathname('/content-agency/clients/abc').id).toBe('content-agency');
  });

  it('falls back to the dashboard tab for unknown paths', () => {
    expect(tabForPathname('/does-not-exist').id).toBe('dashboard');
  });

  it('covers the required bottom tabs including the Agency module', () => {
    expect(MOBILE_TABS.map((t) => t.id)).toEqual([
      'dashboard',
      'learning',
      'career',
      'marketplace',
      'content-agency',
      'settings',
    ]);
  });
});

describe('isMobileTabId / tabById', () => {
  it('validates tab ids', () => {
    expect(isMobileTabId('dashboard')).toBe(true);
    expect(isMobileTabId('settings')).toBe(true);
    expect(isMobileTabId('insights')).toBe(false);
    expect(isMobileTabId(null)).toBe(false);
  });

  it('resolves ids and falls back to dashboard', () => {
    expect(tabById('career').route).toBe('/career');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(tabById('bogus' as any).id).toBe('dashboard');
  });
});

describe('last-tab persistence (state preservation)', () => {
  it('persists and reads the last visited tab', () => {
    persistLastTab('marketplace');
    expect(readLastTab()).toBe('marketplace');
  });

  it('ignores invalid persisted values', () => {
    window.localStorage.setItem(LAST_TAB_KEY, 'not-a-tab');
    expect(readLastTab()).toBeNull();
  });

  it('returns null when nothing was persisted', () => {
    expect(readLastTab()).toBeNull();
  });
});

describe('resolveLaunchTab', () => {
  it('first launch (no persisted tab) resolves to the dashboard without restore', () => {
    const { tab, restore } = resolveLaunchTab('/');
    expect(tab.id).toBe('dashboard');
    expect(restore).toBe(false);
  });

  it('bare launch with a persisted tab restores it', () => {
    persistLastTab('career');
    const { tab, restore } = resolveLaunchTab('/');
    expect(tab.id).toBe('career');
    expect(restore).toBe(true);
  });

  it('deep link always wins over the persisted tab', () => {
    persistLastTab('career');
    const { tab, restore } = resolveLaunchTab('/settings');
    expect(tab.id).toBe('settings');
    expect(restore).toBe(false);
  });
});
