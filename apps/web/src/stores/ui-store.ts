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
  /** A question queued from another surface (e.g. dashboard "Ask AI" insights)
   *  to be pre-filled into the companion input on open. Null when none.
   *  Honest hand-off between dashboard intelligence and the AI companion. (SPRINT-047) */
  pendingQuestion: string | null;
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
  setPendingQuestion: (question: string | null) => void;
  setGlobalSearchOpen: (open: boolean) => void;
  setNotificationsPanelOpen: (open: boolean) => void;
  setAIWorldPanelOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // ── State ───────────────────────────────────────────────────────────────
  contentDensity: 'comfortable',
  aiPanelOpen: false,
  pendingQuestion: null,
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
  setPendingQuestion: (question: string | null): void => {
    set({ pendingQuestion: question });
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
