// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Network Status Hook Tests (MOB-002)
// Verifies that browser online/offline events are mirrored into the auth
// store's `offline` flag (offline detection + auto-reconnect, Task 5).
// ─────────────────────────────────────────────────────────────────────────────

// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../haptics.js', () => ({
  hapticWarning: vi.fn(),
  hapticTap: vi.fn(),
  hapticRefresh: vi.fn(),
  hapticSuccess: vi.fn(),
  setHapticsEnabled: vi.fn(),
}));

vi.mock('../../auth/platform.js', () => ({
  isNativePlatform: () => false,
}));

import { useNetworkStatus } from '../use-network-status.js';
import { useAuthStore } from '../../stores/auth-store.js';

beforeEach(() => {
  useAuthStore.setState({ offline: false });
  window.dispatchEvent(new Event('online'));
});

describe('useNetworkStatus', () => {
  it('flags the store offline when the device goes offline', () => {
    renderHook(() => useNetworkStatus());
    expect(useAuthStore.getState().offline).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(useAuthStore.getState().offline).toBe(true);
  });

  it('clears the flag and reports online on reconnect', () => {
    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOnline).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.isOnline).toBe(true);
    expect(useAuthStore.getState().offline).toBe(false);
  });

  it('manual reconnect forces the online state', () => {
    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      window.dispatchEvent(new Event('offline'));
      result.current.reconnect();
    });
    expect(useAuthStore.getState().offline).toBe(false);
  });
});
