// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Mobile Bottom Tab Bar (MOB-002 · re-based on UX-01/UX-02)
//
// Five reachable destinations on a phone:
//
//     Home · Missions · Progress · AI · More
//
// It used to be Dashboard · Learning · Career · Marketplace · Agency · Settings —
// six unrelated areas in a bottom bar, which is a navigation taxonomy leaking
// into the most precious 60px in the product. Career / Learning / Business /
// Marketplace / Settings / Profile now live in the More sheet, one tap deep, and
// They keep their own routes.
//
// Features preserved from MOB-002: safe-area insets, prefetching links, haptic
// feedback, active-state indicator, offline dot, press animation, accessibility
// (aria-label + aria-current).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { memo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowRight,
  ChevronRight,
  Sparkles,
  UserRound,
  Settings as SettingsIcon,
} from 'lucide-react';
import { BottomSheet, BottomSheetContent, BottomSheetOverlay } from '@vedmoulya/ui';
import {
  MOBILE_DESTINATIONS,
  MOBILE_MORE_LINKS,
  SETTINGS_DESTINATION,
  PROFILE_DESTINATION,
  type NavLink,
} from '../lib/navigation-model.js';
import { mobileDestinationForPathname } from '../lib/navigation-model.js';
import { useClientSearch } from '../lib/use-client-search.js';
import { useAuthStore } from '../stores/auth-store.js';
import { useUIStore } from '../stores/ui-store.js';
import { hapticTap } from '../lib/haptics.js';

const TAB_CLASS =
  'relative flex flex-1 flex-col items-center justify-center gap-1 transition-transform duration-150 active:scale-95';

export const MobileTabBar = memo(function MobileTabBar(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const search = useClientSearch(pathname);
  const offline = useAuthStore((state) => state.offline);
  const setAiPanelOpen = useUIStore((state) => state.setAiPanelOpen);
  const activeTab = mobileDestinationForPathname(pathname, search);
  const [moreOpen, setMoreOpen] = useState(false);

  const openLink = (route: string): void => {
    void hapticTap();
    setMoreOpen(false);
    router.push(route);
  };

  return (
    <>
      <nav
        aria-label="Primary"
        className="
          fixed bottom-0 inset-x-0 z-40 md:hidden
          border-t border-[#E8EDF5] dark:border-[#334155]
          bg-white/90 dark:bg-[#0F172A]/95 backdrop-blur-xl
          pb-safe no-tap-highlight
          transition-colors duration-300
        "
      >
        <div className="flex items-stretch justify-around h-[60px] max-w-lg mx-auto">
          {MOBILE_DESTINATIONS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab.id === tab.id;
            const className = `
              ${TAB_CLASS}
              ${isActive ? 'text-[#2B5FD9] dark:text-[#6B8FEF]' : 'text-[#94A3B8] dark:text-[#64748B]'}
            `;

            const inner = (
              <>
                {/* Active indicator pill */}
                <span
                  className={`
                    absolute -top-px h-[3px] w-8 rounded-b-full transition-all duration-300
                    ${isActive ? 'bg-[#2B5FD9] dark:bg-[#6B8FEF] opacity-100' : 'bg-transparent opacity-0'}
                  `}
                />
                <span className="relative transition-colors duration-200">
                  <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.4 : 2} />
                  {offline && (
                    <span
                      className="absolute -top-0.5 -right-1.5 h-2 w-2 rounded-full bg-[#F59E0B] ring-2 ring-white dark:ring-[#0F172A]"
                      aria-label="Offline"
                    />
                  )}
                </span>
                <span className="text-[12px] font-medium leading-none transition-colors duration-200">
                  {tab.label}
                </span>
              </>
            );

            // "More" is a container, not a page — it opens the sheet.
            if (tab.id === 'more') {
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    void hapticTap();
                    setMoreOpen(true);
                  }}
                  aria-haspopup="dialog"
                  aria-expanded={moreOpen}
                  className={className}
                >
                  {inner}
                </button>
              );
            }

            return (
              <Link
                key={tab.id}
                href={tab.route}
                onClick={() => {
                  void hapticTap();
                }}
                aria-current={isActive ? 'page' : undefined}
                className={className}
              >
                {inner}
              </Link>
            );
          })}
        </div>
        {/* Extra safe-area padding for gesture-nav devices */}
        <div className="h-safe-bottom" aria-hidden="true" />
      </nav>

      {/* ── More sheet — everything that is not one of the five ─────────── */}
      <BottomSheet open={moreOpen} onOpenChange={setMoreOpen}>
        <BottomSheetOverlay />
        <BottomSheetContent aria-label="More destinations" className="dark:bg-[#1E293B]">
          <h2 className="text-[17px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC] mb-1">
            More
          </h2>
          <p className="text-[12.5px] text-[#64748B] dark:text-[#94A3B8] mb-5">
            Everything else, one tap away.
          </p>

          <ul className="flex flex-col">
            {MOBILE_MORE_LINKS.map((link) => (
              <MoreRow key={link.route} link={link} onOpen={openLink} />
            ))}
          </ul>

          <div
            className="my-3 border-t border-[#E2E8F0] dark:border-[#334155]"
            aria-hidden="true"
          />

          <button
            type="button"
            onClick={() => {
              void hapticTap();
              setMoreOpen(false);
              setAiPanelOpen(true);
            }}
            className="w-full flex items-center gap-3 rounded-[14px] bg-[#EFF4FE] dark:bg-[#1E3A8A]/30 px-3 py-3 text-left"
          >
            <Sparkles
              className="h-5 w-5 shrink-0 text-[#2B5FD9] dark:text-[#6B8FEF]"
              aria-hidden="true"
            />
            <span className="flex-1">
              <span className="block text-[14px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                Ask VedMoulya
              </span>
              <span className="block text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                Ask anything, or start something.
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-[#2B5FD9]" aria-hidden="true" />
          </button>

          <div className="mt-3 flex flex-col">
            <SystemRow
              label={SETTINGS_DESTINATION.label}
              description={SETTINGS_DESTINATION.description}
              icon={<SettingsIcon className="h-5 w-5" aria-hidden="true" />}
              onOpen={() => {
                openLink(SETTINGS_DESTINATION.route);
              }}
            />
            <SystemRow
              label={PROFILE_DESTINATION.label}
              description={PROFILE_DESTINATION.description}
              icon={<UserRound className="h-5 w-5" aria-hidden="true" />}
              onOpen={() => {
                openLink(PROFILE_DESTINATION.route);
              }}
            />
          </div>
        </BottomSheetContent>
      </BottomSheet>
    </>
  );
});

