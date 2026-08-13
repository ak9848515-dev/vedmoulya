// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · OutcomeEvaluator
// EPIC-016 §19 — Continuous learning.
//
// After each meaningful task: what worked, what failed, which provider
// performed well/failed, was the recommendation correct, did the user
// approve, did verification catch issues, was the output accepted.
// Feeds the preference ledger (EPIC-014) + memory (EPIC-015 stays
// separate). Never modifies provider rankings from a single anecdote —
// evidence over time. Explicit > inferred; inference is NEVER promoted
// silently.
// ──────────────────────────────────────────────────────────────────

import type { OutcomeEvaluation, ProviderRole } from '../types/brain-types.js';
import type { BrainPreferencePort } from '../contracts/brain-ports.js';

export interface OutcomeInput {
  providerResults: Array<{
    providerId: string;
    role: ProviderRole;
    capability: string;
    succeeded: boolean;
    qualityNote?: string;
  }>;
  recommendationCorrect: boolean;
  capabilityUseful: boolean;
  userApproved: boolean;
  verificationCaughtIssues: boolean;
  replanned: boolean;
  outputAccepted: boolean;
  /** Explicit user statements override everything. */
  explicitFeedback?: Array<{ fact: string; confidence?: number }>;
}

export class OutcomeEvaluator {
  constructor(private readonly ledger: BrainPreferencePort) {}

  async evaluate(input: OutcomeInput): Promise<OutcomeEvaluation> {
    const whatWorked: string[] = [];
    const whatFailed: string[] = [];
    const providerPerformance = input.providerResults.map((r) => ({
      providerId: r.providerId,
      capability: r.capability as OutcomeEvaluation['providerPerformance'][number]['capability'],
      succeeded: r.succeeded,
      qualityNote: r.qualityNote,
    }));

    for (const r of input.providerResults) {
      if (r.succeeded) {
        whatWorked.push(`${r.providerId} succeeded for ${r.capability} (${r.role}).`);
      } else {
        whatFailed.push(`${r.providerId} failed for ${r.capability} (${r.role}).`);
      }
    }
    if (input.recommendationCorrect) whatWorked.push('Recommendation was correct.');
    else whatFailed.push('Recommendation was not correct.');
    if (input.verificationCaughtIssues)
      whatWorked.push('Verification caught issues before delivery.');
    if (input.replanned) whatWorked.push('Bounded replan resolved the blocker.');

    // ── Preference facts: EXPLICIT first, then INFERRED (bounded). ──
    const preferenceFacts: OutcomeEvaluation['preferenceFacts'] = [];
    for (const fb of input.explicitFeedback ?? []) {
      preferenceFacts.push({
        fact: fb.fact,
        source: 'EXPLICIT',
        reason: 'User stated this preference explicitly.',
        confidence: fb.confidence ?? 0.95,
      });
    }

    // Inferred facts are recorded at LOWER confidence and clearly marked.
    for (const r of input.providerResults) {
      if (r.succeeded) {
        preferenceFacts.push({
          fact: `${r.providerId} succeeded for ${r.capability} — candidate for future ${r.capability} tasks.`,
          source: 'INFERRED',
          reason: 'Inferred from one successful execution; not a permanent preference.',
          confidence: 0.4,
        });
      } else {
        preferenceFacts.push({
          fact: `${r.providerId} failed for ${r.capability} — consider alternatives for ${r.capability}.`,
          source: 'INFERRED',
          reason: 'Inferred from one failed execution; not a permanent preference.',
          confidence: 0.3,
        });
      }
    }

    // Feed the frozen preference ledger (EPIC-014) — provenance preserved.
    for (const fact of preferenceFacts) {
      await this.ledger.record({
        executionId: 'brain-outcome',
        source: fact.source === 'EXPLICIT' ? 'explicit_user_selection' : 'inferred_observation',
        fact: fact.fact,
        reason: fact.reason,
        confidence: fact.confidence,
      });
    }

    return {
      whatWorked,
      whatFailed,
      providerPerformance,
      recommendationCorrect: input.recommendationCorrect,
      capabilityUseful: input.capabilityUseful,
      userApproved: input.userApproved,
      verificationCaughtIssues: input.verificationCaughtIssues,
      replanned: input.replanned,
      outputAccepted: input.outputAccepted,
      preferenceFacts,
    };
  }
}
