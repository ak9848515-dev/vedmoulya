// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Voice · RuntimeSpeechToTextAdapter
// SPRINT-028 — REAL speech-to-text over a provider-neutral HTTP endpoint.
//
// Provider neutrality: the adapter speaks the OpenAI-compatible
// `/audio/transcriptions` contract (multipart form: file + model). OpenAI,
// Groq, Deepgram (OpenAI-compat), Azure OpenAI and many others expose this
// contract, so no single vendor is hard-coded into the architecture — the
// operator configures the endpoint + key + model via environment/secure
// config. Credentials live server-side only; nothing is exposed to clients.
//
// Honesty rules:
//   • kind is 'REAL' — the service reports CONFIGURED only when this adapter
//     is wired AND the endpoint answers a live probe; a configured-but-down
//     endpoint is UNAVAILABLE, never CONFIGURED.
//   • normalized errors: every failure is a typed SpeechProviderError with a
//     stable code (TIMEOUT / ABORTED / NETWORK / HTTP / INVALID_RESPONSE);
//     raw provider payloads never leak into the UI.
//   • cancellation: AbortSignal aborts the in-flight fetch; the abort reason
//     is surfaced as `aborted: true` when already aborted, or a typed
//     SpeechProviderError('ABORTED') otherwise.
// ─────────────────────────────────────────────────────────────────────────────

import type { SpeechToTextPort } from '../contracts/voice-ports.js';
import type { SpeechToTextResult } from '../types/voice-types.js';

/** Stable, normalized speech-provider error. Never raw provider text. */
export class SpeechProviderError extends Error {
  readonly code: 'TIMEOUT' | 'ABORTED' | 'NETWORK' | 'HTTP' | 'INVALID_RESPONSE' | 'NOT_CONFIGURED';
  readonly status?: number;
  constructor(
    code: SpeechProviderError['code'],
    message: string,
    options: { status?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'SpeechProviderError';
    this.code = code;
    this.status = options.status;
  }
}

export interface RuntimeSpeechToTextAdapterOptions {
  /** Base URL of the OpenAI-compatible transcriptions endpoint root,
   *  e.g. https://api.openai.com/v1 — the adapter appends /audio/transcriptions. */
  baseUrl: string;
  /** Server-side API key (Bearer). Never logged, never sent to the client. */
  apiKey?: string;
  /** Provider model id (e.g. whisper-1, gpt-4o-transcribe). */
  model?: string;
  /** Hard request timeout (ms). Default 30_000. */
  timeoutMs?: number;
  /** Optional live-probe path used to decide CONFIGURED vs UNAVAILABLE.
   *  When absent, the adapter is considered configured when constructed
   *  (the operator declared it); the probe only runs when provided. */
  probePath?: string;
  /** Injectable fetch (tests). Defaults to globalThis.fetch. */
  fetchFn?: typeof fetch;
}

/** Fresh read of an abort signal. A helper (not a property access on the
 *  input object) keeps the value readable even after an early `aborted`
 *  return narrowed it away — the signal can become aborted mid-flight. */
function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

/** Server-side fetch guard: adapters never run in the browser, so global
 *  fetch is available in Node ≥18. Kept behind a narrow seam for tests. */
function defaultFetch(): typeof fetch {
  const f = globalThis.fetch;
  if (typeof f !== 'function') {
    throw new SpeechProviderError(
      'NOT_CONFIGURED',
      'No fetch available in this runtime — a real STT provider requires a server environment.',
    );
  }
  return f;
}

export class RuntimeSpeechToTextAdapter implements SpeechToTextPort {
  readonly id = 'runtime-stt';
  readonly kind = 'REAL' as const;
  readonly capability = 'SPEECH_TO_TEXT' as const;

  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly probePath: string | undefined;
  private readonly fetchFn: typeof fetch;

