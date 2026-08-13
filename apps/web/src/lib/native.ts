// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Native Runtime Integration (MOB-002)
// Configures the Capacitor native chrome once per app launch:
//   • Status bar  — transparent overlay so content draws edge-to-edge, with
//     light/dark icon colors following the resolved app theme.
//   • Keyboard    — `resize` mode so inputs are never hidden by the IME.
//   • Back button — single-level history back; double-press to exit from the
//     root tab (Android convention).
// All calls are guarded by isNativePlatform() — no-ops on web / SSR / tests.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { App as CapacitorApp } from '@capacitor/app';
import { isNativePlatform } from '../auth/platform.js';

let backHandlerInstalled = false;

/** Exit the native app (double-press-to-exit from the root tab). */
export function exitNativeApp(): void {
  if (!isNativePlatform()) return;
  void CapacitorApp.exitApp().catch(() => {
    // No-op on web where the plugin bridge is absent.
  });
}

export interface NativeBackConfig {
  /** Called when a single back press should navigate one level up. */
  onBack: () => void;
  /** Called when double-press-to-exit should fire (root tab). */
  onExit: () => void;
  /** Whether the app currently sits on the root tab (no history to pop). */
  isRoot: () => boolean;
}

/** Configure the native chrome once (idempotent across React re-mounts). */
export function configureNativeChrome(opts?: { statusBarStyle?: 'light' | 'dark' }): void {
  if (typeof window === 'undefined' || !isNativePlatform()) return;

  void StatusBar.setOverlaysWebView({ overlay: true });
  void StatusBar.setStyle({
    style: opts?.statusBarStyle === 'dark' ? StatusBarStyle.Dark : StatusBarStyle.Light,
  });
  // Background is transparent — the page's own background shows through.
  void StatusBar.setBackgroundColor({ color: '#00000000' });

  try {
    // `native` mode keeps inputs visible above the IME (keyboard avoidance).
    void Keyboard.setResizeMode({ mode: KeyboardResize.Native });
  } catch {
    // Older plugin versions default to native resize; nothing to do.
  }
}

/**
 * Install the Android back-button policy. Android 13+ predictive-back is
 * enabled in the manifest, so we only need to intercept when JS navigation
 * (history) exists. Double-press-to-exit applies at the root tab.
 */
export function installBackButtonHandler(config: NativeBackConfig): void {
  if (typeof window === 'undefined' || !isNativePlatform()) return;
  if (backHandlerInstalled) return;
  backHandlerInstalled = true;

  let lastExitPress = 0;
  const EXIT_WINDOW_MS = 2000;

  void CapacitorApp.addListener('backButton', () => {
    if (!config.isRoot()) {
      config.onBack();
      return;
    }
    const now = Date.now();
    if (now - lastExitPress < EXIT_WINDOW_MS) {
      config.onExit();
    } else {
      lastExitPress = now;
      config.onBack(); // root: navigates to dashboard (already there) — no-op
    }
  });
}
