// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway: Voice Assistant namespace tests
// SPRINT-028 — the voice → Brain bridge through the REAL tRPC pipeline.
//
// Exercises the voice.* assistant procedures (auth + rate-limit middleware +
// RouterRegistry handler closures):
//   status            — live-probed honesty: MOCK for mocks, CONFIGURED only
//                       for a REAL adapter, UNAVAILABLE when configured-down.
//   handleUtterance   — ANSWER → AI Q&A; ACTION → Brain task; sensitive →
//                       WAITING_FOR_APPROVAL (never executed).
//   confirmSensitive  — THE ONLY approval path; non-voice → Brain.approve.
//   rejectSensitive   — no execution, honest CANCELLED.
//   IDOR             — a foreign userId is refused by the gateway guard.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  SpeechApplicationService,
  VoiceAssistantService,
  MockSpeechToTextAdapter,
  MockTextToSpeechAdapter,
  InMemoryConversationStore,
  RuntimeSpeechToTextAdapter,
} from '@vedmoulya/voice';
import { createAppRouter } from '../services/RouterRegistry.js';
import type { ApiApplicationService } from '../services/ApiApplicationService.js';

function fakeBrain() {
  return {
    createTask: (userId: string, input: string) => ({
      success: true,
      data: {
        id: `brain-${input.length}`,
        objective: input,
        status: 'NEW',
        stage: 'UNDERSTANDING',
      },
    }),
    plan: async () => ({
      success: true,
      data: { id: 'brain-x', status: 'RUNNING', stage: 'PLAN' },
    }),
    approve: () => ({
      success: true,
      data: { id: 'brain-x', objective: 'x', status: 'RUNNING', stage: 'EXECUTION' },
    }),
    reject: () => ({
      success: true,
      data: { id: 'brain-x', objective: 'x', status: 'CANCELLED', stage: 'CANCELLED' },
    }),
  };
}

function fakeAnswer() {
  return { ask: async () => ({ ok: true, content: 'Your top priority is the report draft.' }) };
}

function makeServices(transcript = 'What should I focus on today?'): ApiApplicationService {
  const conversations = new InMemoryConversationStore();
  const voice = new SpeechApplicationService({
    stt: new MockSpeechToTextAdapter({ transcript }),
    tts: new MockTextToSpeechAdapter(),
    conversations,
    isProduction: () => false,
  });
  const voiceAssistant = new VoiceAssistantService({
    stt: new MockSpeechToTextAdapter({ transcript }),
    tts: new MockTextToSpeechAdapter(),
    conversations,
    brain: fakeBrain() as never,
    answer: fakeAnswer() as never,
    isProduction: () => false,
    now: () => '2026-08-13T00:00:00.000Z',
    newConversationId: () => 'conv-1',
  });
  return { voice, voiceAssistant } as unknown as ApiApplicationService;
}

const ctx = (userId: string) => ({ userId, email: `${userId}@vm.local`, role: 'user' });
const audio = Buffer.from('mock audio bytes for utterance').toString('base64');

interface TurnData {
  state: string;
  transcript: string;
  text: string;
  conversationId?: string;
  taskId?: string;
  sensitiveActionsMentioned?: string[];
  audio?: { format: string; data?: string };
  ttsFailed?: boolean;
}

