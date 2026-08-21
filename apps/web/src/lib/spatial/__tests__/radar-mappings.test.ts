// SPRINT-043D — Radar/Digital-Twin presentation-mapping tests.
// Tests the PURE mapping layer (no DOM). Honesty invariants: no invented
// state; UNKNOWN is a first-class state; missing != 0-score; STOP attention.
import { describe, it, expect } from 'vitest';
import {
  categorizeRadarEntry,
  radarAngleDeg,
  radarSizePx,
  radarOpacity,
  radarEvidenceLabel,
  radarSortEntries,
  radarColor,
  twinStatus,
  twinValueLabel,
  type RadarSpatialEntry,
  type TwinDimension,
} from '../radar-mappings.js';

function entry(partial: Partial<RadarSpatialEntry> & { problemId: string }): RadarSpatialEntry {
  return {
    problemStatement: 'test',
    opportunityScore: 0.5,
    evidenceCount: 0,
    hasVerifiedPayment: false,
    revenueState: 'PROBLEM',
    nextAction: 'TALK_TO_CUSTOMERS',
    ...partial,
  };
}

describe('radar categorize (honesty)', () => {
  it('STOP is driven only by authoritative stop fields', () => {
    expect(categorizeRadarEntry(entry({ problemId: 'a', nextAction: 'STOP' }))).toBe('STOP');
    expect(categorizeRadarEntry(entry({ problemId: 'b', stopReason: 'evidence says no' }))).toBe(
      'STOP',
    );
  });

  it('VERIFIED requires a recorded verified payment', () => {
    expect(categorizeRadarEntry(entry({ problemId: 'c', hasVerifiedPayment: true }))).toBe(
      'VERIFIED',
    );
  });

  it('OBSERVED requires at least one evidence record', () => {
    expect(categorizeRadarEntry(entry({ problemId: 'd', evidenceCount: 2 }))).toBe('OBSERVED');
  });

  it('no evidence stays UNKNOWN (never a low score)', () => {
    expect(
      categorizeRadarEntry(entry({ problemId: 'e', evidenceCount: 0, opportunityScore: 0.1 })),
    ).toBe('UNKNOWN');
  });
});

describe('radar layout mapping (deterministic, bounded)', () => {
  it('angle is stable and within 0..360', () => {
    const a1 = radarAngleDeg('prob-1');
    const a2 = radarAngleDeg('prob-1');
    expect(a1).toBe(a2);
    expect(a1).toBeGreaterThanOrEqual(0);
    expect(a1).toBeLessThan(360);
  });

  it('size maps linear 0..1 -> 10..26 px', () => {
    expect(radarSizePx(entry({ problemId: 'f', opportunityScore: 0 }))).toBe(10);
    expect(radarSizePx(entry({ problemId: 'g', opportunityScore: 1 }))).toBe(26);
    expect(radarSizePx(entry({ problemId: 'h', opportunityScore: undefined }))).toBe(10);
  });

  it('opacity encodes evidence presence only', () => {
    expect(radarOpacity(entry({ problemId: 'i', evidenceCount: 0 }))).toBe(0.5);
    expect(radarOpacity(entry({ problemId: 'j', evidenceCount: 1 }))).toBe(1);
  });

  it('evidence label never overstates', () => {
    expect(radarEvidenceLabel(entry({ problemId: 'k', hasVerifiedPayment: true }))).toBe(
      'verified payment',
    );
    expect(radarEvidenceLabel(entry({ problemId: 'l', evidenceCount: 3 }))).toBe(
      '3 evidence records',
    );
    expect(radarEvidenceLabel(entry({ problemId: 'm', evidenceCount: 1 }))).toBe(
      '1 evidence record',
    );
    expect(radarEvidenceLabel(entry({ problemId: 'n', evidenceCount: 0 }))).toBe('no evidence yet');
  });
});

describe('radar ordering + empty', () => {
  it('STOP -> VERIFIED -> OBSERVED -> UNKNOWN', () => {
    const e1 = entry({ problemId: 'o', evidenceCount: 1 }); // OBSERVED
    const e2 = entry({ problemId: 'p', nextAction: 'STOP' }); // STOP
    const e3 = entry({ problemId: 'q', hasVerifiedPayment: true }); // VERIFIED
    const e4 = entry({ problemId: 'r' }); // UNKNOWN
    expect(radarSortEntries([e4, e1, e3, e2]).map((x) => x.problemId)).toEqual([
      'p',
      'q',
      'o',
      'r',
    ]);
  });

  it('colors carry a textual label (never color alone)', () => {
    for (const c of ['STOP', 'VERIFIED', 'OBSERVED', 'UNKNOWN'] as const) {
      const e = entry({
        problemId: `${c}`,
        evidenceCount: c === 'UNKNOWN' ? 0 : 1,
        hasVerifiedPayment: c === 'VERIFIED',
        nextAction: c === 'STOP' ? 'STOP' : 'TALK_TO_CUSTOMERS',
      });
      const color = radarColor(e);
      expect(color.label.length).toBeGreaterThan(0);
    }
  });
});

describe('digital twin honesty', () => {
  const dim = (value: number | null, note?: string): TwinDimension => ({
    key: 'm',
    label: 'Mission',
    value,
    note,
  });

  it('all-unknown -> FORMING (not a 0-score twin)', () => {
    expect(twinStatus([dim(null), dim(null)])).toBe('FORMING');
  });

  it('all-known -> KNOWN', () => {
    expect(twinStatus([dim(3), dim(5)])).toBe('KNOWN');
  });

  it('mixed -> PARTIAL', () => {
    expect(twinStatus([dim(3), dim(null)])).toBe('PARTIAL');
  });

  it('UNKNOWN is rendered as not-yet-known, never 0', () => {
    expect(twinValueLabel(dim(null))).toBe('not yet known');
    expect(twinValueLabel(dim(0))).toBe('no items yet');
    expect(twinValueLabel(dim(4))).toBe('4');
  });
});
