// ──────────────────────────────────────────────────────────────────
// VedMoulya — Goal & Task Intelligence: Seed Catalog
// EI-006 — Enterprise Goal & Task Intelligence Engine
// Realistic seed goals across the supported categories. Used for dev,
// the web explorer, and tests. Each goal ships complete success
// criteria (definition, validation, completion criteria, expected
// outcome) per the sprint brief.
// ──────────────────────────────────────────────────────────────────

import type { Goal } from '../types/goal-types.js';
import { createGoalId } from '../domain/value-objects/Identifiers.js';

export const SEED_GOAL_SIZE = 5;

const now = new Date().toISOString();

export function createCatalogGoals(): Goal[] {
  const goals: Goal[] = [
    {
      goalId: 'goal_blog_seed',
      title: 'Launch a weekly client blog',
      description:
        'Produce and publish a weekly blog for a content-agency client covering microservices topics.',
      category: 'business',
      business: ['content-agency', 'client-work'],
      priority: 'high',
      urgency: 0.7,
      importance: 0.8,
      complexity: 'moderate',
      estimatedEffort: 12,
      status: 'accepted',
      confidence: 0.82,
      goalScore: 0.78,
      successCriteria: [
        {
          criterionId: 'criterion_blog_1',
          definition: 'Publish one quality blog per week for 4 consecutive weeks',
          validation: 'Check the publication calendar and delivery logs weekly',
          completionCriteria: [
            '4 posts published',
            'Each post approved by client',
            'SEO checklist applied',
          ],
          expectedOutcome: 'A repeatable weekly content pipeline with client approval',
          met: false,
        },
      ],
      milestones: [
        {
          milestoneId: 'milestone_blog_1',
          title: 'Pipeline established',
          description: 'Research → writing → review → SEO → publish flow running weekly',
          taskIds: [],
          order: 1,
          achieved: false,
        },
      ],
      dependencies: [],
      childGoalIds: [],
      tags: ['content', 'client', 'weekly'],
      metadata: { seed: true, template: 'business' },
      events: [
        {
          eventId: 'event_blog_seed',
          goalId: 'goal_blog_seed',
          type: 'created',
          timestamp: now,
          message: 'Seed goal created from catalog.',
          metadata: { seed: true },
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      goalId: 'goal_learning_seed',
      title: 'Master TypeScript advanced patterns',
      description:
        'Complete a structured learning path covering generics, decorators, and advanced typing in TypeScript.',
      category: 'learning',
      business: ['engineering'],
      priority: 'medium',
      urgency: 0.4,
      importance: 0.7,
      complexity: 'moderate',
      estimatedEffort: 20,
      status: 'scored',
      confidence: 0.75,
      goalScore: 0.62,
      successCriteria: [
        {
          criterionId: 'criterion_learn_1',
          definition: 'Demonstrate advanced TypeScript skills on a real codebase',
          validation: 'Assessment with 80%+ score and a reviewed code submission',
          completionCriteria: ['Assessment passed (≥80%)', 'Refactoring PR merged', 'Notes logged'],
          expectedOutcome: 'Confidence to apply advanced typing patterns in production code',
          met: false,
        },
      ],
      milestones: [
        {
          milestoneId: 'milestone_learn_1',
          title: 'Core concepts mastered',
          description: 'Generics + conditional types exercises complete',
          taskIds: [],
          order: 1,
          achieved: false,
        },
        {
          milestoneId: 'milestone_learn_2',
          title: 'Assessment complete',
          description: 'Certification assessment passed',
          taskIds: [],
          order: 2,
          achieved: false,
        },
      ],
      dependencies: [],
      childGoalIds: [],
      tags: ['typescript', 'upskill', 'certification'],
      metadata: { seed: true, template: 'learning' },
      events: [
        {
          eventId: 'event_learn_seed',
          goalId: 'goal_learning_seed',
          type: 'created',
          timestamp: now,
          message: 'Seed goal created from catalog.',
          metadata: { seed: true },
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      goalId: 'goal_career_seed',
      title: 'Get promoted to Senior Engineer',
      description:
        'Strengthen profile, deliver a flagship project, and prepare for the promotion review this quarter.',
      category: 'career',
      business: ['engineering', 'career-growth'],
      priority: 'high',
      urgency: 0.6,
      importance: 0.9,
      complexity: 'complex',
      estimatedEffort: 40,
      status: 'active',
      confidence: 0.68,
      goalScore: 0.74,
      successCriteria: [
        {
          criterionId: 'criterion_career_1',
          definition: 'Promotion to Senior Engineer approved',
          validation: 'Formal promotion decision recorded by management',
          completionCriteria: [
            'Flagship project delivered',
            'Promotion packet submitted',
            'Review passed',
          ],
          expectedOutcome: 'New title, scope, and compensation band',
          met: false,
        },
      ],
      milestones: [
        {
          milestoneId: 'milestone_career_1',
          title: 'Flagship delivered',
          description: 'Lead the migration project to completion',
          taskIds: [],
          order: 1,
          achieved: false,
        },
      ],
      dependencies: [],
      childGoalIds: [],
      tags: ['promotion', 'leadership', 'q3'],
      metadata: { seed: true, template: 'career' },
      events: [
        {
          eventId: 'event_career_seed',
          goalId: 'goal_career_seed',
          type: 'created',
          timestamp: now,
          message: 'Seed goal created from catalog.',
          metadata: { seed: true },
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      goalId: 'goal_revenue_seed',
      title: 'Grow recurring revenue by 25%',
      description:
        'Add subscription revenue through packaged retainers and upsells for existing clients.',
      category: 'revenue',
      business: ['sales', 'client-success'],
      priority: 'critical',
      urgency: 0.8,
      importance: 0.95,
      complexity: 'complex',
      estimatedEffort: 60,
      status: 'proposed',
      confidence: 0.55,
      goalScore: 0.66,
      successCriteria: [
        {
          criterionId: 'criterion_rev_1',
          definition: 'Recurring revenue grows 25% quarter-over-quarter',
          validation: 'Compare MRR/ARR in the revenue dashboard',
          completionCriteria: [
            '25% MRR growth',
            '3 new retainers signed',
            'Upsell revenue recorded',
          ],
          expectedOutcome: 'Sustained monthly recurring revenue baseline',
          met: false,
        },
      ],
      milestones: [
        {
          milestoneId: 'milestone_rev_1',
          title: 'Offer packaged',
          description: 'Retainer packages defined and priced',
          taskIds: [],
          order: 1,
          achieved: false,
        },
        {
          milestoneId: 'milestone_rev_2',
          title: 'Targets closed',
          description: 'Three retainer deals signed',
          taskIds: [],
          order: 2,
          achieved: false,
        },
      ],
      dependencies: [],
      childGoalIds: [],
      tags: ['revenue', 'retainers', 'q3'],
      metadata: { seed: true, template: 'revenue' },
      events: [
        {
          eventId: 'event_rev_seed',
          goalId: 'goal_revenue_seed',
          type: 'created',
          timestamp: now,
          message: 'Seed goal created from catalog.',
          metadata: { seed: true },
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      goalId: 'goal_project_seed',
      title: 'Ship the analytics dashboard MVP',
      description:
        'Build and launch the first version of the internal analytics dashboard for the platform team.',
      category: 'project',
      business: ['platform'],
      priority: 'high',
      urgency: 0.6,
      importance: 0.8,
      complexity: 'complex',
      estimatedEffort: 80,
      status: 'accepted',
      confidence: 0.72,
      goalScore: 0.7,
      successCriteria: [
        {
          criterionId: 'criterion_proj_1',
          definition: 'Analytics dashboard MVP live for the team',
          validation: 'Deployment verified + usage spike in the first week',
          completionCriteria: ['MVP deployed', 'Core metrics visible', 'Team onboarding done'],
          expectedOutcome: 'Daily self-serve metrics without manual reporting',
          met: false,
        },
      ],
      milestones: [
        {
          milestoneId: 'milestone_proj_1',
          title: 'MVP scoped',
          description: 'Scope, milestones, and architecture approved',
          taskIds: [],
          order: 1,
          achieved: false,
        },
        {
          milestoneId: 'milestone_proj_2',
          title: 'MVP shipped',
          description: 'Dashboard deployed and adopted',
          taskIds: [],
          order: 2,
          achieved: false,
        },
      ],
      dependencies: [],
      childGoalIds: [],
      tags: ['product', 'mvp', 'analytics'],
      metadata: { seed: true, template: 'project' },
      events: [
        {
          eventId: 'event_proj_seed',
          goalId: 'goal_project_seed',
          type: 'created',
          timestamp: now,
          message: 'Seed goal created from catalog.',
          metadata: { seed: true },
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];
  return goals.map((g) => ({ ...g, goalId: createGoalId(g.goalId) }));
}
