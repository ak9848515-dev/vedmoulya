'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { Card, Badge, Loading, Button, TextField, Textarea, Select, Progress } from '@vedmoulya/ui';
import { Sparkles, Zap, FileText, Shield, Clock, Cpu, CheckCircle2, RefreshCw } from 'lucide-react';
import { ErrorBoundary } from '../../../components/ErrorBoundary.js';
import {
  useContentClients,
  useContentBrands,
  useGenerateContent,
  useTransitionContentStatus,
  useRegenerateContent,
} from '../../../lib/api-client.js';
import type { ContentItemDTO } from '@vedmoulya/services';
import { SignInRedirect } from '../../../components/SignInRedirect.js';
import { useAgencyPage } from '../_components/use-agency-page.js';
import { AgencySubNav } from '../_components/AgencySubNav.js';

const CONTENT_TYPES = [
  { value: 'blog', label: 'Blog' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'Twitter/X' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'email', label: 'Email' },
  { value: 'website_copy', label: 'Website Copy' },
  { value: 'landing_page', label: 'Landing Page' },
  { value: 'ad_copy', label: 'Ad Copy' },
  { value: 'product_description', label: 'Product Description' },
  { value: 'case_study', label: 'Case Study' },
  { value: 'script', label: 'Script' },
];

const TIERS = [
  { value: 'economy', label: 'Economy' },
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
];

/** Static export requires useSearchParams inside a Suspense boundary. */
export default function GeneratorPage(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <GeneratorPageInner />
    </Suspense>
  );
}

