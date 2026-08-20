// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — First-Run Preferences Store (Zustand + persist)
// SPRINT-048 — First-login intelligence
//
// Stores lightweight, non-secret first-run UI preferences. The only flag today
// is the Ollama first-run prompt dismissal ("don't interrupt me on every
// login"). This is client presentation state — no engine, no backend, no
// credentials. Persistence uses the same zustand/persist pattern as auth-store
// but with a plain storage adapter (safe on web and Capacitor webview).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const FIRST_RUN_PERSIST_KEY = 'vedmoulya-first-run';

/** In-memory storage fallback for SSR/test environments without localStorage. */
const memoryStorage = {
  getItem: (): string | null => null,
  setItem: (): void => {},
  removeItem: (): void => {},
};

interface FirstRunState {
  /** True once the founder has dismissed the first-run Ollama prompt. */
  ollamaPromptDismissed: boolean;
  dismissOllamaPrompt: () => void;
}

export const useFirstRunStore = create<FirstRunState>()(
  persist(
    (set) => ({
      ollamaPromptDismissed: false,
      dismissOllamaPrompt: () => {
        set({ ollamaPromptDismissed: true });
      },
    }),
    {
      name: FIRST_RUN_PERSIST_KEY,
      storage: createJSONStorage(() =>
        typeof window === 'undefined' ? memoryStorage : window.localStorage,
      ),
    },
  ),
);
