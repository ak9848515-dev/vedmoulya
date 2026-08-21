// ──────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem: Workflow Entity
// SPRINT-050 — AI Ecosystem Foundation
//
// A lightweight Workflow entity. Workflows represent repeatable outcomes
// composed of steps, each requiring capabilities, agents, and tools.
// This is a typed contract — no business logic engines.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type {
  ApprovalPolicy,
  PrivacyClass,
  RiskLevel,
  WorkflowDefinition,
  WorkflowStatus,
  WorkflowStep,
} from '../../types/ecosystem-types.js';

export class Workflow {
  private readonly _id: string;
  private readonly _name: string;
  private readonly _outcome: string;
  private _steps: WorkflowStep[];
  private readonly _riskLevel: RiskLevel;
  private readonly _approvalPolicy: ApprovalPolicy;
  private readonly _privacyClass: PrivacyClass;
  private readonly _completionCriteria: string[];
  private readonly _approvalGates: string[];
  private _status: WorkflowStatus;
  private readonly _tags: string[];
  private readonly _owner: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(params: {
    id: string;
    name: string;
    outcome: string;
    steps?: WorkflowStep[];
    riskLevel?: RiskLevel;
    approvalPolicy?: ApprovalPolicy;
    privacyClass?: PrivacyClass;
    completionCriteria?: string[];
    approvalGates?: string[];
    status?: WorkflowStatus;
    tags?: string[];
    owner: string;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this._id = params.id;
    this._name = params.name;
    this._outcome = params.outcome;
    this._steps = params.steps ?? [];
    this._riskLevel = params.riskLevel ?? 'MEDIUM';
    this._approvalPolicy = params.approvalPolicy ?? 'HUMAN_APPROVAL_REQUIRED';
    this._privacyClass = params.privacyClass ?? 'PUBLIC';
    this._completionCriteria = params.completionCriteria ?? [];
    this._approvalGates = params.approvalGates ?? [];
    this._status = params.status ?? 'DEFINED';
    this._tags = params.tags ?? [];
    this._owner = params.owner;
    this._createdAt = params.createdAt ?? new Date();
    this._updatedAt = params.updatedAt ?? new Date();
  }

  // ── Getters ─────────────────────────────────────────────────────
  get id(): string {
    return this._id;
  }
  get name(): string {
    return this._name;
  }
  get outcome(): string {
    return this._outcome;
  }
  get steps(): readonly WorkflowStep[] {
    return [...this._steps];
  }
  get riskLevel(): RiskLevel {
    return this._riskLevel;
  }
  get approvalPolicy(): ApprovalPolicy {
    return this._approvalPolicy;
  }
  get privacyClass(): PrivacyClass {
    return this._privacyClass;
  }
  get completionCriteria(): readonly string[] {
    return [...this._completionCriteria];
  }
  get approvalGates(): readonly string[] {
    return [...this._approvalGates];
  }
  get status(): WorkflowStatus {
    return this._status;
  }
  get tags(): readonly string[] {
    return [...this._tags];
  }
  get owner(): string {
    return this._owner;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  // ── Derived ─────────────────────────────────────────────────────
  /** All unique capabilities required across all steps. */
  get requiredCapabilities(): CapabilityType[] {
    const caps = new Set<CapabilityType>();
    for (const step of this._steps) {
      for (const cap of step.requiredCapabilities) caps.add(cap);
    }
    return [...caps];
  }

  /** All unique agent ids referenced across all steps. */
  get referencedAgentIds(): string[] {
    const ids = new Set<string>();
    for (const step of this._steps) {
      for (const agentId of step.agentIds) ids.add(agentId);
    }
    return [...ids];
  }

  /** All unique tool names referenced across all steps. */
  get referencedToolNames(): string[] {
    const names = new Set<string>();
    for (const step of this._steps) {
      for (const tool of step.allowedTools) names.add(tool);
    }
    return [...names];
  }

  // ── Mutations ───────────────────────────────────────────────────
  addStep(step: WorkflowStep): void {
    this._steps.push(step);
    this._updatedAt = new Date();
  }

  removeStep(stepId: string): void {
    this._steps = this._steps.filter((s) => s.id !== stepId);
    this._updatedAt = new Date();
  }

  updateStep(stepId: string, updates: Partial<Omit<WorkflowStep, 'id'>>): void {
    const step = this._steps.find((s) => s.id === stepId);
    if (step) {
      Object.assign(step, updates);
      this._updatedAt = new Date();
    }
  }

  transitionTo(status: WorkflowStatus): void {
    this._status = status;
    this._updatedAt = new Date();
  }

  // ── Serialization ───────────────────────────────────────────────
  toDefinition(): WorkflowDefinition {
    return {
      id: this._id,
      name: this._name,
      outcome: this._outcome,
      steps: [...this._steps],
      riskLevel: this._riskLevel,
      approvalPolicy: this._approvalPolicy,
      privacyClass: this._privacyClass,
      completionCriteria: [...this._completionCriteria],
      approvalGates: [...this._approvalGates],
      status: this._status,
      tags: [...this._tags],
      owner: this._owner,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }

  // ── Factory ─────────────────────────────────────────────────────
  static create(params: {
    id: string;
    name: string;
    outcome: string;
    steps?: WorkflowStep[];
    riskLevel?: RiskLevel;
    approvalPolicy?: ApprovalPolicy;
    privacyClass?: PrivacyClass;
    completionCriteria?: string[];
    approvalGates?: string[];
    status?: WorkflowStatus;
    tags?: string[];
    owner: string;
  }): Workflow {
    return new Workflow(params);
  }
}
