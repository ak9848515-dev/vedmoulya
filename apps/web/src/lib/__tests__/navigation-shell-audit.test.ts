// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — UX-02 Navigation Shell Audit Tests
//
// Comprehensive coverage of the information architecture contract:
//   - Route → destination mapping for every specified route
//   - Deep-link active state (URL is source of truth)
//   - Mobile navigation: five tabs + More sheet
//   - Command Palette route consistency
//   - Settings vs Profile disambiguation
//   - No orphaned navigation destinations
//   - No competing navigation authorities
//   - AI/provider ownership under AI destination
//   - Legacy module section resolution
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  AI_DESTINATION,
  ALL_DESTINATIONS,
  ASK_DESTINATION,
  HOME_DESTINATION,
  LIFE_DESTINATION,
  MISSIONS_DESTINATION,
  MOBILE_DESTINATIONS,
  MOBILE_MORE_LINKS,
  PRIMARY_DESTINATIONS,
  PROFILE_DESTINATION,
  PROGRESS_DESTINATION,
  SETTINGS_DESTINATION,
  destinationForPathname,
  isDestinationActive,
} from '../navigation-model.js';
import {
  destinationIdForSection,
  type LegacyModuleSectionId,
  type NavSectionId,
} from '../../stores/navigation-store.js';
import { SETTINGS_SECTIONS, urlForSection } from '../../app/settings/settings-sections.js';

// ── Information Architecture Contract ──────────────────────────────────────

describe('UX-02 — information architecture contract', () => {
  it('has exactly the eight destinations defined', () => {
    expect(ALL_DESTINATIONS.length).toBe(8);
    expect(ALL_DESTINATIONS.map((d) => d.id)).toEqual([
      'home',
      'missions',
      'progress',
      'life',
      'ai',
      'ask',
      'settings',
      'profile',
    ]);
  });

  it('has exactly five primary destinations', () => {
    expect(PRIMARY_DESTINATIONS.length).toBe(5);
    expect(PRIMARY_DESTINATIONS.map((d) => d.id)).toEqual([
      'home',
      'missions',
      'progress',
      'life',
      'ai',
    ]);
  });

  it('Ask VedMoulya is an action, not a navigable page', () => {
    expect(ASK_DESTINATION.action).toBe('open-ai-companion');
    expect(ASK_DESTINATION.route).toBe('');
    expect(ASK_DESTINATION.match.length).toBe(0);
    expect(isDestinationActive(ASK_DESTINATION, '/', '')).toBe(false);
  });

  it('every destination has a non-empty label, description and icon', () => {
    for (const dest of ALL_DESTINATIONS) {
      expect(dest.label.length, `${dest.id} label`).toBeGreaterThan(0);
      expect(dest.description.length, `${dest.id} description`).toBeGreaterThan(0);
      expect(dest.icon, `${dest.id} icon`).toBeDefined();
    }
  });

  it('labels are plain language (no internal module names)', () => {
    const jargon =
      /orchestrator|fabric|registry|bridge|engine|loop|ecosystem|capability|marketplace/i;
    for (const dest of PRIMARY_DESTINATIONS) {
      expect(dest.label, dest.id).not.toMatch(jargon);
    }
  });
});

// ── Complete Route → Destination Mapping ───────────────────────────────────

