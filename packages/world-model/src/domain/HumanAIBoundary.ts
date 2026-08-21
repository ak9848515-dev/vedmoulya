// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · HumanAIBoundary
// SPRINT-032 — human vs AI responsibility boundaries.
//
// AI may: research · analyze · draft · classify · recommend · prepare ·
// test · simulate · execute approved low-risk tasks.
// Human remains authoritative for: sensitive decisions · financial
// commitments · legal commitments · account ownership · irreversible
// actions · high-impact decisions · business creation · external
// publication where policy requires approval.
//
// The classification composes the EXISTING ActionClassPolicy (A/B/C/D over
// the frozen SENSITIVE_ACTIONS + irreversible-action vocabulary) — this
// boundary only LABELS the classes; it never grants or denies anything.
// Silence/voice/AI-plans are never approval. Never silently increase
// autonomy.
// ─────────────────────────────────────────────────────────────────────────────

import type { BoundaryDecision, ResponsibilityClass } from '../types/world-types.js';
import type { WorldActionPort } from '../contracts/world-ports.js';

/** Domains where the HUMAN remains authoritative regardless of AI output.
 *  These are labels over the frozen authority — they add no new policy. */
export const HUMAN_AUTHORITATIVE_DOMAINS: ReadonlyArray<{
  label: string;
  keywords: string[];
}> = [
  {
    label: 'financial commitment',
    keywords: ['pay', 'purchase', 'spend', 'charge', 'invoice', 'refund'],
  },
  { label: 'legal commitment', keywords: ['contract', 'sign', 'legal', 'agree'] },
  { label: 'account ownership', keywords: ['account', 'ownership', 'credential', 'password'] },
  { label: 'irreversible action', keywords: ['delete', 'terminate', 'irreversible', 'permanent'] },
  {
    label: 'business creation',
    keywords: ['register business', 'incorporate', 'launch business', 'company registration'],
  },
  {
    label: 'external publication',
    keywords: ['publish', 'post', 'send', 'email external', 'public'],
  },
  { label: 'high-impact decision', keywords: ['hire', 'fire', 'approve loan', 'approve budget'] },
];

export class HumanAIBoundary {
  private readonly action: WorldActionPort;

  constructor(action: WorldActionPort) {
    this.action = action;
  }

  classify(action: string): BoundaryDecision {
    const decision = this.action.classify(action);
    let responsibilityClass: ResponsibilityClass;
    switch (decision.actionClass) {
      case 'A':
        responsibilityClass = 'AI_ALLOWED';
        break;
      case 'B':
        responsibilityClass = 'AI_ALLOWED';
        break;
      case 'C':
        responsibilityClass = 'APPROVAL_REQUIRED';
        break;
      case 'D':
        responsibilityClass = 'HUMAN_REQUIRED';
        break;
    }
    const humanDomains = HUMAN_AUTHORITATIVE_DOMAINS.filter((domain) =>
      domain.keywords.some((keyword) => action.toLowerCase().includes(keyword)),
    ).map((domain) => domain.label);

    const reasons: string[] = [...decision.reasons];
    if (responsibilityClass === 'APPROVAL_REQUIRED') {
      reasons.push(
        'Approval must come from the existing approval authority — an AI output, voice or silence is never approval.',
      );
    }
    if (responsibilityClass === 'HUMAN_REQUIRED') {
      reasons.push('This action stays with a human — it is never automated.');
    }
    if (humanDomains.length > 0) {
      reasons.push(`Human-authoritative domain(s): ${humanDomains.join(', ')}.`);
    }
    return {
      action,
      responsibilityClass,
      actionClass: decision.actionClass,
      reasons,
      authority: decision.authority,
    };
  }
}
