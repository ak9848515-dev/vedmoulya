// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Navigation Model tests (UX-01 / UX-02)
//
// The information architecture is the product contract for navigation, so it is
// pinned here: five primary destinations, the exact route map, longest-prefix
// active state, and the Settings/Profile disambiguation that lets two
// destinations share one pathname without both ever highlighting.
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

describe('information architecture', () => {
  it('has exactly the five primary destinations, in order', () => {
    expect(PRIMARY_DESTINATIONS.map((destination) => destination.id)).toEqual([
      'home',
      'missions',
      'progress',
      'life',
      'ai',
    ]);
    expect(PRIMARY_DESTINATIONS.map((destination) => destination.label)).toEqual([
      'Home',
      'Missions',
      'Progress',
      'Life',
      'AI',
    ]);
  });

  it('keeps Ask VedMoulya an action, not a page', () => {
    expect(ASK_DESTINATION.action).toBe('open-ai-companion');
    expect(ASK_DESTINATION.route).toBe('');
    expect(isDestinationActive(ASK_DESTINATION, '/', '')).toBe(false);
  });

  it('is honest about every destination route existing today', () => {
    // Real, deep-linkable routes only — no invented pages in the model.
    expect(HOME_DESTINATION.route).toBe('/');
    expect(MISSIONS_DESTINATION.route).toBe('/autonomous-builder');
    expect(PROGRESS_DESTINATION.route).toBe('/progress');
    expect(LIFE_DESTINATION.route).toBe('/life');
    expect(AI_DESTINATION.route).toBe('/ai');
    expect(SETTINGS_DESTINATION.route).toBe('/settings');
    expect(PROFILE_DESTINATION.route).toBe('/settings?tab=profile');
  });

  it('labels destinations in plain language (no internal module names)', () => {
    const jargon = /orchestrator|fabric|registry|bridge|engine|loop|ecosystem/i;
    for (const destination of ALL_DESTINATIONS) {
      expect(destination.label, destination.id).not.toMatch(jargon);
      expect(destination.description.length, destination.id).toBeGreaterThan(10);
    }
  });
});

describe('destinationForPathname — route mapping', () => {
  const cases: Array<[string, string]> = [
    ['/', 'home'],
    ['/autonomous-builder', 'missions'],
    ['/goals', 'missions'],
    ['/execution', 'missions'],
    ['/execution-strategy', 'missions'],
    ['/loop', 'missions'],
    ['/progress', 'progress'],
    ['/life', 'life'],
    ['/career', 'life'],
    ['/learning', 'life'],
    ['/business', 'life'],
    ['/content-agency', 'life'],
    ['/ai', 'ai'],
    ['/ai-world', 'ai'],
    ['/providers', 'ai'],
    ['/brain', 'ai'],
    ['/enterprise-brain', 'ai'],
    ['/intelligence', 'ai'],
    ['/ecosystem-intelligence', 'ai'],
    ['/learning-intelligence', 'ai'],
    ['/live-intelligence', 'ai'],
    ['/knowledge', 'ai'],
    ['/memory', 'ai'],
    ['/context', 'ai'],
    ['/context-fabric', 'ai'],
    ['/capabilities', 'ai'],
    ['/capability-marketplace', 'ai'],
    ['/marketplace', 'ai'],
    ['/ecosystem', 'ai'],
    ['/os', 'ai'],
  ];

  it.each(cases)('%s → %s', (pathname, expectedId) => {
    expect(destinationForPathname(pathname).id).toBe(expectedId);
  });

  it('does not let the root destination swallow every path', () => {
    expect(isDestinationActive(HOME_DESTINATION, '/career')).toBe(false);
    expect(isDestinationActive(HOME_DESTINATION, '/')).toBe(true);
  });

  it('matches nested detail routes to their owning destination', () => {
    expect(destinationForPathname('/career/resume').id).toBe('life');
    expect(destinationForPathname('/providers/google').id).toBe('ai');
    expect(destinationForPathname('/progress/journey').id).toBe('progress');
  });

  it('falls back to Home for an unknown route', () => {
    expect(destinationForPathname('/does-not-exist').id).toBe('home');
  });
});

describe('Settings vs Profile — one pathname, one highlight', () => {
  it('highlights Settings on a bare /settings visit', () => {
    expect(destinationForPathname('/settings').id).toBe('settings');
    expect(destinationForPathname('/settings', '?tab=profile').id).toBe('profile');
  });

  it('never highlights both', () => {
    for (const search of ['', '?tab=profile', '?tab=appearance']) {
      const active = ALL_DESTINATIONS.filter((destination) =>
        isDestinationActive(destination, '/settings', search),
      );
      expect(
        active.map((destination) => destination.id),
        search,
      ).toEqual([search.includes('tab=profile') ? 'profile' : 'settings']);
    }
  });
});

describe('mobile destinations', () => {
  it('is Home · Missions · Progress · AI · More', () => {
    expect(MOBILE_DESTINATIONS.map((destination) => destination.id)).toEqual([
      'home',
      'missions',
      'progress',
      'ai',
      'more',
    ]);
  });

  it('More is a container: it owns no route', () => {
    const more = MOBILE_DESTINATIONS.find((destination) => destination.id === 'more');
    expect(more?.route).toBe('');
  });

  it('More reaches Life, Career, Learning, Business and Marketplace at real routes', () => {
    const routes = MOBILE_MORE_LINKS.map((link) => link.route);
    expect(routes).toEqual(['/life', '/career', '/learning', '/business', '/marketplace']);
    for (const link of MOBILE_MORE_LINKS) {
      expect(link.description.length, link.label).toBeGreaterThan(10);
    }
  });
});
