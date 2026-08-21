// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Voice · SpeechApplicationService tests
// SPRINT-027 — Phase 3/4/5 · speech seams + safety contract through the
// real service composition (mock adapters, real stores, real gate).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { SpeechApplicationService } from '../application/SpeechApplicationService.js';
import {
  MockSpeechToTextAdapter,
  MockSpeechFailureError,
} from '../infrastructure/MockSpeechToTextAdapter.js';
import { MockTextToSpeechAdapter } from '../infrastructure/MockTextToSpeechAdapter.js';
import { InMemoryConversationStore } from '../infrastructure/InMemoryConversationStore.js';
import { MAX_AUDIO_BYTES, MAX_SYNTHESIS_TEXT_LENGTH } from '../domain/ConversationPolicy.js';
import type { ConversationStore } from '../contracts/voice-ports.js';

function service(
  opts: {
    stt?: MockSpeechToTextAdapter;
    tts?: MockTextToSpeechAdapter;
    conversations?: ConversationStore;
    production?: boolean;
  } = {},
): SpeechApplicationService {
  return new SpeechApplicationService({
    stt: opts.stt ?? new MockSpeechToTextAdapter(),
    tts: opts.tts ?? new MockTextToSpeechAdapter(),
    conversations: opts.conversations ?? new InMemoryConversationStore(),
    isProduction: (): boolean => opts.production ?? false,
  });
}

const audio = (bytes = 1024): Uint8Array => new Uint8Array(bytes).fill(7);

describe('speech status honesty', () => {
  it('reports MOCK (never CONFIGURED) for mock adapters and no real speech', () => {
    const s = service();
    expect(s.speechStatus()).toMatchObject({
      stt: 'MOCK',
      tts: 'MOCK',
      realSpeechAvailable: false,
    });
  });

  it('reports CONFIGURED only for a REAL adapter', () => {
    const real = {
      id: 'real-stt',
      kind: 'REAL' as const,
      capability: 'SPEECH_TO_TEXT' as const,
      async transcribe(): Promise<{ text: string; confidence: number }> {
        return { text: 'hi', confidence: 1 };
      },
    };
    const s = new SpeechApplicationService({
      stt: real,
      tts: new MockTextToSpeechAdapter(),
      conversations: new InMemoryConversationStore(),
    });
    expect(s.speechStatus().stt).toBe('CONFIGURED');
    expect(s.speechStatus().realSpeechAvailable).toBe(true);
  });

  it('live probe reports UNAVAILABLE for a REAL adapter whose probe is down', async () => {
    const down = {
      id: 'down-stt',
      kind: 'REAL' as const,
      capability: 'SPEECH_TO_TEXT' as const,
      async probe(): Promise<{ available: boolean }> {
        return { available: false };
      },
      async transcribe(): Promise<{ text: string; confidence: number }> {
        return { text: 'hi', confidence: 1 };
      },
    };
    const s = new SpeechApplicationService({
      stt: down,
      tts: new MockTextToSpeechAdapter(),
      conversations: new InMemoryConversationStore(),
    });
    const status = await s.probeSpeechStatus();
    expect(status.stt).toBe('UNAVAILABLE');
  });

  it('live probe reports ERROR when the probe itself throws', async () => {
    const flaky = {
      id: 'flaky-stt',
      kind: 'REAL' as const,
      capability: 'SPEECH_TO_TEXT' as const,
      async probe(): Promise<{ available: boolean }> {
        throw new Error('probe exploded');
      },
      async transcribe(): Promise<{ text: string; confidence: number }> {
        return { text: 'hi', confidence: 1 };
      },
    };
    const s = new SpeechApplicationService({
      stt: flaky,
      tts: new MockTextToSpeechAdapter(),
      conversations: new InMemoryConversationStore(),
    });
    const status = await s.probeSpeechStatus();
    expect(status.stt).toBe('ERROR');
  });

  it('live probe reports CONFIGURED for an operator-declared REAL adapter without a probe surface', async () => {
    const declared = {
      id: 'declared-stt',
      kind: 'REAL' as const,
      capability: 'SPEECH_TO_TEXT' as const,
      async transcribe(): Promise<{ text: string; confidence: number }> {
        return { text: 'hi', confidence: 1 };
      },
    };
    const s = new SpeechApplicationService({
      stt: declared,
      tts: new MockTextToSpeechAdapter(),
      conversations: new InMemoryConversationStore(),
    });
    const status = await s.probeSpeechStatus();
    expect(status.stt).toBe('CONFIGURED');
  });

  it('live probe leaves MOCK adapters as MOCK (never CONFIGURED)', async () => {
    const s = service();
    const status = await s.probeSpeechStatus();
    expect(status.stt).toBe('MOCK');
    expect(status.tts).toBe('MOCK');
  });
});

