// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Haptics Wrapper Tests (MOB-002)
// Verifies the native-guard: on the web (and in tests) the Capacitor Haptics
// plugin must never be invoked, and the enabled flag must gate calls.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach } from 'vitest';

const { hapticsMock } = vi.hoisted(() => ({
  hapticsMock: {
    impact: vi.fn(),
    notification: vi.fn(),
  },
}));

vi.mock('@capacitor/haptics', () => ({
  Haptics: hapticsMock,
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM' },
  NotificationType: { Success: 'SUCCESS', Warning: 'WARNING' },
}));

vi.mock('../auth/platform.js', () => ({
  isNativePlatform: () => false,
}));

import {
  hapticTap,
  hapticRefresh,
  hapticSuccess,
  hapticWarning,
  setHapticsEnabled,
} from '../haptics.js';

beforeEach(() => {
  hapticsMock.impact.mockClear();
  hapticsMock.notification.mockClear();
  setHapticsEnabled(true);
});

describe('haptics on the web platform', () => {
  it('never invokes the plugin when not native', async () => {
    await hapticTap();
    await hapticRefresh();
    await hapticSuccess();
    await hapticWarning();
    expect(hapticsMock.impact).not.toHaveBeenCalled();
    expect(hapticsMock.notification).not.toHaveBeenCalled();
  });
});

describe('enabled flag', () => {
  it('skips calls when disabled (settings toggle)', async () => {
    setHapticsEnabled(false);
    await hapticTap();
    expect(hapticsMock.impact).not.toHaveBeenCalled();
  });
});
