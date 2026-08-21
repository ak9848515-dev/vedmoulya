// ──────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem: Agent Entity
// SPRINT-050 — AI Ecosystem Foundation
//
// A lightweight Agent entity. Agents declare what they need
// (capabilities, tools) and what they prefer (models/providers).
// This is a typed contract — no business logic engines.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType, ProviderFamily } from '@vedmoulya/ai';
import type {
  AgentDefinition,
  AgentStatus,
  ApprovalPolicy,
  PricingModel,
  PrivacyClass,
  RiskLevel,
} from '../../types/ecosystem-types.js';

export class Agent {
  private readonly _id: string;
  private _name: string;
  private _purpose: string;
  private _requiredCapabilities: CapabilityType[];
  private _allowedTools: string[];
  private _preferredProviders: ProviderFamily[];
  private _riskLevel: RiskLevel;
  private _approvalPolicy: ApprovalPolicy;
  private _privacyClass: PrivacyClass;
  private _pricingModel: PricingModel;
  private _status: AgentStatus;
  private _tags: string[];
  private readonly _owner: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(params: {
    id: string;
    name: string;
    purpose: string;
    requiredCapabilities?: CapabilityType[];
    allowedTools?: string[];
    preferredProviders?: ProviderFamily[];
    riskLevel?: RiskLevel;
    approvalPolicy?: ApprovalPolicy;
    privacyClass?: PrivacyClass;
    pricingModel?: PricingModel;
    status?: AgentStatus;
    tags?: string[];
    owner: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  }) {
    this._id = params.id;
    this._name = params.name;
    this._purpose = params.purpose;
    this._requiredCapabilities = params.requiredCapabilities ?? [];
    this._allowedTools = params.allowedTools ?? [];
    this._preferredProviders = params.preferredProviders ?? [];
    this._riskLevel = params.riskLevel ?? 'MEDIUM';
    this._approvalPolicy = params.approvalPolicy ?? 'HUMAN_APPROVAL_REQUIRED';
    this._privacyClass = params.privacyClass ?? 'PUBLIC';
    this._pricingModel = params.pricingModel ?? 'PAID';
    this._status = params.status ?? 'registered';
    this._tags = params.tags ?? [];
    this._owner = params.owner;
    this._createdAt = params.createdAt ? new Date(params.createdAt) : new Date();
    this._updatedAt = params.updatedAt ? new Date(params.updatedAt) : new Date();
  }

  // ── Getters ─────────────────────────────────────────────────────
  get id(): string {
    return this._id;
  }
  get name(): string {
    return this._name;
  }
  get purpose(): string {
    return this._purpose;
  }
  get requiredCapabilities(): readonly CapabilityType[] {
    return [...this._requiredCapabilities];
  }
  get allowedTools(): readonly string[] {
    return [...this._allowedTools];
  }
  get preferredProviders(): readonly ProviderFamily[] {
    return [...this._preferredProviders];
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
  get pricingModel(): PricingModel {
    return this._pricingModel;
  }
  get status(): AgentStatus {
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

  // ── Mutations ───────────────────────────────────────────────────
  updateDetails(params: {
    name?: string;
    purpose?: string;
    requiredCapabilities?: CapabilityType[];
    allowedTools?: string[];
    preferredProviders?: ProviderFamily[];
    riskLevel?: RiskLevel;
    approvalPolicy?: ApprovalPolicy;
    privacyClass?: PrivacyClass;
    pricingModel?: PricingModel;
    tags?: string[];
  }): void {
    if (params.name !== undefined) this._name = params.name;
    if (params.purpose !== undefined) this._purpose = params.purpose;
    if (params.requiredCapabilities !== undefined)
      this._requiredCapabilities = [...params.requiredCapabilities];
    if (params.allowedTools !== undefined) this._allowedTools = [...params.allowedTools];
    if (params.preferredProviders !== undefined)
      this._preferredProviders = [...params.preferredProviders];
    if (params.riskLevel !== undefined) this._riskLevel = params.riskLevel;
    if (params.approvalPolicy !== undefined) this._approvalPolicy = params.approvalPolicy;
    if (params.privacyClass !== undefined) this._privacyClass = params.privacyClass;
    if (params.pricingModel !== undefined) this._pricingModel = params.pricingModel;
    if (params.tags !== undefined) this._tags = [...params.tags];
    this._updatedAt = new Date();
  }

  transitionTo(status: AgentStatus): void {
    this._status = status;
    this._updatedAt = new Date();
  }

  // ── Serialization ───────────────────────────────────────────────
  toDefinition(): AgentDefinition {
    return {
      id: this._id,
      name: this._name,
      purpose: this._purpose,
      requiredCapabilities: [...this._requiredCapabilities],
      allowedTools: [...this._allowedTools],
      preferredProviders: [...this._preferredProviders],
      riskLevel: this._riskLevel,
      approvalPolicy: this._approvalPolicy,
      privacyClass: this._privacyClass,
      pricingModel: this._pricingModel,
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
    purpose: string;
    requiredCapabilities?: CapabilityType[];
    allowedTools?: string[];
    preferredProviders?: ProviderFamily[];
    riskLevel?: RiskLevel;
    approvalPolicy?: ApprovalPolicy;
    privacyClass?: PrivacyClass;
    pricingModel?: PricingModel;
    status?: AgentStatus;
    tags?: string[];
    owner: string;
  }): Agent {
    return new Agent(params);
  }
}