describe('transcribe seam (mock)', () => {
  it('transcribes deterministically within bounds', async () => {
    const s = service();
    const result = await s.transcribe('alice', { format: 'audio/webm', data: audio() });
    expect(result.success).toBe(true);
    expect(result.data?.text).toContain('1024 bytes');
    expect(result.data?.confidence).toBeGreaterThan(0.8);
  });

  it('rejects oversized or empty payloads (bounded input)', async () => {
    const s = service();
    const oversize = await s.transcribe('alice', {
      format: 'audio/webm',
      data: new Uint8Array(MAX_AUDIO_BYTES + 1),
    });
    expect(oversize.success).toBe(false);
    expect(oversize.code).toBe('INVALID_INPUT');
    const empty = await s.transcribe('alice', { format: 'audio/webm', data: new Uint8Array(0) });
    expect(empty.code).toBe('INVALID_INPUT');
  });

  it('surfaces provider failure honestly (provider failure)', async () => {
    const stt = new MockSpeechToTextAdapter();
    stt.failNext();
    const s = service({ stt });
    const result = await s.transcribe('alice', { format: 'audio/webm', data: audio() });
    expect(result.success).toBe(false);
    expect(result.code).toBe('PROVIDER_FAILURE');
    expect(result.data).toBeUndefined();
  });

  it('cancellation returns CANCELLED without invoking the provider', async () => {
    const s = service();
    const controller = new AbortController();
    controller.abort();
    const result = await s.transcribe(
      'alice',
      { format: 'audio/webm', data: audio() },
      controller.signal,
    );
    expect(result.success).toBe(false);
    expect(result.code).toBe('CANCELLED');
  });

  it('refuses mock transcription in production unless explicitly enabled', async () => {
    const s = service({ production: true });
    const result = await s.transcribe('alice', { format: 'audio/webm', data: audio() });
    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_CONFIGURED');
    expect(result.error).toContain('VOICE_ENABLE_MOCK');
  });

  it('explicit VOICE_ENABLE_MOCK allows the mock in a production-like environment', async () => {
    const s = new SpeechApplicationService({
      stt: new MockSpeechToTextAdapter(),
      tts: new MockTextToSpeechAdapter(),
      conversations: new InMemoryConversationStore(),
      allowMockInProduction: true,
      isProduction: (): boolean => true,
    });
    const result = await s.transcribe('alice', { format: 'audio/webm', data: audio() });
    expect(result.success).toBe(true);
  });

  it('a thrown provider error never crashes the service', async () => {
    const stt = new MockSpeechToTextAdapter({ transcript: 'canned' });
    stt.failNext();
    const s = service({ stt });
    await expect(
      s.transcribe('alice', { format: 'audio/webm', data: audio() }),
    ).resolves.toMatchObject({
      success: false,
      code: 'PROVIDER_FAILURE',
    });
    // The mock failure error is a typed, identifiable error (never swallowed
    // into an ambiguous string).
    const err = new MockSpeechFailureError('boom');
    expect(err).toBeInstanceOf(MockSpeechFailureError);
    expect(err.message).toBe('boom');
  });

  it('a non-Error provider rejection is normalized (no raw leakage)', async () => {
    const stt = {
      id: 'odd-stt',
      kind: 'MOCK' as const,
      capability: 'SPEECH_TO_TEXT' as const,
      async transcribe(): Promise<{ text: string; confidence: number }> {
        throw 'raw string rejection'; // not an Error
      },
    };
    const s = new SpeechApplicationService({
      stt: stt as never,
      tts: new MockTextToSpeechAdapter(),
      conversations: new InMemoryConversationStore(),
    });
    const result = await s.transcribe('alice', { format: 'audio/webm', data: audio() });
    expect(result.success).toBe(false);
    expect(result.code).toBe('PROVIDER_FAILURE');
    expect(result.error).toBe('Speech-to-text provider failed.');
  });
});

