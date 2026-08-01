// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Reference Entities Tests
// Covers Skill, Competency, Evidence, Artifact, and the typed
// reference entities (goal, project, career, learning, business,
// context, decision, execution, memory, portfolio).
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { Skill } from '../entities/Skill.js';
import { Competency } from '../entities/Competency.js';
import { Evidence } from '../entities/Evidence.js';
import { Artifact } from '../entities/Artifact.js';
import { GoalReference } from '../entities/GoalReference.js';
import { ProjectReference } from '../entities/ProjectReference.js';
import { CareerReference } from '../entities/CareerReference.js';
import { LearningReference } from '../entities/LearningReference.js';
import { BusinessReference } from '../entities/BusinessReference.js';
import { ContextReference } from '../entities/ContextReference.js';
import { DecisionReference } from '../entities/DecisionReference.js';
import { ExecutionReference } from '../entities/ExecutionReference.js';
import { MemoryReference } from '../entities/MemoryReference.js';
import { PortfolioReference } from '../entities/PortfolioReference.js';
import { createKnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import { createGraphId } from '../value-objects/GraphId.js';

const graphId = createGraphId('g-refs');
const nid = (n: number) => createKnowledgeNodeId(`r${String(n)}`);

describe('Skill', () => {
  it('creates with defaults and tracks proficiency', () => {
    const skill = Skill.create({ nodeId: nid(1), graphId, name: 'TypeScript' });
    expect(skill.name).toBe('TypeScript');
    expect(skill.proficiency.level).toBe('beginner');
    expect(skill.yearsOfExperience).toBe(0);
    expect(skill.isExpert()).toBe(false);

    skill.updateProficiency({ level: 'expert', score: 0.9 });
    expect(skill.isExpert()).toBe(true);
    expect(skill.lastPracticedAt).toBeInstanceOf(Date);

    skill.recordPractice();
    expect(skill.lastPracticedAt).toBeInstanceOf(Date);
  });
});

describe('Competency', () => {
  it('manages level and skills', () => {
    const comp = Competency.create({ nodeId: nid(2), graphId, name: 'Dev' });
    expect(comp.level.name).toBe('developing');
    expect(comp.isProficient()).toBe(false);

    comp.updateLevel({ name: 'proficient', score: 0.8, order: 1 });
    expect(comp.isProficient()).toBe(true);

    comp.addSkill(nid(3));
    comp.addSkill(nid(3)); // duplicate ignored
    expect(comp.skillIds).toEqual([nid(3)]);
    comp.removeSkill(nid(3));
    expect(comp.skillIds).toEqual([]);
  });
});

describe('Evidence', () => {
  it('manages claims, verification, and linkable claims', () => {
    const evidence = Evidence.create({ nodeId: nid(4), graphId, label: 'Cert' });
    expect(evidence.isVerified()).toBe(false);

    evidence.addClaim({
      type: 'certification',
      description: 'AWS cert',
      url: 'https://x',
      collectedAt: new Date(),
    });
    expect(evidence.claims).toHaveLength(1);
    expect(evidence.getLinkableClaims()).toHaveLength(1);
    expect(evidence.isVerified()).toBe(false);

    evidence.addClaim({
      type: 'endorsement',
      description: 'verified',
      collectedAt: new Date(),
      verifiedBy: 'peer',
    });
    expect(evidence.isVerified()).toBe(true);

    evidence.removeClaim(0);
    expect(evidence.claims).toHaveLength(1);
    evidence.removeClaim(10); // out of range — no-op
    expect(evidence.claims).toHaveLength(1);
  });
});

describe('Artifact', () => {
  it('manages links and primary type', () => {
    const artifact = Artifact.create({
      nodeId: nid(5),
      graphId,
      label: 'Portfolio',
      primaryType: 'website',
    });
    expect(artifact.getAllUrls()).toEqual([]);

    artifact.addLink({ type: 'website', url: 'https://a', title: 'A' });
    artifact.addLink({ type: 'document', url: 'https://b', title: 'B' });
    expect(artifact.getAllUrls()).toEqual(['https://a', 'https://b']);

    artifact.changePrimaryType('report');
    expect(artifact.primaryType).toBe('report');

    artifact.removeLink(0);
    expect(artifact.links).toHaveLength(1);
  });
});

describe('GoalReference', () => {
  it('manages status, priority, and targets', () => {
    const goal = GoalReference.create({ nodeId: nid(6), graphId, label: 'Ship v1' });
    expect(goal.getProgress()).toBe(0);
    expect(goal.isOnTrack()).toBe(true);

    goal.updateStatus('in_progress');
    goal.updatePriority('high');
    expect(goal.goalStatus).toBe('in_progress');
    expect(goal.priority).toBe('high');

    goal.addTarget({ metric: 'users', targetValue: 100, currentValue: 50 });
    goal.updateTargetProgress('users', 75);
    expect(goal.getProgress()).toBe(0.75);

    goal.updateTargetProgress('unknown_metric', 10); // no-op
    expect(goal.getProgress()).toBe(0.75);

    const past = GoalReference.create({
      nodeId: nid(7),
      graphId,
      label: 'Past',
      deadline: new Date('2020-01-01'),
    });
    expect(past.isOnTrack()).toBe(false);
  });
});

describe('ProjectReference', () => {
  it('manages phase, role, and duration', () => {
    const start = new Date('2026-01-01');
    const project = ProjectReference.create({
      nodeId: nid(8),
      graphId,
      label: 'Project',
      startDate: start,
      teamSize: 3,
      role: 'lead',
    });
    expect(project.isActive()).toBe(false);
    expect(project.isCompleted()).toBe(false);
    expect(project.getDurationDays()).toBeGreaterThan(0);

    project.updatePhase('execution');
    expect(project.isActive()).toBe(true);

    project.updatePhase('completed');
    expect(project.isCompleted()).toBe(true);
    expect(project.endDate).toBeInstanceOf(Date);

    project.setRole('pm');
    expect(project.role).toBe('pm');
  });

  it('returns undefined duration without a start date', () => {
    const project = ProjectReference.create({ nodeId: nid(9), graphId, label: 'P' });
    expect(project.getDurationDays()).toBeUndefined();
  });
});

describe('CareerReference', () => {
  it('manages current status and duration', () => {
    const start = new Date('2025-01-01');
    const career = CareerReference.create({
      nodeId: nid(10),
      graphId,
      label: 'Engineer',
      eventType: 'job',
      organization: 'ACME',
      startDate: start,
      isCurrent: true,
    });
    expect(career.organization).toBe('ACME');
    expect(career.isCurrent).toBe(true);
    expect(career.endDate).toBeUndefined();

    career.end(new Date('2025-06-01'));
    expect(career.isCurrent).toBe(false);
    expect(career.getDurationMonths()).toBeGreaterThan(0);

    career.markAsCurrent();
    expect(career.isCurrent).toBe(true);
    expect(career.endDate).toBeUndefined();
  });
});

describe('LearningReference', () => {
  it('tracks progress, completion, and takeaways', () => {
    const learning = LearningReference.create({
      nodeId: nid(11),
      graphId,
      label: 'Course',
      learningType: 'course',
      provider: 'Udemy',
      progress: { percentage: 20, hoursSpent: 2 },
    });
    expect(learning.learningType).toBe('course');
    expect(learning.isCompleted).toBe(false);

    learning.updateProgress({ percentage: 50 });
    expect(learning.progress.percentage).toBe(50);

    learning.addTakeaway('a');
    learning.addTakeaway('a'); // duplicate ignored
    expect(learning.progress.takeaways).toEqual(['a']);

    learning.complete();
    expect(learning.isCompleted).toBe(true);
    expect(learning.progress.percentage).toBe(100);
  });
});

describe('BusinessReference', () => {
  it('tracks financial records and profit', () => {
    const business = BusinessReference.create({
      nodeId: nid(12),
      graphId,
      label: 'Biz',
      entityType: 'client',
    });
    expect(business.getNetProfit()).toBe(0);

    business.addFinancialRecord({
      type: 'income',
      amount: 1000,
      currency: 'USD',
      date: new Date(),
      category: 'sale',
    });
    business.addFinancialRecord({
      type: 'expense',
      amount: 300,
      currency: 'USD',
      date: new Date(),
      category: 'tools',
    });
    expect(business.getTotalIncome()).toBe(1000);
    expect(business.getTotalExpenses()).toBe(300);
    expect(business.getNetProfit()).toBe(700);
  });
});

describe('ContextReference', () => {
  it('manages factors and serialization', () => {
    const ctx = ContextReference.create({ nodeId: nid(13), graphId, label: 'Context' });
    expect(ctx.scope).toBe('personal');

    ctx.addFactor({ scope: 'technical', key: 'stack', value: 'ts' });
    ctx.addFactor({ scope: 'personal', key: 'city', value: 'BLR' });
    expect(ctx.getFactorsByScope('technical')).toHaveLength(1);
    expect(ctx.toContextMap()).toEqual({ stack: 'ts', city: 'BLR' });

    ctx.removeFactor('stack');
    expect(ctx.factors).toHaveLength(1);
  });
});

describe('DecisionReference', () => {
  it('records outcomes and options', () => {
    const decision = DecisionReference.create({ nodeId: nid(14), graphId, label: 'Pick stack' });
    expect(decision.outcome).toBe('unknown');
    expect(decision.getChosenOption()).toBeUndefined();

    decision.addOption({ label: 'A', description: '', pros: [], cons: [], wasChosen: false });
    decision.addOption({ label: 'B', description: '', pros: [], cons: [], wasChosen: false });
    decision.chooseOption('B');
    expect(decision.getChosenOption()?.label).toBe('B');

    decision.recordOutcome('success');
    expect(decision.outcome).toBe('success');
  });
});

describe('ExecutionReference', () => {
  it('runs through execution lifecycle', () => {
    const execution = ExecutionReference.create({ nodeId: nid(15), graphId, label: 'Task' });
    expect(execution.executionResult.status).toBe('pending');
    expect(execution.priority).toBe(0);

    execution.start();
    expect(execution.executionResult.status).toBe('in_progress');

    execution.complete('done');
    expect(execution.executionResult.status).toBe('completed');
    expect(execution.executionResult.completedAt).toBeInstanceOf(Date);

    execution.setPriority(5);
    expect(execution.priority).toBe(5);
  });

  it('block stores the reason in output', () => {
    const execution = ExecutionReference.create({
      nodeId: nid(16),
      graphId,
      label: 'Task',
      result: { status: 'in_progress' },
      assignedTo: 'me',
    });
    execution.block('blocked by dependency');
    expect(execution.executionResult.status).toBe('blocked');
    expect(execution.executionResult.output).toBe('blocked by dependency');
    expect(execution.assignedTo).toBe('me');
  });
});

describe('MemoryReference', () => {
  it('manages context and significance', () => {
    const memory = MemoryReference.create({ nodeId: nid(17), graphId, label: 'Memory' });
    expect(memory.memoryType).toBe('factual');
    expect(memory.isSignificant()).toBe(false);

    memory.updateContext({ location: 'BLR', people: ['A'] });
    expect(memory.memoryContext).toEqual({ location: 'BLR', people: ['A'] });

    memory.promoteSignificance('important');
    expect(memory.isSignificant()).toBe(true);
  });
});

describe('PortfolioReference', () => {
  it('manages visibility, featured, and url', () => {
    const portfolio = PortfolioReference.create({
      nodeId: nid(18),
      graphId,
      label: 'Portfolio',
      itemType: 'case_study',
    });
    expect(portfolio.visibility).toBe('private');
    expect(portfolio.isPublic()).toBe(false);

    portfolio.setVisibility('public');
    expect(portfolio.isPublic()).toBe(true);

    portfolio.toggleFeatured();
    expect(portfolio.isFeatured).toBe(true);
    portfolio.toggleFeatured();
    expect(portfolio.isFeatured).toBe(false);

    portfolio.setUrl('https://p');
    expect(portfolio.url).toBe('https://p');
  });
});