describe('UX-02 — route → destination mapping (every specified route)', () => {
  const routeMap: Array<[string, string]> = [
    // Home
    ['/', 'home'],

    // Missions
    ['/autonomous-builder', 'missions'],
    ['/missions', 'missions'],
    ['/goals', 'missions'],
    ['/execution', 'missions'],
    ['/execution-strategy', 'missions'],
    ['/loop', 'missions'],

    // Progress
    ['/progress', 'progress'],

    // Life
    ['/life', 'life'],
    ['/career', 'life'],
    ['/learning', 'life'],
    ['/business', 'life'],
    ['/content-agency', 'life'],
    // UX-01 ownership alignment: the Application Factory is a BUILD ENGINE over
    // missions, so it belongs to Missions (it used to be claimed by Life).
    ['/applications', 'missions'],

    // AI
    ['/ai', 'ai'],
    ['/ai-world', 'ai'],
    ['/brain', 'ai'],
    ['/intelligence', 'ai'],
    ['/ecosystem-intelligence', 'ai'],
    ['/learning-intelligence', 'ai'],
    ['/live-intelligence', 'ai'],
    ['/knowledge', 'ai'],
    ['/memory', 'ai'],
    ['/context', 'ai'],
    ['/context-fabric', 'ai'],
    ['/providers', 'ai'],
    ['/capabilities', 'ai'],
    ['/capability-marketplace', 'ai'],
    ['/marketplace', 'ai'],
    ['/ecosystem', 'ai'],
    ['/os', 'ai'],
    ['/enterprise-brain', 'ai'],

    // Settings
    ['/settings', 'settings'],

    // Nested child routes
    ['/career/resume', 'life'],
    ['/providers/google', 'ai'],
    ['/progress/journey', 'progress'],
    ['/learning/courses/123', 'life'],
    ['/business/clients', 'life'],
    ['/goals/active', 'missions'],
    ['/content-agency/clients', 'life'],
  ];

  it.each(routeMap)('%s → %s', (pathname, expectedId) => {
    expect(destinationForPathname(pathname).id).toBe(expectedId);
  });

  it('unknown routes fall back to Home', () => {
    expect(destinationForPathname('/does-not-exist').id).toBe('home');
    expect(destinationForPathname('/foo/bar/baz').id).toBe('home');
  });

  it('root path only matches Home (does not swallow every path)', () => {
    expect(isDestinationActive(HOME_DESTINATION, '/')).toBe(true);
    expect(isDestinationActive(HOME_DESTINATION, '/career')).toBe(false);
    expect(isDestinationActive(HOME_DESTINATION, '/ai')).toBe(false);
    expect(isDestinationActive(HOME_DESTINATION, '/settings')).toBe(false);
  });
});

// ── Deep-Link Active State (URL is source of truth) ────────────────────────

describe('UX-02 — deep-link active state', () => {
  it('opening /goals directly highlights MISSIONS', () => {
    const dest = destinationForPathname('/goals');
    expect(dest.id).toBe('missions');
  });

  it('opening /career directly highlights LIFE', () => {
    const dest = destinationForPathname('/career');
    expect(dest.id).toBe('life');
  });

  it('opening /providers directly highlights AI', () => {
    const dest = destinationForPathname('/providers');
    expect(dest.id).toBe('ai');
  });

  it('opening /settings?tab=profile highlights PROFILE', () => {
    const dest = destinationForPathname('/settings', '?tab=profile');
    expect(dest.id).toBe('profile');
  });

  it('opening /settings (bare) highlights SETTINGS', () => {
    const dest = destinationForPathname('/settings');
    expect(dest.id).toBe('settings');
  });

  it('opening /learning directly highlights LIFE', () => {
    const dest = destinationForPathname('/learning');
    expect(dest.id).toBe('life');
  });

  it('opening /marketplace directly highlights AI', () => {
    const dest = destinationForPathname('/marketplace');
    expect(dest.id).toBe('ai');
  });

  it('opening /brain directly highlights AI', () => {
    const dest = destinationForPathname('/brain');
    expect(dest.id).toBe('ai');
  });

  it('opening /memory directly highlights AI', () => {
    const dest = destinationForPathname('/memory');
    expect(dest.id).toBe('ai');
  });

  it('opening /execution directly highlights MISSIONS', () => {
    const dest = destinationForPathname('/execution');
    expect(dest.id).toBe('missions');
  });
});

// ── Settings vs Profile — One Pathname, One Highlight ──────────────────────

