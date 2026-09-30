// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Local AI failure vocabulary + port override tests
//
// The UI must name EXACTLY which boundary broke: the agent, the runtime, the
// model, the generation or the browser's own CORS/Private-Network policy. These
// tests pin that vocabulary so a failure is never collapsed into another.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  failureCodeFor,
  failureForNullReport,
  failureForReport,
  localAgentUrlCandidates,
  resolveLocalAgentPort,
  LOCAL_AI_FAILURE_MESSAGE,
  type LocalAiFailureCode,
} from '../local-ai-agent.js';

describe('resolveLocalAgentPort / localAgentUrlCandidates', () => {
  it('builds the candidate list from a port, probing both loopback spellings', () => {
    expect(localAgentUrlCandidates(43117)).toEqual([
      'http://127.0.0.1:43117',
      'http://localhost:43117',
    ]);
  });

  it('honors a configured non-default port (an agent on 43118 is findable)', () => {
    expect(localAgentUrlCandidates(43118)).toEqual([
      'http://127.0.0.1:43118',
      'http://localhost:43118',
    ]);
  });

  it('falls back to the canonical port for an unusable value', () => {
    for (const raw of [undefined, '', '   ', 'abc', '0', '-1', '70000', '1.5']) {
      expect(resolveLocalAgentPort(raw)).toBe(43117);
    }
  });

  it('accepts a valid port', () => {
    expect(resolveLocalAgentPort('43118')).toBe(43118);
    expect(resolveLocalAgentPort(' 3001 ')).toBe(3001);
  });

  // The browser bundle can only see a STATICALLY analyzable
  // `process.env.NEXT_PUBLIC_*` reference (Next inlines it at build time). This
  // proves the default candidate list reads that exact env var, so an agent
  // started on a non-default port is not reported as "not running".
  it('reads NEXT_PUBLIC_VEDMOULYA_LOCAL_AGENT_PORT for the default candidate URLs', () => {
    const previous = process.env.NEXT_PUBLIC_VEDMOULYA_LOCAL_AGENT_PORT;
    try {
      process.env.NEXT_PUBLIC_VEDMOULYA_LOCAL_AGENT_PORT = '43118';
      expect(localAgentUrlCandidates()).toEqual([
        'http://127.0.0.1:43118',
        'http://localhost:43118',
      ]);

      process.env.NEXT_PUBLIC_VEDMOULYA_LOCAL_AGENT_PORT = 'not-a-port';
      expect(localAgentUrlCandidates()).toEqual([
        'http://127.0.0.1:43117',
        'http://localhost:43117',
      ]);
    } finally {
      if (previous === undefined) {
        delete process.env.NEXT_PUBLIC_VEDMOULYA_LOCAL_AGENT_PORT;
      } else {
        process.env.NEXT_PUBLIC_VEDMOULYA_LOCAL_AGENT_PORT = previous;
      }
    }
  });
});

describe('failureCodeFor — runtime error → shared vocabulary', () => {
  const cases: Array<[string, LocalAiFailureCode]> = [
    ['NOT_RUNNING', 'OLLAMA_UNAVAILABLE'],
    ['UNREACHABLE', 'OLLAMA_UNAVAILABLE'],
    ['INVALID_RESPONSE', 'OLLAMA_UNAVAILABLE'],
    ['NO_MODELS', 'OLLAMA_UNAVAILABLE'],
    ['MODEL_UNAVAILABLE', 'MODEL_NOT_FOUND'],
    ['GENERATION_FAILED', 'GENERATION_FAILED'],
  ];

  it.each(cases)('maps the runtime error %s onto %s', (error, expected) => {
    expect(failureCodeFor(error, undefined)).toBe(expected);
  });

  it.each([
    ['LOCAL_AGENT_NOT_RUNNING', 'AGENT_UNAVAILABLE'],
    ['OLLAMA_NOT_RUNNING', 'OLLAMA_UNAVAILABLE'],
    ['OLLAMA_UNREACHABLE', 'OLLAMA_UNAVAILABLE'],
    ['OLLAMA_MODEL_UNAVAILABLE', 'MODEL_NOT_FOUND'],
    ['OLLAMA_GENERATION_FAILED', 'GENERATION_FAILED'],
  ] as Array<[string, LocalAiFailureCode]>)(
    'falls back to the state %s → %s',
    (state, expected) => {
      expect(failureCodeFor(undefined, state)).toBe(expected);
    },
  );

  it('returns null for a healthy state', () => {
    expect(failureCodeFor(undefined, 'OLLAMA_CONNECTED')).toBeNull();
    expect(failureCodeFor(undefined, 'OLLAMA_MODELS_FOUND')).toBeNull();
    expect(failureCodeFor(undefined, 'LOCAL_AGENT_RUNNING')).toBeNull();
    expect(failureCodeFor(undefined, undefined)).toBeNull();
  });

  it('prefers the runtime error over the state when both are present', () => {
    expect(failureCodeFor('MODEL_UNAVAILABLE', 'OLLAMA_NOT_RUNNING')).toBe('MODEL_NOT_FOUND');
  });
});

describe('failureForReport', () => {
  it('explains a failure using the report message', () => {
    const failure = failureForReport({
      state: 'OLLAMA_NOT_RUNNING',
      error: 'NOT_RUNNING',
      message: 'Nothing is listening on the Ollama address.',
    });
    expect(failure?.code).toBe('OLLAMA_UNAVAILABLE');
    expect(failure?.message).toBe('Nothing is listening on the Ollama address.');
  });

  it('falls back to the vocabulary default when the message is missing', () => {
    const failure = failureForReport({ state: 'OLLAMA_MODEL_UNAVAILABLE' });
    expect(failure?.code).toBe('MODEL_NOT_FOUND');
    expect(failure?.message).toBe(LOCAL_AI_FAILURE_MESSAGE['MODEL_NOT_FOUND']);
  });

  it('is null for a healthy report', () => {
    expect(failureForReport({ state: 'OLLAMA_CONNECTED', message: 'ok' })).toBeNull();
  });
});

describe('failureForNullReport', () => {
  it('classifies a missing report as AGENT_UNAVAILABLE, naming the address', () => {
    const failure = failureForNullReport('http://127.0.0.1:43117');
    expect(failure.code).toBe('AGENT_UNAVAILABLE');
    expect(failure.message).toContain('http://127.0.0.1:43117');
  });
});

describe('failure vocabulary is total', () => {
  it('has a default message for every code', () => {
    const codes: LocalAiFailureCode[] = [
      'AGENT_UNAVAILABLE',
      'OLLAMA_UNAVAILABLE',
      'MODEL_NOT_FOUND',
      'GENERATION_FAILED',
      'CORS_PNA_FAILURE',
    ];
    for (const code of codes) {
      expect(LOCAL_AI_FAILURE_MESSAGE[code]).toBeTruthy();
    }
  });
});
