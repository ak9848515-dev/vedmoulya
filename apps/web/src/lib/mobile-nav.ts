// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Mobile Navigation Model (MOB-002 · re-based on UX-01/UX-02)
//
// Thin, testable bridge between the ONE information architecture
// (`navigation-model.ts`) and the mobile shell: bottom-tab resolution, deep-link
// mapping, last-visited persistence and launch restore.
//
// The tabs are now Home · Missions · Progress · AI · More. Career, Learning,
// Business, Marketplace, Settings and Profile live inside the More sheet — they
// keep their own routes and screens, they simply stop competing for the five
// precious slots on a phone.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import {
  MOBILE_DESTINATIONS,
  isMobileDestinationId,
  mobileDestinationById,
  mobileDestinationForPathname,
  type MobileDestination,
  type MobileDestinationId,
} from './navigation-model.js';

/** @deprecated Prefer `MobileDestinationId` (UX-01 vocabulary). */
export type MobileTabId = MobileDestinationId;

/** @deprecated Prefer `MobileDestination`. */
export type MobileTab = MobileDestination;

/** The bottom-tab destinations, in order. */
export const MOBILE_TABS: readonly MobileDestination[] = MOBILE_DESTINATIONS;

// ── Persistence ─────────────────────────────────────────────────────────────

const LAST_TAB_KEY = 'vedmoulya-last-tab';

/** Persist the last visited tab so app restarts can restore it. */
export function persistLastTab(tab: MobileDestinationId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_TAB_KEY, tab);
  } catch {
    // Storage unavailable (private mode) — restoration is best-effort.
  }
}

/** Read the persisted last tab; null when none or invalid. */
export function readLastTab(): MobileDestinationId | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_TAB_KEY);
    return isMobileDestinationId(raw) ? raw : null;
  } catch {
    return null;
  }
}

// ── Mapping ─────────────────────────────────────────────────────────────────

export function isMobileTabId(value: string | null | undefined): value is MobileDestinationId {
  return isMobileDestinationId(value);
}

/** Map a pathname to its owning tab (deep links). Falls back to More. */
export function tabForPathname(pathname: string, search = ''): MobileDestination {
  return mobileDestinationForPathname(pathname, search);
}

export function tabById(id: MobileDestinationId): MobileDestination {
  return mobileDestinationById(id);
}

/**
 * True when a tab is somewhere the user can actually be sent. The More tab is a
 * container, so it must never be restored as a destination.
 */
function isRestorableTab(tab: MobileDestination): boolean {
  return tab.id !== 'more' && tab.route !== '';
}

/**
 * Resolve the target tab for a fresh launch.
 *  - Explicit deep link (pathname !== '/') → that pathname's tab.
 *  - Bare launch ('/') → the previously visited tab (state preservation),
 *    unless the user never visited one (first launch → Home).
 * Returns null-ish `restore: false` when no restore should happen.
 */
export function resolveLaunchTab(pathname: string): { tab: MobileDestination; restore: boolean } {
  if (pathname !== '/') {
    return { tab: tabForPathname(pathname), restore: false };
  }
  const last = readLastTab();
  if (last) {
    const tab = tabById(last);
    if (isRestorableTab(tab) && tab.route !== '/') {
      return { tab, restore: true };
    }
  }
  return { tab: tabById('home'), restore: false };
}
