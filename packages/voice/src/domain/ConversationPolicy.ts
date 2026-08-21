// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Voice · ConversationPolicy
// SPRINT-027 — Phase 5 · bounded conversation foundation.
//
// Bounds + retention for the owner-scoped conversation store. A conversation
// is an INTERACTION ARTIFACT — bounded by design, never unbounded history,
// and structurally unable to feed user-fact/preference/learning stores (the
// voice package exposes no promotion path; see ConversationPolicy.noPromotion
// below which is asserted by tests).
// ─────────────────────────────────────────────────────────────────────────────

/** Max conversations retained per owner (FIFO by updatedAt). */
export const MAX_CONVERSATIONS_PER_OWNER = 20;
/** Max turns per conversation (oldest turns evicted first). */
export const MAX_TURNS_PER_CONVERSATION = 200;
/** Max characters per turn (input bound for TTS + transcript sanity). */
export const MAX_TURN_TEXT_LENGTH = 4000;
/** Max audio payload accepted by the STT seam (bytes). */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
/** Max characters synthesized by the TTS seam. */
export const MAX_SYNTHESIS_TEXT_LENGTH = 2000;
/** Max turns returned by a single read. */
export const MAX_TURNS_RETURNED = 100;

/** Truncate a turn to the policy bound (never throws on oversized input). */
export function truncateText(text: string, max = MAX_TURN_TEXT_LENGTH): string {
  return text.length > max ? text.slice(0, max) : text;
}

/** True when the conversation is at the turn cap. */
export function atTurnCap(turnCount: number, max = MAX_TURNS_PER_CONVERSATION): boolean {
  return turnCount >= max;
}

/** Structural anti-pollution rule (asserted by tests): conversation text must
 *  never be promoted into user facts, preferences, outcome memory or learning.
 *  The voice package intentionally ships NO method that writes conversation
 *  text to any of those stores — this constant documents the contract and
 *  the test suite enforces it by inspecting the public service surface. */
export const CONVERSATION_PROMOTION_FORBIDDEN = true as const;
