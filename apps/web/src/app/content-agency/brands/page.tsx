'use client';

import React, { useState } from 'react';
import {
  Card,
  Badge,
  Loading,
  EmptyState,
  Button,
  TextField,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Select,
} from '@vedmoulya/ui';
import { Palette, Plus } from 'lucide-react';
import { ErrorBoundary } from '../../../components/ErrorBoundary.js';
import {
  useContentBrands,
  useContentClients,
  useUpsertContentBrand,
} from '../../../lib/api-client.js';
import { SignInRedirect } from '../../../components/SignInRedirect.js';
import { useAgencyPage } from '../_components/use-agency-page.js';
import { AgencySubNav } from '../_components/AgencySubNav.js';

export default function BrandsPage(): React.JSX.Element {
  const { ready, userId } = useAgencyPage('Brands', '/content-agency/brands');
  const brands = useContentBrands(userId);
  const clients = useContentClients(userId);
  const upsert = useUpsertContentBrand();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    clientId: '',
    tone: '',
    writingStyle: '',
    doRules: '',
    dontRules: '',
    keywords: '',
  });

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading brands..." size="lg" />
      </div>
    );
  }
  if (!userId) return <SignInRedirect />;

  const data = brands.data ?? [];
  const clientOptions = (clients.data ?? []).map((c) => ({
    value: c.id,
    label: c.company,
  }));

  async function handleSave(): Promise<void> {
    if (!form.name.trim()) return;
    await upsert.mutateAsync({
      userId,
      name: form.name,
      clientId: form.clientId || null,
      tone: form.tone,
      writingStyle: form.writingStyle,
      doRules: form.doRules
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      dontRules: form.dontRules
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      keywords: form.keywords
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setForm({
      name: '',
      clientId: '',
      tone: '',
      writingStyle: '',
      doRules: '',
      dontRules: '',
      keywords: '',
    });
    setOpen(false);
    void brands.refetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[28px] font-heading font-bold text-[#111827] dark:text-[#F1F5F9]">
              Brand Profiles
            </h1>
            <Badge variant="info" size="sm">
              {data.length} total
            </Badge>
          </div>
          <p className="text-[15px] text-[#64748B] dark:text-[#94A3B8]">
            Tone, writing style, do&apos;s &amp; don&apos;ts — the voice every generation follows.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" /> New Brand Profile
        </Button>
      </div>

      <AgencySubNav />

      <ErrorBoundary section="content-agency-brands">
        {brands.isLoading && !data.length ? (
          <Loading label="Loading brands..." />
        ) : !data.length ? (
          <Card variant="standard" padding="lg">
            <EmptyState
              icon={<Palette className="h-8 w-8 text-[#7C3AED]" />}
              title="No brand profiles yet"
              description="Brand profiles keep every AI generation on-voice. Create your first."
              action={{
                label: 'Create brand profile',
                onClick: () => {
                  setOpen(true);
                },
              }}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.map((brand) => (
              <Card key={brand.id} variant="standard" padding="md" className="h-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] text-white flex items-center justify-center text-[14px] font-bold">
                    {brand.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[14.5px] font-semibold text-[#111827] dark:text-[#F1F5F9]">
                      {brand.name}
                    </p>
                    <p className="text-[12px] text-[#64748B]">
                      {brand.tone || 'No tone set'}{' '}
                      {brand.clientId ? '· linked to client' : '· global'}
                    </p>
                  </div>
                </div>
                {brand.writingStyle && (
                  <p className="text-[12.5px] text-[#64748B] dark:text-[#94A3B8] italic mb-3">
                    “{brand.writingStyle}”
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {brand.keywords.slice(0, 4).map((k) => (
                    <span
                      key={k}
                      className="rounded-full bg-[#F5F3FF] dark:bg-[#1E1B4B] px-2 py-0.5 text-[11px] text-[#6D28D9] dark:text-[#C4B5FD]"
                    >
                      {k}
                    </span>
                  ))}
                </div>
                {(brand.doRules.length > 0 || brand.dontRules.length > 0) && (
                  <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                    <div className="rounded-lg bg-[#F0FDF4] dark:bg-[#052E16] p-2">
                      <p className="font-semibold text-[#15803D] dark:text-[#4ADE80] mb-1">Do</p>
                      <ul className="space-y-0.5 text-[#374151] dark:text-[#BBF7D0]">
                        {brand.doRules.slice(0, 2).map((r) => (
                          <li key={r}>• {r}</li>
                        ))}
                        {brand.doRules.length === 0 && <li>—</li>}
                      </ul>
                    </div>
                    <div className="rounded-lg bg-[#FEF2F2] dark:bg-[#450A0A] p-2">
                      <p className="font-semibold text-[#B91C1C] dark:text-[#F87171] mb-1">
                        Don&apos;t
                      </p>
                      <ul className="space-y-0.5 text-[#374151] dark:text-[#FECACA]">
                        {brand.dontRules.slice(0, 2).map((r) => (
                          <li key={r}>• {r}</li>
                        ))}
                        {brand.dontRules.length === 0 && <li>—</li>}
                      </ul>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </ErrorBoundary>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Brand Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <TextField
              label="Brand name"
              placeholder="Acme Voice"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
              }}
            />
            <Select
              label="Client (optional)"
              placeholder="Global brand profile"
              options={clientOptions}
              value={form.clientId}
              onChange={(e) => {
                setForm({ ...form, clientId: e.target.value });
              }}
            />
            <TextField
              label="Tone"
              placeholder="confident, approachable"
              value={form.tone}
              onChange={(e) => {
                setForm({ ...form, tone: e.target.value });
              }}
            />
            <Textarea
              label="Writing style"
              placeholder="Short sentences, active voice, no jargon…"
              value={form.writingStyle}
              onChange={(e) => {
                setForm({ ...form, writingStyle: e.target.value });
              }}
            />
            <TextField
              label="Do rules (comma separated)"
              placeholder="Use active voice, Include a CTA"
              value={form.doRules}
              onChange={(e) => {
                setForm({ ...form, doRules: e.target.value });
              }}
            />
            <TextField
              label="Don't rules (comma separated)"
              placeholder="No jargon, No hype"
              value={form.dontRules}
              onChange={(e) => {
                setForm({ ...form, dontRules: e.target.value });
              }}
            />
            <TextField
              label="Keywords (comma separated)"
              placeholder="analytics, realtime, sync"
              value={form.keywords}
              onChange={(e) => {
                setForm({ ...form, keywords: e.target.value });
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
              disabled={!form.name.trim() || upsert.isPending}
              onClick={() => void handleSave()}
            >
              {upsert.isPending ? 'Saving…' : 'Save Brand Profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
