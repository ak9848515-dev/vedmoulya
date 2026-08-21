// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Voice · VoiceAssistantService
// SPRINT-028 — the voice-assistant composition layer.
//
// THIS IS THE VOICE → BRAIN BRIDGE. It translates one spoken turn into the
// existing Brain pipeline — it never plans, executes, verifies, approves,
// budgets or learns:
//
//   USER SPEAKS → STT → IntentInterpreter (Brain) → Brain/AI answer → TTS
//                     └→ sensitive? → WAITING_FOR_APPROVAL (non-voice only)
//
//   • ANSWER intents reuse the EXISTING AI Q&A runtime (the same runtime the
//     text companion uses) through the narrow VoiceAnswerPort.
//   • ACTION intents become EXISTING Brain tasks through the narrow
//     BrainTaskPort (createTask → plan). No voice-specific decision logic.
//   • VOICE ≠ AUTHORIZATION: a transcript that mentions a sensitive action
//     NEVER executes. The turn ends WAITING_FOR_APPROVAL and the ONLY path
//     forward is an explicit non-voice confirmation through the existing
//     approval mechanism (the gateway `confirmSensitive` procedure calls the
//     Brain's approve() — never anything voice-specific).
//   • Conversation turns are stored as interaction artifacts in the
//     owner-scoped conversation store. NOTHING is promoted into user facts,
//     preferences, outcomes, digital-twin beliefs or learning signals — the
//     voice package exposes no promotion path (same rule as SPRINT-027).
//   • Honest results: `state: 'RESPONDING'` only after the Brain/AI answered
//     and (best-effort) TTS ran; a TTS failure is NOT a task failure (the
//     text response stands); execution failures are never reported as
//     success — the existing outcome/verdict semantics are untouched.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ConversationStore,
  SpeechToTextPort,
  TextToSpeechPort,
} from '../contracts/voice-ports.js';
import { VoiceIntentGate } from '../domain/VoiceIntentGate.js';
import { routeCommandCenterQuestion } from '../domain/CommandCenterQuestionRouter.js';
import {
  MAX_AUDIO_BYTES,
  MAX_SYNTHESIS_TEXT_LENGTH,
  MAX_TURNS_PER_CONVERSATION,
  MAX_TURNS_RETURNED,
} from '../domain/ConversationPolicy.js';
import type {
  BrainTaskPort,
  CommandCenterPresentationPort,
  Conversation,
  ConversationTurn,
  SpeechServiceResult,
  VoiceAnswerPort,
  VoiceTurnResult,
  VoiceTurnState,
} from '../types/voice-types.js';

function err<T>(error: string, code?: string): SpeechServiceResult<T> {
  return { success: false, error, code };
}
function ok<T>(data: T): SpeechServiceResult<T> {
  return { success: true, data };
}

export interface VoiceAssistantServiceOptions {
  stt: SpeechToTextPort;
  tts: TextToSpeechPort;
  conversations: ConversationStore;
  /** EXISTING Brain pipeline (createTask → plan → approve). Implemented in
   *  the gateway over the real BrainApplicationService — never duplicated. */
  brain: BrainTaskPort;
  /** EXISTING AI Q&A runtime (ANSWER intents) — the same runtime the text
   *  companion uses, implemented in the gateway over AIOrchestrationService. */
  answer: VoiceAnswerPort;
  /** SPRINT-035 — Command Center PRESENTATION (read-only). Optional: when
   *  absent (or when no question matches), voice falls through to the
   *  existing answer path unchanged. Voice presents; it never authorizes. */
  present?: CommandCenterPresentationPort;
  /** Explicit mock-in-production enablement (mirrors VOICE_ENABLE_MOCK). */
  allowMockInProduction?: boolean;
  /** Environment probe — defaults to process.env.NODE_ENV. */
  isProduction?: () => boolean;
  /** Clock — deterministic tests. */
  now?: () => string;
  /** Conversation-id generator (auto-created conversations). */
  newConversationId?: () => string;
  gate?: VoiceIntentGate;
}

const MAX_UTTERANCE_TEXT = MAX_SYNTHESIS_TEXT_LENGTH;

export class VoiceAssistantService {
  private readonly stt: SpeechToTextPort;
  private readonly tts: TextToSpeechPort;
  private readonly conversations: ConversationStore;
  private readonly brain: BrainTaskPort;
  private readonly answer: VoiceAnswerPort;
  private readonly present: CommandCenterPresentationPort | undefined;
  private readonly allowMockInProduction: boolean;
  private readonly isProduction: () => boolean;
  private readonly now: () => string;
  private readonly newConversationId: () => string;
  private readonly gate: VoiceIntentGate;