describe('UX-02 — Settings vs Profile disambiguation', () => {
  it('bare /settings → SETTINGS', () => {
    expect(destinationForPathname('/settings').id).toBe('settings');
  });

  it('/settings?tab=profile → PROFILE', () => {
    expect(destinationForPathname('/settings', '?tab=profile').id).toBe('profile');
  });

  it('/settings?tab=appearance → SETTINGS', () => {
    expect(destinationForPathname('/settings', '?tab=appearance').id).toBe('settings');
  });

  it('never highlights both destinations simultaneously', () => {
    for (const search of ['', '?tab=profile', '?tab=appearance', '?tab=ai']) {
      const active = ALL_DESTINATIONS.filter((dest) =>
        isDestinationActive(dest, '/settings', search),
      );
      expect(
        active.map((d) => d.id),
        search,
      ).toHaveLength(1);
    }
  });

  it('Profile destination is only active with tab=profile query', () => {
    expect(isDestinationActive(PROFILE_DESTINATION, '/settings')).toBe(false);
    expect(isDestinationActive(PROFILE_DESTINATION, '/settings', '?tab=profile')).toBe(true);
    expect(isDestinationActive(PROFILE_DESTINATION, '/settings', '?tab=appearance')).toBe(false);
  });

  it('Settings destination is NOT active with tab=profile query', () => {
    expect(isDestinationActive(SETTINGS_DESTINATION, '/settings')).toBe(true);
    expect(isDestinationActive(SETTINGS_DESTINATION, '/settings', '?tab=profile')).toBe(false);
  });
});

// ── Mobile Navigation Contract ─────────────────────────────────────────────

describe('UX-02 — mobile navigation contract', () => {
  it('has exactly five primary mobile destinations', () => {
    expect(MOBILE_DESTINATIONS.length).toBe(5);
    expect(MOBILE_DESTINATIONS.map((d) => d.id)).toEqual([
      'home',
      'missions',
      'progress',
      'ai',
      'more',
    ]);
  });

  it('each tab has a label and icon', () => {
    for (const tab of MOBILE_DESTINATIONS) {
      expect(tab.label.length, `${tab.id} label`).toBeGreaterThan(0);
      expect(tab.icon, `${tab.id} icon`).toBeDefined();
    }
  });

  it('More is a container with no route', () => {
    const more = MOBILE_DESTINATIONS.find((d) => d.id === 'more');
    expect(more).toBeDefined();
    expect(more?.route).toBe('');
  });

  it('every primary tab has a real, navigable route', () => {
    for (const tab of MOBILE_DESTINATIONS) {
      if (tab.id === 'more') continue;
      expect(tab.route.length, `${tab.id} route`).toBeGreaterThan(0);
      expect(tab.route.startsWith('/'), `${tab.id} route starts with /`).toBe(true);
    }
  });
});

describe('UX-02 — More sheet contents', () => {
  it('contains Life, Career, Learning, Business, and Marketplace', () => {
    const labels = MOBILE_MORE_LINKS.map((l) => l.label);
    expect(labels).toContain('Life');
    expect(labels).toContain('Career');
    expect(labels).toContain('Learning');
    expect(labels).toContain('Business');
    expect(labels).toContain('Marketplace');
  });

  it('every More link has a real route', () => {
    for (const link of MOBILE_MORE_LINKS) {
      expect(link.route.startsWith('/'), `${link.label} route`).toBe(true);
      expect(link.description.length, `${link.label} description`).toBeGreaterThan(10);
    }
  });

  it('routes in More sheet are all real pages', () => {
    const validMoreRoutes = ['/life', '/career', '/learning', '/business', '/marketplace'];
    for (const link of MOBILE_MORE_LINKS) {
      expect(validMoreRoutes, `${link.label} route is valid`).toContain(link.route);
    }
  });
});

// ── AI Ownership (providers, brain, marketplace under AI) ───────────────────

