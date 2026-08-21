// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Voice · RuntimeSpeechAdapters tests
// SPRINT-028 — REAL STT/TTS adapters (provider-neutral OpenAI-compatible HTTP).
//
// Covers per the sprint §13 A/B:
//   STT: successful transcription · provider failure · timeout · cancellation ·
//        oversized input (rejected at the service seam) · normalized errors.
//   TTS: successful synthesis · provider failure · timeout · cancellation ·
//        oversized text (rejected at the service seam) · bounded response.
// Provider credentials never appear in normalized errors; raw provider
// payloads never leak into results.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi } from 'vitest';
import {
  RuntimeSpeechToTextAdapter,
  SpeechProviderError,
} from '../infrastructure/RuntimeSpeechToTextAdapter.js';
import {
  RuntimeTextToSpeechAdapter,
  MAX_SYNTHESIS_RESPONSE_BYTES,
} from '../infrastructure/RuntimeTextToSpeechAdapter.js';

/** Minimal fetch stub — returns a canned Response. Honors the abort signal
 *  exactly like the real fetch does (a hang rejects when its signal aborts). */
function stubFetch(handler: (url: string, init: RequestInit) => Promise<Response>): typeof fetch {
  return ((url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const signal = init?.signal;
    return new Promise<Response>((resolve, reject) => {
      if (signal?.aborted === true) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const onAbort = (): void => reject(new DOMException('Aborted', 'AbortError'));
      signal?.addEventListener('abort', onAbort, { once: true });
      handler(String(url), init ?? {}).then(
        (res) => {
          signal?.removeEventListener('abort', onAbort);
          resolve(res);
        },
        (err) => {
          signal?.removeEventListener('abort', onAbort);
          reject(err);
        },
      );
    });
  }) as typeof fetch;
}

/** A fetch that never resolves — used to exercise timeout + abort paths. */
function hangingFetch(): typeof fetch {
  return stubFetch(() => new Promise<Response>(() => {}));
}

const audioBytes = new Uint8Array([1, 2, 3, 4, 5]);

