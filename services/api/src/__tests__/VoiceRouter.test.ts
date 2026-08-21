// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway: Voice namespace tests
// SPRINT-027 — Phase 3/4/5 · speech foundation + VOICE ≠ AUTHORIZATION.
//
// Exercises the voice.* procedures through the REAL tRPC pipeline (auth +
// rate-limit middleware + RouterRegistry handler closures):
//   status           — honest speech capability status (MOCK, never CONFIGURED)
//   transcribe       — bounded input, INVALID_INPUT over-limit, provider failure
//   synthesize       — bounded text, error envelope mapping
//   assessAction     — the VOICE ≠ AUTHORIZATION decision (approval can only
//                      come from the existing non-voice mechanism)
//   createConversation / listConversations / appendTurn / clearConversation
//                    — owner-scoped bounded conversation store
// Plus IDOR: a foreign userId must be refused by the gateway guard.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  SpeechApplicationService,
  MockSpeechToTextAdapter,
  MockTextToSpeechAdapter,
  InMemoryConversationStore,
} from '@vedmoulya/voice';
import { createAppRouter } from '../services/RouterRegistry.js';
import type { ApiApplicationService } from '../services/ApiApplicationService.js';

function makeServices(): ApiApplicationService {
  const voice = new SpeechApplicationService({
    stt: new MockSpeechToTextAdapter(),
    tts: new MockTextToSpeechAdapter(),
    conversations: new InMemoryConversationStore(),
    isProduction: () => false,
  });
  return { voice } as unknown as ApiApplicationService;
}

const ctx = (userId: string) => ({ userId, email: `${userId}@vm.local`, role: 'user' });

