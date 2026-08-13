'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, Badge, Loading, EmptyState } from '@vedmoulya/ui';
import {
  Building2,
  Target,
  Globe,
  Link2,
  Brain,
  FolderKanban,
  FileText,
  ArrowLeft,
} from 'lucide-react';
import { ErrorBoundary } from '../../../components/ErrorBoundary.js';
import { useContentClient, useContentProjects, useContentItems } from '../../../lib/api-client.js';
import { SignInRedirect } from '../../../components/SignInRedirect.js';
import { useAgencyPage } from '../_components/use-agency-page.js';
import { AgencySubNav } from '../_components/AgencySubNav.js';

/** Static export: dynamic segments are not available, so the client id is a
    query param — this page stays fully static while still supporting deep
    links like /content-agency/client-detail?id=abc. */
export default function ClientDetailPage(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <ClientDetailInner />
    </Suspense>
  );
}

function ClientDetailInner(): React.JSX.Element {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('id') ?? '';
  const { ready, userId } = useAgencyPage('Client', `/content-agency/client-detail?id=${clientId}`);
  const client = useContentClient(userId, clientId);
  const projects = useContentProjects(userId);
  const content = useContentItems(userId);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading client..." size="lg" />
      </div>
    );
  }
  if (!userId) return <SignInRedirect />;

  const data = client.data;
  if (client.isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading client..." size="lg" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-6">
        <AgencySubNav />
        <Card variant="standard" padding="lg">
          <EmptyState
            title="Client not found"
            description="This client may have been deleted or you don't have access."
            action={{
              label: 'Back to clients',
              onClick: () => {
                window.location.href = '/content-agency/clients';
              },
            }}
          />
        </Card>
      </div>
    );
  }

  const clientProjects = (projects.data ?? []).filter((p) => p.clientId === data.id);
  const clientContent = (content.data ?? []).filter((c) => c.clientId === data.id);

  return (
    <div className="space-y-6">
      <Link
        href="/content-agency/clients"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#64748B] hover:text-[#2B5FD9] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> All clients
      </Link>
      <AgencySubNav />

      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#2B5FD9] to-[#5B8AEB] text-white flex items-center justify-center text-[22px] font-bold">
          {data.company.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-3">
            <h1 className="text-[26px] font-heading font-bold text-[#111827] dark:text-[#F1F5F9]">
              {data.company}
            </h1>
            {data.industry && (
              <Badge variant="info" size="sm">
                {data.industry}
              </Badge>
            )}
          </div>
          <p className="text-[14px] text-[#64748B] mt-0.5">
            {data.brandVoice ? `Brand voice: ${data.brandVoice}` : 'No brand voice set'}
          </p>
        </div>
        <Link
          href={`/content-agency/generator?clientId=${data.id}`}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2B5FD9] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#1E4FC4] transition-colors"
        >
          <FileText className="h-4 w-4" /> Generate for client
        </Link>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ErrorBoundary section="content-agency-client-goals">
          <Card variant="standard" padding="lg">
            <h3 className="text-[16px] font-semibold text-[#111827] dark:text-[#F1F5F9] flex items-center gap-2 mb-4">
              <Target className="h-4 w-4 text-[#2B5FD9]" /> Goals
            </h3>
            {data.goals.length === 0 ? (
              <p className="text-[13px] text-[#94A3B8]">No goals recorded.</p>
            ) : (
              <ul className="space-y-2">
                {data.goals.map((goal) => (
                  <li
                    key={goal}
                    className="flex items-start gap-2 text-[13.5px] text-[#374151] dark:text-[#E2E8F0]"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#2B5FD9] shrink-0" />
                    {goal}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </ErrorBoundary>

        <ErrorBoundary section="content-agency-client-brand">
          <Card variant="standard" padding="lg">
            <h3 className="text-[16px] font-semibold text-[#111827] dark:text-[#F1F5F9] flex items-center gap-2 mb-4">
              <Brain className="h-4 w-4 text-[#7C3AED]" /> Audience & Memory
            </h3>
            <p className="text-[13.5px] text-[#374151] dark:text-[#E2E8F0]">
              <span className="font-semibold">Target audience:</span>{' '}
              {data.targetAudience || 'Not specified'}
            </p>
            <div className="mt-4 space-y-3">
              {data.website && (
                <a
                  href={data.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-[13px] text-[#2B5FD9] hover:underline"
                >
                  <Globe className="h-4 w-4" /> {data.website}
                </a>
              )}
              {Object.entries(data.socialLinks).map(([name, url]) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-[13px] text-[#2B5FD9] hover:underline capitalize"
                >
                  <Link2 className="h-4 w-4" /> {name}
                </a>
              ))}
              {data.aiMemory && (
                <p className="text-[13px] text-[#64748B] bg-[#F5F3FF] dark:bg-[#1E1B4B] rounded-lg p-3">
                  {data.aiMemory}
                </p>
              )}
            </div>
          </Card>
        </ErrorBoundary>
      </div>

      {/* Services */}
      <ErrorBoundary section="content-agency-client-services">
        <Card variant="standard" padding="lg">
          <h3 className="text-[16px] font-semibold text-[#111827] dark:text-[#F1F5F9] flex items-center gap-2 mb-4">
            <Building2 className="h-4 w-4 text-[#22C55E]" /> Products & Services
          </h3>
          <div className="flex flex-wrap gap-2">
            {[...data.products, ...data.services].map((item) => (
              <span
                key={item}
                className="rounded-full bg-[#F1F5F9] dark:bg-[#1E293B] px-3 py-1 text-[12.5px] text-[#374151] dark:text-[#E2E8F0]"
              >
                {item}
              </span>
            ))}
            {data.products.length + data.services.length === 0 && (
              <p className="text-[13px] text-[#94A3B8]">Nothing listed yet.</p>
            )}
          </div>
        </Card>
      </ErrorBoundary>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ErrorBoundary section="content-agency-client-projects">
          <Card variant="standard" padding="lg">
            <h3 className="text-[16px] font-semibold text-[#111827] dark:text-[#F1F5F9] flex items-center gap-2 mb-4">
              <FolderKanban className="h-4 w-4 text-[#F59E0B]" /> Projects
            </h3>
            {clientProjects.length === 0 ? (
              <p className="text-[13px] text-[#94A3B8]">No projects for this client yet.</p>
            ) : (
              <ul className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
                {clientProjects.map((p) => (
                  <li key={p.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-[13.5px] font-medium text-[#374151] dark:text-[#E2E8F0]">
                        {p.name}
                      </p>
                      <p className="text-[12px] text-[#94A3B8]">{p.status}</p>
                    </div>
                    <Badge variant="info" size="sm">
                      {p.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </ErrorBoundary>

        <ErrorBoundary section="content-agency-client-content">
          <Card variant="standard" padding="lg">
            <h3 className="text-[16px] font-semibold text-[#111827] dark:text-[#F1F5F9] flex items-center gap-2 mb-4">
              <FileText className="h-4 w-4 text-[#2B5FD9]" /> Content
            </h3>
            {clientContent.length === 0 ? (
              <p className="text-[13px] text-[#94A3B8]">No content generated yet.</p>
            ) : (
              <ul className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
                {clientContent.slice(0, 6).map((c) => (
                  <li key={c.id} className="py-2.5">
                    <p className="text-[13.5px] font-medium text-[#374151] dark:text-[#E2E8F0]">
                      {c.title}
                    </p>
                    <p className="text-[12px] text-[#94A3B8] capitalize">
                      {c.contentType} · {c.status}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </ErrorBoundary>
      </div>
    </div>
  );
}
