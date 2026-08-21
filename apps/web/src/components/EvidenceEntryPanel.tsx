// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Founder Evidence Entry Panel (SPRINT-042)
//
// The missing founder-facing mutation surface for the verified Founder
// Evidence Loop (SPRINT-039): OBSERVE → RECORD EVIDENCE → CREATE/CONTACT
// PROSPECT → ADVANCE VALIDATION → REQUEST/CAPTURE PAYMENT → VERIFY PAYMENT
// EVIDENCE → SEE REVENUE STATE → SEE UPDATED RADAR → SEE NEXT BEST ACTION.
//
// PURE COMPOSITION — NEW ENGINES CREATED: 0.
//
//   • Every mutation maps 1:1 to an EXISTING gateway procedure:
//       Register problem  → world.problemRegister   (evidence REQUIRED)
//       Record observation → world.observationRecord (provenance REQUIRED)
//       Create prospect    → world.prospectRegister  (provenance REQUIRED)
//       Advance prospect   → world.prospectAdvance   (bounded chain; payment
//                                                     evidence REQUIRED for
//                                                     VERIFIED_PAYMENT)
//   • NO business rules are reimplemented in React. The backend remains
//     authoritative: provenance refusal, evidence-state honesty (a claimed
//     VERIFIED is downgraded), sanitization, the bounded prospect chain
//     (display-only controls derived from the known contract — an illegal
//     jump is still rejected by the gateway), and the verified-payment-only
//     revenue ladder all come from the existing domain.
//   • The UI can only REQUEST a transition; the backend state machine decides.
//   • No fabricated evidence, customers, payments or revenue. Empty datasets
//     stay EMPTY. UNKNOWN stays UNKNOWN.
//
// Mounted in the Command Center INTELLIGENCE tab (next to the Opportunity
// Radar). On success it calls onSaved() so the parent refreshes the read
// models (radar / drill-down / NBA).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Drawer, DrawerContent, DrawerOverlay, Button, Select, TextField } from '@vedmoulya/ui';
import {
  Activity,
  Briefcase,
  ChevronRight,
  Plus,
  ShieldCheck,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { api } from '../lib/trpc.js';
import { useAuthStore } from '../stores/auth-store.js';

// ── Closed vocabularies (mirror the EXISTING domain — never invented) ──────

const SOURCE_TYPES = [
  { value: 'customer_conversation', label: 'Customer conversation' },
  { value: 'site_visit', label: 'Site visit' },
  { value: 'workflow_observation', label: 'Workflow observation' },
  { value: 'secondary_research', label: 'Secondary research' },
  { value: 'experiment', label: 'Experiment' },
  { value: 'founder_knowledge', label: 'Founder knowledge' },
  { value: 'other', label: 'Other' },
] as const;

/** Honest evidence-state options for an observation. VERIFIED is deliberately
 *  ABSENT — the domain downgrades a claimed VERIFIED to OBSERVED; the UI must
 *  not offer what the backend forbids. UNKNOWN/CONFLICTING are derived by the
 *  backend, not claimable. */
const CLAIMED_STATES = [
  { value: 'REPORTED_BY_CUSTOMER', label: 'Reported by a customer' },
  { value: 'FOUNDER_OBSERVED', label: 'I observed it directly' },
  { value: 'DOCUMENTED', label: 'Documented (notes / logs / records)' },
  { value: 'HYPOTHESIS', label: 'Hypothesis / assumption' },
] as const;

/** Evidence sources for a problem (SPRINT-038 schema). */
const PROBLEM_EVIDENCE_SOURCES = [
  { value: 'customer_interview', label: 'Customer interview' },
  { value: 'customer_data', label: 'Customer data' },
  { value: 'direct_observation', label: 'Direct observation' },
  { value: 'public_company_info', label: 'Public company info' },
  { value: 'public_reviews', label: 'Public reviews' },
  { value: 'job_postings', label: 'Job postings' },
  { value: 'marketplace_demand', label: 'Marketplace demand' },
  { value: 'public_pricing', label: 'Public pricing' },
  { value: 'industry_reports', label: 'Industry reports' },
  { value: 'startup_databases', label: 'Startup databases' },
  { value: 'government_data', label: 'Government data' },
  { value: 'vedmoulya_observation', label: 'VedMoulya observation' },
  { value: 'experiment_result', label: 'Experiment result' },
] as const;

const CONFIDENCE_OPTIONS = [
  { value: 'VERIFIED', label: 'Verified (cross-checked)' },
  { value: 'ESTIMATED', label: 'Estimated' },
  { value: 'UNKNOWN', label: 'Unknown' },
] as const;

/** The bounded prospect chain (display-only; the BACKEND remains the
 *  authority — an illegal jump is rejected with INVALID_TRANSITION). */
const PROSPECT_NEXT: Record<string, string[]> = {
  CONTACTED: ['CONVERSATION', 'LOST'],
  CONVERSATION: ['PROBLEM_CONFIRMED', 'LOST'],
  PROBLEM_CONFIRMED: ['SOLUTION_INTEREST', 'LOST'],
  SOLUTION_INTEREST: ['WTP_SIGNAL', 'PAYMENT_REQUESTED', 'LOST'],
  WTP_SIGNAL: ['PAYMENT_REQUESTED', 'LOST'],
  PAYMENT_REQUESTED: ['VERIFIED_PAYMENT', 'LOST'],
  VERIFIED_PAYMENT: ['LOST'],
  LOST: [],
};

const PROSPECT_STATUS_LABELS: Record<string, string> = {
  CONTACTED: 'Contacted',
  CONVERSATION: 'In conversation',
  PROBLEM_CONFIRMED: 'Problem confirmed',
  SOLUTION_INTEREST: 'Solution interest',
  WTP_SIGNAL: 'Willingness-to-pay signal',
  PAYMENT_REQUESTED: 'Payment requested',
  VERIFIED_PAYMENT: 'Verified payment',
  LOST: 'Lost',
};

const DISCOVERY_NOTE =
  'Discovery ≠ validation. Interest ≠ revenue. WTP ≠ payment. Only a verified payment is revenue evidence.';

type Mode = 'problem' | 'observation' | 'prospect' | 'advance';

interface ModeDef {
  id: Mode;
  label: string;
  icon: typeof Activity;
  description: string;
}

const MODES: ModeDef[] = [
  {
    id: 'problem',
    label: 'Problem',
    icon: Briefcase,
    description: 'Register a real business problem with its evidence.',
  },
  {
    id: 'observation',
    label: 'Observation',
    icon: Activity,
    description: 'Record what you actually observed — provenance required.',
  },
  {
    id: 'prospect',
    label: 'Prospect',
    icon: UserPlus,
    description: 'Log a real customer-discovery contact (never a customer).',
  },
  {
    id: 'advance',
    label: 'Advance',
    icon: ChevronRight,
    description: 'Progress a prospect through the bounded chain.',
  },
];

interface ProblemOption {
  id: string;
  problemStatement: string;
  status: string;
  revenueState: string;
}

interface ProspectRow {
  id: string;
  problemId: string;
  prospectReference: string;
  customerSegment: string;
  discoveryStatus: string;
}

export function EvidenceEntryPanel({ onSaved }: { onSaved: () => void }): React.JSX.Element {
  const userId = useAuthStore((s) => s.user?.userId ?? '');

  // ── Drawer state ─────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('problem');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Shared selects ───────────────────────────────────────────────────────
  const [problemId, setProblemId] = useState('');
  const [prospectReference, setProspectReference] = useState('');
  const [provenanceSource, setProvenanceSource] = useState('');
  const [observedAt, setObservedAt] = useState(() => new Date().toISOString().slice(0, 10));

  // ── Problem mode ─────────────────────────────────────────────────────────
  const [problemStatement, setProblemStatement] = useState('');
  const [problemCustomer, setProblemCustomer] = useState('');
  const [problemAffectedRole, setProblemAffectedRole] = useState('');
  const [problemPain, setProblemPain] = useState('');
  const [problemCurrentSolution, setProblemCurrentSolution] = useState('');
  const [problemEvidenceSource, setProblemEvidenceSource] = useState('customer_interview');
  const [problemEvidenceText, setProblemEvidenceText] = useState('');
  const [problemConfidence, setProblemConfidence] = useState('VERIFIED');

  // ── Observation mode ─────────────────────────────────────────────────────
  const [sourceType, setSourceType] = useState('customer_conversation');
  const [sourceReference, setSourceReference] = useState('');
  const [observedStatement, setObservedStatement] = useState('');
  const [context, setContext] = useState('');
  const [affectedSegment, setAffectedSegment] = useState('');
  const [frequency, setFrequency] = useState('');
  const [severity, setSeverity] = useState('');
  const [claimedState, setClaimedState] = useState('');

  // ── Prospect mode ────────────────────────────────────────────────────────
  const [customerSegment, setCustomerSegment] = useState('');
  const [problemDiscussed, setProblemDiscussed] = useState('');
  const [painSeverity, setPainSeverity] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState('');
  const [nextStep, setNextStep] = useState('');

  // ── Advance mode ─────────────────────────────────────────────────────────
  const [targetState, setTargetState] = useState('');
  const [paymentEvidence, setPaymentEvidence] = useState('');

  // ── Data ─────────────────────────────────────────────────────────────────
  const problemsQuery = api.world.problemList.useQuery(
    { userId },
    { enabled: userId.length > 0 && open, refetchOnWindowFocus: false },
  );
  const prospectsQuery = api.world.prospectsList.useQuery(
    { userId, problemId: problemId || undefined },
    {
      enabled: userId.length > 0 && open && mode === 'advance' && problemId.length > 0,
      refetchOnWindowFocus: false,
    },
  );

  const problemRegister = api.world.problemRegister.useMutation();
  const observationRecord = api.world.observationRecord.useMutation();
  const prospectRegister = api.world.prospectRegister.useMutation();
  const prospectAdvance = api.world.prospectAdvance.useMutation();

  /** Safe string coercion for unknown read-model fields (no base-to-string). */
  const asString = (v: unknown): string => (typeof v === 'string' ? v : '');

  const problems: ProblemOption[] = useMemo(() => {
    const raw = problemsQuery.data?.data;
    if (!Array.isArray(raw)) return [];
    return raw.map((p: Record<string, unknown>) => ({
      id: asString(p.id),
      problemStatement: asString(p.problemStatement),
      status: asString(p.status),
      revenueState: asString(p.revenueState),
    }));
  }, [problemsQuery.data]);

  const prospects: ProspectRow[] = useMemo(() => {
    const raw = prospectsQuery.data?.data;
    if (!Array.isArray(raw)) return [];
    return raw.map((p: Record<string, unknown>) => ({
      id: asString(p.id),
      problemId: asString(p.problemId),
      prospectReference: asString(p.prospectReference),
      customerSegment: asString(p.customerSegment),
      discoveryStatus: asString(p.discoveryStatus),
    }));
  }, [prospectsQuery.data]);

  const selectedProspect = prospects.find((p) => p.prospectReference === prospectReference);

  // Reset derived state when the problem/prospect selection changes.
  useEffect(() => {
    setProspectReference('');
    setTargetState('');
    setPaymentEvidence('');
  }, [problemId]);

  useEffect(() => {
    setTargetState('');
    setPaymentEvidence('');
  }, [prospectReference]);

  // Fresh problem list on open so the selector is current. Depends on `open`
  // ONLY — `problemsQuery` is a new object identity every render, so listing it
  // here would re-run the effect on every render while the drawer is open and
  // refetch in an infinite loop (genuine defect found by live verification:
  // 30+ refetches in 2s, each burning a rate-limit token).
  useEffect(() => {
    if (open) {
      void problemsQuery.refetch();
    }
    // NOTE: `problemsQuery` is intentionally NOT a dependency — it is a new
    // object identity every render, and listing it here caused the infinite
    // refetch loop this comment documents (defect D2).
  }, [open]);

  const resetForms = (): void => {
    setMode('problem');
    setProblemId('');
    setProspectReference('');
    setProvenanceSource('');
    setObservedAt(new Date().toISOString().slice(0, 10));
    setProblemStatement('');
    setProblemCustomer('');
    setProblemAffectedRole('');
    setProblemPain('');
    setProblemCurrentSolution('');
    setProblemEvidenceText('');
    setProblemConfidence('VERIFIED');
    setSourceType('customer_conversation');
    setSourceReference('');
    setObservedStatement('');
    setContext('');
    setAffectedSegment('');
    setFrequency('');
    setSeverity('');
    setClaimedState('');
    setCustomerSegment('');
    setProblemDiscussed('');
    setPainSeverity('');
    setDesiredOutcome('');
    setNextStep('');
    setTargetState('');
    setPaymentEvidence('');
    setFormError(null);
    setSuccess(null);
    setSubmitting(false);
  };

  const close = (): void => {
    setOpen(false);
    resetForms();
  };

  const handleSaved = (message: string): void => {
    setSuccess(message);
    setSubmitting(false);
    // Refresh BOTH read models the drawer depends on: the problem selector
    // AND the prospect list (a transition changes the prospect's status, so a
    // stale cached list would offer invalid next transitions — genuine defect
    // found by live verification, SPRINT-042).
    void problemsQuery.refetch();
    void prospectsQuery.refetch();
    onSaved();
    setTimeout(close, 1400);
  };

  const handleProblemSubmit = async (e: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    if (!problemStatement.trim()) {
      setFormError('Describe the business problem you observed.');
      return;
    }
    if (!problemEvidenceText.trim()) {
      setFormError(
        'A problem requires at least one evidence record with provenance — no fabricated facts.',
      );
      return;
    }
    setSubmitting(true);
    try {
      const result = await problemRegister.mutateAsync({
        userId,
        problemStatement: problemStatement.trim(),
        customerOrBusiness: problemCustomer.trim() || undefined,
        affectedRole: problemAffectedRole.trim() || undefined,
        pain: problemPain.trim() || undefined,
        currentSolution: problemCurrentSolution.trim() || undefined,
        evidence: [
          {
            source: problemEvidenceSource as never,
            text: problemEvidenceText.trim(),
            confidence: problemConfidence as never,
          },
        ],
      });
      if (!result.success) {
        setSubmitting(false);
        setFormError(
          (result.error as { message?: string }).message ?? 'The backend refused this problem.',
        );
        return;
      }
      const created = (result.data as Record<string, unknown> | undefined) ?? {};
      setProblemId(asString(created.id));
      handleSaved('Problem registered. Evidence recorded.');
    } catch {
      setSubmitting(false);
      setFormError('Could not reach the gateway. Try again.');
    }
  };

  const handleObservationSubmit = async (
    e: React.SyntheticEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    if (!problemId) {
      setFormError('Choose the problem this observation belongs to.');
      return;
    }
    if (!observedStatement.trim()) {
      setFormError('Record what you actually observed.');
      return;
    }
    if (!sourceReference.trim()) {
      setFormError('Who/what is this observation about? (e.g. "3 clinic owners").');
      return;
    }
    if (!provenanceSource.trim()) {
      setFormError('Provenance is REQUIRED — every observation needs a source.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await observationRecord.mutateAsync({
        userId,
        problemId,
        sourceType,
        sourceReference: sourceReference.trim(),
        observedStatement: observedStatement.trim(),
        context: context.trim() || undefined,
        affectedCustomerSegment: affectedSegment.trim() || undefined,
        frequency: frequency.trim() || undefined,
        severity: severity.trim() || undefined,
        claimedState: claimedState || undefined,
        provenance: {
          source: provenanceSource.trim(),
          observedAt,
        },
      });
      if (!result.success) {
        setSubmitting(false);
        setFormError(
          (result.error as { message?: string }).message ?? 'The backend refused this observation.',
        );
        return;
      }
      handleSaved('Observation recorded. Radar and next best action will update.');
    } catch {
      setSubmitting(false);
      setFormError('Could not reach the gateway. Try again.');
    }
  };

  const handleProspectSubmit = async (e: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    if (!problemId) {
      setFormError('Choose the problem this prospect relates to.');
      return;
    }
    if (!prospectReference.trim()) {
      setFormError('Give this prospect a reference (e.g. "clinic-owner-3").');
      return;
    }
    if (!customerSegment.trim()) {
      setFormError('Which customer segment does this prospect represent?');
      return;
    }
    if (!problemDiscussed.trim()) {
      setFormError('Describe the problem you discussed with this prospect.');
      return;
    }
    if (!provenanceSource.trim()) {
      setFormError('Provenance is REQUIRED — every discovery record needs a source.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await prospectRegister.mutateAsync({
        userId,
        problemId,
        prospectReference: prospectReference.trim(),
        customerSegment: customerSegment.trim(),
        problemDiscussed: problemDiscussed.trim(),
        painSeverity: painSeverity.trim() || undefined,
        desiredOutcome: desiredOutcome.trim() || undefined,
        nextStep: nextStep.trim() || undefined,
        provenance: {
          source: provenanceSource.trim(),
          observedAt,
        },
      });
      if (!result.success) {
        setSubmitting(false);
        setFormError(
          (result.error as { message?: string }).message ?? 'The backend refused this prospect.',
        );
        return;
      }
      handleSaved('Prospect recorded. Discovery ≠ validation — it is not a customer yet.');
    } catch (err) {
      setSubmitting(false);
      setFormError(
        err instanceof Error
          ? `Could not reach the gateway: ${err.message}`
          : 'Could not reach the gateway. Try again.',
      );
    }
  };

  const handleAdvanceSubmit = async (e: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    if (!problemId || !prospectReference) {
      setFormError('Choose the problem and the prospect to advance.');
      return;
    }
    if (!targetState) {
      setFormError('Choose the next state to request.');
      return;
    }
    if (targetState === 'VERIFIED_PAYMENT' && !paymentEvidence.trim()) {
      setFormError(
        'VERIFIED_PAYMENT requires the actual payment evidence (amount, method, reference) — a verified payment is never fabricated.',
      );
      return;
    }
    setSubmitting(true);
    try {
      const result = await prospectAdvance.mutateAsync({
        userId,
        problemId,
        prospectReference,
        to: targetState,
        verifiedPaymentText:
          targetState === 'VERIFIED_PAYMENT' ? paymentEvidence.trim() : undefined,
      });
      if (!result.success) {
        setSubmitting(false);
        setFormError(
          (result.error as { message?: string }).message ??
            'The backend refused this transition (bounded discovery chain).',
        );
        return;
      }
      const updated = (result.data as Record<string, unknown> | undefined) ?? {};
      const newStatus = asString(updated.discoveryStatus) || targetState;
      handleSaved(
        targetState === 'VERIFIED_PAYMENT'
          ? `Verified payment recorded — the prospect is now ${
              // eslint-disable-next-line security/detect-object-injection -- key is a known prospect status from the closed chain
              PROSPECT_STATUS_LABELS[newStatus] ?? newStatus
            }. Only real payment evidence can enter the revenue ladder.`
          : `Prospect advanced to ${
              // eslint-disable-next-line security/detect-object-injection -- key is a known prospect status from the closed chain
              PROSPECT_STATUS_LABELS[newStatus] ?? newStatus
            }.`,
      );
    } catch {
      setSubmitting(false);
      setFormError('Could not reach the gateway. Try again.');
    }
  };

  const validNext = selectedProspect ? (PROSPECT_NEXT[selectedProspect.discoveryStatus] ?? []) : [];
  const showPaymentEvidence = targetState === 'VERIFIED_PAYMENT';
  const targetOptions = [
    ...validNext.map((s) => ({
      value: s,
      // eslint-disable-next-line security/detect-object-injection -- key is a known prospect status from the closed chain
      label: PROSPECT_STATUS_LABELS[s] ?? s,
    })),
  ];
  const problemOptions = problems.map((p) => ({
    value: p.id,
    label: `${p.problemStatement.slice(0, 60)}${p.problemStatement.length > 60 ? '…' : ''}`,
  }));
  const prospectOptions = prospects.map((p) => ({
    value: p.prospectReference,
    label: `${p.prospectReference} · ${PROSPECT_STATUS_LABELS[p.discoveryStatus] ?? p.discoveryStatus}`,
  }));

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
        aria-haspopup="dialog"
        className="flex items-center gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Add Evidence
      </Button>

      <Drawer
        open={open}
        onOpenChange={(o) => {
          if (o) setOpen(true);
          else close();
        }}
      >
        <DrawerOverlay />
        <DrawerContent side="right" size="lg" aria-label="Record founder evidence">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#7C3AED]" aria-hidden="true" />
              <span className="text-[13px] font-semibold text-[#1F2937]">
                Record founder evidence
              </span>
            </div>
            <button
              onClick={close}
              aria-label="Close evidence entry"
              className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
            >
              ✕
            </button>
          </div>

          <div className="px-5 py-3">
            <p className="text-[11px] leading-relaxed text-[#64748B]">
              Record what you actually observed — the system scores, recommends and tracks. The
              backend stays authoritative: provenance is mandatory, VERIFIED cannot be self-claimed,
              and only a real verified payment enters the revenue ladder. Nothing is fabricated.
            </p>
          </div>

          {/* Mode tabs */}
          <div className="px-5 pb-3">
            <div className="grid grid-cols-2 gap-1.5" role="tablist" aria-label="Evidence kind">
              {MODES.map(({ id, label, icon: Icon, description }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={mode === id}
                  onClick={() => {
                    setMode(id);
                    setFormError(null);
                    setSuccess(null);
                  }}
                  className={`rounded-xl border p-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] ${
                    mode === id
                      ? 'border-[#7C3AED] bg-[#F5F3FF]'
                      : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#1F2937]">
                    <Icon className="h-3 w-3 text-[#7C3AED]" aria-hidden="true" />
                    {label}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-[#64748B]">{description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="px-5 pb-6">
            {success && (
              <div
                role="status"
                className="mb-3 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2 text-[12px] text-[#15803D]"
              >
                {success}
              </div>
            )}
            {formError && (
              <div
                role="alert"
                className="mb-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#B91C1C]"
              >
                {formError}
              </div>
            )}

            {/* ── PROBLEM ─────────────────────────────────────────────── */}
            {mode === 'problem' && (
              <form onSubmit={(e) => void handleProblemSubmit(e)} noValidate className="space-y-3">
                <p className="text-[11px] text-[#64748B]">
                  A registered problem anchors observations, prospects and payments. It requires
                  real evidence — a problem with no evidence is refused.
                </p>
                <TextField
                  label="Problem statement"
                  type="text"
                  name="problemStatement"
                  placeholder="e.g. Clinic owners manually reconcile invoices and lose hours every week"
                  size="lg"
                  value={problemStatement}
                  onChange={(e) => {
                    setProblemStatement(e.target.value);
                  }}
                  disabled={submitting}
                />
                <div className="grid grid-cols-2 gap-2">
                  <TextField
                    label="Customer / business (optional)"
                    type="text"
                    name="problemCustomer"
                    placeholder="e.g. Small clinics"
                    value={problemCustomer}
                    onChange={(e) => {
                      setProblemCustomer(e.target.value);
                    }}
                    disabled={submitting}
                  />
                  <TextField
                    label="Affected role (optional)"
                    type="text"
                    name="problemAffectedRole"
                    placeholder="e.g. Clinic owner / office manager"
                    value={problemAffectedRole}
                    onChange={(e) => {
                      setProblemAffectedRole(e.target.value);
                    }}
                    disabled={submitting}
                  />
                </div>
                <TextField
                  label="Pain (optional)"
                  type="text"
                  name="problemPain"
                  placeholder="What makes it painful?"
                  value={problemPain}
                  onChange={(e) => {
                    setProblemPain(e.target.value);
                  }}
                  disabled={submitting}
                />
                <TextField
                  label="Current solution (optional)"
                  type="text"
                  name="problemCurrentSolution"
                  placeholder="How is it done today?"
                  value={problemCurrentSolution}
                  onChange={(e) => {
                    setProblemCurrentSolution(e.target.value);
                  }}
                  disabled={submitting}
                />
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-3">
                  <p className="text-[11px] font-medium text-[#374151]">
                    Initial evidence (required — no fabricated facts)
                  </p>
                  <Select
                    label="Evidence source"
                    name="problemEvidenceSource"
                    options={[...PROBLEM_EVIDENCE_SOURCES]}
                    value={problemEvidenceSource}
                    onChange={(e) => {
                      setProblemEvidenceSource(e.target.value);
                    }}
                    disabled={submitting}
                  />
                  <TextField
                    label="What is the evidence?"
                    type="text"
                    name="problemEvidenceText"
                    placeholder="e.g. During a call, two clinic owners described reconciliation as a weekly time sink"
                    size="lg"
                    value={problemEvidenceText}
                    onChange={(e) => {
                      setProblemEvidenceText(e.target.value);
                    }}
                    disabled={submitting}
                  />
                  <Select
                    label="Confidence"
                    name="problemConfidence"
                    options={[...CONFIDENCE_OPTIONS]}
                    value={problemConfidence}
                    onChange={(e) => {
                      setProblemConfidence(e.target.value);
                    }}
                    disabled={submitting}
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={submitting}
                  className="h-11"
                >
                  {submitting ? 'Registering…' : 'Register problem'}
                </Button>
              </form>
            )}

            {/* ── OBSERVATION ─────────────────────────────────────────── */}
            {mode === 'observation' && (
              <form
                onSubmit={(e) => void handleObservationSubmit(e)}
                noValidate
                className="space-y-3"
              >
                <Select
                  label="Problem"
                  name="observationProblem"
                  placeholder={
                    problems.length === 0 ? 'Register a problem first' : 'Choose a problem…'
                  }
                  options={problemOptions}
                  value={problemId}
                  onChange={(e) => {
                    setProblemId(e.target.value);
                  }}
                  disabled={submitting || problems.length === 0}
                />
                {problems.length === 0 && (
                  <p className="text-[11px] text-[#92400E]">
                    No problems registered yet — register one first so this observation has an
                    anchor.
                  </p>
                )}
                <Select
                  label="What kind of observation is this?"
                  name="sourceType"
                  options={[...SOURCE_TYPES]}
                  value={sourceType}
                  onChange={(e) => {
                    setSourceType(e.target.value);
                  }}
                  disabled={submitting}
                />
                <TextField
                  label="Who / what is this about?"
                  type="text"
                  name="sourceReference"
                  placeholder="e.g. 3 clinic owners"
                  size="lg"
                  value={sourceReference}
                  onChange={(e) => {
                    setSourceReference(e.target.value);
                  }}
                  disabled={submitting}
                />
                <TextField
                  label="What did you observe?"
                  type="text"
                  name="observedStatement"
                  placeholder="e.g. Two owners said reconciliation takes 4+ hours every week"
                  size="lg"
                  value={observedStatement}
                  onChange={(e) => {
                    setObservedStatement(e.target.value);
                  }}
                  disabled={submitting}
                />
                <TextField
                  label="Context (optional)"
                  type="text"
                  name="observationContext"
                  placeholder="What was happening around this observation?"
                  value={context}
                  onChange={(e) => {
                    setContext(e.target.value);
                  }}
                  disabled={submitting}
                />
                <div className="grid grid-cols-2 gap-2">
                  <TextField
                    label="Affected segment (optional)"
                    type="text"
                    name="affectedSegment"
                    placeholder="e.g. Clinics < 20 staff"
                    value={affectedSegment}
                    onChange={(e) => {
                      setAffectedSegment(e.target.value);
                    }}
                    disabled={submitting}
                  />
                  <TextField
                    label="Frequency (optional)"
                    type="text"
                    name="observationFrequency"
                    placeholder="e.g. Weekly"
                    value={frequency}
                    onChange={(e) => {
                      setFrequency(e.target.value);
                    }}
                    disabled={submitting}
                  />
                </div>
                <Select
                  label="Tag (optional — VERIFIED is never self-claimable)"
                  name="claimedState"
                  placeholder="Let the backend decide"
                  options={[...CLAIMED_STATES]}
                  value={claimedState}
                  onChange={(e) => {
                    setClaimedState(e.target.value);
                  }}
                  disabled={submitting}
                />
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-3">
                  <p className="text-[11px] font-medium text-[#374151]">Provenance (required)</p>
                  <TextField
                    label="Source"
                    type="text"
                    name="provenanceSource"
                    placeholder="e.g. Founder interview notes, call log, site visit"
                    size="lg"
                    value={provenanceSource}
                    onChange={(e) => {
                      setProvenanceSource(e.target.value);
                    }}
                    disabled={submitting}
                  />
                  <TextField
                    label="Observed on"
                    type="date"
                    name="observedAt"
                    value={observedAt}
                    onChange={(e) => {
                      setObservedAt(e.target.value);
                    }}
                    disabled={submitting}
                  />
                </div>
                <p className="text-[10px] text-[#94A3B8]">
                  An observation is evidence, not a verified fact — the backend decides its evidence
                  state honestly.
                </p>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={submitting}
                  className="h-11"
                  disabled={problems.length === 0}
                >
                  {submitting ? 'Recording…' : 'Record observation'}
                </Button>
              </form>
            )}

            {/* ── PROSPECT ────────────────────────────────────────────── */}
            {mode === 'prospect' && (
              <form onSubmit={(e) => void handleProspectSubmit(e)} noValidate className="space-y-3">
                <p className="text-[11px] text-[#64748B]">{DISCOVERY_NOTE}</p>
                <Select
                  label="Problem"
                  name="prospectProblem"
                  placeholder={
                    problems.length === 0 ? 'Register a problem first' : 'Choose a problem…'
                  }
                  options={problemOptions}
                  value={problemId}
                  onChange={(e) => {
                    setProblemId(e.target.value);
                  }}
                  disabled={submitting || problems.length === 0}
                />
                {problems.length === 0 && (
                  <p className="text-[11px] text-[#92400E]">
                    No problems registered yet — register one first so this prospect is anchored.
                  </p>
                )}
                <TextField
                  label="Prospect reference"
                  type="text"
                  name="prospectReference"
                  placeholder="e.g. clinic-owner-3"
                  size="lg"
                  value={prospectReference}
                  onChange={(e) => {
                    setProspectReference(e.target.value);
                  }}
                  disabled={submitting}
                />
                <TextField
                  label="Customer segment"
                  type="text"
                  name="customerSegment"
                  placeholder="e.g. Clinics < 20 staff"
                  size="lg"
                  value={customerSegment}
                  onChange={(e) => {
                    setCustomerSegment(e.target.value);
                  }}
                  disabled={submitting}
                />
                <TextField
                  label="Problem discussed"
                  type="text"
                  name="problemDiscussed"
                  placeholder="The problem this prospect confirmed or discussed"
                  size="lg"
                  value={problemDiscussed}
                  onChange={(e) => {
                    setProblemDiscussed(e.target.value);
                  }}
                  disabled={submitting}
                />
                <div className="grid grid-cols-2 gap-2">
                  <TextField
                    label="Pain severity (optional)"
                    type="text"
                    name="painSeverity"
                    placeholder="e.g. High"
                    value={painSeverity}
                    onChange={(e) => {
                      setPainSeverity(e.target.value);
                    }}
                    disabled={submitting}
                  />
                  <TextField
                    label="Desired outcome (optional)"
                    type="text"
                    name="desiredOutcome"
                    placeholder="What they want"
                    value={desiredOutcome}
                    onChange={(e) => {
                      setDesiredOutcome(e.target.value);
                    }}
                    disabled={submitting}
                  />
                </div>
                <TextField
                  label="Next step (optional)"
                  type="text"
                  name="prospectNextStep"
                  placeholder="e.g. Follow-up call next week"
                  value={nextStep}
                  onChange={(e) => {
                    setNextStep(e.target.value);
                  }}
                  disabled={submitting}
                />
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-3">
                  <p className="text-[11px] font-medium text-[#374151]">Provenance (required)</p>
                  <TextField
                    label="Source"
                    type="text"
                    name="prospectProvenance"
                    placeholder="e.g. Call log, interview notes"
                    size="lg"
                    value={provenanceSource}
                    onChange={(e) => {
                      setProvenanceSource(e.target.value);
                    }}
                    disabled={submitting}
                  />
                  <TextField
                    label="Observed on"
                    type="date"
                    name="prospectObservedAt"
                    value={observedAt}
                    onChange={(e) => {
                      setObservedAt(e.target.value);
                    }}
                    disabled={submitting}
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={submitting}
                  className="h-11"
                  disabled={problems.length === 0}
                >
                  {submitting ? 'Recording…' : 'Record prospect'}
                </Button>
              </form>
            )}

            {/* ── ADVANCE ─────────────────────────────────────────────── */}
            {mode === 'advance' && (
              <form onSubmit={(e) => void handleAdvanceSubmit(e)} noValidate className="space-y-3">
                <p className="text-[11px] text-[#64748B]">
                  {DISCOVERY_NOTE} The backend decides whether a transition is valid — the UI only
                  requests it.
                </p>
                <Select
                  label="Problem"
                  name="advanceProblem"
                  placeholder={
                    problems.length === 0 ? 'Register a problem first' : 'Choose a problem…'
                  }
                  options={problemOptions}
                  value={problemId}
                  onChange={(e) => {
                    setProblemId(e.target.value);
                  }}
                  disabled={submitting || problems.length === 0}
                />
                <Select
                  label="Prospect"
                  name="advanceProspect"
                  placeholder={
                    prospects.length === 0
                      ? 'No prospects for this problem yet'
                      : 'Choose a prospect…'
                  }
                  options={prospectOptions}
                  value={prospectReference}
                  onChange={(e) => {
                    setProspectReference(e.target.value);
                  }}
                  disabled={submitting || prospects.length === 0}
                />
                {selectedProspect && (
                  <p className="text-[11px] text-[#64748B]">
                    Current state:{' '}
                    <span className="font-medium text-[#1F2937]">
                      {PROSPECT_STATUS_LABELS[selectedProspect.discoveryStatus] ??
                        selectedProspect.discoveryStatus}
                    </span>
                  </p>
                )}
                <Select
                  label="Request transition to"
                  name="advanceTarget"
                  placeholder={
                    validNext.length === 0
                      ? selectedProspect
                        ? 'No further transitions for this state'
                        : 'Choose a prospect first'
                      : 'Choose the next state…'
                  }
                  options={targetOptions}
                  value={targetState}
                  onChange={(e) => {
                    setTargetState(e.target.value);
                  }}
                  disabled={submitting || validNext.length === 0}
                />
                {validNext.length === 0 && selectedProspect && (
                  <p className="text-[11px] text-[#64748B]">
                    {selectedProspect.discoveryStatus === 'LOST'
                      ? 'This prospect is LOST — no further transitions.'
                      : 'This prospect has reached the end of the chain.'}
                  </p>
                )}
                {showPaymentEvidence && (
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Wallet className="h-3.5 w-3.5 text-[#7C3AED]" aria-hidden="true" />
                      <p className="text-[11px] font-medium text-[#374151]">
                        Payment evidence (required)
                      </p>
                    </div>
                    <p className="text-[10px] leading-relaxed text-[#64748B]">
                      The ACTUAL payment evidence — amount, method and reference. Interest and
                      willingness-to-pay are NOT payment. A verified payment is never fabricated.
                    </p>
                    <TextField
                      label="Payment evidence"
                      type="text"
                      name="paymentEvidence"
                      placeholder="e.g. ₹4,999 paid via Razorpay on 2026-08-16 (ref INV-1042)"
                      size="lg"
                      value={paymentEvidence}
                      onChange={(e) => {
                        setPaymentEvidence(e.target.value);
                      }}
                      disabled={submitting}
                    />
                  </div>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={submitting}
                  className="h-11"
                  disabled={validNext.length === 0}
                >
                  {submitting
                    ? 'Advancing…'
                    : showPaymentEvidence
                      ? 'Record verified payment'
                      : 'Request transition'}
                </Button>
              </form>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