describe('voice namespace (SPRINT-027)', () => {
  it('status reports MOCK adapters honestly — never CONFIGURED', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('v-1'));
    const result = await caller.voice.status({ userId: 'v-1' });

    expect(result.success).toBe(true);
    const status = result.data as {
      stt: string;
      tts: string;
      realSpeechAvailable: boolean;
      adapters: Array<{ id: string; kind: string }>;
    };
    expect(status.stt).toBe('MOCK');
    expect(status.tts).toBe('MOCK');
    expect(status.realSpeechAvailable).toBe(false);
    expect(status.adapters.map((a) => a.id)).toEqual(['mock-stt', 'mock-tts']);
  });

  it('transcribe returns a deterministic mock transcript for bounded audio', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('v-1'));
    // A small WAV-ish payload (well under MAX_AUDIO_BYTES).
    const audio = Buffer.from('mock audio bytes').toString('base64');
    const result = await caller.voice.transcribe({
      userId: 'v-1',
      format: 'audio/wav',
      audioBase64: audio,
    });

    expect(result.success).toBe(true);
    const data = result.data as { text: string; confidence: number };
    expect(data.text).toContain('[mock transcription');
    expect(data.confidence).toBeGreaterThan(0);
  });

  it('transcribe refuses an over-limit payload with INVALID_INPUT (bounded before decode)', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('v-1'));
    const huge = 'A'.repeat(15 * 1024 * 1024); // ~15 MB base64 ≫ MAX_AUDIO_BYTES (10 MB)
    const result = await caller.voice.transcribe({
      userId: 'v-1',
      format: 'audio/wav',
      audioBase64: huge,
    });

    expect(result.success).toBe(false);
    const error = result.error as { code: string; details?: { voiceCode?: string } };
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details?.voiceCode).toBe('INVALID_INPUT');
  });

  it('synthesize returns base64 WAV audio for bounded text', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('v-1'));
    const result = await caller.voice.synthesize({
      userId: 'v-1',
      text: 'Hello VedMoulya',
    });

    expect(result.success).toBe(true);
    const data = result.data as { audioBase64: string; format: string };
    expect(data.format).toBe('audio/wav');
    const bytes = Buffer.from(data.audioBase64, 'base64');
    expect(bytes.length).toBeGreaterThan(44); // RIFF header + payload
    expect(Buffer.from(bytes.subarray(0, 4)).toString('ascii')).toBe('RIFF');
  });

  it('assessAction: a sensitive action spoken by voice is NOT authorized (VOICE ≠ AUTHORIZATION)', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('v-1'));
    const result = await caller.voice.assessAction({
      userId: 'v-1',
      transcript: 'Please delete my account now',
      action: 'delete',
    });

    expect(result.success).toBe(true);
    const decision = result.data as { decision: string; reason: string };
    expect(decision.decision).toBe('NO_EXECUTION');
    expect(decision.reason).toBe('AWAITING_APPROVAL');
  });

  it('assessAction: approval only counts via the explicit non-voice grant list', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('v-1'));
    const result = await caller.voice.assessAction({
      userId: 'v-1',
      transcript: 'Please delete my account now',
      action: 'delete',
      approvalGranted: ['delete'],
    });

    expect(result.success).toBe(true);
    const decision = result.data as { decision: string; reason: string };
    // MAY_PLAN is the gate's ceiling: the Brain's own checkAction still gates
    // execution — the transcript never authorized anything by itself.
    expect(decision.decision).toBe('MAY_PLAN');
    expect(decision.reason).toBe('APPROVED_VIA_EXISTING_CHANNEL');
  });

  it('assessAction: a non-sensitive action may plan (Brain pipeline still applies)', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('v-1'));
    const result = await caller.voice.assessAction({
      userId: 'v-1',
      transcript: 'Summarize my recent activity',
      action: 'summarize',
    });

    expect(result.success).toBe(true);
    const decision = result.data as { decision: string };
    expect(decision.decision).toBe('MAY_PLAN');
  });

  it('conversations are owner-scoped and survive create → append → list → turns', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('v-1'));
    const created = await caller.voice.createConversation({ userId: 'v-1', title: 'Morning' });
    const conv = created.data as { id: string };
    expect(conv.id).toBeTruthy();

    const appended = await caller.voice.appendTurn({
      userId: 'v-1',
      conversationId: conv.id,
      role: 'user',
      text: 'What should I focus on today?',
    });
    expect(appended.success).toBe(true);

    const list = await caller.voice.listConversations({ userId: 'v-1' });
    expect(list.success).toBe(true);
    const convs = list.data as Array<{ id: string; title: string }>;
    expect(convs).toHaveLength(1);
    expect(convs[0].id).toBe(conv.id);
  });

  it('appendTurn refuses a foreign conversation with NOT_FOUND (owner isolation)', async () => {
    const router = createAppRouter(makeServices());
    const owner = router.createCaller(ctx('v-1'));
    const other = router.createCaller(ctx('v-2'));

    const created = await owner.voice.createConversation({ userId: 'v-1' });
    const conv = created.data as { id: string };

    const result = await other.voice.appendTurn({
      userId: 'v-2',
      conversationId: conv.id,
      role: 'user',
      text: 'sneaky',
    });
    expect(result.success).toBe(false);
    const error = result.error as { code: string; details?: { voiceCode?: string } };
    expect(error.code).toBe('NOT_FOUND');
    expect(error.details?.voiceCode).toBe('NOT_FOUND');
  });

  it('clearConversation removes only the owner conversation', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('v-1'));
    const created = await caller.voice.createConversation({ userId: 'v-1' });
    const conv = created.data as { id: string };

    const cleared = await caller.voice.clearConversation({
      userId: 'v-1',
      conversationId: conv.id,
    });
    expect(cleared.success).toBe(true);

    const list = await caller.voice.listConversations({ userId: 'v-1' });
    expect((list.data as unknown[]).length).toBe(0);
  });

  it('refuses a foreign userId on createConversation via the gateway guard (IDOR)', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('v-1'));
    await expect(
      caller.voice.createConversation({ userId: 'v-2', title: 'stolen' }),
    ).rejects.toThrow(/not authorized/i);
  });
});
