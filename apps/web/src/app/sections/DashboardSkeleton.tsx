// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Loading Skeletons (MOB-002)
// Replaces the generic spinner with skeleton placeholders that mirror the real
// dashboard layout, so first paint communicates structure and reduces layout
// shift once data arrives. Dark-mode aware.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';

function SkeletonBlock({ className }: { className: string }): React.JSX.Element {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden="true" />;
}

export function DashboardSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-5 pt-2 pb-8" role="status" aria-label="Loading your dashboard">
      {/* Profile card */}
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E8EDF5] dark:border-[#334155]">
        <SkeletonBlock className="h-14 w-14 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-3 w-56" />
          <SkeletonBlock className="h-3 w-44" />
        </div>
      </div>

      {/* Hero */}
      <div className="rounded-[24px] bg-gradient-to-br from-[#1E4AA8] via-[#2B5FD9] to-[#5B8AEB] p-6">
        <SkeletonBlock className="h-8 w-56 bg-white/30" />
        <div className="mt-3 space-y-2">
          <SkeletonBlock className="h-3 w-full bg-white/25" />
          <SkeletonBlock className="h-3 w-3/4 bg-white/25" />
        </div>
        <div className="mt-4 flex gap-2">
          <SkeletonBlock className="h-8 w-28 rounded-full bg-white/30" />
          <SkeletonBlock className="h-8 w-32 rounded-full bg-white/20" />
        </div>
      </div>

      {/* Today's mission */}
      <div className="rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E8EDF5] dark:border-[#334155] p-4">
        <div className="flex items-center justify-between">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-5 w-16 rounded-full" />
        </div>
        <div className="mt-3 space-y-2">
          <SkeletonBlock className="h-5 w-3/4" />
          <SkeletonBlock className="h-3 w-full" />
          <SkeletonBlock className="h-3 w-2/3" />
        </div>
        <SkeletonBlock className="mt-4 h-9 w-36 rounded-full" />
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E8EDF5] dark:border-[#334155] p-4 space-y-3">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-10 w-full" />
          <SkeletonBlock className="h-3 w-5/6" />
        </div>
        <div className="rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E8EDF5] dark:border-[#334155] p-4 space-y-3">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-10 w-full" />
          <SkeletonBlock className="h-3 w-5/6" />
        </div>
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E8EDF5] dark:border-[#334155] p-3 space-y-2"
          >
            <SkeletonBlock className="h-8 w-8 rounded-xl" />
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="h-2 w-12" />
          </div>
        ))}
      </div>

      <span className="sr-only">Loading your dashboard…</span>
    </div>
  );
}
