// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Settings (UX-07)
//
// The single human-facing settings experience. One route (`/settings`), one
// section registry, URL-driven sections:
//
//   /settings                  → Settings (Account)
//   /settings?tab=profile      → the Profile DESTINATION (its own nav entry)
//   /settings?tab=<section>    → the other sections, still owned by Settings
//
// There is no second settings route and no duplicate Profile page. Every
// section either uses real, persisted state or says explicitly that it is not
// available yet (see each section component) — no fabricated values and no
// controls that do nothing.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useMemo } from 'react';
import { Badge, Tabs as TabsRoot, TabsContent, TabsList, TabsTrigger } from '@vedmoulya/ui';
import {
  Bell,
  BrainCircuit,
  Cpu,
  Database,
  Library,
  Lock,
  Palette,
  Plug,
  Settings2,
  Shield,
  User,
  UserRound,
} from 'lucide-react';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import { SEARCH_CHANGE_EVENT, useClientSearch } from '../../lib/use-client-search.js';
import { useNavigationStore } from '../../stores/navigation-store.js';
import {
  DEFAULT_SETTINGS_SECTION,
  SETTINGS_SECTIONS,
  isProfileSection,
  isSettingsSectionId,
  sectionFromSearch,
  urlForSection,
  type SettingsSectionId,
} from './settings-sections.js';
import {
  AccountSection,
  AdvancedSection,
  AIPreferencesSection,
  AppearanceSection,
  ConnectedServicesSection,
  DataSection,
  LinkedSurfaceSection,
  NotificationsSection,
  PrivacySection,
  ProfileSection,
  SecuritySection,
} from './_components/index.js';

/** Icon per section — presentation only; the registry owns the structure. */
const SECTION_ICONS: Record<SettingsSectionId, React.ComponentType<{ className?: string }>> = {
  account: User,
  profile: UserRound,
  appearance: Palette,
  notifications: Bell,
  ai: Cpu,
  data: Database,
  memory: BrainCircuit,
  knowledge: Library,
  services: Plug,
  security: Shield,
  privacy: Lock,
  advanced: Settings2,
};

export default function SettingsPage(): React.JSX.Element {
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();

  // The URL is the single source of truth for the active section, so deep links
  // and back/forward agree with what is on screen (and with the shell, which
  // derives the highlighted destination from the same query).
  const search = useClientSearch('/settings');
  const activeSection = useMemo(() => sectionFromSearch(search), [search]);
  const isProfileDestination = isProfileSection(activeSection);

  // `?tab=profile` IS the Profile destination; every other section belongs to
  // Settings. The shell highlights the same destination from the URL, and this
  // screen must agree with it.
  useEffect(() => {
    setActiveSection(isProfileDestination ? 'profile' : 'settings');
    setBreadcrumbs([{ label: isProfileDestination ? 'Profile' : 'Settings' }]);
  }, [isProfileDestination, setActiveSection, setBreadcrumbs]);

  const handleSectionChange = (value: string): void => {
    const next: SettingsSectionId = isSettingsSectionId(value) ? value : DEFAULT_SETTINGS_SECTION;
    if (typeof window === 'undefined') return;
    window.history.replaceState(null, '', urlForSection(next));
    // Tell the shell (and this screen) that the query changed without a
    // navigation — the same contract the mobile nav uses.
    window.dispatchEvent(new Event(SEARCH_CHANGE_EVENT));
  };

  return (
    <div className="space-y-6 max-w-4xl" data-testid="settings-page">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[28px] font-heading font-bold text-[#111827] dark:text-[#F8FAFC]">
              {isProfileDestination ? 'Profile' : 'Settings'}
            </h1>
            <Badge variant="info" size="sm">
              {isProfileDestination ? 'Your identity' : 'Preferences'}
            </Badge>
          </div>
          <p className="text-[15px] text-[#64748B] dark:text-[#94A3B8]">
            {isProfileDestination
              ? 'The profile VedMoulya works from — your name, purpose and goal.'
              : 'Your account, preferences and configuration in one place.'}
          </p>
        </div>
      </header>

      <TabsRoot value={activeSection} onValueChange={handleSectionChange}>
        <div className="w-full overflow-x-auto pb-1">
          <TabsList className="h-auto min-w-max" aria-label="Settings sections">
            {SETTINGS_SECTIONS.map((section) => {
              const Icon = SECTION_ICONS[section.id];
              return (
                <TabsTrigger
                  key={section.id}
                  value={section.id}
                  data-testid={`settings-tab-${section.id}`}
                >
                  <Icon className="h-4 w-4 mr-1.5" aria-hidden="true" />
                  {section.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="account">
          <ErrorBoundary section="settings-account">
            <AccountSection />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="profile">
          <ErrorBoundary section="settings-profile">
            <ProfileSection />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="appearance">
          <ErrorBoundary section="settings-appearance">
            <AppearanceSection />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="notifications">
          <ErrorBoundary section="settings-notifications">
            <NotificationsSection />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="ai">
          <ErrorBoundary section="settings-ai">
            <AIPreferencesSection />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="data">
          <ErrorBoundary section="settings-data">
            <DataSection />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="memory">
          <ErrorBoundary section="settings-memory">
            <LinkedSurfaceSection
              title="Memory"
              description="What VedMoulya remembers about your journey is owned by the AI experience — this screen does not duplicate its controls."
              bullets={['Review what has been remembered, and when', 'Search the memory timeline']}
              route="/memory"
              linkLabel="Open memory"
              testId="settings-memory"
            />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="knowledge">
          <ErrorBoundary section="settings-knowledge">
            <LinkedSurfaceSection
              title="Knowledge"
              description="What you have taught VedMoulya is owned by the AI experience — this screen does not duplicate its controls."
              bullets={['Review sources you have added', 'See how knowledge is connected']}
              route="/knowledge"
              linkLabel="Open knowledge"
              testId="settings-knowledge"
            />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="services">
          <ErrorBoundary section="settings-services">
            <ConnectedServicesSection />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="security">
          <ErrorBoundary section="settings-security">
            <SecuritySection />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="privacy">
          <ErrorBoundary section="settings-privacy">
            <PrivacySection />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="advanced">
          <ErrorBoundary section="settings-advanced">
            <AdvancedSection />
          </ErrorBoundary>
        </TabsContent>
      </TabsRoot>
    </div>
  );
}
