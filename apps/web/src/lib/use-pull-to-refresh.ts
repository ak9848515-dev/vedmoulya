// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Pull-to-Refresh Hook (MOB-002)
// Touch-driven pull-to-refresh for the Capacitor WebView and mobile browsers.
// The page attaches its root ref; the hook resolves the AppShell scroll
// container (`[data-scroll-container]`) and binds passive touch listeners
// there, tracking a downward drag past the scroll top and firing the refresh
// callback once the threshold is crossed — native-feeling, with haptics.
//
// The root ref is a *callback* ref wired to a state bump, so the listeners
// re-bind whenever the page root (un)mounts — this matters because the
// dashboard renders loading skeletons / error states without the root div
// first, then mounts the real content once data arrives.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { hapticRefresh } from './haptics.js';

export interface PullToRefreshOptions {
  /** Called when the user releases past the threshold. Must resolve when done. */
  onRefresh: () => Promise<unknown> | undefined;
  /** Pull distance (px) required to trigger. */
  threshold?: number;
  /** Pull resistance factor (0..1] — lower = stiffer. */
  resistance?: number;
}

export interface PullToRefreshState {
  /** Current visual pull distance in px (0 when idle). */
  pullDistance: number;
  /** True while the refresh promise is in flight. */
  refreshing: boolean;
  /** Bind to the page root: `<div ref={pageRef} className="relative">`. */
  pageRef: (node: HTMLDivElement | null) => void;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 72,
  resistance = 0.45,
}: PullToRefreshOptions): PullToRefreshState {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // Bumped whenever the page root (un)mounts → re-binds the touch listeners.
  const [rootVersion, setRootVersion] = useState(0);

  // Mirrors so touch listeners never close over stale values.
  const refreshingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const startYRef = useRef<number | null>(null);

  // Callback ref: tracks the root element AND re-resolves the scroller so the
  // binding effect re-runs when the loaded view finally mounts.
  const setPageRoot = useCallback((node: HTMLDivElement | null): void => {
    pageRef.current = node;
    const found = node?.closest('[data-scroll-container]');
    scrollerRef.current = found instanceof HTMLElement ? found : null;
    setRootVersion((v) => v + 1);
  }, []);

  const runRefresh = useCallback((): Promise<unknown> => {
    if (refreshingRef.current) return Promise.resolve();
    refreshingRef.current = true;
    setRefreshing(true);
    setPullDistance(0);
    pullDistanceRef.current = 0;
    void hapticRefresh();
    return Promise.resolve(onRefresh()).finally(() => {
      refreshingRef.current = false;
      setRefreshing(false);
    });
  }, [onRefresh]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;

    const onTouchStart = (e: TouchEvent): void => {
      if (refreshingRef.current) return;
      // Native convention: only pull when the scroller is at the very top.
      if (scroller.scrollTop > 2) return;
      startYRef.current = e.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (e: TouchEvent): void => {
      if (startYRef.current === null || refreshingRef.current) return;
      const delta = (e.touches[0]?.clientY ?? startYRef.current) - startYRef.current;
      if (delta <= 0) {
        setPullDistance(0);
        pullDistanceRef.current = 0;
        return;
      }
      // Stop the scroller from rubber-banding while we pull.
      if (scroller.scrollTop <= 0) {
        e.preventDefault();
      }
      const damped = delta * resistance;
      pullDistanceRef.current = damped;
      setPullDistance(damped);
    };

    const onTouchEnd = (): void => {
      const wasDragging = startYRef.current !== null;
      startYRef.current = null;
      if (wasDragging && pullDistanceRef.current >= threshold && !refreshingRef.current) {
        void runRefresh();
      } else {
        setPullDistance(0);
        pullDistanceRef.current = 0;
      }
    };

    // A gesture cancellation (system interruption) must NOT trigger refresh —
    // it only resets the pull indicator.
    const onTouchCancel = (): void => {
      startYRef.current = null;
      setPullDistance(0);
      pullDistanceRef.current = 0;
    };

    scroller.addEventListener('touchstart', onTouchStart, { passive: true });
    scroller.addEventListener('touchmove', onTouchMove, { passive: false });
    scroller.addEventListener('touchend', onTouchEnd);
    scroller.addEventListener('touchcancel', onTouchCancel);
    return (): void => {
      scroller.removeEventListener('touchstart', onTouchStart);
      scroller.removeEventListener('touchmove', onTouchMove);
      scroller.removeEventListener('touchend', onTouchEnd);
      scroller.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [threshold, resistance, runRefresh, rootVersion]);

  return { pullDistance, refreshing, pageRef: setPageRoot };
}
