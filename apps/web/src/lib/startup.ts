// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Startup Instrumentation (MOB-002, Task 4)
// Lightweight performance marks for measuring app startup in the Capacitor
// WebView. Values are reported to the console in dev and exposed via
// `getStartupTimings()` for the MOB-002 report. Zero dependencies.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

export const STARTUP_MARKS = {
  /** Earliest mark — module evaluated (module scope, before React mounts). */
  moduleLoad: 'vedmoulya:start',
  /** After the root <Providers> mounted. */
  providersMounted: 'vedmoulya:providers-mounted',
  /** After the auth session restore finished (sessionReady). */
  sessionReady: 'vedmoulya:session-ready',
  /** After the first dashboard data arrived. */
  firstData: 'vedmoulya:first-data',
} as const;

/** Mark the current time (no-op on SSR). */
export function markStartup(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    performance.mark(name);
  } catch {
    // Performance API unavailable — instrumentation is optional.
  }
}

/** Measure from app start to `name` in milliseconds; null when unavailable. */
export function measureStartup(name: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const start = performance.getEntriesByName(STARTUP_MARKS.moduleLoad)[0];
    const end = performance.getEntriesByName(name)[0];
    if (!start || !end) return null;
    return Math.round(end.startTime - start.startTime);
  } catch {
    return null;
  }
}

/** Human-readable startup report for the MOB-002 verification run. */
export function getStartupTimings(): Record<string, number | null> {
  return {
    'module → providers': measureStartup(STARTUP_MARKS.providersMounted),
    'module → session ready': measureStartup(STARTUP_MARKS.sessionReady),
    'module → first data': measureStartup(STARTUP_MARKS.firstData),
  };
}
