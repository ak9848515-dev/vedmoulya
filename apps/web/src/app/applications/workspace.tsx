// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory Workspace
// EPIC-008 — Phase 3. The real user workspace for one application:
//   Overview · Specification · Architecture · Plan · Build · Files · Diff ·
//   Tests · Security · History · Deployment · Settings
// plus lifecycle management (rename / archive / delete per policy / resume —
// EPIC-008 Phase 1) and version history (Phase 14). All data comes from the
// real factory.* API — nothing is faked. Destructive actions require explicit
// confirmation; deployment requires explicit authorization; every operation is
// owner-scoped server-side (the UI never bypasses the API boundary).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import { Card, Loading, Button } from '@vedmoulya/ui';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Coins,
  FileCode2,
  FolderOpen,
  GitBranch,
  Hammer,
  History as HistoryIcon,
  LayoutDashboard,
  Layers,
  MonitorPlay,
  Package,
  PlayCircle,
  RefreshCw,
  Scale,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Target,
  TestTube2,
  Trash2,
  User,
  FileText,
  GitCompare,
  Gauge,
  Pencil,
} from 'lucide-react';
import {
  useFactoryApprove,
  useFactoryArchive,
  useFactoryBuild,
  useFactoryDelete,
  useFactoryDeploy,
  useFactoryDetail,
  useFactoryHistory,
  useFactoryPreview,
  useFactoryRename,
  useFactoryResume,
  useFactoryStatus,
  useFactoryVcCommit,
  useFactoryVcDiff,
  useFactoryVcInit,
  useFactoryVcPreparePullRequest,
  useExperienceEvaluate,
  useExperienceEvaluateWithAI,
  useExperienceRefine,
} from '../../lib/api-client.js';
import type {
  FactoryApplicationDTO,
  FactoryDetailDTO,
  RepairAttempt,
} from '@vedmoulya/app-factory';

// ── Shared formatting helpers ────────────────────────────────────────────────

function fmtTokens(n: number | undefined): string {
  return n === undefined ? '—' : n.toLocaleString();
}

function fmtCost(n: number | undefined): string {
  return n === undefined ? '—' : `$${n.toFixed(4)}`;
}

function fmtDate(iso: string | undefined): string {
  return iso ? new Date(iso).toLocaleString() : '—';
}

