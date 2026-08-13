// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Provenance view
// APP-001 — Post-V1 Application Platform Layer
// Every context item answers: where did this come from, when was it
// created/updated, which source produced it, why was it selected, what
// confidence did it receive, and what permissions allowed access.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Loading, EmptyState, Badge } from '@vedmoulya/ui';
import { useContextFabricProvenance } from '../../lib/api-client.js';
import { ScrollText, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store.js';

const PRESET_IDS = [
  { id: 'personal:goal:goal_blog_seed', label: 'Blog goal' },
  { id: 'personal:memory:blog_learning', label: 'Blog memory' },
  { id: 'personal:knowledge:fabric_pattern', label: 'Fabric pattern' },
  { id: 'business:team:platform', label: 'Platform team' },
  { id: 'business:document:brand_guidelines', label: 'Brand guidelines' },
] as const;

const DEFAULT_PRESET = PRESET_IDS[0] as { id: string; label: string };

export function ProvenanceView({ userId }: { userId: string }): React.JSX.Element {
  const { user } = useAuthStore();
  const sessionUserId = user?.userId ?? userId;
  const [entityId, setEntityId] = useState(DEFAULT_PRESET.id);
  const [submitted, setSubmitted] = useState(DEFAULT_PRESET.id);

  const query = useContextFabricProvenance(sessionUserId, submitted);

  const inspect = (event: React.SyntheticEvent): void => {
    event.preventDefault();
    setSubmitted(entityId.trim());
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 dark:bg-[#1E293B]">
        <form
          onSubmit={(event) => {
            inspect(event);
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="flex-1">
            <input
              value={entityId}
              onChange={(event) => {
                setEntityId(event.target.value);
              }}
              placeholder="Entity id (e.g. personal:goal:goal_blog_seed)"
              aria-label="Entity id"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#2B5FD9] focus:outline-none dark:border-slate-700 dark:bg-[#0F172A] dark:text-white"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESET_IDS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setEntityId(preset.id);
                    setSubmitted(preset.id);
                  }}
                  className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-500 transition-colors hover:border-[#2B5FD9] hover:text-[#2B5FD9] dark:border-slate-700 dark:text-slate-400"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={!entityId.trim() || query.isLoading}
            className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0F766E] disabled:opacity-50 sm:self-auto"
          >
            {query.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ScrollText className="h-4 w-4" />
            )}
            Inspect provenance
          </button>
        </form>
      </Card>

      {query.isLoading && (
        <div className="flex items-center justify-center h-[30vh]">
          <Loading label="Tracing provenance…" size="lg" />
        </div>
      )}

      {!query.isLoading && query.isError && (
        <EmptyState
          icon={<ScrollText className="h-10 w-10" />}
          title="Provenance unavailable"
          description="The entity could not be found or the fabric could not trace it."
        />
      )}

      {!query.isLoading && query.data && (
        <Card className="p-5 dark:bg-[#1E293B]">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-[#0D9488]" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Provenance</h2>
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#0F172A]">
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {query.data.provenance}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {query.data.facts.map((fact, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0D9488]" />
                <span className="text-slate-600 dark:text-slate-300">{fact}</span>
              </div>
            ))}
          </div>
          <Badge className="mt-4 bg-[#F0FDF4] text-[#166534] dark:bg-[#14532D] dark:text-[#BBF7D0]">
            {submitted}
          </Badge>
        </Card>
      )}
    </div>
  );
}
