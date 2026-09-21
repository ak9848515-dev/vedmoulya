// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Navigation Model (UX-01 / UX-02)
//
// THE SINGLE SOURCE OF TRUTH for the user-facing information architecture.
// Every navigation surface (desktop sidebar, mobile tab bar, mobile "More"
// sheet, active-state highlighting, launch restore) derives from this file, so
// the five primary destinations can never disagree with each other again.
//
// THE MENTAL MODEL (deliberately small):
//
//   HOME · MISSIONS · PROGRESS · LIFE · AI          ← the five life destinations
//   ✨ Ask VedMoulya                                ← the AI action (not a page)
//   Settings · Profile                              ← system destinations
//
// WHAT THIS FILE DOES **NOT** DO
//   It does not delete, move or rewrite a single route. Every technical screen
//   that used to be a sidebar item still exists and stays deep-linkable — it is
//   simply reached through its parent destination (`match` prefixes) instead of
//   competing for primary navigation space. See UX-AUDIT.md for the full
//   CURRENT ROUTE → NEW LOCATION map.
//
// ACTIVE-STATE RULE
//   A destination owns a set of path prefixes. The LONGEST matching prefix wins,
//   so `/career` highlights Life while `/life` highlights Life exactly. `/` is
//   matched exactly (it is a prefix of everything). Two destinations may share
//   `/settings` — the Profile entry disambiguates itself with `requiresQuery`
//   and the Settings entry excludes it, so exactly one is ever highlighted.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Rocket,
  TrendingUp,
  Compass,
  Sparkles,
  Settings as SettingsIcon,
  UserRound,
  Layers,
  Menu,
  Target,
  BarChart3,
  Store,
} from 'lucide-react';

// ── Destinations ────────────────────────────────────────────────────────────

export type AppDestinationId =
  'home' | 'missions' | 'progress' | 'life' | 'ai' | 'ask' | 'settings' | 'profile';

export interface AppDestination {
  id: AppDestinationId;
  /** What the user calls it. Never an internal module name. */
  label: string;
  /** One plain-language sentence — used by hubs, tooltips and the More sheet. */
  description: string;
  /** The canonical route TODAY (an existing route wherever one exists). */
  route: string;
  /**
   * Path prefixes this destination owns. Longest prefix wins. A `'/'` entry
   * matches the root ONLY (it is not allowed to swallow every path).
   */
  match: readonly string[];
  /** Active only when the URL query contains this fragment (e.g. 'tab=profile'). */
  requiresQuery?: string;
  /** Active only when the URL query does NOT contain this fragment. */
  excludesQuery?: string;
  /** Opens an existing panel instead of navigating. */
  action?: 'open-ai-companion';
  icon: LucideIcon;
}

export const HOME_DESTINATION: AppDestination = {
  id: 'home',
  label: 'Home',
  description: 'What matters to you right now.',
  route: '/',
  match: ['/'],
  icon: Home,
};

/**
 * Missions is the execution journey: goal → mission → plan → execution →
 * verification → result → learning. The GOALS / EXECUTION / EXECUTION-STRATEGY /
 * LOOP screens are its detail surfaces (Missions → Advanced), not separate
 * destinations.
 */
export const MISSIONS_DESTINATION: AppDestination = {
  id: 'missions',
  label: 'Missions',
  description: 'Your goals, missions and what is being worked on.',
  route: '/autonomous-builder',
  match: [
    '/autonomous-builder',
    '/missions',
    '/goals',
    '/execution',
    '/execution-strategy',
    '/loop',
    // The Application Factory is a BUILD ENGINE over the same mission journey
    // (goal → plan → build → verify) — an advanced execution surface, not a
    // Life area and not a top-level product of its own.
    '/applications',
  ],
  icon: Rocket,
};

export const PROGRESS_DESTINATION: AppDestination = {
  id: 'progress',
  label: 'Progress',
  description: 'What is changing in your life.',
  route: '/progress',
  match: ['/progress'],
  icon: TrendingUp,
};

/**
 * Life is the human hub for Career / Learning / Business. Those modules keep
 * their own routes and their own screens; they are simply no longer primary
 * navigation items of their own.
 */
export const LIFE_DESTINATION: AppDestination = {
  id: 'life',
  label: 'Life',
  description: 'Career, learning and business — the areas you are growing.',
  route: '/life',
  match: [
    '/life',
    '/career',
    '/learning',
    '/business',
    // Content Agency is a revenue workspace (clients · brands · projects ·
    // invoicing · analytics) over the existing business services, so it is a
    // Life → Business sub-experience rather than a separate product.
    '/content-agency',
  ],
  icon: Compass,
};

