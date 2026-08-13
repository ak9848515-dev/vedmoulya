// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Offline Banner (MOB-002)
// Sticky banner shown whenever the device loses connectivity. Mirrors the
// auth store's `offline` flag (set by the network-status hook and the session
// manager) and offers a manual "retry synchronization" action. Auto-dismisses
// on reconnect (the store flag flips back via the network hook).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { memo } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store.js';
import { hapticTap } from '../lib/haptics.js';

export interface OfflineBannerProps {
  /** Optional label describing what is cached and still usable. */
  cachedNote?: string;
  /** Called when the user taps "Retry now". */
  onRetry?: () => void;
}

export const OfflineBanner = memo(function OfflineBanner({
  cachedNote,
  onRetry,
}: OfflineBannerProps): React.JSX.Element | null {
  const offline = useAuthStore((state) => state.offline);
  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="
        animate-banner-in fixed top-0 inset-x-0 z-50 md:hidden
        flex items-center gap-2 px-4 py-2.5 pt-safe
        bg-[#FFFBEB] dark:bg-[#451A03] border-b border-[#FDE68A] dark:border-[#78350F]
        text-[#92400E] dark:text-[#FDE68A] text-[12px] font-medium
      "
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 min-w-0 truncate">
        You&apos;re offline{cachedNote ? ` — ${cachedNote}` : ' — showing the last saved data'}
      </span>
      {onRetry && (
        <button
          onClick={() => {
            void hapticTap();
            onRetry();
          }}
          className="
            inline-flex items-center gap-1 px-2 py-1 rounded-md
            bg-[#F59E0B]/15 hover:bg-[#F59E0B]/25 transition-colors
            text-[#B45309] dark:text-[#FBBF24] font-semibold
          "
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      )}
    </div>
  );
});
