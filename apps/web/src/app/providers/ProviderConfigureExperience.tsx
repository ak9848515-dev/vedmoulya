// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — which configuration surface the "Configure AI" view renders.
//
// G9 GATE: the one-click Connect pipeline only covers the gateway's closed
// connect contract (PROVIDER_CONTRACT_FAMILIES). A REGISTRY-only family
// (openrouter, mock, a user-defined custom endpoint like "acme-ai") cannot be
// probed by it, so the flow is NEVER rendered for one: the view states why and
// shows the existing advanced configuration instead of silently probing the
// provider as an OpenAI-compatible endpoint.
//
// Extracted from page.tsx (a Next.js page module may only export its page
// fields) so the gate decision is render-testable on its own. The surfaces
// themselves stay in their own components — this only chooses between them.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Settings2 } from 'lucide-react';

export interface ProviderConfigureExperienceProps {
  /** The provider's user-facing name (registry identity). */
  providerName: string;
  /** True when the registry family is part of the gateway's connect contract. */
  oneClickSupported: boolean;
  /** The one-click G9 setup surface (ProviderConnectFlow). */
  connectFlow: React.ReactNode;
  /** The pre-existing advanced configuration surface (ProviderConfigScreen). */
  advancedSetup: React.ReactNode;
  /**
   * Whether the advanced surface is disclosed when one-click IS supported
   * (it is the [Advanced] affordance). When the flow is gated out the advanced
   * surface is the ONLY path, so it is always rendered.
   */
  advancedDisclosed: boolean;
}

/**
 * Render the one-click flow for a contract family, or — for a registry-only
 * family — an explicit explanation plus the advanced configuration.
 */
export function ProviderConfigureExperience({
  providerName,
  oneClickSupported,
  connectFlow,
  advancedSetup,
  advancedDisclosed,
}: ProviderConfigureExperienceProps): React.JSX.Element {
  if (oneClickSupported) {
    return (
      <>
        {connectFlow}
        {advancedDisclosed ? advancedSetup : null}
      </>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up" data-testid="provider-one-click-gate">
      <div
        data-testid="provider-one-click-unavailable"
        className="flex items-start gap-2.5 rounded-2xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] px-4 py-3.5"
      >
        <Settings2 className="mt-0.5 h-4 w-4 shrink-0 text-[#64748B]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium text-[#111827] dark:text-[#F8FAFC]">
            {providerName} uses the advanced setup
          </p>
          <p className="mt-0.5 text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
            One-click connect covers VedMoulya&apos;s built-in AIs. This AI is a custom or registry
            endpoint, so it needs its own address and protocol — configure it below.
          </p>
        </div>
      </div>
      {advancedSetup}
    </div>
  );
}
