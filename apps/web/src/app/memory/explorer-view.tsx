// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Center: Explorer view
// EPIC-004 / EI-010 — Enterprise Memory Intelligence Platform
// Browse the memory registry with type / lifecycle / compression / retention
// filters, plus the Capture action. Every memory is born with provenance
// (source, sourceType, owner), scored for importance + confidence, then pushed
// through the Memory Pipeline (validate → consolidate → rank → compress →
// activate) and enriched with engine cross-links.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Loading, EmptyState, Select, TextField, Textarea, Button } from '@vedmoulya/ui';
import {
  useMemoryItems,
  useCaptureMemory,
  useTransitionMemoryLifecycle,
  useReinforceMemory,
} from '../../lib/api-client.js';
import { useAuthStore } from '../../stores/auth-store.js';
import { ListChecks, Plus, Flame, ArrowRight, X } from 'lucide-react';
import type {
  MemoryCompressionState,
  MemoryLifecycleStatus,
  MemoryRetentionPolicy,
  MemorySourceType,
  MemoryType,
} from '@vedmoulya/memory-intelligence';
import { TYPE_COLORS, FALLBACK_COLOR } from './memory-ui.js';
import { MemoryCard } from './components.js';

const TYPE_OPTIONS = [
  'working',
  'session',
  'project',
  'business',
  'capability',
  'provider',
  'execution',
  'decision',
  'learning',
  'context',
  'user_preference',
  'failure',
  'success',
  'long_term',
].map((value) => ({ value, label: value.replace('_', ' ') }));
const SOURCE_TYPE_OPTIONS = [
  'event',
  'goal',
  'task',
  'capability',
  'provider',
  'project',
  'user',
  'decision',
  'execution',
  'learning',
  'context',
  'business',
  'system',
  'manual',
  'observation',
].map((value) => ({ value, label: value }));
const LIFECYCLE_OPTIONS = [
  'captured',
  'validated',
  'consolidated',
  'ranked',
  'compressed',
  'active',
  'archived',
  'expired',
].map((value) => ({ value, label: value }));
const COMPRESSION_OPTIONS = ['raw', 'compressed', 'summarized', 'collapsed'].map((value) => ({
  value,
  label: value,
}));
const RETENTION_OPTIONS = ['ephemeral', 'short_term', 'medium_term', 'long_term', 'permanent'].map(
  (value) => ({ value, label: value.replace('_', ' ') }),
);

