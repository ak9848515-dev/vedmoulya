// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Voice · VoiceAssistantService tests
// SPRINT-028 — the voice → Brain bridge.
//
// Covers:
//   • ANSWER intents → existing AI Q&A runtime (not Brain).
//   • ACTION intents → existing Brain createTask + plan.
//   • sensitive actions → WAITING_FOR_APPROVAL, NEVER executed from voice.
//   • confirmSensitive → the ONLY approval path (non-voice, existing Brain
//     approval authority).
//   • rejectSensitive → no execution, honest CANCELLED.
//   • conversation turns persisted owner-scoped; NO promotion into facts/
//     preferences/outcomes (the service exposes no promotion method).
//   • honest results: TTS failure is never a task failure; STT failure is
//     never an actionable intent.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi } from 'vitest';
import { VoiceAssistantService } from '../application/VoiceAssistantService.js';
import { MockSpeechToTextAdapter } from '../infrastructure/MockSpeechToTextAdapter.js';
import { MockTextToSpeechAdapter } from '../infrastructure/MockTextToSpeechAdapter.js';
import { InMemoryConversationStore } from '../infrastructure/InMemoryConversationStore.js';
import { MAX_AUDIO_BYTES } from '../domain/ConversationPolicy.js';
import type { BrainTaskPort, VoiceAnswerPort } from '../types/voice-types.js';
import type { ConversationStore } from '../contracts/voice-ports.js';

const audio = (bytes = 1024): Uint8Array => new Uint8Array(bytes).fill(7);

function fakeBrain(overrides: Partial<BrainTaskPort> = {}): BrainTaskPort {
  return {
    createTask: vi.fn((_userId, input) => ({
      success: true,
      data: { id: 'brain-1', objective: input, status: 'NEW', stage: 'UNDERSTANDING' },
    })),
    plan: vi.fn(async (_userId, _taskId) => ({
      success: true,
      data: { id: 'brain-1', status: 'RUNNING', stage: 'PLAN' },
    })),
    approve: vi.fn((_userId, _taskId, _action) => ({
      success: true,
      data: { id: 'brain-1', objective: 'x', status: 'RUNNING', stage: 'EXECUTION' },
    })),
    reject: vi.fn((_userId, _taskId, _action) => ({
      success: true,
      data: { id: 'brain-1', objective: 'x', status: 'CANCELLED', stage: 'CANCELLED' },
    })),
    ...overrides,
  };
}

function fakeAnswer(content = 'Here is the answer.'): VoiceAnswerPort {
  return { ask: vi.fn(async () => ({ ok: true, content })) };
}

function service(
  opts: {
    stt?: MockSpeechToTextAdapter;
    tts?: MockTextToSpeechAdapter;
    conversations?: ConversationStore;
    brain?: BrainTaskPort;
    answer?: VoiceAnswerPort;
    production?: boolean;
  } = {},
) {
  return new VoiceAssistantService({
    stt: opts.stt ?? new MockSpeechToTextAdapter({ transcript: 'What should I focus on today?' }),
    tts: opts.tts ?? new MockTextToSpeechAdapter(),
    conversations: opts.conversations ?? new InMemoryConversationStore(),
    brain: opts.brain ?? fakeBrain(),
    answer: opts.answer ?? fakeAnswer(),
    isProduction: () => opts.production ?? false,
    now: () => '2026-08-13T00:00:00.000Z',
    newConversationId: () => 'conv-1',
  });
}

