// ──────────────────────────────────────────────────────────────────
// VedMoulya — Goal & Task Intelligence: Problem Understanding Service
// SPRINT-023 — Outcome Intelligence & Real-Problem Execution (§1/§2)
//
// Turns a raw problem statement into a typed ProblemDefinition by
// COMPOSING the existing GoalUnderstandingService (category / domain /
// capability / context hints + suggested priority — EI-006) with a thin
// deterministic layer that adds the mission vocabulary:
//
//   intent (ANSWER / ACTION / OUTCOME) · desired outcome · constraints ·
//   urgency · missing information · risk estimate · approval requirements ·
//   success criteria.
//
// It is a MAPPER/ORCHESTRATOR over the existing understanding pass — it
// is NOT a new engine and it NEVER executes anything. Every determination
// is rule-based and recorded in `provenance`; anything it could not
// determine goes into `missingInformation` (never hallucinated).
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type { GoalInput, GoalPriority, RiskLevel } from '../../types/goal-types.js';
import { GoalUnderstandingService } from './GoalUnderstandingService.js';
import type {
  ProblemApprovalRequirement,
  ProblemConstraint,
  ProblemDefinition,
  ProblemIntent,
} from '../../types/problem-types.js';

// ── Intent signals (ANSWER vs ACTION vs OUTCOME) ───────────────────────────
const ANSWER_SIGNALS = [
  'what is',
  'what are',
  'how does',
  'how do',
  'explain',
  'define',
  'compare',
  'difference between',
  'why',
  'tell me',
  'describe',
  'list the',
  'summarize',
] as const;
const ACTION_SIGNALS = [
  'build',
  'create',
  'write',
  'send',
  'run',
  'install',
  'generate',
  'automate',
  'set up',
  'setup',
  'make',
  'fix',
  'update',
  'configure',
  'execute',
  'deploy',
  'develop',
  'implement',
  'convert',
  'migrate',
  'export',
  'import',
  'rename',
] as const;
const OUTCOME_SIGNALS = [
  'achieve',
  'improve',
  'earn',
  'save',
  'reduce',
  'grow',
  'goal',
  'outcome',
  'promotion',
  'increase',
  'optimize',
  'get a job',
  'land a role',
  'raise',
  'become',
  'start a business',
  'generate income',
  'reduce cost',
  'get promoted',
] as const;

// ── Constraint signals (tightened: no "by the way" / bare-"budget" hits) ──
const DEADLINE_RE =
  /\b(?:by|before|due)\s+(?:(?:the\s+)?end of\s+)?(?:this|next|early|late)?\s*(?:week|month|year|quarter|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(?:st|nd|rd|th)?)|\bdeadline\b|\bby end of (?:this|next) (?:week|month)\b/i;
const BUDGET_RE =
  /\$\s?\d[\d,.]*|under \$|cost cap|spend limit|\bbudget\s+(?:of|under|is|around|about|at|for)?\s*\$?\s*\d/i;
const FREE_RE = /\bfree\b/i;
const PRIVACY_RE =
  /private|confidential|sensitive|personal data|do not share|sharing the data|share.{0,15}external/i;
const LOCAL_RE = /\blocal\b|locally|offline|on-device|self-host|without the cloud/i;

// ── Risk signals (irreversible / financial / external / destructive) ───────
const HIGH_RISK_SIGNALS = [
  'delete permanently',
  'wipe',
  'terminate',
  'cancel account',
  'refund',
  'transfer money',
  'send payment',
  'charge',
  'publish publicly',
  'deploy to production',
  'production database',
  'share externally',
] as const;
const MEDIUM_RISK_SIGNALS = [
  'send',
  'email',
  'post',
  'publish',
  'subscribe',
  'pay',
  'purchase',
  'replace',
  'modify existing',
  'overwrite',
  'production',
] as const;

// ── Approval requirement signals (align with capability-marketplace
//    IrreversibleAction vocabulary: publish / send / pay / delete / …) ──────
const APPROVAL_ACTIONS: Array<{ action: string; signals: string[] }> = [
  { action: 'publish', signals: ['publish', 'post publicly', 'make live', 'go live'] },
  {
    action: 'send',
    signals: ['send email', 'send message', 'email', 'send to', 'share externally'],
  },
  { action: 'pay', signals: ['pay', 'purchase', 'subscribe', 'charge', 'buy'] },
  {
    action: 'delete',
    signals: ['delete permanently', 'remove permanently', 'wipe', 'cancel account'],
  },
  {
    action: 'deploy',
    signals: ['deploy', 'production database', 'production server', 'release to users'],
  },
];

