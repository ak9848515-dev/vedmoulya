// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Navigation Store (Zustand) — UX-02
//
// Holds the shell's navigation SESSION state (sidebar collapsed, mobile drawer,
// breadcrumbs). The navigation STRUCTURE itself is no longer defined here: it is
// derived from `lib/navigation-model.ts`, the one information architecture, so
// the sidebar can never drift from the mobile tabs.
//
// Before UX-02 this file hard-coded a 28-item "Modules" list of engineering
// surfaces (Execution Orchestrator, Context Fabric, Ecosystem Intelligence …).
// Those screens all still exist — they are reached through their parent
// destination (see UX-AUDIT.md for the route map), not from primary navigation.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { create } from 'zustand';
import type { SidebarGroup } from '@vedmoulya/ui';
import {
  ASK_DESTINATION,
  PRIMARY_DESTINATIONS,
  SYSTEM_DESTINATIONS,
  destinationForPathname,
  type AppDestination,
  type AppDestinationId,
} from '../lib/navigation-model.js';

// ── Navigation Item Types ───────────────────────────────────────────────────

/**
 * The pre-UX-02 module section ids. They are NOT navigation destinations any
 * more, but the screens themselves still call `setActiveSection('<module>')` on
 * mount — so the shell keeps accepting them and resolves them to the destination
 * that now OWNS them. A legacy screen therefore highlights its real parent
 * (Application Factory → Life, Context Fabric → AI) instead of highlighting
 * nothing, and no screen had to be rewritten to satisfy navigation.
 */
export type LegacyModuleSectionId =
  | 'dashboard'
  | 'autonomous-builder'
  | 'insights'
  | 'search'
  | 'career'
  | 'learning'
  | 'business'
  | 'marketplace'
  | 'capabilities'
  | 'capability-marketplace'
  | 'providers'
  | 'context'
  | 'execution-strategy'
  | 'execution'
  | 'goals'
  | 'intelligence'
  | 'ecosystem-intelligence'
  | 'learning-intelligence'
  | 'enterprise-brain'
  | 'brain'
  | 'live-intelligence'
  | 'knowledge'
  | 'memory'
  | 'os'
  | 'context-fabric'
  | 'loop'
  | 'applications'
  | 'content-agency'
  | 'ecosystem'
  | 'settings';

export type NavSectionId = AppDestinationId | LegacyModuleSectionId;

/** The few legacy ids whose module does not have its own route to derive from. */
const LEGACY_SECTION_ALIASES = new Map<string, AppDestinationId>([
  ['dashboard', 'home'],
  ['search', 'home'],
  ['insights', 'progress'],
]);

/**
 * Resolve any legacy section id to the destination that now owns it.
 * Destination ids pass through untouched; everything else is derived from the
 * module's real route (or the small alias table above).
 */
export function destinationIdForSection(section: NavSectionId): AppDestinationId {
  const direct = [...PRIMARY_DESTINATIONS, ASK_DESTINATION, ...SYSTEM_DESTINATIONS].find(
    (destination) => destination.id === section,
  );
  if (direct) return direct.id;
  const alias = LEGACY_SECTION_ALIASES.get(section);
  if (alias !== undefined) return alias;
  return destinationForPathname(`/${section}`).id;
}

export interface NavSection {
  id: AppDestinationId;
  label: string;
  route: string;
  isActive: boolean;
}

// ── Navigation Store ────────────────────────────────────────────────────────

interface NavigationState {
  /** Currently active destination (derived from the URL by the shell). */
  activeSection: AppDestinationId;
  /** Whether the sidebar is collapsed */
  sidebarCollapsed: boolean;
  /** Mobile sidebar open state */
  mobileSidebarOpen: boolean;
  /** Breadcrumb trail */
  breadcrumbs: Array<{ label: string; href?: string }>;

  // Actions
  setActiveSection: (section: NavSectionId) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setBreadcrumbs: (crumbs: Array<{ label: string; href?: string }>) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  // ── State ───────────────────────────────────────────────────────────────
  activeSection: 'home',
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  breadcrumbs: [{ label: 'Home' }],

  // ── Actions (braces required for ESLint: no-confusing-void-expression) ──
  setActiveSection: (section: NavSectionId): void => {
    // Legacy module ids are mapped onto their owning destination so a module
    // screen and the sidebar can never disagree about where the user "is".
    set({ activeSection: destinationIdForSection(section) });
  },
  toggleSidebar: (): void => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },
  setSidebarCollapsed: (collapsed: boolean): void => {
    set({ sidebarCollapsed: collapsed });
  },
  setMobileSidebarOpen: (open: boolean): void => {
    set({ mobileSidebarOpen: open });
  },
  setBreadcrumbs: (crumbs: Array<{ label: string; href?: string }>): void => {
    set({ breadcrumbs: crumbs });
  },
}));

// ── Sidebar Groups Builder ──────────────────────────────────────────────────

const ITEM_ICON_CLASS = 'h-5 w-5';

function sidebarItem(
  destination: AppDestination,
  activeId: AppDestinationId,
  onSelect: (destination: AppDestination) => void,
): {
  id: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
} {
  return {
    id: destination.id,
    label: destination.label,
    icon: React.createElement(destination.icon, { className: ITEM_ICON_CLASS }),
    active: destination.id === activeId,
    onClick: (): void => {
      onSelect(destination);
    },
  };
}

/**
 * The desktop sidebar, in the UX-01 order:
 *
 *   Home · Missions · Progress · Life · AI
 *   ────────────────────────────────────────
 *   ✨ Ask VedMoulya
 *   ────────────────────────────────────────
 *   Settings · Profile
 *
 * Groups use an empty label (a divider, not a heading) so primary navigation
 * reads as one calm list instead of a taxonomy.
 */
export function buildSidebarGroups(
  activeId: AppDestinationId,
  onSelect: (destination: AppDestination) => void,
): SidebarGroup[] {
  return [
    {
      label: '',
      items: PRIMARY_DESTINATIONS.map((destination) =>
        sidebarItem(destination, activeId, onSelect),
      ),
    },
    {
      label: '',
      separatorBefore: true,
      items: [sidebarItem(ASK_DESTINATION, activeId, onSelect)],
    },
    {
      label: '',
      separatorBefore: true,
      items: SYSTEM_DESTINATIONS.map((destination) => sidebarItem(destination, activeId, onSelect)),
    },
  ];
}
