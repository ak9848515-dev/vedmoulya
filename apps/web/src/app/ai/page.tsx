// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI (UX-02 destination)
//
// The single front door for VedMoulya's intelligence: providers, models,
// intelligence, memory, knowledge, context and the capability marketplace. All
// of those screens still exist at their own routes; they are simply reached from
// here with plain-language labels instead of competing for primary navigation.
//
// The status shown is the REAL runtime registry state (`useProviderRuntimeStatus`
// — the same source the provider screens use). Nothing is reported as connected
// just because a row exists.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import Link from 'next/link';
import { Card, Loading } from '@vedmoulya/ui';
import {
  ArrowRight,
  Boxes,
  BrainCircuit,
  Cpu,
  Database,
  Layers,
  Library,
  Store,
} from 'lucide-react';
import { useProviderRuntimeStatus } from '../../lib/api-client.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';

interface AILink {
  label: string;
  route: string;
  description: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

/**
 * Internal AI navigation. "Models" deliberately points at the ONE canonical
 * provider destination: model choice belongs to a provider, and UX-01 forbids a
 * second place to configure the same thing.
 */
const AI_LINKS: readonly AILink[] = [
  {
    label: 'Providers',
    route: '/providers',
    description: 'Connect and manage the AI VedMoulya uses.',
    icon: Cpu,
  },
  {
    label: 'Models',
    route: '/providers',
    description: 'Which model each provider is running.',
    icon: Boxes,
  },
  {
    label: 'Intelligence',
    route: '/intelligence',
    description: 'What your AI has noticed and decided.',
    icon: BrainCircuit,
  },
  {
    label: 'Memory',
    route: '/memory',
    description: 'What VedMoulya remembers about your journey.',
    icon: Database,
  },
  {
    label: 'Knowledge',
    route: '/knowledge',
    description: 'What you have taught it.',
    icon: Library,
  },
  {
    label: 'Context',
    route: '/context',
    description: 'What your AI considers before answering.',
    icon: Layers,
  },
  {
    label: 'Marketplace',
    route: '/capability-marketplace',
    description: 'Capabilities and skills you can add.',
    icon: Store,
  },
];

export default function AIPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const runtime = useProviderRuntimeStatus(userId);

  if (!hydrated || !sessionReady) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loading label="Checking your AI..." size="lg" />
      </div>
    );
  }
  if (!user) {
    return <SignInRedirect />;
  }

  // ── Honest AI status, straight from the runtime registry ──────────────────
  const providers = Array.isArray(runtime.data?.providers) ? runtime.data.providers : [];
  const connected = providers.filter((provider) => provider.status === 'CONFIGURED');
  const needsAttention = providers.filter((provider) => provider.status === 'ERROR');
  const runtimeKnown = runtime.data !== undefined;

  const status = !runtimeKnown
    ? { label: 'Checking…', tone: 'muted' as const, detail: 'Reading your AI configuration.' }
    : connected.length > 0
      ? {
          label: 'Connected',
          tone: 'ready' as const,
          detail: `AI is ready to run on ${connected.map((provider) => provider.name).join(', ')}.`,
        }
      : needsAttention.length > 0
        ? {
            label: 'Needs attention',
            tone: 'attention' as const,
            detail: 'Your AI configuration was rejected. Reconnect a provider to continue.',
          }
        : {
            label: 'Not connected',
            tone: 'idle' as const,
            detail:
              'No AI provider is connected yet — missions and planning stay quiet until one is.',
          };

  const toneClass =
    status.tone === 'ready'
      ? 'bg-[#F0FDF4] dark:bg-[#0F291D] border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400'
      : status.tone === 'attention'
        ? 'bg-[#FFFBEB] dark:bg-[#291704] border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400'
        : 'bg-[#F8FAFC] dark:bg-[#0F172A] border-[#E2E8F0] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8]';

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#2B5FD9] dark:text-[#6B8FEF]">
          AI
        </p>
        <h1 className="mt-1 text-[30px] leading-tight font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
          Your AI
        </h1>
        <p className="mt-2 text-[14px] text-[#64748B] dark:text-[#94A3B8] max-w-2xl">
          Providers, intelligence, memory and knowledge — one place to see what your AI is doing and
          what it knows.
        </p>
      </header>

      {/* ── Status (real registry state) ─────────────────────────────────── */}
      <Card className={`border ${toneClass}`}>
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-white/70 dark:bg-black/20 shrink-0">
            <BrainCircuit className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-[15px] font-semibold" data-testid="ai-status-label">
                {status.label}
              </p>
              {runtimeKnown && providers.length > 0 ? (
                <span className="text-[12px] opacity-80">
                  {connected.length} connected · {providers.length} known
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[13px] leading-relaxed opacity-90">{status.detail}</p>
            <Link
              href="/providers"
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline"
            >
              {status.tone === 'ready' ? 'Manage providers' : 'Connect AI'}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </Card>

      {runtime.isLoading ? (
        <div className="flex flex-col items-center justify-center h-[20vh] gap-3">
          <Loading label="Reading your AI..." size="md" />
        </div>
      ) : null}

      {/* ── Internal AI navigation ──────────────────────────────────────── */}
      <section aria-labelledby="ai-sections-heading">
        <h2
          id="ai-sections-heading"
          className="text-[20px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC] mb-4"
        >
          Explore your AI
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {AI_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={`${link.label}-${link.route}`}
                href={link.route}
                className="group flex items-start gap-3 rounded-[16px] border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-4 transition-colors hover:border-[#2B5FD9]/40"
              >
                <span className="p-2 rounded-xl bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 shrink-0">
                  <Icon className="h-5 w-5 text-[#2B5FD9] dark:text-[#6B8FEF]" aria-hidden={true} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                    {link.label}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                    {link.description}
                  </span>
                </span>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-[#CBD5E1] transition-transform group-hover:translate-x-0.5 dark:text-[#475569]"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
