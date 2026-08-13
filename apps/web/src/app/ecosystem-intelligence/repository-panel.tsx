// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem Intelligence: Repository Intelligence panel
// EPIC-015 — The controlled repository acquisition pipeline:
//   DISCOVERED → SECURITY REVIEW → RELEVANCE → APPROVAL → ACQUIRE → SANDBOX →
//   ANALYZE → STORE → OPTIONAL CONFIGURATION.
// READ / CLONE / EXECUTE / INSTALL / CONFIGURE / USE are DIFFERENT actions —
// reading a repository NEVER implies it is safe to execute. Security is
// classified with evidence ("no blocking indicators found in the checks
// performed" — never a blanket "safe"). LICENSE_UNKNOWN is first-class.
// Approval is required before acquiring; declining is never failure.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Badge, Loading, EmptyState } from '@vedmoulya/ui';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  GitBranch,
  Scale,
  ArrowRight,
  Lock,
  KeyRound,
  Eye,
  Cpu,
} from 'lucide-react';
import {
  useIntelligenceGetAcquisitionPlan,
  useIntelligenceApproveAcquisition,
  useIntelligenceRejectAcquisition,
  useIntelligenceEvaluateLicense,
} from '../../lib/api-client.js';
import {
  SECURITY_COLORS,
  ACQUISITION_COLORS,
  formatDateTime,
  formatHuman,
} from './intelligence-ui.js';

const REPO_EXAMPLES = [
  { label: 'Local LLM runtime', value: 'ggml-org/llama.cpp' },
  { label: 'RAG framework', value: 'run-llama/llama_index' },
  { label: 'Embeddings', value: 'openai/whisper' },
] as const;

