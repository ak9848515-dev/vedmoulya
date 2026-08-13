// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Learning Intelligence: Explorer view
// EPIC-004 / EI-007 — Enterprise Learning Intelligence Platform
// Searchable learning event log + manual signal recorder.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Loading, EmptyState, TextField, Select } from '@vedmoulya/ui';
import { useLearningIntelligenceEvents, useRecordLearningEvent } from '../../lib/api-client.js';
import type { LearningCategory } from '@vedmoulya/learning-intelligence';
import { Search, ListChecks, PlusCircle } from 'lucide-react';
import { CATEGORY_LABELS } from './learning-ui.js';
import { LearningEventRow } from './components.js';

const CATEGORY_OPTIONS = [
  { value: '', label: 'All categories' },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
];

const OUTCOME_OPTIONS = [
  { value: '', label: 'All outcomes' },
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
];

export function ExplorerView({ userId }: { userId: string }): React.JSX.Element {
  const [category, setCategory] = useState('');
  const [outcome, setOutcome] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useLearningIntelligenceEvents(userId, {
    category: (category || undefined) as LearningCategory | undefined,
    outcome: (outcome || undefined) as 'success' | 'failure' | undefined,
    page,
    limit: 20,
  });

  const recordMutation = useRecordLearningEvent();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    entityType: 'provider',
    entityId: '',
    outcome: 'success',
    quality: '0.9',
    costUsd: '0.01',
    latencyMs: '400',
  });
  const [formError, setFormError] = useState('');

  const submitRecord = async (e: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setFormError('');
    if (!form.entityId.trim()) {
      setFormError('Entity id is required.');
      return;
    }
    try {
      await recordMutation.mutateAsync({
        userId,
        category: (category || 'provider') as LearningCategory,
        entityType: form.entityType.trim() || 'provider',
        entityId: form.entityId.trim(),
        outcome: form.outcome as 'success' | 'failure',
        quality: Number(form.quality),
        costUsd: Number(form.costUsd),
        latencyMs: Number(form.latencyMs),
        confidence: 0.9,
        accuracy: 0.9,
        retries: 0,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to record signal.');
      return;
    }
    setForm({ ...form, entityId: '' });
    void refetch();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading learning events…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<ListChecks className="h-10 w-10" />}
        title="Events unavailable"
        description="The learning event log could not be loaded."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.total / 20));

  return (
    <div className="space-y-4">
      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-40 flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">Category</label>
          <Select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
            }}
            options={CATEGORY_OPTIONS}
          />
        </div>
        <div className="min-w-36">
          <label className="mb-1 block text-xs font-medium text-slate-500">Outcome</label>
          <Select
            value={outcome}
            onChange={(e) => {
              setOutcome(e.target.value);
            }}
            options={OUTCOME_OPTIONS}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Search className="h-4 w-4" />
          {data.total} signal(s)
        </div>
      </Card>

      {/* ── Record a signal (manual ingestion) ───────────────────────────── */}
      <Card className="p-4">
        <button
          onClick={() => {
            setShowForm((s) => !s);
          }}
          className="flex items-center gap-2 text-sm font-semibold text-[#2B5FD9] transition-colors hover:text-[#1E4BB8]"
        >
          <PlusCircle className="h-4 w-4" />
          {showForm ? 'Hide' : 'Record'} a learning signal manually
        </button>
        {showForm && (
          <form
            onSubmit={(e) => void submitRecord(e)}
            className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4"
          >
            <TextField
              label="Entity type"
              value={form.entityType}
              onChange={(e) => {
                setForm({ ...form, entityType: e.target.value });
              }}
            />
            <TextField
              label="Entity id"
              value={form.entityId}
              onChange={(e) => {
                setForm({ ...form, entityId: e.target.value });
              }}
              placeholder="openai"
            />
            <Select
              label="Outcome"
              value={form.outcome}
              onChange={(e) => {
                setForm({ ...form, outcome: e.target.value });
              }}
              options={OUTCOME_OPTIONS.filter((o) => o.value !== '')}
            />
            <TextField
              label="Quality (0–1)"
              value={form.quality}
              onChange={(e) => {
                setForm({ ...form, quality: e.target.value });
              }}
            />
            <TextField
              label="Cost (USD)"
              value={form.costUsd}
              onChange={(e) => {
                setForm({ ...form, costUsd: e.target.value });
              }}
            />
            <TextField
              label="Latency (ms)"
              value={form.latencyMs}
              onChange={(e) => {
                setForm({ ...form, latencyMs: e.target.value });
              }}
            />
            <div className="col-span-2 flex items-end">
              <button
                type="submit"
                disabled={recordMutation.isPending}
                className="rounded-lg bg-[#2B5FD9] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1E4BB8] disabled:opacity-50"
              >
                {recordMutation.isPending ? 'Recording…' : 'Record signal'}
              </button>
            </div>
            {formError && <p className="col-span-4 text-xs text-red-500">{formError}</p>}
          </form>
        )}
      </Card>

      {/* ── Event list ──────────────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.items.map((event) => (
            <LearningEventRow key={event.eventId} event={event} />
          ))}
          {data.items.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-400">
              No learning signals match the current filters.
            </p>
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
            <button
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
              }}
              className="rounded-md px-3 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
            >
              Previous
            </button>
            <span className="text-xs text-slate-400">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => {
                setPage((p) => Math.min(totalPages, p + 1));
              }}
              className="rounded-md px-3 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
