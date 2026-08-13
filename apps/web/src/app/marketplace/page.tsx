'use client';

import React, { useEffect } from 'react';
import {
  Card,
  Badge,
  Tabs as TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
  Loading,
} from '@vedmoulya/ui';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import { Store, Package, Cpu, RefreshCw, GitCompare, Shield, Sparkles } from 'lucide-react';
import { useMarketplace } from '../../lib/api-client.js';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';

export default function MarketplacePage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { isLoading } = useMarketplace(userId);
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const [activeTab, setActiveTab] = React.useState('overview');

  useEffect(() => {
    setActiveSection('marketplace');
    setBreadcrumbs([{ label: 'Marketplace', href: '/marketplace' }, { label: 'Overview' }]);
  }, [setActiveSection, setBreadcrumbs]);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading Marketplace..." size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
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
            Discover, install, and manage platform assets, providers, and templates
          </p>
        </div>
        <Badge variant="info" size="md" className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> 2 Updates Available
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          {
            label: 'Installed Assets',
            value: '12',
            icon: <Package className="h-5 w-5 text-[#2B5FD9]" />,
            bg: 'bg-[#EFF4FE]',
          },
          {
            label: 'AI Providers',
            value: '3',
            icon: <Cpu className="h-5 w-5 text-[#7C3AED]" />,
            bg: 'bg-[#F5F3FF]',
          },
          {
            label: 'Updates',
            value: '2',
            icon: <RefreshCw className="h-5 w-5 text-[#F59E0B]" />,
            bg: 'bg-[#FFFBEB]',
          },
          {
            label: 'Templates',
            value: '8',
            icon: <GitCompare className="h-5 w-5 text-[#22C55E]" />,
            bg: 'bg-[#F0FDF4]',
          },
          {
            label: 'Compatible',
            value: '100%',
            icon: <Shield className="h-5 w-5 text-[#3B82F6]" />,
            bg: 'bg-[#EFF6FF]',
          },
        ].map((stat) => (
          <Card key={stat.label} variant="standard" padding="md">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>{stat.icon}</div>
              <div>
                <p className="text-[11px] text-[#64748B] font-medium">{stat.label}</p>
                <p className="text-[20px] font-bold text-[#111827]">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  name: 'Prompt Pack: Executive',
                  type: 'Template',
                  status: 'Installed' as const,
                  version: '2.1.0',
                },
                {
                  name: 'Workflow: Weekly Review',
                  type: 'Automation',
                  status: 'Available' as const,
                  version: '1.0.0',
                },
                {
                  name: 'Knowledge Pack: TypeScript',
                  type: 'Knowledge',
                  status: 'Installed' as const,
                  version: '3.0.0',
                },
                {
                  name: 'Assessment: Leadership',
                  type: 'Assessment',
                  status: 'Available' as const,
                  version: '1.2.0',
                },
                {
                  name: 'Career Template: Tech Lead',
                  type: 'Template',
                  status: 'Installed' as const,
                  version: '1.0.0',
                },
                {
                  name: 'Business Template: SaaS',
                  type: 'Template',
                  status: 'Available' as const,
                  version: '2.0.0',
                },
              ].map((asset) => (
                <Card
                  key={asset.name}
                  variant="standard"
                  padding="md"
                  className="hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${asset.status === 'Installed' ? 'bg-[#F0FDF4]' : 'bg-[#EFF6FF]'}`}
                      >
                        <Package
                          className={`h-4 w-4 ${asset.status === 'Installed' ? 'text-[#22C55E]' : 'text-[#3B82F6]'}`}
                        />
                      </div>
                      <div>
                        <p className="text-[14px] font-medium text-[#374151]">{asset.name}</p>
                        <p className="text-[11px] text-[#94A3B8]">
                          v{asset.version} · {asset.type}
                        </p>
                      </div>
                    </div>
                    <Badge variant={asset.status === 'Installed' ? 'success' : 'info'} size="sm">
                      {asset.status}
                    </Badge>
                  </div>
                  <button
                    className={`mt-4 w-full py-2 rounded-lg text-[13px] font-medium transition-colors ${asset.status === 'Installed' ? 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]' : 'bg-[#2B5FD9] text-white hover:bg-[#1E4AA8]'}`}
                  >
                    {asset.status === 'Installed' ? 'Configure' : 'Install'}
                  </button>
                </Card>
              ))}
            </div>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="installed">
          <ErrorBoundary section="marketplace-installed">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">Installed Assets</h3>
              <p className="text-[14px] text-[#64748B] mt-2">
                Manage your installed platform assets and configurations.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="providers">
          <ErrorBoundary section="marketplace-providers">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">AI Providers</h3>
              <p className="text-[14px] text-[#64748B] mt-2">
                Configure and manage AI provider integrations.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="updates">
          <ErrorBoundary section="marketplace-updates">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">Updates & Versions</h3>
              <p className="text-[14px] text-[#64748B] mt-2">
                Manage asset updates and version history.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="compatibility">
          <ErrorBoundary section="marketplace-compatibility">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">Compatibility</h3>
              <p className="text-[14px] text-[#64748B] mt-2">
                Compatibility checks and dependency management.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>
      </TabsRoot>
    </div>
  );
}
