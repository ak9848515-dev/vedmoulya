// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Voice Router
// SPRINT-027 — voice.* capability seams (foundation).
// SPRINT-028 — voice assistant procedures (voice → Brain bridge).
//
// Procedures:
//   voice.status              — honest speech capability status (MOCK/CONFIGURED/
//                               UNAVAILABLE/ERROR/NOT_CONFIGURED — never fabricated).
//   voice.transcribe          — STT seam (bounded input; owner-scoped).
//   voice.synthesize          — TTS seam (bounded text; owner-scoped).
//   voice.assessAction        — the VOICE ≠ AUTHORIZATION decision (deterministic).
//   voice.handleUtterance     — ONE spoken turn → existing Brain pipeline
//                               (ANSWER → AI Q&A, ACTION → Brain task,
//                               sensitive → WAITING_FOR_APPROVAL).
//   voice.confirmSensitive    — THE ONLY approval path for a voice-initiated
//                               sensitive action: an explicit NON-VOICE
//                               confirmation that calls the existing Brain
//                               approval authority. Voice never authorizes.
//   voice.rejectSensitive     — non-voice rejection of a sensitive action.
//   voice.*Conversation       — owner-scoped bounded conversation store.
//
// Every procedure is authenticated + rate-limited; ownership is enforced by the
// central auth middleware (input.userId must match the session user) AND the
// service (owner-scoped stores). No raw provider logic, no API keys, no
// voice-specific authorization logic — the Brain stays the orchestrator.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';
import type { SpeechApplicationService, VoiceAssistantService } from '@vedmoulya/voice';
import type { SpeechServiceResult } from '@vedmoulya/voice';
import type { TRPCContext } from '../services/RouterRegistry.js';
import type { ApiResponse } from '../services/ResponseMapper.js';
import { successResponse } from '../services/ResponseMapper.js';
import { MAX_AUDIO_BYTES } from '@vedmoulya/voice';

/** Map a voice service result to the standard envelope. The envelope carries a
 *  standard ErrorCode (the frozen gateway vocabulary); the honest voice-level
 *  code (NOT_CONFIGURED / INVALID_INPUT / PROVIDER_FAILURE / CANCELLED /
 *  NOT_FOUND) is preserved in `error.details.voiceCode` so clients never lose
 *  the truth — and never collapse it into a fabricated INTERNAL_ERROR. */
function fromVoiceResult<T>(result: SpeechServiceResult<T>): ApiResponse<T> {
  if (result.success && result.data) {
    return successResponse(result.data);
  }
  const statusCode =
    result.code === 'NOT_CONFIGURED'
      ? 503
      : result.code === 'INVALID_INPUT'
        ? 400
        : result.code === 'CANCELLED'
          ? 499
          : result.code === 'NOT_FOUND'
            ? 404
            : result.code === 'PROVIDER_FAILURE'
              ? 502
              : 500;
  const code =
    result.code === 'INVALID_INPUT'
      ? 'VALIDATION_ERROR'
      : result.code === 'NOT_FOUND'
        ? 'NOT_FOUND'
        : result.code === 'NOT_CONFIGURED'
          ? 'SERVICE_UNAVAILABLE'
          : result.code === 'PROVIDER_FAILURE'
            ? 'DEPENDENCY_FAILURE'
            : 'INTERNAL_ERROR';
  return {
    success: false,
    error: {
      code,
      message: result.error ?? 'Voice service error',
      statusCode,
      details: result.code ? { voiceCode: result.code } : undefined,
    },
    meta: {
      timestamp: new Date().toISOString(),
      duration: 0,
      version: '1.0.0',
    },
  };
}

