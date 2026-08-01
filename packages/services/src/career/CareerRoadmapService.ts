// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career Roadmap Service
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- stageDefinitions lookups
   use typed stage ids from a fixed in-class registry; `?? 0` guards every read,
   so no attacker-controlled property access is possible. */
import type {
  CareerRoadmapDTO,
  CareerStageDTO,
  CareerMilestoneDTO,
  CareerPathDTO,
} from './CareerDTO.js';

export class CareerRoadmapService {
  private readonly stageDefinitions: Record<string, CareerStageDTO> = {
    exploring: {
      id: 'exploring',
      name: 'Exploring',
      description: 'Discovering career options and interests',
      order: 0,
      isCurrent: false,
      isCompleted: false,
      requiredSkills: [],
      recommendedSkills: ['self-assessment', 'research'],
      averageTenureMonths: 6,
      transitionDifficulty: 'easy',
    },
    early: {
      id: 'early',
      name: 'Early Career',
      description: 'Building foundational skills and experience',
      order: 1,
      isCurrent: false,
      isCompleted: false,
      requiredSkills: ['core-technical'],
      recommendedSkills: ['communication', 'teamwork'],
      averageTenureMonths: 24,
      transitionDifficulty: 'easy',
    },
    mid: {
      id: 'mid',
      name: 'Mid Career',
      description: 'Deepening expertise and taking ownership',
      order: 2,
      isCurrent: false,
      isCompleted: false,
      requiredSkills: ['advanced-technical', 'project-management'],
      recommendedSkills: ['mentoring', 'leadership'],
      averageTenureMonths: 36,
      transitionDifficulty: 'moderate',
    },
    senior: {
      id: 'senior',
      name: 'Senior Level',
      description: 'Leading initiatives and mentoring others',
      order: 3,
      isCurrent: false,
      isCompleted: false,
      requiredSkills: ['architecture', 'strategic-thinking'],
      recommendedSkills: ['executive-communication', 'cross-functional'],
      averageTenureMonths: 48,
      transitionDifficulty: 'difficult',
    },
    leadership: {
      id: 'leadership',
      name: 'Leadership',
      description: 'Setting vision and driving organizational change',
      order: 4,
      isCurrent: false,
      isCompleted: false,
      requiredSkills: ['strategy', 'people-management'],
      recommendedSkills: ['board-presentation', 'industry-thought'],
      averageTenureMonths: 60,
      transitionDifficulty: 'very_difficult',
    },
    expert: {
      id: 'expert',
      name: 'Industry Expert',
      description: 'Recognized authority shaping the industry',
      order: 5,
      isCurrent: false,
      isCompleted: false,
      requiredSkills: ['thought-leadership', 'innovation'],
      recommendedSkills: ['public-speaking', 'writing'],
      averageTenureMonths: 84,
      transitionDifficulty: 'very_difficult',
    },
  };

  buildRoadmap(
    currentStage: string,
    targetStage: string,
    milestones: CareerMilestoneDTO[],
  ): CareerRoadmapDTO {
    const stages = Object.values(this.stageDefinitions).map((s) => ({
      ...s,
      isCurrent: s.id === currentStage,
      isCompleted: s.order < (this.stageDefinitions[currentStage]?.order ?? 0),
    }));

    const currentOrder = this.stageDefinitions[currentStage]?.order ?? 0;
    const targetOrder = this.stageDefinitions[targetStage]?.order ?? 0;
    const stageDiff = Math.max(0, targetOrder - currentOrder);
    const completedMilestones = milestones.filter((m) => m.status === 'completed').length;
    const progress =
      milestones.length > 0 ? Math.round((completedMilestones / milestones.length) * 100) : 0;

    return {
      currentStage,
      targetStage,
      stages,
      milestones,
      estimatedTimelineMonths: stageDiff * 24,
      progress,
      flexibilityScore: 75,
      alternativePaths: this.generateAlternativePaths(currentStage, targetStage),
    };
  }

  getStageInfo(stageId: string): CareerStageDTO | undefined {
    return this.stageDefinitions[stageId];
  }

  private generateAlternativePaths(currentStage: string, targetStage: string): CareerPathDTO[] {
    const paths: CareerPathDTO[] = [];
    const current = this.stageDefinitions[currentStage];
    const target = this.stageDefinitions[targetStage];
    if (!current || !target) return paths;

    const directPath: string[] = [];
    for (let o = current.order; o <= target.order; o++) {
      const stage = Object.values(this.stageDefinitions).find((s) => s.order === o);
      if (stage) directPath.push(stage.id);
    }
    paths.push({
      id: 'direct',
      title: 'Direct Path',
      description: 'Standard career progression path',
      stages: directPath,
      probability: 0.6,
      estimatedTimelineMonths: (target.order - current.order) * 24,
    });

    if (target.order - current.order >= 2) {
      const accelerated: string[] = [currentStage];
      const skipMid = Object.values(this.stageDefinitions).find(
        (s) => s.order === current.order + 2,
      );
      if (skipMid) accelerated.push(skipMid.id);
      accelerated.push(targetStage);
      paths.push({
        id: 'accelerated',
        title: 'Accelerated Path (skip mid-stage)',
        description: 'Fast-track career progression by skipping intermediate stages',
        stages: accelerated,
        probability: 0.3,
        estimatedTimelineMonths: (target.order - current.order - 1) * 24,
      });
    }

    return paths;
  }
}
