// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — UI Preferences Store (Zustand)
// Manages UI state: sidebar, preferences, modal/drawer states
// BLD-016-A — Application Shell & Foundation
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { create } from 'zustand';

// ── UI Store Types ──────────────────────────────────────────────────────────

export type ContentDensity = 'spacious' | 'comfortable' | 'compact';

interface UIState {
  /** Content density preference */
  contentDensity: ContentDensity;
  /** Whether AI companion panel is open */
  aiPanelOpen: boolean;
  /** Global search modal open */
  globalSearchOpen: boolean;
  /** Notification panel open */
  notificationsPanelOpen: boolean;
  /** EPIC-012C — AI World drawer open (the discovery bell panel). */
  aiWorldPanelOpen: boolean;

  // Actions
  setContentDensity: (density: ContentDensity) => void;
  toggleAiPanel: () => void;
  setAiPanelOpen: (open: boolean) => void;
  setGlobalSearchOpen: (open: boolean) => void;
  setNotificationsPanelOpen: (open: boolean) => void;
  setAIWorldPanelOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // ── State ───────────────────────────────────────────────────────────────
  contentDensity: 'comfortable',
  aiPanelOpen: false,
  globalSearchOpen: false,
  notificationsPanelOpen: false,
  aiWorldPanelOpen: false,

  // ── Actions (braces required for ESLint: no-confusing-void-expression) ──
  setContentDensity: (density: ContentDensity): void => {
    set({ contentDensity: density });
  },
  toggleAiPanel: (): void => {
    set((state) => ({ aiPanelOpen: !state.aiPanelOpen }));
  },
  setAiPanelOpen: (open: boolean): void => {
    set({ aiPanelOpen: open });
  },
  setGlobalSearchOpen: (open: boolean): void => {
    set({ globalSearchOpen: open });
  },
  setNotificationsPanelOpen: (open: boolean): void => {
    set({ notificationsPanelOpen: open });
  },
  setAIWorldPanelOpen: (open: boolean): void => {
    set({ aiWorldPanelOpen: open });
  },
}));
