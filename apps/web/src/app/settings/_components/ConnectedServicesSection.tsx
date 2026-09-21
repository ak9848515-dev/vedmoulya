// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Settings → Connected Services (UX-07)
//
// REPLACES the old "API & Integrations" tab, which fabricated its state
// ("3 providers configured", "Connected via tRPC · Active") with no data behind
// it and duplicated provider configuration.
//
// This section reports the REAL provider runtime registry state
// (useProviderRuntimeStatus — the same source the AI experience uses) and links
// to /providers for anything actionable. It configures nothing itself.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import Link from 'next/link';
import { Badge, Card, Loading } from '@vedmoulya/ui';
import { AlertTriangle, ArrowRight, Cpu, Plug } from 'lucide-react';
import { useProviderRuntimeStatus } from '../../../lib/api-client.js';
import { useAuthStore } from '../../../stores/auth-store.js';

function StatRow({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[#F1F5F9] dark:border-[#334155] last:border-0">
      <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">{label}</p>
      <p
        className="text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC] text-right"
        data-testid={testId}
      >
        {value}
      </p>
    </div>
  );
}

export function ConnectedServicesSection(): React.JSX.Element {
  const { user } = useAuthStore();
  const userId = user?.userId ?? '';
  const runtime = useProviderRuntimeStatus(userId);

  if (runtime.isLoading) {
    return (
      <Card variant="standard" padding="lg">
        <div className="flex items-center justify-center py-8" data-testid="services-loading">
          <Loading label="Reading connected services…" size="md" />
        </div>
      </Card>
    );
  }

  if (runtime.isError || !runtime.data) {
    return (
      <Card variant="standard" padding="lg" data-testid="services-error">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#EF4444]" aria-hidden="true" />
          <div>
            <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
              Unable to read connected services
            </h3>
            <p className="mt-1 text-[13px] text-[#64748B] dark:text-[#94A3B8]">
              The provider runtime registry did not answer. Nothing is reported as connected until
              it does.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const providers = runtime.data.providers;
  const connected = providers.filter((provider) => provider.status === 'CONFIGURED');
  const needsAttention = providers.filter((provider) => provider.status === 'ERROR');
  const notConfigured = providers.filter(
    (provider) => provider.status !== 'CONFIGURED' && provider.status !== 'ERROR',
  );

  return (
    <Card variant="standard" padding="lg" data-testid="settings-services">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-[18px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Connected services
          </h3>
          <p className="mt-1 text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            What VedMoulya can currently reach. This is read from the provider runtime registry.
          </p>
        </div>
        <Badge variant={connected.length > 0 ? 'success' : 'default'} size="sm">
          {connected.length > 0 ? `${connected.length} connected` : 'None connected'}
        </Badge>
      </div>

      <div className="space-y-0 mb-5">
        <StatRow label="Runtime mode" value={runtime.data.mode} testId="services-mode" />
        <StatRow
          label="Default provider"
          value={runtime.data.defaultProvider || '—'}
          testId="services-default-provider"
        />
        <StatRow label="Providers known" value={String(providers.length)} testId="services-known" />
        <StatRow label="Connected" value={String(connected.length)} testId="services-connected" />
        <StatRow
          label="Needs attention"
          value={String(needsAttention.length)}
          testId="services-attention"
        />
        <StatRow
          label="Not configured"
          value={String(notConfigured.length)}
          testId="services-unconfigured"
        />
      </div>

      {connected.length > 0 ? (
        <ul className="mb-5 space-y-1.5" data-testid="services-connected-list">
          {connected.map((provider) => (
            <li
              key={provider.family}
              className="flex items-center gap-2 text-[13px] text-[#374151] dark:text-[#E2E8F0]"
            >
              <Plug className="h-3.5 w-3.5 text-[#22C55E]" aria-hidden="true" />
              {provider.name}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="pt-5 border-t border-[#E2E8F0] dark:border-[#334155]">
        <p className="text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
          Connecting, disconnecting and choosing models happens in the AI experience — this screen
          never configures providers a second time.
        </p>
        <Link
          href="/providers"
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
        >
          <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
          Manage AI providers
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </Card>
  );
}
