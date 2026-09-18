// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gemini onboarding logic tests (PROVIDER-01, Phases 3/4/6/16)
//
// The expensive invariants of the first-login flow are pinned HERE, without a
// DOM: when the flow may appear, when it must ask for the one extra step, which
// step is allowed to render as "done", where a recommended model comes from,
// and what a failure is allowed to say.
//
// The two rules under test:
//   R1 — never ask for a step that isn't needed (the deployment's own
//        credential makes the extra step unnecessary),
//   R2 — never show a step as done before the real fact exists.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  GEMINI_ONBOARDING_COPY,
  buildPreparingSteps,
  decideGeminiOnboarding,
  isGeminiRuntimeConfigured,
  problemForFailure,
  selectRecommendedModel,
  type GeminiEntryInput,
} from '../gemini-onboarding.js';

function entryInput(overrides: Partial<GeminiEntryInput> = {}): GeminiEntryInput {
  return {
    signedIn: true,
    deviceDismissed: false,
    deviceConnectDone: false,
    googleRuntimeStatus: undefined,
    preferredProviderId: undefined,
    preferredModelId: undefined,
    geminiEnabledByUser: undefined,
    ...overrides,
  };
}

describe('decideGeminiOnboarding — when the flow appears', () => {
  it('runs for a brand-new signed-in account', () => {
    expect(decideGeminiOnboarding(entryInput()).kind).toBe('firstRun');
  });

  it('never appears when signed out', () => {
    expect(decideGeminiOnboarding(entryInput({ signedIn: false })).kind).toBe('hidden');
  });

  it('never appears once dismissed on this device', () => {
    expect(decideGeminiOnboarding(entryInput({ deviceDismissed: true })).kind).toBe('hidden');
  });

  it('never nags a user who deliberately switched Gemini off', () => {
    expect(decideGeminiOnboarding(entryInput({ geminiEnabledByUser: false })).kind).toBe('hidden');
    // ...and an unknown preference is NOT treated as "switched off".
    expect(decideGeminiOnboarding(entryInput({ geminiEnabledByUser: undefined })).kind).toBe(
      'firstRun',
    );
  });

  it('does not force setup on a returning account (new device included)', () => {
    const entry = decideGeminiOnboarding(
      entryInput({ preferredModelId: 'gemini-3.5-flash', googleRuntimeStatus: 'CONFIGURED' }),
    );
    expect(entry.kind).toBe('hidden');
  });

  it('honours a device-level completion from an earlier visit', () => {
    expect(
      decideGeminiOnboarding(
        entryInput({ deviceConnectDone: true, googleRuntimeStatus: 'CONFIGURED' }),
      ).kind,
    ).toBe('hidden');
  });

  it('wakes up for a returning account whose Gemini credential was really rejected', () => {
    const entry = decideGeminiOnboarding(
      entryInput({
        preferredModelId: 'gemini-3.5-flash',
        preferredProviderId: 'google',
        googleRuntimeStatus: 'ERROR',
      }),
    );
    expect(entry.kind).toBe('attention');
    if (entry.kind !== 'attention') throw new Error('expected attention');
    expect(entry.problem.kind).toBe('credential');
    expect(entry.problem.action).toBe('reconnect');
    expect(entry.problem.body).toMatch(/renewed/i);
  });

  it('stays quiet when Gemini is configured but no longer the primary AI', () => {
    const entry = decideGeminiOnboarding(
      entryInput({
        preferredModelId: 'gpt-4o',
        preferredProviderId: 'openai',
        googleRuntimeStatus: 'ERROR',
      }),
    );
    expect(entry.kind).toBe('hidden');
  });

  it('does not invent a problem from a missing or unknown runtime report', () => {
    for (const status of [undefined, 'NOT_CONFIGURED', 'UNSUPPORTED_RUNTIME', 'MOCK', 'DISABLED']) {
      const entry = decideGeminiOnboarding(
        entryInput({ preferredModelId: 'gemini-3.5-flash', googleRuntimeStatus: status }),
      );
      expect(entry.kind, String(status)).toBe('hidden');
    }
  });
});

describe('isGeminiRuntimeConfigured', () => {
  it('agrees with the provider lifecycle about what can execute', () => {
    expect(isGeminiRuntimeConfigured('CONFIGURED')).toBe(true);
    expect(isGeminiRuntimeConfigured('MOCK')).toBe(true);
    for (const status of [
      undefined,
      'NOT_CONFIGURED',
      'ERROR',
      'DISABLED',
      'UNSUPPORTED_RUNTIME',
    ]) {
      expect(isGeminiRuntimeConfigured(status), String(status)).toBe(false);
    }
  });
});

