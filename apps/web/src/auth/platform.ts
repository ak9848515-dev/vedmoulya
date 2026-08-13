// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Platform Detection
// MOB-001 — Mobile Authentication
// Distinguishes the Capacitor native runtime (Android WebView) from the
// regular web app and from non-browser environments (SSR, unit tests), so
// the auth layer can pick the right storage backend and OAuth transport.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { Capacitor } from '@capacitor/core';

/** True when running inside the Capacitor native runtime (Android/iOS). */
export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
