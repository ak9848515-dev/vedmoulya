import { describe, it, expect } from 'vitest';
import { CareerRoadmapService } from '../CareerRoadmapService.js';

describe('CareerRoadmapService', () => {
  it('builds roadmap from exploring to senior', () => {
    const svc = new CareerRoadmapService();
    const r = svc.buildRoadmap('exploring', 'senior', [
      { id: 'm1', label: 'Complete Assessment', description: '', status: 'completed' },
      { id: 'm2', label: 'Get First Job', description: '', status: 'in_progress' },
    ]);
    expect(r.currentStage).toBe('exploring');
    expect(r.targetStage).toBe('senior');
    expect(r.stages).toHaveLength(6);
    expect(r.estimatedTimelineMonths).toBeGreaterThan(0);
    expect(r.progress).toBe(50);
  });

  it('handles same current and target stage', () => {
    const svc = new CareerRoadmapService();
    const r = svc.buildRoadmap('exploring', 'exploring', []);
    expect(r.estimatedTimelineMonths).toBe(0);
    expect(r.alternativePaths).toHaveLength(1);
  });

  it('getStageInfo returns stage definition', () => {
    const svc = new CareerRoadmapService();
    const stage = svc.getStageInfo('exploring');
    expect(stage).toBeDefined();
    expect(stage!.name).toBe('Exploring');
  });

  it('getStageInfo returns undefined for unknown stage', () => {
    expect(new CareerRoadmapService().getStageInfo('unknown')).toBeUndefined();
  });

  it('marks current stage correctly', () => {
    const svc = new CareerRoadmapService();
    const r = svc.buildRoadmap('mid', 'senior', []);
    const mid = r.stages.find((s) => s.id === 'mid');
    expect(mid!.isCurrent).toBe(true);
    expect(mid!.isCompleted).toBe(false);
  });

  it('marks completed stages correctly', () => {
    const svc = new CareerRoadmapService();
    const r = svc.buildRoadmap('senior', 'leadership', []);
    const exploring = r.stages.find((s) => s.id === 'exploring');
    expect(exploring!.isCompleted).toBe(true);
  });

  it('generates alternative paths for large gaps', () => {
    const svc = new CareerRoadmapService();
    const r = svc.buildRoadmap('exploring', 'senior', []);
    expect(r.alternativePaths.length).toBeGreaterThanOrEqual(1);
  });

  it('handles unknown stage gracefully', () => {
    const svc = new CareerRoadmapService();
    const r = svc.buildRoadmap('unknown', 'senior', []);
    expect(r.currentStage).toBe('unknown');
    expect(r.stages).toHaveLength(6);
  });
});
