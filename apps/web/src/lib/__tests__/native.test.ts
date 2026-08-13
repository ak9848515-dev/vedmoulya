// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Native Back-Button Policy Tests (MOB-002)
// Verifies the Android back policy: at the root tab a single press is a no-op
// and a second press within the window exits; off-root presses pop history.
// The module-level install guard means one handler is installed for the whole
// suite; the `isRoot` answer is toggled per scenario via a mutable closure.
// ─────────────────────────────────────────────────────────────────────────────

// @vitest-environment jsdom

import { describe, expect, it, vi, beforeAll, beforeEach, afterAll } from 'vitest';

const { appMock, listeners } = vi.hoisted(() => {
  const listeners: Array<(arg?: unknown) => void> = [];
  const appMock = {
    addListener: vi.fn((eventName: string, cb: () => void) => {
      if (eventName === 'backButton') listeners.push(cb);
      return Promise.resolve();
    }),
    exitApp: vi.fn().mockResolvedValue(undefined),
  };
  return { appMock, listeners };
});

vi.mock('@capacitor/app', () => ({
  App: appMock,
}));

vi.mock('@capacitor/status-bar', () => ({
  StatusBar: { setOverlaysWebView: vi.fn(), setStyle: vi.fn(), setBackgroundColor: vi.fn() },
  Style: { Dark: 'DARK', Light: 'LIGHT' },
}));

vi.mock('@capacitor/keyboard', () => ({
  Keyboard: { getResizeMode: true, setResizeMode: vi.fn() },
  KeyboardResize: { Native: 'native', Body: 'body', Ionic: 'ionic', None: 'none' },
}));

vi.mock('../../auth/platform.js', () => ({
  isNativePlatform: () => true,
}));

import { installBackButtonHandler, exitNativeApp } from '../native.js';

let isRoot = true;
const onBack = vi.fn();
const onExit = vi.fn();

beforeAll(() => {
  installBackButtonHandler({ onBack, onExit, isRoot: () => isRoot });
});

beforeEach(() => {
  isRoot = true;
  onBack.mockClear();
  onExit.mockClear();
  appMock.exitApp.mockClear();
});

afterAll(() => {
  vi.useRealTimers();
});

describe('installBackButtonHandler', () => {
  it('registers exactly one backButton listener (idempotent)', () => {
    installBackButtonHandler({ onBack, onExit, isRoot: () => isRoot });
    installBackButtonHandler({ onBack, onExit, isRoot: () => isRoot });
    expect(appMock.addListener).toHaveBeenCalledTimes(1);
  });

  it('pops history when not on the root tab', () => {
    isRoot = false;
    listeners[0]?.();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onExit).not.toHaveBeenCalled();
  });

  it('requires a second press within the window to exit from the root', () => {
    vi.useFakeTimers();
    const press = (): void => listeners[0]?.();

    // First press at root: no-op (starts the exit window).
    press();
    expect(onExit).not.toHaveBeenCalled();

    // Second press within 2s: exits.
    vi.advanceTimersByTime(500);
    press();
    expect(onExit).toHaveBeenCalledTimes(1);

    // Press after the window expired: starts a new window instead of exiting.
    vi.advanceTimersByTime(2500);
    press();
    expect(onExit).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    press();
    expect(onExit).toHaveBeenCalledTimes(2);
  });
});

describe('exitNativeApp', () => {
  it('calls the native app exit', () => {
    exitNativeApp();
    expect(appMock.exitApp).toHaveBeenCalled();
  });
});
