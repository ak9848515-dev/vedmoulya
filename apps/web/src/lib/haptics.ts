// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Haptic Feedback (MOB-002)
// Thin, safely-guarded wrapper around the Capacitor Haptics plugin.
// Fires only inside the native runtime; no-ops on the web so desktop browsing
// and unit tests never touch the plugin bridge.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNativePlatform } from '../auth/platform.js';

// Persisted preference key — must match the Settings toggle (settings/page.tsx).
const HAPTICS_PREF_KEY = 'vedmoulya-haptics';

function readPreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    // 'off' means disabled; anything else (or absent) → enabled.
    return window.localStorage.getItem(HAPTICS_PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

// Applied at module load so the saved preference survives app restarts.
let enabled = readPreference();

/** Allow the Settings screen to toggle haptics (persisted by the caller). */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

export function isHapticsEnabled(): boolean {
  return enabled;
}

/** Light impact — tab switches, list selection. */
export async function hapticTap(): Promise<void> {
  if (!enabled || !isNativePlatform()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Plugin unavailable — haptics are a progressive enhancement.
  }
}

/** Medium impact — pull-to-refresh threshold crossed, refresh complete. */
export async function hapticRefresh(): Promise<void> {
  if (!enabled || !isNativePlatform()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    // no-op
  }
}

/** Success notification — login restored, sync completed. */
export async function hapticSuccess(): Promise<void> {
  if (!enabled || !isNativePlatform()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // no-op
  }
}

/** Warning notification — offline transition. */
export async function hapticWarning(): Promise<void> {
  if (!enabled || !isNativePlatform()) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch {
    // no-op
  }
}
