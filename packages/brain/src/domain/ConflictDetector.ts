// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · ConflictDetector
// EPIC-016 §15 — Conflict intelligence.
//
// If providers disagree, the Brain does NOT vote blindly. It classifies
// the disagreement and, when material, requests independent verification
// and re-evaluates. If unresolved, it says so — never manufactured
// certainty.
// ──────────────────────────────────────────────────────────────────

import type { ConflictClassification, ConflictReport } from '../types/brain-types.js';

export interface ProviderClaimInput {
  providerId: string;
  /** The claim for the shared topic. */
  claim: string;
  /** Cited evidence (empty = no evidence). */
  evidence: string[];
  confidence: number;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  const aWords = new Set(na.split(' '));
  const bWords = new Set(nb.split(' '));
  const inter = [...aWords].filter((w) => bWords.has(w)).length;
  const union = new Set([...aWords, ...bWords]).size;
  return union === 0 ? 0 : inter / union;
}

/** Opposite-polarity markers: same structure, opposite meaning. */
const OPPOSITES: Array<[RegExp, RegExp]> = [
  [/\btrue\b/, /\bfalse\b/],
  [/\byes\b/, /\bno\b/],
  [/\b(is|are|was|were)\b/, /\b(is not|are not|was not|were not|isn't|aren't)\b/],
  [/\b(increase|higher|more)\b/, /\b(decrease|lower|less)\b/],
  [/\b(supports|supports)/, /\b(opposes)\b/],
];

/** Claims with different numbers on the same topic are conflicting. */
function numbers(text: string): number[] {
  return (text.match(/\d+(\.\d+)?/g) ?? []).map(Number);
}

function numericDisagreement(a: string, b: string): boolean {
  const na = numbers(a);
  const nb = numbers(b);
  if (na.length === 0 || nb.length === 0) return false;
  // eslint-disable-next-line security/detect-object-injection -- Array index access (nb is a plain array; i is the every() index, never user-controlled).
  return !na.every((n, i) => nb[i] === n);
}

function oppositePolarity(a: string, b: string): boolean {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  return OPPOSITES.some(([pa, pb]) => pa.test(la) && pb.test(lb));
}

export class ConflictDetector {
  /**
   * Classifies disagreement across N providers on one topic.
   * n > 1 required; n === 1 → no conflict (AGREEMENT trivially).
   */
  classify(topic: string, inputs: ProviderClaimInput[]): ConflictReport {
    if (inputs.length <= 1) {
      return {
        topic,
        classification: 'AGREEMENT',
        providers: inputs.map((i) => i.providerId),
        disagreement: 'Single source — no conflict to assess.',
        evidence: inputs.flatMap((i) => i.evidence),
        confidence: inputs[0]?.confidence ?? 0,
      };
    }

    const first = inputs[0] as ProviderClaimInput;
    const pairs = inputs.slice(1).map((other) => ({
      other,
      sim: similarity(first.claim, other.claim),
    }));
    const maxSim = Math.max(...pairs.map((p) => p.sim), 0);
    const allHaveEvidence = inputs.every((i) => i.evidence.length > 0);

    // Structural agreement on the same topic but opposite meaning or
    // different numbers = a REAL conflict, never a minor variance.
    const opposite = inputs.slice(1).some((other) => oppositePolarity(first.claim, other.claim));
    const numeric = inputs.slice(1).some((other) => numericDisagreement(first.claim, other.claim));

    let classification: ConflictClassification;
    if (opposite || numeric) {
      classification = allHaveEvidence ? 'EVIDENCE_CONFLICT' : 'MATERIAL_CONFLICT';
    } else if (maxSim >= 0.8) {
      classification = 'AGREEMENT';
    } else if (maxSim >= 0.45) {
      classification = 'MINOR_VARIANCE';
    } else if (allHaveEvidence) {
      classification = 'EVIDENCE_CONFLICT';
    } else {
      classification = 'MATERIAL_CONFLICT';
    }

    const disagreement =
      classification === 'AGREEMENT'
        ? 'Providers agree.'
        : `Providers disagree (similarity ${Math.round(maxSim * 100)}%).`;

    return {
      topic,
      classification,
      providers: inputs.map((i) => i.providerId),
      disagreement,
      evidence: inputs.flatMap((i) => i.evidence),
      confidence: Math.min(...inputs.map((i) => i.confidence), 1),
    };
  }

  /**
   * Independent verification step for MATERIAL/EVIDENCE conflicts:
   * adds a specialist's verdict and re-classifies.
   */
  reEvaluate(
    topic: string,
    inputs: ProviderClaimInput[],
    specialist: ProviderClaimInput,
  ): ConflictReport {
    return this.classify(topic, [...inputs, specialist]);
  }
}
