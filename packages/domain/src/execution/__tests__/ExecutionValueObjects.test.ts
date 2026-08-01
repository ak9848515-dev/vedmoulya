import { describe, it, expect } from 'vitest';
import { ExecutionMetrics } from '../value-objects/ExecutionMetrics.js';
import { ExecutionPolicy } from '../value-objects/ExecutionPolicy.js';
import { ExecutionStrategy } from '../value-objects/ExecutionStrategy.js';
import { ExecutionHistory } from '../value-objects/ExecutionHistory.js';
import type { HistoricalEntry } from '../value-objects/ExecutionHistory.js';
import { ExecutionSchedule } from '../value-objects/ExecutionSchedule.js';
import { ExecutionContext } from '../value-objects/ExecutionContext.js';
import { ExecutionDependency } from '../value-objects/ExecutionDependency.js';
import { ExecutionResult } from '../value-objects/ExecutionResult.js';
import { ExecutionProgress } from '../value-objects/ExecutionProgress.js';
import { ExecutionTimeline } from '../value-objects/ExecutionTimeline.js';

describe('ExecutionMetrics', () => {
  it('creates empty metrics with defaults', () => {
    const m = ExecutionMetrics.empty();
    expect(m.completionRate).toBe(0);
    expect(m.onTimeRate).toBe(0);
    expect(m.estimationAccuracy).toBe(0);
    expect(m.momentumScore).toBe(0);
    expect(m.consistencyScore).toBe(0);
    expect(m.streakLength).toBe(0);
    expect(m.qualityScore).toBe(1);
    expect(m.adaptationFrequency).toBe(0);
    expect(m.recoveryTime).toBe(0);
  });

  it('creates metrics with explicit values', () => {
    const m = new ExecutionMetrics({
      completionRate: 85,
      onTimeRate: 90,
      estimationAccuracy: 70,
      momentumScore: 7,
      consistencyScore: 8,
      streakLength: 12,
      qualityScore: 4,
      adaptationFrequency: 3,
      recoveryTime: 2,
    });
    expect(m.completionRate).toBe(85);
    expect(m.onTimeRate).toBe(90);
    expect(m.momentumScore).toBe(7);
    expect(m.streakLength).toBe(12);
    expect(m.qualityScore).toBe(4);
    expect(m.adaptationFrequency).toBe(3);
    expect(m.recoveryTime).toBe(2);
  });

  it('evaluates momentum and quality flags', () => {
    expect(new ExecutionMetrics({ momentumScore: 6 }).isGoodMomentum).toBe(true);
    expect(new ExecutionMetrics({ momentumScore: 5 }).isGoodMomentum).toBe(false);
    expect(new ExecutionMetrics({ momentumScore: 2 }).isLowMomentum).toBe(true);
    expect(new ExecutionMetrics({ momentumScore: 3 }).isLowMomentum).toBe(false);
    expect(new ExecutionMetrics({ qualityScore: 4 }).isHighQuality).toBe(true);
    expect(new ExecutionMetrics({ qualityScore: 3 }).isHighQuality).toBe(false);
  });

  it('evaluates reliability flag', () => {
    expect(new ExecutionMetrics({ completionRate: 70, onTimeRate: 70 }).isReliable).toBe(true);
    expect(new ExecutionMetrics({ completionRate: 69, onTimeRate: 90 }).isReliable).toBe(false);
    expect(new ExecutionMetrics({ completionRate: 80, onTimeRate: 69 }).isReliable).toBe(false);
  });

  it('stringifies and compares', () => {
    const a = new ExecutionMetrics({ completionRate: 80, momentumScore: 6 });
    const b = new ExecutionMetrics({ completionRate: 80, momentumScore: 6 });
    const c = new ExecutionMetrics({ completionRate: 80, momentumScore: 7 });
    expect(a.toString()).toContain('Completion: 80%');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

describe('ExecutionPolicy', () => {
  it('creates a custom policy', () => {
    const p = new ExecutionPolicy({
      id: 'p1',
      name: 'Focus Hours',
      description: 'Protect focus time',
      domain: 'scheduling',
      rules: [
        { condition: 'meetings > 3', action: 'block_afternoon', severity: 'hard' },
        { condition: 'focus < 2h', action: 'reschedule', severity: 'soft' },
      ],
      isActive: false,
    });
    expect(p.id).toBe('p1');
    expect(p.name).toBe('Focus Hours');
    expect(p.domain).toBe('scheduling');
    expect(p.rules).toHaveLength(2);
    expect(p.isActive).toBe(false);
  });

  it('defaults to active when not specified', () => {
    const p = new ExecutionPolicy({
      id: 'p2',
      name: 'Default',
      description: 'D',
      domain: 'general',
      rules: [],
    });
    expect(p.isActive).toBe(true);
  });

  it('provides the noBurnout policy', () => {
    const p = ExecutionPolicy.noBurnout();
    expect(p.id).toBe('policy_no_burnout');
    expect(p.domain).toBe('capacity');
    expect(p.rules.length).toBeGreaterThan(0);
    expect(p.rules[0]!.severity).toBe('hard');
  });

  it('provides the sustainableGrowth policy', () => {
    const p = ExecutionPolicy.sustainableGrowth();
    expect(p.id).toBe('policy_sustainable_growth');
    expect(p.name).toBe('Sustainable Growth');
    expect(p.domain).toBe('general');
    expect(p.rules.some((r) => r.severity === 'advisory')).toBe(true);
  });

  it('stringifies and compares by id', () => {
    const a = ExecutionPolicy.noBurnout();
    const b = ExecutionPolicy.noBurnout();
    expect(a.toString()).toContain('No Burnout');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(ExecutionPolicy.sustainableGrowth())).toBe(false);
  });
});

describe('ExecutionStrategy', () => {
  it('creates a custom strategy with alternatives', () => {
    const s = new ExecutionStrategy({
      type: 'agile',
      description: 'Iterative delivery',
      alternatives: [
        { label: 'Sprint', description: 'Two-week cycles', risk: 'low', estimatedEffort: '4w' },
      ],
      selectedAlternative: 'Sprint',
      rationale: 'Best fit for changing scope',
    });
    expect(s.type).toBe('agile');
    expect(s.description).toBe('Iterative delivery');
    expect(s.alternatives).toHaveLength(1);
    expect(s.selectedAlternative).toBe('Sprint');
    expect(s.rationale).toBe('Best fit for changing scope');
  });

  it('creates linear and parallel strategies', () => {
    const linear = ExecutionStrategy.linear('Do in order', 'Simple');
    expect(linear.type).toBe('linear');
    expect(linear.alternatives).toHaveLength(0);
    expect(linear.selectedAlternative).toBeUndefined();
    const parallel = ExecutionStrategy.parallel('Do at once', 'Fast');
    expect(parallel.type).toBe('parallel');
    expect(parallel.description).toBe('Do at once');
  });

  it('stringifies and compares', () => {
    const a = ExecutionStrategy.linear('X', 'r');
    const b = ExecutionStrategy.linear('X', 'different rationale');
    const c = ExecutionStrategy.linear('Y', 'r');
    expect(a.toString()).toBe('[linear] X');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

describe('ExecutionHistory', () => {
  const entry = (overrides: Partial<HistoricalEntry> = {}): HistoricalEntry => ({
    planId: 'p1',
    planTitle: 'Plan',
    taskId: 't1',
    taskLabel: 'Task',
    result: 'success',
    actualDuration: 30,
    completedAt: new Date('2026-07-01T10:00:00Z'),
    ...overrides,
  });

  it('creates empty history', () => {
    const h = ExecutionHistory.empty('p1');
    expect(h.planId).toBe('p1');
    expect(h.totalEntries).toBe(0);
    expect(h.successRate).toBe(0);
    expect(h.averageDuration).toBe(0);
    expect(h.averageQuality).toBe(0);
  });

  it('sorts entries by completedAt descending', () => {
    const h = new ExecutionHistory('p1', [
      entry({ completedAt: new Date('2026-07-01T10:00:00Z'), taskId: 'older' }),
      entry({ completedAt: new Date('2026-07-03T10:00:00Z'), taskId: 'newer' }),
    ]);
    expect(h.entries[0]!.taskId).toBe('newer');
  });

  it('adds entries immutably', () => {
    const h = ExecutionHistory.empty('p1');
    const h2 = h.addEntry(entry());
    expect(h.totalEntries).toBe(0);
    expect(h2.totalEntries).toBe(1);
  });

  it('computes success rate, average duration, and quality', () => {
    const h = new ExecutionHistory('p1', [
      entry({ result: 'success', actualDuration: 30, quality: 4 }),
      entry({ result: 'failed', actualDuration: 60, quality: 2 }),
      entry({ result: 'success', actualDuration: 90 }),
    ]);
    expect(h.successfulEntries).toHaveLength(2);
    expect(h.failedEntries).toHaveLength(1);
    expect(h.successRate).toBe(67);
    expect(h.averageDuration).toBe(60);
    // only entries with quality defined: (4+2)/2 = 3
    expect(h.averageQuality).toBe(3);
  });

  it('stringifies history', () => {
    const h = new ExecutionHistory('p1', [entry()]);
    expect(h.toString()).toContain('1 entries');
    expect(h.toString()).toContain('100%');
  });
});

describe('ExecutionSchedule', () => {
  const start = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
  const end = new Date(Date.now() - 30 * 60 * 1000); // 30m ago

  it('creates a schedule with getters', () => {
    const s = new ExecutionSchedule(start, end, 45, 'morning');
    expect(s.scheduledStart).toBe(start);
    expect(s.scheduledEnd).toBe(end);
    expect(s.estimatedDuration).toBe(45);
    expect(s.timeBlock).toBe('morning');
  });

  it('reports overdue for past end', () => {
    expect(new ExecutionSchedule(start, end, 45).isOverdue).toBe(true);
    expect(
      new ExecutionSchedule(new Date(Date.now() + 60_000), new Date(Date.now() + 3_600_000), 45)
        .isOverdue,
    ).toBe(false);
  });

  it('reports starting soon for near-future start', () => {
    const soonStart = new Date(Date.now() + 5 * 60 * 1000);
    const soonEnd = new Date(Date.now() + 60 * 60 * 1000);
    expect(new ExecutionSchedule(soonStart, soonEnd, 45).isStartingSoon).toBe(true);
    expect(new ExecutionSchedule(start, end, 45).isStartingSoon).toBe(false);
  });

  it('reschedules and preserves duration and block', () => {
    const s = new ExecutionSchedule(start, end, 45, 'evening');
    const next = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const r = s.reschedule(next, new Date(next.getTime() + 3_600_000));
    expect(r.scheduledStart).toBe(next);
    expect(r.estimatedDuration).toBe(45);
    expect(r.timeBlock).toBe('evening');
  });

  it('stringifies and compares', () => {
    const a = new ExecutionSchedule(start, end, 45);
    const b = new ExecutionSchedule(start, end, 90);
    expect(a.toString()).toContain('min');
    expect(a.equals(b)).toBe(true);
  });
});

describe('ExecutionContext', () => {
  it('creates empty context with defaults', () => {
    const c = ExecutionContext.empty();
    expect(c.energyLevel).toBeUndefined();
    expect(c.resources).toHaveLength(0);
    expect(c.interruptions).toHaveLength(0);
    // default energy 5: not high, not low
    expect(c.hasHighEnergy).toBe(false);
    expect(c.hasLowEnergy).toBe(false);
    expect(c.hasGoodFocus).toBe(false);
    expect(c.hasTimePressure).toBe(false);
  });

  it('creates context with values and evaluates flags', () => {
    const c = new ExecutionContext({
      energyLevel: 8,
      timeAvailable: 20,
      location: 'office',
      resources: ['laptop'],
      interruptions: ['slack'],
      focusScore: 7,
    });
    expect(c.energyLevel).toBe(8);
    expect(c.timeAvailable).toBe(20);
    expect(c.location).toBe('office');
    expect(c.resources).toEqual(['laptop']);
    expect(c.interruptions).toEqual(['slack']);
    expect(c.focusScore).toBe(7);
    expect(c.hasHighEnergy).toBe(true);
    expect(c.hasLowEnergy).toBe(false);
    expect(c.hasGoodFocus).toBe(true);
    expect(c.hasTimePressure).toBe(true);
  });

  it('stringifies context parts', () => {
    const c = new ExecutionContext({ energyLevel: 7, timeAvailable: 45, location: 'home' });
    const s = c.toString();
    expect(s).toContain('energy:7/10');
    expect(s).toContain('time:45min');
    expect(s).toContain('at:home');
    expect(ExecutionContext.empty().toString()).toBe('');
  });
});

describe('ExecutionDependency', () => {
  it('creates a dependency with explicit params', () => {
    const d = new ExecutionDependency(
      'dep_1',
      't1',
      't2',
      'finish_to_start',
      't1 blocks t2',
      false,
    );
    expect(d.id).toBe('dep_1');
    expect(d.sourceId).toBe('t1');
    expect(d.targetId).toBe('t2');
    expect(d.type).toBe('finish_to_start');
    expect(d.description).toBe('t1 blocks t2');
    expect(d.isHard).toBe(false);
  });

  it('defaults isHard to true', () => {
    const d = new ExecutionDependency('dep_1', 't1', 't2', 'finish_to_start', 'blocks');
    expect(d.isHard).toBe(true);
  });

  it('creates finish-to-start and start-to-start dependencies', () => {
    const fs = ExecutionDependency.finishToStart('a', 'b', 'a before b');
    expect(fs.type).toBe('finish_to_start');
    expect(fs.id).toMatch(/^dep_/);
    expect(fs.isHard).toBe(true);
    const ss = ExecutionDependency.startToStart('a', 'b', 'same time', false);
    expect(ss.type).toBe('start_to_start');
    expect(ss.isHard).toBe(false);
  });

  it('stringifies and compares', () => {
    const a = new ExecutionDependency('dep_1', 'a', 'b', 'finish_to_start', 'd');
    const b = new ExecutionDependency('dep_1', 'x', 'y', 'finish_to_start', 'd');
    const c = new ExecutionDependency('dep_2', 'a', 'b', 'finish_to_start', 'd');
    expect(a.toString()).toContain('(hard)');
    expect(
      new ExecutionDependency('dep_3', 'a', 'b', 'finish_to_start', 'd', false).toString(),
    ).toContain('(soft)');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

describe('ExecutionResult', () => {
  it('creates a success result with clamped quality', () => {
    const r = ExecutionResult.success('Done', 25, 9);
    expect(r.value).toBe('success');
    expect(r.description).toBe('Done');
    expect(r.actualDuration).toBe(25);
    expect(r.quality).toBe(5); // clamped to 5
    expect(r.isPositive).toBe(true);
    expect(r.isNegative).toBe(false);
  });

  it('creates partial, failed, and skipped results', () => {
    const p = ExecutionResult.partial('Half done');
    expect(p.value).toBe('partial');
    expect(p.isPositive).toBe(true);
    const f = ExecutionResult.failed('Broke', ['issue 1']);
    expect(f.value).toBe('failed');
    expect(f.isNegative).toBe(true);
    expect(f.notes).toEqual(['issue 1']);
    const s = ExecutionResult.skipped('No time');
    expect(s.value).toBe('skipped');
    expect(s.description).toBe('No time');
  });

  it('records timestamps and freezes notes', () => {
    const r = new ExecutionResult({
      value: 'success',
      description: 'D',
      notes: ['a', 'b'],
      recordedAt: new Date('2026-07-01T00:00:00Z'),
    });
    expect(r.recordedAt.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(r.notes).toEqual(['a', 'b']);
    expect(() => {
      (r.notes as readonly string[]).push('c');
    }).toThrow();
  });

  it('stringifies and compares', () => {
    const a = ExecutionResult.success('Same');
    const b = ExecutionResult.success('Same');
    const c = ExecutionResult.success('Different');
    expect(a.toString()).toBe('success: Same');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

describe('ExecutionProgress', () => {
  it('creates empty and complete progress', () => {
    expect(ExecutionProgress.empty().completed).toBe(0);
    expect(ExecutionProgress.empty().percentage).toBe(0);
    expect(ExecutionProgress.complete().isComplete).toBe(true);
    expect(ExecutionProgress.complete().percentage).toBe(100);
  });

  it('creates from percentage', () => {
    const p = ExecutionProgress.fromPercentage(50, 10);
    expect(p.completed).toBe(5);
    expect(p.total).toBe(10);
    expect(p.percentage).toBe(50);
  });

  it('clamps completed and total', () => {
    const p = new ExecutionProgress(-3, 0);
    expect(p.completed).toBe(0);
    expect(p.total).toBe(1);
  });

  it('evaluates flags', () => {
    expect(new ExecutionProgress(1, 2).isStarted).toBe(true);
    expect(new ExecutionProgress(0, 2).isStarted).toBe(false);
    // percentage 20 < 50 and total (10) > completed+3 (5) → at risk
    expect(new ExecutionProgress(2, 10).isAtRisk).toBe(true);
    // percentage 60 → not at risk
    expect(new ExecutionProgress(6, 10).isAtRisk).toBe(false);
  });

  it('advances progress', () => {
    const p = new ExecutionProgress(1, 4).advance();
    expect(p.completed).toBe(2);
    const p2 = new ExecutionProgress(1, 4).advance(3);
    expect(p2.completed).toBe(4);
  });

  it('stringifies and compares', () => {
    const a = new ExecutionProgress(1, 2);
    const b = new ExecutionProgress(1, 2);
    const c = new ExecutionProgress(2, 2);
    expect(a.toString()).toBe('1/2 (50%)');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

describe('ExecutionTimeline', () => {
  it('creates an empty timeline', () => {
    const t = ExecutionTimeline.empty();
    expect(t.entryCount).toBe(0);
    expect(t.lastEntry).toBeUndefined();
    expect(t.toString()).toContain('none');
  });

  it('adds entries sorted by timestamp', () => {
    const t = new ExecutionTimeline([
      {
        timestamp: new Date('2026-07-01T10:00:00Z'),
        eventType: 'later',
        description: 'D',
        entityId: 'e1',
        entityType: 'plan',
      },
      {
        timestamp: new Date('2026-07-01T09:00:00Z'),
        eventType: 'earlier',
        description: 'D',
        entityId: 'e1',
        entityType: 'plan',
      },
    ]);
    expect(t.entries[0]!.eventType).toBe('earlier');
    expect(t.entryCount).toBe(2);
    expect(t.lastEntry!.eventType).toBe('later');
  });

  it('adds entries immutably and filters since date', () => {
    const t = ExecutionTimeline.empty();
    const t2 = t.addEntry('plan.started', 'Started', 'p1', 'plan');
    expect(t.entryCount).toBe(0);
    expect(t2.entryCount).toBe(1);
    expect(t2.entriesSince(new Date(Date.now() - 1000))).toHaveLength(1);
    expect(t2.entriesSince(new Date(Date.now() + 1000))).toHaveLength(0);
  });

  it('stringifies timeline', () => {
    const t = new ExecutionTimeline([
      {
        timestamp: new Date(),
        eventType: 'plan.completed',
        description: 'D',
        entityId: 'e1',
        entityType: 'plan',
      },
    ]);
    expect(t.toString()).toContain('plan.completed');
  });
});
