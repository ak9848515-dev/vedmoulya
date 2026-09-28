// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — PROD-DIAG: generation-validation classification
//
// Production diagnostic for the Gemini setup failure the friendly taxonomy
// could not distinguish: a live setup returned
//   outcome: "UNAVAILABLE" · stage: "validate" · errorKind: "unavailable"
// which is produced BOTH by an HTTP 5xx AND by an HTTP 200 whose body carried
// no usable answer. These tests pin the new diagnostic classification that is
// emitted through the structured logger (or an injected sink), so Vercel logs
// identify the real provider condition.
//
// These tests also ASSERT THE SECURITY CONTRACT: the diagnostic record must
// never contain the API key, an Authorization header, the request body, the
// prompt or the provider's response body.
//
// Deterministic test doubles only — no real provider credentials, no network.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import {
  validateProviderGeneration,
  safeProviderStatusReason,
  hasGenerationCandidate,
  generationAnswerLength,
  type GenerationValidationDiagnostic,
} from '../services/ProviderConnectionTester.js';

/** A credential-shaped sentinel that must never appear in any diagnostic. */
const SECRET = 'AIzaSyTESTONLY-credential-material-0123456789';

/** A fetch double returning `body` as JSON with the given HTTP status. */
function jsonFetch(body: unknown, status = 200, statusText = 'OK'): typeof fetch {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      statusText,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

/** A fetch double whose body is NOT JSON (so status-token extraction must cope). */
function textFetch(text: string, status: number): typeof fetch {
  return vi
    .fn()
    .mockResolvedValue(
      new Response(text, { status, headers: { 'content-type': 'text/html' } }),
    ) as unknown as typeof fetch;
}

/** Collects every diagnostic the validator emits. */
function collector(): {
  sink: (diagnostic: GenerationValidationDiagnostic) => void;
  records: GenerationValidationDiagnostic[];
} {
  const records: GenerationValidationDiagnostic[] = [];
  return { sink: (diagnostic) => records.push(diagnostic), records };
}

/**
 * The security assertion used by every test: serialized with ALL own property
 * names (so a non-enumerable or getter-backed field cannot hide material) the
 * record must not carry the credential, an auth header, the request body, the
 * prompt, or the answer text.
 */
function expectNoSecretMaterial(records: GenerationValidationDiagnostic[]): void {
  expect(records.length).toBeGreaterThan(0);
  for (const record of records) {
    const serialized = JSON.stringify(record, Object.getOwnPropertyNames(record));
    expect(serialized).not.toContain(SECRET);
    expect(serialized.toLowerCase()).not.toContain('authorization');
    expect(serialized.toLowerCase()).not.toContain('x-goog-api-key');
    expect(serialized.toLowerCase()).not.toContain('bearer');
    // The request prompt and the request body must never be reflected.
    expect(serialized).not.toContain('Reply with the single word');
    expect(serialized).not.toContain('contents');
  }
}

describe('PROD-DIAG — generation validation diagnostics', () => {
  describe('safe metadata extraction helpers', () => {
    it('keeps an allow-listed Google error status token', () => {
      expect(safeProviderStatusReason({ error: { code: 403, status: 'PERMISSION_DENIED' } })).toBe(
        'PERMISSION_DENIED',
      );
      expect(safeProviderStatusReason({ error: { status: 'RESOURCE_EXHAUSTED' } })).toBe(
        'RESOURCE_EXHAUSTED',
      );
      expect(safeProviderStatusReason({ error: { status: 'UNAVAILABLE' } })).toBe('UNAVAILABLE');
    });

    it('keeps an allow-listed OpenAI/Anthropic error type token', () => {
      expect(safeProviderStatusReason({ error: { type: 'rate_limit_error' } })).toBe(
        'rate_limit_error',
      );
      expect(safeProviderStatusReason({ error: { type: 'overloaded_error' } })).toBe(
        'overloaded_error',
      );
    });

    it('DROPS any non-allow-listed value instead of logging it', () => {
      // A provider that echoes free text (or a credential) must be discarded.
      expect(safeProviderStatusReason({ error: { status: SECRET } })).toBeUndefined();
      expect(
        safeProviderStatusReason({ error: { message: 'key AIzaSy... is invalid' } }),
      ).toBeUndefined();
      expect(safeProviderStatusReason({ error: { status: 'SOME_NEW_CODE' } })).toBeUndefined();
      expect(safeProviderStatusReason({ error: { code: 403 } })).toBeUndefined();
      expect(safeProviderStatusReason(null)).toBeUndefined();
      expect(safeProviderStatusReason('PERMISSION_DENIED')).toBeUndefined();
      expect(safeProviderStatusReason({})).toBeUndefined();
    });

    it('detects a candidate container without reading its content', () => {
      expect(hasGenerationCandidate({ candidates: [{}] }, 'google')).toBe(true);
      expect(hasGenerationCandidate({ candidates: [] }, 'google')).toBe(false);
      expect(hasGenerationCandidate({}, 'google')).toBe(false);
      expect(hasGenerationCandidate({ content: [{}] }, 'anthropic')).toBe(true);
      expect(hasGenerationCandidate({ choices: [{}] }, 'openai')).toBe(true);
      expect(hasGenerationCandidate({ choices: [] }, 'openai')).toBe(false);
      expect(hasGenerationCandidate({ message: {} }, 'ollama')).toBe(true);
      expect(hasGenerationCandidate({}, 'ollama')).toBe(false);
    });

    it('reports only the LENGTH of the answer, never the text', () => {
      expect(
        generationAnswerLength(
          { candidates: [{ content: { parts: [{ text: 'ok' }] } }] },
          'google',
        ),
      ).toBe(2);
      expect(generationAnswerLength({ candidates: [] }, 'google')).toBe(0);
      expect(generationAnswerLength({ content: [{ text: 'hello' }] }, 'anthropic')).toBe(5);
      expect(generationAnswerLength({ choices: [{ message: { content: 'ok' } }] }, 'openai')).toBe(
        2,
      );
      expect(generationAnswerLength({ message: { content: '  ok  ' } }, 'ollama')).toBe(2);
    });
  });

  describe('A — HTTP 401/403 credential rejection', () => {
    it('classifies 401 as generation_http_error without exposing the API key', async () => {
      const { sink, records } = collector();
      const result = await validateProviderGeneration({
        family: 'google',
        apiKey: SECRET,
        modelId: 'gemini-3.5-flash',
        env: {},
        fetchFn: jsonFetch(
          { error: { code: 401, status: 'UNAUTHENTICATED' } },
          401,
          'Unauthorized',
        ),
        onDiagnostic: sink,
      });

      expect(result.ok).toBe(false);
      expect(result.errorKind).toBe('invalid_api_key');

      expect(records).toHaveLength(1);
      expect(records[0].classification).toBe('generation_http_error');
      expect(records[0].providerFamily).toBe('google');
      expect(records[0].stage).toBe('validate');
      expect(records[0].modelId).toBe('gemini-3.5-flash');
      expect(records[0].httpStatus).toBe(401);
      expect(records[0].errorKind).toBe('invalid_api_key');
      expect(records[0].noCredential).toBe(false);
      expect(records[0].providerStatusReason).toBe('UNAUTHENTICATED');
      expect(typeof records[0].latencyMs).toBe('number');

      expectNoSecretMaterial(records);
    });

    it('classifies 403 as generation_http_error without exposing the API key', async () => {
      const { sink, records } = collector();
      const result = await validateProviderGeneration({
        family: 'google',
        apiKey: SECRET,
        modelId: 'gemini-3.5-flash',
        env: {},
        fetchFn: jsonFetch({ error: { code: 403, status: 'PERMISSION_DENIED' } }, 403, 'Forbidden'),
        onDiagnostic: sink,
      });

      expect(result.ok).toBe(false);
      expect(result.errorKind).toBe('invalid_api_key');
      expect(records[0].classification).toBe('generation_http_error');
      expect(records[0].httpStatus).toBe(403);
      expect(records[0].providerStatusReason).toBe('PERMISSION_DENIED');

      expectNoSecretMaterial(records);
    });

    it('survives a 403 whose body is not JSON and echoes the key', async () => {
      const { sink, records } = collector();
      await validateProviderGeneration({
        family: 'google',
        apiKey: SECRET,
        modelId: 'gemini-3.5-flash',
        env: {},
        // A non-JSON body that echoes the credential back.
        fetchFn: textFetch(`<html>denied for key ${SECRET}</html>`, 403),
        onDiagnostic: sink,
      });

      expect(records[0].classification).toBe('generation_http_error');
      expect(records[0].httpStatus).toBe(403);
      // Unparseable body ⇒ no status token, and the echoed key never leaks.
      expect(records[0].providerStatusReason).toBeUndefined();
      expectNoSecretMaterial(records);
    });
  });

  describe('B — HTTP 429 quota / rate limit', () => {
    it('classifies 429 as generation_http_error with rate_limited', async () => {
      const { sink, records } = collector();
      const result = await validateProviderGeneration({
        family: 'google',
        apiKey: SECRET,
        modelId: 'gemini-3.5-flash',
        env: {},
        fetchFn: jsonFetch(
          { error: { code: 429, status: 'RESOURCE_EXHAUSTED' } },
          429,
          'Too Many Requests',
        ),
        onDiagnostic: sink,
      });

      expect(result.ok).toBe(false);
      expect(result.errorKind).toBe('rate_limited');
      expect(records[0].classification).toBe('generation_http_error');
      expect(records[0].httpStatus).toBe(429);
      expect(records[0].errorKind).toBe('rate_limited');
      expect(records[0].providerStatusReason).toBe('RESOURCE_EXHAUSTED');

      expectNoSecretMaterial(records);
    });

    describe('C — HTTP 5xx provider availability', () => {
      it.each([500, 502, 503, 504])('classifies %i as generation_http_error', async (status) => {
        const { sink, records } = collector();
        const result = await validateProviderGeneration({
          family: 'google',
          apiKey: SECRET,
          modelId: 'gemini-3.5-flash',
          env: {},
          fetchFn: jsonFetch(
            { error: { code: status, status: 'UNAVAILABLE' } },
            status,
            'Server Error',
          ),
          onDiagnostic: sink,
        });

        expect(result.ok).toBe(false);
        expect(result.errorKind).toBe('unavailable');
        expect(records[0].classification).toBe('generation_http_error');
        expect(records[0].httpStatus).toBe(status);
        expect(records[0].providerStatusReason).toBe('UNAVAILABLE');

        expectNoSecretMaterial(records);
      });

      it('distinguishes a 5xx from an HTTP 200 empty response', async () => {
        const serverError = collector();
        await validateProviderGeneration({
          family: 'google',
          apiKey: SECRET,
          modelId: 'gemini-3.5-flash',
          env: {},
          fetchFn: jsonFetch({ error: { status: 'UNAVAILABLE' } }, 503),
          onDiagnostic: serverError.sink,
        });

        const empty = collector();
        await validateProviderGeneration({
          family: 'google',
          apiKey: SECRET,
          modelId: 'gemini-3.5-flash',
          env: {},
          fetchFn: jsonFetch({ candidates: [] }, 200),
          onDiagnostic: empty.sink,
        });

        // Identical user-facing errorKind ('unavailable') — DIFFERENT diagnosis.
        expect(serverError.records[0].errorKind).toBe('unavailable');
        expect(empty.records[0].errorKind).toBe('unavailable');
        expect(serverError.records[0].classification).toBe('generation_http_error');
        expect(empty.records[0].classification).toBe('generation_empty_response');
      });
    });

    describe('D — HTTP 200 with no usable candidate', () => {
      it('classifies an empty candidates array as generation_empty_response', async () => {
        const { sink, records } = collector();
        const result = await validateProviderGeneration({
          family: 'google',
          apiKey: SECRET,
          modelId: 'gemini-3.5-flash',
          env: {},
          fetchFn: jsonFetch({ candidates: [] }, 200),
          onDiagnostic: sink,
        });

        expect(result.ok).toBe(false);
        expect(result.errorKind).toBe('unavailable');
        expect(records[0].classification).toBe('generation_empty_response');
        expect(records[0].httpStatus).toBe(200);
        expect(records[0].candidatePresent).toBe(false);
        expect(records[0].contentPartPresent).toBe(false);
        expect(records[0].answerLength).toBe(0);

        expectNoSecretMaterial(records);
      });

      it('reports candidatePresent=true with contentPartPresent=false for an empty part', async () => {
        const { sink, records } = collector();
        await validateProviderGeneration({
          family: 'google',
          apiKey: SECRET,
          modelId: 'gemini-3.5-flash',
          env: {},
          fetchFn: jsonFetch({ candidates: [{ content: { parts: [] } }] }, 200),
          onDiagnostic: sink,
        });

        expect(records[0].classification).toBe('generation_empty_response');
        expect(records[0].candidatePresent).toBe(true);
        expect(records[0].contentPartPresent).toBe(false);
        expect(records[0].answerLength).toBe(0);
      });

      it('reports a prompt-feedback-only Gemini body as no candidate', async () => {
        // Gemini can answer 200 with NO candidates when the prompt is blocked —
        // the exact production condition this diagnostic must expose.
        const { sink, records } = collector();
        await validateProviderGeneration({
          family: 'google',
          apiKey: SECRET,
          modelId: 'gemini-3.5-flash',
          env: {},
          fetchFn: jsonFetch({ promptFeedback: { blockReason: 'OTHER' } }, 200),
          onDiagnostic: sink,
        });

        expect(records[0].classification).toBe('generation_empty_response');
        expect(records[0].candidatePresent).toBe(false);
        expect(records[0].answerLength).toBe(0);
      });

      it('classifies an empty OpenAI-style payload as generation_empty_response', async () => {
        const { sink, records } = collector();
        await validateProviderGeneration({
          family: 'openai',
          apiKey: SECRET,
          modelId: 'gpt-4o-mini',
          env: {},
          fetchFn: jsonFetch({ choices: [] }, 200),
          onDiagnostic: sink,
        });

        expect(records[0].classification).toBe('generation_empty_response');
        expect(records[0].httpStatus).toBe(200);
        expect(records[0].candidatePresent).toBe(false);
      });

      it('classifies a blank Ollama completion as generation_empty_response', async () => {
        const { sink, records } = collector();
        await validateProviderGeneration({
          family: 'ollama',
          modelId: 'llama3.2',
          env: {},
          fetchFn: jsonFetch({ message: { content: '   ' } }, 200),
          onDiagnostic: sink,
        });

        expect(records[0].classification).toBe('generation_empty_response');
        expect(records[0].candidatePresent).toBe(true);
        expect(records[0].answerLength).toBe(0);
      });
    });

    describe('E — timeout / network failure', () => {
      it('classifies an abort as generation_network_error with the platform error name', async () => {
        const { sink, records } = collector();
        const abort = Object.assign(new Error('This operation was aborted'), {
          name: 'TimeoutError',
        });
        const fetchFn = vi.fn().mockRejectedValue(abort) as unknown as typeof fetch;

        const result = await validateProviderGeneration({
          family: 'google',
          apiKey: SECRET,
          modelId: 'gemini-3.5-flash',
          env: {},
          fetchFn,
          timeoutMs: 60_000,
          onDiagnostic: sink,
        });

        expect(result.ok).toBe(false);
        expect(result.errorKind).toBe('unreachable');
        expect(records[0].classification).toBe('generation_network_error');
        expect(records[0].errorKind).toBe('unreachable');
        expect(records[0].networkErrorName).toBe('TimeoutError');
        expect(records[0].httpStatus).toBeUndefined();

        expectNoSecretMaterial(records);
      });

      it('classifies a connection failure as generation_network_error', async () => {
        const { sink, records } = collector();
        const fetchFn = vi
          .fn()
          .mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch;

        await validateProviderGeneration({
          family: 'google',
          apiKey: SECRET,
          modelId: 'gemini-3.5-flash',
          env: {},
          fetchFn,
          onDiagnostic: sink,
        });

        expect(records[0].classification).toBe('generation_network_error');
        expect(records[0].networkErrorName).toBe('TypeError');
        // The error MESSAGE is never logged (it can echo request material).
        expect(JSON.stringify(records[0])).not.toContain('fetch failed');
      });
    });

    describe('F — success and not-attempted stay honest', () => {
      it('classifies a real Gemini completion as generation_success with ok:true', async () => {
        const { sink, records } = collector();
        const result = await validateProviderGeneration({
          family: 'google',
          apiKey: SECRET,
          modelId: 'gemini-3.5-flash',
          env: {},
          fetchFn: jsonFetch({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }, 200),
          onDiagnostic: sink,
        });

        // The success path is UNCHANGED: the provider is only ever ok when the
        // existing validation really parsed an answer.
        expect(result.ok).toBe(true);
        expect(result.modelId).toBe('gemini-3.5-flash');
        expect(records[0].classification).toBe('generation_success');
        expect(records[0].httpStatus).toBe(200);
        expect(records[0].candidatePresent).toBe(true);
        expect(records[0].contentPartPresent).toBe(true);
        expect(records[0].answerLength).toBe(2);
        expect(records[0].errorKind).toBeUndefined();

        expectNoSecretMaterial(records);
      });

      it('does NOT report success for an empty response (no false CONNECTED)', async () => {
        const { sink, records } = collector();
        const result = await validateProviderGeneration({
          family: 'google',
          apiKey: SECRET,
          modelId: 'gemini-3.5-flash',
          env: {},
          fetchFn: jsonFetch({ candidates: [{ content: { parts: [{ text: '' }] } }] }, 200),
          onDiagnostic: sink,
        });

        expect(result.ok).toBe(false);
        expect(records[0].classification).toBe('generation_empty_response');
      });

      it('reports a blank model id as generation_not_attempted without any request', async () => {
        const { sink, records } = collector();
        const fetchFn = jsonFetch({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] });

        const result = await validateProviderGeneration({
          family: 'google',
          apiKey: SECRET,
          modelId: '   ',
          env: {},
          fetchFn,
          onDiagnostic: sink,
        });

        expect(result.ok).toBe(false);
        expect(result.errorKind).toBe('no_credential');
        expect(records[0].classification).toBe('generation_not_attempted');
        expect(records[0].latencyMs).toBe(0);
        expect(fetchFn).not.toHaveBeenCalled();
      });

      it('flags noCredential when no credential could be resolved', async () => {
        const { sink, records } = collector();
        await validateProviderGeneration({
          family: 'google',
          modelId: 'gemini-3.5-flash',
          env: {},
          fetchFn: jsonFetch({ error: { status: 'UNAUTHENTICATED' } }, 401),
          onDiagnostic: sink,
        });

        expect(records[0].noCredential).toBe(true);
      });
    });

    describe('default sink — production logs via the structured logger', () => {
      it('routes through the structured logger when no sink is injected', async () => {
        const core = await import('@vedmoulya/core');
        const warn = vi.spyOn(core.logger, 'warn').mockImplementation(() => undefined);
        const info = vi.spyOn(core.logger, 'info').mockImplementation(() => undefined);

        try {
          await validateProviderGeneration({
            family: 'google',
            apiKey: SECRET,
            modelId: 'gemini-3.5-flash',
            env: {},
            fetchFn: jsonFetch({ candidates: [] }, 200),
          });

          expect(warn).toHaveBeenCalledTimes(1);
          const [message, data] = warn.mock.calls[0] as [string, Record<string, unknown>];
          expect(message).toBe('[provider-setup] generation validation failed');
          expect(data.classification).toBe('generation_empty_response');
          expect(data.httpStatus).toBe(200);
          expect(data.providerFamily).toBe('google');
          // The credential must not reach the log payload.
          expect(JSON.stringify(data)).not.toContain(SECRET);

          await validateProviderGeneration({
            family: 'google',
            apiKey: SECRET,
            modelId: 'gemini-3.5-flash',
            env: {},
            fetchFn: jsonFetch({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }, 200),
          });

          expect(info).toHaveBeenCalledTimes(1);
          const [okMessage, okData] = info.mock.calls[0] as [string, Record<string, unknown>];
          expect(okMessage).toBe('[provider-setup] generation validation succeeded');
          expect(okData.classification).toBe('generation_success');
        } finally {
          warn.mockRestore();
          info.mockRestore();
        }
      });
    });
  });
});
