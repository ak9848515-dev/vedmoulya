// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — one-click setup presentation (G9) tests
//
// The flow's tests cover this module through the rendered screen; these cover
// it DIRECTLY, so its honesty rules (R1–R3) are pinned at the source:
//   R1 — nothing but a genuine SUCCESS renders as connected,
//   R2 — a failed stage is named and carries exactly ONE next action,
//   R3 — the technical detail only appears behind [Advanced].
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  SETUP_STEPS,
  providerKindLabel,
  setupFailureView,
  setupStepViews,
  setupSuccessView,
  stageIndex,
} from '../provider-setup-copy.js';
import type { ProviderSetupResultDTO } from '../../../lib/api-client.js';

function result(overrides: Partial<ProviderSetupResultDTO> = {}): ProviderSetupResultDTO {
  return {
    outcome: 'SUCCESS',
    connected: true,
    providerId: 'openai',
    stage: 'refresh_state',
    credentialSource: 'USER',
    selectedModel: { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
    availableModels: [],
    hasModelChoice: false,
    modelSelectionSource: 'provider_default',
    message: 'OpenAI connected',
    credentialStored: true,
    preferencesApplied: true,
    completedAt: '2026-09-23T00:00:00.000Z',
    ...overrides,
  };
}

describe('provider kind + step order', () => {
  it('calls only the local family "Local"', () => {
    expect(providerKindLabel('ollama')).toBe('Local');
    for (const family of ['google', 'openai', 'anthropic', 'deepseek', 'openai-compatible']) {
      expect(providerKindLabel(family)).toBe('Cloud');
    }
  });

  it('indexes the declared stages in order', () => {
    expect(stageIndex('discover')).toBe(0);
    expect(stageIndex('refresh_state')).toBe(SETUP_STEPS.length - 1);
    // Strictly increasing — the progress list can never show a later step as
    // finished before an earlier one.
    const indices = SETUP_STEPS.map((step) => stageIndex(step.stage));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(new Set(indices).size).toBe(indices.length);
  });
});

describe('setupStepViews (honest progress)', () => {
  it('marks earlier steps done and the reported stage active', () => {
    const views = setupStepViews('validate', false);
    const validate = views.find((view) => view.stage === 'validate');
    expect(validate?.active).toBe(true);
    expect(validate?.done).toBe(false);

    const before = views.slice(0, stageIndex('validate'));
    expect(before.every((view) => view.done)).toBe(true);
    // Nothing ahead of the reported stage is claimed as finished.
    const after = views.slice(stageIndex('validate') + 1);
    expect(after.every((view) => !view.done && !view.active)).toBe(true);
  });

  it('claims no completed step once the stage failed', () => {
    const views = setupStepViews('persist_credential', true);
    expect(views.every((view) => view.done)).toBe(false);
    expect(views.find((view) => view.stage === 'persist_credential')?.active).toBe(true);
  });
});

describe('setupSuccessView (R1 — only a real SUCCESS renders as connected)', () => {
  it('renders nothing for a non-success or an unconnected result', () => {
    expect(setupSuccessView(result({ outcome: 'VALIDATION_FAILED' }), 'OpenAI')).toBeNull();
    expect(setupSuccessView(result({ connected: false }), 'OpenAI')).toBeNull();
  });

  it('builds the card from the gateway result, never from UI state', () => {
    const view = setupSuccessView(
      result({ hasModelChoice: true, selectedModel: { id: 'claude-sonnet-4', name: 'Claude' } }),
      'Claude',
    );
    expect(view).toMatchObject({
      title: 'Claude connected',
      modelName: 'Claude',
      modelId: 'claude-sonnet-4',
      kind: 'Cloud',
      canChangeModel: true,
    });
    // No note is added when the credential is the user's own.
    expect(view?.credentialNote).toBeUndefined();
  });

  it('falls back to the model id and then to "Ready" without inventing a name', () => {
    expect(
      setupSuccessView(result({ selectedModel: { id: 'gpt-4o-mini', name: '' } }), 'OpenAI')
        ?.modelName,
    ).toBe('');
    expect(setupSuccessView(result({ selectedModel: null }), 'OpenAI')).toMatchObject({
      modelName: 'Ready',
      modelId: '',
    });
  });

  it('says when the deployment’s own credential was used', () => {
    const view = setupSuccessView(result({ credentialSource: 'PLATFORM' }), 'Gemini');
    expect(view?.credentialNote).toMatch(/server’s own key/);
  });

  it('reports the local kind for a local provider', () => {
    expect(setupSuccessView(result({ providerId: 'ollama' }), 'Ollama')?.kind).toBe('Local');
  });
});

describe('setupFailureView (R2/R3 — one stage, one action, detail only on request)', () => {
  it('carries the recovery action and its detail', () => {
    const view = setupFailureView(
      result({
        outcome: 'VALIDATION_FAILED',
        connected: false,
        stage: 'validate',
        credentialSource: 'NONE',
        message: 'The model did not answer.',
        recovery: {
          kind: 'start_local_provider',
          actionLabel: 'Start Ollama',
          detail: 'VedMoulya could not reach http://localhost:11434.',
        },
      }),
    );
    expect(view).toMatchObject({
      message: 'The model did not answer.',
      actionLabel: 'Start Ollama',
      detail: 'VedMoulya could not reach http://localhost:11434.',
      stage: 'validate',
      advancedUseful: false,
      needsCredential: true,
    });
  });

  it('omits the action entirely when the gateway offered no recovery', () => {
    const view = setupFailureView(
      result({ outcome: 'UNAVAILABLE', connected: false, recovery: undefined }),
    );
    expect(view.actionLabel).toBeUndefined();
    expect(view.detail).toBeUndefined();
    expect(view.needsCredential).toBe(false);
  });

  it('asks for a credential only when one is genuinely needed', () => {
    const required = (o: Partial<ProviderSetupResultDTO>): boolean =>
      setupFailureView(result({ connected: false, ...o })).needsCredential;

    expect(required({ outcome: 'AUTH_REQUIRED' })).toBe(true);
    expect(required({ outcome: 'VALIDATION_FAILED', credentialSource: 'NONE' })).toBe(true);
    // A rejected key the user already supplied is not "missing".
    expect(required({ outcome: 'VALIDATION_FAILED', credentialSource: 'USER' })).toBe(false);
    // …and an unavailability verdict is never turned into a credential prompt.
    expect(required({ outcome: 'UNAVAILABLE', credentialSource: 'NONE' })).toBe(false);
  });

  it('marks the technical detail as worth offering only when it helps', () => {
    const advancedUseful = (o: Partial<ProviderSetupResultDTO>): boolean =>
      setupFailureView(result({ connected: false, ...o })).advancedUseful;

    expect(advancedUseful({ outcome: 'PERSISTENCE_FAILED', recovery: undefined })).toBe(true);
    expect(
      advancedUseful({
        outcome: 'VALIDATION_FAILED',
        recovery: { kind: 'go_advanced', actionLabel: 'Open advanced settings' },
      }),
    ).toBe(true);
    expect(
      advancedUseful({
        outcome: 'VALIDATION_FAILED',
        recovery: { kind: 'retry', actionLabel: 'Try again' },
      }),
    ).toBe(false);
  });
});
