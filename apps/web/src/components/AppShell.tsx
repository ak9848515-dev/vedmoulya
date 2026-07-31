// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Application Shell
// Layout shell: Sidebar + Topbar + Main Content Area + AI Panel
// Uses @vedmoulya/ui components: Sidebar, NavBar, Breadcrumb
// BLD-016-A — Application Shell & Foundation
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Sidebar, NavBar, Breadcrumb, useTheme } from '@vedmoulya/ui';
import {
  LayoutDashboard,
  Briefcase,
  BookOpen,
  BarChart3,
  Store,
  Lightbulb,
  Search,
  PanelRightOpen,
  Bell,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  useNavigationStore,
  buildSidebarGroups,
  type NavSectionId,
} from '../stores/navigation-store.js';
import { useUIStore } from '../stores/ui-store.js';
import { CommandPalette } from './CommandPalette.js';
import { ErrorBoundary } from './ErrorBoundary.js';

// ── Lazy Loaded Components ─────────────────────────────────────────────────

const NotificationsDrawer = dynamic(
  () => import('./NotificationsDrawer.js').then((mod) => ({ default: mod.NotificationsDrawer })),
  {
    ssr: false,
    loading: () => null,
  },
);

const AICompanion = dynamic(
  () => import('./AICompanion.js').then((mod) => ({ default: mod.AICompanion })),
  {
    ssr: false,
    loading: () => null,
  },
);

// ── Module Icon Map ─────────────────────────────────────────────────────────

const moduleIcons: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard className="h-5 w-5" />,
  insights: <Lightbulb className="h-5 w-5" />,
  search: <Search className="h-5 w-5" />,
  career: <Briefcase className="h-5 w-5" />,
  learning: <BookOpen className="h-5 w-5" />,
  business: <BarChart3 className="h-5 w-5" />,
  marketplace: <Store className="h-5 w-5" />,
};

// ── AppShell Props ──────────────────────────────────────────────────────────

export interface AppShellProps {
  children: React.ReactNode;
}

// ── AppShell Component ──────────────────────────────────────────────────────

export function AppShell({ children }: AppShellProps): React.JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const {
    activeSection,
    sidebarCollapsed,
    mobileSidebarOpen,
    breadcrumbs,
    setActiveSection,
    toggleSidebar,
    setMobileSidebarOpen,
  } = useNavigationStore();

  const { toggleAiPanel, setGlobalSearchOpen, setNotificationsPanelOpen } = useUIStore();

  // ── Navigation Handler ─────────────────────────────────────────────────
  const handleNavigate = (section: NavSectionId): void => {
    setActiveSection(section);
    setMobileSidebarOpen(false);
  };

  // ── Sidebar Groups ────────────────────────────────────────────────────
  const groups = buildSidebarGroups(activeSection, handleNavigate);

  // ── Enrich sidebar items with icons ───────────────────────────────────
  const enrichedGroups = groups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      icon: moduleIcons[item.id],
    })),
  }));

  // ── Logo ──────────────────────────────────────────────────────────────
  const logo = (
    <span className="text-[18px] font-bold font-heading text-[#2B5FD9] tracking-tight">
      {sidebarCollapsed ? 'V' : 'VedMoulya'}
    </span>
  );

  // ── Sidebar collapse handler ──────────────────────────────────────────
  const handleToggleCollapse = (): void => {
    toggleSidebar();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F7FA]">
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <div
        className={`
          fixed inset-y-0 left-0 z-30
          transition-transform duration-250 ease-out
          md:relative md:translate-x-0
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar
          groups={enrichedGroups}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
          className="h-full"
        />
      </div>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-[rgba(15,23,42,0.5)] md:hidden"
          onClick={handleCloseMobileOverlay}
          aria-hidden="true"
        />
      )}

      {/* ── Main Content Area ────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* ── Topbar ──────────────────────────────────────────────────── */}
        <NavBar
          logo={logo}
          leftItems={
            <button
              onClick={handleToggleCollapse}
              className="p-2 rounded-lg hover:bg-[#F1F5F9] transition-colors"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!sidebarCollapsed}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4 text-[#64748B]" />
              ) : (
                <ChevronLeft className="h-4 w-4 text-[#64748B]" />
              )}
            </button>
          }
          rightItems={
            <>
              <button
                onClick={handleSearchClick}
                className="p-2 rounded-lg hover:bg-[#F1F5F9] transition-colors"
                aria-label="Search"
              >
                <Search className="h-5 w-5 text-[#64748B]" />
              </button>

              <button
                onClick={handleNotificationsClick}
                className="p-2 rounded-lg hover:bg-[#F1F5F9] transition-colors relative"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5 text-[#64748B]" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#EF4444] rounded-full" />
              </button>

              <button
                onClick={handleThemeToggle}
                className="p-2 rounded-lg hover:bg-[#F1F5F9] transition-colors"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? (
                  <Sun className="h-5 w-5 text-[#64748B]" />
                ) : (
                  <Moon className="h-5 w-5 text-[#64748B]" />
                )}
              </button>

              <button
                onClick={handleAiPanelClick}
                className="p-2 rounded-lg hover:bg-[#F5F3FF] transition-colors"
                aria-label="Open AI Companion"
              >
                <PanelRightOpen className="h-5 w-5 text-[#7C3AED]" />
              </button>
            </>
          }
        />

        {/* ── Breadcrumb + Page Content ───────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="content-container py-6">
            {/* Breadcrumb */}
            <div className="mb-6">
              <Breadcrumb items={breadcrumbs} />
            </div>

            {/* Page Content */}
            <main>
              <ErrorBoundary section="page">{children}</ErrorBoundary>
            </main>
          </div>
        </div>
      </div>

      {/* ── AI Companion Panel ─────────────────────────────────────── */}
      <AICompanion />

      {/* ── Command Palette ──────────────────────────────────────────── */}
      <CommandPalette />

      {/* ── Notification Center ──────────────────────────────────────── */}
      <NotificationsDrawer />
    </div>
  );

  // ── Extracted event handlers (for ESLint: no-confusing-void-expression) ─
  function handleSearchClick(): void {
    setGlobalSearchOpen(true);
  }

  function handleNotificationsClick(): void {
    setNotificationsPanelOpen(true);
  }

  function handleThemeToggle(): void {
    toggleTheme();
  }

  function handleAiPanelClick(): void {
    toggleAiPanel();
  }

  function handleCloseMobileOverlay(): void {
    setMobileSidebarOpen(false);
  }
}
