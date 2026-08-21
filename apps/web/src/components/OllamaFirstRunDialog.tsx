// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — First-Run "Your Private AI Option" Dialog (Ollama)
// SPRINT-048 — First-login intelligence
//
// A tasteful, once-only, non-blocking prompt shown after the founder signs in
// for the first time. It explains the private/local AI option and links to the
// existing AI Providers configuration (deep link → /providers?provider=ollama).
//
// Honesty: this dialog NEVER claims Ollama is detected, installed, connected
// or healthy — no live detection is performed (that is an operator/runtime
// step). Skipping persists and never re-appears (first-run-store); Ollama is
// never required for basic VedMoulya use. Keyboard + reduced-motion safe
// (Dialog is Radix-based; the global prefers-reduced-motion rule collapses all
// animation durations).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogPortal, DialogOverlay, DialogContent } from '@vedmoulya/ui';
import { Cpu, Lock, ArrowRight, WifiOff } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store.js';
import { useFirstRunStore } from '../stores/first-run-store.js';

export function OllamaFirstRunDialog(): React.JSX.Element {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const dismissed = useFirstRunStore((s) => s.ollamaPromptDismissed);
  const dismiss = useFirstRunStore((s) => s.dismissOllamaPrompt);

  // Shown exactly once: signed in AND never dismissed. Signing out closes it.
  const open = Boolean(user) && !dismissed;

  const openProviderSetup = (): void => {
    dismiss();
    router.push('/providers?provider=ollama');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogPortal>
        <DialogOverlay />
        <DialogContent
          size="md"
          aria-label="Your Private AI Option"
          className="dark:bg-[#1E293B] dark:border dark:border-[#334155]"
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-[#F5F3FF] dark:bg-[#2E1065] shrink-0">
              <Cpu className="h-5 w-5 text-[#7C3AED]" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7C3AED] dark:text-[#A78BFA]">
                Your Private AI Option
              </p>
              <h2 className="text-[20px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC] mt-1">
                Run AI locally with Ollama
              </h2>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {[
              { icon: <Lock className="h-3.5 w-3.5" />, label: 'Private — stays on your machine' },
              { icon: <Cpu className="h-3.5 w-3.5" />, label: 'Local — no cloud round-trip' },
              { icon: <WifiOff className="h-3.5 w-3.5" />, label: 'No cloud API key required' },
            ].map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-2.5 text-[13px] text-[#374151] dark:text-[#E2E8F0]"
              >
                <span className="text-[#0EA5A9]" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[12px] leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
            Available whenever Ollama is running on this machine. VedMoulya works fully without it —
            you can add this option any time from AI Providers.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={openProviderSetup}
              className="inline-flex h-10 items-center gap-2 rounded-[14px] bg-[#2B5FD9] px-4 text-[14px] font-medium text-white transition-all hover:bg-[#1E4AA8] active:scale-95"
            >
              Set Up Ollama <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex h-10 items-center rounded-[14px] border border-[#CBD5E1] px-4 text-[14px] font-medium text-[#374151] transition-colors hover:bg-[#F1F5F9] dark:border-[#334155] dark:text-[#E2E8F0] dark:hover:bg-[#0F172A]"
            >
              Skip for now
            </button>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
