// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Voice · Types
// SPRINT-027 — Speech capability foundation.
//
// Types only. No behavior, no provider logic, no authorization logic.
// ─────────────────────────────────────────────────────────────────────────────

/** Honest speech capability status (mirrors the provider-runtime honesty rule:
 *  a capability is never claimed CONFIGURED unless a real adapter backs it and
 *  the backing provider is actually available and healthy).
 *   - CONFIGURED    — a REAL adapter is wired AND the backing provider is
 *                     available/healthy (probed live).
 *   - MOCK          — only a deterministic mock backs the capability.
 *   - UNAVAILABLE   — a REAL adapter is wired but no backing provider is
 *                     currently registered/available (honest — never CONFIGURED).
 *   - ERROR         — the availability probe itself failed (adapter present,
 *                     health unknown).
 *   - NOT_CONFIGURED — no adapter at all. */
export type SpeechCapabilityStatusValue =
  'CONFIGURED' | 'MOCK' | 'UNAVAILABLE' | 'ERROR' | 'NOT_CONFIGURED';

/** Aggregate speech status for the gateway + UI (never fabricated). */
export interface SpeechCapabilityStatus {
  /** Speech-to-text adapter status. */
  stt: SpeechCapabilityStatusValue;
  /** Text-to-speech adapter status. */
  tts: SpeechCapabilityStatusValue;
  /** ids of the adapters backing the status (empty when none configured). */
  adapters: Array<{
    id: string;
    kind: 'MOCK' | 'REAL';
    capability: 'SPEECH_TO_TEXT' | 'TEXT_TO_SPEECH';
  }>;
  /** True when real (non-mock) adapters are registered. */
  realSpeechAvailable: boolean;
}

/** Result of one speech-to-text call (port contract). */
export interface SpeechToTextResult {
  /** Transcribed text. Empty when the provider aborted. */
  text: string;
  /** Detected locale (provider-dependent; undefined = not reported). */
  locale?: string;
  /** Provider confidence in [0, 1]. */
  confidence: number;
  /** True when the call was cancelled via the abort signal. */
  aborted?: boolean;
}

/** Result of one text-to-speech call (port contract). */
export interface TextToSpeechResult {
  /** Encoded audio payload (format-dependent, e.g. WAV). */
  audio: Uint8Array;
  /** MIME type of the audio payload. */
  format: string;
  /** True when the call was cancelled via the abort signal. */
  aborted?: boolean;
}

/** A single conversation turn (an interaction artifact — never a user fact,
 *  never a preference, never learning). */
export interface ConversationTurn {
  id: string;
  userId: string;
  conversationId: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
}

/** An owner-scoped conversation with bounded history. Distinct from outcome
 *  memory, preferences, inferred learning and the digital twin by design:
 *  the voice package exposes NO promotion path from conversation text to any
 *  of those stores. */
export interface Conversation {
  id: string;
  userId: string;
  title: string;
  turns: ConversationTurn[];
  createdAt: string;
  updatedAt: string;
}

/** Deterministic speech-intent classification (reuses the Brain's own
 *  IntentInterpreter — no new NLP engine). */
export type SpeechIntentKind = 'ANSWER' | 'ACTION' | 'UNKNOWN';

export interface SpeechIntentAssessment {
  kind: SpeechIntentKind;
  /** Normalized objective when an action verb was detected. */
  objective: string;
  /** Domain hint from the Brain's intent dictionaries. */
  domain?: string;
  /** Sensitive-action keywords present in the transcript. This is an
   *  OBSERVATION ONLY — it grants nothing. */
  sensitiveActionsMentioned: string[];
  /** Deterministic truth: a transcript can never carry approval. */
  approvalGrantedFromTranscript: false;
  /** True when a sensitive action is mentioned — explicit non-voice
   *  confirmation is mandatory before any execution. */
  requiresExplicitConfirmation: boolean;
  /** Material ambiguities surfaced by the Brain interpreter. */
  ambiguities: string[];
  /** False when the transcript failed / is too unclear to act on. */
  canProceedToPlan: boolean;
}

/** The VOICE ≠ AUTHORIZATION decision for one proposed action. */
export type VoiceActionDecision =
  | { decision: 'DENIED'; reason: 'VOICE_CANNOT_AUTHORIZE' | 'UNKNOWN_TRANSCRIPT' | 'CANCELLED' }
  | { decision: 'NO_EXECUTION'; reason: 'AWAITING_APPROVAL' }
  | { decision: 'MAY_PLAN'; reason: 'NON_SENSITIVE' }
  | { decision: 'MAY_PLAN'; reason: 'APPROVED_VIA_EXISTING_CHANNEL' };

// ── SPRINT-028 — Voice Assistant turn result ──────────────────────
// The single normalized outcome of one spoken turn. The UI maps the
// `state` directly onto its voice states (IDLE / LISTENING /
// TRANSCRIBING / THINKING / WAITING_FOR_APPROVAL / RESPONDING /
// SPEAKING / ERROR / CANCELLED). The Brain remains the orchestrator:
// this result is a translation of the existing pipeline's verdicts, never
// a new decision authority.