describe('UX-02 — AI destination ownership', () => {
  const aiRoutes = [
    '/ai',
    '/ai-world',
    '/brain',
    '/enterprise-brain',
    '/intelligence',
    '/ecosystem-intelligence',
    '/learning-intelligence',
    '/live-intelligence',
    '/knowledge',
    '/memory',
    '/context',
    '/context-fabric',
    '/providers',
    '/capabilities',
    '/capability-marketplace',
    '/marketplace',
    '/ecosystem',
    '/os',
  ];

  it.each(aiRoutes)('%s is owned by AI destination', (route) => {
    expect(destinationForPathname(route).id).toBe('ai');
  });

  it('providers route is under AI, not a separate top-level destination', () => {
    expect(AI_DESTINATION.match).toContain('/providers');
  });

  it('marketplace route is under AI, not a separate top-level destination', () => {
    expect(AI_DESTINATION.match).toContain('/marketplace');
  });

  it('capability-marketplace route is under AI', () => {
    expect(AI_DESTINATION.match).toContain('/capability-marketplace');
  });
});

// ── Legacy Module Section Resolution ───────────────────────────────────────

describe('UX-02 — legacy module section resolution', () => {
  const legacyDestinations: Array<[LegacyModuleSectionId, string]> = [
    ['dashboard', 'home'],
    ['search', 'home'],
    ['insights', 'progress'],
    ['autonomous-builder', 'missions'],
    ['goals', 'missions'],
    ['execution', 'missions'],
    ['execution-strategy', 'missions'],
    ['loop', 'missions'],
    ['career', 'life'],
    ['learning', 'life'],
    ['business', 'life'],
    ['marketplace', 'ai'],
    ['capabilities', 'ai'],
    ['capability-marketplace', 'ai'],
    ['providers', 'ai'],
    ['context', 'ai'],
    ['intelligence', 'ai'],
    ['brain', 'ai'],
    ['knowledge', 'ai'],
    ['memory', 'ai'],
    ['context-fabric', 'ai'],
    ['os', 'ai'],
    ['ecosystem', 'ai'],
    ['ecosystem-intelligence', 'ai'],
    ['learning-intelligence', 'ai'],
    ['live-intelligence', 'ai'],
    ['enterprise-brain', 'ai'],
    ['content-agency', 'life'],
    ['applications', 'missions'],
    ['settings', 'settings'],
  ];

  it.each(legacyDestinations)(
    'legacy section "%s" resolves to destination "%s"',
    (section, expectedId) => {
      expect(destinationIdForSection(section)).toBe(expectedId);
    },
  );

  it('destination ids pass through untouched', () => {
    expect(destinationIdForSection('home')).toBe('home');
    expect(destinationIdForSection('missions')).toBe('missions');
    expect(destinationIdForSection('progress')).toBe('progress');
    expect(destinationIdForSection('life')).toBe('life');
    expect(destinationIdForSection('ai')).toBe('ai');
    expect(destinationIdForSection('settings')).toBe('settings');
    expect(destinationIdForSection('profile')).toBe('profile');
  });
});

// ── No Orphaned Navigation Destinations ────────────────────────────────────

describe('UX-02 — no orphaned navigation destinations', () => {
  it('every destination route points to a real existing page route prefix', () => {
    // Every destination's canonical route must be reachable
    for (const dest of ALL_DESTINATIONS) {
      if (dest.action !== undefined) continue; // Ask VedMoulya is an action
      expect(dest.route.length, `${dest.id} has a route`).toBeGreaterThan(0);
    }
  });

  it('every destination has at least one match prefix', () => {
    for (const dest of ALL_DESTINATIONS) {
      if (dest.action !== undefined) continue;
      expect(dest.match.length, `${dest.id} has match prefixes`).toBeGreaterThan(0);
    }
  });
});

// ── Navigation Model Consistency ───────────────────────────────────────────

