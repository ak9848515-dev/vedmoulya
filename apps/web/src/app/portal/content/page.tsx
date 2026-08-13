// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Client Portal: Content Review (EPIC-003 / AC-002, Module 7)
// Clients can review content, approve/reject, comment and download deliverables.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, MessageSquare, Download, Sparkles } from 'lucide-react';
import { Card, Badge, Loading, ErrorState, Button, Textarea } from '@vedmoulya/ui';
import { PortalShell } from '../_components/PortalShell.js';
import { getPortalToken } from '../../../lib/portal-session.js';
import {
  usePortalContent,
  usePortalContentDetail,
  usePortalApproveContent,
  usePortalRejectContent,
  usePortalCommentContent,
  usePortalDeliverable,
} from '../../../lib/api-client.js';
import { api } from '../../../lib/trpc.js';

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-[#64748B]/10 text-[#64748B]' },
  review: { label: 'Awaiting approval', cls: 'bg-[#F59E0B]/10 text-[#F59E0B]' },
  approved: { label: 'Approved', cls: 'bg-[#10B981]/10 text-[#10B981]' },
  scheduled: { label: 'Scheduled', cls: 'bg-[#2B5FD9]/10 text-[#2B5FD9]' },
  published: { label: 'Published', cls: 'bg-[#10B981]/10 text-[#10B981]' },
};

const DRAFT_STYLE = { label: 'Draft', cls: 'bg-[#64748B]/10 text-[#64748B]' };

export default function PortalContentPage(): React.JSX.Element {
  return (
    <Suspense fallback={<Loading label="Loading content…" />}>
      <PortalContentInner />
    </Suspense>
  );
}

function PortalContentInner(): React.JSX.Element | null {
  const searchParams = useSearchParams();
  const [token, setToken] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'));
  const [comment, setComment] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    setToken(getPortalToken());
  }, []);

  const content = usePortalContent(token);
  const detail = usePortalContentDetail(token, selectedId ?? '');
  const approve = usePortalApproveContent();
  const reject = usePortalRejectContent();
  const commentOn = usePortalCommentContent();
  const portalDeliverable = usePortalDeliverable();
  const utils = api.useUtils();

  const selected = useMemo(() => {
    if (!detail.data) return null;
    return detail.data.content;
  }, [detail.data]);

  if (!token) return null;

  const invalidate = async (): Promise<void> => {
    await utils.portal.getContent.invalidate();
    await utils.portal.listContent.invalidate();
    await utils.portal.getDashboard.invalidate();
  };

  const download = (data: string, filename: string, mime: string): void => {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownload = async (contentId: string, format: 'markdown' | 'html'): Promise<void> => {
    const result = await portalDeliverable(token, contentId, format);
    if (result) {
      download(result.data, result.filename, format === 'html' ? 'text/html' : 'text/markdown');
    }
  };

  return (
    <PortalShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold font-heading text-[#111827] dark:text-white">Content</h1>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            Review your content, request changes, or download deliverables.
          </p>
        </div>

        {content.isError ? (
          <ErrorState
            title="Could not load content"
            onRetry={() => {
              void content.refetch();
            }}
          />
        ) : content.isLoading ? (
          <Loading label="Loading content…" />
        ) : (content.data ?? []).length === 0 ? (
          <Card variant="elevated" className="p-10 text-center text-[13px] text-[#94A3B8]">
            No content shared with you yet.
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-5">
            {/* List */}
            <div className="lg:col-span-2 space-y-2">
              {(content.data ?? []).map((item) => {
                const style = STATUS_STYLE[item.status] ?? DRAFT_STYLE;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedId(item.id);
                      setComment('');
                      setFeedback('');
                    }}
                    className={`w-full text-left rounded-2xl border p-4 transition-all ${
                      selectedId === item.id
                        ? 'border-[#2B5FD9] bg-[#2B5FD9]/5 dark:bg-[#2B5FD9]/10'
                        : 'border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] hover:border-[#2B5FD9]/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-semibold text-[#111827] dark:text-white truncate">
                          {item.title}
                        </div>
                        <div className="text-[11.5px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                          {item.contentType} · {new Date(item.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge className={`${style.cls} shrink-0`}>{style.label}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detail */}
            <div className="lg:col-span-3">
              {detail.isLoading || !selected ? (
                <Card variant="elevated" className="p-8 text-center text-[13px] text-[#94A3B8]">
                  {content.data?.length ? 'Select an item to review it.' : 'No content yet.'}
                </Card>
              ) : (
                <Card variant="elevated" className="p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[15px] font-bold text-[#111827] dark:text-white">
                        {selected.title}
                      </div>
                      <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                        {selected.contentType} · updated{' '}
                        {new Date(selected.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge className={(STATUS_STYLE[selected.status] ?? DRAFT_STYLE).cls}>
                      {(STATUS_STYLE[selected.status] ?? DRAFT_STYLE).label}
                    </Badge>
                  </div>

                  {selected.aiMetadata && (
                    <div className="flex items-center gap-2 rounded-xl bg-[#F5F3FF] dark:bg-[#2E1065]/40 px-3 py-2 text-[12px] text-[#6D28D9] dark:text-[#C4B5FD]">
                      <Sparkles className="h-3.5 w-3.5" />
                      Generated by {selected.aiMetadata.model} · quality{' '}
                      {selected.aiMetadata.qualityScore}/10
                    </div>
                  )}

                  {/* Latest version */}
                  <div className="rounded-2xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] p-4 max-h-80 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#475569] dark:text-[#CBD5E1] font-sans">
                      {selected.versions[selected.versions.length - 1]?.content ??
                        'No content yet.'}
                    </pre>
                  </div>

                  {/* Reviews */}
                  {selected.reviews.length > 0 && (
                    <div className="space-y-1.5">
                      {selected.reviews.slice(-3).map((r) => (
                        <div
                          key={r.id}
                          className="rounded-xl bg-[#F1F5F9] dark:bg-[#1E293B] px-3 py-2 text-[12.5px]"
                        >
                          <span className="font-medium text-[#374151] dark:text-[#E2E8F0]">
                            {r.reviewer}
                          </span>
                          <span className="text-[#94A3B8]"> · {r.decision}</span>
                          <p className="text-[#64748B] dark:text-[#94A3B8] mt-0.5">{r.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleDownload(selected.id, 'markdown')}
                    >
                      <Download className="h-3.5 w-3.5" /> .md
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleDownload(selected.id, 'html')}
                    >
                      <Download className="h-3.5 w-3.5" /> .html
                    </Button>
                  </div>

                  {selected.status === 'review' && (
                    <div className="space-y-2">
                      <Textarea
                        value={feedback}
                        onChange={(e) => {
                          setFeedback(e.target.value);
                        }}
                        rows={2}
                        placeholder="Add feedback or a comment…"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            void approve
                              .mutateAsync({ token, contentId: selected.id, comment: feedback })
                              .then(async () => {
                                setFeedback('');
                                await invalidate();
                              })
                          }
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() =>
                            void reject
                              .mutateAsync({
                                token,
                                contentId: selected.id,
                                comment: feedback || 'Please revise.',
                              })
                              .then(async () => {
                                setFeedback('');
                                await invalidate();
                              })
                          }
                        >
                          <XCircle className="h-3.5 w-3.5" /> Request changes
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            void commentOn
                              .mutateAsync({ token, contentId: selected.id, comment })
                              .then(async () => {
                                setComment('');
                                await invalidate();
                              })
                          }
                        >
                          <MessageSquare className="h-3.5 w-3.5" /> Comment
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
