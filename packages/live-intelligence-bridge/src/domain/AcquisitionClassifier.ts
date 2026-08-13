// ──────────────────────────────────────────────────────────────────
// VedMoulya — Live Intelligence Bridge · AcquisitionClassifier
// EPIC-017 § Phase 4 — FREE / LOCAL / GITHUB / PAID DECISION.
//
// Maps an EXISTING intelligence option (free class, integration type,
// local availability, source) to the acquisition classification:
//   FREE_API / FREE_WITH_QUOTA / LOCAL_MODEL / OPEN_SOURCE /
//   GITHUB_PROJECT / PAID / EXTERNAL_APPLICATION / MANUAL / UNKNOWN.
//
// The classifier is deterministic and derives ONLY from facts that
// already carry evidence — FREE ≠ BEST, LOCAL ≠ BEST, GITHUB ≠
// TRUSTED, PAID ≠ BEST. UNKNOWN stays UNKNOWN.
// ──────────────────────────────────────────────────────────────────

import type { AcquisitionClass } from '../types/bridge-types.js';
import type { IntelligenceOption } from '@vedmoulya/ecosystem-intelligence';

const FREE_CLASSES: ReadonlySet<string> = new Set([
  'FREE_API',
  'FREE_WITH_QUOTA',
  'OPEN_WEIGHTS',
  'LOCAL',
  'OPEN_SOURCE',
]);

export interface AcquisitionVerdict {
  acquisition: AcquisitionClass;
  reasons: string[];
}

export class AcquisitionClassifier {
  /**
   * Classify a candidate from the intelligence option's own facts.
   * The option is UNTRUSTED INPUT — only evidence-backed fields drive
   * the classification; a missing field yields UNKNOWN, never a guess.
   */
  classify(option: IntelligenceOption): AcquisitionVerdict {
    const reasons: string[] = [];

    // Local model — evidence of local availability first.
    if (option.localAvailability === 'yes') {
      return {
        acquisition: 'LOCAL_MODEL',
        reasons: ['Local availability evidenced — runs on the user hardware.'],
      };
    }

    // GitHub / open-source discovery items (never assumed executable).
    const github = option.providerId?.startsWith('discovery:') ?? false;
    const sourceGitHub = option.evidence.some((e) => /github\.com/i.test(e));
    if (github || sourceGitHub) {
      return {
        acquisition: 'GITHUB_PROJECT',
        reasons: [
          'Open-source candidate from discovery — untrusted until security + license review.',
        ],
      };
    }

    // External applications are never assumed API-automatable.
    if (option.requires.includes('external_application')) {
      return {
        acquisition: 'EXTERNAL_APPLICATION',
        reasons: [
          'External application — no API is assumed; automation requires confirmed evidence.',
        ],
      };
    }

    // Free classes (evidence-backed).
    if (option.freeClass && FREE_CLASSES.has(option.freeClass)) {
      if (option.freeClass === 'FREE_WITH_QUOTA') {
        return {
          acquisition: 'FREE_WITH_QUOTA',
          reasons: ['Free within quota — bounded limits apply; never unlimited free.'],
        };
      }
      if (option.freeClass === 'OPEN_SOURCE' || option.freeClass === 'OPEN_WEIGHTS') {
        return {
          acquisition: 'OPEN_SOURCE',
          reasons: [
            'Open source/open weights — license and security review required before integration.',
          ],
        };
      }
      return {
        acquisition: 'FREE_API',
        reasons: ['Free API availability evidenced.'],
      };
    }

    // Configured providers are usable now — cost class from evidence.
    if (option.requires.length === 0) {
      reasons.push('No activation required — already configured.');
    }

    // Paid — only when cost evidence exists; otherwise UNKNOWN, never assumed paid.
    if (
      option.costUsd !== undefined ||
      option.requires.includes('subscription') ||
      option.requires.includes('api_key')
    ) {
      reasons.push(
        option.costUsd !== undefined
          ? 'Paid option with evidenced cost.'
          : 'Paid option — cost evidence pending.',
      );
      return { acquisition: 'PAID', reasons };
    }

    if (option.requires.includes('download') || option.requires.includes('local_install')) {
      return {
        acquisition: 'LOCAL_MODEL',
        reasons: ['Download/local install required — local-model class.'],
      };
    }

    return {
      acquisition: 'UNKNOWN',
      reasons: ['Acquisition class cannot be established from available evidence.'],
    };
  }
}
