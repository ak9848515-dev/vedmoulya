// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Voice · VoiceIntentGate
// SPRINT-027 — Phase 4 · VOICE ≠ AUTHORIZATION.
//
// The single deterministic rule the voice layer enforces:
//   • a voice transcript can EXPRESS intent (classification);
//   • a voice transcript can NEVER GRANT APPROVAL (authorization);
//   • sensitive/irreversible actions require explicit confirmation through
//     the EXISTING approval mechanism (non-voice: on-screen tap / PIN),
//     and even then execution flows through the Brain's own approval gate.
//
// No new approval engine: this gate only classifies + refuses. It reuses the
// Brain's deterministic IntentInterpreter (same NLP dictionaries — no new
// NLP engine) and the Brain's SENSITIVE_ACTIONS vocabulary (same authority
// list — no second list that could drift).
// ─────────────────────────────────────────────────────────────────────────────

import { IntentInterpreter, SENSITIVE_ACTIONS } from '@vedmoulya/brain';
import type { SpeechIntentAssessment, VoiceActionDecision } from '../types/voice-types.js';

/** Below this confidence a transcript is treated as failed (honest UNKNOWN —
 *  never acted upon). */
export const MIN_STT_CONFIDENCE = 0.5;

export interface VoiceIntentInput {
  transcript: string;
  /** True when the STT adapter reported a failure (throw / empty / abort). */
  transcriptionFailed?: boolean;
  /** Provider confidence in [0, 1]; below MIN_STT_CONFIDENCE → UNKNOWN. */
  confidence?: number;
}

export interface AssessOptions {
  /** Sensitive-action vocabulary — defaults to the Brain's SENSITIVE_ACTIONS
   *  (the SAME authority list the BrainPolicyEngine enforces). */
  sensitiveActions?: readonly string[];
  /** Approvals already granted through the EXISTING non-voice approval
   *  mechanism. NEVER derived from the transcript. */
  approvalGranted?: readonly string[];
  /** True when the voice session was cancelled before this assessment. */
  cancelled?: boolean;
}

const SENSITIVE_KEYWORDS: Readonly<Record<string, string[]>> = {
  publish: ['publish', 'post', 'release', 'go live', 'launch to'],
  send: ['send', 'email', 'message', 'submit to', 'deliver to'],
  deploy: ['deploy', 'ship', 'production', 'push to prod'],
  purchase: ['purchase', 'buy', 'pay', 'subscription', 'upgrade to paid'],
  subscribe: ['subscribe', 'sign up for paid'],
  delete: ['delete', 'remove permanently', 'destroy'],
  share: ['share publicly', 'share externally', 'make public'],
  install: ['install', 'install software'],
  connect_account: ['connect account', 'link account', 'authorize account'],
};

/** Deterministic keyword observation: which SENSITIVE_ACTIONS the transcript
 *  mentions. Observation only — grants nothing. */
export function sensitiveActionsMentioned(
  transcript: string,
  sensitiveActions: readonly string[] = SENSITIVE_ACTIONS,
): string[] {
  const lower = transcript.toLowerCase();
  const found: string[] = [];
  for (const action of sensitiveActions) {
    // eslint-disable-next-line security/detect-object-injection -- closed constant record keyed by the SENSITIVE_ACTIONS union.
    const keywords = SENSITIVE_KEYWORDS[action];
    if (keywords && keywords.some((k) => lower.includes(k))) {
      found.push(action);
    }
  }
  return found;
}

/**
 * Classify a transcript into a speech intent. Reuses the Brain's
 * IntentInterpreter for action/domain detection — zero new NLP.
 */
export class VoiceIntentGate {
  private readonly interpreter = new IntentInterpreter();

