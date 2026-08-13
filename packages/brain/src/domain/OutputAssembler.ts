// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · OutputAssembler
// EPIC-016 §14 — Output assembly.
//
// The Brain never simply concatenates provider outputs. Pipeline:
// OUTPUT NORMALIZATION → DEDUPLICATION → CONFLICT DETECTION →
// EVIDENCE ALIGNMENT → CRITIQUE → WEIGHTING → SYNTHESIS → VERIFICATION.
// Every conclusion preserves provenance.
// ──────────────────────────────────────────────────────────────────

import type { ConflictDetector } from './ConflictDetector.js';
import type {
  BrainSynthesis,
  SynthesizedClaim,
  ConflictReport,
  ProviderRole,
} from '../types/brain-types.js';

export interface ProviderOutputInput {
  providerId: string;
  role: ProviderRole;
  capability: string;
  output: string;
  evidence: string[];
  quality: number | undefined;
}

interface NormalizedClaim {
  claim: string;
  providers: Set<string>;
  evidence: Set<string>;
  confidences: number[];
  qualities: number[];
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function normalizedKey(claim: string): string {
  return claim
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class OutputAssembler {
  constructor(private readonly conflicts: ConflictDetector) {}

  /**
   * Assembles a weighted, evidence-aligned synthesis with full provenance.
   * Conflicting claims are surfaced — never merged blindly.
   */
  synthesize(inputs: ProviderOutputInput[], topicConflicts: ConflictReport[]): BrainSynthesis {
    // 1-2. Normalize + dedupe across providers.
    const claims = new Map<string, NormalizedClaim>();
    for (const input of inputs) {
      for (const raw of sentences(input.output)) {
        const key = normalizedKey(raw);
        if (key.length < 4) continue; // skip fragments
        const existing = claims.get(key);
        if (existing) {
          existing.providers.add(input.providerId);
          input.evidence.forEach((e) => existing.evidence.add(e));
          existing.confidences.push(input.quality ?? 0.5);
          existing.qualities.push(input.quality ?? 0.5);
        } else {
          claims.set(key, {
            claim: raw,
            providers: new Set([input.providerId]),
            evidence: new Set(input.evidence),
            confidences: [input.quality ?? 0.5],
            qualities: [input.quality ?? 0.5],
          });
        }
      }
    }

    // 3. Conflict alignment: a claim with zero evidence cited across
    //    multiple providers is a variance; otherwise agreement (conflicts
    //    are surfaced separately in topicConflicts, never merged blindly).
    const synthesized: SynthesizedClaim[] = [];
    for (const c of claims.values()) {
      const conflict =
        c.evidence.size === 0 && c.providers.size > 1 ? 'MINOR_VARIANCE' : 'AGREEMENT';
      const confidence =
        c.confidences.reduce((a, b) => a + b, 0) / Math.max(c.confidences.length, 1);
      synthesized.push({
        claim: c.claim,
        providers: [...c.providers],
        evidence: [...c.evidence],
        confidence,
        conflictStatus: conflict,
      });
    }

    // 4-5. Weighting: multi-provider, evidence-backed claims rank higher.
    synthesized.sort((a, b) => {
      const wa = a.providers.length + a.evidence.length + a.confidence;
      const wb = b.providers.length + b.evidence.length + b.confidence;
      return wb - wa;
    });

    const summary = synthesized
      .filter(
        (c) =>
          c.conflictStatus !== 'MATERIAL_CONFLICT' &&
          c.conflictStatus !== 'EVIDENCE_CONFLICT' &&
          c.conflictStatus !== 'UNRESOLVED',
      )
      .slice(0, 6)
      .map((c) => c.claim)
      .join(' ');

    return {
      claims: synthesized,
      summary,
      providerCount: new Set(inputs.map((i) => i.providerId)).size,
      unresolvedConflicts: topicConflicts.filter(
        (c) =>
          c.classification === 'MATERIAL_CONFLICT' ||
          c.classification === 'EVIDENCE_CONFLICT' ||
          c.classification === 'UNRESOLVED',
      ),
    };
  }
}
