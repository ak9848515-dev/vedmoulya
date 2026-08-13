// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Bridge: Plan → Run Resolver (PHASE 1)
// EPIC-014 — consumes the REAL EPIC-013 FactoryCapabilityPlan and
// resolves each step to a disposition. Only EXECUTABLE steps may enter
// execution. CONFIGURE pauses with a deep-link into the existing
// provider configuration. EXTERNAL / MANUAL / UNAVAILABLE steps are
// NEVER falsely executed — they become honest hand-offs or skips and
// the run completes as PARTIAL, never a fake DONE.
// ──────────────────────────────────────────────────────────────────

import type {
  FactoryCapabilityPlan,
  PlanStep,
  IntegrationType,
} from '@vedmoulya/capability-marketplace';
import type { StepDisposition } from '../types/execution-types.js';
import { isMapped } from './CapabilityMapper.js';

export interface StepResolution {
  stepId: string;
  title: string;
  capability: string;
  disposition: StepDisposition;
  reasons: string[];
  /** Provider/model chosen by the plan (quality-first — never re-ranked). */
  provider?: string;
  model?: string;
  /** Deep-link target for CONFIGURE steps (existing screens only). */
  deepLink?: string;
  /** The plan's selected candidate id, when one exists. */
  candidateId?: string;
}

const AUTOMATABLE_INTEGRATIONS: readonly IntegrationType[] = [
  'NATIVE_API',
  'DIRECT_PROVIDER',
  'LOCAL_MODEL',
];

export class PlanRunResolver {
  /**
   * Resolve every step of the plan. Purely deterministic — the only
   * inputs are the plan's own evidence and the runtime capability map.
   */
  resolve(plan: FactoryCapabilityPlan): StepResolution[] {
    return plan.steps.map((step) => this.resolveStep(plan, step));
  }

  private resolveStep(plan: FactoryCapabilityPlan, step: PlanStep): StepResolution {
    const selected = step.candidates.find((c) => c.id === step.selectedCandidateId);
    const capability = step.capability;

    // 1. No selected candidate at all → unavailable (nothing to bind).
    if (!selected) {
      return {
        stepId: step.id,
        title: step.title,
        capability,
        disposition: 'UNAVAILABLE',
        reasons: ['No candidate was selected by the plan — this step cannot be executed.'],
      };
    }

    const base: Omit<StepResolution, 'disposition' | 'reasons'> = {
      stepId: step.id,
      title: step.title,
      capability,
      provider: selected.providerFamily,
      model: selected.modelId ?? selected.name,
      candidateId: selected.id,
      deepLink:
        selected.configurable && selected.suggestedFamily
          ? `/providers?provider=${encodeURIComponent(selected.suggestedFamily)}`
          : undefined,
    };

    // 2. Manual/EXTERNAL classification or manual automation → MANUAL_REQUIRED.
    if (
      selected.kind === 'manual' ||
      selected.classification === 'MANUAL' ||
      step.automation === 'MANUAL'
    ) {
      return {
        ...base,
        disposition: 'MANUAL_REQUIRED',
        reasons: [`${step.title} requires a human — ${selected.name}.`],
      };
    }

    // 3. External application → MANUAL_REQUIRED hand-off (never executed).
    if (
      selected.integrationType === 'EXTERNAL_APPLICATION' ||
      selected.classification === 'EXTERNAL'
    ) {
      return {
        ...base,
        disposition: 'MANUAL_REQUIRED',
        reasons: [
          `${selected.name} is an external application — no API execution is assumed. A human performs this step.`,
        ],
      };
    }

    // 4. Not configured → CONFIGURE (deep-link into existing config).
    if (selected.classification === 'CONFIGURE' || selected.configurable) {
      return {
        ...base,
        disposition: 'CONFIGURE',
        reasons: [
          `${selected.name} is automatable once configured — configure it first (deep-link to the existing provider screen).`,
        ],
      };
    }

    // 5. Irreversible action → approval gate BEFORE execution.
    if (step.irreversible || plan.humanApprovalPoints.some((p) => p.id === step.id)) {
      return {
        ...base,
        disposition: 'WAITING_FOR_APPROVAL',
        reasons: [
          `${step.title} performs an irreversible action — explicit user approval is required before execution.`,
        ],
      };
    }

    // 6. Executable only when: automatable integration + READY + runtime path.
    const automatable = AUTOMATABLE_INTEGRATIONS.includes(selected.integrationType);
    if (!automatable) {
      return {
        ...base,
        disposition: 'UNAVAILABLE',
        reasons: [
          `${selected.name} (${selected.integrationType}) has no automatable execution path.`,
        ],
      };
    }
    if (selected.classification !== 'READY') {
      return {
        ...base,
        disposition: 'UNAVAILABLE',
        reasons: [
          `${selected.name} is not READY (${selected.classification}) — no execution without configuration.`,
        ],
      };
    }
    if (!isMapped(capability)) {
      return {
        ...base,
        disposition: 'UNAVAILABLE',
        reasons: [`No runtime execution path exists for the ${capability} capability.`],
      };
    }

    return {
      ...base,
      disposition: 'EXECUTABLE',
      reasons: [
        `${selected.name} is READY and API-automatable for ${capability} — eligible for execution.`,
      ],
    };
  }
}