function statusTone(status: string): string {
  switch (status) {
    case 'READY':
    case 'DEPLOYED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30';
    case 'FAILED':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30';
    case 'BUILDING':
    case 'VALIDATING':
      return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30';
    case 'DRAFT':
    case 'PLANNED':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30';
    case 'ARCHIVED':
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

function SectionHeading({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}): React.JSX.Element {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="text-[#2B5FD9]">{icon}</span>
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center dark:border-slate-700 dark:bg-[#1E293B]">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-xs font-bold text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-1.5 text-xs dark:border-slate-800">
      <span className="shrink-0 font-medium text-slate-400">{label}</span>
      <span className="text-right text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  );
}

// ── Plan Preview: the Phase 8 approval gate ─────────────────────────────────

function PlanPreview({
  app,
  userId,
  onApproved,
}: {
  app: FactoryApplicationDTO;
  userId: string;
  onApproved: () => void;
}): React.JSX.Element {
  const approveMutation = useFactoryApprove();
  const [changes, setChanges] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleApprove = (): void => {
    setError(null);
    void approveMutation
      .mutateAsync({
        userId,
        applicationId: app.applicationId,
        changes: changes.trim() || undefined,
      })
      .then((res) => {
        if (res.data?.status === 'PLANNED') onApproved();
        else setError('The plan was not approved — try again.');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to approve the plan.');
      });
  };

  return (
    <div className="space-y-4">
      <div
        className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${statusTone(app.status)}`}
      >
        {app.status === 'DRAFT'
          ? 'Plan preview ready — review before building. No files have been generated yet.'
          : `Plan approved at ${app.status}`}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {app.archetype} archetype · {app.aiCapabilities.length} AI capabilities ·{' '}
        {app.technologies.length} technologies
      </p>
      <div className="flex flex-wrap gap-1.5">
        {app.technologies.slice(0, 8).map((t) => (
          <span
            key={t.name}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            {t.name}
          </span>
        ))}
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Estimated AI usage (before build)
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Coins className="h-3 w-3" />{' '}
            {fmtTokens(app.economics?.estimatedBefore.estimatedTokens ?? 8000)} estimated tokens
          </span>
          <span className="ml-3 inline-flex items-center gap-1">
            <Coins className="h-3 w-3" />{' '}
            {fmtCost(app.economics?.estimatedBefore.estimatedCostUsd ?? 0.5)} estimated cost
          </span>
        </p>
      </div>
      {app.status === 'DRAFT' && (
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Review before you approve
          </p>
          <textarea
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm dark:border-slate-600 dark:bg-[#0F172A] dark:text-slate-100"
            rows={2}
            value={changes}
            onChange={(e) => {
              setChanges(e.target.value);
            }}
            placeholder="Optional: adjust the requirements before building…"
          />
          {error && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {error}
            </p>
          )}
          <Button
            className="mt-2"
            size="sm"
            disabled={approveMutation.isPending}
            onClick={handleApprove}
          >
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            Approve plan & build
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Repair Loop (EPIC-008 Phase 11): attempt n/6, diagnose → patch → diff →
//    re-validate, REPAIR_LIMIT_REACHED. Rendered from the persisted engine
//    trace — never faked. ─────────────────────────────────────────────────────

function RepairAttemptCard({ attempt }: { attempt: RepairAttempt }): React.JSX.Element {
  const fixed = attempt.result.overall === 'PASS';
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-[#2B5FD9]/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#2B5FD9]">
          attempt {attempt.attempt}/{attempt.limit}
        </span>
        <span className="text-slate-500 dark:text-slate-300">
          diagnose <span className="font-mono">{attempt.diagnosis.overall}</span> → patch{' '}
          {attempt.patches.length} → re-validate{' '}
          <span
            className={`font-mono font-semibold ${fixed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
          >
            {attempt.result.overall}
          </span>
        </span>
      </div>
      {attempt.diagnosis.gates.filter((g) => !g.passed).length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Diagnosis — failing gates
          </p>
          <ul className="mt-1 space-y-0.5 text-slate-500 dark:text-slate-400">
            {attempt.diagnosis.gates
              .filter((g) => !g.passed)
              .map((g) => (
                <li key={g.gate}>
                  <span className="font-mono text-rose-500">{g.gate}</span>
                  {g.findings.slice(0, 2).map((f, i) => (
                    <span key={i} className="text-slate-400">
                      {' '}
                      — {f}
                    </span>
                  ))}
                </li>
              ))}
          </ul>
        </div>
      )}
      {attempt.patches.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Patches applied
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {attempt.patches.map((p) => (
              <span
                key={p.path}
                className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
              >
                + {p.path}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RepairLoopPanel({
  app,
  onResume,
}: {
  app: FactoryApplicationDTO;
  onResume?: () => void;
}): React.JSX.Element | null {
  const attempts = app.repairAttempts ?? [];
  if (attempts.length === 0) return null;
  const limit = app.repairLimit ?? attempts[0]?.limit ?? 6;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Repair loop — {Math.min(attempts.length, limit)}/{limit} attempts used
        </p>
        <div className="flex gap-1">
          {Array.from({ length: limit }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 w-4 rounded-full ${i < attempts.length ? 'bg-rose-400' : 'bg-slate-200 dark:bg-slate-700'}`}
            />
          ))}
        </div>
      </div>
      {app.repairLimitReached && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />
          REPAIR_LIMIT_REACHED — validation still failed after {limit} attempts. The application is{' '}
          <span className="font-bold">not ready</span>; fix the diagnosis below or resume to
          rebuild.
          {onResume && (
            <Button className="ml-2" size="sm" variant="secondary" onClick={onResume}>
              <RefreshCw className="mr-1 h-3 w-3" />
              Resume & rebuild
            </Button>
          )}
        </div>
      )}
      <div className="space-y-2">
        {attempts.map((a) => (
          <RepairAttemptCard key={a.attempt} attempt={a} />
        ))}
      </div>
    </div>
  );
}

// ── Build Panel: status + validation + economics (real EPIC-006 trace) ───────

function BuildPanel({
  app,
  userId,
  onDone,
}: {
  app: FactoryApplicationDTO;
  userId: string;
  onDone: () => void;
}): React.JSX.Element {
  const buildMutation = useFactoryBuild();
  const resumeMutation = useFactoryResume();
  const [error, setError] = useState<string | null>(null);

  const isActive = app.status === 'BUILDING' || app.status === 'VALIDATING';

  const handleBuild = (): void => {
    setError(null);
    void buildMutation
      .mutateAsync({ userId, applicationId: app.applicationId, approved: true })
      .then(() => {
        onDone();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'The build failed to start.');
      });
  };

  const handleResumeRebuild = (): void => {
    setError(null);
    void resumeMutation
      .mutateAsync({ userId, applicationId: app.applicationId })
      .then(() => {
        handleBuild();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Resume failed.');
      });
  };

  if (isActive) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading label="Building — generate → validate → critique → refine…" size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {app.lastValidation && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Validation ({app.lastValidation.overall})
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {app.lastValidation.gates.map((g) => (
              <div
                key={g.gate}
                className={`rounded-lg border p-2.5 ${
                  g.passed
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                    : 'border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10'
                }`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {g.gate}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                  {g.passed ? 'PASS' : `${Math.round(g.score * 100)}%`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      <RepairLoopPanel
        app={app}
        onResume={app.repairLimitReached ? handleResumeRebuild : undefined}
      />
      {app.terminationReason && (
        <div className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Loop terminated: <span className="font-mono font-semibold">{app.terminationReason}</span>
          {app.error ? ` — ${app.error}` : ''}
        </div>
      )}
      {app.economics && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Economics
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCell label="AI calls" value={String(app.economics.aiCalls)} />
            <StatCell label="Tokens" value={fmtTokens(app.economics.totalTokens)} />
            <StatCell label="Cost" value={fmtCost(app.economics.estimatedCostUsd)} />
            <StatCell label="Iterations" value={String(app.economics.iterations)} />
          </div>
        </div>
      )}
      {(app.status === 'DRAFT' || app.status === 'PLANNED') && (
        <div>
          <Button size="sm" disabled={buildMutation.isPending} onClick={handleBuild}>
            {buildMutation.isPending ? (
              <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Hammer className="mr-1 h-3.5 w-3.5" />
            )}
            Start build (requires approved plan)
          </Button>
          {error && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {error}
            </p>
          )}
        </div>
      )}
      {app.status !== 'DRAFT' && app.status !== 'PLANNED' && (
        <Button size="sm" variant="secondary" onClick={onDone}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          Refresh build
        </Button>
      )}
    </div>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────────

type TabId =
  | 'overview'
  | 'specification'
  | 'architecture'
  | 'plan'
  | 'build'
  | 'files'
  | 'diff'
  | 'tests'
  | 'security'
  | 'quality'
  | 'preview'
  | 'history'
  | 'deployment'
  | 'settings';

const TABS: ReadonlyArray<{
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'specification', label: 'Specification', icon: FileText },
  { id: 'architecture', label: 'Architecture', icon: Layers },
  { id: 'plan', label: 'Plan', icon: Target },
  { id: 'build', label: 'Build', icon: Hammer },
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'diff', label: 'Diff', icon: GitCompare },
  { id: 'tests', label: 'Tests', icon: TestTube2 },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'quality', label: 'Quality', icon: Gauge },
  { id: 'preview', label: 'Preview', icon: MonitorPlay },
  { id: 'history', label: 'History', icon: HistoryIcon },
  { id: 'deployment', label: 'Deployment', icon: Package },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

function OverviewTab({
  app,
  detail,
}: {
  app: FactoryApplicationDTO;
  detail?: FactoryDetailDTO;
}): React.JSX.Element {
  return (
    <div className="space-y-5">
      <div>
        <SectionHeading icon={<LayoutDashboard className="h-4 w-4" />} title="Purpose" />
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {detail?.specification.purpose ?? app.name}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCell label="Files" value={String(app.fileCount)} />
        <StatCell label="AI calls" value={app.economics ? String(app.economics.aiCalls) : '—'} />
        <StatCell
          label="Tokens"
          value={app.economics ? fmtTokens(app.economics.totalTokens) : '—'}
        />
        <StatCell
          label="Cost"
          value={app.economics ? fmtCost(app.economics.estimatedCostUsd) : '—'}
        />
      </div>
      <div>
        <SectionHeading icon={<Layers className="h-4 w-4" />} title="Technologies" />
        <div className="flex flex-wrap gap-1.5">
          {app.technologies.length === 0 && (
            <span className="text-xs text-slate-400">
              Technologies are selected when the plan is produced.
            </span>
          )}
          {app.technologies.map((t) => (
            <span
              key={t.name}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {t.name}
            </span>
          ))}
        </div>
      </div>
      <div>
        <SectionHeading icon={<Sparkles className="h-4 w-4" />} title="AI capabilities" />
        <div className="flex flex-wrap gap-1.5">
          {app.aiCapabilities.length === 0 && (
            <span className="text-xs text-slate-400">
              AI capabilities are selected when the plan is produced.
            </span>
          )}
          {app.aiCapabilities.map((c) => (
            <span
              key={c}
              className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
      <div>
        <SectionHeading icon={<ShieldCheck className="h-4 w-4" />} title="Health summary" />
        <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
          {app.health === 'unhealthy' && (
            <p className="text-rose-600 dark:text-rose-400">
              Security review blocked completion — open the Security tab for findings.
            </p>
          )}
          {app.health === 'healthy' && (
            <p className="text-emerald-600 dark:text-emerald-400">
              Last build passed validation and security gates.
            </p>
          )}
          {app.health === 'unknown' && (
            <p className="text-slate-500 dark:text-slate-400">Not built yet.</p>
          )}
          {app.lastBuildAt && (
            <p className="mt-1 text-slate-400">Last build: {fmtDate(app.lastBuildAt)}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SpecificationTab({ detail }: { detail?: FactoryDetailDTO }): React.JSX.Element {
  const spec = detail?.specification;
  if (!spec) {
    return (
      <p className="text-xs text-slate-400">
        Specification is produced when the application is created.
      </p>
    );
  }
  const unresolved = spec.unresolved;
  return (
    <div className="space-y-5">
      <div>
        <SectionHeading
          icon={<Target className="h-4 w-4" />}
          title={`Requirements (${spec.requirements.length})`}
        />
        <div className="space-y-2">
          {spec.requirements.map((r) => (
            <div
              key={r.requirementId}
              className="rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-700"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {r.category}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                    r.status === 'resolved'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                  }`}
                >
                  {r.status} · {r.source}
                </span>
              </div>
              <p className="mt-1.5 text-slate-600 dark:text-slate-300">{r.description}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{r.reason}</p>
            </div>
          ))}
        </div>
      </div>
      {unresolved.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-semibold">Unresolved requirements (never silently assumed)</p>
          {unresolved.map((u) => (
            <p key={u.label} className="mt-1">
              • {u.label} — {u.reason}
            </p>
          ))}
        </div>
      )}
      <div>
        <SectionHeading icon={<CheckCircle2 className="h-4 w-4" />} title="Acceptance criteria" />
        <ul className="list-inside list-disc space-y-1 text-xs text-slate-600 dark:text-slate-300">
          {spec.acceptanceCriteria.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </div>
      <div>
        <SectionHeading icon={<User className="h-4 w-4" />} title="Target users & journeys" />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {spec.targetUsers.join(', ') || '—'}
        </p>
        {spec.userJourneys.map((j) => (
          <div
            key={j.journeyId}
            className="mt-2 rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-700"
          >
            <p className="font-medium text-slate-700 dark:text-slate-200">
              {j.name} <span className="text-slate-400">({j.actor})</span>
            </p>
            <ol className="mt-1 list-inside list-decimal text-slate-500 dark:text-slate-400">
              {j.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArchitectureTab({ detail }: { detail?: FactoryDetailDTO }): React.JSX.Element {
  const arch = detail?.architecture;
  if (!arch) {
    return (
      <p className="text-xs text-slate-400">
        Architecture is produced when the application is created.
      </p>
    );
  }
  return (
    <div className="space-y-5">
      <div>
        <SectionHeading
          icon={<Layers className="h-4 w-4" />}
          title={`Layers (${arch.layers.length})`}
        />
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 dark:bg-slate-800">
              <tr>
                <th className="px-2.5 py-1.5">Layer</th>
                <th className="px-2.5 py-1.5">Technology</th>
                <th className="px-2.5 py-1.5">Reuse</th>
                <th className="px-2.5 py-1.5">Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {arch.layers.map((l) => (
                <tr key={l.layer}>
                  <td className="px-2.5 py-1.5 font-mono text-slate-600 dark:text-slate-300">
                    {l.layer}
                  </td>
                  <td className="px-2.5 py-1.5 text-slate-700 dark:text-slate-200">
                    {l.technology}
                  </td>
                  <td className="px-2.5 py-1.5">
                    {l.reusesPlatform ? (
                      <span className="text-emerald-600 dark:text-emerald-400">platform</span>
                    ) : (
                      <span className="text-slate-400">new</span>
                    )}
                  </td>
                  <td className="px-2.5 py-1.5 text-slate-500 dark:text-slate-400">
                    {l.rationale}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <SectionHeading icon={<FileText className="h-4 w-4" />} title="API contract" />
        <div className="space-y-1.5">
          {arch.apiContract.map((e) => (
            <div
              key={`${e.method}-${e.endpoint}`}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-700"
            >
              <span className="rounded bg-[#2B5FD9]/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#2B5FD9]">
                {e.method}
              </span>
              <span className="font-mono text-slate-600 dark:text-slate-300">{e.endpoint}</span>
              <span className="ml-auto text-slate-400">{e.authRequired ? 'auth' : 'public'}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <SectionHeading
          icon={<Scale className="h-4 w-4" />}
          title="Integrations & security controls"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-700">
            <p className="font-semibold text-slate-600 dark:text-slate-300">Integrations</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-slate-500 dark:text-slate-400">
              {arch.integrations.map((i) => (
                <li key={i.name}>
                  {i.name} <span className="text-slate-400">— {i.purpose}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-700">
            <p className="font-semibold text-slate-600 dark:text-slate-300">Security controls</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-slate-500 dark:text-slate-400">
              {arch.securityControls.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanTab({
  app,
  userId,
  onChanged,
}: {
  app: FactoryApplicationDTO;
  userId: string;
  onChanged: () => void;
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      <PlanPreview
        app={app}
        userId={userId}
        onApproved={() => {
          onChanged();
        }}
      />
    </div>
  );
}

function FilesTab({ detail }: { detail?: FactoryDetailDTO }): React.JSX.Element {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const files = detail?.files ?? [];
  const selectedContent = files.find((f) => f.path === selectedFile);
  return (
    <div className="space-y-4">
      <SectionHeading icon={<FolderOpen className="h-4 w-4" />} title={`Files (${files.length})`} />
      {files.length === 0 && (
        <p className="text-xs text-slate-400">Files are generated when the build runs.</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {files.slice(0, 60).map((f) => (
          <button
            key={f.path}
            onClick={() => {
              setSelectedFile(f.path);
            }}
            className={`rounded-lg border px-2 py-1 text-left text-[11px] font-medium transition-colors ${
              selectedFile === f.path
                ? 'border-[#2B5FD9] bg-[#2B5FD9]/10 text-[#2B5FD9]'
                : 'border-slate-200 text-slate-600 hover:border-[#2B5FD9] dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            <FileCode2 className="mr-1 inline h-3 w-3" />
            {f.path}
          </button>
        ))}
      </div>
      {selectedContent && (
        <div>
          <p className="mb-1 text-[11px] font-medium text-slate-400">
            {selectedContent.path}{' '}
            <span className="text-slate-300 dark:text-slate-500">· {selectedContent.kind}</span>
          </p>
          <pre className="max-h-96 overflow-auto rounded-lg border border-slate-200 bg-[#0F172A] p-3 text-[11px] leading-relaxed text-slate-200 dark:border-slate-700">
            {selectedContent.content}
          </pre>
        </div>
      )}
    </div>
  );
}

function DiffTab({ detail }: { detail?: FactoryDetailDTO }): React.JSX.Element {
  const ops = detail?.fileOperations ?? [];
  return (
    <div className="space-y-4">
      <SectionHeading
        icon={<GitCompare className="h-4 w-4" />}
        title={`Change review (${ops.length}) — every change explained`}
      />
      {ops.length === 0 && <p className="text-xs text-slate-400">No file operations yet.</p>}
      <div className="space-y-2">
        {ops.slice(-24).map((op, i) => (
          <div
            key={i}
            className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                  op.status === 'applied'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                }`}
              >
                {op.kind} · {op.status}
              </span>
              <span className="font-mono text-slate-600 dark:text-slate-300">{op.path}</span>
              <span className="ml-auto text-slate-400">via {op.originatingTask}</span>
            </div>
            <p className="mt-1.5 text-slate-500 dark:text-slate-400">{op.reason}</p>
            {(op.kind === 'modify' || op.kind === 'delete') && op.rollbackContent !== undefined && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="overflow-hidden rounded border border-slate-200 dark:border-slate-700">
                  <p className="bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:bg-slate-800">
                    Before
                  </p>
                  <pre className="max-h-40 overflow-auto bg-[#0F172A] p-2 text-[10px] leading-relaxed text-rose-200">
                    {op.rollbackContent}
                  </pre>
                </div>
                <div className="overflow-hidden rounded border border-slate-200 dark:border-slate-700">
                  <p className="bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:bg-slate-800">
                    After
                  </p>
                  <pre className="max-h-40 overflow-auto bg-[#0F172A] p-2 text-[10px] leading-relaxed text-emerald-200">
                    {op.content ?? ''}
                  </pre>
                </div>
              </div>
            )}
            {op.kind === 'create' && op.content !== undefined && (
              <pre className="mt-2 max-h-40 overflow-auto rounded border border-slate-200 bg-[#0F172A] p-2 text-[10px] leading-relaxed text-emerald-200 dark:border-slate-700">
                {op.content}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TestsTab({ app }: { app: FactoryApplicationDTO }): React.JSX.Element {
  const validation = app.lastValidation;
  if (!validation) {
    return <p className="text-xs text-slate-400">Validation runs after the build completes.</p>;
  }
  return (
    <div className="space-y-4">
      <SectionHeading
        icon={<TestTube2 className="h-4 w-4" />}
        title={`Build validation — overall ${validation.overall}`}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {validation.gates.map((g) => (
          <div
            key={g.gate}
            className={`rounded-lg border p-3 ${
              g.passed
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                : 'border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{g.gate}</p>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {g.passed ? 'PASS' : `${Math.round(g.score * 100)}%`}
              </span>
            </div>
            {g.findings.map((f, i) => (
              <p key={i} className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                • {f}
              </p>
            ))}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">
        Automatic fixes applied: {validation.automaticFixesApplied} · Run at{' '}
        {fmtDate(validation.createdAt)}
      </p>
      <RepairLoopPanel app={app} />
    </div>
  );
}

function SecurityTab({ app }: { app: FactoryApplicationDTO }): React.JSX.Element {
  const report = app.securityReport;
  if (!report) {
    return (
      <p className="text-xs text-slate-400">Security review runs after the build completes.</p>
    );
  }
  return (
    <div className="space-y-4">
      <SectionHeading
        icon={<ShieldCheck className="h-4 w-4" />}
        title={`Security review — ${report.summary.critical} critical · ${report.summary.high} high · ${report.summary.medium} medium · ${report.summary.low} low`}
      />
      {report.blocked && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
          CRITICAL/HIGH findings block READY status.
        </div>
      )}
      {report.findings.length === 0 && (
        <p className="text-xs text-slate-400">No security findings.</p>
      )}
      <div className="space-y-2">
        {report.findings.map((f) => (
          <div
            key={f.findingId}
            className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                  f.severity === 'CRITICAL' || f.severity === 'HIGH'
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                }`}
              >
                {f.severity}
              </span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {f.category}
              </span>
              {f.filePath && <span className="font-mono text-slate-400">{f.filePath}</span>}
            </div>
            <p className="mt-1.5 text-slate-600 dark:text-slate-300">{f.description}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{f.remediation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function QualityTab({
  app,
  userId,
}: {
  app: FactoryApplicationDTO;
  userId: string;
}): React.JSX.Element {
  const evaluate = useExperienceEvaluate(userId, app.applicationId);
  // EPIC-010 Phase 8/11 optional seam: a live AI critique augments the
  // deterministic critic (abstains when no provider is configured).
  const [aiEnabled, setAiEnabled] = useState(false);
  const evaluateWithAI = useExperienceEvaluateWithAI(userId, app.applicationId, aiEnabled);
  const refine = useExperienceRefine();
  const [refinedFor, setRefinedFor] = useState<string | null>(null);

  if (evaluate.isLoading || (aiEnabled && evaluateWithAI.isLoading)) {
    return <Loading label="Evaluating application experience…" />;
  }
  if (evaluate.isError || !evaluate.data) {
    return (
      <p className="text-xs text-slate-400">
        Experience evaluation is unavailable until the application has generated files.
      </p>
    );
  }

  const active = aiEnabled && evaluateWithAI.data ? evaluateWithAI.data : evaluate.data;
  const quality = active.quality;
  const critic = active.critic;
  const decisions = active.designDecisions;
  const traceability = active.traceability;
  const refinedPlan = refinedFor ? refine.data?.plan : undefined;

  const verdictStyle =
    quality.verdict === 'READY'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
      : quality.verdict === 'READY_WITH_FINDINGS'
        ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
        : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300';

  return (
    <div className="space-y-5">
      <SectionHeading icon={<Gauge className="h-4 w-4" />} title="Application quality center" />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              AI-powered critique
            </p>
            <p className="text-[11px] text-slate-400">
              {aiEnabled
                ? 'Live-provider critique merged — findings are evidence-first and proposed (never auto-applied).'
                : 'Optional: ask a live AI provider to critique the generated UI in addition to the deterministic critic.'}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={aiEnabled ? 'secondary' : 'primary'}
          disabled={aiEnabled && evaluateWithAI.isFetching}
          onClick={() => {
            setAiEnabled((v) => !v);
          }}
        >
          <Sparkles className="mr-1 h-3.5 w-3.5" />
          {aiEnabled
            ? evaluateWithAI.isFetching
              ? 'Critiquing…'
              : 'AI critique on'
            : 'Run AI critique'}
        </Button>
      </div>

      <div className={`rounded-lg border p-4 ${verdictStyle}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold">{quality.verdict.replace(/_/g, ' ')}</p>
            <p className="mt-0.5 text-[11px] opacity-80">{quality.verdictReason}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold">{Math.round(quality.overall * 100)}/100</p>
            <p className="text-[10px] uppercase tracking-wide opacity-70">overall score</p>
          </div>
        </div>
        {quality.blockingDimensions.length > 0 && (
          <p className="mt-2 text-[11px] font-semibold">
            Blocking: {quality.blockingDimensions.join(', ')} — a critical failure overrides any
            high score.
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">Dimensions</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {quality.dimensions.map((d) => (
            <div
              key={d.dimension}
              className={`rounded-lg border p-3 ${
                d.failed
                  ? 'border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {d.dimension}
                </p>
                <span
                  className={`text-[11px] font-bold ${d.failed ? 'text-rose-600 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  {Math.round(d.score * 100)}/100
                </span>
              </div>
              {d.findings.length > 0 && (
                <p className="mt-1 text-[10px] text-slate-400">
                  {d.findings.length} finding{d.findings.length === 1 ? '' : 's'}
                </p>
              )}
              {d.recommendations.slice(0, 2).map((r, i) => (
                <p key={i} className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                  → {r}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
          Critic findings ({critic.findings.length}) — evidence-backed, never invented
        </p>
        {critic.findings.length === 0 && <p className="text-xs text-slate-400">No findings.</p>}
        <div className="space-y-2">
          {critic.findings.map((f) => (
            <div
              key={f.id}
              className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                    f.severity === 'CRITICAL' || f.severity === 'HIGH'
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                  }`}
                >
                  {f.severity}
                </span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {f.area}
                </span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {f.evidenceClass}
                </span>
                <span className="font-mono text-slate-400">{f.location}</span>
              </div>
              <p className="mt-1.5 text-slate-600 dark:text-slate-300">{f.issue}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Evidence: {f.evidence}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">→ {f.recommendation}</p>
              {f.autoFixable && (
                <button
                  type="button"
                  disabled={refine.isPending}
                  onClick={() => {
                    setRefinedFor(f.id);
                    void refine.mutateAsync({
                      userId,
                      applicationId: app.applicationId,
                      findingId: f.id,
                    });
                  }}
                  className="mt-2 rounded-md bg-[#2B5FD9] px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-[#2249a8] disabled:opacity-50"
                >
                  {refine.isPending && refinedFor === f.id ? 'Planning…' : 'Fix automatically'}
                </button>
              )}
              {refinedFor === f.id && refinedPlan && (
                <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <p className="font-semibold">Targeted refinement (change impact)</p>
                  <p className="mt-1">{refinedPlan.impact.rationale}</p>
                  <p className="mt-1">Affected files:</p>
                  <ul className="ml-4 list-disc">
                    {refinedPlan.fileOperations.map((op) => (
                      <li key={op.path}>
                        <span className="font-mono">{op.path}</span> — {op.description}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1">
                    Untouched: {refinedPlan.untouched.length} file(s) preserved.
                  </p>
                  {refinedPlan.requiresApproval && (
                    <p className="mt-1 font-semibold text-amber-600 dark:text-amber-300">
                      Approval required before applying.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
            Design decisions ({decisions.length})
          </p>
          <div className="space-y-2">
            {decisions.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] text-slate-400">{d.id}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {d.source}
                  </span>
                </div>
                <p className="mt-1 font-medium text-slate-700 dark:text-slate-200">{d.decision}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{d.rationale}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
            Traceability ({traceability.length})
          </p>
          <div className="space-y-2">
            {traceability.map((t, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700"
              >
                <p className="font-medium text-slate-700 dark:text-slate-200">{t.requirement}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {t.decision} → <span className="font-mono">{t.component}</span> →{' '}
                  <span className="font-mono">{t.file}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Test: {t.test} · Review: {t.review}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Preview (EPIC-008 Phase 13): the generated UI rendered in a sandboxed
//    iframe — loading / empty / error / success states, desktop-tablet-mobile
//    device toggle and reload. The HTML is bundled server-side from the
//    persisted project files (factory.preview) and rendered with
//    sandbox="allow-scripts" (no same-origin → the preview can never touch
//    the parent application or user storage). ────────────────────────────────

const DEVICES = [
  { id: 'desktop', label: 'Desktop', width: '100%' },
  { id: 'tablet', label: 'Tablet', width: '768px' },
  { id: 'mobile', label: 'Mobile', width: '375px' },
] as const;

type DeviceId = (typeof DEVICES)[number]['id'];

function PreviewTab({
  app,
  userId,
}: {
  app: FactoryApplicationDTO;
  userId: string;
}): React.JSX.Element {
  const preview = useFactoryPreview(userId, app.applicationId);
  const [device, setDevice] = useState<DeviceId>('desktop');
  const [frameKey, setFrameKey] = useState(0);
  const data = preview.data;
  const notBuilt = app.status === 'DRAFT' || app.status === 'PLANNED';

  // Loading — the gateway bundles the persisted files into a sandboxed HTML
  // document (real esbuild build, deterministic).
  if (preview.isPending) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loading label="Bundling the application preview…" size="lg" />
      </div>
    );
  }

  // Error — request failed; actionable message, no raw stack traces.
  if (preview.isError) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs dark:border-rose-500/30 dark:bg-rose-500/10">
        <p className="flex items-center gap-1.5 font-semibold text-rose-800 dark:text-rose-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          Preview unavailable
        </p>
        <p className="mt-1 text-rose-700 dark:text-rose-300">
          The preview could not be loaded. Check the connection and try again.
        </p>
        <Button
          className="mt-2"
          size="sm"
          variant="secondary"
          onClick={() => {
            void preview.refetch();
          }}
        >
          <RefreshCw className="mr-1 h-3 w-3" />
          Retry
        </Button>
      </div>
    );
  }

  // Empty — no UI entry (pure logic application) or nothing built yet.
  if (!data?.hasUi) {
    return (
      <div className="rounded-lg border border-slate-200 p-8 text-center dark:border-slate-700">
        <MonitorPlay className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
        <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          No user interface to preview
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {notBuilt
            ? 'Files are generated when the build runs — start the build to enable the preview.'
            : (data?.reason ?? 'This application does not include a user-interface entry point.')}
        </p>
      </div>
    );
  }

  // Bundle failure — the app HAS a UI entry but it could not be built.
  if (data.reason) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs dark:border-amber-500/30 dark:bg-amber-500/10">
        <p className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          The preview could not be built
        </p>
        <p className="mt-1 text-amber-800 dark:text-amber-200">{data.reason}</p>
        <Button
          className="mt-2"
          size="sm"
          variant="secondary"
          onClick={() => {
            void preview.refetch();
          }}
        >
          <RefreshCw className="mr-1 h-3 w-3" />
          Rebuild preview
        </Button>
      </div>
    );
  }

  // Success — sandboxed iframe with the real generated app.
  const deviceWidth = DEVICES.find((d) => d.id === device)?.width ?? '100%';
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
          {DEVICES.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setDevice(d.id);
              }}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                device === d.id
                  ? 'bg-[#2B5FD9] text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-[11px] text-slate-400 sm:inline">
            Sandboxed — scripts only · no network · no parent access
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFrameKey((k) => k + 1);
            }}
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Reload
          </Button>
        </div>
      </div>
      <div
        className="overflow-hidden rounded-lg border border-slate-200 bg-white transition-all duration-200 dark:border-slate-700"
        style={{ maxWidth: deviceWidth }}
      >
        <iframe
          key={frameKey}
          title={`${app.name} — preview`}
          sandbox="allow-scripts"
          srcDoc={data.html}
          className="h-[480px] w-full border-0 bg-white"
        />
      </div>
      <p className="text-[11px] text-slate-400">
        Preview renders the real generated UI ({'src/ui/app.ts'}) inside an isolated sandbox —{' '}
        <span className="font-mono">sandbox=&quot;allow-scripts&quot;</span>, inline CSP, no
        same-origin.
      </p>
    </div>
  );
}

function HistoryTab({
  history,
}: {
  history: Array<{
    version: number;
    createdAt: string;
    change: string;
    status: string;
    validation?: { overall: string; gatesPassed: number; gatesTotal: number };
    security?: { blocked: boolean; critical: number; high: number };
    economics?: { totalTokens: number; estimatedCostUsd: number; aiCalls: number };
  }>;
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      <SectionHeading
        icon={<HistoryIcon className="h-4 w-4" />}
        title={`Version history (${history.length})`}
      />
      {history.length === 0 && <p className="text-xs text-slate-400">No versions recorded yet.</p>}
      <div className="space-y-2">
        {history
          .slice()
          .reverse()
          .map((v) => (
            <div
              key={v.version}
              className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-[#2B5FD9]/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#2B5FD9]">
                  v{v.version}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${statusTone(v.status)}`}
                >
                  {v.status}
                </span>
                <span className="text-slate-500 dark:text-slate-300">{v.change}</span>
                <span className="ml-auto text-slate-400">{fmtDate(v.createdAt)}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-slate-400">
                {v.validation && (
                  <span>
                    validation {v.validation.overall} ({v.validation.gatesPassed}/
                    {v.validation.gatesTotal} gates)
                  </span>
                )}
                {v.security && (
                  <span className={v.security.blocked ? 'text-rose-400' : ''}>
                    security {v.security.critical}C/{v.security.high}H
                  </span>
                )}
                {v.economics && (
                  <span>
                    {fmtTokens(v.economics.totalTokens)} tokens ·{' '}
                    {fmtCost(v.economics.estimatedCostUsd)}
                  </span>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function DeploymentTab({
  app,
  detail,
  userId,
  onChanged,
}: {
  app: FactoryApplicationDTO;
  detail?: FactoryDetailDTO;
  userId: string;
  onChanged: () => void;
}): React.JSX.Element {
  const deployMutation = useFactoryDeploy();
  const [notice, setNotice] = useState<string | null>(null);

  const handleDeploy = (): void => {
    setNotice(null);
    void deployMutation
      .mutateAsync({
        userId,
        applicationId: app.applicationId,
        request: { target: 'local', authorized: true },
      })
      .then((res) => {
        if (res.data?.status === 'deployed') {
          setNotice('Deployed locally — artifact packaged (operator exports/pushes).');
          onChanged();
        } else {
          setNotice(res.data?.message ?? 'Deployment blocked — requires explicit authorization.');
        }
      })
      .catch((err: unknown) => {
        setNotice(err instanceof Error ? err.message : 'Deployment failed.');
      });
  };

  return (
    <div className="space-y-4">
      <SectionHeading
        icon={<Package className="h-4 w-4" />}
        title="Deployment (explicit authorization required)"
      />
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Deployment never happens silently. The local adapter packages a self-hosted artifact; an
        operator completes any external push.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusTone(app.deploymentStatus)}`}
        >
          {app.deploymentStatus}
        </span>
        {app.deploymentTarget && (
          <span className="text-[11px] text-slate-400">target: {app.deploymentTarget}</span>
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={deployMutation.isPending}
          onClick={handleDeploy}
        >
          <Package className="mr-1 h-3.5 w-3.5" />
          Deploy locally (authorize)
        </Button>
      </div>
      {notice && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
          {notice}
        </div>
      )}
      <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
        <p className="font-semibold text-slate-600 dark:text-slate-300">Before you deploy</p>
        <div className="mt-1.5 space-y-1">
          <InfoRow label="Build status" value={app.status} />
          <InfoRow label="Validation" value={app.lastValidation?.overall ?? '—'} />
          <InfoRow
            label="Security"
            value={
              app.securityReport?.blocked
                ? 'blocked'
                : `${app.securityReport?.findings.length ?? 0} findings`
            }
          />
          <InfoRow label="Files / version" value={`${app.fileCount} files`} />
          <InfoRow
            label="Estimated AI cost"
            value={app.economics ? fmtCost(app.economics.estimatedCostUsd) : '—'}
          />
          <InfoRow label="Workspace path" value={detail?.applicationId ?? app.applicationId} />
        </div>
      </div>
    </div>
  );
}

function SettingsTab({
  app,
  userId,
  onChanged,
  onDeleted,
}: {
  app: FactoryApplicationDTO;
  userId: string;
  onChanged: () => void;
  onDeleted: () => void;
}): React.JSX.Element {
  const renameMutation = useFactoryRename();
  const archiveMutation = useFactoryArchive();
  const deleteMutation = useFactoryDelete();
  const resumeMutation = useFactoryResume();
  const vcInitMutation = useFactoryVcInit();
  const vcCommitMutation = useFactoryVcCommit();
  const vcPrMutation = useFactoryVcPreparePullRequest();
  const vcDiff = useFactoryVcDiff(userId, app.applicationId);
  const [name, setName] = useState(app.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generic over the mutation input so fully-typed tRPC mutations (parameter
  // contravariance) and their literal inputs infer together.
  const runMutation = <TInput,>(
    m: { mutateAsync: (input: TInput) => Promise<{ data?: { message?: string } }> },
    input: TInput,
    success: string,
  ): void => {
    setError(null);
    void m
      .mutateAsync(input)
      .then((res) => {
        setNotice(res.data?.message ?? success);
        onChanged();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Operation failed.');
      });
  };

  const handleRename = (): void => {
    runMutation(
      renameMutation,
      { userId, applicationId: app.applicationId, name },
      'Application renamed.',
    );
  };

  const handleArchive = (): void => {
    runMutation(
      archiveMutation,
      { userId, applicationId: app.applicationId },
      'Application archived.',
    );
  };

  const handleDelete = (): void => {
    runMutation(
      deleteMutation,
      { userId, applicationId: app.applicationId, confirm: confirmDelete },
      confirmDelete ? 'Application deleted.' : 'Confirmation required.',
    );
    if (confirmDelete) onDeleted();
  };

  const handleResume = (): void => {
    runMutation(
      resumeMutation,
      { userId, applicationId: app.applicationId },
      'Application resumed.',
    );
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}
      <section>
        <SectionHeading icon={<Pencil className="h-4 w-4" />} title="Rename application" />
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-[#0F172A] dark:text-slate-100"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
          />
          <Button size="sm" disabled={renameMutation.isPending} onClick={handleRename}>
            Rename
          </Button>
        </div>
      </section>
      <section>
        <SectionHeading icon={<PlayCircle className="h-4 w-4" />} title="Resume" />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {app.status === 'ARCHIVED' && 'Reopen the archived application as a fresh draft.'}
          {app.status === 'FAILED' && 'Resume the failed build from the last state (plan kept).'}
          {app.status !== 'ARCHIVED' &&
            app.status !== 'FAILED' &&
            'Resume is available for archived or failed applications.'}
        </p>
        <Button
          className="mt-2"
          size="sm"
          variant="secondary"
          disabled={
            resumeMutation.isPending || (app.status !== 'ARCHIVED' && app.status !== 'FAILED')
          }
          onClick={handleResume}
        >
          <PlayCircle className="mr-1 h-3.5 w-3.5" />
          Resume
        </Button>
      </section>
      <section>
        <SectionHeading icon={<Archive className="h-4 w-4" />} title="Archive" />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Move the application out of the active list (not deleted — resumable).
        </p>
        <Button
          className="mt-2"
          size="sm"
          variant="secondary"
          disabled={archiveMutation.isPending || app.status === 'ARCHIVED'}
          onClick={handleArchive}
        >
          <Archive className="mr-1 h-3.5 w-3.5" />
          Archive application
        </Button>
      </section>
      <section>
        <SectionHeading icon={<Trash2 className="h-4 w-4" />} title="Danger zone" />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Delete per policy: DRAFT / PLANNED / FAILED / ARCHIVED applications only. Active or
          released applications must be archived first.
        </p>
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={confirmDelete}
            onChange={(e) => {
              setConfirmDelete(e.target.checked);
            }}
          />
          I understand this permanently deletes the application.
        </label>
        <Button
          className="mt-2"
          size="sm"
          variant="secondary"
          disabled={deleteMutation.isPending || !confirmDelete}
          onClick={handleDelete}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Delete application
        </Button>
      </section>
      <section>
        <SectionHeading
          icon={<GitBranch className="h-4 w-4" />}
          title="Version control (never auto-pushed)"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={vcInitMutation.isPending}
            onClick={() => {
              void vcInitMutation
                .mutateAsync({ userId, applicationId: app.applicationId })
                .then((res) => {
                  const dto = res as { data?: { message?: string } };
                  setNotice(dto.data?.message ?? 'Repository initialized.');
                  onChanged();
                });
            }}
          >
            Init repository
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={vcCommitMutation.isPending}
            onClick={() => {
              void vcCommitMutation
                .mutateAsync({
                  userId,
                  applicationId: app.applicationId,
                  message: 'Generated application build',
                  files: (vcDiff.data?.hunks ?? []).slice(0, 6),
                })
                .then((res) => {
                  const dto = res as { data?: { message?: string } };
                  setNotice(dto.data?.message ?? 'Committed.');
                  onChanged();
                });
            }}
          >
            Commit build
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={vcPrMutation.isPending}
            onClick={() => {
              void vcPrMutation
                .mutateAsync({
                  userId,
                  applicationId: app.applicationId,
                  title: `Generated ${app.name}`,
                })
                .then((res) => {
                  const dto = res as { data?: { pullRequestDraft?: { title?: string } } };
                  setNotice(
                    `Pull-request draft ready: ${dto.data?.pullRequestDraft?.title ?? '…'} (operator pushes).`,
                  );
                  onChanged();
                });
            }}
          >
            Prepare PR draft
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          {vcDiff.data?.message ?? 'Run a diff to see the change summary.'}
        </p>
      </section>
    </div>
  );
}

// ── Workspace: header + tabs + tab content ──────────────────────────────────

export function ApplicationWorkspace({
  app: initialApp,
  userId,
  onBack,
  onDeleted,
}: {
  app: FactoryApplicationDTO;
  userId: string;
  onBack: () => void;
  onDeleted: () => void;
}): React.JSX.Element {
  const [tab, setTab] = useState<TabId>('overview');
  const [polling, setPolling] = useState(true);
  const status = useFactoryStatus(userId, initialApp.applicationId, polling ? 1500 : 0);
  const current = status.data ?? initialApp;
  const detailQuery = useFactoryDetail(userId, initialApp.applicationId);
  const detail = detailQuery.data;
  const historyQuery = useFactoryHistory(userId, initialApp.applicationId);

  useEffect(() => {
    if (['READY', 'FAILED', 'DEPLOYED', 'ARCHIVED'].includes(current.status)) {
      setPolling(false);
    }
  }, [current.status]);

  const refresh = (): void => {
    void status.refetch();
    void detailQuery.refetch();
    void historyQuery.refetch();
    setPolling(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#2B5FD9]" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {current.name}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusTone(current.status)}`}
          >
            {current.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            All applications
          </Button>
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <nav
        aria-label="Application workspace"
        className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-[#1E293B]"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                tab === t.id
                  ? 'bg-[#2B5FD9] text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </nav>

      <Card className="p-5 dark:bg-[#1E293B]">
        {tab === 'overview' && <OverviewTab app={current} detail={detail} />}
        {tab === 'specification' && <SpecificationTab detail={detail} />}
        {tab === 'architecture' && <ArchitectureTab detail={detail} />}
        {tab === 'plan' && <PlanTab app={current} userId={userId} onChanged={refresh} />}
        {tab === 'build' && <BuildPanel app={current} userId={userId} onDone={refresh} />}
        {tab === 'files' && <FilesTab detail={detail} />}
        {tab === 'diff' && <DiffTab detail={detail} />}
        {tab === 'tests' && <TestsTab app={current} />}
        {tab === 'security' && <SecurityTab app={current} />}
        {tab === 'quality' && <QualityTab app={current} userId={userId} />}
        {tab === 'preview' && <PreviewTab app={current} userId={userId} />}
        {tab === 'history' && <HistoryTab history={historyQuery.data ?? []} />}
        {tab === 'deployment' && (
          <DeploymentTab app={current} detail={detail} userId={userId} onChanged={refresh} />
        )}
        {tab === 'settings' && (
          <SettingsTab app={current} userId={userId} onChanged={refresh} onDeleted={onDeleted} />
        )}
      </Card>
    </div>
  );
}
