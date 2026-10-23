// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Navigation reachability guard (LEARN-REVENUE-002)
//
// REVENUE-002 found the earning surface shipped but unreachable: the model
// declared /content-agency as Life-owned, the ownership tests passed, and NO
// screen linked to it. Ownership is not reachability.
//
// This test closes that blind spot: every STATIC route the navigation model
// claims to own (/revenue included) must have at least one inbound reference
// from outside its own subtree — a link, a redirect, or a navigation entry
// (destination `route`, mobile "More" link, command-palette / AI-hub entry).
//
// KNOWN_ORPHANS is a ratchet, not a waiver: it lists routes that were ALREADY
// orphaned when this guard landed, so the suite is honest today. Adding a new
// orphan fails the build; linking a listed route also fails until its entry is
// removed, so the list can only ever shrink.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_DESTINATIONS, MOBILE_MORE_LINKS, type AppDestination } from '../navigation-model.js';

/** apps/web/src — the root that pages and links are read from. */
const SRC_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const APP_ROOT = join(SRC_ROOT, 'app');

/**
 * Routes that were already orphaned before this guard existed, with the reason
 * each one is still unreachable. This is a ratchet, not a waiver: never add a
 * route here to make a new surface pass — link it instead. Linking one of these
 * fails the shrinking test until its entry is deleted.
 */
const KNOWN_ORPHANS: ReadonlyMap<string, string> = new Map([
  [
    '/applications',
    'Application Factory: deep-linkable only. Needs an entry from Missions (not an earning surface).',
  ],
  [
    '/content-agency',
    'Client-ops earning workspace (proposals, quotations, invoices, payments): audit REVENUE-002 §4 — needs one entry from Business or Life.',
  ],
  [
    '/missions',
    'Mission history: /autonomous-builder is the Missions destination; this history page still needs a link from it.',
  ],
]);

// ── Route discovery ────────────────────────────────────────────────────────

function walk(dir: string, visit: (file: string) => void): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      walk(full, visit);
    } else {
      visit(full);
    }
  }
}

/** Route for an App Router page directory, or null for dynamic routes. */
function routeForPageDir(pageDir: string): string | null {
  const relativeDir = relative(APP_ROOT, pageDir);
  const segments = relativeDir === '' ? [] : relativeDir.split(sep);
  // Route groups `(marketing)` and private folders `_components` add no URL.
  const urlSegments = segments.filter(
    (segment) => !(segment.startsWith('(') && segment.endsWith(')')) && !segment.startsWith('_'),
  );
  // Dynamic routes cannot be linked with a static literal — skip them.
  if (urlSegments.some((segment) => segment.includes('['))) return null;
  return `/${urlSegments.join('/')}`.replace(/\/$/, '') || '/';
}

function pageRoutes(): string[] {
  const routes: string[] = [];
  walk(APP_ROOT, (file) => {
    if (file.endsWith(`${sep}page.tsx`)) {
      const route = routeForPageDir(file.slice(0, -`${sep}page.tsx`.length));
      if (route !== null) routes.push(route);
    }
  });
  return routes.sort();
}

// ── Owned routes (from the one navigation model) ───────────────────────────

function ownedRoutes(destinations: readonly AppDestination[]): string[] {
  const owned = new Set<string>();
  for (const destination of destinations) {
    if (destination.route.startsWith('/')) owned.add(destination.route);
    for (const prefix of destination.match) {
      if (prefix.startsWith('/') && prefix !== '/') owned.add(prefix);
    }
  }
  for (const link of MOBILE_MORE_LINKS) {
    if (link.route.startsWith('/')) owned.add(link.route);
  }
  return [...owned].sort();
}

// ── Inbound references ─────────────────────────────────────────────────────

const LINK_PATTERNS = [
  // href="/route" · href='/route' · href={`/route`}
  /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*['"`]([^'"`]*)['"`]\s*\})/g,
  // router.push('/route') · router.replace('/route')
  /\b(?:router|Router)\.(?:push|replace)\(\s*['"`]([^'"`]+)['"`]/g,
  // Navigation entries: { route: '/route' } (palette, AI hub, model links)
  /\broute:\s*['"`]([^'"`]+)['"`]/g,
];

function normalize(reference: string): string | null {
  if (!reference.startsWith('/')) return null;
  if (reference.includes('${')) return null; // dynamic template — not a static link
  const path = reference.split('#')[0]?.split('?')[0] ?? '';
  const trimmed = path.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

interface Reference {
  route: string;
  /** Source file that references the route. */
  file: string;
}

function sourceFiles(): string[] {
  const files: string[] = [];
  walk(SRC_ROOT, (file) => {
    if (!/\.(ts|tsx)$/.test(file)) return;
    if (/\.test\.(ts|tsx)$/.test(file)) return;
    files.push(file);
  });
  return files;
}

function referencesIn(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const found: string[] = [];
  for (const pattern of LINK_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      for (const capture of match.slice(1)) {
        if (capture === undefined) continue;
        const route = normalize(capture);
        if (route !== null) found.push(route);
      }
    }
  }
  return found;
}

/**
 * Is `route` linked from anywhere OUTSIDE its own page subtree? A screen that
 * only links to itself is still unreachable from navigation.
 */
function hasInboundLink(route: string, references: readonly Reference[]): boolean {
  const ownSubtree =
    route === '/' ? join(APP_ROOT, 'page.tsx') : join(APP_ROOT, route.slice(1), sep);
  return references.some((reference) => {
    if (reference.route !== route) return false;
    if (route === '/') return true;
    return !reference.file.startsWith(ownSubtree);
  });
}

// ── The guard ──────────────────────────────────────────────────────────────

describe('navigation reachability', () => {
  const routes = pageRoutes();
  const owned = ownedRoutes(ALL_DESTINATIONS).filter((route) => routes.includes(route));
  const references: Reference[] = sourceFiles().flatMap((file) =>
    referencesIn(file).map((route) => ({ route, file })),
  );

  it('finds the routes and the navigation model entries', () => {
    // Sanity: a broken scanner must fail loudly, not pass vacuously.
    expect(routes).toContain('/revenue');
    expect(owned).toContain('/revenue');
    expect(owned.length).toBeGreaterThan(10);
  });

  it('every owned route has an inbound link unless it is a known orphan', () => {
    const orphans = owned.filter(
      (route) => !hasInboundLink(route, references) && !KNOWN_ORPHANS.has(route),
    );

    expect(
      orphans,
      `Owned routes with no inbound entry (declare a link/nav entry, do not own an unreachable screen):\n` +
        orphans.map((route) => `  · ${route}`).join('\n'),
    ).toEqual([]);
  });

  it('really detects orphans — the scanner is not passing vacuously', () => {
    const detected = owned.filter((route) => !hasInboundLink(route, references));

    // Every allowlisted route must still be detected as unreachable, otherwise
    // the detector (not just the allowlist) is broken.
    expect(detected).toEqual(expect.arrayContaining([...KNOWN_ORPHANS.keys()]));
  });

  it('keeps the known-orphan list shrinking', () => {
    const nowReachable = [...KNOWN_ORPHANS.keys()].filter(
      (route) => !owned.includes(route) || hasInboundLink(route, references),
    );

    expect(
      nowReachable,
      `These routes are now reachable (or gone) — remove them from KNOWN_ORPHANS:\n` +
        nowReachable.map((route) => `  · ${route}`).join('\n'),
    ).toEqual([]);
  });
});
