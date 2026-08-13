// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Center: Consumers view
// EPIC-004 / EI-009 — Enterprise Knowledge Intelligence Platform
// Who uses each piece of knowledge — engines, modules, users, and systems —
// and the record-usage action to register a new consumer. VedMoulya always
// knows WHO uses its knowledge.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Badge, Loading, EmptyState, Select, TextField, Button } from '@vedmoulya/ui';
import {
  useKnowledgeConsumers,
  useKnowledgeItems,
  useRecordKnowledgeConsumerUsage,
} from '../../lib/api-client.js';
import { useAuthStore } from '../../stores/auth-store.js';
import { Users, Plus, X } from 'lucide-react';
import type { KnowledgeConsumerType } from '@vedmoulya/knowledge-intelligence';
import { ConsumerRow } from './components.js';

const CONSUMER_TYPE_OPTIONS = [
  { value: 'engine', label: 'Engine (Enterprise Intelligence)' },
  { value: 'module', label: 'Module (business module)' },
  { value: 'user', label: 'User (human)' },
  { value: 'system', label: 'System (automated)' },
];

export function ConsumersView({ userId }: { userId: string }): React.JSX.Element {
  const { user } = useAuthStore();
  const actor = user?.email ?? user?.userId ?? 'human-owner';
  const [selectedId, setSelectedId] = useState('');
  const [showRecord, setShowRecord] = useState(false);
  const [consumerLabel, setConsumerLabel] = useState('');
  const [consumerType, setConsumerType] = useState<KnowledgeConsumerType>('engine');
  const [feedback, setFeedback] = useState<{ message: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const items = useKnowledgeItems(userId, { limit: 100 });
  const consumers = useKnowledgeConsumers(userId, selectedId || 'none');
  const record = useRecordKnowledgeConsumerUsage();

  const itemOptions = (items.data?.items ?? []).map((item) => ({
    value: item.knowledgeId,
    label: `${item.title} (v${item.version})`,
  }));

  const submitRecord = async (): Promise<void> => {
    if (!selectedId || !consumerLabel.trim()) {
      setFeedback({ message: 'Select an item and enter the consumer label.', ok: false });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await record.mutateAsync({
        userId,
        knowledgeId: selectedId,
        consumerType,
        consumerLabel: consumerLabel.trim(),
        actor,
      });
      setFeedback({ message: 'Consumer usage recorded.', ok: true });
      setConsumerLabel('');
      setShowRecord(false);
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : 'Recording failed.',
        ok: false,
      });
    }
    setBusy(false);
    void consumers.refetch();
  };

  const selectedItem = (items.data?.items ?? []).find((item) => item.knowledgeId === selectedId);

  return (
    <div className="space-y-6">
      {/* ── Item picker + record usage ─────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="Knowledge item"
            options={[{ value: '', label: 'Select an item…' }, ...itemOptions]}
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setShowRecord(false);
            }}
            className="w-80"
          />
          <Button
            variant="secondary"
            disabled={!selectedId}
            onClick={() => {
              setShowRecord((s) => !s);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Record usage
          </Button>
          {selectedItem && (
            <Badge variant="info" className="text-[10px]">
              {selectedItem.consumers.length} consumers · {selectedItem.usage.totalReads} reads
            </Badge>
          )}
        </div>

        {feedback && (
          <div
            className={`mt-3 flex items-center justify-between rounded-lg border p-3 text-sm ${feedback.ok ? 'border-[#22C55E]/40 bg-[#22C55E]/10 text-[#15803D]' : 'border-[#EF4444]/40 bg-[#EF4444]/10 text-[#B91C1C]'}`}
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

        {showRecord && selectedId && (
          <div className="animate-slide-up mt-4 grid grid-cols-1 gap-4 rounded-lg border border-slate-100 p-4 md:grid-cols-2 dark:border-slate-800">
            <TextField
              label="Consumer label"
              value={consumerLabel}
              onChange={(e) => {
                setConsumerLabel(e.target.value);
              }}
              placeholder="e.g. Enterprise Brain · provider_selection"
            />
            <Select
              label="Consumer type"
              options={CONSUMER_TYPE_OPTIONS}
              value={consumerType}
              onChange={(e) => {
                setConsumerType(e.target.value as KnowledgeConsumerType);
              }}
            />
            <div className="md:col-span-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  void submitRecord();
                }}
                disabled={busy}
              >
                {busy ? 'Recording…' : 'Record consumer usage'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ── Consumer list ──────────────────────────────────────────────── */}
      {selectedId ? (
        <Card className="p-2">
          {consumers.isLoading ? (
            <Loading label="Loading consumers…" />
          ) : consumers.data && consumers.data.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {consumers.data.map((consumer) => (
                <ConsumerRow key={consumer.consumerId} consumer={consumer} />
              ))}
            </div>
          ) : (
            <p className="p-4 text-xs text-slate-400">
              No consumers yet — record the first usage above, or engines register automatically as
              they retrieve this knowledge.
            </p>
          )}
        </Card>
      ) : (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="Select a knowledge item"
          description="VedMoulya tracks who uses every piece of knowledge — engines, modules, users, and systems."
        />
      )}
    </div>
  );
}