// ── Missing-information rules (minimum useful clarifications) ──────────────
function clarifyFor(text: string, intent: ProblemIntent): string[] {
  const out: string[] = [];
  if (/automate|script|build|configure|integrate|install/i.test(text)) {
    out.push('Access to the target system/files the task operates on');
  }
  if (/send|email|post|publish|share/i.test(text)) {
    out.push('Recipient or target destination details');
  }
  if (/earn|income|sell|price|pricing|charge|invoice/i.test(text)) {
    out.push('Market/budget evidence before any value or income claim');
  }
  if (intent === 'ACTION' && /(?:database|api|account|credential)/i.test(text)) {
    out.push('Required credentials/authorization for the external service');
  }
  return out;
}

function urgencyFrom(priority: GoalPriority): number {
  switch (priority) {
    case 'critical':
      return 0.95;
    case 'high':
      return 0.75;
    case 'medium':
      return 0.5;
    case 'low':
      return 0.3;
    case 'background':
      return 0.2;
    default:
      return 0.5;
  }
}

function intentRank(intent: ProblemIntent): number {
  switch (intent) {
    case 'OUTCOME':
      return 3;
    case 'ACTION':
      return 2;
    case 'ANSWER':
      return 1;
    default:
      return 0;
  }
}

export class ProblemUnderstandingService {
  private readonly understanding = new GoalUnderstandingService();

  /** Derive a typed ProblemDefinition from a raw problem statement. */
  understand(request: string, opts: { problemId?: string } = {}): ProblemDefinition {
    const originalRequest = request.trim();
    const normalizedProblem = originalRequest.replace(/\s+/g, ' ').trim();
    const text = normalizedProblem.toLowerCase();
    const provenance: string[] = [];

    // 1. Compose the EXISTING understanding pass (EI-006).
    const input: GoalInput = {
      title: normalizedProblem.slice(0, 80) || 'Untitled problem',
      description: normalizedProblem,
    };
    const analysis = this.understanding.analyze(input, opts.problemId ?? 'problem');
    provenance.push(
      `GoalUnderstandingService (EI-006): category=${analysis.category}, suggestedPriority=${analysis.suggestedPriority}`,
    );

    // 2. Intent — deterministic keyword scoring; OUTCOME > ACTION > ANSWER.
    let intent: ProblemIntent = 'UNKNOWN';
    let best = 0;
    const candidates: Array<[ProblemIntent, number]> = [
      ['ANSWER', ANSWER_SIGNALS.reduce((s, k) => (text.includes(k) ? s + 1 : s), 0)],
      ['ACTION', ACTION_SIGNALS.reduce((s, k) => (text.includes(k) ? s + 1 : s), 0)],
      ['OUTCOME', OUTCOME_SIGNALS.reduce((s, k) => (text.includes(k) ? s + 1 : s), 0)],
    ];
    for (const [kind, score] of candidates) {
      if (score > best) {
        best = score;
        intent = kind;
      } else if (score === best && score > 0 && intentRank(kind) > intentRank(intent)) {
        intent = kind;
      }
    }
    if (intent !== 'UNKNOWN')
      provenance.push(`Intent detected: ${intent} (${best} signal${best > 1 ? 's' : ''})`);
    else provenance.push('Intent not determinable from text — left UNKNOWN');

    // 2b. Earning-domain override (SPRINT-023 §11 — earning is a first-class
    //     outcome category): an OUTCOME intent with earning signals maps to
    //     the revenue domain even when the EI-006 category stayed generic.
    let domain = analysis.category === 'custom' ? 'general' : analysis.category;
    if (
      intent === 'OUTCOME' &&
      /earn|income|money|sell|side hustle|freelance|revenue|generate income/.test(text)
    ) {
      domain = 'revenue';
      provenance.push('Earning-domain override: OUTCOME intent with earning signals → revenue');
    }

    // 3. Desired outcome — conservative, templated from the request.
    const desiredOutcome =
      intent === 'ANSWER'
        ? `Understand: ${normalizedProblem}`
        : intent === 'ACTION'
          ? `Complete: ${normalizedProblem}`
          : intent === 'OUTCOME'
            ? `Achieve: ${normalizedProblem}`
            : `Clarify: ${normalizedProblem}`;
    provenance.push(`Desired outcome derived conservatively (intent=${intent})`);

    // 4. Constraints.
    const constraints: ProblemConstraint[] = [];
    const deadline = DEADLINE_RE.exec(text)?.[0];
    if (deadline) constraints.push({ kind: 'deadline', value: deadline.trim() });
    if (BUDGET_RE.test(text))
      constraints.push({ kind: 'budget', value: 'budget constraint detected' });
    if (FREE_RE.test(text)) constraints.push({ kind: 'free', value: 'free option requested' });
    if (PRIVACY_RE.test(text))
      constraints.push({ kind: 'privacy', value: 'privacy/confidentiality required' });
    if (LOCAL_RE.test(text)) constraints.push({ kind: 'local', value: 'local/offline preference' });
    if (constraints.length > 0)
      provenance.push(`Constraints detected: ${constraints.map((c) => c.kind).join(', ')}`);

    // 5. Urgency from the existing priority signals.
    const urgency = urgencyFrom(analysis.suggestedPriority);
    provenance.push(
      `Urgency derived from suggestedPriority=${analysis.suggestedPriority} (${urgency})`,
    );

    // 6. Required capabilities — from the existing capability hints.
    const requiredCapabilities: CapabilityType[] = [...analysis.capabilityHints];
    if (requiredCapabilities.length === 0) {
      provenance.push('No capability hints detected — requiredCapabilities left empty');
    }

    // 7. Risk estimate (labeled as an estimate).
    let riskLevel: RiskLevel = 'low';
    if (HIGH_RISK_SIGNALS.some((s) => text.includes(s))) riskLevel = 'high';
    else if (MEDIUM_RISK_SIGNALS.some((s) => text.includes(s))) riskLevel = 'medium';
    provenance.push(`Risk ESTIMATED as ${riskLevel} from text signals (not a security assessment)`);

    // 8. Approval requirements — from irreversible/financial/external signals.
    const approvalRequirements: ProblemApprovalRequirement[] = [];
    for (const rule of APPROVAL_ACTIONS) {
      const matched = rule.signals.find((s) => text.includes(s));
      if (matched) {
        approvalRequirements.push({
          action: rule.action,
          reason: `Request implies a ${rule.action} action ("${matched}") — approval required before execution.`,
        });
      }
    }
    if (approvalRequirements.length > 0) {
      provenance.push(
        `Approval requirements detected: ${approvalRequirements.map((a) => a.action).join(', ')}`,
      );
    } else {
      provenance.push(
        'No irreversible/financial/external signals — approval not required by the understanding pass',
      );
    }

    // 9. Success criteria — only when the text states them explicitly.
    const successCriteria = extractSuccessCriteria(text);
    if (successCriteria.length > 0) {
      provenance.push(`Explicit success criteria detected: ${successCriteria.length}`);
    }

    // 10. Missing information — the minimum useful clarifications (never fabricated).
    const missingInformation = clarifyFor(text, intent);
    if (intent === 'UNKNOWN')
      missingInformation.unshift('What you want VedMoulya to do (intent is ambiguous)');
    if (requiredCapabilities.length === 0)
      missingInformation.push('What outcome you expect (no capability signal in the request)');
    if (constraints.length === 0)
      missingInformation.push('Any deadline, budget, privacy or local requirements');
    if (successCriteria.length === 0)
      missingInformation.push('How success will be measured (no explicit criteria in the request)');
    if (missingInformation.length > 0) {
      provenance.push(
        `Missing information recorded honestly: ${missingInformation.length} item(s)`,
      );
    }

    // 11. Confidence — how much of the definition could be determined.
    let confidence = 0.35;
    if (intent !== 'UNKNOWN') confidence += 0.12;
    if (requiredCapabilities.length > 0) confidence += 0.12;
    if (constraints.length > 0) confidence += 0.08;
    if (analysis.category !== 'custom') confidence += 0.1;
    if (successCriteria.length > 0) confidence += 0.08;
    if (missingInformation.length === 0) confidence += 0.1;
    confidence = Math.min(0.95, Number(confidence.toFixed(2)));
    provenance.push(`Confidence computed deterministically: ${confidence}`);

    return {
      problemId: opts.problemId ?? 'problem',
      originalRequest,
      normalizedProblem,
      intent,
      domain,
      desiredOutcome,
      constraints,
      urgency: Number(urgency.toFixed(2)),
      requiredCapabilities,
      missingInformation,
      riskLevel,
      approvalRequirements,
      successCriteria,
      confidence,
      provenance,
    };
  }
}

