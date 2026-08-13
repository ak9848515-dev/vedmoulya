// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Center: Explorer view
// EPIC-004 / EI-009 — Enterprise Knowledge Intelligence Platform
// Browse the knowledge registry with category / lifecycle / validation
// filters, plus the create + validate + lifecycle actions. Every item is
// born with provenance (source, sourceType, owner) and automatically
// enriched with engine cross-links and a trust score.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import {
  Card,
  Badge,
  Loading,
  EmptyState,
  Button,
  Select,
  TextField,
  Textarea,
} from '@vedmoulya/ui';
import {
  useKnowledgeItems,
  useCreateKnowledgeItem,
  useValidateKnowledgeItem,
  useTransitionKnowledgeLifecycle,
} from '../../lib/api-client.js';
import { useAuthStore } from '../../stores/auth-store.js';
import { ListChecks, Plus, ShieldCheck, GitBranch, X } from 'lucide-react';
import type {
  KnowledgeCategory,
  KnowledgeLifecycleStatus,
  KnowledgeSourceType,
  KnowledgeValidationStatus,
} from '@vedmoulya/knowledge-intelligence';
import { CATEGORY_COLORS, FALLBACK_COLOR, formatDate } from './knowledge-ui.js';
import { KnowledgeCard } from './components.js';

const CATEGORY_OPTIONS = [
  'business',
  'technical',
  'user',
  'project',
  'ai',
  'sap',
  'client',
  'domain',
  'policy',
  'document',
  'api',
  'architecture',
  'learning',
  'execution',
].map((value) => ({ value, label: value }));
const SOURCE_TYPE_OPTIONS = [
  'document',
  'api',
  'architecture',
  'conversation',
  'observation',
  'export',
  'manual',
  'generated',
  'system',
  'report',
  'repository',
  'database',
].map((value) => ({ value, label: value }));
const LIFECYCLE_OPTIONS = ['draft', 'review', 'active', 'deprecated', 'archived'].map((value) => ({
  value,
  label: value,
}));
const VALIDATION_OPTIONS = ['unvalidated', 'pending', 'validated', 'failed'].map((value) => ({
  value,
  label: value,
}));