  constructor(options: VoiceAssistantServiceOptions) {
    this.stt = options.stt;
    this.tts = options.tts;
    this.conversations = options.conversations;
    this.brain = options.brain;
    this.answer = options.answer;
    this.present = options.present;
    this.allowMockInProduction = options.allowMockInProduction ?? false;
    this.isProduction =
      options.isProduction ?? ((): boolean => process.env.NODE_ENV === 'production');
    this.now = options.now ?? ((): string => new Date().toISOString());
    this.newConversationId =
      options.newConversationId ??
      ((): string => `conv-${Math.random().toString(36).slice(2, 10)}`);
    this.gate = options.gate ?? new VoiceIntentGate();
  }

  /** Refuse mock adapters in production unless explicitly enabled. */
  private mockAllowed(adapterKind: 'MOCK' | 'REAL'): boolean {
    if (adapterKind === 'REAL') return true;
    return !this.isProduction() || this.allowMockInProduction;
  }

  // ── The one-turn assistant flow ──────────────────────────────────────

  /**
   * Translate one spoken turn into the existing Brain pipeline.
   *
   * Flow:
   *   1. STT (bounded, cancellation-aware). A failed/unknown transcription
   *      yields an honest ERROR turn — never an actionable intent.
   *   2. Brain intent interpreter classifies the transcript (ANSWER vs
   *      ACTION vs UNKNOWN).
   *   3. UNKNOWN / too-ambiguous → a clarifying text response (no action).
   *   4. ANSWER → existing AI Q&A runtime → text → best-effort TTS.
   *   5. ACTION:
   *        • sensitive action mentioned → task created but NEVER executed;
   *          turn ends WAITING_FOR_APPROVAL (non-voice confirmation required).
   *        • otherwise → Brain createTask + plan → response summarizes stage.
   *   6. Turns persisted (interaction artifacts only — no promotion).
   */
  async handleUtterance(
    ownerId: string,
    input: { audio: { format: string; data: Uint8Array }; conversationId?: string },
    opts: { signal?: AbortSignal } = {},
  ): Promise<SpeechServiceResult<VoiceTurnResult>> {
    const { signal } = opts;

    if (!this.mockAllowed(this.stt.kind)) {
      return this.turn(
        'ERROR',
        ownerId,
        input.conversationId,
        {
          state: 'ERROR',
          transcript: '',
          text: 'Voice transcription is not configured. Text input is available in the companion.',
          code: 'NOT_CONFIGURED',
        },
        { skipUserTurn: true },
      );
    }

    // Bounded + cancellation-aware transcription.
    if (input.audio.data.length === 0 || input.audio.data.length > MAX_AUDIO_BYTES) {
      return this.turn('ERROR', ownerId, input.conversationId, {
        state: 'ERROR',
        transcript: '',
        text: 'The recording was empty or too large to process. Please try again.',
        code: 'INVALID_INPUT',
      });
    }
    if (signal?.aborted === true) {
      return this.turn('CANCELLED', ownerId, input.conversationId, {
        state: 'CANCELLED',
        transcript: '',
        text: 'Cancelled.',
      });
    }

    let transcript: string;
    try {
      const sttResult = await this.stt.transcribe({ ownerId, audio: input.audio, signal });
      transcript = sttResult.aborted ? '' : sttResult.text.trim().slice(0, MAX_UTTERANCE_TEXT);
    } catch {
      return this.turn('ERROR', ownerId, input.conversationId, {
        state: 'ERROR',
        transcript: '',
        text: 'I could not understand the audio. Please try again or type your request.',
        code: 'PROVIDER_FAILURE',
      });
    }
    if (!transcript) {
      return this.turn('CANCELLED', ownerId, input.conversationId, {
        state: 'CANCELLED',
        transcript: '',
        text: 'Cancelled.',
      });
    }

    // Record the user turn as an interaction artifact (never promoted).
    const conversationId = this.ensureConversation(ownerId, input.conversationId);
    this.appendTurn(ownerId, conversationId, 'user', transcript, this.now());

    // Brain intent interpretation (reuses the Brain's IntentInterpreter).
    const assessment = this.gate.classify({ transcript });

    // Sensitive action mentioned → NEVER execute, and NEVER downgrade to a
    // clarifying turn: the action must go to explicit non-voice confirmation.
    // The transcript is an OBSERVATION only; approval can only come from the
    // existing non-voice mechanism (gateway confirmSensitive → Brain.approve).
    if (assessment.requiresExplicitConfirmation) {
      const created = this.brain.createTask(ownerId, transcript);
      if (!created.success || !created.data) {
        return this.turn('ERROR', ownerId, conversationId, {
          state: 'ERROR',
          transcript,
          text: 'I could not prepare that action for approval. Please try again.',
          code: 'BRAIN_FAILURE',
        });
      }
      return this.turn('WAITING_FOR_APPROVAL', ownerId, conversationId, {
        state: 'WAITING_FOR_APPROVAL',
        transcript,
        text: `I can prepare this for you: "${transcript}". Since it involves ${assessment.sensitiveActionsMentioned.join(' and ')} — a sensitive action — I need you to confirm it on the confirmation button. A voice instruction cannot authorize this by itself.`,
        taskId: created.data.id,
        taskStage: created.data.stage,
        sensitiveActionsMentioned: assessment.sensitiveActionsMentioned,
      });
    }

    // Unclear / ambiguous (no sensitive action involved) → clarifying
    // response, never an actionable intent.
    if (!assessment.canProceedToPlan) {
      return this.turn('RESPONDING', ownerId, conversationId, {
        state: 'RESPONDING',
        transcript,
        text:
          assessment.ambiguities.length > 0
            ? `I want to make sure I understand. Could you clarify: ${assessment.ambiguities[0]}`
            : 'I could not understand that clearly. Could you rephrase it?',
      });
    }

    // ACTION (non-sensitive) → the EXISTING Brain task pipeline.
    if (assessment.kind === 'ACTION') {
      const created = this.brain.createTask(ownerId, transcript);
      if (!created.success || !created.data) {
        return this.turn('ERROR', ownerId, conversationId, {
          state: 'ERROR',
          transcript,
          text: 'I could not start that task. Please try again.',
          code: 'BRAIN_FAILURE',
        });
      }
      const taskId = created.data.id;
      let stage = created.data.stage;
      let text = `I've noted that: "${transcript}". I'll plan the steps now.`;
      if (this.brain.plan) {
        const planned = await this.brain.plan(ownerId, taskId);
        if (planned.success && planned.data) {
          stage = planned.data.stage;
          text = `I've understood and planned this task: "${transcript}". It is now in the ${planned.data.stage} stage.`;
        } else {
          text = `I've noted that: "${transcript}". Planning needs a moment — you can track it on the Brain board.`;
        }
      }
      return this.turn('RESPONDING', ownerId, conversationId, {
        state: 'RESPONDING',
        transcript,
        text,
        taskId,
        taskStage: stage,
      });
    }

    // ANSWER → Command Center PRESENTATION first (SPRINT-035): deterministic
    // phrase routing over a CLOSED question set, answered read-only from the
    // existing world read models. Voice presents — it never authorizes. When
    // the question is not a presentation question (or the port is absent),
    // fall through to the existing AI Q&A runtime unchanged.
    if (assessment.kind === 'ANSWER' && this.present) {
      const question = routeCommandCenterQuestion(transcript);
      if (question) {
        const presented = await this.present.ask({ userId: ownerId, question });
        if (presented.ok && presented.content) {
          return this.turn('RESPONDING', ownerId, conversationId, {
            state: 'RESPONDING',
            transcript,
            text: presented.content.slice(0, MAX_UTTERANCE_TEXT),
          });
        }
        // Honest fallback — never a fabricated answer.
        return this.turn('RESPONDING', ownerId, conversationId, {
          state: 'RESPONDING',
          transcript,
          text: 'I could not read the command center right now. Please try again in a moment.',
        });
      }
    }

    // ANSWER → the existing AI Q&A runtime.
    const answered = await this.answer.ask({ userId: ownerId, prompt: transcript, signal });
    const responseText =
      answered.ok && answered.content
        ? answered.content.slice(0, MAX_UTTERANCE_TEXT)
        : 'I could not find an answer right now. Please try again in a moment.';
    return this.turn('RESPONDING', ownerId, conversationId, {
      state: 'RESPONDING',
      transcript,
      text: responseText,
    });
  }

