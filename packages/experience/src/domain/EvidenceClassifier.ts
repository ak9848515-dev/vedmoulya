// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Intelligence: Evidence Classifier
// EPIC-010 — Phase 10. Every serious finding must carry evidence.
// Classifications: CONFIRMED (direct source evidence), LIKELY
// (strong indirect evidence), UNCERTAIN (insufficient evidence — say
// so), NOT_FOUND (the claimed defect is not present). The critic never
// manufactures confidence.
// ──────────────────────────────────────────────────────────────────

import type { CriticFinding, EvidenceClass } from '../types/experience-types.js';

export interface EvidenceClassifierInput {
  finding: CriticFinding;
  /** Direct evidence strings extracted from the generated code. */
  sourceEvidence: string[];
}

export class EvidenceClassifier {
  classify(input: EvidenceClassifierInput): EvidenceClass {
    const f = input.finding;
    // Already-classified findings are returned as-is (engines set classes
    // deterministically; this classifier is the source of truth for them).
    if (f.evidenceClass !== 'UNCERTAIN' && f.evidenceClass !== 'NOT_FOUND') {
      return f.evidenceClass;
    }
    // NOT_FOUND: a rule that fires only when a marker is ABSENT is evidence
    // that the defect is present — confirm it when the evidence string is
    // specific.
    if (f.evidence.trim().length === 0) return 'NOT_FOUND';
    if (f.evidence.includes('does not appear') || f.evidence.includes('absent')) {
      return 'CONFIRMED';
    }
    if (input.sourceEvidence.length === 0) return 'UNCERTAIN';
    const matches = input.sourceEvidence.filter(
      (e) =>
        e.toLowerCase().includes(f.issue.toLowerCase()) ||
        e.toLowerCase().includes(f.evidence.toLowerCase()),
    );
    if (matches.length > 0) return 'CONFIRMED';
    return 'LIKELY';
  }

  /** Honesty contract: findings with insufficient evidence say so. */
  evidenceSummary(finding: CriticFinding): string {
    if (finding.evidenceClass === 'UNCERTAIN') {
      return `Insufficient evidence to confirm "${finding.issue}" — further inspection required.`;
    }
    if (finding.evidenceClass === 'NOT_FOUND') {
      return `No evidence of "${finding.issue}" found in the generated code.`;
    }
    return `Evidence: ${finding.evidence}.`;
  }
}