  classify(input: VoiceIntentInput): SpeechIntentAssessment {
    const transcript = input.transcript;
    const failed =
      input.transcriptionFailed === true || (input.confidence ?? 1) < MIN_STT_CONFIDENCE;

    if (failed || transcript.trim().length === 0) {
      return {
        kind: 'UNKNOWN',
        objective: '',
        sensitiveActionsMentioned: [],
        approvalGrantedFromTranscript: false,
        requiresExplicitConfirmation: false,
        ambiguities: ['Transcription failed or is too unclear to act on — UNKNOWN stays UNKNOWN.'],
        canProceedToPlan: false,
      };
    }

    const profile = this.interpreter.interpret(transcript);
    const mentioned = sensitiveActionsMentioned(transcript);
    const needsClarification = this.interpreter.needsClarification(profile);
    // The Brain's interpreter falls back to the raw input when no action verb
    // was detected — a normalized objective that differs from the input means
    // an ACTION intent was pinned down. Never duplicated: this is the SAME
    // deterministic interpreter the Brain uses.
    const hasActionVerb = profile.objective.trim() !== transcript.trim();
    // An informational question with no action verb is an ANSWER intent
    // (proceed through the existing ai.* Q&A runtime), not an UNKNOWN — an
    // unanswered question is a legitimate conversational request.
    const looksLikeQuestion =
      transcript.trim().endsWith('?') ||
      /^(what|how|when|why|which|where|who|is|are|can|could|would|should|do|does|did)\b/i.test(
        transcript.trim(),
      ) ||
      /^tell me\b/i.test(transcript.trim());
    const kind: SpeechIntentAssessment['kind'] =
      mentioned.length > 0
        ? 'ACTION'
        : hasActionVerb && !needsClarification
          ? 'ACTION'
          : needsClarification && looksLikeQuestion
            ? 'ANSWER'
            : needsClarification
              ? 'UNKNOWN'
              : 'ANSWER';

    return {
      kind,
      objective: profile.objective,
      domain: profile.domain,
      sensitiveActionsMentioned: mentioned,
      approvalGrantedFromTranscript: false,
      requiresExplicitConfirmation: mentioned.length > 0,
      ambiguities: profile.ambiguities,
      // The early return above already guarantees the transcript is usable
      // (not failed, non-empty) — remaining gate is clarification only.
      canProceedToPlan: !needsClarification || looksLikeQuestion,
    };
  }

  /**
   * The VOICE ≠ AUTHORIZATION decision for one proposed action.
   *
   * Ordering is fail-closed:
   *   1. cancelled            → DENIED (CANCELLED)
   *   2. failed/unknown text  → DENIED (UNKNOWN_TRANSCRIPT)
   *   3. sensitive action     → NO_EXECUTION (AWAITING_APPROVAL) UNLESS
   *                             approval was granted through the existing
   *                             NON-VOICE mechanism (then MAY_PLAN — the
   *                             Brain's own checkAction still gates execution).
   *   4. non-sensitive action → MAY_PLAN (NON_SENSITIVE) — the Brain pipeline
   *                             (budget + verify) still applies unchanged.
   *
   * The transcript is NEVER a source of approval: `approvalGranted` must come
   * from the caller's existing approval mechanism (gateway-approved gesture /
   * PIN recorded in the decision store), not from this input.
   */
  assessAction(
    input: VoiceIntentInput,
    action: string,
    opts: AssessOptions = {},
  ): VoiceActionDecision {
    if (opts.cancelled === true) {
      return { decision: 'DENIED', reason: 'CANCELLED' };
    }
    const failed =
      input.transcriptionFailed === true ||
      (input.confidence ?? 1) < MIN_STT_CONFIDENCE ||
      input.transcript.trim().length === 0;
    if (failed) {
      return { decision: 'DENIED', reason: 'UNKNOWN_TRANSCRIPT' };
    }

    const sensitiveActions = opts.sensitiveActions ?? SENSITIVE_ACTIONS;
    const isSensitive = sensitiveActions.includes(action);

    if (isSensitive) {
      const granted = (opts.approvalGranted ?? []).includes(action);
      if (granted) {
        return { decision: 'MAY_PLAN', reason: 'APPROVED_VIA_EXISTING_CHANNEL' };
      }
      return { decision: 'NO_EXECUTION', reason: 'AWAITING_APPROVAL' };
    }

    return { decision: 'MAY_PLAN', reason: 'NON_SENSITIVE' };
  }
}
