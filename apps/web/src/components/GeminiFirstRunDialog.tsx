// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — First-Login "Connect your AI" Dialog (Google Gemini)
// FINAL-02 — first-login Gemini auto-configuration.
//
// Shown ONCE after sign-in when no provider setup has happened yet. Honest by
// design: a Google sign-in is NOT Gemini API access, so the dialog says so
// and collects only the credential actually required (or nothing at all when
// this deployment already runs a server-managed Gemini key). The flow:
// Connect → (credential only if required) → server-side test → real model
// discovery → Save & Enable → success checklist. Skipping persists and never
// blocks VedMoulya — providers can be configured any time from /providers.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogPortal, DialogOverlay, DialogContent } from '@vedmoulya/ui';
import { Sparkles, ArrowRight, ShieldCheck, CheckCircle2, Cpu } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store.js';
import { useFirstRunStore } from '../stores/first-run-store.js';
import { useProviderRuntimeStatus } from '../lib/api-client.js';
import { SimpleProviderConfig } from '../app/providers/SimpleProviderConfig.js';

type Step = 'intro' | 'connect' | 'success';

export function GeminiFirstRunDialog(): React.JSX.Element {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const dismissed = useFirstRunStore((s) => s.geminiPromptDismissed);
  const connectDone = useFirstRunStore((s) => s.geminiConnectDone);
  const dismiss = useFirstRunStore((s) => s.dismissGeminiPrompt);
  const markDone = useFirstRunStore((s) => s.markGeminiConnectDone);
  const [step, setStep] = useState<Step>('intro');
  const [connectedModelName, setConnectedModelName] = useState<string | null>(null);
  // Local hide: closes the dialog for THIS mount once the user takes a
  // success action (persisted flags already cover future sessions).
  const [hidden, setHidden] = useState(false);

  const userId = user?.userId ?? '';
  const runtimeStatus = useProviderRuntimeStatus(userId);
  const geminiRuntime = (runtimeStatus.data?.providers ?? []).find((p) => p.family === 'google');
  const runtimeConfigured = geminiRuntime?.status === 'CONFIGURED';

  // Shown exactly once per browser: signed in, never dismissed, and Gemini
  // connect not already completed. The success step stays visible even after
  // markGeminiConnectDone persists the completion (otherwise the checklist
  // would be unreachable — the dialog would vanish the moment Save & Enable
  // lands). Dismissing never blocks VedMoulya.
  const open = Boolean(user) && !hidden && (step === 'success' || (!dismissed && !connectDone));

  const handleConfigured = (modelName?: string): void => {
    markDone();
    setConnectedModelName(modelName ?? null);
    setStep('success');
  };

  const openProvidersPage = (): void => {
    dismiss();
    setHidden(true);
    router.push('/providers?provider=google');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          // Closing from the success step persists completion; closing any
          // earlier step is a plain dismissal. Neither blocks VedMoulya.
          if (step === 'success') markDone();
          else dismiss();
          setHidden(true);
        }
      }}
    >
      <DialogPortal>
        <DialogOverlay />
        <DialogContent
          size={step === 'connect' ? 'lg' : 'md'}
          aria-label="Connect your AI"
          className="dark:bg-[#1E293B] dark:border dark:border-[#334155]"
        >
          {step === 'intro' ? (
            <div data-testid="gemini-intro">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 shrink-0">
                  <Sparkles className="h-5 w-5 text-[#2B5FD9]" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#2B5FD9] dark:text-[#6B8FEF]">
                    Welcome to VedMoulya
                  </p>
                  <h2 className="text-[20px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC] mt-1">
                    Let&apos;s connect your AI
                  </h2>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[#E2E8F0] dark:border-[#334155] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Cpu className="h-4 w-4 text-[#2B5FD9]" aria-hidden="true" />
                    <p className="text-[14px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                      Google Gemini
                    </p>
                  </div>
                  <span className="rounded-full bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-semibold text-[#B45309] dark:bg-[#422006] dark:text-[#FBBF24]">
                    Recommended
                  </span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                  Your Google sign-in is separate from Gemini API access. Connect Gemini securely to
                  enable AI features — VedMoulya will verify the connection and pick a model with
                  you.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setStep('connect');
                  }}
                  data-testid="gemini-connect-start"
                  className="inline-flex h-10 items-center gap-2 rounded-[14px] bg-[#2B5FD9] px-4 text-[14px] font-medium text-white transition-all hover:bg-[#1E4AA8] active:scale-95"
                >
                  Connect Gemini <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="inline-flex h-9 items-center rounded-[12px] px-3 text-[13px] font-medium text-[#94A3B8] transition-colors hover:text-[#64748B] dark:hover:text-[#CBD5E1]"
                >
                  Not now
                </button>
              </div>
              <p className="mt-3 text-[11.5px] text-[#94A3B8]">
                You can add any provider later from AI Providers — nothing is blocked until then.
              </p>
            </div>
          ) : step === 'connect' ? (
            <div data-testid="gemini-connect">
              <SimpleProviderConfig
                userId={userId}
                presetId="google"
                variant="dialog"
                onConfigured={handleConfigured}
              />
            </div>
          ) : (
            <div data-testid="gemini-success">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-[#F0FDF4] dark:bg-[#0F291D] shrink-0">
                  <ShieldCheck
                    className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-600 dark:text-emerald-400">
                    Connected
                  </p>
                  <h2 className="text-[20px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC] mt-1">
                    Gemini is ready
                  </h2>
                </div>
              </div>
              <ul className="mt-4 space-y-2" data-testid="gemini-success-checklist">
                {[
                  'Gemini connected',
                  connectedModelName ? `Model detected: ${connectedModelName}` : 'Model detected',
                  'Provider enabled',
                  ...(runtimeConfigured ? ['Ready to use'] : []),
                ].map((line) => (
                  <li
                    key={line}
                    className="flex items-center gap-2.5 text-[13px] text-[#374151] dark:text-[#E2E8F0]"
                  >
                    <CheckCircle2
                      className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                    {line}
                  </li>
                ))}
              </ul>
              {!runtimeConfigured ? (
                <p className="mt-3 text-[12px] leading-relaxed text-amber-700 dark:text-amber-400">
                  This connection is verified. AI execution activates when this deployment&apos;s
                  runtime has the Gemini credential configured server-side (AI_GOOGLE_API_KEY) — the
                  provider page shows the current state honestly.
                </p>
              ) : null}
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setHidden(true);
                    router.push('/dashboard');
                  }}
                  data-testid="gemini-success-done"
                  className="inline-flex h-10 items-center gap-2 rounded-[14px] bg-[#2B5FD9] px-4 text-[14px] font-medium text-white transition-all hover:bg-[#1E4AA8] active:scale-95"
                >
                  Start using VedMoulya <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={openProvidersPage}
                  className="inline-flex h-10 items-center rounded-[14px] border border-[#CBD5E1] px-4 text-[14px] font-medium text-[#374151] transition-colors hover:bg-[#F1F5F9] dark:border-[#334155] dark:text-[#E2E8F0] dark:hover:bg-[#0F172A]"
                >
                  Review AI Providers
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
