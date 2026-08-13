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
  | 'dashboard'
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
  | 'insights'
  | 'search'
  | 'settings';

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
        {
          id: 'settings',
          label: 'Settings',
          active: activeSection === 'settings',
          onClick: (): void => {
            onNavigate('settings');
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
        {
          id: 'capabilities',
          label: 'Capability Registry',
          active: activeSection === 'capabilities',
          onClick: (): void => {
            onNavigate('capabilities');
          },
        },
        {
          id: 'capability-marketplace',
          label: 'AI Capability Marketplace',
          active: activeSection === 'capability-marketplace',
          onClick: (): void => {
            onNavigate('capability-marketplace');
          },
        },
        {
          id: 'providers',
          label: 'Provider Registry',
          active: activeSection === 'providers',
          onClick: (): void => {
            onNavigate('providers');
          },
        },
        {
          id: 'context',
          label: 'Context Intelligence',
          active: activeSection === 'context',
          onClick: (): void => {
            onNavigate('context');
          },
        },
        {
          id: 'execution-strategy',
          label: 'Execution Strategy',
          active: activeSection === 'execution-strategy',
          onClick: (): void => {
            onNavigate('execution-strategy');
          },
        },
        {
          id: 'execution',
          label: 'Execution Orchestrator',
          active: activeSection === 'execution',
          onClick: (): void => {
            onNavigate('execution');
          },
        },
        {
          id: 'goals',
          label: 'Goal & Task Intelligence',
          active: activeSection === 'goals',
          onClick: (): void => {
            onNavigate('goals');
          },
        },
        {
          id: 'intelligence',
          label: 'Enterprise Intelligence',
          active: activeSection === 'intelligence',
          onClick: (): void => {
            onNavigate('intelligence');
          },
        },
        {
          id: 'ecosystem-intelligence',
          label: 'Ecosystem Intelligence',
          active: activeSection === 'ecosystem-intelligence',
          onClick: (): void => {
            onNavigate('ecosystem-intelligence');
          },
        },
        {
          id: 'learning-intelligence',
          label: 'Learning Intelligence',
          active: activeSection === 'learning-intelligence',
          onClick: (): void => {
            onNavigate('learning-intelligence');
          },
        },
        {
          id: 'enterprise-brain',
          label: 'Enterprise Brain',
          active: activeSection === 'enterprise-brain',
          onClick: (): void => {
            onNavigate('enterprise-brain');
          },
        },
        {
          id: 'brain',
          label: 'VedMoulya Brain',
          active: activeSection === 'brain',
          onClick: (): void => {
            onNavigate('brain');
          },
        },
        {
          id: 'live-intelligence',
          label: 'Live Intelligence Bridge',
          active: activeSection === 'live-intelligence',
          onClick: (): void => {
            onNavigate('live-intelligence');
          },
        },
        {
          id: 'knowledge',
          label: 'Knowledge Intelligence',
          active: activeSection === 'knowledge',
          onClick: (): void => {
            onNavigate('knowledge');
          },
        },
        {
          id: 'memory',
          label: 'Memory Intelligence',
          active: activeSection === 'memory',
          onClick: (): void => {
            onNavigate('memory');
          },
        },
        {
          id: 'os',
          label: 'Operating System',
          active: activeSection === 'os',
          onClick: (): void => {
            onNavigate('os');
          },
        },
        {
          id: 'context-fabric',
          label: 'Context Fabric',
          active: activeSection === 'context-fabric',
          onClick: (): void => {
            onNavigate('context-fabric');
          },
        },
        {
          id: 'loop',
          label: 'AI Loop Engine',
          active: activeSection === 'loop',
          onClick: (): void => {
            onNavigate('loop');
          },
        },
        {
          id: 'applications',
          label: 'Application Factory',
          active: activeSection === 'applications',
          onClick: (): void => {
            onNavigate('applications');
          },
        },
        {
          id: 'content-agency',
          label: 'Content Agency',
          active: activeSection === 'content-agency',
          onClick: (): void => {
            onNavigate('content-agency');
          },
        },
      ],
    },
  ];
}