function GeneratorPageInner(): React.JSX.Element {
  const searchParams = useSearchParams();
  const { ready, userId } = useAgencyPage('Generator', '/content-agency/generator');
  const clients = useContentClients(userId);
  const brands = useContentBrands(userId);
  const generate = useGenerateContent();
  const transition = useTransitionContentStatus();
  const regenerate = useRegenerateContent();
  const [form, setForm] = useState({
    clientId: searchParams.get('clientId') ?? '',
    brandId: '',
    contentType: 'blog',
    title: '',
    brief: '',
    targetAudience: '',
    qualityTier: 'standard',
  });

  useEffect(() => {
    const clientId = searchParams.get('clientId');
    if (clientId) setForm((f) => ({ ...f, clientId }));
  }, [searchParams]);

  // The latest generated asset — set from the mutation response and updated
  // in place after a versioned regeneration so the preview stays current.
  const [preview, setPreview] = useState<ContentItemDTO | null>(null);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading generator..." size="lg" />
      </div>
    );
  }
  if (!userId) return <SignInRedirect />;

  const clientOptions = (clients.data ?? []).map((c) => ({ value: c.id, label: c.company }));
  const brandOptions = (brands.data ?? [])
    .filter((b) => !form.clientId || b.clientId === form.clientId || b.clientId === null)
    .map((b) => ({ value: b.id, label: b.name }));

  const result = preview;

  async function handleGenerate(): Promise<void> {
    if (!form.title.trim() || !form.brief.trim() || !form.clientId) return;
    const res = await generate.mutateAsync({
      userId,
      clientId: form.clientId,
      brandId: form.brandId || null,
      contentType: form.contentType as 'blog',
      title: form.title,
      brief: form.brief,
      targetAudience: form.targetAudience || undefined,
      qualityTier: form.qualityTier as 'standard',
    });
    if (res.data) setPreview(res.data as ContentItemDTO);
  }

  // generateContent already persists the asset server-side; "Save to Review
  // Queue" simply moves it into the review workflow (no duplicate creation).
  async function handleSaveAsDraft(): Promise<void> {
    if (!result) return;
    await transition.mutateAsync({ userId, contentId: result.id, to: 'review' });
    window.location.href = '/content-agency/review';
  }

  // Versioned regeneration: reuses the original prompt + appends feedback,
  // producing a new version on the SAME asset (traceability chain preserved).
  async function handleRegenerate(): Promise<void> {
    if (!result) return;
    const updated = await regenerate.mutateAsync({
      userId,
      contentId: result.id,
      feedback: 'Improve overall quality and strengthen the key message',
    });
    if (updated.data) setPreview(updated.data as ContentItemDTO);
  }

  const aiMeta = result?.aiMetadata;
  const latestContent = result?.versions[result.versions.length - 1]?.content ?? '';
  const qualityScore = result?.aiMetadata?.qualityScore ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-[28px] font-heading font-bold text-[#111827] dark:text-[#F1F5F9]">
          Content Generator
        </h1>
        <Badge variant="ai" size="sm">
          <Sparkles className="h-3 w-3 mr-1" /> AI Pipeline
        </Badge>
      </div>
      <p className="text-[15px] text-[#64748B] dark:text-[#94A3B8] -mt-4">
        Brief → Research → Draft → Brand Review → Grammar → SEO → Quality Score.
      </p>

      <AgencySubNav />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Brief Form */}
        <ErrorBoundary section="content-agency-generator-form">
          <Card variant="standard" padding="lg">
            <h3 className="text-[16px] font-semibold text-[#111827] dark:text-[#F1F5F9] mb-4">
              Content Brief
            </h3>
            <div className="space-y-4">
              <Select
                label="Client"
                options={clientOptions}
                placeholder="Select a client"
                value={form.clientId}
                onChange={(e) => {
                  setForm({ ...form, clientId: e.target.value, brandId: '' });
                }}
              />
              <Select
                label="Brand profile (optional)"
                options={brandOptions}
                placeholder="No brand — generic voice"
                value={form.brandId}
                onChange={(e) => {
                  setForm({ ...form, brandId: e.target.value });
                }}
              />
              <Select
                label="Content type"
                options={CONTENT_TYPES}
                value={form.contentType}
                onChange={(e) => {
                  setForm({ ...form, contentType: e.target.value });
                }}
              />
              <TextField
                label="Title / topic"
                placeholder="Why data teams love realtime sync"
                value={form.title}
                onChange={(e) => {
                  setForm({ ...form, title: e.target.value });
                }}
              />
              <Textarea
                label="Brief"
                placeholder="Describe the angle, key points and desired outcome…"
                rows={5}
                value={form.brief}
                onChange={(e) => {
                  setForm({ ...form, brief: e.target.value });
                }}
              />
              <TextField
                label="Target audience (optional)"
                placeholder="CTOs of mid-size companies"
                value={form.targetAudience}
                onChange={(e) => {
                  setForm({ ...form, targetAudience: e.target.value });
                }}
              />
              <Select
                label="Quality tier"
                options={TIERS}
                value={form.qualityTier}
                onChange={(e) => {
                  setForm({ ...form, qualityTier: e.target.value });
                }}
              />
              <Button
                variant="ai"
                size="lg"
                fullWidth
                disabled={
                  !form.title.trim() || !form.brief.trim() || !form.clientId || generate.isPending
                }
                onClick={() => void handleGenerate()}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {generate.isPending ? 'Running AI pipeline…' : 'Generate Content'}
              </Button>
              {generate.isError && (
                <p className="text-[13px] text-[#EF4444]">{generate.error.message}</p>
              )}
            </div>
          </Card>
        </ErrorBoundary>

        {/* Result */}
        <ErrorBoundary section="content-agency-generator-result">
          {generate.isPending ? (
            <Card variant="standard" padding="lg" className="h-full">
              <Loading label="Researching, drafting, reviewing…" size="lg" />
              <div className="mt-6 space-y-3">
                {[
                  'Knowledge retrieval',
                  'Research',
                  'Draft generation',
                  'Brand alignment',
                  'Grammar & style',
                  'SEO',
                ].map((step, i) => (
                  <div key={step} className="flex items-center gap-3">
                    <span
                      className={`h-2 w-2 rounded-full ${i < 3 ? 'bg-[#7C3AED] animate-pulse' : 'bg-[#E2E8F0]'}`}
                    />
                    <span className={`text-[13px] ${i < 3 ? 'text-[#7C3AED]' : 'text-[#94A3B8]'}`}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ) : result ? (
            <Card variant="standard" padding="lg" className="h-full">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[16px] font-semibold text-[#111827] dark:text-[#F1F5F9]">
                  {result.title}
                </h3>
                <Badge variant="success" size="sm">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Generated
                </Badge>
              </div>

              {/* Quality + traceability */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl bg-[#F5F3FF] dark:bg-[#1E1B4B] p-3">
                  <p className="text-[11px] font-semibold text-[#6D28D9] dark:text-[#C4B5FD] uppercase">
                    Quality score
                  </p>
                  <p className="text-[22px] font-bold text-[#7C3AED]">{qualityScore}/10</p>
                  <Progress value={qualityScore * 10} size="sm" variant="ai" className="mt-1" />
                </div>
                <div className="rounded-xl bg-[#F1F5F9] dark:bg-[#1E293B] p-3">
                  <p className="text-[11px] font-semibold text-[#64748B] uppercase">Traceability</p>
                  <p className="text-[13px] text-[#374151] dark:text-[#E2E8F0] mt-1 capitalize">
                    {aiMeta?.provider} · {aiMeta?.model}
                  </p>
                  <p className="text-[11.5px] text-[#94A3B8] truncate" title={aiMeta?.traceId}>
                    trace: {aiMeta?.traceId}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4 text-[12px] text-[#64748B]">
                <span className="inline-flex items-center gap-1">
                  <Cpu className="h-3.5 w-3.5" /> {(aiMeta?.tokenUsage.total ?? 0).toLocaleString()}{' '}
                  tokens
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {aiMeta?.latencyMs ?? 0}ms
                </span>
                <span className="inline-flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" /> ${(aiMeta?.cost ?? 0).toFixed(4)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5" /> {aiMeta?.passes.length ?? 0} review passes
                </span>
              </div>

              <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] p-4 max-h-[380px] overflow-y-auto">
                <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#374151] dark:text-[#E2E8F0] font-sans">
                  {latestContent}
                </pre>
              </div>

              <div className="mt-4 flex gap-2 flex-wrap">
                <Button
                  variant="primary"
                  onClick={() => void handleSaveAsDraft()}
                  disabled={transition.isPending}
                >
                  <FileText className="h-4 w-4 mr-1.5" />
                  {transition.isPending ? 'Moving…' : 'Send to Review Queue'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void handleRegenerate()}
                  disabled={regenerate.isPending}
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  {regenerate.isPending ? 'Regenerating…' : 'Regenerate'}
                </Button>
              </div>
            </Card>
          ) : (
            <Card
              variant="standard"
              padding="lg"
              className="h-full flex flex-col items-center justify-center text-center"
            >
              <div className="h-14 w-14 rounded-2xl bg-[#F5F3FF] dark:bg-[#1E1B4B] flex items-center justify-center mb-4">
                <FileText className="h-7 w-7 text-[#7C3AED]" />
              </div>
              <h3 className="text-[16px] font-semibold text-[#111827] dark:text-[#F1F5F9]">
                Your generated content appears here
              </h3>
              <p className="text-[13px] text-[#64748B] mt-1 max-w-xs">
                Every asset is traceable: prompt, provider, model, quality score and review history.
              </p>
            </Card>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
