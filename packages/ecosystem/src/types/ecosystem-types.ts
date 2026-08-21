// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Ecosystem Domain Types
// SPRINT-050 — AI Ecosystem Foundation
//
// The ecosystem model unifies: Provider → Model → Capability → Tool → Agent → Workflow
// under a single architectural umbrella. This file defines the typed contracts
// that allow new providers, models, capabilities, tools, agents, and workflows
// to be added without redesigning the platform.
//
// CRITICAL: This does NOT replace existing abstractions — it extends them.
// Provider → see @vedmoulya/providers
// Capability → see @vedmoulya/capabilities + @vedmoulya/capability-marketplace
// Tool → see @vedmoulya/services/ai/runtime/ToolRuntime
// Goal → see @vedmoulya/goals
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType, ProviderFamily } from '@vedmoulya/ai';

// ── Risk & Approval ────────────────────────────────────────────────

/** Risk classification for ecosystem actions. */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const RISK_LEVELS: readonly RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

/** Whether an action requires human approval before execution. */
export type ApprovalPolicy = 'AUTO' | 'PLAN_THEN_EXECUTE' | 'HUMAN_APPROVAL_REQUIRED';

/** Classification of an action's automation boundary. */
export type AutomationLevel =
  'FULLY_AUTOMATED' | 'PARTIALLY_AUTOMATED' | 'HUMAN_APPROVAL' | 'MANUAL';

export const AUTOMATION_LEVELS: readonly AutomationLevel[] = [
  'FULLY_AUTOMATED',
  'PARTIALLY_AUTOMATED',
  'HUMAN_APPROVAL',
  'MANUAL',
] as const;

// ── Pricing & Access ───────────────────────────────────────────────

/** Pricing model for a provider, tool, or capability. */
export type PricingModel =
  'FREE' | 'FREE_TIER' | 'PAID' | 'LOCAL' | 'OPEN_SOURCE' | 'USER_PROVIDED';

export const PRICING_MODELS: readonly PricingModel[] = [
  'FREE',
  'FREE_TIER',
  'PAID',
  'LOCAL',
  'OPEN_SOURCE',
  'USER_PROVIDED',
] as const;

/** Privacy classification for data handling. */
export type PrivacyClass = 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL' | 'RESTRICTED';

export const PRIVACY_CLASSES: readonly PrivacyClass[] = [
  'PUBLIC',
  'PRIVATE',
  'CONFIDENTIAL',
  'RESTRICTED',
] as const;

// ── Agent ──────────────────────────────────────────────────────────

/** Agent lifecycle status. */
export type AgentStatus = 'registered' | 'available' | 'busy' | 'disabled' | 'archived';

export const AGENT_STATUSES: readonly AgentStatus[] = [
  'registered',
  'available',
  'busy',
  'disabled',
  'archived',
] as const;

/**
 * A lightweight Agent definition.
 * An agent is a specialized entity that performs tasks using capabilities and tools.
 * Agents declare what they need (capabilities, tools) and what they prefer (models/providers).
 */
export interface AgentDefinition {
  /** Stable agent id (e.g. 'career-agent', 'research-agent'). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** What this agent does (plain language). */
  purpose: string;
  /** Capabilities this agent requires to function. */
  requiredCapabilities: CapabilityType[];
  /** Tools this agent is allowed to use (empty = no tools). */
  allowedTools: string[];
  /** Preferred model/provider families (advisory, not exclusive). */
  preferredProviders: ProviderFamily[];
  /** Risk profile of this agent's typical actions. */
  riskLevel: RiskLevel;
  /** Whether this agent's actions require human approval. */
  approvalPolicy: ApprovalPolicy;
  /** Privacy class this agent operates under. */
  privacyClass: PrivacyClass;
  /** Pricing model for this agent's typical resource usage. */
  pricingModel: PricingModel;
  /** Current status. */
  status: AgentStatus;
  /** Tags for discovery and filtering. */
  tags: string[];
  /** Owner scope (user id or 'system'). */
  owner: string;
  /** When this agent was registered. */
  createdAt: string;
  /** When this agent was last updated. */
  updatedAt: string;
}

// ── Workflow ───────────────────────────────────────────────────────

/** Workflow lifecycle status. */
export type WorkflowStatus = 'DEFINED' | 'APPROVED' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export const WORKFLOW_STATUSES: readonly WorkflowStatus[] = [
  'DEFINED',
  'APPROVED',
  'ACTIVE',
  'PAUSED',
  'ARCHIVED',
] as const;

/** A single step in a workflow. */
export interface WorkflowStep {
  /** Stable step id within the workflow. */
  id: string;
  /** Human-readable step title. */
  title: string;
  /** What this step produces (plain language). */
  purpose: string;
  /** Capabilities required for this step. */
  requiredCapabilities: CapabilityType[];
  /** Agent(s) that can perform this step (agent ids). */
  agentIds: string[];
  /** Tools allowed for this step (tool names). */
  allowedTools: string[];
  /** Step-level risk classification. */
  riskLevel: RiskLevel;
  /** Whether this step requires human approval. */
  approvalPolicy: ApprovalPolicy;
  /** Automation level for this step. */
  automationLevel: AutomationLevel;
  /** Step ids that must complete before this step (DAG edges). */
  dependencies: string[];
  /** Verification requirements for this step's output. */
  verificationRequirements: string[];
}

/**
 * A Workflow represents a desired repeatable outcome.
 * It maps: outcome → steps → agents → capabilities → tools → providers.
 */
export interface WorkflowDefinition {
  /** Stable workflow id. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** The desired outcome (plain language). */
  outcome: string;
  /** Ordered steps to achieve the outcome. */
  steps: WorkflowStep[];
  /** Overall risk level of the workflow. */
  riskLevel: RiskLevel;
  /** Whether the workflow requires human approval at any point. */
  approvalPolicy: ApprovalPolicy;
  /** Privacy class for the workflow's data. */
  privacyClass: PrivacyClass;
  /** Completion criteria (what "done" means). */
  completionCriteria: string[];
  /** Human approval gates (step ids that pause for approval). */
  approvalGates: string[];
  /** Current status. */
  status: WorkflowStatus;
  /** Tags for discovery and filtering. */
  tags: string[];
  /** Owner scope (user id or 'system'). */
  owner: string;
  /** When this workflow was created. */
  createdAt: string;
  /** When this workflow was last updated. */
  updatedAt: string;
}

// ── Ecosystem View ─────────────────────────────────────────────────

/**
 * A unified view of one ecosystem component.
 * Used by the UI to display providers, capabilities, tools, agents, and workflows
 * in a consistent format.
 */
export interface EcosystemComponent {
  /** Component id. */
  id: string;
  /** Component type. */
  type: 'provider' | 'model' | 'capability' | 'tool' | 'agent' | 'workflow';
  /** Human-readable name. */
  name: string;
  /** Description. */
  description: string;
  /** Status label. */
  status: string;
  /** Risk level. */
  riskLevel: RiskLevel;
  /** Pricing model. */
  pricingModel: PricingModel;
  /** Privacy class. */
  privacyClass: PrivacyClass;
  /** Tags. */
  tags: string[];
}

/**
 * The ecosystem summary — a high-level view of all registered components.
 */
export interface EcosystemSummary {
  providers: number;
  models: number;
  capabilities: number;
  tools: number;
  agents: number;
  workflows: number;
  generatedAt: string;
}
