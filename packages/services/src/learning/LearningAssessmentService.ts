// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Assessment Service
// BLD-012 — Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { AssessmentDTO } from './LearningDTO.js';

export class LearningAssessmentService {
  private readonly stores = new Map<string, Map<string, AssessmentDTO>>();

  private getStore(userId: string): Map<string, AssessmentDTO> {
    let store = this.stores.get(userId);
    if (!store) {
      store = new Map();
      this.stores.set(userId, store);
    }
    return store;
  }

  getAssessments(userId: string): AssessmentDTO[] {
    return Array.from(this.getStore(userId).values());
  }
  getAssessment(userId: string, assessmentId: string): AssessmentDTO | undefined {
    return this.getStore(userId).get(assessmentId);
  }
  addAssessment(userId: string, assessment: AssessmentDTO): void {
    this.getStore(userId).set(assessment.id, assessment);
  }

  updateAssessment(
    userId: string,
    assessmentId: string,
    updates: Partial<AssessmentDTO>,
  ): AssessmentDTO {
    const store = this.getStore(userId);
    const existing = store.get(assessmentId);
    if (!existing) throw new Error(`Assessment not found: ${assessmentId}`);
    const updated = { ...existing, ...updates };
    store.set(assessmentId, updated);
    return updated;
  }

  submitResult(
    userId: string,
    assessmentId: string,
    score: number,
    questionsAnswered: number,
  ): AssessmentDTO {
    return this.updateAssessment(userId, assessmentId, {
      score,
      questionsAnswered,
      status: 'completed',
      takenAt: new Date().toISOString(),
    });
  }

  getPendingAssessments(userId: string): AssessmentDTO[] {
    return this.getAssessments(userId).filter((a) => a.status !== 'completed');
  }

  getCompletedAssessments(userId: string): AssessmentDTO[] {
    return this.getAssessments(userId).filter((a) => a.status === 'completed');
  }
}
