import { describe, it, expect } from 'vitest';
import { AutomationDiscovery } from '../domain/AutomationDiscovery.js';
import { ActionClassPolicy } from '../domain/ActionClassPolicy.js';
import type { BrainTaskLike } from '../contracts/proactive-shared.js';

function task(id: string, objective: string, status = 'COMPLETED'): BrainTaskLike {
  return {
    id,
    userId: 'u1',
    objective,
    status,
    stage: 'RESULT',
    createdAt: '2026-08-01T00:00:00.000Z',
  };
}

const boundary = {
  assess: (_candidates: unknown[], irreversible: boolean) => ({
    automation: irreversible ? 'HUMAN_APPROVAL' : 'FULLY_AUTOMATED',
    reasons: ['advisory'],
  }),
};

function discover(tasks: BrainTaskLike[]) {
  return new AutomationDiscovery().discover({
    tasks,
    automationBoundary: boundary,
    actionClassPolicy: new ActionClassPolicy(),
    now: () => '2026-08-13T00:00:00.000Z',
  });
}

describe('AutomationDiscovery', () => {
  it('proposes a workflow only when the same objective family recurs above the evidence floor', () => {
    const result = discover([
      task('t1', 'Prepare the monthly sales report'),
      task('t2', 'Prepare the monthly sales report'),
      task('t3', 'Prepare the monthly sales report'),
    ]);
    expect(result.workflows.length).toBeGreaterThan(0);
    expect(result.workflows[0]?.occurrences).toBe(3);
    expect(result.workflows[0]?.status).toBe('PROPOSED');
  });

  it('skips single occurrences (no fabricated automation)', () => {
    const result = discover([task('t1', 'Prepare the monthly sales report')]);
    expect(result.workflows.length).toBe(0);
    expect(result.skipped.length).toBeGreaterThan(0);
  });

  it('returns an honest empty result when there is no task history', () => {
    const result = discover([]);
    expect(result.workflows).toEqual([]);
    expect(result.skipped[0]).toMatch(/No task history/);
  });

  it('classifies sensitive recurring workflows as class C (approval required)', () => {
    const result = discover([
      task('t1', 'Publish the weekly newsletter'),
      task('t2', 'Publish the weekly newsletter'),
    ]);
    const workflow = result.workflows[0];
    expect(workflow?.actionClass).toBe('C');
  });

  it('classifies non-sensitive recurring workflows as class B (user-authorized)', () => {
    const result = discover([
      task('t1', 'Prepare the monthly sales report'),
      task('t2', 'Prepare the monthly sales report'),
    ]);
    expect(result.workflows[0]?.actionClass).toBe('B');
  });

  it('never proposes a never-automate workflow', () => {
    const result = discover([
      task('t1', 'Impersonate an admin during migration'),
      task('t2', 'Impersonate an admin during migration'),
    ]);
    expect(result.workflows).toEqual([]);
    expect(result.skipped.some((s) => s.includes('never proposed'))).toBe(true);
  });

  it('produces the TRIGGER→…→MEMORY workflow shape', () => {
    const result = discover([
      task('t1', 'Prepare the monthly sales report'),
      task('t2', 'Prepare the monthly sales report'),
    ]);
    const wf = result.workflows[0];
    expect(wf?.trigger).toBeTruthy();
    expect(wf?.input).toBeTruthy();
    expect(wf?.transformation).toBeTruthy();
    expect(wf?.verification).toBeTruthy();
    expect(wf?.output).toBeTruthy();
    expect(wf?.memory).toMatch(/interaction artifacts/i);
    expect(wf?.evidence.length).toBeGreaterThan(0);
  });
});
