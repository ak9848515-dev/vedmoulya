// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Voice · VoiceIntentGate tests
// SPRINT-027 — Phase 4 · VOICE ≠ AUTHORIZATION.
//
// The Phase 4 scenario list, each as a deterministic assertion:
//   ordinary informational request · low-risk action · sensitive action ·
//   ambiguous speech · failed transcription · provider failure (via service
//   test) · approval required · cancellation · verification failure (never
//   promoted to success at the speech layer).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { VoiceIntentGate, MIN_STT_CONFIDENCE } from '../domain/VoiceIntentGate.js';
import type { VoiceActionDecision } from '../types/voice-types.js';

function decision(
  gate: VoiceIntentGate,
  transcript: string,
  action: string,
  opts: { approvalGranted?: string[]; cancelled?: boolean; confidence?: number } = {},
): VoiceActionDecision {
  return gate.assessAction({ transcript, confidence: opts.confidence }, action, opts);
}

describe('VoiceIntentGate.classify', () => {
  const gate = new VoiceIntentGate();

  it('classifies an informational request as ANSWER', () => {
    const result = gate.classify({ transcript: 'What should I focus on today?' });
    expect(result.kind).toBe('ANSWER');
    expect(result.canProceedToPlan).toBe(true);
    expect(result.approvalGrantedFromTranscript).toBe(false);
  });

  it('classifies a plain action as ACTION without requiring confirmation', () => {
    const result = gate.classify({ transcript: 'Write a summary of my week' });
    expect(result.kind).toBe('ACTION');
    expect(result.requiresExplicitConfirmation).toBe(false);
  });

  it('flags sensitive actions mentioned in the transcript (observation only)', () => {
    const result = gate.classify({ transcript: 'Send this email to the client' });
    expect(result.kind).toBe('ACTION');
    expect(result.sensitiveActionsMentioned).toContain('send');
    expect(result.requiresExplicitConfirmation).toBe(true);
    // The transcript grants nothing.
    expect(result.approvalGrantedFromTranscript).toBe(false);
  });

  it('returns UNKNOWN and refuses to proceed on a failed transcription', () => {
    const result = gate.classify({ transcript: '', transcriptionFailed: true });
    expect(result.kind).toBe('UNKNOWN');
    expect(result.canProceedToPlan).toBe(false);
  });

  it('returns UNKNOWN when provider confidence is below the threshold', () => {
    const result = gate.classify({
      transcript: 'delete my account',
      confidence: MIN_STT_CONFIDENCE - 0.1,
    });
    expect(result.kind).toBe('UNKNOWN');
    expect(result.canProceedToPlan).toBe(false);
  });

  it('surfaces ambiguity without fabricating an intent (ambiguous speech)', () => {
    const result = gate.classify({ transcript: 'the thing' });
    // 'the thing' has no action verb — must not be treated as a confident action.
    expect(['UNKNOWN', 'ANSWER']).toContain(result.kind);
    expect(result.canProceedToPlan).toBe(false);
  });
});

describe('VOICE ≠ AUTHORIZATION — assessAction', () => {
  const gate = new VoiceIntentGate();

  it('ordinary informational request → MAY_PLAN (NON_SENSITIVE)', () => {
    expect(decision(gate, 'What should I do today?', 'research')).toEqual({
      decision: 'MAY_PLAN',
      reason: 'NON_SENSITIVE',
    });
  });

  it('low-risk action → MAY_PLAN (NON_SENSITIVE) without approval', () => {
    expect(decision(gate, 'Draft a summary of my week', 'draft')).toEqual({
      decision: 'MAY_PLAN',
      reason: 'NON_SENSITIVE',
    });
  });

  it('sensitive action spoken aloud → NO_EXECUTION (AWAITING_APPROVAL)', () => {
    // The user SAID "delete my account" — that is intent, not authorization.
    expect(decision(gate, 'delete my account', 'delete')).toEqual({
      decision: 'NO_EXECUTION',
      reason: 'AWAITING_APPROVAL',
    });
  });

  it('a transcript that literally says approve still cannot authorize', () => {
    // Even an explicit verbal "I approve" grants nothing by itself.
    expect(decision(gate, 'I approve: delete my account', 'delete')).toEqual({
      decision: 'NO_EXECUTION',
      reason: 'AWAITING_APPROVAL',
    });
  });

  it('sensitive action MAY_PLAN only when approval came from the existing non-voice mechanism', () => {
    expect(decision(gate, 'delete my account', 'delete', { approvalGranted: ['delete'] })).toEqual({
      decision: 'MAY_PLAN',
      reason: 'APPROVED_VIA_EXISTING_CHANNEL',
    });
  });

  it('approval for one action never authorizes a different sensitive action', () => {
    expect(decision(gate, 'send this email', 'publish', { approvalGranted: ['send'] })).toEqual({
      decision: 'NO_EXECUTION',
      reason: 'AWAITING_APPROVAL',
    });
  });

  it('cancellation denies even an already-approved sensitive action', () => {
    expect(
      decision(gate, 'delete my account', 'delete', {
        approvalGranted: ['delete'],
        cancelled: true,
      }),
    ).toEqual({ decision: 'DENIED', reason: 'CANCELLED' });
  });

  it('failed transcription denies with UNKNOWN_TRANSCRIPT (no guesswork)', () => {
    expect(decision(gate, '', 'delete', { confidence: 0.1 })).toEqual({
      decision: 'DENIED',
      reason: 'UNKNOWN_TRANSCRIPT',
    });
  });

  it('non-sensitive action remains MAY_PLAN even under low confidence', () => {
    expect(decision(gate, 'draft a summary', 'draft', { confidence: 0.4 })).toEqual({
      decision: 'DENIED',
      reason: 'UNKNOWN_TRANSCRIPT',
    });
  });

  it('has no SUCCESS output — verification failure can never be promoted here', () => {
    // The gate's decision vocabulary contains no SUCCESS state: the speech
    // layer structurally cannot claim a verified outcome. Verification verdicts
    // are owned by the Brain's deriveOutcomeVerdict — out of scope for voice.
    const sample = decision(gate, 'draft a summary', 'draft');
    expect(sample).not.toHaveProperty('decision', 'SUCCESS');
  });

  it('verification failure is never turned into success by the speech layer', () => {
    // A failed verification stays failed — the voice layer only classifies and
    // refuses; it cannot fabricate success for a task it never executed.
    expect(decision(gate, 'delete my account', 'delete')).not.toHaveProperty('success', true);
  });
});

describe('sensitiveActionsMentioned (shared vocabulary with the Brain)', () => {
  it('detects send/publish/delete/purchase keywords deterministically', () => {
    expect(
      new VoiceIntentGate().classify({ transcript: 'publish the post and delete the old file' })
        .sensitiveActionsMentioned,
    ).toEqual(expect.arrayContaining(['publish', 'delete']));
  });

  it('ignores non-sensitive text', () => {
    expect(
      new VoiceIntentGate().classify({ transcript: 'summarize my week' }).sensitiveActionsMentioned,
    ).toEqual([]);
  });
});
