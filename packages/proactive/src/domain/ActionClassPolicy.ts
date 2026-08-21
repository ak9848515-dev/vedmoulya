// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Proactive Intelligence · ActionClassPolicy
// SPRINT-029 — Phase 5 · Authorization classification (A/B/C/D).
//
// NOT a new authorization authority: this policy CLASSIFIES a candidate action
// into A/B/C/D by composing the frozen estate — the Brain's SENSITIVE_ACTIONS
// vocabulary (the same authority the VoiceIntentGate and BrainPolicyEngine
// use) and the capability marketplace's irreversible-action vocabulary. The
// actual approval decision always belongs to the existing approval authority;
// this policy only says whether a recommendation may even be proposed and what
// class of authorization it would need.
//
//   A — safe analysis/drafting/classification
//   B — user-authorized recurring automation
//   C — approval required (sensitive / irreversible / external side effects)
//   D — never automate (prohibited or unsafe)
//
// Silence is NOT approval. A transcript is NOT authorization. An AI plan is
// NOT authorization. Only the existing approval mechanism approves.
// ─────────────────────────────────────────────────────────────────────────────

import { SENSITIVE_ACTIONS } from '@vedmoulya/brain';
import type { ActionClass } from '../types/proactive-types.js';

/** Actions that are never automated regardless of user intent. */
const NEVER_AUTOMATE: ReadonlyArray<string> = [
  'delete-account',
  'prohibited',
  'unsafe',
  'impersonate',
  'bypass-security',
  'grant-self-permission',
];

/** Safe analysis/drafting verbs — class A candidates. */
const SAFE_VERBS: ReadonlyArray<string> = [
  'summarize',
  'summarise',
  'classify',
  'analyze',
  'analyse',
  'draft',
  'research',
  'extract',
  'transcribe',
];

export interface ActionClassDecision {
  actionClass: ActionClass;
  reasons: string[];
  /** Which frozen authority informed the decision. */
  authority:
    'SENSITIVE_ACTIONS' | 'IRREVERSIBLE_ACTIONS' | 'SAFE_VERBS' | 'NEVER_AUTOMATE' | 'DEFAULT';
}

/**
 * Deterministic A/B/C/D classification. The action string is matched against
 * the frozen vocabularies — no new NLP, no new security logic.
 */
export class ActionClassPolicy {
  /** Sensitive actions from the Brain (same authority as VoiceIntentGate). */
  private readonly sensitiveActions: ReadonlyArray<string>;

  constructor(sensitiveActions: ReadonlyArray<string> = SENSITIVE_ACTIONS) {
    this.sensitiveActions = sensitiveActions;
  }

  classify(action: string, opts?: { recurring?: boolean }): ActionClassDecision {
    const normalized = action.trim().toLowerCase();
    if (normalized.length === 0) {
      return {
        actionClass: 'D',
        reasons: ['An empty action is never automated.'],
        authority: 'DEFAULT',
      };
    }

    // D — never automate, regardless of anything.
    for (const prohibited of NEVER_AUTOMATE) {
      if (normalized.includes(prohibited)) {
        return {
          actionClass: 'D',
          reasons: [`"${action}" is on the never-automate list.`],
          authority: 'NEVER_AUTOMATE',
        };
      }
    }

    // C — sensitive actions require the existing approval authority.
    for (const sensitive of this.sensitiveActions) {
      if (normalized.includes(sensitive.toLowerCase())) {
        return {
          actionClass: 'C',
          reasons: [
            `"${action}" matches the sensitive-action vocabulary (${sensitive}) — the existing approval authority must approve each run.`,
          ],
          authority: 'SENSITIVE_ACTIONS',
        };
      }
    }

    // A — safe verbs with no side effects.
    for (const verb of SAFE_VERBS) {
      if (normalized.startsWith(verb) || normalized.includes(` ${verb} `)) {
        return {
          actionClass: 'A',
          reasons: [`"${action}" is a safe analysis/drafting verb (${verb}).`],
          authority: 'SAFE_VERBS',
        };
      }
    }

    // B — recurring user-authorized automation for anything else the user
    // explicitly authorized. Recurring intent is not required for B, but a
    // recurring flag reinforces it.
    if (opts?.recurring) {
      return {
        actionClass: 'B',
        reasons: ['The user requested recurring execution and the action is not sensitive.'],
        authority: 'DEFAULT',
      };
    }

    // Default: B (user-authorized automation) — never A without the safe-verb
    // evidence, never C without a sensitive match. The user still must
    // explicitly authorize; nothing runs on proposal alone.
    return {
      actionClass: 'B',
      reasons: ['The action is not sensitive and may run only under explicit user authorization.'],
      authority: 'DEFAULT',
    };
  }

  /** Whether a class may be proposed by the proactive layer at all. */
  proposable(actionClass: ActionClass): boolean {
    return actionClass === 'A' || actionClass === 'B' || actionClass === 'C';
  }
}
