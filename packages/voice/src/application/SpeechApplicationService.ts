// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Voice · SpeechApplicationService
// SPRINT-027 — the composition seam for speech + conversation + the
// VOICE ≠ AUTHORIZATION contract.
//
// Composition only — no new engine:
//   • STT/TTS go through the narrow SpeechToTextPort / TextToSpeechPort;
//   • conversation history lives in the owner-scoped ConversationStore;
//   • intent classification + authorization refusal reuse the Brain's
//     IntentInterpreter + SENSITIVE_ACTIONS via the VoiceIntentGate;
//   • the Brain remains the orchestrator: this service never plans, executes,
//     verifies, approves, budgets or learns.
//
// Honesty rules:
//   • speechStatus() never claims CONFIGURED for a mock adapter;
//   • mock adapters are refused in production unless explicitly enabled
//     (VOICE_ENABLE_MOCK=true) — mirroring the AI_ENABLE_MOCK discipline;
//   • a failed/unknown transcription never yields an actionable intent;
//   • a transcript never grants approval (VOICE ≠ AUTHORIZATION).
// ─────────────────────────────────────────────────────────────────────────────

import type { ConversationStore } from '../contracts/voice-ports.js';
import type { SpeechToTextPort, TextToSpeechPort } from '../contracts/voice-ports.js';
import { VoiceIntentGate } from '../domain/VoiceIntentGate.js';
import {
  MAX_AUDIO_BYTES,
  MAX_SYNTHESIS_TEXT_LENGTH,
  MAX_TURNS_PER_CONVERSATION,
  MAX_TURNS_RETURNED,
} from '../domain/ConversationPolicy.js';
import type {
  Conversation,
  ConversationTurn,
  SpeechCapabilityStatus,
  SpeechIntentAssessment,
  SpeechServiceResult,
  SpeechToTextResult,
  TextToSpeechResult,
  VoiceActionDecision,
} from '../types/voice-types.js';

function err<T>(error: string, code?: string): SpeechServiceResult<T> {
  return { success: false, error, code };
}
function ok<T>(data: T): SpeechServiceResult<T> {
  return { success: true, data };
}

export interface SpeechApplicationServiceOptions {
  stt: SpeechToTextPort;
  tts: TextToSpeechPort;
  conversations: ConversationStore;
  /** Explicit mock-in-production enablement (mirrors AI_ENABLE_MOCK). */
  allowMockInProduction?: boolean;
  /** Environment probe — defaults to process.env.NODE_ENV (test-injectable). */
  isProduction?: () => boolean;
  /** Clock — deterministic tests. */
  now?: () => string;
  gate?: VoiceIntentGate;
}

export class SpeechApplicationService {
  private readonly stt: SpeechToTextPort;
  private readonly tts: TextToSpeechPort;
  private readonly conversations: ConversationStore;
  private readonly allowMockInProduction: boolean;
  private readonly isProduction: () => boolean;
  private readonly now: () => string;
  private readonly gate: VoiceIntentGate;

  constructor(options: SpeechApplicationServiceOptions) {
    this.stt = options.stt;
    this.tts = options.tts;
    this.conversations = options.conversations;
    this.allowMockInProduction = options.allowMockInProduction ?? false;
    this.isProduction =
      options.isProduction ?? ((): boolean => process.env.NODE_ENV === 'production');
    this.now = options.now ?? ((): string => new Date().toISOString());
    this.gate = options.gate ?? new VoiceIntentGate();
  }

  // ── Honest capability status ──────────────────────────────────────

  /** Synchronous, kind-based status (never lies about MOCK). A REAL adapter
   *  is reported CONFIGURED here even before a live probe — the async
   *  `probeSpeechStatus()` below tightens that to UNAVAILABLE/ERROR when the
   *  backing provider is unreachable. MOCK is always MOCK. */
  speechStatus(): SpeechCapabilityStatus {
    const adapters = [
      { id: this.stt.id, kind: this.stt.kind, capability: this.stt.capability as 'SPEECH_TO_TEXT' },
      { id: this.tts.id, kind: this.tts.kind, capability: this.tts.capability as 'TEXT_TO_SPEECH' },
    ];
    const real = adapters.filter((a) => a.kind === 'REAL');
    return {
      stt: this.stt.kind === 'REAL' ? 'CONFIGURED' : 'MOCK',
      tts: this.tts.kind === 'REAL' ? 'CONFIGURED' : 'MOCK',
      adapters,
      realSpeechAvailable: real.length > 0,
    };
  }

  /** Live status: CONFIGURED only when a REAL adapter actually answers a
   *  probe; UNAVAILABLE when the backing provider is configured but down;
   *  ERROR when the probe itself failed; MOCK for mocks (never CONFIGURED). */
  async probeSpeechStatus(): Promise<SpeechCapabilityStatus> {
    const status = this.speechStatus();
    if (this.stt.kind === 'REAL') {
      status.stt = await this.probeCapability(this.stt);
    }
    if (this.tts.kind === 'REAL') {
      status.tts = await this.probeCapability(this.tts);
    }
    return status;
  }

