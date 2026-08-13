// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Center: Versions + Diff view
// EPIC-004 / EI-009 — Enterprise Knowledge Intelligence Platform
// Version history per knowledge item (each update snapshots a revision) and
// the Knowledge Diff Viewer — exactly what changed between two versions,
// field by field, tag by tag.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Badge, Loading, EmptyState, Select, Button } from '@vedmoulya/ui';
import { useKnowledgeVersions, useKnowledgeDiff, useKnowledgeItems } from '../../lib/api-client.js';
import { History, GitCompareArrows, Plus, Minus, Search } from 'lucide-react';
import { VersionRow } from './components.js';

export function VersionsView({ userId }: { userId: string }): React.JSX.Element {
  const [selectedId, setSelectedId] = useState('');
  const [fromVersion, setFromVersion] = useState('');
  const [toVersion, setToVersion] = useState('');
  const [diffPair, setDiffPair] = useState<{ from?: number; to?: number } | null>(null);

  const items = useKnowledgeItems(userId, { limit: 100 });
  const versions = useKnowledgeVersions(userId, selectedId || 'none');
  const diff = useKnowledgeDiff(
    userId,
    selectedId || 'none',
    diffPair?.from ?? undefined,
    diffPair?.to ?? undefined,
  );

  const itemOptions = (items.data?.items ?? []).map((item) => ({
    value: item.knowledgeId,
    label: `${item.title} (v${item.version})`,
  }));

  const versionOptions = (versions.data ?? []).map((v) => ({
    value: String(v.versionNumber),
    label: `v${v.versionNumber} — ${v.changeSummary.slice(0, 40)}`,
  }));

  return (
    <div className="space-y-6">
      {/* ── Item + version pickers ─────────────────────────────────────── */}
      <Card className="p-5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <History className="h-4 w-4 text-[#7C3AED]" /> Version history
        </h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Select
            label="Knowledge item"
            options={[{ value: '', label: 'Select an item…' }, ...itemOptions]}
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setFromVersion('');
              setToVersion('');
              setDiffPair(null);
            }}
            className="w-72"
          />
          <Select
            label="From version"
            options={[{ value: '', label: 'Latest' }, ...versionOptions]}
            value={fromVersion}
            onChange={(e) => {
              setFromVersion(e.target.value);
            }}
            className="w-52"
          />
          <Select
            label="To version"
            options={[{ value: '', label: 'Latest' }, ...versionOptions]}
            value={toVersion}
            onChange={(e) => {
              setToVersion(e.target.value);
            }}
            className="w-52"
          />
          <Button
            variant="secondary"
            disabled={!selectedId || (!fromVersion && !toVersion)}
            onClick={() => {
              setDiffPair({
                from: fromVersion ? Number(fromVersion) : undefined,
                to: toVersion ? Number(toVersion) : undefined,
              });
            }}
          >
            <GitCompareArrows className="mr-1 h-4 w-4" /> Diff
          </Button>
        </div>
      </Card>

      {/* ── Diff viewer ────────────────────────────────────────────────── */}
      {selectedId && diffPair && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Knowledge Diff
          </h3>
          {diff.isLoading ? (
            <Loading label="Computing diff…" />
          ) : diff.data ? (
            <div className="mt-3 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info" className="text-[10px]">
                  v{diff.data.fromVersion} → v{diff.data.toVersion}
                </Badge>
                <Badge className="bg-slate-100 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {diff.data.changedFields.length} changed field
                  {diff.data.changedFields.length === 1 ? '' : 's'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div
                  className={`rounded-lg border p-3 text-sm ${diff.data.titleChanged ? 'border-[#EF4444]/40 bg-[#EF4444]/5' : 'border-slate-100 dark:border-slate-800'}`}
                >
                  <div className="text-[10px] font-semibold uppercase text-slate-400">Title</div>
                  <div className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">
                    {diff.data.titleChanged ? (
                      <span className="flex items-center gap-1">
                        <Minus className="h-3.5 w-3.5 text-[#EF4444]" /> changed
                      </span>
                    ) : (
                      'unchanged'
                    )}
                  </div>
                </div>
                <div
                  className={`rounded-lg border p-3 text-sm ${diff.data.descriptionChanged ? 'border-[#EF4444]/40 bg-[#EF4444]/5' : 'border-slate-100 dark:border-slate-800'}`}
                >
                  <div className="text-[10px] font-semibold uppercase text-slate-400">
                    Description
                  </div>
                  <div className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">
                    {diff.data.descriptionChanged ? (
                      <span className="flex items-center gap-1">
                        <Minus className="h-3.5 w-3.5 text-[#EF4444]" /> changed
                      </span>
                    ) : (
                      'unchanged'
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-[#22C55E]/5 p-3">
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase text-[#15803D]">
                    <Plus className="h-3.5 w-3.5" /> Tags added
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {diff.data.tagsAdded.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[#22C55E]/15 px-2 py-0.5 text-[10px] text-[#15803D]"
                      >
                        #{tag}
                      </span>
                    ))}
                    {diff.data.tagsAdded.length === 0 && (
                      <span className="text-xs text-slate-400">none</span>
                    )}
                  </div>
                </div>
                <div className="rounded-lg bg-[#EF4444]/5 p-3">
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase text-[#B91C1C]">
                    <Minus className="h-3.5 w-3.5" /> Tags removed
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {diff.data.tagsRemoved.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[#EF4444]/15 px-2 py-0.5 text-[10px] text-[#B91C1C]"
                      >
                        #{tag}
                      </span>
                    ))}
                    {diff.data.tagsRemoved.length === 0 && (
                      <span className="text-xs text-slate-400">none</span>
                    )}
                  </div>
                </div>
              </div>

              <p className="rounded-lg bg-slate-50 p-3 text-xs italic text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                {diff.data.summary}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400">Select two versions to compare.</p>
          )}
        </Card>
      )}

      {/* ── Version list ───────────────────────────────────────────────── */}
      {selectedId && (
        <Card className="divide-y divide-slate-100 p-2 dark:divide-slate-800">
          {versions.isLoading ? (
            <Loading label="Loading version history…" />
          ) : versions.data && versions.data.length > 0 ? (
            versions.data.map((version) => <VersionRow key={version.versionId} version={version} />)
          ) : (
            <p className="p-4 text-xs text-slate-400">No versions recorded.</p>
          )}
        </Card>
      )}

      {!selectedId && (
        <EmptyState
          icon={<Search className="h-10 w-10" />}
          title="Select a knowledge item"
          description="Each update snapshots a revision — compare any two versions with the diff viewer."
        />
      )}
    </div>
  );
}
