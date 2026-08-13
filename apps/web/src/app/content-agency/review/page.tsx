'use client';

import React, { useState } from 'react';
import {
  Card,
  Badge,
  Loading,
  EmptyState,
  Button,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@vedmoulya/ui';
import { ClipboardCheck, ThumbsUp, ThumbsDown, RefreshCw, History, Sparkles } from 'lucide-react';
import { api } from '../../../lib/trpc.js';
import { ErrorBoundary } from '../../../components/ErrorBoundary.js';
import {
  useContentItems,
  useAddContentReview,
  useRegenerateContent,
  useScheduleContent,
} from '../../../lib/api-client.js';
import { SignInRedirect } from '../../../components/SignInRedirect.js';
import { useAgencyPage } from '../_components/use-agency-page.js';
import { AgencySubNav } from '../_components/AgencySubNav.js';

type QueueTab = 'review' | 'approved' | 'all';

export default function ReviewPage(): React.JSX.Element {
  const { ready, userId } = useAgencyPage('Review', '/content-agency/review');
  const items = useContentItems(userId);
  const utils = api.useUtils();
  const addReview = useAddContentReview();
  const regenerate = useRegenerateContent();
  const schedule = useScheduleContent();
  const [tab, setTab] = useState<QueueTab>('review');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [regenerateFor, setRegenerateFor] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [scheduleFor, setScheduleFor] = useState<string>('');

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading review queue..." size="lg" />
      </div>
    );
  }
  if (!userId) return <SignInRedirect />;

  const all = items.data ?? [];
  const queue =
    tab === 'review'
      ? all.filter((i) => i.status === 'review')
      : tab === 'approved'
        ? all.filter((i) => i.status === 'approved')
        : all;
  const selected = all.find((i) => i.id === selectedId) ?? null;

  async function handleDecision(decision: 'accepted' | 'rejected'): Promise<void> {
    if (!selected) return;
    await addReview.mutateAsync({
      userId,
      contentId: selected.id,
      stage: 'review',
      reviewer: 'Me',
      comment: comment || (decision === 'accepted' ? 'Approved' : 'Rejected — needs rework'),
      decision,
    });
    setComment('');
    setSelectedId(null);
    await invalidateAgency();
  }

  async function handleRegenerate(): Promise<void> {
    if (!regenerateFor) return;
    await regenerate.mutateAsync({
      userId,
      contentId: regenerateFor,
      feedback: feedback || 'Improve overall quality',
    });
    setFeedback('');
    setRegenerateFor(null);
    await invalidateAgency();
  }

  async function handleSchedule(): Promise<void> {
    if (!selected || !scheduleFor) return;
    await schedule.mutateAsync({
      userId,
      contentId: selected.id,
      scheduledFor: new Date(scheduleFor).toISOString(),
    });
    setScheduleFor('');
    setSelectedId(null);
    await invalidateAgency();
  }

  /** Invalidate every content-agency query so dashboard/calendar stay fresh. */
  async function invalidateAgency(): Promise<void> {
    await utils.contentAgency.invalidate();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-[28px] font-heading font-bold text-[#111827] dark:text-[#F1F5F9]">
          Review &amp; Approval
        </h1>
        <Badge variant="warning" size="sm">
          {all.filter((i) => i.status === 'review').length} in review
        </Badge>
      </div>
      <p className="text-[15px] text-[#64748B] dark:text-[#94A3B8] -mt-4">
        Accept, reject or regenerate — every decision is versioned.
      </p>

      <AgencySubNav />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as QueueTab);
        }}
      >
        <TabsList>
          <TabsTrigger value="review">
            In Review ({all.filter((i) => i.status === 'review').length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({all.filter((i) => i.status === 'approved').length})
          </TabsTrigger>
          <TabsTrigger value="all">All ({all.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <ErrorBoundary section="content-agency-review">
            {items.isLoading && !all.length ? (
              <Loading label="Loading review queue..." />
            ) : !queue.length ? (
              <Card variant="standard" padding="lg">
                <EmptyState
                  icon={<ClipboardCheck className="h-8 w-8 text-[#22C55E]" />}
                  title="Queue is clear"
                  description="No content in this state right now."
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {queue.map((item) => (
                  <Card
                    key={item.id}
                    variant={selectedId === item.id ? 'interactive' : 'standard'}
                    padding="md"
                    className="h-full"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[#111827] dark:text-[#F1F5F9] truncate">
                          {item.title}
                        </p>
                        <p className="text-[12px] text-[#64748B] capitalize">
                          {item.contentType} · {item.versions.length} version
                          {item.versions.length === 1 ? '' : 's'}
                          {item.aiMetadata ? ` · ${item.aiMetadata.provider}` : ''}
                        </p>
                      </div>
                      <Badge
                        variant={
                          item.status === 'approved'
                            ? 'success'
                            : item.status === 'review'
                              ? 'warning'
                              : 'default'
                        }
                        size="sm"
                        className="capitalize"
                      >
                        {item.status}
                      </Badge>
                    </div>

                    {/* Latest version */}
                    <div className="rounded-lg bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#F1F5F9] dark:border-[#1E293B] p-3 max-h-[140px] overflow-hidden mb-3">
                      <p className="text-[12px] text-[#374151] dark:text-[#E2E8F0] whitespace-pre-wrap line-clamp-4">
                        {item.versions[item.versions.length - 1]?.content ?? 'No content'}
                      </p>
                    </div>

                    {item.aiMetadata && (
                      <div className="flex items-center gap-2 mb-3 text-[11.5px] text-[#94A3B8]">
                        <Sparkles className="h-3 w-3 text-[#7C3AED]" />
                        <span>Quality {item.aiMetadata.qualityScore}/10</span>
                        <History className="h-3 w-3" />
                        <span>{item.reviews.length} reviews</span>
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          setSelectedId(item.id);
                        }}
                      >
                        Review
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setRegenerateFor(item.id);
                          setFeedback('');
                        }}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerate
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ErrorBoundary>
        </TabsContent>
      </Tabs>

      {/* Review dialog */}
      <Dialog
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.title ?? 'Review content'}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#F1F5F9] dark:border-[#1E293B] p-4 max-h-[280px] overflow-y-auto">
                <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#374151] dark:text-[#E2E8F0] font-sans">
                  {selected.versions[selected.versions.length - 1]?.content ?? ''}
                </pre>
              </div>
              {selected.versions.length > 1 && (
                <div>
                  <p className="text-[12px] font-semibold text-[#64748B] mb-1.5">Version history</p>
                  <ul className="space-y-1">
                    {selected.versions.map((v, i) => (
                      <li key={v.id} className="text-[12px] text-[#94A3B8]">
                        v{i + 1} · {v.generatedBy} · {new Date(v.createdAt).toLocaleString()}
                        {v.feedback ? ` — “${v.feedback}”` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Textarea
                label="Review comment"
                placeholder="Add feedback for the team or the AI…"
                rows={3}
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                }}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  onClick={() => void handleDecision('accepted')}
                  disabled={addReview.isPending}
                >
                  <ThumbsUp className="h-4 w-4 mr-1.5" /> Accept
                </Button>
                <Button
                  variant="danger"
                  onClick={() => void handleDecision('rejected')}
                  disabled={addReview.isPending}
                >
                  <ThumbsDown className="h-4 w-4 mr-1.5" /> Reject
                </Button>
                <div className="flex-1" />
                <input
                  type="datetime-local"
                  aria-label="Schedule publish time"
                  value={scheduleFor}
                  onChange={(e) => {
                    setScheduleFor(e.target.value);
                  }}
                  className="rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] px-2 py-1.5 text-[12px] text-[#111827] dark:text-[#E2E8F0]"
                />
                <Button
                  variant="secondary"
                  onClick={() => void handleSchedule()}
                  disabled={!scheduleFor}
                >
                  Schedule
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedId(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate dialog */}
      <Dialog
        open={regenerateFor !== null}
        onOpenChange={(open) => {
          if (!open) setRegenerateFor(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate with feedback</DialogTitle>
          </DialogHeader>
          <Textarea
            label="What should change?"
            placeholder="Make it punchier, add a CTA, shorten the intro…"
            rows={4}
            value={feedback}
            onChange={(e) => {
              setFeedback(e.target.value);
            }}
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setRegenerateFor(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="ai"
              onClick={() => void handleRegenerate()}
              disabled={regenerate.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              {regenerate.isPending ? 'Regenerating…' : 'Regenerate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
