// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Voice · MockTextToSpeechAdapter
// SPRINT-027 — hermetic TTS seam for deterministic tests. Produces a valid
// placeholder WAV (44-byte header + silence) derived from the input text —
// real neural TTS is an operator-configured future adapter.
// ─────────────────────────────────────────────────────────────────────────────

import type { TextToSpeechPort } from '../contracts/voice-ports.js';
import type { TextToSpeechResult } from '../types/voice-types.js';

/** Thrown by the mock when failure injection is armed. */
export class MockSpeechFailureError extends Error {
  constructor(message = 'mock TTS provider failed') {
    super(message);
    this.name = 'MockSpeechFailureError';
  }
}

export interface MockTextToSpeechOptions {
  failNext?: boolean;
}

/** Deterministic WAV header for a silent 8kHz mono 16-bit payload. */
function wavHeader(sampleCount: number): Uint8Array {
  const header = new Uint8Array(44);
  const view = new DataView(header.buffer);
  const bytes = sampleCount * 2;
  view.setUint32(0, 0x52494646, false); // 'RIFF'
  view.setUint32(4, 36 + bytes, true); // chunk size
  view.setUint32(8, 0x57415645, false); // 'WAVE'
  view.setUint32(12, 0x666d7420, false); // 'fmt '
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true); // sample rate
  view.setUint32(28, 8000 * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  view.setUint32(36, 0x64617461, false); // 'data'
  view.setUint32(40, bytes, true);
  return header;
}

export class MockTextToSpeechAdapter implements TextToSpeechPort {
  readonly id = 'mock-tts';
  readonly kind = 'MOCK' as const;
  readonly capability = 'TEXT_TO_SPEECH' as const;
  private failArmed: boolean;

  constructor(options: MockTextToSpeechOptions = {}) {
    this.failArmed = options.failNext ?? false;
  }

  failNext(): void {
    this.failArmed = true;
  }

  // Sync implementation of the async port — the mock does no I/O, so there is
  // nothing to await; Promise.resolve keeps the port contract.
  synthesize(input: {
    ownerId: string;
    text: string;
    voice?: string;
    signal?: AbortSignal;
  }): Promise<TextToSpeechResult> {
    if (input.signal?.aborted === true) {
      return Promise.resolve({ audio: new Uint8Array(0), format: 'audio/wav', aborted: true });
    }
    if (this.failArmed) {
      this.failArmed = false;
      return Promise.reject(new MockSpeechFailureError());
    }
    // Deterministic: 80ms of silence per ~10 characters of text.
    const samples = Math.max(1, Math.ceil(input.text.length / 10)) * 640;
    const header = wavHeader(samples);
    const audio = new Uint8Array(44 + samples * 2);
    audio.set(header, 0);
    return Promise.resolve({ audio, format: 'audio/wav' });
  }
}
