// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — First-Run Preferences Store (Zustand + persist)
// SPRINT-048 — First-login intelligence
//
// Stores lightweight, non-secret first-run UI preferences. The flags today:
// the Ollama first-run prompt dismissal (SPRINT-048) and the first-login
// Gemini connect state (FINAL-02 — dismissed / connected). This is client
// presentation state — no engine, no backend, no credentials. Persistence
// uses the same zustand/persist pattern as auth-store but with a plain
// storage adapter (safe on web and Capacitor webview).
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
  /**
   * FINAL-02 — first-login Gemini connect. `geminiPromptDismissed` stores
   * "don't ask again"; `geminiConnectDone` stores "Gemini was connected (or a
   * provider is already configured)". Both are NON-SECRET UI preferences —
   * no credential ever lives here.
   */
  geminiPromptDismissed: boolean;
  geminiConnectDone: boolean;
  dismissGeminiPrompt: () => void;
  markGeminiConnectDone: () => void;
}

export const useFirstRunStore = create<FirstRunState>()(
  persist(
    (set) => ({
      ollamaPromptDismissed: false,
      dismissOllamaPrompt: (): void => {
        set({ ollamaPromptDismissed: true });
      },
      geminiPromptDismissed: false,
      geminiConnectDone: false,
      dismissGeminiPrompt: (): void => {
        set({ geminiPromptDismissed: true });
      },
      markGeminiConnectDone: (): void => {
        set({ geminiConnectDone: true, geminiPromptDismissed: true });
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