/**
 * AI is the single home for VedMoulya's intelligence: providers, the brain,
 * intelligence surfaces, memory, knowledge and context. The older technical
 * screens remain reachable (and deep-linkable) from here.
 */
export const AI_DESTINATION: AppDestination = {
  id: 'ai',
  label: 'AI',
  description: 'Your AI — providers, intelligence, memory and knowledge.',
  route: '/ai',
  match: [
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
  ],
  icon: Sparkles,
};

export const ASK_DESTINATION: AppDestination = {
  id: 'ask',
  label: 'Ask VedMoulya',
  description: 'Ask anything, or start something — your AI is always one tap away.',
  route: '',
  match: [],
  action: 'open-ai-companion',
  icon: Sparkles,
};

export const SETTINGS_DESTINATION: AppDestination = {
  id: 'settings',
  label: 'Settings',
  description: 'Account, appearance, notifications, privacy and advanced options.',
  route: '/settings',
  match: ['/settings'],
  excludesQuery: 'tab=profile',
  icon: SettingsIcon,
};

/**
 * Profile lives inside the existing Settings screen (its Profile tab) — there is
 * no duplicated profile page. The query fragment makes it a real, deep-linkable
 * destination with its own active state.
 */
export const PROFILE_DESTINATION: AppDestination = {
  id: 'profile',
  label: 'Profile',
  description: 'Your identity, goals and public presence.',
  route: '/settings?tab=profile',
  match: ['/settings'],
  requiresQuery: 'tab=profile',
  icon: UserRound,
};

/** The five life destinations, in navigation order. */
export const PRIMARY_DESTINATIONS: readonly AppDestination[] = [
  HOME_DESTINATION,
  MISSIONS_DESTINATION,
  PROGRESS_DESTINATION,
  LIFE_DESTINATION,
  AI_DESTINATION,
];

/** System destinations, shown at the bottom of the sidebar. */
export const SYSTEM_DESTINATIONS: readonly AppDestination[] = [
  SETTINGS_DESTINATION,
  PROFILE_DESTINATION,
];

export const ALL_DESTINATIONS: readonly AppDestination[] = [
  ...PRIMARY_DESTINATIONS,
  ASK_DESTINATION,
  ...SYSTEM_DESTINATIONS,
];

// ── Active state ────────────────────────────────────────────────────────────