describe('ANSWER intent → existing AI Q&A runtime', () => {
  it('routes an answer-like utterance to the AI runtime (not the Brain)', async () => {
    const stt = new MockSpeechToTextAdapter({ transcript: 'What should I focus on today?' });
    const brain = fakeBrain();
    const answer = fakeAnswer('Top priority: the report draft.');
    const s = service({ stt, brain, answer });

    const result = await s.handleUtterance('u1', {
      audio: { format: 'audio/webm', data: audio() },
    });

    expect(result.success).toBe(true);
    expect(result.data?.state).toBe('RESPONDING');
    expect(result.data?.text).toContain('Top priority');
    expect(brain.createTask).not.toHaveBeenCalled();
    expect(answer.ask).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', prompt: 'What should I focus on today?' }),
    );
    // TTS is additive — the text response stands alongside audio.
    expect(result.data?.audio).toBeDefined();
    expect(result.data?.audio?.format).toBe('audio/wav');
  });

  it('a failed AI answer still yields an honest RESPONDING turn with a fallback message', async () => {
    const s = service({
      answer: fakeAnswer(undefined).ask
        ? { ask: vi.fn(async () => ({ ok: false, error: 'nope' })) }
        : fakeAnswer(),
    });
    const result = await s.handleUtterance('u1', {
      audio: { format: 'audio/webm', data: audio() },
    });
    expect(result.success).toBe(true);
    expect(result.data?.state).toBe('RESPONDING');
    expect(result.data?.text).toContain('could not find an answer');
  });
});

describe('ACTION intent → existing Brain task pipeline', () => {
  it('creates and plans a non-sensitive action through the Brain', async () => {
    const stt = new MockSpeechToTextAdapter({ transcript: 'Create a weekly report' });
    const brain = fakeBrain();
    const s = service({ stt, brain });

    const result = await s.handleUtterance('u1', {
      audio: { format: 'audio/webm', data: audio() },
    });

    expect(result.success).toBe(true);
    expect(result.data?.state).toBe('RESPONDING');
    expect(result.data?.taskId).toBe('brain-1');
    expect(result.data?.taskStage).toBe('PLAN');
    expect(brain.createTask).toHaveBeenCalledWith('u1', 'Create a weekly report');
    expect(brain.plan).toHaveBeenCalledWith('u1', 'brain-1');
  });

  it('a failed Brain createTask yields an honest ERROR (never fabricated success)', async () => {
    const stt = new MockSpeechToTextAdapter({ transcript: 'Build the deployment pipeline' });
    const brain = fakeBrain({
      createTask: vi.fn(() => ({
        success: false,
        error: 'objective too short',
        code: 'INVALID_INPUT',
      })),
    });
    const s = service({ stt, brain });

    const result = await s.handleUtterance('u1', {
      audio: { format: 'audio/webm', data: audio() },
    });
    expect(result.success).toBe(true); // the turn itself succeeded honestly
    expect(result.data?.state).toBe('ERROR');
    expect(result.data?.code).toBe('BRAIN_FAILURE');
  });
});

