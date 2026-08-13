// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem Intelligence: Task Intelligence panel
// EPIC-015 — answers "For THIS task, is something significantly better
// available?" across configured providers, free providers, local models,
// GitHub projects and paid providers. Quality-first, evidence-backed, and a
// better option that requires activation produces an approval recommendation —
// never an automatic activation. Declining is never treated as failure: the
// fallback plan is shown honestly.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Badge, Select, Loading, EmptyState } from '@vedmoulya/ui';
import {
  Radar,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Cpu,
  GitBranch,
  Wallet,
  TrendingUp,
  Eye,
  BellOff,
  ShieldAlert,
} from 'lucide-react';
import { CAPABILITY_IDS, CAPABILITY_LABELS } from '@vedmoulya/capability-marketplace';
import type { GatewayCapabilityId } from '../../lib/api-client.js';
import type {
  IntelligenceOption,
  IntelligenceRecommendation,
  TaskIntelligenceResult,
} from '@vedmoulya/ecosystem-intelligence';
import {
  useIntelligenceFindBetterOption,
  useIntelligenceFindFreeAlternative,
  useIntelligenceFindLocalAlternative,
  useIntelligenceFindGitHubCapability,
  useIntelligenceFindBetterProvider,
  useIntelligenceRespondToRecommendation,
} from '../../lib/api-client.js';
import {
  OPTION_LABELS,
  RECOMMENDATION_LABELS,
  formatUsd,
  qualityBar,
  qualityBarColor,
  formatHuman,
} from './intelligence-ui.js';

const QUALITY_TARGETS = [
  { value: 'LOW', label: 'Low — good enough' },
  { value: 'MEDIUM', label: 'Medium — balanced' },
  { value: 'HIGH', label: 'High — best possible' },
] as const;

const PRIVACY_OPTIONS = [
  { value: 'STANDARD', label: 'Standard — cloud providers OK' },
  { value: 'PRIVATE', label: 'Private — prefer local/no external data' },
] as const;

const EXAMPLE_TASKS: Array<{
  label: string;
  capability: string;
  objective: string;
  domain: string;
}> = [
  {
    label: 'AI video',
    capability: 'VIDEO_GENERATION',
    objective: 'Create a professional 2-minute explainer video for a SaaS product',
    domain: 'marketing',
  },
  {
    label: 'Research brief',
    capability: 'RESEARCH',
    objective: 'Research open-source local LLMs and summarize the best options',
    domain: 'engineering',
  },
  {
    label: 'Blog post',
    capability: 'TEXT_GENERATION',
    objective: 'Write a high-quality blog post about AI productivity for professionals',
    domain: 'content',
  },
  {
    label: 'Competitor analysis',
    capability: 'REASONING',
    objective: 'Analyze the competitive landscape for a small business SaaS pricing strategy',
    domain: 'strategy',
  },
];