export interface VoiceHandlers {
  status: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  transcribe: (
    input: { userId: string; format: string; audioBase64: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  synthesize: (input: { userId: string; text: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  assessAction: (
    input: {
      userId: string;
      transcript: string;
      action: string;
      approvalGranted?: string[];
    },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // ── SPRINT-028 — voice assistant ─────────────────────────────────────
  handleUtterance: (
    input: { userId: string; format: string; audioBase64: string; conversationId?: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  confirmSensitive: (
    input: { userId: string; conversationId: string; taskId: string; action: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  rejectSensitive: (
    input: { userId: string; conversationId: string; taskId: string; action: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // ── Conversation store ────────────────────────────────────────────────
  createConversation: (
    input: { userId: string; title?: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listConversations: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  appendTurn: (
    input: { userId: string; conversationId: string; role: 'user' | 'assistant'; text: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  clearConversation: (
    input: { userId: string; conversationId: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
}

/** Decode a base64 audio payload with a pre-decode size bound (a huge base64
 *  string must not allocate) and map oversize/empty to INVALID_INPUT. */
function decodeAudio(audioBase64: string): { ok: true; data: Uint8Array } | { ok: false } {
  if (audioBase64.length > Math.ceil((MAX_AUDIO_BYTES * 4) / 3) + 16) {
    return { ok: false };
  }
  const decoded = Buffer.from(audioBase64, 'base64');
  if (decoded.length === 0 || decoded.length > MAX_AUDIO_BYTES) {
    return { ok: false };
  }
  return { ok: true, data: new Uint8Array(decoded) };
}

export function createVoiceRouter(
  voice: SpeechApplicationService,
  assistant?: VoiceAssistantService,
): VoiceHandlers {
  return {
    status: async (_input, _ctx): Promise<ApiResponse> => {
      // Live-probed status: CONFIGURED only when a REAL adapter answers;
      // UNAVAILABLE when configured but down; ERROR on probe failure;
      // MOCK for mocks (never CONFIGURED). Never fabricated.
      return successResponse(await voice.probeSpeechStatus());
    },

    transcribe: async (input): Promise<ApiResponse> => {
      const decoded = decodeAudio(input.audioBase64);
      if (!decoded.ok) {
        return fromVoiceResult({
          success: false,
          error: `Audio payload must be 1..${MAX_AUDIO_BYTES} bytes.`,
          code: 'INVALID_INPUT',
        });
      }
      const result = await voice.transcribe(input.userId, {
        format: input.format,
        data: decoded.data,
      });
      return fromVoiceResult(result);
    },

    synthesize: async (input): Promise<ApiResponse> => {
      const result = await voice.synthesize(input.userId, input.text);
      // Deliver audio as base64 over the wire (never raw binary in the router).
      if (result.success && result.data) {
        return successResponse({
          audioBase64: Buffer.from(result.data.audio).toString('base64'),
          format: result.data.format,
          aborted: result.data.aborted ?? false,
        });
      }
      return fromVoiceResult(result);
    },

    assessAction: (input): Promise<ApiResponse> => {
      // The VOICE ≠ AUTHORIZATION decision — approval can only come from the
      // caller's existing approval mechanism (never derived from the transcript).
      const decision = voice.assessAction(input.transcript, input.action, {
        approvalGranted: input.approvalGranted,
      });
      return Promise.resolve(successResponse(decision));
    },

    // ── SPRINT-028 — voice assistant ─────────────────────────────────────
    handleUtterance: async (input): Promise<ApiResponse> => {
      if (!assistant) {
        return fromVoiceResult({
          success: false,
          error: 'Voice assistant is not configured.',
          code: 'NOT_CONFIGURED',
        });
      }
      const decoded = decodeAudio(input.audioBase64);
      if (!decoded.ok) {
        return fromVoiceResult({
          success: false,
          error: `Audio payload must be 1..${MAX_AUDIO_BYTES} bytes.`,
          code: 'INVALID_INPUT',
        });
      }
      const result = await assistant.handleUtterance(input.userId, {
        audio: { format: input.format, data: decoded.data },
        conversationId: input.conversationId,
      });
      return fromVoiceResult(result);
    },

    confirmSensitive: async (input): Promise<ApiResponse> => {
      if (!assistant) {
        return fromVoiceResult({
          success: false,
          error: 'Voice assistant is not configured.',
          code: 'NOT_CONFIGURED',
        });
      }
      // Explicit NON-VOICE confirmation → existing Brain approval authority.
      const result = await assistant.confirmSensitive(input.userId, {
        conversationId: input.conversationId,
        taskId: input.taskId,
        action: input.action,
      });
      return fromVoiceResult(result);
    },

    rejectSensitive: (input): Promise<ApiResponse> => {
      if (!assistant) {
        return Promise.resolve(
          fromVoiceResult({
            success: false,
            error: 'Voice assistant is not configured.',
            code: 'NOT_CONFIGURED',
          }),
        );
      }
      const result = assistant.rejectSensitive(input.userId, {
        conversationId: input.conversationId,
        taskId: input.taskId,
        action: input.action,
      });
      return Promise.resolve(fromVoiceResult(result));
    },

    createConversation: (input): Promise<ApiResponse> =>
      Promise.resolve(successResponse(voice.createConversation(input.userId, input.title ?? ''))),

    listConversations: (input): Promise<ApiResponse> =>
      Promise.resolve(successResponse(voice.listConversations(input.userId))),

    appendTurn: (input): Promise<ApiResponse> => {
      const result = voice.appendTurn(input.userId, input.conversationId, input.role, input.text);
      return Promise.resolve(fromVoiceResult(result));
    },

    clearConversation: (input): Promise<ApiResponse> => {
      voice.clearConversation(input.userId, input.conversationId);
      return Promise.resolve(successResponse({ cleared: true }));
    },
  };
}

// ── Zod inputs (RouterRegistry) ───────────────────────────────────────────────

export const voiceStatusInput = z.object({ userId: z.string() });
export const voiceTranscribeInput = z.object({
  userId: z.string(),
  format: z.string().min(1).max(32),
  audioBase64: z.string().min(1),
});
export const voiceSynthesizeInput = z.object({ userId: z.string(), text: z.string() });
export const voiceAssessInput = z.object({
  userId: z.string(),
  transcript: z.string().max(4000),
  action: z.string().max(64),
  approvalGranted: z.array(z.string()).max(20).optional(),
});
export const voiceHandleUtteranceInput = z.object({
  userId: z.string(),
  format: z.string().min(1).max(32),
  audioBase64: z.string().min(1),
  conversationId: z.string().max(120).optional(),
});
export const voiceSensitiveDecisionInput = z.object({
  userId: z.string(),
  conversationId: z.string().min(1).max(120),
  taskId: z.string().min(1).max(120),
  action: z.string().min(1).max(120),
});
export const voiceCreateConversationInput = z.object({
  userId: z.string(),
  title: z.string().max(120).optional(),
});
export const voiceListConversationsInput = z.object({ userId: z.string() });
export const voiceAppendTurnInput = z.object({
  userId: z.string(),
  conversationId: z.string(),
  role: z.enum(['user', 'assistant']),
  text: z.string().min(1).max(4000),
});
export const voiceClearConversationInput = z.object({
  userId: z.string(),
  conversationId: z.string(),
});
