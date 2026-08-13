// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Mobile Navigation Model (MOB-002)
// Bottom-tab configuration, pathname ↔ tab mapping, last-visited persistence
// and deep-link resolution. Pure functions only — trivially unit-testable and
// reused by the MobileTabBar component and the AppShell restore logic.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, BookOpen, Briefcase, Store, Settings, PenSquare } from 'lucide-react';

// ── Tab Model ───────────────────────────────────────────────────────────────

export type MobileTabId =
  'dashboard' | 'learning' | 'career' | 'marketplace' | 'content-agency' | 'settings';

export interface MobileTab {
  id: MobileTabId;
  label: string;
  /** Client-side route this tab owns. */
  route: string;
  icon: LucideIcon;
  /** Tabs that resolve a bare "/" launch to them (deep-link + restore). */
  isRootRestorable?: boolean;
}

export const MOBILE_TABS: readonly MobileTab[] = [
  { id: 'dashboard', label: 'Dashboard', route: '/', icon: LayoutDashboard },
  { id: 'learning', label: 'Learning', route: '/learning', icon: BookOpen },
  { id: 'career', label: 'Career', route: '/career', icon: Briefcase },
  { id: 'marketplace', label: 'Marketplace', route: '/marketplace', icon: Store },
  { id: 'content-agency', label: 'Agency', route: '/content-agency', icon: PenSquare },
  { id: 'settings', label: 'Settings', route: '/settings', icon: Settings },
] as const;

const DASHBOARD_TAB: MobileTab = {
  id: 'dashboard',
  label: 'Dashboard',
  route: '/',
  icon: LayoutDashboard,
};

// ── Persistence ─────────────────────────────────────────────────────────────

const LAST_TAB_KEY = 'vedmoulya-last-tab';

/** Persist the last visited tab so app restarts can restore it. */
export function persistLastTab(tab: MobileTabId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_TAB_KEY, tab);
  } catch {
    // Storage unavailable (private mode) — restoration is best-effort.
  }
}

/** Read the persisted last tab; null when none or invalid. */
export function readLastTab(): MobileTabId | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_TAB_KEY);
    return isMobileTabId(raw) ? raw : null;
  } catch {
    return null;
  }
}

// ── Mapping ─────────────────────────────────────────────────────────────────

export function isMobileTabId(value: string | null | undefined): value is MobileTabId {
  return MOBILE_TABS.some((tab) => tab.id === value);
}

/** Map a pathname to its owning tab (deep links). Falls back to dashboard. */
export function tabForPathname(pathname: string): MobileTab {
  if (pathname.startsWith('/learning')) return tabById('learning');
  if (pathname.startsWith('/career')) return tabById('career');
  if (pathname.startsWith('/marketplace')) return tabById('marketplace');
  if (pathname.startsWith('/content-agency')) return tabById('content-agency');
  if (pathname.startsWith('/settings')) return tabById('settings');
  return tabById('dashboard');
}

export function tabById(id: MobileTabId): MobileTab {
  return MOBILE_TABS.find((tab) => tab.id === id) ?? DASHBOARD_TAB;
}

/**
 * Resolve the target tab for a fresh app launch.
 *  - Explicit deep link (pathname !== '/') → that pathname's tab.
 *  - Bare launch ('/') → the previously visited tab (state preservation),
 *    unless the user never visited a tab before (first launch → dashboard).
 * Returns null when no restore should happen (first launch).
 */
export function resolveLaunchTab(pathname: string): { tab: MobileTab; restore: boolean } {
  if (pathname !== '/') {
    return { tab: tabForPathname(pathname), restore: false };
  }
  const last = readLastTab();
  if (last) {
    return { tab: tabById(last), restore: true };
  }
  return { tab: tabById('dashboard'), restore: false };
}