  /** Probe a real adapter. The adapter is passed whole (never the method
   *  extracted) so `this` binding survives. An adapter without a probe
   *  surface is operator-declared CONFIGURED. */
  private async probeCapability(adapter: {
    kind: 'MOCK' | 'REAL';
    probe?: () => Promise<{ available: boolean }>;
  }): Promise<'CONFIGURED' | 'UNAVAILABLE' | 'ERROR'> {
    const probe = adapter.probe;
    if (!probe) return 'CONFIGURED'; // operator-declared, no probe surface
    try {
      const result = await probe.call(adapter);
      return result.available ? 'CONFIGURED' : 'UNAVAILABLE';
    } catch {
      return 'ERROR';
    }
  }

  // ── Speech seams (owner-scoped, bounded, cancellation-aware) ─────

  /** Refuse mock adapters in production unless explicitly enabled. */
  private mockAllowed(adapterKind: 'MOCK' | 'REAL'): boolean {
    if (adapterKind === 'REAL') return true;
    return !this.isProduction() || this.allowMockInProduction;
  }

  async transcribe(
    ownerId: string,
    input: { format: string; data: Uint8Array },
    signal?: AbortSignal,
  ): Promise<SpeechServiceResult<SpeechToTextResult>> {
    if (!this.mockAllowed(this.stt.kind)) {
      return err(
        'No real speech-to-text provider is configured. Mock transcription is disabled in production (set VOICE_ENABLE_MOCK=true only for non-production-like environments).',
        'NOT_CONFIGURED',
      );
    }
    if (input.data.length > MAX_AUDIO_BYTES || input.data.length === 0) {
      return err(`Audio payload must be 1..${MAX_AUDIO_BYTES} bytes.`, 'INVALID_INPUT');
    }
    if (signal?.aborted === true) {
      return err('Transcription cancelled.', 'CANCELLED');
    }
    try {
      const result = await this.stt.transcribe({ ownerId, audio: input, signal });
      return ok(result);
    } catch (error) {
      return err(
        error instanceof Error ? error.message : 'Speech-to-text provider failed.',
        'PROVIDER_FAILURE',
      );
    }
  }

  async synthesize(
    ownerId: string,
    text: string,
    signal?: AbortSignal,
  ): Promise<SpeechServiceResult<TextToSpeechResult>> {
    if (!this.mockAllowed(this.tts.kind)) {
      return err(
        'No real text-to-speech provider is configured. Mock synthesis is disabled in production (set VOICE_ENABLE_MOCK=true only for non-production-like environments).',
        'NOT_CONFIGURED',
      );
    }
    if (text.trim().length === 0 || text.length > MAX_SYNTHESIS_TEXT_LENGTH) {
      return err(`Text must be 1..${MAX_SYNTHESIS_TEXT_LENGTH} characters.`, 'INVALID_INPUT');
    }
    if (signal?.aborted === true) {
      return err('Synthesis cancelled.', 'CANCELLED');
    }
    try {
      const result = await this.tts.synthesize({ ownerId, text, signal });
      return ok(result);
    } catch (error) {
      return err(
        error instanceof Error ? error.message : 'Text-to-speech provider failed.',
        'PROVIDER_FAILURE',
      );
    }
  }

  // ── VOICE ≠ AUTHORIZATION (Phase 4) ───────────────────────────────

  /** Classify a transcript (deterministic, reuses the Brain interpreter). */
  classify(transcript: string, confidence?: number): SpeechIntentAssessment {
    return this.gate.classify({ transcript, confidence });
  }

  /** Decide whether a proposed action may proceed — approval NEVER comes
   *  from the transcript (VOICE ≠ AUTHORIZATION). */
  assessAction(
    transcript: string,
    action: string,
    opts: { approvalGranted?: readonly string[]; cancelled?: boolean; confidence?: number } = {},
  ): VoiceActionDecision {
    return this.gate.assessAction({ transcript, confidence: opts.confidence }, action, {
      approvalGranted: opts.approvalGranted,
      cancelled: opts.cancelled,
    });
  }

  // ── Owner-scoped conversation foundation (Phase 5) ────────────────
  // Interaction artifacts only. The voice package exposes NO promotion path
  // into user facts / preferences / outcome memory / learning.

  createConversation(ownerId: string, title = ''): Conversation {
    return this.conversations.create(ownerId, title);
  }

  getConversation(ownerId: string, conversationId: string): Conversation | undefined {
    return this.conversations.get(ownerId, conversationId);
  }

  listConversations(ownerId: string): Conversation[] {
    return this.conversations.list(ownerId);
  }

  appendTurn(
    ownerId: string,
    conversationId: string,
    role: 'user' | 'assistant',
    text: string,
  ): SpeechServiceResult<ConversationTurn> {
    if (!this.conversations.get(ownerId, conversationId)) {
      return err('Conversation not found.', 'NOT_FOUND');
    }
    if (text.trim().length === 0) {
      return err('Turn text cannot be empty.', 'INVALID_INPUT');
    }
    const turn = this.conversations.append(ownerId, conversationId, {
      role,
      text,
      createdAt: this.now(),
    });
    return turn ? ok(turn) : err('Conversation not found.', 'NOT_FOUND');
  }

  turns(ownerId: string, conversationId: string, limit = MAX_TURNS_RETURNED): ConversationTurn[] {
    return this.conversations.turns(
      ownerId,
      conversationId,
      Math.min(limit, MAX_TURNS_PER_CONVERSATION),
    );
  }

  clearConversation(ownerId: string, conversationId: string): void {
    this.conversations.clear(ownerId, conversationId);
  }
}
