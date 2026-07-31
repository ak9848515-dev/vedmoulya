import { describe, it, expect } from 'vitest';
import { LearningAssessmentService } from '../LearningAssessmentService.js';
import type { AssessmentDTO } from '../LearningDTO.js';

function makeAssessment(overrides: Partial<AssessmentDTO> = {}): AssessmentDTO {
  return {
    id: 'a1',
    title: 'Test Quiz',
    topic: 'React',
    type: 'quiz',
    maxScore: 100,
    questionsAnswered: 0,
    totalQuestions: 10,
    status: 'pending',
    ...overrides,
  };
}

describe('LearningAssessmentService', () => {
  it('returns empty for new user', () => {
    const svc = new LearningAssessmentService();
    expect(svc.getAssessments('user1')).toEqual([]);
  });

  it('adds and retrieves assessment', () => {
    const svc = new LearningAssessmentService();
    svc.addAssessment('user1', makeAssessment());
    expect(svc.getAssessments('user1').length).toBe(1);
  });

  it('getAssessment returns undefined for missing', () => {
    const svc = new LearningAssessmentService();
    expect(svc.getAssessment('user1', 'nope')).toBeUndefined();
  });

  it('updateAssessment merges updates', () => {
    const svc = new LearningAssessmentService();
    svc.addAssessment('user1', makeAssessment());
    const updated = svc.updateAssessment('user1', 'a1', { title: 'Updated Quiz' });
    expect(updated.title).toBe('Updated Quiz');
  });

  it('updateAssessment throws for missing', () => {
    const svc = new LearningAssessmentService();
    expect(() => svc.updateAssessment('user1', 'nope', {})).toThrow('not found');
  });

  it('submitResult completes assessment with score', () => {
    const svc = new LearningAssessmentService();
    svc.addAssessment('user1', makeAssessment());
    const result = svc.submitResult('user1', 'a1', 85, 10);
    expect(result.status).toBe('completed');
    expect(result.score).toBe(85);
    expect(result.takenAt).toBeDefined();
  });

  it('getPendingAssessments filters non-completed', () => {
    const svc = new LearningAssessmentService();
    svc.addAssessment('user1', makeAssessment({ id: 'a1', status: 'pending' }));
    svc.addAssessment('user1', makeAssessment({ id: 'a2', status: 'completed' }));
    expect(svc.getPendingAssessments('user1').length).toBe(1);
  });

  it('getCompletedAssessments filters completed', () => {
    const svc = new LearningAssessmentService();
    svc.addAssessment('user1', makeAssessment({ id: 'a1', status: 'pending' }));
    svc.addAssessment('user1', makeAssessment({ id: 'a2', status: 'completed' }));
    expect(svc.getCompletedAssessments('user1').length).toBe(1);
  });

  it('getPendingAssessments returns all when none completed', () => {
    const svc = new LearningAssessmentService();
    svc.addAssessment('user1', makeAssessment({ id: 'a1', status: 'pending' }));
    svc.addAssessment('user1', makeAssessment({ id: 'a2', status: 'in_progress' }));
    expect(svc.getPendingAssessments('user1').length).toBe(2);
  });
});