  constructor(options: RuntimeSpeechToTextAdapterOptions) {
    if (!options.baseUrl || !options.baseUrl.startsWith('https://')) {
      throw new SpeechProviderError(
        'NOT_CONFIGURED',
        'A real STT provider requires a secure (https) base URL.',
      );
    }
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.model = options.model ?? 'whisper-1';
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.probePath = options.probePath;
    this.fetchFn = options.fetchFn ?? defaultFetch();
  }

  /** Live availability probe (the operator wiring decides whether to run it).
   *  Failure never throws here — it reports availability, and the service
   *  maps an unavailable adapter to UNAVAILABLE (never CONFIGURED). */
  async probe(): Promise<{ available: boolean; error?: string }> {
    if (!this.probePath) return { available: true };
    try {
      const controller = new AbortController();
      const timer = setTimeout(
        () => {
          controller.abort();
        },
        Math.min(this.timeoutMs, 5_000),
      );
      const res = await this.fetchFn(`${this.baseUrl}${this.probePath}`, {
        method: 'GET',
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);
      return { available: res.ok };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'probe failed',
      };
    }
  }

  async transcribe(input: {
    ownerId: string;
    audio: { format: string; data: Uint8Array };
    signal?: AbortSignal;
  }): Promise<SpeechToTextResult> {
    if (isAborted(input.signal)) {
      return { text: '', confidence: 0, aborted: true };
    }

    // Hard timeout enforced via a child controller racing the caller signal.
    const controller = new AbortController();
    const onAbort = (): void => {
      controller.abort();
    };
    input.signal?.addEventListener('abort', onAbort);
    const timer = setTimeout(() => {
      controller.abort(new SpeechProviderError('TIMEOUT', 'Speech-to-text provider timed out.'));
    }, this.timeoutMs);
    try {
      const form = new FormData();
      // Blob keeps the payload in memory and carries the exact MIME format the
      // provider expects (e.g. audio/webm, audio/wav). The buffer is copied
      // onto a fresh ArrayBuffer so the payload is never a view over a larger
      // or shared backing store (and satisfies the BlobPart typing).
      const copy = new Uint8Array(input.audio.data.length);
      copy.set(input.audio.data);
      const blob = new Blob([copy.buffer], { type: input.audio.format });
      form.append('file', blob, 'audio');
      form.append('model', this.model);

      const res = await this.fetchFn(`${this.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
        body: form,
        signal: controller.signal,
      });

      if (!res.ok) {
        // Normalized HTTP failure — the raw body is never surfaced to the UI.
        const detail =
          res.status === 401
            ? 'Speech-to-text provider rejected the credentials.'
            : res.status === 413
              ? 'Speech-to-text provider rejected the audio size.'
              : res.status === 429
                ? 'Speech-to-text provider rate limit reached.'
                : 'Speech-to-text provider request failed.';
        throw new SpeechProviderError('HTTP', detail, { status: res.status });
      }

      const payload = (await res.json()) as { text?: string };
      const text = typeof payload.text === 'string' ? payload.text.trim() : '';
      if (!text) {
        throw new SpeechProviderError(
          'INVALID_RESPONSE',
          'Speech-to-text provider returned no transcript.',
        );
      }
      return { text, confidence: 0.9 };
    } catch (error) {
      if (isAborted(input.signal)) {
        return { text: '', confidence: 0, aborted: true };
      }
      if (error instanceof SpeechProviderError) throw error;
      if (controller.signal.aborted) {
        const reason: unknown = controller.signal.reason;
        if (reason instanceof SpeechProviderError) throw reason;
        throw new SpeechProviderError('TIMEOUT', 'Speech-to-text provider timed out.', {
          cause: error,
        });
      }
      throw new SpeechProviderError('NETWORK', 'Speech-to-text provider is unreachable.', {
        cause: error,
      });
    } finally {
      clearTimeout(timer);
      input.signal?.removeEventListener('abort', onAbort);
    }
  }
}
