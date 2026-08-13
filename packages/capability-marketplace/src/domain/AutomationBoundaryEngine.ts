// ──────────────────────────────────────────────────────────────────
// VedMoulya — Automation Boundary Engine
// EPIC-013 — for every factory step determine:
//   FULLY_AUTOMATED    — VedMoulya drives the whole step via API.
//   PARTIALLY_AUTOMATED— parts are automated, parts are manual/external.
//   HUMAN_APPROVAL     — automation exists but an irreversible action
//                        requires explicit approval.
//   MANUAL             — no automation.
// Never claim full automation where the provider/API does not
// support it.
// ──────────────────────────────────────────────────────────────────

import type {
  AutomationLevel,
  CandidateClass,
  CapabilityCandidate,
  IntegrationType,
} from '../types/capability-types.js';

export interface AutomationAssessment {
  automation: AutomationLevel;
  reasons: string[];
}

export class AutomationBoundaryEngine {
  /**
   * Assess a step given its candidates and whether the step is
   * irreversible (needs approval).
   */
  assess(candidates: CapabilityCandidate[], irreversible: boolean): AutomationAssessment {
    if (candidates.length === 0) {
      return {
        automation: 'MANUAL',
        reasons: ['No candidate found for this step — a human must perform it.'],
      };
    }

    const best = candidates[0];
    if (!best) {
      return {
        automation: 'MANUAL',
        reasons: ['No candidate found for this step — a human must perform it.'],
      };
    }
    const integration = best.integrationType;
    const classification = best.classification;

    // Irreversible actions always gate automation behind approval.
    if (irreversible) {
      if (this.automatable(integration, classification)) {
        return {
          automation: 'HUMAN_APPROVAL',
          reasons: [
            `Automation is possible via ${best.name}, but this step performs an irreversible action — explicit approval required.`,
          ],
        };
      }
      return {
        automation: 'MANUAL',
        reasons: ['This step is irreversible and cannot be automated — human action required.'],
      };
    }

    switch (integration) {
      case 'NATIVE_API':
      case 'DIRECT_PROVIDER':
      case 'LOCAL_MODEL':
        if (classification === 'CONFIGURE') {
          return {
            automation: 'PARTIALLY_AUTOMATED',
            reasons: [`${best.name} is automatable once configured — configure it first.`],
          };
        }
        return {
          automation: 'FULLY_AUTOMATED',
          reasons: [`${best.name} is API-automatable through VedMoulya.`],
        };
      case 'OPEN_SOURCE':
      case 'GITHUB_PROJECT':
        return {
          automation: 'PARTIALLY_AUTOMATED',
          reasons: [
            `${best.name} is open source — it can be self-hosted and automated, but setup and evaluation are required first.`,
          ],
        };
      case 'EXTERNAL_APPLICATION':
        return {
          automation: 'PARTIALLY_AUTOMATED',
          reasons: [
            `${best.name} is an external application — automation depends on a confirmed API; assume partial/manual until verified.`,
          ],
        };
      case 'MANUAL_STEP':
        return { automation: 'MANUAL', reasons: ['This step is a manual action.'] };
      case 'UNKNOWN':
      default:
        return {
          automation: 'MANUAL',
          reasons: ['Integration is unknown — treat this step as manual until evidence exists.'],
        };
    }
  }

  /** Overall plan automation level from per-step automation. */
  overall(steps: Array<{ automation: AutomationLevel }>): {
    automation: AutomationLevel;
    percent: number;
  } {
    if (steps.length === 0) return { automation: 'MANUAL', percent: 0 };
    const fully = steps.filter((s) => s.automation === 'FULLY_AUTOMATED').length;
    const percent = Math.round((fully / steps.length) * 100);
    const anyManual = steps.some((s) => s.automation === 'MANUAL');
    const anyPartial = steps.some((s) => s.automation === 'PARTIALLY_AUTOMATED');
    const anyApproval = steps.some((s) => s.automation === 'HUMAN_APPROVAL');

    if (fully === steps.length) return { automation: 'FULLY_AUTOMATED', percent };
    if (anyManual) return { automation: 'MANUAL', percent };
    if (anyApproval) return { automation: 'HUMAN_APPROVAL', percent };
    if (anyPartial) return { automation: 'PARTIALLY_AUTOMATED', percent };
    return { automation: 'FULLY_AUTOMATED', percent };
  }

  private automatable(integration: IntegrationType, classification: CandidateClass): boolean {
    if (classification === 'MANUAL' || classification === 'UNKNOWN') return false;
    return (
      integration === 'NATIVE_API' ||
      integration === 'DIRECT_PROVIDER' ||
      integration === 'LOCAL_MODEL' ||
      (integration === 'OPEN_SOURCE' && classification === 'READY')
    );
  }
}
