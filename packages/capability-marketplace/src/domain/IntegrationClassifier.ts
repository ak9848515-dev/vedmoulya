// ──────────────────────────────────────────────────────────────────
// VedMoulya — Integration Classifier
// EPIC-013 — every candidate declares HOW it can be integrated.
//
// NATIVE_API      — VedMoulya already integrates it via API.
// DIRECT_PROVIDER — provider API exists, configurable in VedMoulya.
// OPEN_SOURCE     — open-source project (self-hostable, needs setup).
// LOCAL_MODEL     — runs locally (Ollama/LM Studio/OpenAI-compatible).
// GITHUB_PROJECT  — GitHub project (untrusted until evaluated).
// EXTERNAL_APP    — only available inside an external application.
// MANUAL_STEP     — human action required.
// UNKNOWN         — no evidence.
//
// NEVER pretend an external application has API automation without
// evidence. apiAvailable stays 'no'/'UNKNOWN' unless the source proved
// an API exists.
// ──────────────────────────────────────────────────────────────────

import type { CandidateClass, IntegrationType } from '../types/capability-types.js';
import type {
  DiscoveryCandidateFact,
  LocalModelCandidateFact,
  ProviderCandidateFact,
} from '../contracts/CapabilitySourcePort.js';

export interface IntegrationResult {
  integrationType: IntegrationType;
  classification: CandidateClass;
  apiAvailable: 'yes' | 'no' | 'UNKNOWN';
  reasons: string[];
}

export class IntegrationClassifier {
  /** Classify a configured provider registry candidate. */
  classifyProvider(fact: ProviderCandidateFact): IntegrationResult {
    const reasons: string[] = [];
    let integrationType: IntegrationType;
    let classification: CandidateClass;
    const apiAvailable: 'yes' | 'no' | 'UNKNOWN' = 'yes';

    if (fact.family === 'ollama' || fact.family === 'lm-studio') {
      integrationType = 'LOCAL_MODEL';
      classification = fact.configured ? 'READY' : 'CONFIGURE';
      reasons.push(
        fact.configured
          ? 'Local runtime already configured.'
          : 'Local runtime available — configure it to use.',
      );
    } else if (fact.configured) {
      integrationType = 'NATIVE_API';
      classification = 'READY';
      reasons.push(
        'Provider is configured and enabled — ready to use through the existing runtime.',
      );
    } else {
      integrationType = 'DIRECT_PROVIDER';
      classification = 'CONFIGURE';
      reasons.push('Provider API exists — configure it in VedMoulya to use.');
    }

    return { integrationType, classification, apiAvailable, reasons };
  }

  /** Classify an AI World discovery item (untrusted input). */
  classifyDiscovery(fact: DiscoveryCandidateFact): IntegrationResult {
    const untrusted = fact.securityFlags.length > 0;

    // Security: flagged discoveries are never auto-integrated.
    if (untrusted) {
      return {
        integrationType: 'UNKNOWN',
        classification: 'UNKNOWN',
        apiAvailable: 'UNKNOWN',
        reasons: [
          'Security scanner flagged this discovery — treated as untrusted; evaluate manually before any integration.',
        ],
      };
    }

    if (fact.category === 'github') {
      const flags = fact.github?.flags ?? [];
      const risky = flags.some(
        (f) => f === 'suspicious' || f === 'security_concerns' || f === 'unclear_license',
      );
      return {
        integrationType: 'GITHUB_PROJECT',
        classification: risky ? 'UNKNOWN' : 'EVALUATE',
        apiAvailable: 'no',
        reasons: [
          'Open-source GitHub project — must be evaluated before integration; never auto-installed.',
          ...(risky
            ? ['Repository carries caution flags (license/security).']
            : ['No API is implied — integration requires evaluation.']),
        ],
      };
    }

    if (fact.category === 'application') {
      // External applications are only EXTERNAL unless evidence proves an API.
      return {
        integrationType: 'EXTERNAL_APPLICATION',
        classification: 'EXTERNAL',
        apiAvailable: 'UNKNOWN',
        reasons: [
          'Available as an external application — an API is not assumed. Check whether automation is possible before relying on it.',
        ],
      };
    }

    if (fact.configurable && fact.suggestedFamily) {
      return {
        integrationType: 'DIRECT_PROVIDER',
        classification: 'CONFIGURE',
        apiAvailable: 'yes',
        reasons: [
          'Discovered provider/model — configure it in VedMoulya to use (evidence-backed).',
        ],
      };
    }

    return {
      integrationType: 'UNKNOWN',
      classification: 'EVALUATE',
      apiAvailable: 'UNKNOWN',
      reasons: ['Discovered item is potentially relevant — evaluate before integration.'],
    };
  }

  /** Classify a locally-discovered model. */
  classifyLocalModel(fact: LocalModelCandidateFact): IntegrationResult {
    return {
      integrationType: 'LOCAL_MODEL',
      classification: fact.available ? 'READY' : 'CONFIGURE',
      apiAvailable: 'yes',
      reasons: [
        `Local model via ${fact.runtime}${fact.available ? ' — available now.' : ' — configure the runtime to make it available.'}`,
        `Capabilities are ${fact.capabilitiesProvenance.toLowerCase()} from the model name — never claimed as verified unless the runtime says so.`,
      ],
    };
  }

  /** A step that only a human can perform. */
  manual(): IntegrationResult {
    return {
      integrationType: 'MANUAL_STEP',
      classification: 'MANUAL',
      apiAvailable: 'no',
      reasons: ['No tool can automate this step — human action is required.'],
    };
  }
}
