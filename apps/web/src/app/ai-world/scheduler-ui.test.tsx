// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI World · Discovery Activity UI helper tests (EPIC-018)
// Pure formatting helpers — deterministic, no rendering required.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  FREQUENCY_OPTIONS,
  changeLabel,
  frequencyLabel,
  nextDiscoveryLabel,
  relativeTime,
  runtimeColor,
  runtimeDetailLabel,
  runtimeStateLabel,
  statusColor,
  statusLabel,
} from './scheduler-ui.js';
import type { SchedulerRuntimeStatusViewDTO } from '../../lib/api-client.js';

describe('scheduler-ui helpers (EPIC-018)', () => {
  it('frequencyLabel renders plain cadence words for every frequency', () => {
    expect(frequencyLabel('EVERY_6_HOURS')).toBe('Every 6 hours');
    expect(frequencyLabel('DAILY')).toBe('Daily');
    expect(frequencyLabel('WEEKLY')).toBe('Weekly');
  });

  it('FREQUENCY_OPTIONS covers exactly the three schedule frequencies', () => {
    expect(FREQUENCY_OPTIONS.map((o) => o.value)).toEqual(['EVERY_6_HOURS', 'DAILY', 'WEEKLY']);
    expect(FREQUENCY_OPTIONS[0]?.label).toBe('Every 6 hours');
  });

  it('changeLabel maps change kinds to plain phrases', () => {
    expect(changeLabel('CRITICAL_CHANGE')).toBe('Critical change');
    expect(changeLabel('NEW')).toBe('New items');
    expect(changeLabel('UPDATED')).toBe('Updates');
    expect(changeLabel('REMOVED')).toBe('Removals');
    expect(changeLabel('NO_CHANGE')).toBe('No changes');
    expect(changeLabel(undefined)).toBe('No changes');
  });

  it('statusLabel + statusColor cover every job status', () => {
    expect(statusLabel('running')).toBe('Running');
    expect(statusLabel('due')).toBe('Due now');
    expect(statusLabel('scheduled')).toBe('Scheduled');
    expect(statusLabel('disabled')).toBe('Off');
    for (const s of ['running', 'due', 'scheduled', 'disabled'] as const) {
      expect(statusColor(s)).toContain('text-');
    }
  });

  it('relativeTime renders honest human times', () => {
    const now = new Date('2026-08-11T12:00:00Z');
    expect(relativeTime(undefined, now)).toBe('—');
    expect(relativeTime('2026-08-11T11:59:30Z', now)).toBe('just now');
    expect(relativeTime('2026-08-11T10:00:00Z', now)).toBe('2h ago');
    expect(relativeTime('2026-08-09T12:00:00Z', now)).toBe('2d ago');
  });

  it('nextDiscoveryLabel renders the epic’s "Today · time" line', () => {
    const now = new Date('2026-08-11T12:00:00Z');
    expect(nextDiscoveryLabel(undefined, now)).toBe('Not scheduled');
    const sameDay = nextDiscoveryLabel('2026-08-11T18:00:00Z', now);
    expect(sameDay.startsWith('Today ·')).toBe(true);
    expect(sameDay).toContain('PM');
    expect(nextDiscoveryLabel('2026-08-12T09:00:00Z', now).startsWith('Tomorrow ·')).toBe(true);
  });

  it('runtime helpers are honest — “active” only when the driver really is', () => {
    const active: SchedulerRuntimeStatusViewDTO = {
      active: true,
      reason: 'enabled',
      intervalMs: 600_000,
      maxUsersPerTick: 200,
      refreshIntelligenceEnabled: true,
    };
    const disabled: SchedulerRuntimeStatusViewDTO = {
      active: false,
      reason: 'disabled',
      maxUsersPerTick: 0,
      refreshIntelligenceEnabled: false,
    };

    expect(runtimeStateLabel(active)).toBe('Automatic discovery active');
    expect(runtimeStateLabel(disabled)).toBe('Automatic discovery off (operator)');
    expect(runtimeStateLabel(undefined)).toBe('Automatic discovery — checking…');

    // Cadence detail only when the driver is genuinely active; the EPIC-021
    // opportunity refresh is only claimed when the driver reports it enabled.
    expect(runtimeDetailLabel(active)).toBe('every 10 min · opportunity refresh on');
    expect(runtimeDetailLabel({ ...active, refreshIntelligenceEnabled: false })).toBe(
      'every 10 min',
    );
    expect(runtimeDetailLabel(disabled)).toBe('Discovery runs when you press Run');
    expect(runtimeDetailLabel(undefined)).toBe('Discovery runs when you press Run');

    expect(runtimeColor(active)).toContain('emerald');
    expect(runtimeColor(disabled)).toContain('amber');
    expect(runtimeColor(undefined)).toContain('amber');
  });

  it('runtime helpers degrade honestly when the last tick could not reach the identity directory', () => {
    const degraded: SchedulerRuntimeStatusViewDTO = {
      active: true,
      reason: 'enabled',
      intervalMs: 600_000,
      maxUsersPerTick: 200,
      refreshIntelligenceEnabled: true,
      lastTick: {
        startedAt: 1_700_000_000_000,
        finishedAt: 1_700_000_001_000,
        usersProcessed: 0,
        runsStarted: 0,
        runsSkipped: 0,
        opportunitiesFound: 0,
        notificationsEmitted: 0,
        errors: 0,
        errorSample: [],
        truncated: false,
        userDirectoryError: 'Failed query: select from users',
      },
    };

    // The driver is active but its last pass failed — never a false "healthy".
    expect(runtimeStateLabel(degraded)).toBe(
      'Automatic discovery active — waiting for identity directory',
    );
    expect(runtimeColor(degraded)).toContain('amber');
    // Cadence detail still honest about the interval (and the EPIC-021
    // opportunity refresh, which is enabled on this fixture).
    expect(runtimeDetailLabel(degraded)).toBe('every 10 min · opportunity refresh on');
  });
});