  /**
   * THE ONLY approval path for a voice-initiated sensitive action — an
   * explicit NON-VOICE confirmation. This calls the EXISTING Brain approval
   * mechanism; voice never authorizes anything.
   */
  async confirmSensitive(
    ownerId: string,
    input: { conversationId: string; taskId: string; action: string; signal?: AbortSignal },
  ): Promise<SpeechServiceResult<VoiceTurnResult>> {
    if (!this.brain.plan || !this.brain.approve) {
      return err('Sensitive-action approval is not configured.', 'NOT_CONFIGURED');
    }
    const conversation = this.conversations.get(ownerId, input.conversationId);
    if (!conversation) return err('Conversation not found.', 'NOT_FOUND');
    if (input.signal?.aborted === true) {
      return err('Approval cancelled.', 'CANCELLED');
    }

    // Existing approval authority — the Brain records this decision in the
    // decision store (provenance: user-approval). Voice grants nothing.
    const approved = this.brain.approve(ownerId, input.taskId, input.action);
    if (!approved.success || !approved.data) {
      return err(
        approved.error ?? 'The action could not be approved.',
        approved.code ?? 'APPROVAL_FAILED',
      );
    }

    const planned = await this.brain.plan(ownerId, input.taskId);
    const stage = planned.success && planned.data ? planned.data.stage : approved.data.stage;
    const text =
      planned.success && planned.data
        ? `Approved and planned: "${approved.data.objective}". It is now in the ${stage} stage and I'll keep you posted.`
        : 'Approved. I could not finish planning — please check the Brain board.';

    const turn: VoiceTurnResult = {
      state: 'RESPONDING',
      transcript: `[confirmed on screen: ${input.action}]`,
      text,
      conversationId: input.conversationId,
      taskId: input.taskId,
      taskStage: stage,
    };
    this.appendTurn(ownerId, input.conversationId, 'assistant', text, this.now());
    return ok(turn);
  }

