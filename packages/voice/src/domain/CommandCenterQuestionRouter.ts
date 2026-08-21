// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Voice · CommandCenterQuestionRouter (SPRINT-035)
//
// Deterministic phrase router: maps a transcript to ONE of the CLOSED
// presentation questions, or NO question. It is not an NLP engine — it is a
// bounded phrase table (same discipline as the VoiceIntentGate's keyword
// table). The answer comes from the EXISTING world read models through the
// CommandCenterPresentationPort; voice only presents.
//
// VOICE ≠ AUTHORIZATION is untouched: this router runs AFTER the sensitive-
// action gate in VoiceAssistantService, and the presentation path has no
// side effects — it can never authorize, spend or execute.
// ─────────────────────────────────────────────────────────────────────────────

import type { CommandCenterQuestion } from '../types/voice-types.js';

interface QuestionPattern {
  question: CommandCenterQuestion;
  /** Lower-cased phrases that trigger this question. */
  phrases: string[];
}

const PATTERNS: QuestionPattern[] = [
  {
    question: 'FOCUS_TODAY',
    phrases: [
      'what should i focus on today',
      'what should i focus on',
      'what do i need to focus on',
      'what is important today',
      'what is the priority today',
      'what matters most today',
      'what should i do today',
    ],
  },
  {
    question: 'OPPORTUNITIES',
    phrases: [
      'what opportunities',
      'what opportunities did vedmoulya find',
      'what opportunities do i have',
      'any opportunities',
      'what should i work on next',
      'what are my best opportunities',
    ],
  },
  {
    question: 'PENDING_APPROVALS',
    phrases: [
      'what needs my approval',
      'what requires approval',
      'what requires my approval',
      'what is waiting for approval',
      'pending approvals',
      'what do i need to approve',
      'what decisions need my approval',
    ],
  },
  {
    question: 'BEST_MARGIN',
    phrases: [
      'which business has the best verified margin',
      'which business has the best margin',
      'best margin',
      'most profitable business',
      'which business is most profitable',
      'which stream has the best margin',
    ],
  },
  {
    question: 'WHAT_CHANGED',
    phrases: [
      'what changed today',
      'what changed',
      'what happened today',
      'what is new',
      'anything new',
      'what changed since yesterday',
    ],
  },
  {
    question: 'WORKFLOW_COST',
    phrases: [
      'how much did this workflow cost',
      'how much did the workflow cost',
      'what did this cost',
      'how much does this cost',
      'what is the cost of the workflow',
      'how much did we spend',
    ],
  },
  // SPRINT-039 — founder evidence loop presentation (read-only).
  {
    question: 'STRONGEST_OPPORTUNITIES',
    phrases: [
      'what are my strongest opportunities',
      'strongest opportunities',
      'which opportunities are strongest',
      'most promising opportunities',
      'best opportunities',
    ],
  },
  {
    question: 'EVIDENCE',
    phrases: [
      'what evidence do we have',
      'what evidence is there',
      'what evidence do i have',
      'show me the evidence',
      'what do we actually know',
    ],
  },
  {
    question: 'NEXT_TEST',
    phrases: [
      'what should i test next',
      'what should we test next',
      'what experiment should i run next',
      'what should i validate next',
      'what is the next experiment',
    ],
  },
  {
    question: 'WHY_RECOMMENDATION',
    phrases: [
      'why are you recommending this',
      'why did you recommend this',
      'why this recommendation',
      'why do you recommend',
      'explain the recommendation',
    ],
  },
  {
    question: 'STRONGEST_PAYMENT',
    phrases: [
      'which opportunity has the strongest payment evidence',
      'strongest payment evidence',
      'which opportunity has verified revenue',
      'which opportunity has payments',
      'who has paid',
    ],
  },
  {
    question: 'STOP_OPPORTUNITIES',
    phrases: [
      'which opportunities should i stop',
      'which opportunities should we stop',
      'what should i stop',
      'which opportunities should be stopped',
      'what should we kill',
    ],
  },
];

/** Deterministic routing: the FIRST matching pattern wins (transcript
 *  normalized to lowercase + collapsed whitespace). Returns undefined when no
 *  question matches — the caller falls through to the existing answer path. */
export function routeCommandCenterQuestion(transcript: string): CommandCenterQuestion | undefined {
  const normalized = transcript.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const pattern of PATTERNS) {
    for (const phrase of pattern.phrases) {
      if (normalized.includes(phrase)) return pattern.question;
    }
  }
  return undefined;
}
