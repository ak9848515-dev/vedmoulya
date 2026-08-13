// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Permissions view
// APP-001 — Post-V1 Application Platform Layer
// Permission-aware context is mandatory: no context item may reach an
// agent simply because it is technically searchable. This view evaluates
// an access request (identity + organization + role) against the fabric's
// permission model and shows why access is granted or denied.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Loading, EmptyState, Badge } from '@vedmoulya/ui';
import { useContextFabricPermissions } from '../../lib/api-client.js';
import { ShieldCheck, ShieldX, Loader2 } from 'lucide-react';
import { EntityIcon, PermissionEvaluationBanner } from './components.js';
import { useAuthStore } from '../../stores/auth-store.js';

const ENTITIES = [
  { id: 'personal:goal:goal_blog_seed', label: 'Blog goal (yours)' },
  { id: 'personal:document:architecture_note', label: 'Architecture notes (yours)' },
  { id: 'business:team:platform', label: 'Platform team (organization)' },
  { id: 'business:document:brand_guidelines', label: 'Brand guidelines (organization)' },
] as const;

const DEFAULT_ENTITY = ENTITIES[0] as { id: string; label: string };

export function PermissionsView({ userId }: { userId: string }): React.JSX.Element {
  const { user } = useAuthStore();
  const sessionUserId = user?.userId ?? userId;
  const [selected, setSelected] = useState(DEFAULT_ENTITY.id);
  const [submitted, setSubmitted] = useState(DEFAULT_ENTITY.id);

  const query = useContextFabricPermissions(sessionUserId, submitted);

  const inspect = (event: React.SyntheticEvent): void => {
    event.preventDefault();
    setSubmitted(selected.trim());
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 dark:bg-[#1E293B]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#22C55E]" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Access request — identity: {sessionUserId} · roles: member
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Pipeline: identity → permission evaluation → eligible sources → retrieval → filtering →
          ranking → context package. Evaluate any entity in the fabric.
        </p>
        <form
          onSubmit={(event) => {
            inspect(event);
          }}
          className="mt-4 flex flex-col gap-3 sm:flex-row"
        >
          <select
            value={selected}
            onChange={(event) => {
              setSelected(event.target.value);
              setSubmitted(event.target.value);
            }}
            aria-label="Entity to evaluate"
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#2B5FD9] focus:outline-none dark:border-slate-700 dark:bg-[#0F172A] dark:text-white"
          >
            {ENTITIES.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.label} — {entity.id}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={query.isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#22C55E] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#16A34A] disabled:opacity-50"
          >
            {query.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Evaluate
          </button>
        </form>
      </Card>

      {query.isLoading && (
        <div className="flex items-center justify-center h-[30vh]">
          <Loading label="Evaluating permissions…" size="lg" />
        </div>
      )}

      {!query.isLoading && query.isError && (
        <EmptyState
          icon={<ShieldX className="h-10 w-10" />}
          title="Evaluation failed"
          description="The entity could not be found."
        />
      )}

      {!query.isLoading && query.data && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-5 dark:bg-[#1E293B]">
            <div className="mb-3 flex items-center gap-2">
              <EntityIcon type={submitted.includes('business') ? 'team' : 'goal'} />
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {submitted}
              </span>
            </div>
            <PermissionEvaluationBanner permission={query.data.permission} />
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Model: {query.data.label}
            </p>
          </Card>

          <Card className="p-5 dark:bg-[#1E293B]">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              How permission-aware retrieval works
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <li className="flex gap-2">
                <span className="text-[#22C55E]">✓</span> owner always has access
              </li>
              <li className="flex gap-2">
                <span className="text-[#22C55E]">✓</span> explicit allow-lists and role grants
                honored
              </li>
              <li className="flex gap-2">
                <span className="text-[#22C55E]">✓</span> organization-scoped context respects the
                tenant boundary
              </li>
              <li className="flex gap-2">
                <span className="text-[#22C55E]">✓</span> public context is shareable
              </li>
              <li className="flex gap-2">
                <span className="text-[#EF4444]">✗</span> private context is never retrievable by
                non-owners
              </li>
            </ul>
            <div className="mt-4">
              <Badge className="bg-[#F0FDF4] text-[#166534] dark:bg-[#14532D] dark:text-[#BBF7D0]">
                Permission coverage: every entity carries a complete access model
              </Badge>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