  rejectSensitive(
    ownerId: string,
    input: { conversationId: string; taskId: string; action: string },
  ): SpeechServiceResult<VoiceTurnResult> {
    if (!this.brain.reject)
      return err('Sensitive-action rejection is not configured.', 'NOT_CONFIGURED');
    if (!this.conversations.get(ownerId, input.conversationId)) {
      return err('Conversation not found.', 'NOT_FOUND');
    }
    const rejected = this.brain.reject(ownerId, input.taskId, input.action);
    if (!rejected.success || !rejected.data) {
      return err(
        rejected.error ?? 'The action could not be rejected.',
        rejected.code ?? 'APPROVAL_FAILED',
      );
    }
    const text = 'Understood — I have cancelled that action. Nothing was executed.';
    const turn: VoiceTurnResult = {
      state: 'CANCELLED',
      transcript: `[rejected on screen: ${input.action}]`,
      text,
      conversationId: input.conversationId,
      taskId: input.taskId,
    };
    this.appendTurn(ownerId, input.conversationId, 'assistant', text, this.now());
    return ok(turn);
  }

  // ── Conversation seams (interaction artifacts only) ───────────────────

  listConversations(ownerId: string): Conversation[] {
    return this.conversations.list(ownerId);
  }

  getConversation(ownerId: string, conversationId: string): Conversation | undefined {
    return this.conversations.get(ownerId, conversationId);
  }

  turns(ownerId: string, conversationId: string, limit = MAX_TURNS_RETURNED): ConversationTurn[] {
    return this.conversations.turns(
      ownerId,
      conversationId,
      Math.min(limit, MAX_TURNS_PER_CONVERSATION),
    );
  }

  // ── Internals ─────────────────────────────────────────────────────────

  private ensureConversation(ownerId: string, conversationId?: string): string {
    if (conversationId && this.conversations.get(ownerId, conversationId)) {
      return conversationId;
    }
    const created = this.conversations.create(ownerId);
    return created.id;
  }

  private appendTurn(
    ownerId: string,
    conversationId: string,
    role: 'user' | 'assistant',
    text: string,
    createdAt: string,
  ): void {
    this.conversations.append(ownerId, conversationId, { role, text, createdAt });
  }

  /** Compose a turn result, persist the assistant turn, then synthesize
   *  speech best-effort (a TTS failure is NEVER a task failure — the text
   *  response stands and the result honestly marks ttsFailed). */
  private async turn(
    state: VoiceTurnState,
    ownerId: string,
    conversationId: string | undefined,
    base: Omit<VoiceTurnResult, 'conversationId'> & { conversationId?: string },
    opts: { skipUserTurn?: boolean } = {},
  ): Promise<SpeechServiceResult<VoiceTurnResult>> {
    const convId = base.conversationId ?? conversationId ?? this.ensureConversation(ownerId);
    const result: VoiceTurnResult = {
      state,
      transcript: base.transcript,
      text: base.text,
      conversationId: convId,
      taskId: base.taskId,
      taskStage: base.taskStage,
      sensitiveActionsMentioned: base.sensitiveActionsMentioned,
      code: base.code,
    };

    // Persist the assistant turn only when a transcript/response exists
    // (interaction artifact — never promoted to facts/preferences).
    if (!opts.skipUserTurn && base.text && base.state !== 'CANCELLED') {
      this.appendTurn(ownerId, convId, 'assistant', base.text, this.now());
    }

    // TTS is additive. Never fail the turn when synthesis fails.
    if (
      base.text &&
      this.mockAllowed(this.tts.kind) &&
      (state === 'RESPONDING' || state === 'WAITING_FOR_APPROVAL')
    ) {
      try {
        const synth = await this.tts.synthesize({
          ownerId,
          text: base.text.slice(0, MAX_SYNTHESIS_TEXT_LENGTH),
        });
        if (synth.aborted !== true && synth.audio.length > 0) {
          result.audio = { data: synth.audio, format: synth.format };
        }
      } catch {
        result.ttsFailed = true;
      }
    }
    return ok(result);
  }
}
