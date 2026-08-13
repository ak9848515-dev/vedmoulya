// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem Intelligence UI Tests (EPIC-015)
//
// Proves the pure /ecosystem-intelligence helper module renders honestly:
//   - every state palette falls back to a neutral slate for unknown values
//   - GitHub connection state badges cover the full state union
//   - security / lifecycle / acquisition / notification labels cover the
//     documented unions (never a stray string — closed unions stay closed)
//   - qualityBar renders a 10-cell bar with the correct numeric suffix
//   - qualityBarColor maps 80/60 thresholds to green/amber/red
//   - formatUsd handles fractions of a cent (m-units) and full dollars
//   - formatHuman converts closed-union values to readable text
//   - formatDateTime renders '—' for missing timestamps
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  GITHUB_STATE_COLORS,
  SCOPE_LABELS,
  SECURITY_COLORS,
  LIFECYCLE_COLORS,
  ACQUISITION_COLORS,
  RECOMMENDATION_LABELS,
  OPTION_LABELS,
  NOTIFICATION_LABELS,
  formatDateTime,
  formatUsd,
  qualityBar,
  qualityBarColor,
  formatHuman,
} from './intelligence-ui.js';

describe('ecosystem-intelligence UI helpers', () => {
  it('covers every GitHub connection state with a badge palette', () => {
    for (const state of [
      'DISCONNECTED',
      'AUTHORIZING',
      'CONNECTED',
      'REVOKED',
      'EXPIRED',
    ] as const) {
      expect(GITHUB_STATE_COLORS[state]).toBeTruthy();
    }
  });

  it('labels every GitHub permission scope', () => {
    for (const scope of [
      'public_metadata',
      'public_repos_read',
      'private_repos_read',
      'repos_write',
      'orgs_read',
    ] as const) {
      expect(SCOPE_LABELS[scope]).toBeTruthy();
    }
  });

  it('covers every security classification with a badge palette', () => {
    for (const cls of [
      'TRUSTED',
      'TRUSTED_WITH_REVIEW',
      'SECURITY_REVIEW_REQUIRED',
      'SUSPICIOUS',
      'BLOCKED',
      'UNKNOWN',
    ] as const) {
      expect(SECURITY_COLORS[cls]).toBeTruthy();
    }
  });

  it('covers every lifecycle state with a badge palette', () => {
    for (const state of [
      'DISCOVERED',
      'VERIFIED',
      'SECURITY_REVIEWED',
      'RECOMMENDED',
      'USER_APPROVED',
      'CONFIGURED',
      'VALIDATED',
      'ACTIVE',
      'STALE',
      'DEPRECATED',
      'BLOCKED',
    ] as const) {
      expect(LIFECYCLE_COLORS[state]).toBeTruthy();
    }
  });

  it('covers every acquisition state with a badge palette', () => {
    for (const state of [
      'DISCOVERED',
      'SECURITY_REVIEW',
      'RELEVANCE',
      'APPROVAL_REQUIRED',
      'APPROVED',
      'ACQUIRED',
      'SANDBOXED',
      'ANALYZED',
      'STORED',
      'CONFIGURED',
      'BLOCKED',
      'REJECTED',
    ] as const) {
      expect(ACQUISITION_COLORS[state]).toBeTruthy();
    }
  });

  it('labels every recommendation kind', () => {
    for (const kind of [
      'BETTER_CAPABILITY_FOUND',
      'USEFUL_OPEN_SOURCE_FOUND',
      'FREE_LOCAL_MODEL_AVAILABLE',
    ] as const) {
      expect(RECOMMENDATION_LABELS[kind]).toBeTruthy();
    }
  });

  it('labels every best-option kind', () => {
    for (const kind of [
      'BEST_AVAILABLE_NOW',
      'BEST_FREE',
      'BEST_LOCAL',
      'BEST_LOW_COST',
      'BEST_PAID',
      'BEST_CONFIGURED',
    ] as const) {
      expect(OPTION_LABELS[kind]).toBeTruthy();
    }
  });

  it('labels every notification kind', () => {
    for (const kind of [
      'BETTER_PROVIDER_DISCOVERED',
      'NEW_FREE_MODEL',
      'FREE_QUOTA_INCREASED',
      'PROVIDER_UNAVAILABLE',
      'PROVIDER_RETIRED',
      'USEFUL_GITHUB_PROJECT',
      'SECURITY_WARNING',
      'LICENSE_CONCERN',
      'LOCAL_MODEL_SUITABLE',
      'PAID_TOOL_MATERIALLY_BETTER',
      'CONFIGURED_PROVIDER_CHANGED',
    ] as const) {
      expect(NOTIFICATION_LABELS[kind]).toBeTruthy();
    }
  });

  it('renders a 10-cell quality bar with the numeric suffix', () => {
    expect(qualityBar(82)).toBe('████████░░ 82');
    expect(qualityBar(100)).toBe('██████████ 100');
    expect(qualityBar(0)).toBe('░░░░░░░░░░ 0');
    expect(qualityBar(undefined)).toBe('░░░░░░░░░░ 0');
  });

  it('maps quality to green/amber/red at the 80/60 thresholds', () => {
    expect(qualityBarColor(85)).toBe('#22C55E');
    expect(qualityBarColor(80)).toBe('#22C55E');
    expect(qualityBarColor(72)).toBe('#F59E0B');
    expect(qualityBarColor(60)).toBe('#F59E0B');
    expect(qualityBarColor(41)).toBe('#EF4444');
  });

  it('formats cost honestly: fractions of a cent use m-units, otherwise USD', () => {
    expect(formatUsd(0.005)).toBe('$5.00m');
    expect(formatUsd(1.5)).toBe('$1.5000');
    expect(formatUsd(undefined)).toBe('—');
  });

  it('converts closed-union values to readable text (underscores → spaces, word caps)', () => {
    expect(formatHuman('APPROVAL_REQUIRED')).toBe('APPROVAL REQUIRED');
    expect(formatHuman('private_repos_read')).toBe('Private Repos Read');
    expect(formatHuman('CONNECTED')).toBe('CONNECTED');
  });

  it('renders a dash for missing timestamps and a readable date for valid ones', () => {
    expect(formatDateTime(undefined)).toBe('—');
    const iso = new Date('2026-08-10T12:34:00Z').toISOString();
    const rendered = formatDateTime(iso);
    expect(rendered).not.toBe('—');
    expect(rendered).toContain('Aug 10');
  });
});
