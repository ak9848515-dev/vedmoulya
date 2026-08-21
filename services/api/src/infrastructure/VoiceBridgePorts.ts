// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Voice Bridge Ports
// SPRINT-028 — the voice → Brain bridge, implemented over the REAL services.
//
// These are the ONLY seams the voice assistant uses to reach the frozen
// estate — they translate the assistant's narrow requests into the existing
// Brain pipeline (createTask → plan → approve/reject) and the existing AI
// Q&A runtime (ANSWER intents reuse the same runtime the text companion
// uses). No voice-specific decision logic, no duplicate engines.
//
// The approve/reject implementations simply forward to the Brain's existing
// approval authority. Voice can never reach them: the gateway only invokes
// them from the non-voice `voice.confirmSensitive` / `voice.rejectSensitive`
// procedures (VOICE ≠ AUTHORIZATION).
// ─────────────────────────────────────────────────────────────────────────────

import type { BrainTaskPort, VoiceAnswerPort } from '@vedmoulya/voice';
import type { BrainApplicationService } from '@vedmoulya/brain';
import type { AIOrchestrationService } from '@vedmoulya/services';

/** BrainTaskPort over the real VedMoulya Brain (EPIC-016). */
export function createVoiceBrainPort(brain: BrainApplicationService): BrainTaskPort {
  return {
    createTask: (userId, input): ReturnType<BrainTaskPort['createTask']> => {
      const result = brain.createTask(userId, input);
      if (!result.success || !result.data) {
        return { success: false, error: result.error, code: result.code };
      }
      const task = result.data;
      return {
        success: true,
        data: { id: task.id, objective: task.objective, status: task.status, stage: task.stage },
      };
    },
    plan: async (
      userId,
      taskId,
    ): Promise<
      Awaited<
        NonNullable<BrainTaskPort['plan']> extends (u: string, t: string) => infer R ? R : never
      >
    > => {
      const result = await brain.plan(userId, taskId);
      if (!result.success || !result.data) {
        return { success: false, error: result.error, code: result.code };
      }
      return {
        success: true,
        data: {
          id: result.data.id,
          status: result.data.status,
          stage: result.data.stage,
          approvalRequired: result.data.approvalRequired,
        },
      };
    },
    approve: (userId, taskId, action): ReturnType<NonNullable<BrainTaskPort['approve']>> => {
      const result = brain.approve(userId, taskId, action);
      if (!result.success || !result.data) {
        return { success: false, error: result.error, code: result.code };
      }
      return {
        success: true,
        data: {
          id: result.data.id,
          objective: result.data.objective,
          status: result.data.status,
          stage: result.data.stage,
        },
      };
    },
    reject: (userId, taskId, action): ReturnType<NonNullable<BrainTaskPort['reject']>> => {
      const result = brain.reject(userId, taskId, action);
      if (!result.success || !result.data) {
        return { success: false, error: result.error, code: result.code };
      }
      return {
        success: true,
        data: {
          id: result.data.id,
          objective: result.data.objective,
          status: result.data.status,
          stage: result.data.stage,
        },
      };
    },
  };
}

/** VoiceAnswerPort over the real AI Q&A runtime — the SAME runtime the text
 *  companion uses (ai.stream). Voice only translates the modality. */
export function createVoiceAnswerPort(ai: AIOrchestrationService): VoiceAnswerPort {
  return {
    ask: async (input: {
      userId: string;
      prompt: string;
      signal?: AbortSignal;
    }): Promise<Awaited<ReturnType<VoiceAnswerPort['ask']>>> => {
      try {
        const result = await ai.orchestrate({
          capability: 'general_conversation',
          userInput: input.prompt,
          userId: input.userId,
          qualityTier: 'standard',
          constraints: { outputFormat: 'markdown', maxOutputTokens: 1000 },
          enableOptimization: true,
        });
        if (result.abstained) {
          return {
            ok: false,
            error: 'The assistant abstained rather than answer without evidence.',
          };
        }
        return { ok: true, content: result.content };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'AI answer failed.',
        };
      }
    },
  };
}