export function TaskIntelligencePanel({ userId }: { userId: string }): React.JSX.Element {
  const [capability, setCapability] = useState<GatewayCapabilityId>('VIDEO_GENERATION');
  const [objective, setObjective] = useState(EXAMPLE_TASKS[0]?.objective ?? '');
  const [domain, setDomain] = useState(EXAMPLE_TASKS[0]?.domain ?? 'marketing');
  const [qualityTarget, setQualityTarget] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [privacyRequirement, setPrivacyRequirement] = useState<'PRIVATE' | 'STANDARD'>('STANDARD');
  const [asked, setAsked] = useState(false);

  // The heavy findBetterOption query (explicit ask — never on mount).
  const betterOption = useIntelligenceFindBetterOption(
    userId,
    { capability, objective, domain, qualityTarget, privacyRequirement },
    asked,
  );
  const respond = useIntelligenceRespondToRecommendation();
  const [responseNote, setResponseNote] = useState<string | null>(null);

  // Quick questions (lightweight, per-capability).
  const freeAlt = useIntelligenceFindFreeAlternative(userId, capability);
  const localAlt = useIntelligenceFindLocalAlternative(userId, capability);
  const githubCap = useIntelligenceFindGitHubCapability(userId, capability);
  const betterProvider = useIntelligenceFindBetterProvider(userId, capability);

  function ask(): void {
    setAsked(true);
    setResponseNote(null);
  }

  function loadExample(example: (typeof EXAMPLE_TASKS)[number]): void {
    setCapability(example.capability as GatewayCapabilityId);
    setObjective(example.objective);
    setDomain(example.domain);
    setAsked(false);
    setResponseNote(null);
  }

  async function handleRespond(action: string): Promise<void> {
    const recommendation = betterOption.data?.recommendation;
    if (!recommendation) return;
    try {
      const res = await respond.mutateAsync({
        userId,
        recommendationId: recommendation.id,
        action: action as never,
      });
      const data = (res as { data?: { state: string } }).data;
      setResponseNote(
        `Recorded: ${data?.state ?? 'done'} — this explicit signal feeds the preference ledger, never an inferred permanent preference.`,
      );
      void betterOption.refetch();
    } catch {
      setResponseNote('The response could not be recorded right now.');
    }
  }

  const result = betterOption.data;

  return (
    <div className="space-y-4">
      {/* ── Ask panel ─────────────────────────────────────────────────── */}
      <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
        <label
          htmlFor="intelligence-objective"
          className="block text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0]"
        >
          What are you trying to accomplish?
        </label>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
          <input
            id="intelligence-objective"
            value={objective}
            onChange={(e) => {
              setObjective(e.target.value);
            }}
            placeholder="Create a professional 2-minute explainer video…"
            className="px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[13px] text-[#111827] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2B5FD9]/40"
          />
          <div>
            {' '}
            <Select
              value={capability}
              onChange={(e) => {
                setCapability(e.target.value as GatewayCapabilityId);
              }}
              aria-label="Capability"
              options={CAPABILITY_IDS.filter(
                (id): id is GatewayCapabilityId => id !== 'QUALITY_EVALUATION' && id !== 'ASSEMBLY',
              ).map((id) => ({
                value: id,
                label: `${CAPABILITY_LABELS[id]} (${id})`,
              }))}
            />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Select
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value);
              }}
              aria-label="Domain"
              options={[
                'marketing',
                'content',
                'engineering',
                'strategy',
                'product',
                'operations',
                'education',
                'personal',
              ].map((d) => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) }))}
            />
          </div>
          <div>
            <Select
              value={qualityTarget}
              onChange={(e) => {
                setQualityTarget(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH');
              }}
              aria-label="Quality target"
              options={QUALITY_TARGETS.map((q) => ({ value: q.value, label: q.label }))}
            />
          </div>
          <div>
            <Select
              value={privacyRequirement}
              onChange={(e) => {
                setPrivacyRequirement(e.target.value as 'PRIVATE' | 'STANDARD');
              }}
              aria-label="Privacy requirement"
              options={PRIVACY_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-[#94A3B8]">Try:</span>
            {EXAMPLE_TASKS.map((example) => (
              <button
                key={example.label}
                onClick={() => {
                  loadExample(example);
                }}
                className="px-2.5 py-1 rounded-full bg-[#F1F5F9] dark:bg-[#334155] text-[11px] font-medium text-[#64748B] dark:text-[#CBD5E1] hover:bg-[#E2E8F0] dark:hover:bg-[#475569] transition-colors"
              >
                {example.label}
              </button>
            ))}
          </div>
          <button
            onClick={ask}
            disabled={betterOption.isFetching || objective.trim().length < 3}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2B5FD9] text-white text-[13px] font-semibold hover:bg-[#1E4BB8] transition-colors disabled:opacity-50"
          >
            {betterOption.isFetching ? (
              <Loading label="" size="sm" />
            ) : (
              <Radar className="h-4 w-4" />
            )}
            Ask the Intelligence
          </button>
        </div>
        {betterOption.isError && (
          <p className="mt-3 text-[12px] text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> The Intelligence could not complete that check
            right now.
          </p>
        )}
      </Card>

      {/* ── Quick questions row ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickQuestion
          icon={<Wallet className="h-4 w-4 text-[#22C55E]" />}
          label="Free alternative"
          loading={freeAlt.isFetching}
          body={
            freeAlt.data
              ? freeAlt.data.free
                ? `Yes — ${freeAlt.data.name ?? 'a free option'}${freeAlt.data.quality !== undefined ? ` (quality ${freeAlt.data.quality})` : ''}`
                : (freeAlt.data.note ?? 'No evidence-backed free alternative found.')
              : 'Ask to check'
          }
        />
        <QuickQuestion
          icon={<Cpu className="h-4 w-4 text-[#7C3AED]" />}
          label="Local alternative"
          loading={localAlt.isFetching}
          body={
            Array.isArray(localAlt.data)
              ? localAlt.data.length > 0
                ? localAlt.data.map((m) => m.name).join(', ')
                : 'None available on current hardware'
              : (localAlt.data?.note ?? 'Ask to check')
          }
        />
        <QuickQuestion
          icon={<GitBranch className="h-4 w-4 text-[#0D9488]" />}
          label="Open source"
          loading={githubCap.isFetching}
          body={
            githubCap.data
              ? githubCap.data.found
                ? `${githubCap.data.items.length} candidate(s) — review + approval required, never auto-integrated`
                : (githubCap.data.note ?? 'None discovered yet')
              : 'Ask to check'
          }
        />
        <QuickQuestion
          icon={<TrendingUp className="h-4 w-4 text-[#F59E0B]" />}
          label="Better provider"
          loading={betterProvider.isFetching}
          body={
            betterProvider.data
              ? betterProvider.data.better
                ? `Yes — ${betterProvider.data.recommended?.name ?? 'a better option'} (quality ${betterProvider.data.recommended?.quality ?? '—'}) requires activation`
                : (betterProvider.data.note ?? 'Current configuration is already the best')
              : 'Ask to check'
          }
        />
      </div>

      {/* ── Result ────────────────────────────────────────────────────── */}
      {asked && result && (
        <div className="space-y-4">
          {/* Recommendation card */}
          {result.recommendation && (
            <RecommendationCard
              recommendation={result.recommendation}
              responseNote={responseNote}
              busy={respond.isPending}
              onRespond={(action) => {
                void handleRespond(action);
              }}
            />
          )}

          {/* Fallback (declining is never failure) */}
          {result.fallback ? <FallbackCard fallback={result.fallback} /> : null}

          {/* Options */}
          {result.options.length > 0 && (
            <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
              <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC] flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-[#7C3AED]" /> What the Intelligence found
              </h3>
              <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                {result.options.map((option) => (
                  <OptionCard key={`${option.kind}-${option.name}`} option={option} />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {!asked && (
        <EmptyState
          icon={<Radar className="h-8 w-8" />}
          title="Ask about a task"
          description="The Intelligence evaluates configured providers, free providers, local models, GitHub projects and paid options — and tells you if something materially better exists for THIS task, what it requires, and what happens if you decline. It never activates anything without your approval."
        />
      )}
    </div>
  );
}

// ── Quick question card ───────────────────────────────────────────────────────

function QuickQuestion(props: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  body: string;
}): React.JSX.Element {
  const { icon, label, loading, body } = props;
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          {label}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
        {loading ? 'Checking…' : body}
      </p>
    </Card>
  );
}

// ── Premium recommendation card ───────────────────────────────────────────────

function RecommendationCard(props: {
  recommendation: IntelligenceRecommendation;
  responseNote: string | null;
  busy: boolean;
  onRespond: (action: string) => void;
}): React.JSX.Element {
  const { recommendation, responseNote, busy, onRespond } = props;
  const [showDetails, setShowDetails] = useState(false);
  const recommended = recommendation.recommended;

  return (
    <Card
      variant="standard"
      padding="lg"
      className="dark:bg-[#1E293B] border-[#7C3AED]/30 dark:border-[#7C3AED]/40"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="p-1.5 rounded-lg bg-[#F5F3FF] dark:bg-[#4C1D95]/40">
          <Sparkles className="h-4 w-4 text-[#7C3AED]" />
        </span>
        <h3 className="text-[15px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
          {RECOMMENDATION_LABELS[recommendation.kind] ?? recommendation.title}
        </h3>
        <Badge variant="ai" size="sm">
          Requires your approval
        </Badge>
      </div>

      {/* Current vs recommended */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]">
          <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide">
            Current
          </p>
          <p className="mt-0.5 text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC]">
            {recommendation.current?.name ?? 'No configured capability'}
          </p>
          {recommendation.current?.quality !== undefined && (
            <p className="mt-1 text-[11px] text-[#22C55E] font-mono">
              {qualityBar(recommendation.current.quality)}
            </p>
          )}
        </div>
        <div className="p-3 rounded-lg border border-[#7C3AED]/30 dark:border-[#7C3AED]/40 bg-[#F5F3FF] dark:bg-[#2E1065]/30">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-[#7C3AED] uppercase tracking-wide">
              Recommended
            </p>
            <ArrowRight className="h-3.5 w-3.5 text-[#7C3AED]" />
          </div>
          <p className="mt-0.5 text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC]">
            {recommended.name}
          </p>
          {recommended.quality !== undefined && (
            <p
              className="mt-1 text-[11px] font-mono"
              style={{ color: qualityBarColor(recommended.quality) }}
            >
              {qualityBar(recommended.quality)}
            </p>
          )}
          {recommended.costUsd !== undefined && (
            <p className="mt-0.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              Est. {formatUsd(recommended.costUsd)}
            </p>
          )}
        </div>
      </div>

      {/* Why */}
      {recommended.why.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide">Why</p>
          <ul className="mt-1 space-y-0.5">
            {recommended.why.map((why) => (
              <li
                key={why}
                className="text-[12px] text-[#374151] dark:text-[#E2E8F0] flex items-start gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-[#22C55E] mt-0.5 shrink-0" /> {why}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Requires + risks (progressive disclosure) */}
      {showDetails && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide">
              Requires
            </p>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              {recommendation.requires.map((req) => (
                <span
                  key={req}
                  className="px-1.5 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#334155] text-[10px] font-medium text-[#64748B] dark:text-[#CBD5E1]"
                >
                  {formatHuman(req)}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide">
              Risks
            </p>
            <ul className="mt-1 space-y-0.5">
              {recommendation.risks.map((risk) => (
                <li
                  key={risk}
                  className="text-[11px] text-[#64748B] dark:text-[#94A3B8] flex items-start gap-1.5"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-[#F59E0B] mt-0.5 shrink-0" /> {risk}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        {recommendation.actions.includes('use_recommended') && (
          <button
            onClick={() => {
              onRespond('use_recommended');
            }}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#7C3AED] text-white text-[12px] font-semibold hover:bg-[#6D28D9] transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Use Recommended
          </button>
        )}
        {recommendation.actions.includes('review_and_configure') && (
          <button
            onClick={() => {
              onRespond('review_and_configure');
            }}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#7C3AED] text-white text-[12px] font-semibold hover:bg-[#6D28D9] transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Review &amp; Configure
          </button>
        )}
        {recommendation.actions.includes('download') && (
          <button
            onClick={() => {
              onRespond('download');
            }}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2B5FD9] text-white text-[12px] font-semibold hover:bg-[#1E4BB8] transition-colors disabled:opacity-50"
          >
            <Cpu className="h-3.5 w-3.5" /> Download
          </button>
        )}
        {recommendation.actions.includes('continue_with_current') && (
          <button
            onClick={() => {
              onRespond('continue_with_current');
            }}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F1F5F9] dark:bg-[#334155] text-[#374151] dark:text-[#E2E8F0] text-[12px] font-semibold hover:bg-[#E2E8F0] dark:hover:bg-[#475569] transition-colors disabled:opacity-50"
          >
            <XCircle className="h-3.5 w-3.5" /> Continue With Current
          </button>
        )}
        {recommendation.actions.includes('ignore') && (
          <button
            onClick={() => {
              onRespond('ignore');
            }}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F1F5F9] dark:bg-[#334155] text-[#374151] dark:text-[#E2E8F0] text-[12px] font-semibold hover:bg-[#E2E8F0] dark:hover:bg-[#475569] transition-colors disabled:opacity-50"
          >
            <XCircle className="h-3.5 w-3.5" /> Ignore
          </button>
        )}
        <button
          onClick={() => {
            setShowDetails((v) => !v);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-semibold text-[#2B5FD9] dark:text-[#6B8FEF] hover:bg-[#EFF4FE] dark:hover:bg-[#1E3A8A]/40 transition-colors"
        >
          <Eye className="h-3.5 w-3.5" /> {showDetails ? 'Hide details' : 'Review details'}
        </button>
        {recommendation.actions.includes('dont_suggest_again') && (
          <button
            onClick={() => {
              onRespond('dont_suggest_again');
            }}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-medium text-[#94A3B8] hover:text-[#64748B] transition-colors disabled:opacity-50"
          >
            <BellOff className="h-3.5 w-3.5" /> Don&apos;t Suggest Again
          </button>
        )}
      </div>

      {responseNote && (
        <p className="mt-3 text-[11px] text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#22C55E]" /> {responseNote}
        </p>
      )}
    </Card>
  );
}

// ── Fallback card (declining is never failure) ───────────────────────────────

function FallbackCard({
  fallback,
}: {
  fallback: NonNullable<TaskIntelligenceResult['fallback']>;
}): React.JSX.Element {
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />
        <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          If you decline — the fallback
        </h3>
      </div>
      <p className="mt-1.5 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
        {fallback.bestAchievable}
      </p>
      {fallback.note && <p className="mt-1 text-[11px] text-[#94A3B8]">{fallback.note}</p>}
      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        {fallback.order.map((step, idx) => (
          <React.Fragment key={step}>
            <span className="px-1.5 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#334155] text-[9px] font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              {formatHuman(step)}
            </span>
            {idx < fallback.order.length - 1 && (
              <ArrowRight className="h-3 w-3 text-[#CBD5E1] dark:text-[#475569]" />
            )}
          </React.Fragment>
        ))}
      </div>
    </Card>
  );
}

// ── Option card ───────────────────────────────────────────────────────────────

function OptionCard({ option }: { option: IntelligenceOption }): React.JSX.Element {
  return (
    <div className="p-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]">
      <div className="flex items-center justify-between gap-2">
        <span className="px-1.5 py-0.5 rounded-full bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[#2B5FD9] dark:text-[#6B8FEF] text-[9px] font-bold uppercase tracking-wide">
          {OPTION_LABELS[option.kind] ?? formatHuman(option.kind)}
        </span>
        {option.providerId && (
          <span className="text-[10px] text-[#94A3B8] font-mono truncate">{option.providerId}</span>
        )}
      </div>
      <p className="mt-1.5 text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC]">
        {option.name}
      </p>
      {option.quality !== undefined && (
        <p
          className="mt-0.5 text-[11px] font-mono"
          style={{ color: qualityBarColor(option.quality) }}
        >
          {qualityBar(option.quality)}
        </p>
      )}
      <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">{option.reason}</p>
      {option.evidence.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[#F1F5F9] dark:border-[#334155]">
          <p className="text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wide">
            Evidence
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {option.evidence.slice(0, 3).map((e) => (
              <li key={e} className="text-[10px] text-[#94A3B8] truncate" title={e}>
                • {e}
              </li>
            ))}
          </ul>
        </div>
      )}
      {option.requires.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {option.requires.map((req) => (
            <span
              key={req}
              className="px-1.5 py-0.5 rounded bg-[#FEF3C7] dark:bg-[#451A03]/40 text-[#B45309] dark:text-[#FCD34D] text-[9px] font-medium"
            >
              requires {formatHuman(req)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