export type VoiceTurnState =
  | 'RESPONDING' // a response is ready (spoken + textual when TTS works)
  | 'WAITING_FOR_APPROVAL' // sensitive action — non-voice confirmation required
  | 'CANCELLED'
  | 'ERROR';

export interface VoiceTurnResult {
  /** The UI state the turn finished in (never fabricated). */
  state: VoiceTurnState;
  /** Transcribed user utterance (always shown — voice is never the only output). */
  transcript: string;
  /** The assistant's plain-text response (always present — TTS is additive). */
  text: string;
  /** Synthesized audio when TTS succeeded (absent when it failed — the text
   *  response stands; a TTS failure is NEVER a task failure). */
  audio?: { data: Uint8Array; format: string };
  /** True when TTS was attempted but failed (honest — never silently absent). */
  ttsFailed?: boolean;
  /** The conversation this turn belongs to (auto-created when none given). */
  conversationId: string;
  /** The Brain task created for an ACTION intent (existing pipeline). */
  taskId?: string;
  /** The Brain task stage after planning (existing pipeline stage). */
  taskStage?: string;
  /** Sensitive actions the transcript mentioned — observation only, grants nothing. */
  sensitiveActionsMentioned?: string[];
  /** Error details for the ERROR state (plain-language, no raw provider leak). */
  error?: string;
  code?: string;
}

/** Narrow port the voice assistant composes for the EXISTING Brain pipeline
 *  (createTask → plan → approve/reject). Implemented in the gateway over the
 *  real BrainApplicationService — never duplicated inside the voice package.
 *  The approve/reject methods are the ONLY authorization surface the voice
 *  layer may reach, and they are invoked exclusively from the non-voice
 *  confirmation procedure (VOICE ≠ AUTHORIZATION). */
export interface BrainTaskPort {
  createTask(
    userId: string,
    input: string,
  ): {
    success: boolean;
    data?: { id: string; objective: string; status: string; stage: string };
    error?: string;
    code?: string;
  };
  plan?(
    userId: string,
    taskId: string,
  ): Promise<{
    success: boolean;
    data?: { id: string; status: string; stage: string; approvalRequired?: string[] };
    error?: string;
    code?: string;
  }>;
  /** EXISTING approval authority — approve a sensitive action. Voice itself
   *  can never call this; only the non-voice confirmation path may. */
  approve?(
    userId: string,
    taskId: string,
    action: string,
  ): {
    success: boolean;
    data?: { id: string; objective: string; status: string; stage: string };
    error?: string;
    code?: string;
  };
  /** EXISTING approval authority — reject a sensitive action (non-voice). */
  reject?(
    userId: string,
    taskId: string,
    action: string,
  ): {
    success: boolean;
    data?: { id: string; objective: string; status: string; stage: string };
    error?: string;
    code?: string;
  };
}

/** Narrow port for the EXISTING AI Q&A runtime (ai.stream) — ANSWER intents
 *  reuse the same runtime the text companion uses; voice only translates the
 *  modality (audio → prompt). Implemented in the gateway. */
export interface VoiceAnswerPort {
  ask(input: {
    userId: string;
    prompt: string;
    signal?: AbortSignal;
  }): Promise<{ ok: boolean; content?: string; error?: string }>;
}

/** Uniform result shape for the voice application service. */
export interface SpeechServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// ── SPRINT-035 — Command Center PRESENTATION (VOICE ≠ AUTHORIZATION) ────────
// Voice may OBSERVE / READ / EXPLAIN / SUMMARIZE the Command Center read
// models. It can NEVER authorize, approve, spend or execute a sensitive
// action. The questions are a CLOSED deterministic set — no new NLP, no new
// voice intelligence: the router maps a transcript to a question key by
// phrase matching, and the port (implemented in the gateway over the EXISTING
// world read models) answers with presentation-only text.

export type CommandCenterQuestion =
  | 'FOCUS_TODAY'
  | 'OPPORTUNITIES'
  | 'PENDING_APPROVALS'
  | 'BEST_MARGIN'
  | 'WHAT_CHANGED'
  | 'WORKFLOW_COST'
  // SPRINT-039 — founder evidence loop presentation (read-only)
  | 'STRONGEST_OPPORTUNITIES'
  | 'EVIDENCE'
  | 'NEXT_TEST'
  | 'WHY_RECOMMENDATION'
  | 'STRONGEST_PAYMENT'
  | 'STOP_OPPORTUNITIES';

/** Read-only presentation port — implemented in the gateway over the world
 *  model (commandCenter / founderBriefing / pipeline / revenueRanking /
 *  blueprint approvals). It returns text ONLY; it has no side effects. */
export interface CommandCenterPresentationPort {
  /** Ask ONE presentation question. `ok:false` → the assistant falls back to
   *  the existing AI Q&A runtime (never a fake answer). */
  ask(input: {
    userId: string;
    question: CommandCenterQuestion;
  }): Promise<{ ok: boolean; content?: string; error?: string }>;
}
