// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Application Shell
// Layout shell: Sidebar + Topbar + Main Content Area + AI Panel
// Uses @vedmoulya/ui components: Sidebar, NavBar, Breadcrumb
// BLD-016-A — Application Shell & Foundation
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar, NavBar, Breadcrumb, useTheme } from '@vedmoulya/ui';
import {
  Search,
  PanelRightOpen,
  Bell,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { logout } from '../auth/session-manager.js';
import { useAuthStore } from '../stores/auth-store.js';
import { isNativePlatform } from '../auth/platform.js';
import { useNavigationStore, buildSidebarGroups } from '../stores/navigation-store.js';
import { destinationForPathname, type AppDestination } from '../lib/navigation-model.js';
import { useClientSearch } from '../lib/use-client-search.js';
import { useUIStore } from '../stores/ui-store.js';
import { AIWorldBell } from './AIWorldBell.js';
import { CommandPalette } from './CommandPalette.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import { MobileTabBar } from './MobileTabBar.js';
import { OfflineBanner } from './OfflineBanner.js';
import { resolveLaunchTab, persistLastTab, tabForPathname } from '../lib/mobile-nav.js';
import { useNetworkStatus } from '../lib/use-network-status.js';
import { configureNativeChrome, installBackButtonHandler, exitNativeApp } from '../lib/native.js';

// ── Lazy Loaded Components ─────────────────────────────────────────────────

const NotificationsDrawer = dynamic(
  () => import('./NotificationsDrawer.js').then((mod) => ({ default: mod.NotificationsDrawer })),
  {
    ssr: false,
    loading: () => null,
  },
);

const AIWorldDrawer = dynamic(
  () => import('./ai-world/AIWorldDrawer.js').then((mod) => ({ default: mod.AIWorldDrawer })),
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

const OllamaFirstRunDialog = dynamic(
  () => import('./OllamaFirstRunDialog.js').then((mod) => ({ default: mod.OllamaFirstRunDialog })),
  {
    ssr: false,
    loading: () => null,
  },
);

const GeminiFirstRunDialog = dynamic(
  () => import('./GeminiFirstRunDialog.js').then((mod) => ({ default: mod.GeminiFirstRunDialog })),
  {
    ssr: false,
    loading: () => null,
  },
);

// Navigation STRUCTURE and iconography now live in `lib/navigation-model.ts`
// (the one information architecture) — the shell only decides what a selection
// DOES, so a nav change can never be half-applied here.

// ── AppShell Props ──────────────────────────────────────────────────────────

export interface AppShellProps {
  children: React.ReactNode;
}

// ── AppShell Component ──────────────────────────────────────────────────────

export function AppShell({ children }: AppShellProps): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const { user } = useAuthStore();
  const {
    sidebarCollapsed,
    mobileSidebarOpen,
    breadcrumbs,
    setActiveSection,
    setBreadcrumbs,
    toggleSidebar,
    setMobileSidebarOpen,
  } = useNavigationStore();

  // ── Active destination (DERIVED from the URL, never from click state) ────
  // Deep links, refreshes and back/forward all highlight the right destination
  // because the URL is the truth. The query string matters for the one pair of
  // destinations that share a route (Settings vs Profile).
  const clientSearch = useClientSearch(pathname);
  const activeDestination = destinationForPathname(pathname, clientSearch);

  // MOB-002: mirror device connectivity into the auth store's offline flag
  // (also flips it back to online on reconnect → auto-recovery).
  useNetworkStatus();

  const { toggleAiPanel, setGlobalSearchOpen, setNotificationsPanelOpen } = useUIStore();

  // MOB-002 — native chrome + back policy + launch-tab restore (native only,
  // so the web app keeps classic refresh behavior).
  useEffect(() => {
    configureNativeChrome({ statusBarStyle: resolvedTheme });
  }, [resolvedTheme]);

  useEffect(() => {
    if (!isNativePlatform()) return;

    installBackButtonHandler({
      onBack: () => {
        if (window.history.length > 1) {
          router.back();
        }
      },
      onExit: () => {
        exitNativeApp();
      },
      isRoot: () => tabForPathname(window.location.pathname).id === 'home',
    });

    // State preservation: a bare "/" launch resumes the last visited tab.
    const { tab, restore } = resolveLaunchTab(window.location.pathname);
    if (restore && tab.route !== '/') {
      router.replace(tab.route);
    }
  }, [router]);

  // Persist the current tab so app restarts restore the previous page.
  useEffect(() => {
    const tab = tabForPathname(pathname, clientSearch);
    persistLastTab(tab.id);
  }, [pathname, clientSearch]);

  // Keep the store's session view (active section + breadcrumb) in step with
  // the URL — consumers read from here, so it must never lag the route.
  useEffect(() => {
    setActiveSection(activeDestination.id);
    setBreadcrumbs([{ label: activeDestination.label }]);
  }, [activeDestination, setActiveSection, setBreadcrumbs]);

  // Auth screens (login / signup / OAuth callback) and the client portal
  // (AC-002, Module 7) render full-screen without the app chrome (MOB-001).
  // Unauthenticated routes must never expose the sidebar or topbar.
  if (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/verify-email') ||
    pathname.startsWith('/oauth2redirect') ||
    pathname.startsWith('/portal')
  ) {
    return <>{children}</>;
  }

  // ── Navigation Handler ─────────────────────────────────────────────────
  // A destination either opens an existing panel (✨ Ask VedMoulya → the AI
  // Companion that already exists) or navigates to its route. Routes are never
  // invented here — they come from the navigation model.
  const handleSelectDestination = (destination: AppDestination): void => {
    setMobileSidebarOpen(false);
    if (destination.action === 'open-ai-companion') {
      toggleAiPanel();
      return;
    }
    if (destination.route !== '' && `${pathname}${clientSearch}` !== destination.route) {
      router.push(destination.route);
    }
  };

  // ── Sidebar Groups (derived from the one navigation model) ────────────
  const groups = buildSidebarGroups(activeDestination.id, handleSelectDestination);

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
    <div className="flex h-screen overflow-hidden bg-[#F5F7FA] dark:bg-[#0F172A]">
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
          groups={groups}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
          className="h-full dark:bg-[#0F172A] dark:border-[#334155]"
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
        {/* pt-safe keeps the topbar below the status bar on edge-to-edge
            Android 15+; background matches the NavBar (MOB-002). */}
        <div className="pt-safe bg-white dark:bg-[#0F172A]">
          <NavBar
            className="dark:bg-[#0F172A] dark:border-[#334155]"
            logo={logo}
            mobileActions={
              <button
                onClick={handleAiPanelClick}
                className="p-2 rounded-lg hover:bg-[#F5F3FF] transition-colors"
                aria-label="Open AI Companion"
              >
                <PanelRightOpen className="h-5 w-5 text-[#7C3AED]" />
              </button>
            }
            leftItems={
              <button
                onClick={handleToggleCollapse}
                className="p-2 rounded-lg hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors"
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!sidebarCollapsed}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-[#64748B] dark:text-[#94A3B8]" />
                ) : (
                  <ChevronLeft className="h-4 w-4 text-[#64748B] dark:text-[#94A3B8]" />
                )}
              </button>
            }
            rightItems={
              <>
                <button
                  onClick={handleSearchClick}
                  className="p-2 rounded-lg hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors"
                  aria-label="Search VedMoulya"
                >
                  <Search className="h-5 w-5 text-[#64748B] dark:text-[#94A3B8]" />
                </button>

                {/* EPIC-012C — the dedicated AI World discovery bell (opens the
                  AI WORLD panel; the existing notifications bell below is
                  untouched). */}
                <AIWorldBell />

                <button
                  onClick={handleNotificationsClick}
                  className="p-2 rounded-lg hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors relative"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5 text-[#64748B] dark:text-[#94A3B8]" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#EF4444] rounded-full" />
                </button>

                <button
                  onClick={handleThemeToggle}
                  className="p-2 rounded-lg hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors"
                  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {theme === 'dark' ? (
                    <Sun className="h-5 w-5 text-[#94A3B8]" />
                  ) : (
                    <Moon className="h-5 w-5 text-[#64748B]" />
                  )}
                </button>

                <button
                  onClick={handleAiPanelClick}
                  className="hidden md:inline-flex p-2 rounded-lg hover:bg-[#F5F3FF] transition-colors"
                  aria-label="Open AI Companion"
                >
                  <PanelRightOpen className="h-5 w-5 text-[#7C3AED]" />
                </button>

                {/* Signed-in user chip + sign-out (MOB-001) */}
                {user && (
                  <div className="flex items-center gap-1 pl-2 ml-1 border-l border-[#E2E8F0] dark:border-[#334155]">
                    <div className="flex items-center gap-2 mr-0.5" title={user.email}>
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#2B5FD9] to-[#5B8AEB] text-white flex items-center justify-center text-[13px] font-semibold">
                        {user.email.charAt(0).toUpperCase()}
                      </div>
                      <span className="hidden sm:inline text-[13px] text-[#374151] dark:text-[#E2E8F0] max-w-[140px] truncate">
                        {user.email}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        void handleLogout();
                      }}
                      className="p-2 rounded-lg hover:bg-[#FEF2F2] hover:text-[#EF4444] transition-colors"
                      aria-label="Sign out"
                      title="Sign out"
                    >
                      <LogOut className="h-5 w-5 text-[#64748B] dark:text-[#94A3B8]" />
                    </button>
                  </div>
                )}
              </>
            }
          />
        </div>

        {/* ── Breadcrumb + Page Content ───────────────────────────────── */}
        {/* pb-28 on mobile keeps content clear of the bottom tab bar (MOB-002).
            data-scroll-container lets the dashboard's pull-to-refresh bind to
            this scroller. */}
        <div className="flex-1 overflow-y-auto" data-scroll-container>
          <div className="content-container py-6 pb-28 md:pb-6">
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

      {/* ── First-run "Your Private AI Option" prompt (SPRINT-048) ── */}
      <OllamaFirstRunDialog />
      {/* ── First-login Gemini connect prompt (FINAL-02) ─────────────── */}
      <GeminiFirstRunDialog />

      {/* ── Command Palette ──────────────────────────────────────────── */}
      <CommandPalette />

      {/* ── AI World (EPIC-012C — the discovery bell panel) ─────────── */}
      <AIWorldDrawer />

      {/* ── Notification Center ──────────────────────────────────────── */}
      <NotificationsDrawer />

      {/* ── Mobile bottom navigation + offline banner (MOB-002) ──────── */}
      <MobileTabBar />
      <OfflineBanner
        cachedNote="viewing cached data"
        onRetry={() => {
          // Broadcast a retry request; screens with live queries listen for it
          // (dashboard refetches + revalidates its cache).
          window.dispatchEvent(new CustomEvent('vedmoulya:retry-sync'));
        }}
      />
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

  // Logout: clear the JWT + cached user state, then return to the login screen.
  async function handleLogout(): Promise<void> {
    await logout();
    window.location.assign('/login');
  }
}
