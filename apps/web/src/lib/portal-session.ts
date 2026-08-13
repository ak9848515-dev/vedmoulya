// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Client Portal Session (EPIC-003 / AC-002, Module 7)
// The portal uses the agency-issued access token as its credential. It is
// stored separately from the platform JWT (different audiences) and sent to
// the public, token-scoped portal procedures.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

const TOKEN_KEY = 'vedmoulya_portal_token';

export function getPortalToken(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(TOKEN_KEY) ?? '';
}

export function setPortalToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearPortalToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}
