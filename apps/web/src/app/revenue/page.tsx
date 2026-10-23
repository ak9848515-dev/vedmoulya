// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Revenue (LEARN-REVENUE-002)
//
// Why this page exists: the earning surface already shipped, but it had no URL.
// The Founder Command Center — revenue streams, revenue against measured cost,
// the cost-weighted ranking, the opportunity radar and the bounded discovery /
// proposal-draft pass — was only mountable inside the assistant drawer, so no
// normal navigation path reached it.
//
// This route adds NO new backend contract and NO new data logic: it renders the
// SAME `<CommandCenter>` component over the SAME owner-scoped reads, opened on
// the revenue section instead of the briefing. The Intelligence tab of that
// component holds the opportunity radar and discovery pass, unchanged — and it
// still never bids, contacts a client or moves money.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Loading } from '@vedmoulya/ui';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import { PageContextBar } from '../../components/PageContextBar.js';
import { usePageContext } from '../../lib/use-page-context.js';
import { CommandCenter } from '../../components/CommandCenter.js';

export default function RevenuePage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const context = usePageContext({ pathname: '/revenue', label: 'Revenue' });

  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading your revenue..." size="lg" />
      </div>
    );
  }

  if (!user) {
    return <SignInRedirect />;
  }

  return (
    <div className="space-y-8">
      {/* Life → Revenue, derived from the one navigation model. */}
      <PageContextBar
        context={context}
        label="Revenue"
        description="Revenue is where the work you do turns into money you can see: streams, measured cost and the opportunities behind them."
      />

      <div>
        <h1 className="text-[28px] font-heading font-bold text-[#111827] dark:text-[#F1F5F9]">
          Revenue
        </h1>
        <p className="mt-1 text-[15px] text-[#64748B] dark:text-[#94A3B8] max-w-2xl">
          Revenue streams, revenue against measured cost and the cost-weighted ranking. The
          opportunity radar, discovery pass and proposal drafts are in the Intelligence tab.
        </p>
      </div>

      <ErrorBoundary section="revenue">
        <CommandCenter initialTab="portfolio" />
      </ErrorBoundary>
    </div>
  );
}