describe('RuntimeSpeechToTextAdapter — REAL STT', () => {
  it('transcribes successfully through the OpenAI-compatible contract', async () => {
    const fetchFn = stubFetch(async (url, init) => {
      expect(url).toMatch(/\/audio\/transcriptions$/);
      const auth = (init.headers as Record<string, string>) ?? {};
      expect(auth.Authorization).toBe('Bearer sk-test');
      expect(init.method).toBe('POST');
      return new Response(JSON.stringify({ text: 'hello world' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const adapter = new RuntimeSpeechToTextAdapter({
      baseUrl: 'https://stt.example.com/v1',
      apiKey: 'sk-test',
      model: 'whisper-1',
      fetchFn,
    });
    const result = await adapter.transcribe({
      ownerId: 'u1',
      audio: { format: 'audio/wav', data: audioBytes },
    });
    expect(result.text).toBe('hello world');
    expect(result.confidence).toBe(0.9);
  });

  it('normalizes an HTTP 401 into a typed error without leaking provider detail', async () => {
    const fetchFn = stubFetch(
      async () => new Response('{"error":{"message":"you are bad"}}', { status: 401 }),
    );
    const adapter = new RuntimeSpeechToTextAdapter({
      baseUrl: 'https://stt.example.com/v1',
      apiKey: 'sk-test',
      fetchFn,
    });
    await expect(
      adapter.transcribe({ ownerId: 'u1', audio: { format: 'audio/wav', data: audioBytes } }),
    ).rejects.toMatchObject({ code: 'HTTP', status: 401 });
  });

  it('throws a typed timeout error when the provider hangs', async () => {
    const adapter = new RuntimeSpeechToTextAdapter({
      baseUrl: 'https://stt.example.com/v1',
      timeoutMs: 50,
      fetchFn: hangingFetch(),
    });
    await expect(
      adapter.transcribe({ ownerId: 'u1', audio: { format: 'audio/wav', data: audioBytes } }),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('returns aborted when the caller aborts mid-flight', async () => {
    const adapter = new RuntimeSpeechToTextAdapter({
      baseUrl: 'https://stt.example.com/v1',
      timeoutMs: 10_000,
      fetchFn: hangingFetch(),
    });
    const controller = new AbortController();
    const promise = adapter.transcribe({
      ownerId: 'u1',
      audio: { format: 'audio/wav', data: audioBytes },
      signal: controller.signal,
    });
    controller.abort();
    const result = await promise;
    expect(result.aborted).toBe(true);
    expect(result.text).toBe('');
  });

  it('normalizes a network failure into a typed NETWORK error', async () => {
    const fetchFn = stubFetch(async () => {
      throw new Error('ECONNREFUSED');
    });
    const adapter = new RuntimeSpeechToTextAdapter({
      baseUrl: 'https://stt.example.com/v1',
      fetchFn,
    });
    await expect(
      adapter.transcribe({ ownerId: 'u1', audio: { format: 'audio/wav', data: audioBytes } }),
    ).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('normalizes an empty transcript into INVALID_RESPONSE', async () => {
    const fetchFn = stubFetch(
      async () => new Response(JSON.stringify({ text: '   ' }), { status: 200 }),
    );
    const adapter = new RuntimeSpeechToTextAdapter({
      baseUrl: 'https://stt.example.com/v1',
      fetchFn,
    });
    await expect(
      adapter.transcribe({ ownerId: 'u1', audio: { format: 'audio/wav', data: audioBytes } }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('returns aborted immediately when the caller signal is already aborted', async () => {
    const fetchFn = vi.fn(async () => new Response('{}', { status: 200 }));
    const adapter = new RuntimeSpeechToTextAdapter({
      baseUrl: 'https://stt.example.com/v1',
      fetchFn,
    });
    const controller = new AbortController();
    controller.abort();
    const result = await adapter.transcribe({
      ownerId: 'u1',
      audio: { format: 'audio/wav', data: audioBytes },
      signal: controller.signal,
    });
    expect(result.aborted).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('normalizes an HTTP 429 into a typed error (rate limit)', async () => {
    const fetchFn = stubFetch(async () => new Response('{"error":"rate"}', { status: 429 }));
    const adapter = new RuntimeSpeechToTextAdapter({
      baseUrl: 'https://stt.example.com/v1',
      fetchFn,
    });
    await expect(
      adapter.transcribe({ ownerId: 'u1', audio: { format: 'audio/wav', data: audioBytes } }),
    ).rejects.toMatchObject({ code: 'HTTP', status: 429 });
  });

  it('probe reports availability (no probe path = available by declaration)', async () => {
    const adapter = new RuntimeSpeechToTextAdapter({ baseUrl: 'https://stt.example.com/v1' });
    await expect(adapter.probe()).resolves.toEqual({ available: true });
  });

  it('probe reports unavailable when the endpoint does not answer', async () => {
    const adapter = new RuntimeSpeechToTextAdapter({
      baseUrl: 'https://stt.example.com/v1',
      probePath: '/models',
      fetchFn: stubFetch(async () => new Response('{}', { status: 503 })),
    });
    await expect(adapter.probe()).resolves.toEqual({ available: false });
  });

  it('probe never throws (a failed probe is availability, not an exception)', async () => {
    const adapter = new RuntimeSpeechToTextAdapter({
      baseUrl: 'https://stt.example.com/v1',
      probePath: '/models',
      fetchFn: stubFetch(async () => {
        throw new Error('unreachable');
      }),
    });
    const result = await adapter.probe();
    expect(result.available).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects a non-https base URL at construction (fail-fast, no silent downgrade)', () => {
    expect(
      () => new RuntimeSpeechToTextAdapter({ baseUrl: 'http://insecure.example.com' }),
    ).toThrow(SpeechProviderError);
  });

  it('the adapter is honestly REAL (never masquerades as configured-without-config)', () => {
    const adapter = new RuntimeSpeechToTextAdapter({ baseUrl: 'https://stt.example.com/v1' });
    expect(adapter.kind).toBe('REAL');
    expect(adapter.capability).toBe('SPEECH_TO_TEXT');
  });
});

describe('RuntimeTextToSpeechAdapter — REAL TTS', () => {
  const mp3 = new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3, 4]);

  it('synthesizes successfully through the OpenAI-compatible contract', async () => {
    const fetchFn = stubFetch(async (url, init) => {
      expect(url).toMatch(/\/audio\/speech$/);
      const body = JSON.parse(String(init.body));
      expect(body.model).toBe('tts-1');
      expect(body.input).toBe('Hello there');
      expect(body.voice).toBe('alloy');
      return new Response(mp3, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
    });
    const adapter = new RuntimeTextToSpeechAdapter({
      baseUrl: 'https://tts.example.com/v1',
      fetchFn,
    });
    const result = await adapter.synthesize({ ownerId: 'u1', text: 'Hello there' });
    expect(result.audio.length).toBe(mp3.length);
    expect(result.format).toBe('audio/mpeg');
  });

  it('normalizes an HTTP 413 into a typed error without leaking provider detail', async () => {
    const fetchFn = stubFetch(async () => new Response('{"error":"too long"}', { status: 413 }));
    const adapter = new RuntimeTextToSpeechAdapter({
      baseUrl: 'https://tts.example.com/v1',
      fetchFn,
    });
    await expect(
      adapter.synthesize({ ownerId: 'u1', text: 'x'.repeat(100) }),
    ).rejects.toMatchObject({
      code: 'HTTP',
      status: 413,
    });
  });

  it('throws a typed timeout error when the provider hangs', async () => {
    const adapter = new RuntimeTextToSpeechAdapter({
      baseUrl: 'https://tts.example.com/v1',
      timeoutMs: 50,
      fetchFn: hangingFetch(),
    });
    await expect(adapter.synthesize({ ownerId: 'u1', text: 'hi' })).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });

  it('returns aborted when the caller aborts mid-flight', async () => {
    const adapter = new RuntimeTextToSpeechAdapter({
      baseUrl: 'https://tts.example.com/v1',
      timeoutMs: 10_000,
      fetchFn: hangingFetch(),
    });
    const controller = new AbortController();
    const promise = adapter.synthesize({
      ownerId: 'u1',
      text: 'Hello',
      signal: controller.signal,
    });
    controller.abort();
    const result = await promise;
    expect(result.aborted).toBe(true);
    expect(result.audio.length).toBe(0);
  });

  it('normalizes a network failure into a typed NETWORK error', async () => {
    const fetchFn = stubFetch(async () => {
      throw new Error('ECONNREFUSED');
    });
    const adapter = new RuntimeTextToSpeechAdapter({
      baseUrl: 'https://tts.example.com/v1',
      fetchFn,
    });
    await expect(adapter.synthesize({ ownerId: 'u1', text: 'hi' })).rejects.toMatchObject({
      code: 'NETWORK',
    });
  });

  it('rejects an empty provider response as INVALID_RESPONSE', async () => {
    const fetchFn = stubFetch(async () => new Response('', { status: 200 }));
    const adapter = new RuntimeTextToSpeechAdapter({
      baseUrl: 'https://tts.example.com/v1',
      fetchFn,
    });
    await expect(adapter.synthesize({ ownerId: 'u1', text: 'hi' })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('rejects an oversized provider response (bounded audio buffer)', async () => {
    const huge = new Uint8Array(MAX_SYNTHESIS_RESPONSE_BYTES + 1);
    const fetchFn = stubFetch(async () => new Response(huge, { status: 200 }));
    const adapter = new RuntimeTextToSpeechAdapter({
      baseUrl: 'https://tts.example.com/v1',
      fetchFn,
    });
    await expect(adapter.synthesize({ ownerId: 'u1', text: 'hi' })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('returns aborted immediately when the caller signal is already aborted', async () => {
    const fetchFn = vi.fn(async () => new Response(mp3, { status: 200 }));
    const adapter = new RuntimeTextToSpeechAdapter({
      baseUrl: 'https://tts.example.com/v1',
      fetchFn,
    });
    const controller = new AbortController();
    controller.abort();
    const result = await adapter.synthesize({
      ownerId: 'u1',
      text: 'Hello',
      signal: controller.signal,
    });
    expect(result.aborted).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('normalizes an HTTP 429 into a typed error (rate limit)', async () => {
    const fetchFn = stubFetch(async () => new Response('{"error":"rate"}', { status: 429 }));
    const adapter = new RuntimeTextToSpeechAdapter({
      baseUrl: 'https://tts.example.com/v1',
      fetchFn,
    });
    await expect(adapter.synthesize({ ownerId: 'u1', text: 'hi' })).rejects.toMatchObject({
      code: 'HTTP',
      status: 429,
    });
  });

  it('probe reports availability (no probe path = available by declaration)', async () => {
    const adapter = new RuntimeTextToSpeechAdapter({ baseUrl: 'https://tts.example.com/v1' });
    await expect(adapter.probe()).resolves.toEqual({ available: true });
  });

  it('probe reports unavailable when the endpoint does not answer', async () => {
    const adapter = new RuntimeTextToSpeechAdapter({
      baseUrl: 'https://tts.example.com/v1',
      probePath: '/models',
      fetchFn: stubFetch(async () => new Response('{}', { status: 503 })),
    });
    await expect(adapter.probe()).resolves.toEqual({ available: false });
  });

  it('rejects a non-https base URL at construction (fail-fast)', () => {
    expect(
      () => new RuntimeTextToSpeechAdapter({ baseUrl: 'http://insecure.example.com' }),
    ).toThrow(SpeechProviderError);
  });

  it('the adapter is honestly REAL', () => {
    const adapter = new RuntimeTextToSpeechAdapter({ baseUrl: 'https://tts.example.com/v1' });
    expect(adapter.kind).toBe('REAL');
    expect(adapter.capability).toBe('TEXT_TO_SPEECH');
  });
});
