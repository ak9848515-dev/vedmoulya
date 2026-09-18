// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Client query string (UX-02)
//
// The navigation shell needs the URL query to tell two destinations apart when
// they share a pathname (Settings vs Profile → `?tab=profile`).
//
// This reads `window.location.search` AFTER mount instead of using
// `useSearchParams()`, deliberately: `useSearchParams()` would force every page
// that renders under the shell to sit inside a Suspense boundary, and a missing
// boundary turns into a build error. Before hydration the value is '' — which
// resolves to the base destination (Settings) and corrects itself immediately.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useState } from 'react';

/**
 * Fired by a screen that changes the query in place (e.g. a Settings tab) so the
 * shell re-reads it without a full navigation. Exported so the producer and the
 * listener can never disagree about the event name.
 */
export const SEARCH_CHANGE_EVENT = 'vedmoulya:search-change';

export function useClientSearch(pathname: string): string {
  const [search, setSearch] = useState('');
  useEffect(() => {
    const sync = (): void => {
      setSearch(typeof window === 'undefined' ? '' : window.location.search);
    };
    sync();
    // Back/forward can change the query without changing the pathname, and an
    // in-page tab switch changes it without navigating at all.
    window.addEventListener('popstate', sync);
    window.addEventListener(SEARCH_CHANGE_EVENT, sync);
    return (): void => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(SEARCH_CHANGE_EVENT, sync);
    };
  }, [pathname]);
  return search;
}