describe('voice assistant (SPRINT-028)', () => {
  it('handleUtterance routes an ANSWER intent to the AI Q&A runtime and persists a conversation', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('v-1'));
    const result = await caller.voice.handleUtterance({
      userId: 'v-1',
      format: 'audio/webm',
      audioBase64: audio,
    });

    expect(result.success).toBe(true);
    const turn = result.data as TurnData;
    expect(turn.state).toBe('RESPONDING');
    expect(turn.text).toContain('report draft');
    expect(turn.conversationId).toBeTruthy();

    const list = await caller.voice.listConversations({ userId: 'v-1' });
    expect((list.data as unknown[]).length).toBe(1);
  });

  it('handleUtterance routes a non-sensitive ACTION to the Brain task pipeline', async () => {
    const router = createAppRouter(makeServices('Create a weekly report'));
    const caller = router.createCaller(ctx('v-1'));
    const result = await caller.voice.handleUtterance({
      userId: 'v-1',
      format: 'audio/webm',
      audioBase64: audio,
    });

    expect(result.success).toBe(true);
    const turn = result.data as TurnData;
    expect(turn.state).toBe('RESPONDING');
    expect(turn.taskId).toBeTruthy();
    expect(turn.taskStage).toBe('PLAN');
  });

  it('handleUtterance NEVER executes a sensitive action: WAITING_FOR_APPROVAL', async () => {
    const router = createAppRouter(makeServices('Please delete my account now'));
    const caller = router.createCaller(ctx('v-1'));
    const result = await caller.voice.handleUtterance({
      userId: 'v-1',
      format: 'audio/webm',
      audioBase64: audio,
    });

    expect(result.success).toBe(true);
    const turn = result.data as TurnData;
    expect(turn.state).toBe('WAITING_FOR_APPROVAL');
    expect(turn.sensitiveActionsMentioned).toContain('delete');
    expect(turn.taskId).toBeTruthy();
    expect(turn.text).not.toMatch(/\b(done|completed|executed)\b/i);
  });

  it('confirmSensitive is the ONLY approval path — non-voice → Brain approval → planned', async () => {
    const router = createAppRouter(makeServices('Please delete my account now'));
    const caller = router.createCaller(ctx('v-1'));
    const turnResult = await caller.voice.handleUtterance({
      userId: 'v-1',
      format: 'audio/webm',
      audioBase64: audio,
    });
    const turn = turnResult.data as TurnData;

    const confirmed = await caller.voice.confirmSensitive({
      userId: 'v-1',
      conversationId: turn.conversationId ?? '',
      taskId: turn.taskId ?? '',
      action: 'delete',
    });

    expect(confirmed.success).toBe(true);
    const result = confirmed.data as TurnData;
    expect(result.state).toBe('RESPONDING');
    expect(result.text).toMatch(/approved/i);
  });

  it('rejectSensitive cancels via the existing mechanism — nothing executed', async () => {
    const router = createAppRouter(makeServices('Please delete my account now'));
    const caller = router.createCaller(ctx('v-1'));
    const turnResult = await caller.voice.handleUtterance({
      userId: 'v-1',
      format: 'audio/webm',
      audioBase64: audio,
    });
    const turn = turnResult.data as TurnData;

    const rejected = await caller.voice.rejectSensitive({
      userId: 'v-1',
      conversationId: turn.conversationId ?? '',
      taskId: turn.taskId ?? '',
      action: 'delete',
    });

    expect(rejected.success).toBe(true);
    const result = rejected.data as TurnData;
    expect(result.state).toBe('CANCELLED');
    expect(result.text).toMatch(/nothing was executed/i);
  });

  it('handleUtterance refuses an oversized payload with INVALID_INPUT', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('v-1'));
    const result = await caller.voice.handleUtterance({
      userId: 'v-1',
      format: 'audio/webm',
      audioBase64: 'A'.repeat(15 * 1024 * 1024),
    });
    expect(result.success).toBe(false);
    expect((result.error as { details?: { voiceCode?: string } }).details?.voiceCode).toBe(
      'INVALID_INPUT',
    );
  });

  it('a foreign userId on handleUtterance is refused by the gateway guard (IDOR)', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('v-1'));
    await expect(
      caller.voice.handleUtterance({ userId: 'v-2', format: 'audio/webm', audioBase64: audio }),
    ).rejects.toThrow(/not authorized/i);
  });

  it('a foreign userId on confirmSensitive is refused by the gateway guard (IDOR)', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('v-1'));
    await expect(
      caller.voice.confirmSensitive({
        userId: 'v-2',
        conversationId: 'conv-1',
        taskId: 'brain-1',
        action: 'delete',
      }),
    ).rejects.toThrow(/not authorized/i);
  });

  it('status reports MOCK honestly through the live probe (never CONFIGURED)', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('v-1'));
    const result = await caller.voice.status({ userId: 'v-1' });
    expect(result.success).toBe(true);
    const status = result.data as { stt: string; tts: string; realSpeechAvailable: boolean };
    expect(status.stt).toBe('MOCK');
    expect(status.tts).toBe('MOCK');
    expect(status.realSpeechAvailable).toBe(false);
  });

  it('status reports UNAVAILABLE for a REAL adapter whose provider is down', async () => {
    // A REAL adapter wired against an endpoint that will never answer.
    const conversations = new InMemoryConversationStore();
    const downStt = new RuntimeSpeechToTextAdapter({
      baseUrl: 'https://stt.invalid.invalid/v1',
      probePath: '/models',
      fetchFn: (async () => {
        throw new Error('unreachable');
      }) as typeof fetch,
    });
    const voice = new SpeechApplicationService({
      stt: downStt,
      tts: new MockTextToSpeechAdapter(),
      conversations,
      isProduction: () => false,
    });
    const router = createAppRouter({ voice } as unknown as ApiApplicationService);
    const caller = router.createCaller(ctx('v-1'));
    const result = await caller.voice.status({ userId: 'v-1' });

    expect(result.success).toBe(true);
    const status = result.data as { stt: string; tts: string };
    expect(status.stt).toBe('UNAVAILABLE');
    expect(status.tts).toBe('MOCK');
  });

  it('status reports CONFIGURED for a REAL adapter that answers the probe', async () => {
    const conversations = new InMemoryConversationStore();
    const liveStt = new RuntimeSpeechToTextAdapter({
      baseUrl: 'https://stt.example.com/v1',
      probePath: '/models',
      fetchFn: (async () => new Response('{"data":[]}', { status: 200 })) as typeof fetch,
    });
    const voice = new SpeechApplicationService({
      stt: liveStt,
      tts: new MockTextToSpeechAdapter(),
      conversations,
      isProduction: () => false,
    });
    const router = createAppRouter({ voice } as unknown as ApiApplicationService);
    const caller = router.createCaller(ctx('v-1'));
    const result = await caller.voice.status({ userId: 'v-1' });

    expect(result.success).toBe(true);
    const status = result.data as { stt: string; tts: string };
    expect(status.stt).toBe('CONFIGURED');
  });
});