/**
 * Extract explicit success-criteria clauses only (never inferred).
 * A clause counts ONLY when it is measurable/verifiable: it contains a
 * numeral/amount or a deliverable/verification noun — so "I must decide
 * between two options" or "at least try it" are NEVER mislabeled as
 * success criteria (SPRINT-023 §1/§7 honesty invariant).
 */
function extractSuccessCriteria(text: string): string[] {
  const criteria: string[] = [];
  const markers = [
    /\bmust\b[^.\n]{0,120}/i,
    /\b(?:needs?|has) to\b[^.\n]{0,120}/i,
    /\bdone when\b[^.\n]{0,120}/i,
    /\bcriteria\b[^.\n]{0,120}/i,
    /\bno more than\b[^.\n]{0,120}/i,
    /\bat least\b[^.\n]{0,120}/i,
    /\bunder \$[^.\n]{0,80}/i,
  ];
  const MEASURABLE =
    /\d|\$|usd|percent|%|minute|hour|day|week|month|test|pass|fail|verify|complete|file|report|exact|run|support|include|contain|return|produce/i;
  for (const marker of markers) {
    const m = marker.exec(text);
    if (m) {
      const clause = m[0].trim().replace(/[.,;]+$/, '');
      if (clause.length >= 8 && MEASURABLE.test(clause) && !criteria.includes(clause)) {
        criteria.push(clause);
      }
    }
  }
  return criteria.slice(0, 5);
}