export function ExplorerView({ userId }: { userId: string }): React.JSX.Element {
  const { user } = useAuthStore();
  const actor = user?.email ?? user?.userId ?? 'human-owner';
  const [type, setType] = useState<MemoryType | ''>('');
  const [lifecycle, setLifecycle] = useState<MemoryLifecycleStatus | ''>('');
  const [compression, setCompression] = useState<MemoryCompressionState | ''>('');
  const [retention, setRetention] = useState<MemoryRetentionPolicy | ''>('');
  const [showCreate, setShowCreate] = useState(false);
  const [feedback, setFeedback] = useState<{ id: string; message: string; ok: boolean } | null>(
    null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useMemoryItems(userId, {
    type: type || undefined,
    lifecycleStatus: lifecycle || undefined,
    compressionState: compression || undefined,
    retentionPolicy: retention || undefined,
    limit: 50,
  });

  // ── Mutations (hoisted — hooks cannot be called in callbacks) ─────────
  const capture = useCaptureMemory();
  const lifecycleMutation = useTransitionMemoryLifecycle();
  const reinforce = useReinforceMemory();

  // ── Create form state ─────────────────────────────────────────────────
  const [form, setForm] = useState({
    title: '',
    content: '',
    source: '',
    sourceType: 'event' as MemorySourceType,
    owner: actor,
    type: 'project' as MemoryType,
    tags: '',
    importance: '',
    retentionPolicy: '' as MemoryRetentionPolicy | '',
  });

  const submitCreate = async (): Promise<void> => {
    if (!form.title.trim() || !form.content.trim() || !form.source.trim()) {
      setFeedback({ id: 'create', message: 'Title, content and source are required.', ok: false });
      return;
    }
    setBusyId('create');
    setFeedback(null);
    try {
      await capture.mutateAsync({
        userId,
        type: form.type,
        title: form.title.trim(),
        content: form.content.trim(),
        source: form.source.trim(),
        sourceType: form.sourceType,
        owner: form.owner || actor,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 20),
        importance: form.importance ? Math.min(1, Math.max(0, Number(form.importance))) : undefined,
        retentionPolicy: form.retentionPolicy || undefined,
        actor,
      });
      setFeedback({
        id: 'create',
        message:
          'Memory captured — validated, ranked, compressed and activated through the Memory Pipeline.',
        ok: true,
      });
      setForm({
        ...form,
        title: '',
        content: '',
        source: '',
        tags: '',
        importance: '',
        retentionPolicy: '',
      });
      setShowCreate(false);
    } catch (error) {
      setFeedback({
        id: 'create',
        message: error instanceof Error ? error.message : 'Capture failed.',
        ok: false,
      });
    }
    setBusyId(null);
    void refetch();
  };

  const transition = async (memoryId: string, to: MemoryLifecycleStatus): Promise<void> => {
    setBusyId(memoryId);
    setFeedback(null);
    try {
      await lifecycleMutation.mutateAsync({ userId, memoryId, to, actor });
      setFeedback({ id: memoryId, message: `Lifecycle → ${to}.`, ok: true });
    } catch (error) {
      setFeedback({
        id: memoryId,
        message: error instanceof Error ? error.message : 'Transition failed.',
        ok: false,
      });
    }
    setBusyId(null);
    void refetch();
  };

  const reinforceMemory = async (memoryId: string): Promise<void> => {
    setBusyId(memoryId);
    setFeedback(null);
    try {
      await reinforce.mutateAsync({ userId, memoryId, actor });
      setFeedback({
        id: memoryId,
        message: 'Memory reinforced — recency and frequency restored.',
        ok: true,
      });
    } catch (error) {
      setFeedback({
        id: memoryId,
        message: error instanceof Error ? error.message : 'Reinforcement failed.',
        ok: false,
      });
    }
    setBusyId(null);
    void refetch();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading memory registry…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<ListChecks className="h-10 w-10" />}
        title="Memory registry unavailable"
        description="The Enterprise Memory Layer could not be reached. Check your connection and retry."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={type}
            onChange={(e) => {
              setType(e.target.value as MemoryType | '');
            }}
            placeholder="All types"
            options={TYPE_OPTIONS}
            className="w-40"
          />
          <Select
            value={lifecycle}
            onChange={(e) => {
              setLifecycle(e.target.value as MemoryLifecycleStatus | '');
            }}
            placeholder="All lifecycles"
            options={LIFECYCLE_OPTIONS}
            className="w-40"
          />
          <Select
            value={compression}
            onChange={(e) => {
              setCompression(e.target.value as MemoryCompressionState | '');
            }}
            placeholder="All compression"
            options={COMPRESSION_OPTIONS}
            className="w-40"
          />
          <Select
            value={retention}
            onChange={(e) => {
              setRetention(e.target.value as MemoryRetentionPolicy | '');
            }}
            placeholder="All retention"
            options={RETENTION_OPTIONS}
            className="w-44"
          />
        </div>
        <Button
          onClick={() => {
            setShowCreate((v) => !v);
          }}
          variant={showCreate ? 'secondary' : 'primary'}
          className="gap-1.5"
        >
          {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showCreate ? 'Close capture' : 'Capture memory'}
        </Button>
      </div>

      {feedback && (
        <div
          className={`rounded-lg border px-4 py-2 text-sm ${
            feedback.ok
              ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {showCreate && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Capture a memory
          </h3>
          <p className="text-xs text-slate-400">
            An event enters the Memory Pipeline: Capture → Classification → Importance →
            Consolidation → Relationship Detection → Ranking → Compression → Retrieval.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              label="Title"
              value={form.title}
              onChange={(e) => {
                setForm({ ...form, title: e.target.value });
              }}
              placeholder="e.g. Provider OpenAI latency improved 40%"
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                value={form.type}
                onChange={(e) => {
                  setForm({ ...form, type: e.target.value as MemoryType });
                }}
                placeholder="Type"
                options={TYPE_OPTIONS}
              />
              <Select
                value={form.sourceType}
                onChange={(e) => {
                  setForm({ ...form, sourceType: e.target.value as MemorySourceType });
                }}
                placeholder="Source type"
                options={SOURCE_TYPE_OPTIONS}
              />
            </div>
            <div className="md:col-span-2">
              <Textarea
                label="Content"
                value={form.content}
                onChange={(e) => {
                  setForm({ ...form, content: e.target.value });
                }}
                placeholder="What happened, what worked, what failed — the experience itself."
                rows={4}
              />
            </div>
            <TextField
              label="Source"
              value={form.source}
              onChange={(e) => {
                setForm({ ...form, source: e.target.value });
              }}
              placeholder="e.g. execution run #42"
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Importance (0–1)"
                value={form.importance}
                onChange={(e) => {
                  setForm({ ...form, importance: e.target.value });
                }}
                placeholder="auto-scored if empty"
              />
              <Select
                value={form.retentionPolicy}
                onChange={(e) => {
                  setForm({ ...form, retentionPolicy: e.target.value as MemoryRetentionPolicy });
                }}
                placeholder="Retention (auto)"
                options={RETENTION_OPTIONS}
              />
            </div>
            <TextField
              label="Tags (comma separated)"
              value={form.tags}
              onChange={(e) => {
                setForm({ ...form, tags: e.target.value });
              }}
              placeholder="provider, latency, insight"
            />
            <div className="flex items-end">
              <Button
                onClick={() => void submitCreate()}
                disabled={busyId === 'create'}
                className="w-full gap-1.5"
              >
                {busyId === 'create' ? 'Capturing…' : 'Capture'}
                {busyId !== 'create' && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {data.items.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
          {TYPE_OPTIONS.map((opt) => {
            const color = TYPE_COLORS[opt.value as MemoryType] ?? FALLBACK_COLOR;
            return (
              <div
                key={opt.value}
                className="rounded-xl border border-slate-200 p-3 text-center dark:border-slate-700"
                style={{ borderTop: `3px solid ${color}` }}
              >
                <div className="text-xs font-semibold capitalize text-slate-600 dark:text-slate-300">
                  {opt.label}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">0 memories</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.items.map((item) => (
            <div key={item.memoryId}>
              <MemoryCard
                item={item}
                actions={
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {item.lifecycleStatus !== 'archived' && item.lifecycleStatus !== 'expired' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void reinforceMemory(item.memoryId);
                        }}
                        title="Reinforce (restore recency/frequency)"
                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-[#F97316]/10 hover:text-[#F97316]"
                      >
                        <Flame className="h-4 w-4" />
                      </button>
                    )}
                    {item.lifecycleStatus !== 'archived' && item.lifecycleStatus !== 'expired' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void transition(item.memoryId, 'archived');
                        }}
                        className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                      >
                        Archive
                      </button>
                    )}
                    {item.lifecycleStatus === 'archived' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void transition(item.memoryId, 'active');
                        }}
                        className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/20"
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                }
              />
              {feedback?.id === item.memoryId && (
                <p
                  className={`mt-1 text-xs ${feedback.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}
                >
                  {feedback.message}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-slate-400">
        Showing {data.items.length} of {data.total} memories
      </p>
    </div>
  );
}
