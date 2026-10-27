'use client';

// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace
//
// Integrity repair (2026-10-26): every count, asset, provider, update and
// compatibility state on this screen is DERIVED from the real
// `marketplace.getMarketplace` snapshot (see `./marketplace-view.ts`).
//
// There is no install/uninstall mutation on the gateway, so the install
// controls are rendered DISABLED with the reason shown — the page never
// simulates a persisted install or a successful state change.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation.js';
import {
  Card,
  Badge,
  Button,
  Tabs as TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
  Loading,
} from '@vedmoulya/ui';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import { Store, Package, Cpu, RefreshCw, GitCompare, Shield, AlertTriangle } from 'lucide-react';
import { useMarketplace } from '../../lib/api-client.js';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import { AIContextBar } from '../ai/_components/AIContextBar.js';
import {
  MARKETPLACE_INSTALL_AVAILABLE,
  MARKETPLACE_INSTALL_UNAVAILABLE_REASON,
  compatibilityLabel,
  deriveMarketplaceView,
  updatesBadgeText,
  type MarketplaceAssetView,
} from './marketplace-view.js';

export default function MarketplacePage(): React.JSX.Element {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const marketplaceQuery = useMarketplace(userId);
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const [activeTab, setActiveTab] = React.useState('overview');

  useEffect(() => {
    setActiveSection('marketplace');
    setBreadcrumbs([{ label: 'Marketplace', href: '/marketplace' }, { label: 'Overview' }]);
  }, [setActiveSection, setBreadcrumbs]);

  // The gateway returns an `{ success, data }` envelope; the derivation reads
  // only that payload. A transport error yields no payload → `unavailable`.
  const view = useMemo(() => deriveMarketplaceView(marketplaceQuery.data), [marketplaceQuery.data]);

  // Hydration guard: prevent SSR/client mismatch from zustand persist
  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading Marketplace..." size="lg" />
      </div>
    );
  }

  if (!user) {
    return <SignInRedirect />;
  }

  if (marketplaceQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading Marketplace..." size="lg" />
      </div>
    );
  }

  const updateBadge = updatesBadgeText(view.counts.updates);

  const stats: Array<{
    label: string;
    value: string;
    detail: string;
    icon: React.ReactNode;
    bg: string;
  }> = [
    {
      label: 'Installed Assets',
      value: String(view.counts.installedAssets),
      detail: 'from marketplace.installedAssets',
      icon: <Package className="h-5 w-5 text-[#2B5FD9]" />,
      bg: 'bg-[#EFF4FE]',
    },
    {
      label: 'AI Providers',
      value: String(view.counts.providers),
      detail: 'from marketplace.providers',
      icon: <Cpu className="h-5 w-5 text-[#7C3AED]" />,
      bg: 'bg-[#F5F3FF]',
    },
    {
      label: 'Updates',
      value: String(view.counts.updates),
      detail: 'from marketplace.availableUpdates',
      icon: <RefreshCw className="h-5 w-5 text-[#F59E0B]" />,
      bg: 'bg-[#FFFBEB]',
    },
    {
      label: 'Templates',
      value: String(view.counts.templates),
      detail: 'template-type assets in catalog',
      icon: <GitCompare className="h-5 w-5 text-[#22C55E]" />,
      bg: 'bg-[#F0FDF4]',
    },
    {
      label: 'Compatibility',
      value:
        view.counts.compatibilityTotal === 0
          ? 'Not checked'
          : `${String(view.counts.compatibilityPassed)}/${String(view.counts.compatibilityTotal)}`,
      detail: compatibilityLabel(view.compatibility),
      icon: <Shield className="h-5 w-5 text-[#3B82F6]" />,
      bg: 'bg-[#EFF6FF]',
    },
  ];

  return (
    <div className="space-y-8">
      <AIContextBar
        sectionId="marketplace"
        pageLabel="Platform Marketplace"
        pathname="/marketplace"
      />
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[28px] font-heading font-bold text-[#111827]">Marketplace</h1>
            <Badge variant="new" size="sm">
              Extensible
            </Badge>
          </div>
          <p className="text-[15px] text-[#64748B]">
            Discover and review platform assets, providers, and templates
          </p>
        </div>
        {updateBadge ? (
          <Badge variant="warning" size="md" className="flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> {updateBadge}
          </Badge>
        ) : null}
      </div>

      {/* Transport error — the snapshot could not be fetched at all. */}
      {marketplaceQuery.isError ? (
        <Card variant="standard" padding="md">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-[#EF4444] mt-0.5" />
            <div className="space-y-2">
              <p className="text-[14px] font-medium text-[#111827]">
                The marketplace snapshot could not be loaded.
              </p>
              <p className="text-[13px] text-[#64748B]">
                {marketplaceQuery.error instanceof Error
                  ? marketplaceQuery.error.message
                  : 'The gateway request failed.'}
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  void marketplaceQuery.refetch();
                }}
              >
                Retry
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Honest states — unavailable payload or a genuinely empty catalog. */}
      {!marketplaceQuery.isError && view.availability === 'unavailable' ? (
        <Card variant="standard" padding="md">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-[#F59E0B] mt-0.5" />
            <div>
              <p className="text-[14px] font-medium text-[#111827]">
                Marketplace data is unavailable.
              </p>
              <p className="text-[13px] text-[#64748B]">
                {view.unavailableReason ?? 'No snapshot was received from the gateway.'}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {!marketplaceQuery.isError && view.availability === 'empty' ? (
        <Card variant="standard" padding="md">
          <div className="flex items-start gap-3">
            <Package className="h-5 w-5 text-[#94A3B8] mt-0.5" />
            <div>
              <p className="text-[14px] font-medium text-[#111827]">The catalog is empty.</p>
              <p className="text-[13px] text-[#64748B]">
                The marketplace service returned no assets, providers or updates for this workspace.
                Assets must be registered by the platform before they can be listed here — nothing
                is displayed that the backend did not return.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Stats Grid — derived from the snapshot only. */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} variant="standard" padding="md">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>{stat.icon}</div>
              <div>
                <p className="text-[11px] text-[#64748B] font-medium">{stat.label}</p>
                <p className="text-[20px] font-bold text-[#111827]">{stat.value}</p>
                <p className="text-[10px] text-[#94A3B8]">{stat.detail}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {MARKETPLACE_INSTALL_AVAILABLE ? null : (
        <Card variant="standard" padding="md">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-[#F59E0B] mt-0.5" />
            <p className="text-[12px] text-[#64748B]">{MARKETPLACE_INSTALL_UNAVAILABLE_REASON}</p>
          </div>
        </Card>
      )}

      <TabsRoot value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <Store className="h-4 w-4 mr-1.5" /> Catalog
          </TabsTrigger>
          <TabsTrigger value="installed">
            <Package className="h-4 w-4 mr-1.5" /> Installed
          </TabsTrigger>
          <TabsTrigger value="providers">
            <Cpu className="h-4 w-4 mr-1.5" /> Providers
          </TabsTrigger>
          <TabsTrigger value="updates">
            <RefreshCw className="h-4 w-4 mr-1.5" /> Updates
          </TabsTrigger>
          <TabsTrigger value="compatibility">
            <GitCompare className="h-4 w-4 mr-1.5" /> Compatibility
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ErrorBoundary section="marketplace-catalog">
            {view.assets.length === 0 ? (
              <Card variant="standard" padding="lg">
                <p className="text-[14px] text-[#64748B]">
                  No catalog assets were returned by the marketplace service.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {view.assets.map((asset: MarketplaceAssetView) => (
                  <Card
                    key={asset.id}
                    variant="standard"
                    padding="md"
                    className="hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${asset.installed ? 'bg-[#F0FDF4]' : 'bg-[#EFF6FF]'}`}
                        >
                          <Package
                            className={`h-4 w-4 ${asset.installed ? 'text-[#22C55E]' : 'text-[#3B82F6]'}`}
                          />
                        </div>
                        <div>
                          <p className="text-[14px] font-medium text-[#374151]">{asset.name}</p>
                          <p className="text-[11px] text-[#94A3B8]">
                            v{asset.version} · {asset.type}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={asset.installed ? 'success' : 'info'} size="sm">
                          {asset.installed ? 'Installed' : 'Available'}
                        </Badge>
                        {asset.updateAvailable ? (
                          <Badge variant="warning" size="sm">
                            Update
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled
                      title={MARKETPLACE_INSTALL_UNAVAILABLE_REASON}
                      aria-disabled="true"
                      className="mt-4 w-full py-2 rounded-lg text-[13px] font-medium bg-[#F1F5F9] text-[#94A3B8] cursor-not-allowed"
                    >
                      Install unavailable
                    </button>
                  </Card>
                ))}
              </div>
            )}
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="installed">
          <ErrorBoundary section="marketplace-installed">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">Installed Assets</h3>
              <p className="text-[14px] text-[#64748B] mt-1 mb-4">
                Assets the marketplace service reports as installed for this workspace.
              </p>
              {view.installedAssets.length === 0 ? (
                <p className="text-[13px] text-[#94A3B8]">No assets are installed.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {view.installedAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="p-3.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] flex items-center justify-between"
                    >
                      <div>
                        <p className="text-[14px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                          {asset.name}
                        </p>
                        <p className="text-[12px] text-[#64748B]">
                          v{asset.version} · {asset.type}
                          {asset.active ? ' · active' : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled
                        title={MARKETPLACE_INSTALL_UNAVAILABLE_REASON}
                        aria-disabled="true"
                        className="text-[12px] text-[#94A3B8] font-medium px-2.5 py-1 rounded-lg border border-[#E2E8F0] cursor-not-allowed"
                      >
                        Uninstall unavailable
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="providers">
          <ErrorBoundary section="marketplace-providers">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">AI Providers</h3>
              <p className="text-[14px] text-[#64748B] mt-2 mb-4">
                Providers reported by the marketplace service, with the status it reported.
              </p>
              {view.providers.length === 0 ? (
                <p className="text-[13px] text-[#94A3B8] mb-4">
                  No marketplace providers were returned.
                </p>
              ) : (
                <div className="space-y-2 mb-4">
                  {view.providers.map((provider) => (
                    <div
                      key={provider.id}
                      className="p-3 rounded-xl border border-[#E2E8F0] flex items-center justify-between"
                    >
                      <div>
                        <p className="text-[14px] font-medium text-[#111827]">{provider.name}</p>
                        <p className="text-[12px] text-[#64748B]">
                          {provider.type} · API key{' '}
                          {provider.apiKeyConfigured ? 'configured' : 'not configured'}
                        </p>
                      </div>
                      <Badge
                        variant={
                          provider.status === 'active'
                            ? 'success'
                            : provider.status === 'error'
                              ? 'danger'
                              : 'default'
                        }
                        size="sm"
                      >
                        {provider.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  router.push('/providers');
                }}
              >
                Go to AI Providers →
              </Button>
            </Card>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="updates">
          <ErrorBoundary section="marketplace-updates">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">Updates & Versions</h3>
              {view.updates.length === 0 ? (
                <p className="text-[13px] text-[#94A3B8] mt-2">
                  No updates are reported by the marketplace service.
                </p>
              ) : (
                <div className="space-y-2 mt-3">
                  {view.updates.map((update) => (
                    <div
                      key={update.id}
                      className="p-3 rounded-xl border border-[#E2E8F0] flex items-center justify-between"
                    >
                      <div>
                        <p className="text-[14px] font-medium text-[#111827]">{update.assetName}</p>
                        <p className="text-[12px] text-[#64748B]">→ v{update.version}</p>
                      </div>
                      {update.breaking ? (
                        <Badge variant="danger" size="sm">
                          Breaking
                        </Badge>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="compatibility">
          <ErrorBoundary section="marketplace-compatibility">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">Compatibility</h3>
              <p className="text-[14px] text-[#64748B] mt-2">
                Overall: {compatibilityLabel(view.compatibility)}
                {view.compatibility.platformVersion
                  ? ` · platform ${view.compatibility.platformVersion}`
                  : ''}
                {view.counts.compatibilityTotal > 0
                  ? ` · ${String(view.counts.compatibilityPassed)} of ${String(view.counts.compatibilityTotal)} checks passed`
                  : ' · no compatibility checks have run'}
              </p>
              {view.compatibility.issues.length > 0 ? (
                <ul className="mt-3 list-disc pl-5 text-[13px] text-[#EF4444]">
                  {view.compatibility.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : null}
              {view.compatibility.warnings.length > 0 ? (
                <ul className="mt-3 list-disc pl-5 text-[13px] text-[#F59E0B]">
                  {view.compatibility.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </Card>
          </ErrorBoundary>
        </TabsContent>
      </TabsRoot>
    </div>
  );
}
