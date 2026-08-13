// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Mobile Bottom Tab Bar (MOB-002)
// Production bottom navigation: Dashboard · Learning · Career · Marketplace ·
// Settings. Rendered only on phone viewports (AppShell keeps the sidebar for
// md+ screens). Features:
//   • Safe-area bottom inset padding (edge-to-edge Android 15+).
//   • Prefetching links (route JS is fetched ahead of tapping).
//   • Haptic feedback on tab activation.
//   • Subtle active-state indicator + press scale animation.
//   • Offline status dot when the device has no connectivity.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { memo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MOBILE_TABS, tabForPathname } from '../lib/mobile-nav.js';
import { useAuthStore } from '../stores/auth-store.js';
import { hapticTap } from '../lib/haptics.js';

export const MobileTabBar = memo(function MobileTabBar(): React.JSX.Element {
  const pathname = usePathname();
  const offline = useAuthStore((state) => state.offline);
  const activeTab = tabForPathname(pathname);

  return (
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
        {MOBILE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab.id === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.route}
              onClick={() => {
                void hapticTap();
              }}
              aria-current={isActive ? 'page' : undefined}
              className="
                relative flex flex-1 flex-col items-center justify-center gap-1
                transition-transform duration-150 active:scale-95
              "
            >
              {/* Active indicator pill */}
              <span
                className={`
                  absolute -top-px h-[3px] w-8 rounded-b-full transition-all duration-300
                  ${isActive ? 'bg-[#2B5FD9] dark:bg-[#6B8FEF] opacity-100' : 'bg-transparent opacity-0'}
                `}
              />
              <span
                className={`
                  relative transition-colors duration-200
                  ${isActive ? 'text-[#2B5FD9] dark:text-[#6B8FEF]' : 'text-[#94A3B8] dark:text-[#64748B]'}
                `}
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.4 : 2} />
                {offline && (
                  <span
                    className="absolute -top-0.5 -right-1.5 h-2 w-2 rounded-full bg-[#F59E0B] ring-2 ring-white dark:ring-[#0F172A]"
                    aria-label="Offline"
                  />
                )}
              </span>
              <span
                className={`
                  text-[10px] font-medium leading-none transition-colors duration-200
                  ${isActive ? 'text-[#2B5FD9] dark:text-[#6B8FEF]' : 'text-[#94A3B8] dark:text-[#64748B]'}
                `}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
      {/* Extra safe-area padding for gesture-nav devices */}
      <div className="h-safe-bottom" aria-hidden="true" />
    </nav>
  );
});