export function RepositoryIntelligencePanel({ userId }: { userId: string }): React.JSX.Element {
  const [repository, setRepository] = useState('ggml-org/llama.cpp');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [license, setLicense] = useState('');
  const [relevanceText, setRelevanceText] = useState('local inference, embeddings, quality');
  const [repoReadAuthorized, setRepoReadAuthorized] = useState(false);

  // Security facts (a conservative default: no indicators observed).
  const [installScriptsText, setInstallScriptsText] = useState('');
  const [credentialCollection, setCredentialCollection] = useState(false);
  const [secretExposure, setSecretExposure] = useState(false);
  const [arbitraryCommandExecution, setArbitraryCommandExecution] = useState(false);
  const [remoteCodeExecutionPaths, setRemoteCodeExecutionPaths] = useState(false);
  const [sandboxAvailable, setSandboxAvailable] = useState(true);

  const [assessed, setAssessed] = useState(false);
  const [approved, setApproved] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [licenseInput, setLicenseInput] = useState('MIT');

  const planQuery = useIntelligenceGetAcquisitionPlan(
    userId,
    {
      repository,
      visibility,
      license: license || undefined,
      relevance: relevanceText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      repoReadAuthorized,
      repositoryFacts: {
        installScripts: installScriptsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        credentialCollection,
        secretExposure,
        arbitraryCommandExecution,
        remoteCodeExecutionPaths,
        sandboxAvailable,
      },
    },
    assessed,
  );
  const approve = useIntelligenceApproveAcquisition();
  const reject = useIntelligenceRejectAcquisition();
  const licenseEval = useIntelligenceEvaluateLicense(userId, licenseInput || undefined, undefined);

  const plan = planQuery.data;

  function assess(): void {
    setAssessed(true);
    setApproved(false);
    setRejected(false);
  }

  function loadExample(example: string): void {
    setRepository(example);
    setAssessed(false);
    setApproved(false);
    setRejected(false);
  }

  async function handleApprove(): Promise<void> {
    try {
      await approve.mutateAsync({ userId, repository });
      setApproved(true);
      setRejected(false);
      void planQuery.refetch();
    } catch {
      /* surfaced via response state below */
    }
  }

  async function handleReject(): Promise<void> {
    try {
      await reject.mutateAsync({ userId, repository });
      setRejected(true);
      setApproved(false);
      void planQuery.refetch();
    } catch {
      /* surfaced via response state below */
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Assessment form ───────────────────────────────────────────── */}
      <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#2B5FD9]" />
          <h3 className="text-[14px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Repository acquisition pipeline
          </h3>
          <Badge variant="warning" size="sm">
            security review before any execution
          </Badge>
        </div>
        <p className="mt-1 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
          A discovered repository is UNTRUSTED input. Reading it never implies it is safe to
          execute, install or integrate. This pipeline runs the security gate + license check, then
          stops at APPROVAL_REQUIRED until you decide. No clone, no install, no execution.
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
              Repository (owner/name)
            </label>
            <input
              value={repository}
              onChange={(e) => {
                setRepository(e.target.value);
              }}
              placeholder="owner/repository"
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[12px] font-mono text-[#111827] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2B5FD9]/40"
            />
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-[#94A3B8]">Try:</span>
              {REPO_EXAMPLES.map((ex) => (
                <button
                  key={ex.value}
                  onClick={() => {
                    loadExample(ex.value);
                  }}
                  className="px-2 py-0.5 rounded-full bg-[#F1F5F9] dark:bg-[#334155] text-[10px] font-medium text-[#64748B] dark:text-[#CBD5E1] hover:bg-[#E2E8F0] dark:hover:bg-[#475569] transition-colors"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
              Visibility
            </label>
            <div className="flex items-center gap-2">
              {(['public', 'private'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setVisibility(v);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    visibility === v
                      ? 'bg-[#2B5FD9] text-white'
                      : 'bg-[#F1F5F9] dark:bg-[#334155] text-[#64748B] dark:text-[#CBD5E1] hover:bg-[#E2E8F0] dark:hover:bg-[#475569]'
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-[#94A3B8]">
              {visibility === 'private'
                ? 'Private repos require explicit read authorization.'
                : 'Public discovery needs no repo permissions.'}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
              Relevance to your goals (comma-separated)
            </label>
            <input
              value={relevanceText}
              onChange={(e) => {
                setRelevanceText(e.target.value);
              }}
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[12px] text-[#111827] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2B5FD9]/40"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
              License (software)
            </label>
            <input
              value={license}
              onChange={(e) => {
                setLicense(e.target.value);
              }}
              placeholder="MIT (leave empty when unknown — LICENSE_UNKNOWN is first-class)"
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[12px] text-[#111827] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2B5FD9]/40"
            />
          </div>
        </div>

        {/* Security facts */}
        <div className="mt-4">
          <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide">
            Security facts — indicators observed during review (default: none observed)
          </p>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <SecurityToggle
              label="Credential collection"
              checked={credentialCollection}
              onChange={setCredentialCollection}
            />
            <SecurityToggle
              label="Secret exposure"
              checked={secretExposure}
              onChange={setSecretExposure}
            />
            <SecurityToggle
              label="Arbitrary command execution"
              checked={arbitraryCommandExecution}
              onChange={setArbitraryCommandExecution}
            />
            <SecurityToggle
              label="Remote code execution paths"
              checked={remoteCodeExecutionPaths}
              onChange={setRemoteCodeExecutionPaths}
            />
            <SecurityToggle
              label="Sandbox available for isolation"
              checked={sandboxAvailable}
              onChange={setSandboxAvailable}
              positive
            />
          </div>
          <div className="mt-2">
            <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
              Install scripts observed (comma-separated, e.g. postinstall, preinstall)
            </label>
            <input
              value={installScriptsText}
              onChange={(e) => {
                setInstallScriptsText(e.target.value);
              }}
              placeholder="postinstall (empty when none observed)"
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[12px] text-[#111827] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2B5FD9]/40"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={repoReadAuthorized}
              onChange={(e) => {
                setRepoReadAuthorized(e.target.checked);
              }}
              className="h-4 w-4 rounded border-[#CBD5E1] text-[#2B5FD9] focus:ring-[#2B5FD9]/40"
            />
            <span className="text-[11px] text-[#374151] dark:text-[#E2E8F0]">
              Read access to this repository is authorized
            </span>
          </label>
          <button
            onClick={assess}
            disabled={planQuery.isFetching || repository.trim().length < 3}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2B5FD9] text-white text-[13px] font-semibold hover:bg-[#1E4BB8] transition-colors disabled:opacity-50"
          >
            {planQuery.isFetching ? (
              <Loading label="" size="sm" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Run security &amp; acquisition review
          </button>
        </div>
        {planQuery.isError && (
          <p className="mt-3 text-[12px] text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> The acquisition review could not be completed
            right now.
          </p>
        )}
      </Card>

      {/* ── Acquisition plan result ───────────────────────────────────── */}
      {assessed && plan && (
        <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-[#2B5FD9]" />
              <h3 className="text-[14px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC] font-mono">
                {plan.repository}
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${ACQUISITION_COLORS[plan.state] ?? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
              >
                {formatHuman(plan.state)}
              </span>
            </div>
            <span className="text-[10px] text-[#94A3B8]">{formatDateTime(plan.updatedAt)}</span>
          </div>

          {/* Security */}
          {plan.security && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" /> Security
                  </p>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${SECURITY_COLORS[plan.security.classification] ?? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
                  >
                    {formatHuman(plan.security.classification)}
                  </span>
                </div>
                {plan.security.blockingIndicators.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {plan.security.blockingIndicators.map((indicator) => (
                      <li
                        key={indicator}
                        className="text-[11px] text-rose-600 dark:text-rose-400 flex items-start gap-1.5"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {indicator}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    No blocking indicators found in the checks performed — never a blanket guarantee
                    of safety.
                  </p>
                )}
                {plan.security.sandboxRequired && (
                  <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    {plan.security.sandboxAvailable
                      ? 'Execution requires sandbox isolation — available.'
                      : 'Execution requires sandbox isolation — NOT available; mark SECURITY_REVIEW_REQUIRED and do not execute automatically.'}
                  </p>
                )}
                <div className="mt-2 pt-2 border-t border-[#F1F5F9] dark:border-[#334155]">
                  <p className="text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wide">
                    Checks
                  </p>
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    {plan.security.checks.map((check) => (
                      <span
                        key={check.name}
                        className="flex items-center gap-1 text-[10px] text-[#64748B] dark:text-[#94A3B8]"
                      >
                        {check.passed ? (
                          <CheckCircle2 className="h-3 w-3 text-[#22C55E] shrink-0" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 text-[#F59E0B] shrink-0" />
                        )}
                        {check.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* License */}
              <div className="p-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide flex items-center gap-1">
                    <Scale className="h-3 w-3" /> License
                  </p>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
                      plan.license?.verdict === 'PERMISSIVE'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : plan.license?.verdict === 'RESTRICTIVE'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : plan.license?.verdict === 'COMMERCIAL_RESTRICTED'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {plan.license ? formatHuman(plan.license.verdict) : 'UNKNOWN'}
                  </span>
                </div>
                {plan.license && (
                  <>
                    <div className="mt-2 space-y-1">
                      <LicenseRow
                        label="Software license"
                        value={plan.license.software.type ?? 'UNKNOWN'}
                        present={plan.license.software.present}
                      />
                      {plan.license.model && (
                        <LicenseRow
                          label="Model license"
                          value={plan.license.model.type ?? 'UNKNOWN'}
                          present={plan.license.model.present}
                        />
                      )}
                      {plan.license.software.commercialUseRestricted && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400">
                          Commercial use restricted.
                        </p>
                      )}
                      {plan.license.software.attributionRequired && (
                        <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                          Attribution required.
                        </p>
                      )}
                      {plan.license.verdict === 'LICENSE_UNKNOWN' && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400">
                          License cannot be established — not auto-approved for a commercial
                          factory.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Relevance */}
          {plan.relevance && plan.relevance.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide">
                Why it matters
              </p>
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                {plan.relevance.map((r) => (
                  <span
                    key={r}
                    className="px-2 py-0.5 rounded-full bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[10px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF]"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Approval boundary */}
          {plan.requiresApprovalFor.length > 0 && (
            <div className="mt-3 p-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-[#451A03]/30">
              <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> Approval required before:
              </p>
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                {plan.requiresApprovalFor.map((action) => (
                  <span
                    key={action}
                    className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-semibold"
                  >
                    {formatHuman(action)}
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                Approval covers acquisition + sandboxed analysis. Execution/installation/integration
                remain separate decisions with their own gates — reading never implies safe
                execution.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {plan.state === 'APPROVAL_REQUIRED' && (
              <>
                <button
                  onClick={() => {
                    void handleApprove();
                  }}
                  disabled={approve.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {approve.isPending ? (
                    <Loading label="" size="sm" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Approve acquisition
                </button>
                <button
                  onClick={() => {
                    void handleReject();
                  }}
                  disabled={reject.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[12px] font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors disabled:opacity-50"
                >
                  {reject.isPending ? (
                    <Loading label="" size="sm" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  Reject
                </button>
              </>
            )}
            {approved && (
              <p className="text-[12px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Approved — acquisition + sandboxed analysis
                recorded. Execution remains a separate gated decision.
              </p>
            )}
            {rejected && (
              <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
                <ArrowRight className="h-3.5 w-3.5" /> Declined —{' '}
                {plan.fallback ?? 'continuing with the best available configured capability.'} Your
                explicit choice is recorded; it is never inferred as a permanent preference.
              </p>
            )}
          </div>
        </Card>
      )}

      {/* ── License quick evaluator ───────────────────────────────────── */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-[#7C3AED]" />
          <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
            License quick check
          </h3>
        </div>
        <div className="mt-2 flex flex-col sm:flex-row gap-2">
          <input
            value={licenseInput}
            onChange={(e) => {
              setLicenseInput(e.target.value);
            }}
            placeholder="MIT / Apache-2.0 / GPL-3.0 / CC-BY-NC… (model license is evaluated separately)"
            className="flex-1 px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[12px] text-[#111827] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40"
          />
        </div>
        {licenseEval.data && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge
              variant={
                licenseEval.data.verdict === 'PERMISSIVE'
                  ? 'success'
                  : licenseEval.data.verdict === 'RESTRICTIVE'
                    ? 'warning'
                    : licenseEval.data.verdict === 'COMMERCIAL_RESTRICTED'
                      ? 'danger'
                      : 'info'
              }
              size="sm"
            >
              {formatHuman(licenseEval.data.verdict)}
            </Badge>
            {licenseEval.data.software.commercialUseRestricted && (
              <span className="text-[11px] text-rose-600 dark:text-rose-400">
                Commercial use restricted
              </span>
            )}
            {licenseEval.data.software.attributionRequired && (
              <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                Attribution required
              </span>
            )}
            {licenseEval.data.verdict === 'LICENSE_UNKNOWN' && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400">
                Unknown — not auto-approved for commercial use.
              </span>
            )}
          </div>
        )}
      </Card>

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {!assessed && (
        <EmptyState
          icon={<GitBranch className="h-8 w-8" />}
          title="Assess a repository"
          description="Run the security gate and license check, then review the acquisition plan: what approval is required, what happens if you decline, and the honest boundary between reading, cloning, executing, installing, configuring and using a repository in a factory."
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SecurityToggle(props: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  positive?: boolean;
}): React.JSX.Element {
  const { label, checked, onChange, positive } = props;
  return (
    <label className="flex items-center gap-2 p-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
        className="h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#2B5FD9] focus:ring-[#2B5FD9]/40"
      />
      <span className="text-[11px] text-[#374151] dark:text-[#E2E8F0] flex items-center gap-1.5">
        {positive ? (
          <Cpu className="h-3 w-3 text-[#22C55E]" />
        ) : (
          <Eye className="h-3 w-3 text-[#F59E0B]" />
        )}
        {label}
      </span>
    </label>
  );
}

function LicenseRow(props: { label: string; value: string; present: boolean }): React.JSX.Element {
  const { label, value, present } = props;
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-[#64748B] dark:text-[#94A3B8]">{label}</span>
      <span
        className={`font-medium ${present ? 'text-[#111827] dark:text-[#F8FAFC]' : 'text-[#94A3B8]'}`}
      >
        {present ? value : 'UNKNOWN'}
      </span>
    </div>
  );
}
