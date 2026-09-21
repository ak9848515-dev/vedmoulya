// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Page Context (UX-01 / UX-02 / UX-05)
//
// Small, shared wiring for pages that sit INSIDE a destination rather than
// being one. It answers the user's real question — "where am I?" — using the
// single navigation authority (`lib/navigation-model.ts`), with no second
// navigation model and no new route.
//
// It does two things:
//   1. Publishes the page's position into the shell breadcrumb (Life → Career)
//      by declaring a trail, which AppShell now preserves instead of
//      overwriting.
//   2. Returns the owning destination so a page can render back navigation
//      without hard-coding a parent it does not own.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useMemo } from 'react';
import { useNavigationStore } from '../stores/navigation-store.js';
import {
  destinationForPathname,
  type AppDestination,
  type AppDestinationId,
} from './navigation-model.js';

export interface PageContextOptions {
  /** The route this page lives at (a REAL route — never invented). */
  pathname: string;
  /** The page's own name, as the user would say it ("Career"). */
  label: string;
  /** Optional extra trail under the page (e.g. the open mission's title). */
  trailing?: readonly { label: string; href?: string }[];
  /** Active destination, when the page already knows it (skips a lookup). */
  activeId?: AppDestinationId;
}

export interface PageContext {
  /** The destination that owns this page (Life for /career, AI for /providers). */
  owner: AppDestination;
  /** True when this page IS its destination's landing route. */
  isOwnerLanding: boolean;
  /** The owner's human-facing label ("Life", "AI"). */
  ownerLabel: string;
  /** The owner's canonical route ("/life", "/ai"). */
  ownerRoute: string;
}

/**
 * Declare a page's place in the hierarchy and receive its owner.
 * Safe to call on every page: it only touches the shell's session breadcrumbs.
 */
export function usePageContext({
  pathname,
  label,
  trailing = [],
  activeId,
}: PageContextOptions): PageContext {
  const owner = useMemo(() => destinationForPathname(pathname), [pathname]);
  const setActiveSection = useNavigationStore((state) => state.setActiveSection);
  const setBreadcrumbs = useNavigationStore((state) => state.setBreadcrumbs);

  const isOwnerLanding = owner.route === pathname;

  useEffect(() => {
    if (activeId !== undefined) {
      setActiveSection(activeId);
    } else {
      setActiveSection(owner.id);
    }
    setBreadcrumbs([
      { label: owner.label, href: owner.route },
      ...(isOwnerLanding ? [] : [{ label, href: pathname }]),
      ...trailing.map((crumb) => ({ label: crumb.label, href: crumb.href })),
    ]);
  }, [
    activeId,
    isOwnerLanding,
    label,
    owner.id,
    owner.label,
    owner.route,
    pathname,
    setActiveSection,
    setBreadcrumbs,
    trailing,
  ]);

  return {
    owner,
    isOwnerLanding,
    ownerLabel: owner.label,
    ownerRoute: owner.route,
  };
}
