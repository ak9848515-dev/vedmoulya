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
  LogOut,
  Settings,
  PenSquare,
  Boxes,
  Cpu,
  Layers,
  Workflow,
  GitBranch,
  Target,
  BrainCircuit,
  Brain,
  GraduationCap,
  Library,
  Database,
  MonitorCog,
  Fingerprint,
  RefreshCw,
  Radar,
  Zap,
} from 'lucide-react';
import { logout } from '../auth/session-manager.js';
import { useAuthStore } from '../stores/auth-store.js';
import { isNativePlatform } from '../auth/platform.js';
import {
  useNavigationStore,
  buildSidebarGroups,
  type NavSectionId,
} from '../stores/navigation-store.js';
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

// ── Module Icon Map ─────────────────────────────────────────────────────────

const moduleIcons: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard className="h-5 w-5" />,
  insights: <Lightbulb className="h-5 w-5" />,
  search: <Search className="h-5 w-5" />,
  career: <Briefcase className="h-5 w-5" />,
  learning: <BookOpen className="h-5 w-5" />,
  business: <BarChart3 className="h-5 w-5" />,
  marketplace: <Store className="h-5 w-5" />,
  capabilities: <Boxes className="h-5 w-5" />,
  'capability-marketplace': <Radar className="h-5 w-5" />,
  providers: <Cpu className="h-5 w-5" />,
  context: <Layers className="h-5 w-5" />,
  'execution-strategy': <Workflow className="h-5 w-5" />,
  execution: <GitBranch className="h-5 w-5" />,
  goals: <Target className="h-5 w-5" />,
  intelligence: <BrainCircuit className="h-5 w-5" />,
  'learning-intelligence': <GraduationCap className="h-5 w-5" />,
  'enterprise-brain': <BrainCircuit className="h-5 w-5" />,
  brain: <Brain className="h-5 w-5" />,
  'live-intelligence': <Zap className="h-5 w-5" />,
  knowledge: <Library className="h-5 w-5" />,
  memory: <Database className="h-5 w-5" />,
  os: <MonitorCog className="h-5 w-5" />,
  'context-fabric': <Fingerprint className="h-5 w-5" />,
  loop: <RefreshCw className="h-5 w-5" />,
  applications: <Boxes className="h-5 w-5" />,
  'content-agency': <PenSquare className="h-5 w-5" />,
  ecosystem: <Boxes className="h-5 w-5" />,
  settings: <Settings className="h-5 w-5" />,
};

// Sections with real client-side routes — sidebar clicks navigate to them
// (insights/search are state-only, MOB-002).
function routeForSection(section: NavSectionId): string | undefined {
  switch (section) {
    case 'dashboard':
      return '/';
    case 'settings':
      return '/settings';
    case 'career':
      return '/career';
    case 'learning':
      return '/learning';
    case 'business':
      return '/business';
    case 'marketplace':
      return '/marketplace';
    case 'capabilities':
      return '/capabilities';
    case 'capability-marketplace':
      return '/capability-marketplace';
    case 'providers':
      return '/providers';
    case 'context':
      return '/context';
    case 'execution-strategy':
      return '/execution-strategy';
    case 'execution':
      return '/execution';
    case 'goals':
      return '/goals';
    case 'intelligence':
      return '/intelligence';
    case 'ecosystem-intelligence':
      return '/ecosystem-intelligence';
    case 'learning-intelligence':
      return '/learning-intelligence';
    case 'enterprise-brain':
      return '/enterprise-brain';
    case 'brain':
      return '/brain';
    case 'live-intelligence':
      return '/live-intelligence';
    case 'knowledge':
      return '/knowledge';
    case 'memory':
      return '/memory';
    case 'os':
      return '/os';
    case 'context-fabric':
      return '/context-fabric';
    case 'loop':
      return '/loop';
    case 'applications':
      return '/applications';
    case 'content-agency':
      return '/content-agency';
    case 'ecosystem':
      return '/ecosystem';
    default:
      return undefined;
  }
}

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
    activeSection,
    sidebarCollapsed,
    mobileSidebarOpen,
    breadcrumbs,
    setActiveSection,
    toggleSidebar,
    setMobileSidebarOpen,
  } = useNavigationStore();

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
      isRoot: () => tabForPathname(window.location.pathname).id === 'dashboard',
    });

    // State preservation: a bare "/" launch resumes the last visited tab.
    const { tab, restore } = resolveLaunchTab(window.location.pathname);
    if (restore && tab.route !== '/') {
      router.replace(tab.route);
    }
  }, [router]);

  // Persist the current tab so app restarts restore the previous page.
  useEffect(() => {
    const tab = tabForPathname(pathname);
    persistLastTab(tab.id);
  }, [pathname]);

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
  const handleNavigate = (section: NavSectionId): void => {
    setActiveSection(section);
    setMobileSidebarOpen(false);
    const route = routeForSection(section);
    if (route && window.location.pathname !== route) {
      router.push(route);
    }
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
          groups={enrichedGroups}
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
                  aria-label="Search"
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
