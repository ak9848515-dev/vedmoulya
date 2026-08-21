// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Voice · RuntimeTextToSpeechAdapter
// SPRINT-028 — REAL text-to-speech over a provider-neutral HTTP endpoint.
//
// Provider neutrality: the adapter speaks the OpenAI-compatible
// `/audio/speech` contract (JSON: model + input + voice). OpenAI, ElevenLabs
// (OpenAI-compat), Azure OpenAI and others expose this contract, so no single
// vendor is hard-coded — the operator configures endpoint + key + model via
// environment/secure config. Credentials live server-side only.
//
// Honesty rules:
//   • kind is 'REAL' — CONFIGURED only when wired AND live; a configured-but-
//     down endpoint is UNAVAILABLE, never CONFIGURED.
//   • normalized errors: typed SpeechProviderError with stable codes
//     (TIMEOUT / ABORTED / NETWORK / HTTP / INVALID_RESPONSE / NOT_CONFIGURED).
//   • cancellation: AbortSignal aborts the in-flight fetch.
//   • bounded output: the caller bounds the input text; this adapter bounds
//     the accepted response body so a misbehaving provider cannot balloon
//     memory (guard against unbounded audio buffers).
// ─────────────────────────────────────────────────────────────────────────────

import type { TextToSpeechPort } from '../contracts/voice-ports.js';
import type { TextToSpeechResult } from '../types/voice-types.js';
import { SpeechProviderError } from './RuntimeSpeechToTextAdapter.js';

/** Hard cap on a single synthesized response (≈ 10 min of 8kHz mono 16-bit). */
export const MAX_SYNTHESIS_RESPONSE_BYTES = 10 * 60 * 8000 * 2;

export interface RuntimeTextToSpeechAdapterOptions {
  /** Base URL of the OpenAI-compatible speech endpoint root,
   *  e.g. https://api.openai.com/v1 — the adapter appends /audio/speech. */
  baseUrl: string;
  /** Server-side API key (Bearer). Never logged, never sent to the client. */
  apiKey?: string;
  /** Provider model id (e.g. tts-1, eleven_multilingual_v2). */
  model?: string;
  /** Provider voice id (e.g. alloy, onyx). */
  voice?: string;
  /** Provider response format (e.g. mp3, wav, opus). */
  format?: string;
  /** Hard request timeout (ms). Default 30_000. */
  timeoutMs?: number;
  /** Optional live-probe path used to decide CONFIGURED vs UNAVAILABLE. */
  probePath?: string;
  /** Injectable fetch (tests). Defaults to globalThis.fetch. */
  fetchFn?: typeof fetch;
}

/** Fresh read of an abort signal (see RuntimeSpeechToTextAdapter). */
function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function defaultFetch(): typeof fetch {
  const f = globalThis.fetch;
  if (typeof f !== 'function') {
    throw new SpeechProviderError(
      'NOT_CONFIGURED',
      'No fetch available in this runtime — a real TTS provider requires a server environment.',
    );
  }
  return f;
}

export class RuntimeTextToSpeechAdapter implements TextToSpeechPort {
  readonly id = 'runtime-tts';
  readonly kind = 'REAL' as const;
  readonly capability = 'TEXT_TO_SPEECH' as const;

  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly voice: string;
  private readonly format: string;
  private readonly timeoutMs: number;
  private readonly probePath: string | undefined;
  private readonly fetchFn: typeof fetch;

  constructor(options: RuntimeTextToSpeechAdapterOptions) {
    if (!options.baseUrl || !options.baseUrl.startsWith('https://')) {
      throw new SpeechProviderError(
        'NOT_CONFIGURED',
        'A real TTS provider requires a secure (https) base URL.',
      );
    }
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.model = options.model ?? 'tts-1';
    this.voice = options.voice ?? 'alloy';
    this.format = options.format ?? 'mp3';
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.probePath = options.probePath;
    this.fetchFn = options.fetchFn ?? defaultFetch();
  }

  /** Live availability probe (see RuntimeSpeechToTextAdapter.probe). */
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

  async synthesize(input: {
    ownerId: string;
    text: string;
    voice?: string;
    signal?: AbortSignal;
  }): Promise<TextToSpeechResult> {
    if (isAborted(input.signal)) {
      return { audio: new Uint8Array(0), format: 'audio/mp3', aborted: true };
    }

    const controller = new AbortController();
    const onAbort = (): void => {
      controller.abort();
    };
    input.signal?.addEventListener('abort', onAbort);
    const timer = setTimeout(() => {
      controller.abort(new SpeechProviderError('TIMEOUT', 'Text-to-speech provider timed out.'));
    }, this.timeoutMs);
    try {
      const res = await this.fetchFn(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.model,
          input: input.text,
          voice: input.voice ?? this.voice,
          ...(this.format === 'wav' ? {} : { response_format: this.format }),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail =
          res.status === 401
            ? 'Text-to-speech provider rejected the credentials.'
            : res.status === 413
              ? 'Text-to-speech provider rejected the text length.'
              : res.status === 429
                ? 'Text-to-speech provider rate limit reached.'
                : 'Text-to-speech provider request failed.';
        throw new SpeechProviderError('HTTP', detail, { status: res.status });
      }

      const contentType = res.headers.get('content-type') ?? 'audio/mp3';
      const mime = contentType.split(';')[0]?.trim() || 'audio/mp3';

      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        throw new SpeechProviderError(
          'INVALID_RESPONSE',
          'Text-to-speech provider returned no audio.',
        );
      }
      if (arrayBuffer.byteLength > MAX_SYNTHESIS_RESPONSE_BYTES) {
        throw new SpeechProviderError(
          'INVALID_RESPONSE',
          'Text-to-speech provider returned an oversized audio payload.',
        );
      }
      return { audio: new Uint8Array(arrayBuffer), format: mime };
    } catch (error) {
      if (isAborted(input.signal)) {
        return { audio: new Uint8Array(0), format: 'audio/mp3', aborted: true };
      }
      if (error instanceof SpeechProviderError) throw error;
      if (controller.signal.aborted) {
        const reason: unknown = controller.signal.reason;
        if (reason instanceof SpeechProviderError) throw reason;
        throw new SpeechProviderError('TIMEOUT', 'Text-to-speech provider timed out.', {
          cause: error,
        });
      }
      throw new SpeechProviderError('NETWORK', 'Text-to-speech provider is unreachable.', {
        cause: error,
      });
    } finally {
      clearTimeout(timer);
      input.signal?.removeEventListener('abort', onAbort);
    }
  }
}
