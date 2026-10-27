// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Life module envelope-wiring guards (2026-10-26 audit repair)
//
// The gateway returns `{ success, data }` envelopes. Three Life screens read
// the envelope where they meant the snapshot, so genuine backend data never
// reached the UI:
//   • /career and /learning passed the envelope into their journey derivers,
//     which always resolved to "not started"
//   • /business read `goals`, `projects`, `kpis`, `risks`, `profile` and
//     `health` straight off the envelope, so every list rendered empty and the
//     header always fell back to the placeholder title
//
// The same screens also carried fabricated status badges ("Skills Analyzed",
// "5-day streak", "All Systems Healthy") that were not backed by any data.
//
// These guards read the real page sources so a future edit cannot quietly
// reintroduce either defect.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function readPage(relative: string): string {
  return readFileSync(fileURLToPath(new URL(`../${relative}`, import.meta.url)), 'utf8');
}

describe('career page', () => {
  const source = readPage('career/page.tsx');

  it('feeds the journey deriver the snapshot, not the envelope', () => {
    expect(source).toContain('careerJourneySteps(data?.data)');
    expect(source).not.toContain('careerJourneySteps(data)');
  });

  it('does not claim a fabricated analysis state', () => {
    expect(source).not.toContain('Skills Analyzed');
  });
});

describe('learning page', () => {
  const source = readPage('learning/page.tsx');

  it('feeds the journey deriver the snapshot, not the envelope', () => {
    expect(source).toContain('learningJourneySteps(data?.data)');
    expect(source).not.toContain('learningJourneySteps(data)');
  });

  it('does not invent a streak', () => {
    expect(source).not.toMatch(/\d+-day streak/);
  });
});

describe('business page', () => {
  const source = readPage('business/page.tsx');

  it('derives the snapshot from data.data', () => {
    expect(source).toContain('data?.data');
    expect(source).not.toContain('const raw = (data ?? {})');
  });

  it('feeds the journey deriver snapshot data', () => {
    expect(source).toContain('businessJourneySteps(raw)');
    expect(source).not.toContain('businessJourneySteps(data)');
  });

  it('only claims business health when the snapshot reports it', () => {
    expect(source).not.toContain('All Systems Healthy');
    expect(source).toContain('healthOverall');
  });
});
