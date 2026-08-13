// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · CriticStrategy tests (EPIC-016 §16)
// EXECUTE → CRITIQUE → REFINE → VERIFY. Deterministic decision matrix.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { CriticStrategy } from '../domain/CriticStrategy.js';

describe('CriticStrategy', () => {
  it('simple fast task → minimal verification (no critic)', () => {
    const decision = new CriticStrategy().decide({
      mode: 'FAST',
      qualityTarget: 'MEDIUM',
      capabilityCount: 1,
      privacyRequirement: 'STANDARD',
      evidenceRequirement: 'NONE',
    });
    expect(decision.criticCount).toBe(0);
    expect(decision.allowRefine).toBe(false);
  });

  it('strong evidence requirement → independent critic pair + bounded refine', () => {
    const decision = new CriticStrategy().decide({
      mode: 'BALANCED',
      qualityTarget: 'MEDIUM',
      capabilityCount: 2,
      privacyRequirement: 'STANDARD',
      evidenceRequirement: 'STRONG_REQUIRED',
    });
    expect(decision.criticCount).toBe(2);
    expect(decision.maxRefineRounds).toBe(2);
  });

  it('DEEP_RESEARCH → critic pair', () => {
    const decision = new CriticStrategy().decide({
      mode: 'DEEP_RESEARCH',
      qualityTarget: 'HIGH',
      capabilityCount: 5,
      privacyRequirement: 'STANDARD',
      evidenceRequirement: 'REQUIRED',
    });
    expect(decision.criticCount).toBe(2);
  });

  it('QUALITY mode → critic pair with bounded refinement', () => {
    const decision = new CriticStrategy().decide({
      mode: 'QUALITY',
      qualityTarget: 'HIGH',
      capabilityCount: 3,
      privacyRequirement: 'STANDARD',
      evidenceRequirement: 'OPTIONAL',
    });
    expect(decision.criticCount).toBe(2);
    expect(decision.allowRefine).toBe(true);
  });

  it('high quality + complex → single critic with one refine round', () => {
    const decision = new CriticStrategy().decide({
      mode: 'BALANCED',
      qualityTarget: 'HIGH',
      capabilityCount: 4,
      privacyRequirement: 'STANDARD',
      evidenceRequirement: 'OPTIONAL',
    });
    expect(decision.criticCount).toBe(1);
    expect(decision.maxRefineRounds).toBe(1);
  });

  it('standard task → single lightweight check, no refinement', () => {
    const decision = new CriticStrategy().decide({
      mode: 'BALANCED',
      qualityTarget: 'MEDIUM',
      capabilityCount: 3,
      privacyRequirement: 'STANDARD',
      evidenceRequirement: 'OPTIONAL',
    });
    expect(decision.criticCount).toBe(1);
    expect(decision.allowRefine).toBe(false);
  });
});