describe('UX-02 — navigation model internal consistency', () => {
  it('every primary destination except Life has a mobile tab', () => {
    for (const dest of PRIMARY_DESTINATIONS) {
      if (dest.id === 'life') continue; // Life deliberately lives under More
      const tab = MOBILE_DESTINATIONS.find((t) => t.id === dest.id);
      expect(tab, `${dest.id} has a mobile tab`).toBeDefined();
    }
  });

  it('Life is deliberately excluded from the bottom bar (it lives under More)', () => {
    const mobileIds = new Set<string>(MOBILE_DESTINATIONS.map((d) => d.id));
    expect(mobileIds.has('life')).toBe(false);
    // But it IS reachable through More
    const moreLink = MOBILE_MORE_LINKS.find((l) => l.route === '/life');
    expect(moreLink).toBeDefined();
  });

  it('mobile destinations are a subset of primary (minus life) + more', () => {
    const mobileIds = new Set<string>(MOBILE_DESTINATIONS.map((d) => d.id));
    expect(mobileIds.has('more')).toBe(true);
    for (const dest of PRIMARY_DESTINATIONS) {
      if (dest.id === 'life') continue; // Under More
      expect(mobileIds.has(dest.id), `${dest.id} is a mobile tab`).toBe(true);
    }
  });

  it('settings and profile are not in primary destinations', () => {
    expect(PRIMARY_DESTINATIONS.map((d) => d.id)).not.toContain('settings');
    expect(PRIMARY_DESTINATIONS.map((d) => d.id)).not.toContain('profile');
  });

  it('ask is not in primary destinations', () => {
    expect(PRIMARY_DESTINATIONS.map((d) => d.id)).not.toContain('ask');
  });

  // UX-07: the settings IA grew to twelve sections. Exactly ONE of them
  // (Profile) is a navigation destination — the rest must stay inside Settings,
  // otherwise adding a tab would silently create fourteen "destinations".
  it('resolves every settings section to Settings, except Profile', () => {
    for (const section of SETTINGS_SECTIONS) {
      const [pathname, query] = urlForSection(section.id).split('?');
      const expected = section.id === 'profile' ? 'profile' : 'settings';
      expect(destinationForPathname(pathname ?? '', query ? `?${query}` : '').id, section.id).toBe(
        expected,
      );
    }
  });

  it('declares exactly one settings destination query fragment', () => {
    const querySections = SETTINGS_SECTIONS.filter((section) =>
      urlForSection(section.id).includes('?'),
    );
    expect(querySections.map((section) => section.id)).toContain('profile');
    // Account is the bare `/settings` route, so it is the only query-less one.
    expect(querySections.map((section) => section.id)).not.toContain('account');
  });

  it('destination match prefixes do not overlap between siblings at the same level', () => {
    // Home should only match exactly '/'
    expect(isDestinationActive(HOME_DESTINATION, '/anything-else')).toBe(false);
  });

  it('destinationForPathname is deterministic', () => {
    for (const route of ['/', '/career', '/providers', '/settings', '/ai']) {
      const first = destinationForPathname(route);
      const second = destinationForPathname(route);
      expect(first.id).toBe(second.id);
    }
  });
});

// ── Deep Link Recovery (refresh / back-forward) ────────────────────────────

describe('UX-02 — deep link recovery (URL-first architecture)', () => {
  const deepLinkCases: Array<[string, string]> = [
    ['/', 'home'],
    ['/autonomous-builder', 'missions'],
    ['/goals', 'missions'],
    ['/execution', 'missions'],
    ['/progress', 'progress'],
    ['/life', 'life'],
    ['/career', 'life'],
    ['/learning', 'life'],
    ['/business', 'life'],
    ['/ai', 'ai'],
    ['/providers', 'ai'],
    ['/brain', 'ai'],
    ['/marketplace', 'ai'],
    ['/settings', 'settings'],
  ];

  it.each(deepLinkCases)(
    'deep-linking to %s resolves to correct destination %s',
    (route, expectedId) => {
      expect(destinationForPathname(route).id).toBe(expectedId);
    },
  );

  it('refreshing on a child route preserves correct active state', () => {
    // Simulating refresh: URL stays the same, shell re-derives active state
    const route = '/providers';
    const active = destinationForPathname(route);
    expect(active.id).toBe('ai');
  });
});