function MoreRow({
  link,
  onOpen,
}: {
  link: NavLink;
  onOpen: (route: string) => void;
}): React.JSX.Element {
  const Icon = link.icon;
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onOpen(link.route);
        }}
        className="w-full flex items-center gap-3 rounded-[14px] px-3 py-3 text-left transition-colors hover:bg-[#F1F5F9] dark:hover:bg-[#0F172A]"
      >
        <Icon className="h-5 w-5 shrink-0 text-[#64748B] dark:text-[#94A3B8]" aria-hidden="true" />
        <span className="flex-1">
          <span className="block text-[14px] font-medium text-[#111827] dark:text-[#F8FAFC]">
            {link.label}
          </span>
          <span className="block text-[12px] text-[#64748B] dark:text-[#94A3B8]">
            {link.description}
          </span>
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-[#CBD5E1] dark:text-[#475569]"
          aria-hidden="true"
        />
      </button>
    </li>
  );
}

function SystemRow({
  label,
  description,
  icon,
  onOpen,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  onOpen: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 rounded-[14px] px-3 py-3 text-left transition-colors hover:bg-[#F1F5F9] dark:hover:bg-[#0F172A]"
    >
      <span className="shrink-0 text-[#64748B] dark:text-[#94A3B8]">{icon}</span>
      <span className="flex-1">
        <span className="block text-[14px] font-medium text-[#111827] dark:text-[#F8FAFC]">
          {label}
        </span>
        <span className="block text-[12px] text-[#64748B] dark:text-[#94A3B8]">{description}</span>
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-[#CBD5E1] dark:text-[#475569]"
        aria-hidden="true"
      />
    </button>
  );
}