describe('buildPreparingSteps — R2, nothing is done before it happened', () => {
  const base = {
    accountLabel: 'Account ready — founder@example.com',
    workspaceReady: true,
    runtimeConfigured: true,
    runtimeKnown: true,
    probeConnected: false,
    discoveredModelCount: null,
    selectedModelName: null,
  };

  it('shows the real automatic sequence when the deployment can run Gemini', () => {
    const steps = buildPreparingSteps(base);
    expect(steps.map((s) => s.key)).toEqual([
      'account',
      'workspace',
      'connecting',
      'verifying',
      'discovering',
      'selecting',
    ]);
    // Only what really happened is done: nothing past the workspace read.
    expect(steps.filter((s) => s.done).map((s) => s.key)).toEqual(['account', 'workspace']);
    expect(steps.find((s) => s.key === 'connecting')?.active).toBe(true);
  });

  it('marks a step done ONLY once the real fact exists, one at a time', () => {
    const connected = buildPreparingSteps({
      ...base,
      probeConnected: true,
      discoveredModelCount: 2,
    });
    expect(connected.filter((s) => s.done).map((s) => s.key)).toEqual([
      'account',
      'workspace',
      'connecting',
      'verifying',
      'discovering',
    ]);
    expect(connected.find((s) => s.key === 'selecting')?.active).toBe(true);

    const selected = buildPreparingSteps({
      ...base,
      probeConnected: true,
      discoveredModelCount: 2,
      selectedModelName: 'Gemini 3.5 Flash',
    });
    expect(selected.every((s) => s.done)).toBe(true);
    expect(selected.some((s) => s.active)).toBe(false);
  });

  it('marks nothing in flight before the workspace read lands', () => {
    const steps = buildPreparingSteps({ ...base, workspaceReady: false });
    expect(steps.some((s) => s.active)).toBe(false);
    expect(steps.find((s) => s.key === 'workspace')?.done).toBe(false);
  });

  it('never claims to be connecting when no credential exists yet (R1)', () => {
    const steps = buildPreparingSteps({ ...base, runtimeConfigured: false });
    expect(steps.map((s) => s.key)).toEqual(['account', 'workspace', 'one-step']);
    expect(steps.some((s) => s.key === 'connecting')).toBe(false);
    expect(steps.find((s) => s.key === 'one-step')?.label).toMatch(/one quick step/i);
  });

  it('shows the automatic sequence as pending while the runtime read has not landed', () => {
    const steps = buildPreparingSteps({
      ...base,
      workspaceReady: false,
      runtimeKnown: false,
      runtimeConfigured: false,
    });
    // The branch is not known yet, so the likely path is shown as PENDING —
    // never as done, and never as a required extra step either.
    expect(steps.some((s) => s.key === 'connecting')).toBe(true);
    expect(steps.some((s) => s.key === 'one-step')).toBe(false);
    expect(steps.some((s) => s.done)).toBe(true); // only the account line
    expect(steps.find((s) => s.key === 'connecting')?.done).toBe(false);
    expect(steps.some((s) => s.active)).toBe(false);
  });
});

describe('selectRecommendedModel — honest provenance', () => {
  const pro = { id: 'gemini-3.5-pro', name: 'Gemini 3.5 Pro' };
  const flash = { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' };

  it('prefers the registry default when the provider really offers it', () => {
    expect(selectRecommendedModel([pro, flash], 'gemini-3.5-flash')).toEqual({
      id: 'gemini-3.5-flash',
      name: 'Gemini 3.5 Flash',
      source: 'discovered',
    });
  });

  it('falls back to the provider’s first model, never an invented id', () => {
    expect(selectRecommendedModel([pro], 'gemini-3.5-flash')).toEqual({
      id: 'gemini-3.5-pro',
      name: 'Gemini 3.5 Pro',
      source: 'discovered',
    });
  });

  it('says so when it had to use the registry default instead of discovery', () => {
    const fallback = selectRecommendedModel([], 'gemini-3.5-flash');
    expect(fallback).toEqual({
      id: 'gemini-3.5-flash',
      name: 'gemini-3.5-flash',
      source: 'preset',
    });
  });

  it('never renders a blank model name', () => {
    expect(selectRecommendedModel([{ id: 'x', name: '   ' }], 'gemini-3.5-flash').name).toBe('x');
  });
});

describe('problemForFailure — WHAT happened / WHY / WHAT next', () => {
  it('sends a rejected credential to Reconnect', () => {
    for (const kind of ['invalid_api_key', 'unauthorized', 'no_credential', 'not_found']) {
      const problem = problemForFailure(kind);
      expect(problem.action, kind).toBe('reconnect');
      expect(problem.actionLabel).toBe('Reconnect Gemini');
    }
  });

  it('treats reachability and rate limits as transient (Retry)', () => {
    for (const kind of [
      'unreachable',
      'rate_limited',
      'unavailable',
      undefined,
      'something_else',
    ]) {
      const problem = problemForFailure(kind);
      expect(problem.action, String(kind)).toBe('retry');
      expect(problem.body).toMatch(/try again/i);
    }
  });

  it('never leaks a raw error, an env var or a stack trace', () => {
    for (const kind of ['invalid_api_key', 'unreachable', undefined]) {
      const problem = problemForFailure(kind);
      expect(`${problem.title} ${problem.body}`).not.toMatch(
        /AI_[A-Z_]*API_KEY|adapter|endpoint|stack|Error:/,
      );
    }
  });
});

describe('user-facing copy (Phase 20 quality bar)', () => {
  it('explains the one extra step in one sentence, in plain language', () => {
    expect(GEMINI_ONBOARDING_COPY.consentWhy).toBe(
      "Connect Gemini so VedMoulya can use Google's AI for your missions, learning and planning.",
    );
    // No jargon a non-technical user would have to look up.
    expect(GEMINI_ONBOARDING_COPY.consentWhy).not.toMatch(/API|token|endpoint|OAuth|JSON/i);
    expect(GEMINI_ONBOARDING_COPY.consentClarification).not.toMatch(/API|authorization/i);
  });

  it('nothing the user sees names an environment variable', () => {
    const everything = Object.values(GEMINI_ONBOARDING_COPY).join(' ');
    expect(everything).not.toMatch(/AI_[A-Z_]*API_KEY|AI_DEFAULT_PROVIDER|process\.env/);
  });
});
