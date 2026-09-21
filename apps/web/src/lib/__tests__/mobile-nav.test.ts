// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Mobile Navigation Model Tests (MOB-002 · UX-01/UX-02)
// Verifies pathname → tab mapping (deep links), first-launch vs restore
// resolution, and last-tab persistence for the FIVE-destination bottom bar:
// Home · Missions · Progress · AI · More.
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
  it('maps each primary destination to its tab', () => {
    expect(tabForPathname('/').id).toBe('home');
    expect(tabForPathname('/autonomous-builder').id).toBe('missions');
    expect(tabForPathname('/progress').id).toBe('progress');
    expect(tabForPathname('/ai').id).toBe('ai');
  });

  it('maps the Missions detail surfaces to the Missions tab, not their own', () => {
    for (const route of ['/goals', '/execution', '/execution-strategy', '/loop']) {
      expect(tabForPathname(route).id, route).toBe('missions');
    }
  });

  it('maps AI surfaces (providers, intelligence, memory, marketplace…) to the AI tab', () => {
    for (const route of [
      '/providers',
      '/brain',
      '/memory',
      '/knowledge',
      '/context',
      '/marketplace',
      '/capability-marketplace',
    ]) {
      expect(tabForPathname(route).id, route).toBe('ai');
    }
  });

  it('sends everything else to More instead of inventing a sixth tab', () => {
    expect(tabForPathname('/career').id).toBe('more');
    expect(tabForPathname('/learning/courses/123').id).toBe('more');
    expect(tabForPathname('/business').id).toBe('more');
    expect(tabForPathname('/content-agency/clients/abc').id).toBe('more');
    expect(tabForPathname('/settings').id).toBe('more');
  });

  it('falls back to Home for an unknown path', () => {
    expect(tabForPathname('/does-not-exist').id).toBe('home');
  });

  it('exposes exactly the five UX-01 destinations', () => {
    expect(MOBILE_TABS.map((t) => t.id)).toEqual(['home', 'missions', 'progress', 'ai', 'more']);
    expect(MOBILE_TABS.map((t) => t.label)).toEqual(['Home', 'Missions', 'Progress', 'AI', 'More']);
  });

  // UX-09 — More must expose the exact secondary set, without becoming a
  // second navigation system (Ask is an ACTION reachable from More, not a tab).
  it('UX-09 More exposes Life/Career/Learning/Business/Marketplace (+ Ask/Settings/Profile)', async () => {
    const { MOBILE_MORE_LINKS, SETTINGS_DESTINATION, PROFILE_DESTINATION, ASK_DESTINATION } =
      await import('../navigation-model.js');
    const labels = MOBILE_MORE_LINKS.map((l) => l.label);
    for (const required of ['Life', 'Career', 'Learning', 'Business', 'Marketplace']) {
      expect(labels).toContain(required);
    }
    // Settings/Profile are system destinations; Ask opens the canonical panel.
    expect(SETTINGS_DESTINATION.route).toBe('/settings');
    expect(PROFILE_DESTINATION.route).toBe('/settings?tab=profile');
    expect(ASK_DESTINATION.action).toBe('open-ai-companion');
  });
});

describe('isMobileTabId / tabById', () => {
  it('validates tab ids', () => {
    expect(isMobileTabId('home')).toBe(true);
    expect(isMobileTabId('more')).toBe(true);
    // The pre-UX-02 vocabulary is gone on purpose.
    expect(isMobileTabId('dashboard')).toBe(false);
    expect(isMobileTabId('content-agency')).toBe(false);
    expect(isMobileTabId(null)).toBe(false);
  });

  it('resolves ids and falls back to Home', () => {
    expect(tabById('missions').route).toBe('/autonomous-builder');
    expect(tabById('ai').route).toBe('/ai');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(tabById('bogus' as any).id).toBe('home');
  });
});

describe('last-tab persistence (state preservation)', () => {
  it('persists and reads the last visited tab', () => {
    persistLastTab('missions');
    expect(readLastTab()).toBe('missions');
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
  it('first launch (no persisted tab) resolves to Home without restore', () => {
    const { tab, restore } = resolveLaunchTab('/');
    expect(tab.id).toBe('home');
    expect(restore).toBe(false);
  });

  it('bare launch with a persisted tab restores it', () => {
    persistLastTab('missions');
    const { tab, restore } = resolveLaunchTab('/');
    expect(tab.id).toBe('missions');
    expect(restore).toBe(true);
  });

  it('never restores More (a container, not a place) and never restores Home', () => {
    persistLastTab('more');
    expect(resolveLaunchTab('/')).toEqual({ tab: tabById('home'), restore: false });

    persistLastTab('home');
    expect(resolveLaunchTab('/').restore).toBe(false);
  });

  it('deep link always wins over the persisted tab', () => {
    persistLastTab('missions');
    const { tab, restore } = resolveLaunchTab('/settings');
    expect(tab.id).toBe('more');
    expect(restore).toBe(false);
  });
});