export function ExplorerView({ userId }: { userId: string }): React.JSX.Element {
  const { user } = useAuthStore();
  const actor = user?.email ?? user?.userId ?? 'human-owner';
  const [category, setCategory] = useState<KnowledgeCategory | ''>('');
  const [lifecycle, setLifecycle] = useState<KnowledgeLifecycleStatus | ''>('');
  const [validation, setValidation] = useState<KnowledgeValidationStatus | ''>('');
  const [showCreate, setShowCreate] = useState(false);
  const [feedback, setFeedback] = useState<{ id: string; message: string; ok: boolean } | null>(
    null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useKnowledgeItems(userId, {
    category: category || undefined,
    lifecycleStatus: lifecycle || undefined,
    validationStatus: validation || undefined,
    limit: 50,
  });

  // ── Mutations (hoisted — hooks cannot be called in callbacks) ─────────
  const create = useCreateKnowledgeItem();
  const validate = useValidateKnowledgeItem();
  const lifecycleMutation = useTransitionKnowledgeLifecycle();

  // ── Create form state ─────────────────────────────────────────────────
  const [form, setForm] = useState({
    title: '',
    description: '',
    source: '',
    sourceType: 'document' as KnowledgeSourceType,
    owner: actor,
    category: 'technical' as KnowledgeCategory,
    tags: '',
    confidence: '',
  });

  const submitCreate = async (): Promise<void> => {
    if (!form.title.trim() || !form.description.trim() || !form.source.trim()) {
      setFeedback({
        id: 'create',
        message: 'Title, description and source are required.',
        ok: false,
      });
      return;
    }
    setBusyId('create');
    setFeedback(null);
    try {
      await create.mutateAsync({
        userId,
        title: form.title.trim(),
        description: form.description.trim(),
        source: form.source.trim(),
        sourceType: form.sourceType,
        owner: form.owner || actor,
        category: form.category,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 20),
        confidence: form.confidence
          ? { score: Math.min(1, Math.max(0, Number(form.confidence))) }
          : undefined,
        actor,
      });
      setFeedback({
        id: 'create',
        message: 'Knowledge item created — trust scored, version 1, engine cross-links detected.',
        ok: true,
      });
      setForm({ ...form, title: '', description: '', source: '', tags: '', confidence: '' });
      setShowCreate(false);
    } catch (error) {
      setFeedback({
        id: 'create',
        message: error instanceof Error ? error.message : 'Create failed.',
        ok: false,
      });
    }
    setBusyId(null);
    void refetch();
  };

  const validateItem = async (knowledgeId: string): Promise<void> => {
    setBusyId(knowledgeId);
    setFeedback(null);
    try {
      await validate.mutateAsync({ userId, knowledgeId, actor });
      setFeedback({ id: knowledgeId, message: 'Validation report generated.', ok: true });
    } catch (error) {
      setFeedback({
        id: knowledgeId,
        message: error instanceof Error ? error.message : 'Validation failed.',
        ok: false,
      });
    }
    setBusyId(null);
    void refetch();
  };

  const transition = async (knowledgeId: string, to: KnowledgeLifecycleStatus): Promise<void> => {
    setBusyId(knowledgeId);
    setFeedback(null);
    try {
      await lifecycleMutation.mutateAsync({ userId, knowledgeId, to, actor });
      setFeedback({ id: knowledgeId, message: `Lifecycle → ${to}.`, ok: true });
    } catch (error) {
      setFeedback({
        id: knowledgeId,
        message: error instanceof Error ? error.message : 'Transition failed.',
        ok: false,
      });
    }
    setBusyId(null);
    void refetch();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading knowledge registry…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<ListChecks className="h-10 w-10" />}
        title="Knowledge registry unavailable"
        description="The Enterprise Knowledge Layer could not be reached."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Category"
          options={[{ value: '', label: 'All categories' }, ...CATEGORY_OPTIONS]}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as KnowledgeCategory | '');
          }}
          className="w-44"
        />
        <Select
          label="Lifecycle"
          options={[{ value: '', label: 'All lifecycles' }, ...LIFECYCLE_OPTIONS]}
          value={lifecycle}
          onChange={(e) => {
            setLifecycle(e.target.value as KnowledgeLifecycleStatus | '');
          }}
          className="w-40"
        />
        <Select
          label="Validation"
          options={[{ value: '', label: 'All validation' }, ...VALIDATION_OPTIONS]}
          value={validation}
          onChange={(e) => {
            setValidation(e.target.value as KnowledgeValidationStatus | '');
          }}
          className="w-40"
        />
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setShowCreate((s) => !s);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> New knowledge
        </Button>
        <Badge variant="info" className="ml-auto text-[10px]">
          {data.total} items
        </Badge>
      </div>

      {feedback && (
        <div
          className={`flex items-center justify-between rounded-lg border p-3 text-sm ${feedback.ok ? 'border-[#22C55E]/40 bg-[#22C55E]/10 text-[#15803D]' : 'border-[#EF4444]/40 bg-[#EF4444]/10 text-[#B91C1C]'}`}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => {
              setFeedback(null);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Create form ────────────────────────────────────────────────── */}
      {showCreate && (
        <Card className="animate-slide-up p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Capture knowledge
          </h3>
          <p className="text-xs text-slate-400">
            Provenance is mandatory — every item records where it came from, who owns it, and is
            trust-scored on ingest.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <TextField
                label="Title"
                value={form.title}
                onChange={(e) => {
                  setForm({ ...form, title: e.target.value });
                }}
                placeholder="e.g. Client onboarding procedure (SAP)"
              />
            </div>
            <div className="md:col-span-2">
              <Textarea
                label="Description"
                value={form.description}
                onChange={(e) => {
                  setForm({ ...form, description: e.target.value });
                }}
                rows={3}
                placeholder="The authoritative knowledge this item captures…"
              />
            </div>
            <div>
              <TextField
                label="Source"
                value={form.source}
                onChange={(e) => {
                  setForm({ ...form, source: e.target.value });
                }}
                placeholder="e.g. Client onboarding doc v3"
              />
            </div>
            <div>
              <Select
                label="Source type"
                options={SOURCE_TYPE_OPTIONS}
                value={form.sourceType}
                onChange={(e) => {
                  setForm({ ...form, sourceType: e.target.value as KnowledgeSourceType });
                }}
              />
            </div>
            <div>
              <Select
                label="Category"
                options={CATEGORY_OPTIONS}
                value={form.category}
                onChange={(e) => {
                  setForm({ ...form, category: e.target.value as KnowledgeCategory });
                }}
              />
            </div>
            <div>
              <TextField
                label="Owner"
                value={form.owner}
                onChange={(e) => {
                  setForm({ ...form, owner: e.target.value });
                }}
              />
            </div>
            <div>
              <TextField
                label="Tags (comma separated)"
                value={form.tags}
                onChange={(e) => {
                  setForm({ ...form, tags: e.target.value });
                }}
                placeholder="sap, onboarding, client"
              />
            </div>
            <div>
              <TextField
                label="Confidence (0–1, optional)"
                value={form.confidence}
                onChange={(e) => {
                  setForm({ ...form, confidence: e.target.value });
                }}
                placeholder="0.85"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                void submitCreate();
              }}
              disabled={busyId === 'create'}
            >
              {busyId === 'create' ? 'Creating…' : 'Create knowledge item'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowCreate(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* ── Item grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.items.map((item) => {
          const color = CATEGORY_COLORS[item.category] ?? FALLBACK_COLOR;
          return (
            <KnowledgeCard
              key={item.knowledgeId}
              item={item}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      void validateItem(item.knowledgeId);
                    }}
                    disabled={busyId === item.knowledgeId}
                    className="flex items-center gap-1 rounded-md bg-[#22C55E]/10 px-2 py-1 text-[10px] font-semibold text-[#15803D] transition-colors hover:bg-[#22C55E]/20"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" /> Validate
                  </button>
                  {item.lifecycleStatus === 'draft' && (
                    <button
                      onClick={() => {
                        void transition(item.knowledgeId, 'review');
                      }}
                      disabled={busyId === item.knowledgeId}
                      className="flex items-center gap-1 rounded-md bg-[#F59E0B]/10 px-2 py-1 text-[10px] font-semibold text-[#B45309] transition-colors hover:bg-[#F59E0B]/20"
                    >
                      <GitBranch className="h-3.5 w-3.5" /> Send to review
                    </button>
                  )}
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-400">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    {formatDate(item.updatedAt)}
                  </span>
                </div>
              }
            />
          );
        })}
      </div>

      {data.items.length === 0 && (
        <EmptyState
          icon={<ListChecks className="h-10 w-10" />}
          title="No knowledge matches"
          description="Adjust the filters or capture the first knowledge item above."
        />
      )}
    </div>
  );
}
