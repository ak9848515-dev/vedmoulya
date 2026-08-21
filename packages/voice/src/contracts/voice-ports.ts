// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Voice · Contracts
// SPRINT-027 — Speech capability foundation.
//
// The ONLY narrow seams voice may cross. Everything above these ports is
// provider-agnostic: business/UI code never imports a speech SDK, never holds
// an API key, and never runs provider-specific logic. Adapters implement
// these ports and register their capability honestly (MOCK vs REAL).
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Conversation,
  ConversationTurn,
  SpeechToTextResult,
  TextToSpeechResult,
} from '../types/voice-types.js';

/** Owner-scoped, cancellation-aware speech-to-text seam. */
export interface SpeechToTextPort {
  /** Stable adapter id (e.g. 'mock-stt', 'deepgram-stt'). */
  readonly id: string;
  /** MOCK = deterministic hermetic adapter (dev/test only by default);
   *  REAL = a live provider adapter (operator configured). */
  readonly kind: 'MOCK' | 'REAL';
  /** Capability this adapter serves (catalog vocabulary). */
  readonly capability: 'SPEECH_TO_TEXT';
  transcribe(input: {
    /** Owner of the audio — the adapter must never persist or share it. */
    ownerId: string;
    audio: { format: string; data: Uint8Array };
    /** Cancellation handle (barge-in / stop). Optional where unsupported. */
    signal?: AbortSignal;
  }): Promise<SpeechToTextResult>;
}

/** Owner-scoped, cancellation-aware text-to-speech seam. */
export interface TextToSpeechPort {
  readonly id: string;
  readonly kind: 'MOCK' | 'REAL';
  readonly capability: 'TEXT_TO_SPEECH';
  synthesize(input: {
    ownerId: string;
    text: string;
    voice?: string;
    signal?: AbortSignal;
  }): Promise<TextToSpeechResult>;
}

/** Owner-scoped conversation store — the interaction artifact seam.
 *  NOT a memory engine: it stores transcripts only, and the voice package
 *  deliberately exposes no path that promotes conversation text into user
 *  facts, preferences, outcome memory, learning or digital-twin data. */
export interface ConversationStore {
  create(userId: string, title?: string): Conversation;
  get(userId: string, conversationId: string): Conversation | undefined;
  list(userId: string): Conversation[];
  /** Append a turn (bounded by the conversation policy). Returns the turn. */
  append(
    userId: string,
    conversationId: string,
    turn: { role: 'user' | 'assistant'; text: string; createdAt: string },
  ): ConversationTurn | undefined;
  /** Most recent turns, newest last, bounded by the policy cap. */
  turns(userId: string, conversationId: string, limit?: number): ConversationTurn[];
  clear(userId: string, conversationId: string): void;
}