/** Does `pathname` belong to this destination's owned prefixes? */
function matchesPath(destination: AppDestination, pathname: string): boolean {
  return destination.match.some((prefix) =>
    prefix === '/' ? pathname === '/' : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function matchesQuery(destination: AppDestination, search: string): boolean {
  if (destination.requiresQuery !== undefined && !search.includes(destination.requiresQuery)) {
    return false;
  }
  if (destination.excludesQuery !== undefined && search.includes(destination.excludesQuery)) {
    return false;
  }
  return true;
}

/**
 * Is this destination the one the URL is currently on?
 * `search` is the raw query string (e.g. `?tab=profile`); pass '' when unknown.
 */
export function isDestinationActive(
  destination: AppDestination,
  pathname: string,
  search = '',
): boolean {
  if (destination.action !== undefined) return false;
  if (destination.match.length === 0) return false;
  return matchesPath(destination, pathname) && matchesQuery(destination, search);
}

/**
 * The destination that owns this URL. Longest matching prefix wins; the
 * query-aware Profile/Settings pair is resolved by `requiresQuery`.
 * Falls back to Home (the shell always has a sensible current place).
 */
export function destinationForPathname(pathname: string, search = ''): AppDestination {
  let best: AppDestination | undefined;
  let bestLength = -1;
  for (const destination of ALL_DESTINATIONS) {
    if (!isDestinationActive(destination, pathname, search)) continue;
    const longest = Math.max(...destination.match.map((prefix) => prefix.length));
    if (longest > bestLength) {
      best = destination;
      bestLength = longest;
    }
  }
  return best ?? HOME_DESTINATION;
}

// ── Mobile destinations ─────────────────────────────────────────────────────

export type MobileDestinationId = 'home' | 'missions' | 'progress' | 'ai' | 'more';

export interface MobileDestination {
  id: MobileDestinationId;
  label: string;
  /** Empty for `more` — it opens the More sheet instead of navigating. */
  route: string;
  icon: LucideIcon;
}

/**
 * Home · Missions · Progress · AI · More.
 * Life deliberately lives under More: it is a hub of three areas, and the
 * bottom bar must stay five reachable targets on a small screen.
 */
const HOME_MOBILE_DESTINATION: MobileDestination = {
  id: 'home',
  label: 'Home',
  route: '/',
  icon: Home,
};

const MORE_MOBILE_DESTINATION: MobileDestination = {
  id: 'more',
  label: 'More',
  route: '',
  icon: Menu,
};

export const MOBILE_DESTINATIONS: readonly MobileDestination[] = [
  HOME_MOBILE_DESTINATION,
  { id: 'missions', label: 'Missions', route: '/autonomous-builder', icon: Rocket },
  { id: 'progress', label: 'Progress', route: '/progress', icon: TrendingUp },
  { id: 'ai', label: 'AI', route: '/ai', icon: Sparkles },
  MORE_MOBILE_DESTINATION,
];

/** A plain link (not a destination) — used by hubs and the mobile More sheet. */
export interface NavLink {
  label: string;
  route: string;
  description: string;
  icon: LucideIcon;
}

/** Everything else, one tap deep, behind More (and used by the Life hub). */
export const MOBILE_MORE_LINKS: readonly NavLink[] = [
  {
    label: 'Life',
    route: '/life',
    description: 'Career, learning and business in one place.',
    icon: Compass,
  },
  {
    label: 'Career',
    route: '/career',
    description: 'Your career goals and progress.',
    icon: BarChart3,
  },
  {
    label: 'Learning',
    route: '/learning',
    description: 'What you are learning next.',
    icon: Layers,
  },
  {
    label: 'Business',
    route: '/business',
    description: 'Ventures, clients and results.',
    icon: Target,
  },
  {
    label: 'Marketplace',
    route: '/marketplace',
    description: 'Capabilities and skills you can add.',
    icon: Store,
  },
];

/**
 * Which bottom tab owns this URL? Primary destinations map to their tab;
 * everything else (career, learning, settings, a mission detail page, …) is
 * reached through More, which is honest about being a container.
 */
export function mobileDestinationForPathname(pathname: string, search = ''): MobileDestination {
  const destination = destinationForPathname(pathname, search);
  const tab = MOBILE_DESTINATIONS.find((candidate) => candidate.id === destination.id);
  return tab ?? MORE_MOBILE_DESTINATION;
}

export function mobileDestinationById(id: MobileDestinationId): MobileDestination {
  return (
    MOBILE_DESTINATIONS.find((destination) => destination.id === id) ?? HOME_MOBILE_DESTINATION
  );
}

export function isMobileDestinationId(
  value: string | null | undefined,
): value is MobileDestinationId {
  return MOBILE_DESTINATIONS.some((destination) => destination.id === value);
}

// ── Owned children (UX-01 / UX-02 / UX-05) ──────────────────────────────────

/**
 * The canonical route that opens a mission's OPERATIONAL detail.
 *
 * /missions is the history / discovery surface; an individual mission is
 * observed and controlled at /autonomous-builder?mission={id} (the existing
 * canonical operational experience). This helper exists so every surface links
 * to the SAME place instead of re-inventing the query string.
 *
 * Returns null when there is no real mission id — callers must fall back to the
 * Missions landing page rather than fabricating an id.
 */
export function missionDetailRoute(missionId: string | null | undefined): string | null {
  const id = typeof missionId === 'string' ? missionId.trim() : '';
  if (id.length === 0) return null;
  return `/autonomous-builder?mission=${encodeURIComponent(id)}`;
}

/**
 * The human-facing parent of a route, derived from the SAME destination match
 * table used for active state — so a page can never claim a hierarchy the
 * navigation disagrees with.
 *
 * "Is its own landing page" is decided by the destination's canonical `route`,
 * NOT by the match prefixes (a prefix entry declares ownership of a subtree,
 * not that the exact path is the destination's home). `/career` is therefore
 * reported as owned by Life, while `/life` reports no parent.
 *
 * Returns null when the route is a destination's own landing route.
 */
export function owningDestinationForPathname(pathname: string, search = ''): AppDestination | null {
  const owner = destinationForPathname(pathname, search);
  if (owner.action !== undefined) return null;
  if (owner.route === pathname) return null;
  return owner;
}
