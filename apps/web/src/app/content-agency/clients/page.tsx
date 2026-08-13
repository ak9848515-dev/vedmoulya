'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Card,
  Badge,
  Loading,
  EmptyState,
  Button,
  TextField,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@vedmoulya/ui';
import { Users, Plus, Search, ArrowRight } from 'lucide-react';
import { ErrorBoundary } from '../../../components/ErrorBoundary.js';
import { useContentClients, useCreateContentClient } from '../../../lib/api-client.js';
import { SignInRedirect } from '../../../components/SignInRedirect.js';
import { useAgencyPage } from '../_components/use-agency-page.js';
import { AgencySubNav } from '../_components/AgencySubNav.js';

export default function ClientsPage(): React.JSX.Element {
  const { ready, userId } = useAgencyPage('Clients', '/content-agency/clients');
  const clients = useContentClients(userId);
  const createClient = useCreateContentClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({
    company: '',
    industry: '',
    brandVoice: '',
    targetAudience: '',
    website: '',
  });

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading clients..." size="lg" />
      </div>
    );
  }
  if (!userId) return <SignInRedirect />;

  const data = clients.data;
  const filtered = (data ?? []).filter((c) =>
    c.company.toLowerCase().includes(query.toLowerCase()),
  );

  async function handleCreate(): Promise<void> {
    if (!form.company.trim()) return;
    await createClient.mutateAsync({ userId, ...form });
    setForm({ company: '', industry: '', brandVoice: '', targetAudience: '', website: '' });
    setOpen(false);
    void clients.refetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[28px] font-heading font-bold text-[#111827] dark:text-[#F1F5F9]">
              Clients
            </h1>
            <Badge variant="info" size="sm">
              {data?.length ?? 0} total
            </Badge>
          </div>
          <p className="text-[15px] text-[#64748B] dark:text-[#94A3B8]">
            Companies you create content for — brand voice, audience, goals and memory.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" /> New Client
        </Button>
      </div>

      <AgencySubNav />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder="Search clients…"
          className="w-full rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] pl-9 pr-3 py-2 text-[13.5px] text-[#111827] dark:text-[#E2E8F0] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2B5FD9]/40"
        />
      </div>

      <ErrorBoundary section="content-agency-clients">
        {clients.isLoading && !data ? (
          <Loading label="Loading clients..." />
        ) : !filtered.length ? (
          <Card variant="standard" padding="lg">
            <EmptyState
              icon={<Users className="h-8 w-8 text-[#2B5FD9]" />}
              title={query ? 'No matching clients' : 'No clients yet'}
              description={
                query
                  ? 'Try a different search term.'
                  : 'Add your first client to start generating on-brand content.'
              }
              action={
                query
                  ? undefined
                  : {
                      label: 'Add your first client',
                      onClick: (): void => {
                        setOpen(true);
                      },
                    }
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((client) => (
              <Link
                key={client.id}
                href={`/content-agency/client-detail?id=${client.id}`}
                className="group"
              >
                <Card variant="interactive" padding="md" className="h-full">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#2B5FD9] to-[#5B8AEB] text-white flex items-center justify-center text-[15px] font-bold">
                        {client.company.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[14.5px] font-semibold text-[#111827] dark:text-[#F1F5F9] group-hover:text-[#2B5FD9] transition-colors">
                          {client.company}
                        </p>
                        <p className="text-[12px] text-[#64748B]">
                          {client.industry || 'No industry set'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {client.services.slice(0, 3).map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-[#F1F5F9] dark:bg-[#1E293B] px-2 py-0.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]"
                      >
                        {s}
                      </span>
                    ))}
                    {client.goals.length > 0 && (
                      <span className="rounded-full bg-[#EFF4FE] dark:bg-[#172554] px-2 py-0.5 text-[11px] text-[#2B5FD9]">
                        {client.goals.length} goal{client.goals.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </ErrorBoundary>

      {createClient.isError && (
        <p className="text-[13px] text-[#EF4444]">Failed to create client. Please try again.</p>
      )}

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <TextField
              label="Company name"
              placeholder="Acme Inc"
              value={form.company}
              onChange={(e) => {
                setForm({ ...form, company: e.target.value });
              }}
            />
            <TextField
              label="Industry"
              placeholder="SaaS, Fintech, Healthcare…"
              value={form.industry}
              onChange={(e) => {
                setForm({ ...form, industry: e.target.value });
              }}
            />
            <TextField
              label="Brand voice"
              placeholder="bold and helpful"
              value={form.brandVoice}
              onChange={(e) => {
                setForm({ ...form, brandVoice: e.target.value });
              }}
            />
            <TextField
              label="Target audience"
              placeholder="CTOs of mid-size companies"
              value={form.targetAudience}
              onChange={(e) => {
                setForm({ ...form, targetAudience: e.target.value });
              }}
            />
            <TextField
              label="Website"
              placeholder="https://acme.example"
              value={form.website}
              onChange={(e) => {
                setForm({ ...form, website: e.target.value });
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!form.company.trim() || createClient.isPending}
              onClick={() => void handleCreate()}
            >
              {createClient.isPending ? 'Creating…' : 'Create Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
