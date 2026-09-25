// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — One-click provider setup (G9) — presentation logic
//
// PURE module (no React, no network) that turns the gateway's typed
// ProviderSetupResult into what ONE setup screen renders:
//
//   • the success card ("✓ Ollama connected" + model + provider kind),
//   • the ONE actionable failure message and its single next action,
//   • the small, honest progress list shown while Connect runs.
//
// HONESTY RULES ENCODED HERE
//   R1 — CONNECTED means the gateway validated a real generation AND persisted
//        the credential. Nothing else may render as connected.
//   R2 — a failed stage is named, never flattened into "not configured": the
//        user always learns WHICH part stopped and what to do next.
//   R3 — the normal path never shows endpoint fields, environment variables,
//        CORS/origin wording or provider-internal ids. Technical detail is
//        reachable only through the explicit [Advanced] affordance.
// ─────────────────────────────────────────────────────────────────────────────

import { type ProviderSetupResultDTO, type ProviderSetupStage } from '../../lib/api-client.js';

/** The steps the Connect button walks through (labels are plain language). */
export const SETUP_STEPS: ReadonlyArray<{ stage: ProviderSetupStage; label: string }> = [
  { stage: 'discover', label: 'Finding your AI' },
  { stage: 'authenticate', label: 'Checking access' },
  { stage: 'validate', label: 'Testing the connection' },
  { stage: 'discover_models', label: 'Reading available models' },
  { stage: 'choose_default_model', label: 'Choosing the best model' },
  { stage: 'persist_credential', label: 'Saving your key securely' },
  { stage: 'enable_provider', label: 'Turning it on' },
  { stage: 'set_preferred', label: 'Making it your default' },
  { stage: 'refresh_state', label: 'Finishing up' },
];

/** The provider kind shown under the model name in the success card. */
export function providerKindLabel(family: string): string {
  return family === 'ollama' ? 'Local' : 'Cloud';
}

/** Order index of a stage — used to mark completed steps, never to guess. */
export function stageIndex(stage: ProviderSetupStage): number {
  const index = SETUP_STEPS.findIndex((step) => step.stage === stage);
  return index === -1 ? 0 : index;
}

/** A step row as the progress list renders it. */
export interface SetupStepView {
  stage: ProviderSetupStage;
  label: string;
  done: boolean;
  active: boolean;
}

/**
 * The progress list while Connect runs. `stage` is the stage the gateway last
 * reported (or 'discover' before the first response) — steps ahead of it are
 * neither done nor active, so nothing is ever shown as finished early.
 */
export function setupStepViews(stage: ProviderSetupStage, failed: boolean): SetupStepView[] {
  const current = stageIndex(stage);
  return SETUP_STEPS.map((step, index) => ({
    ...step,
    done: !failed && index < current,
    active: index === current,
  }));
}

/** What the success card shows. */
export interface SetupSuccessView {
  title: string;
  modelName: string;
  modelId: string;
  kind: string;
  /** True when the provider offers more than one model. */
  canChangeModel: boolean;
  /** Plain-language note about where the key came from, when notable. */
  credentialNote?: string;
}

/**
 * Build the success card from a result. Returns null unless the result is a
 * genuine SUCCESS — a caller can then never render "connected" by accident.
 */
export function setupSuccessView(
  result: ProviderSetupResultDTO,
  providerName: string,
): SetupSuccessView | null {
  if (result.outcome !== 'SUCCESS' || !result.connected) return null;
  const model = result.selectedModel;
  return {
    title: `${providerName} connected`,
    modelName: model?.name ?? model?.id ?? 'Ready',
    modelId: model?.id ?? '',
    kind: providerKindLabel(result.providerId),
    canChangeModel: result.hasModelChoice,
    ...(result.credentialSource === 'PLATFORM'
      ? { credentialNote: 'Using this server’s own key.' }
      : {}),
  };
}

/** What a failure renders: ONE message and exactly one next action. */
export interface SetupFailureView {
  /** WHAT happened, in one plain sentence. */
  message: string;
  /** WHAT to do next — the single primary action label. */
  actionLabel?: string;
  /** A one-sentence explanation shown under the action. */
  detail?: string;
  /** Which stage stopped (diagnostic; rendered small, not as jargon). */
  stage: ProviderSetupStage;
  /** True when the technical details are worth offering. */
  advancedUseful: boolean;
  /** True when the user should be asked for a key they have not supplied. */
  needsCredential: boolean;
}

/**
 * Map a non-success result to what the screen shows. Every branch yields ONE
 * action, and only outcomes that genuinely need the user's key ask for it.
 */
export function setupFailureView(result: ProviderSetupResultDTO): SetupFailureView {
  const recovery = result.recovery;
  const needsCredential =
    result.outcome === 'AUTH_REQUIRED' ||
    (result.outcome === 'VALIDATION_FAILED' && result.credentialSource === 'NONE');
  return {
    message: result.message,
    ...(recovery?.actionLabel !== undefined ? { actionLabel: recovery.actionLabel } : {}),
    ...(recovery?.detail !== undefined ? { detail: recovery.detail } : {}),
    stage: result.stage,
    advancedUseful: recovery?.kind === 'go_advanced' || result.outcome === 'PERSISTENCE_FAILED',
    needsCredential,
  };
}

/**
 * True when this provider needs the user to paste a key BEFORE Connect can do
 * anything useful (the API-key families). Google is excluded because its
 * Connect action runs the OAuth authorization instead.
 */
export function providerNeedsKeyUpFront(family: string): boolean {
  return (
    family === 'openai' ||
    family === 'anthropic' ||
    family === 'deepseek' ||
    family === 'openrouter'
  );
}