describe('synthesize seam (mock)', () => {
  it('synthesizes bounded audio deterministically', async () => {
    const s = service();
    const result = await s.synthesize('alice', 'Hello there');
    expect(result.success).toBe(true);
    expect(result.data?.format).toBe('audio/wav');
    expect(result.data?.audio.length ?? 0).toBeGreaterThan(44);
  });

  it('rejects empty or oversized text', async () => {
    const s = service();
    const empty = await s.synthesize('alice', '');
    expect(empty.code).toBe('INVALID_INPUT');
    const oversize = await s.synthesize('alice', 'x'.repeat(MAX_SYNTHESIS_TEXT_LENGTH + 1));
    expect(oversize.code).toBe('INVALID_INPUT');
  });

  it('provider failure is surfaced, never swallowed', async () => {
    const tts = new MockTextToSpeechAdapter();
    tts.failNext();
    const s = service({ tts });
    const result = await s.synthesize('alice', 'Hello');
    expect(result.success).toBe(false);
    expect(result.code).toBe('PROVIDER_FAILURE');
  });

  it('a non-Error TTS rejection is normalized', async () => {
    const tts = {
      id: 'odd-tts',
      kind: 'MOCK' as const,
      capability: 'TEXT_TO_SPEECH' as const,
      async synthesize(): Promise<{ audio: Uint8Array; format: string }> {
        throw 42; // not an Error
      },
    };
    const s = new SpeechApplicationService({
      stt: new MockSpeechToTextAdapter(),
      tts: tts as never,
      conversations: new InMemoryConversationStore(),
    });
    const result = await s.synthesize('alice', 'Hello');
    expect(result.success).toBe(false);
    expect(result.code).toBe('PROVIDER_FAILURE');
  });

  it('refuses mock TTS in production unless explicitly enabled', async () => {
    const s = service({ production: true });
    const result = await s.synthesize('alice', 'Hello');
    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_CONFIGURED');
  });
});

describe('conversation composition (owner-scoped, bounded)', () => {
  it('creates, appends, reads and clears owner conversations', async () => {
    const s = service();
    const conv = s.createConversation('alice', 'Morning check-in');
    const turn1 = s.appendTurn('alice', conv.id, 'user', 'What should I focus on?');
    expect(turn1.success).toBe(true);
    s.appendTurn('alice', conv.id, 'assistant', 'Top priority: finish the report draft.');
    expect(s.getConversation('alice', conv.id)?.turns.length).toBe(2);
    expect(s.turns('alice', conv.id)).toHaveLength(2);
    s.clearConversation('alice', conv.id);
    expect(s.getConversation('alice', conv.id)).toBeUndefined();
  });

  it('refuses cross-user conversation access', () => {
    const s = service();
    const conv = s.createConversation('alice');
    expect(s.getConversation('bob', conv.id)).toBeUndefined();
    const turn = s.appendTurn('bob', conv.id, 'user', 'hi');
    expect(turn.success).toBe(false);
    expect(turn.code).toBe('NOT_FOUND');
  });

  it('rejects empty turn text', () => {
    const s = service();
    const conv = s.createConversation('alice');
    const turn = s.appendTurn('alice', conv.id, 'user', '   ');
    expect(turn.success).toBe(false);
    expect(turn.code).toBe('INVALID_INPUT');
  });
});

describe('VOICE ≠ AUTHORIZATION through the service', () => {
  it('classify flags sensitive intents; assessAction never grants on transcript alone', () => {
    const s = service();
    const assessment = s.classify('Send this email to the client');
    expect(assessment.sensitiveActionsMentioned).toContain('send');
    expect(assessment.requiresExplicitConfirmation).toBe(true);
    expect(s.assessAction('Send this email to the client', 'send')).toEqual({
      decision: 'NO_EXECUTION',
      reason: 'AWAITING_APPROVAL',
    });
  });

  it('the service exposes no approval-granting method (structural)', () => {
    const s = service() as unknown as Record<string, unknown>;
    const names = Object.getOwnPropertyNames(Object.getPrototypeOf(s));
    for (const forbidden of ['approve', 'grantApproval', 'authorize', 'recordApproval']) {
      expect(names).not.toContain(forbidden);
    }
  });
});