describe('VOICE ≠ AUTHORIZATION — sensitive actions', () => {
  it('a sensitive utterance NEVER executes: turn ends WAITING_FOR_APPROVAL', async () => {
    const stt = new MockSpeechToTextAdapter({ transcript: 'Please delete my account now' });
    const brain = fakeBrain();
    const s = service({ stt, brain });

    const result = await s.handleUtterance('u1', {
      audio: { format: 'audio/webm', data: audio() },
    });

    expect(result.success).toBe(true);
    expect(result.data?.state).toBe('WAITING_FOR_APPROVAL');
    expect(result.data?.sensitiveActionsMentioned).toContain('delete');
    // The task may be created (so the existing approval flow has a target),
    // but plan/execute never run and the response never claims success.
    expect(brain.createTask).toHaveBeenCalled();
    expect(brain.plan).not.toHaveBeenCalled();
    expect(result.data?.text).not.toMatch(/\b(done|completed|executed)\b/i);
  });

  it('confirmSensitive is the ONLY approval path and uses the existing Brain approval', async () => {
    const brain = fakeBrain();
    const s = service({ brain });
    const conv = s.getConversation('u1', '') as never;
    void conv;

    // First the sensitive turn creates a conversation.
    const stt = new MockSpeechToTextAdapter({ transcript: 'Please delete my account now' });
    const s2 = service({ stt, brain });
    const turn = await s2.handleUtterance('u1', { audio: { format: 'audio/webm', data: audio() } });
    const conversationId = turn.data?.conversationId ?? '';

    // The transcript cannot approve — only the explicit non-voice
    // confirmSensitive path may call the Brain's approve.
    const confirmed = await s2.confirmSensitive('u1', {
      conversationId,
      taskId: 'brain-1',
      action: 'delete',
    });

    expect(confirmed.success).toBe(true);
    expect(confirmed.data?.state).toBe('RESPONDING');
    expect(brain.approve).toHaveBeenCalledWith('u1', 'brain-1', 'delete');
    expect(brain.plan).toHaveBeenCalledWith('u1', 'brain-1');
  });

  it('confirmSensitive refuses a foreign owner (owner isolation)', async () => {
    const brain = fakeBrain();
    const stt = new MockSpeechToTextAdapter({ transcript: 'Please delete my account now' });
    const s = service({ stt, brain });
    const turn = await s.handleUtterance('u1', { audio: { format: 'audio/webm', data: audio() } });

    const result = await s.confirmSensitive('u2', {
      conversationId: turn.data?.conversationId ?? '',
      taskId: 'brain-1',
      action: 'delete',
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
    expect(brain.approve).not.toHaveBeenCalled();
  });

  it('rejectSensitive cancels via the existing mechanism and never executes', async () => {
    const brain = fakeBrain();
    const stt = new MockSpeechToTextAdapter({ transcript: 'Please send this email now' });
    const s = service({ stt, brain });
    const turn = await s.handleUtterance('u1', { audio: { format: 'audio/webm', data: audio() } });

    const rejected = s.rejectSensitive('u1', {
      conversationId: turn.data?.conversationId ?? '',
      taskId: 'brain-1',
      action: 'send',
    });

    expect(rejected.success).toBe(true);
    expect(rejected.data?.state).toBe('CANCELLED');
    expect(rejected.data?.text).toMatch(/nothing was executed/i);
    expect(brain.reject).toHaveBeenCalledWith('u1', 'brain-1', 'send');
    expect(brain.approve).not.toHaveBeenCalled();
  });

  it('the assistant exposes no voice-only approval shortcut (structural)', () => {
    const s = service();
    const proto = Object.getPrototypeOf(s) as Record<string, unknown>;
    const names = Object.getOwnPropertyNames(proto);
    for (const forbidden of ['approve', 'grantApproval', 'authorizeFromTranscript']) {
      expect(names).not.toContain(forbidden);
    }
  });
});

describe('honest failure semantics', () => {
  it('STT failure yields an honest ERROR turn — never an actionable intent', async () => {
    const stt = new MockSpeechToTextAdapter();
    stt.failNext();
    const brain = fakeBrain();
    const s = service({ stt, brain });

    const result = await s.handleUtterance('u1', {
      audio: { format: 'audio/webm', data: audio() },
    });
    expect(result.success).toBe(true);
    expect(result.data?.state).toBe('ERROR');
    expect(result.data?.code).toBe('PROVIDER_FAILURE');
    expect(brain.createTask).not.toHaveBeenCalled();
  });

  it('TTS failure is NEVER a task failure — the text response stands', async () => {
    const tts = new MockTextToSpeechAdapter();
    tts.failNext();
    const s = service({ tts });

    const result = await s.handleUtterance('u1', {
      audio: { format: 'audio/webm', data: audio() },
    });
    expect(result.success).toBe(true);
    expect(result.data?.state).toBe('RESPONDING');
    expect(result.data?.text).toBeTruthy();
    expect(result.data?.ttsFailed).toBe(true);
    expect(result.data?.audio).toBeUndefined();
  });

  it('oversized audio is rejected before any provider call', async () => {
    const stt = new MockSpeechToTextAdapter();
    const transcribeSpy = vi.spyOn(stt, 'transcribe');
    const brain = fakeBrain();
    const s = service({ stt, brain });

    const result = await s.handleUtterance('u1', {
      audio: { format: 'audio/webm', data: new Uint8Array(MAX_AUDIO_BYTES + 1) },
    });
    expect(result.success).toBe(true);
    expect(result.data?.state).toBe('ERROR');
    expect(result.data?.code).toBe('INVALID_INPUT');
    expect(transcribeSpy).not.toHaveBeenCalled();
    expect(brain.createTask).not.toHaveBeenCalled();
  });

  it('a cancelled turn returns CANCELLED without touching the pipeline', async () => {
    const brain = fakeBrain();
    const s = service({ brain });
    const controller = new AbortController();
    controller.abort();

    const result = await s.handleUtterance(
      'u1',
      { audio: { format: 'audio/webm', data: audio() } },
      { signal: controller.signal },
    );
    expect(result.success).toBe(true);
    expect(result.data?.state).toBe('CANCELLED');
    expect(brain.createTask).not.toHaveBeenCalled();
  });

  it('refuses mock STT in production unless explicitly enabled', async () => {
    const s = service({ production: true });
    const result = await s.handleUtterance('u1', {
      audio: { format: 'audio/webm', data: audio() },
    });
    expect(result.success).toBe(true);
    expect(result.data?.state).toBe('ERROR');
    expect(result.data?.code).toBe('NOT_CONFIGURED');
  });

  it('an empty recording yields INVALID_INPUT before any provider call', async () => {
    const brain = fakeBrain();
    const s = service({ brain });
    const result = await s.handleUtterance('u1', {
      audio: { format: 'audio/webm', data: new Uint8Array(0) },
    });
    expect(result.success).toBe(true);
    expect(result.data?.state).toBe('ERROR');
    expect(result.data?.code).toBe('INVALID_INPUT');
    expect(brain.createTask).not.toHaveBeenCalled();
  });

  it('a pre-aborted signal returns CANCELLED before any provider call', async () => {
    const brain = fakeBrain();
    const s = service({ brain });
    const controller = new AbortController();
    controller.abort();
    const result = await s.handleUtterance(
      'u1',
      { audio: { format: 'audio/webm', data: audio() } },
      { signal: controller.signal },
    );
    expect(result.success).toBe(true);
    expect(result.data?.state).toBe('CANCELLED');
    expect(brain.createTask).not.toHaveBeenCalled();
  });

  it('a sensitive action whose Brain task creation fails yields an honest ERROR', async () => {
    const stt = new MockSpeechToTextAdapter({ transcript: 'Please delete my account now' });
    const brain = fakeBrain({
      createTask: vi.fn(() => ({ success: false, error: 'no', code: 'INTERNAL' })),
    });
    const s = service({ stt, brain });
    const result = await s.handleUtterance('u1', {
      audio: { format: 'audio/webm', data: audio() },
    });
    expect(result.success).toBe(true);
    expect(result.data?.state).toBe('ERROR');
    expect(result.data?.code).toBe('BRAIN_FAILURE');
  });

  it('confirmSensitive refuses a missing conversation (owner isolation)', async () => {
    const brain = fakeBrain();
    const s = service({ brain });
    const result = await s.confirmSensitive('u1', {
      conversationId: 'missing',
      taskId: 'brain-1',
      action: 'delete',
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
    expect(brain.approve).not.toHaveBeenCalled();
  });

  it('confirmSensitive requires the Brain approval surface (no silent bypass)', async () => {
    const stt = new MockSpeechToTextAdapter({ transcript: 'Please delete my account now' });
    const brain = { createTask: fakeBrain().createTask } as unknown as BrainTaskPort;
    const s = service({ stt, brain });
    const turn = await s.handleUtterance('u1', { audio: { format: 'audio/webm', data: audio() } });
    const result = await s.confirmSensitive('u1', {
      conversationId: turn.data?.conversationId ?? '',
      taskId: 'brain-1',
      action: 'delete',
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_CONFIGURED');
  });

  it('rejectSensitive requires the Brain reject surface', async () => {
    const stt = new MockSpeechToTextAdapter({ transcript: 'Please delete my account now' });
    const brain = { createTask: fakeBrain().createTask } as unknown as BrainTaskPort;
    const s = service({ stt, brain });
    const turn = await s.handleUtterance('u1', { audio: { format: 'audio/webm', data: audio() } });
    const result = s.rejectSensitive('u1', {
      conversationId: turn.data?.conversationId ?? '',
      taskId: 'brain-1',
      action: 'delete',
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_CONFIGURED');
  });

  it('TTS is refused (not attempted) when mocks are disabled in production', async () => {
    // A REAL STT (so production accepts the transcript) + a MOCK TTS (which
    // production refuses) — proves the TTS mock gate fires independently.
    const realStt = {
      id: 'real-stt',
      kind: 'REAL' as const,
      capability: 'SPEECH_TO_TEXT' as const,
      transcribe: async (): Promise<{ text: string; confidence: number }> => ({
        text: 'What should I focus on today?',
        confidence: 0.9,
      }),
    };
    const tts = new MockTextToSpeechAdapter();
    const brain = fakeBrain();
    const s = service({
      stt: realStt as never,
      tts,
      brain,
      production: true,
    });
    const result = await s.handleUtterance('u1', {
      audio: { format: 'audio/webm', data: audio() },
    });
    expect(result.success).toBe(true);
    expect(result.data?.state).toBe('RESPONDING');
    expect(result.data?.audio).toBeUndefined();
    expect(result.data?.ttsFailed).toBeUndefined(); // TTS never attempted
  });

  it('a non-sensitive ACTION whose plan fails still reports the task honestly', async () => {
    const stt = new MockSpeechToTextAdapter({ transcript: 'Create a weekly report' });
    const brain = fakeBrain({
      plan: vi.fn(async () => ({ success: false, error: 'plan failed', code: 'PLAN_FAILED' })),
    });
    const s = service({ stt, brain });
    const result = await s.handleUtterance('u1', {
      audio: { format: 'audio/webm', data: audio() },
    });
    expect(result.success).toBe(true);
    expect(result.data?.state).toBe('RESPONDING');
    expect(result.data?.taskId).toBe('brain-1');
    expect(result.data?.text).toMatch(/track it on the Brain board/i);
  });
});

describe('conversation persistence — interaction artifacts, no promotion', () => {
  it('persists user + assistant turns owner-scoped', async () => {
    const conversations = new InMemoryConversationStore();
    const s = service({ conversations });

    const result = await s.handleUtterance('u1', {
      audio: { format: 'audio/webm', data: audio() },
    });
    const convId = result.data?.conversationId ?? '';

    const turns = conversations.turns('u1', convId);
    expect(turns.map((t) => t.role)).toEqual(['user', 'assistant']);
    expect(turns[0].text).toBe('What should I focus on today?');

    // Foreign owner sees nothing.
    expect(conversations.turns('u2', convId)).toHaveLength(0);
    expect(conversations.get('u2', convId)).toBeUndefined();
  });

  it('exposes NO promotion path into facts/preferences/outcomes/learning (structural)', () => {
    const s = service();
    const proto = Object.getPrototypeOf(s) as Record<string, unknown>;
    const names = Object.getOwnPropertyNames(proto);
    for (const forbidden of ['promote', 'recordFact', 'savePreference', 'recordOutcome', 'learn']) {
      expect(names).not.toContain(forbidden);
    }
  });

  it('unclear speech yields a clarifying response and persists both turns', async () => {
    const stt = new MockSpeechToTextAdapter({ transcript: 'um' });
    const brain = fakeBrain();
    const conversations = new InMemoryConversationStore();
    const s = service({ stt, brain, conversations });

    const result = await s.handleUtterance('u1', {
      audio: { format: 'audio/webm', data: audio() },
    });
    expect(result.success).toBe(true);
    expect(result.data?.state).toBe('RESPONDING');
    expect(result.data?.text).toMatch(/clarify|rephrase/i);
    expect(brain.createTask).not.toHaveBeenCalled();
    expect(conversations.turns('u1', result.data?.conversationId ?? '')).toHaveLength(2);
  });
});

// ── SPRINT-035 — Command Center PRESENTATION (VOICE ≠ AUTHORIZATION) ────────

describe('SPRINT-035 — Command Center presentation (read-only)', () => {
  function serviceWithPresent(
    presentContent: string | undefined,
    transcript = 'What should I focus on today?',
  ) {
    const stt = new MockSpeechToTextAdapter({ transcript });
    const brain = fakeBrain();
    const answer = fakeAnswer('Fallback AI answer.');
    const present = {
      ask: vi.fn(async (_input: { userId: string; question: string }) =>
        presentContent === undefined
          ? { ok: false, error: 'unavailable' }
          : { ok: true, content: presentContent },
      ),
    };
    const s = new VoiceAssistantService({
      stt,
      tts: new MockTextToSpeechAdapter(),
      conversations: new InMemoryConversationStore(),
      brain,
      answer,
      present,
      isProduction: () => false,
      now: () => '2026-08-15T00:00:00.000Z',
      newConversationId: () => 'conv-1',
    });
    return { s, brain, answer, present };
  }

  it('answers a presentation question from the world read models (never the Brain)', async () => {
    const { s, brain, answer, present } = serviceWithPresent(
      'Nothing urgent needs attention today — no spam by design.',
    );
    const result = await s.handleUtterance('u1', {
      audio: { format: 'audio/webm', data: audio() },
    });
    expect(result.success).toBe(true);
    expect(result.data?.state).toBe('RESPONDING');
    expect(result.data?.text).toContain('no spam by design');
    expect(present.ask).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', question: 'FOCUS_TODAY' }),
    );
    // The presentation path never touches the Brain (no task, no plan) and
    // never the generic AI runtime.
    expect(brain.createTask).not.toHaveBeenCalled();
    expect(answer.ask).not.toHaveBeenCalled();
  });

  it('falls back to the existing AI runtime when the presentation port is absent', async () => {
    const stt = new MockSpeechToTextAdapter({ transcript: 'What should I focus on today?' });
    const brain = fakeBrain();
    const answer = fakeAnswer('Fallback AI answer.');
    const s = new VoiceAssistantService({
      stt,
      tts: new MockTextToSpeechAdapter(),
      conversations: new InMemoryConversationStore(),
      brain,
      answer,
      isProduction: () => false,
      now: () => '2026-08-15T00:00:00.000Z',
      newConversationId: () => 'conv-1',
    });
    const result = await s.handleUtterance('u1', {
      audio: { format: 'audio/webm', data: audio() },
    });
    expect(result.success).toBe(true);
    expect(result.data?.text).toContain('Fallback AI answer');
    expect(answer.ask).toHaveBeenCalled();
  });

  it('falls back honestly when the presentation port fails — never a fabricated answer', async () => {
    const { s, present, answer } = serviceWithPresent(undefined);
    const result = await s.handleUtterance('u1', {
      audio: { format: 'audio/webm', data: audio() },
    });
    expect(result.success).toBe(true);
    expect(result.data?.state).toBe('RESPONDING');
    expect(result.data?.text).toContain('could not read the command center');
    expect(present.ask).toHaveBeenCalled();
    expect(answer.ask).not.toHaveBeenCalled();
  });

  it('keeps VOICE ≠ AUTHORIZATION: a sensitive action in a question still blocks', async () => {
    // The sensitive-action gate runs FIRST — even when the transcript could
    // be read as a question, a sensitive action never proceeds from voice.
    const stt = new MockSpeechToTextAdapter({
      transcript: 'What needs my approval to publish the website?',
    });
    const brain = fakeBrain();
    const present = {
      ask: vi.fn(async () => ({ ok: true, content: 'You have 1 pending approval.' })),
    };
    const s = new VoiceAssistantService({
      stt,
      tts: new MockTextToSpeechAdapter(),
      conversations: new InMemoryConversationStore(),
      brain,
      answer: fakeAnswer(),
      present,
      isProduction: () => false,
      now: () => '2026-08-15T00:00:00.000Z',
      newConversationId: () => 'conv-1',
    });
    const result = await s.handleUtterance('u1', {
      audio: { format: 'audio/webm', data: audio() },
    });
    expect(result.success).toBe(true);
    expect(result.data?.state).toBe('WAITING_FOR_APPROVAL');
    // The presentation port was never consulted for a sensitive action.
    expect(present.ask).not.toHaveBeenCalled();
  });
});
