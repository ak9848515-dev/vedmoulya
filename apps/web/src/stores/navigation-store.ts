// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Navigation Store (Zustand)
// Manages sidebar navigation state for the Life OS Web Application
// BLD-016-A — Application Shell & Foundation
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { create } from 'zustand';
import type { SidebarGroup } from '@vedmoulya/ui';

// ── Navigation Item Types ───────────────────────────────────────────────────

export type NavSectionId =
  'dashboard' | 'career' | 'learning' | 'business' | 'marketplace' | 'insights' | 'search';

export interface NavSection {
  id: NavSectionId;
  label: string;
  icon: string;
  route: string;
  badge?: number;
  isActive: boolean;
}

// ── Navigation Store ────────────────────────────────────────────────────────

interface NavigationState {
  /** Currently active section */
  activeSection: NavSectionId;
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
  activeSection: 'dashboard',
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  breadcrumbs: [{ label: 'Dashboard' }],

  // ── Actions (braces required for ESLint: no-confusing-void-expression) ──
  setActiveSection: (section: NavSectionId): void => {
    set({ activeSection: section });
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

export function buildSidebarGroups(
  activeSection: NavSectionId,
  onNavigate: (section: NavSectionId) => void,
): SidebarGroup[] {
  return [
    {
      label: 'Overview',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          active: activeSection === 'dashboard',
          onClick: (): void => {
            onNavigate('dashboard');
          },
        },
        {
          id: 'insights',
          label: 'Insights',
          active: activeSection === 'insights',
          onClick: (): void => {
            onNavigate('insights');
          },
        },
        {
          id: 'search',
          label: 'Search',
          active: activeSection === 'search',
          onClick: (): void => {
            onNavigate('search');
          },
        },
      ],
    },
    {
      label: 'Modules',
      items: [
        {
          id: 'career',
          label: 'Career',
          active: activeSection === 'career',
          badge: 3,
          onClick: (): void => {
            onNavigate('career');
          },
        },
        {
          id: 'learning',
          label: 'Learning',
          active: activeSection === 'learning',
          badge: 5,
          onClick: (): void => {
            onNavigate('learning');
          },
        },
        {
          id: 'business',
          label: 'Business',
          active: activeSection === 'business',
          onClick: (): void => {
            onNavigate('business');
          },
        },
        {
          id: 'marketplace',
          label: 'Marketplace',
          active: activeSection === 'marketplace',
          badge: 1,
          onClick: (): void => {
            onNavigate('marketplace');
          },
        },
      ],
    },
  ];
}
