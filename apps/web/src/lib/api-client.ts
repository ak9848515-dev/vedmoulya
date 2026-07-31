// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Client Hooks
// Typed React hooks for consuming Life OS and module services
// BLD-016-B — Dashboard Landing Experience
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/explicit-function-return-type */
// Return types are inferred by tRPC's type system

'use client';

import { api } from './trpc';

// ── Life OS Hooks ───────────────────────────────────────────────────────────

/**
 * Fetch the full Life OS snapshot for the current user.
 * This is the primary data source for the Dashboard landing page.
 * The query is disabled when no userId is available (signed-out / pre-hydration)
 * so anonymous visitors do not fire doomed requests (BLD-016C strict auth).
 */
export function useLifeOSSnapshot(userId: string) {
  return api.lifeOS.getSnapshot.useQuery({ userId }, { enabled: Boolean(userId) });
}

/**
 * Fetch the Life OS dashboard view model (pre-formatted for display).
 */
export function useLifeOSViewModel(userId: string) {
  return api.lifeOS.getViewModel.useQuery({ userId }, { enabled: Boolean(userId) });
}

// ── Career Hooks ────────────────────────────────────────────────────────────

export function useCareer(userId: string) {
  return api.career.getCareer.useQuery({ userId }, { enabled: Boolean(userId) });
}

export function useCareerViewModel(userId: string) {
  return api.career.getViewModel.useQuery({ userId }, { enabled: Boolean(userId) });
}

// ── Learning Hooks ──────────────────────────────────────────────────────────

export function useLearning(userId: string) {
  return api.learning.getLearning.useQuery({ userId }, { enabled: Boolean(userId) });
}

export function useLearningViewModel(userId: string) {
  return api.learning.getViewModel.useQuery({ userId }, { enabled: Boolean(userId) });
}

// ── Business Hooks ──────────────────────────────────────────────────────────

export function useBusiness(userId: string) {
  return api.business.getBusiness.useQuery({ userId }, { enabled: Boolean(userId) });
}

export function useBusinessViewModel(userId: string) {
  return api.business.getViewModel.useQuery({ userId }, { enabled: Boolean(userId) });
}

// ── Marketplace Hooks ───────────────────────────────────────────────────────

export function useMarketplace(userId: string) {
  return api.marketplace.getMarketplace.useQuery({ userId }, { enabled: Boolean(userId) });
}

export function useMarketplaceViewModel(userId: string) {
  return api.marketplace.getViewModel.useQuery({ userId }, { enabled: Boolean(userId) });
}

// ── Platform Health ─────────────────────────────────────────────────────────

export function usePlatformHealth() {
  return api.health.check.useQuery();
}

export function usePlatformVersion() {
  return api.health.version.useQuery();
}

// ── Search Hooks ────────────────────────────────────────────────────────────

export function useRecentSearches(userId: string) {
  return api.search.recent.useQuery({ userId }, { enabled: Boolean(userId) });
}

// ── Notification Hooks ──────────────────────────────────────────────────────

export function useNotifications(userId: string) {
  return api.notifications.list.useQuery({ userId }, { enabled: Boolean(userId) });
}
