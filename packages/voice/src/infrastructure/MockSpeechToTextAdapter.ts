// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Voice · MockSpeechToTextAdapter
// SPRINT-027 — hermetic STT seam for deterministic tests (the same role the
// MockProvider plays for text). NEVER claims real speech: kind is MOCK and
// the service refuses mock transcription in production unless explicitly
// enabled (VOICE_ENABLE_MOCK=true), mirroring AI_ENABLE_MOCK.
// ─────────────────────────────────────────────────────────────────────────────

import type { SpeechToTextPort } from '../contracts/voice-ports.js';
import type { SpeechToTextResult } from '../types/voice-types.js';

/** Thrown by the mock when failure injection is armed (provider-failure path). */
export class MockSpeechFailureError extends Error {
  constructor(message = 'mock STT provider failed') {
    super(message);
    this.name = 'MockSpeechFailureError';
  }
}

export interface MockSpeechToTextOptions {
  /** Canned transcript (default: a deterministic description of the input). */
  transcript?: string;
  /** Fixed confidence returned for every successful call. */
  confidence?: number;
  /** When true, the next transcribe() call throws (provider failure test). */
  failNext?: boolean;
}

export class MockSpeechToTextAdapter implements SpeechToTextPort {
  readonly id = 'mock-stt';
  readonly kind = 'MOCK' as const;
  readonly capability = 'SPEECH_TO_TEXT' as const;
  private readonly canned: string | undefined;
  private readonly fixedConfidence: number;
  private failArmed = false;

  constructor(options: MockSpeechToTextOptions = {}) {
    this.canned = options.transcript;
    this.fixedConfidence = options.confidence ?? 0.9;
    this.failArmed = options.failNext ?? false;
  }

  /** Arm a one-shot provider failure (for failure-path tests). */
  failNext(): void {
    this.failArmed = true;
  }

  // Sync implementation of the async port — the mock does no I/O, so there is
  // nothing to await; Promise.resolve keeps the port contract (the same pattern
  // the gateway's in-memory repositories use).
  transcribe(input: {
    ownerId: string;
    audio: { format: string; data: Uint8Array };
    signal?: AbortSignal;
  }): Promise<SpeechToTextResult> {
    if (input.signal?.aborted === true) {
      return Promise.resolve({ text: '', confidence: 0, aborted: true });
    }
    if (this.failArmed) {
      this.failArmed = false;
      return Promise.reject(new MockSpeechFailureError());
    }
    // Deterministic: the transcript is fully determined by the input bytes.
    const text =
      this.canned ??
      `[mock transcription of ${String(input.audio.data.length)} bytes of ${input.audio.format}]`;
    return Promise.resolve({ text, locale: 'en', confidence: this.fixedConfidence });
  }
}
