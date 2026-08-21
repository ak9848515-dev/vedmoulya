// ──────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem Service
// SPRINT-050 — AI Ecosystem Foundation
//
// Provides a unified view of the ecosystem: providers, models,
// capabilities, tools, agents, and workflows. This service
// composes existing registries without duplicating them.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType, ProviderFamily } from '@vedmoulya/ai';
import type {
  AgentDefinition,
  EcosystemComponent,
  EcosystemSummary,
  PrivacyClass,
  RiskLevel,
  WorkflowDefinition,
} from '../types/ecosystem-types.js';
import type { AgentRegistry } from './registries/AgentRegistry.js';
import type { WorkflowRegistry } from './registries/WorkflowRegistry.js';

export interface EcosystemServiceOptions {
  agentRegistry: AgentRegistry;
  workflowRegistry: WorkflowRegistry;
  /** Optional: provider count (from @vedmoulya/providers). */
  providerCount?: () => number;
  /** Optional: model count (from @vedmoulya/providers). */
  modelCount?: () => number;
  /** Optional: capability count (from @vedmoulya/capabilities). */
  capabilityCount?: () => number;
  /** Optional: tool count (from ToolRegistry). */
  toolCount?: () => number;
}

export class EcosystemService {
  private readonly agentRegistry: AgentRegistry;
  private readonly workflowRegistry: WorkflowRegistry;
  private readonly providerCountFn?: () => number;
  private readonly modelCountFn?: () => number;
  private readonly capabilityCountFn?: () => number;
  private readonly toolCountFn?: () => number;

  constructor(options: EcosystemServiceOptions) {
    this.agentRegistry = options.agentRegistry;
    this.workflowRegistry = options.workflowRegistry;
    this.providerCountFn = options.providerCount;
    this.modelCountFn = options.modelCount;
    this.capabilityCountFn = options.capabilityCount;
    this.toolCountFn = options.toolCount;
  }

  /** Get the ecosystem summary (counts only, no fabrication). */
  getSummary(): EcosystemSummary {
    return {
      providers: this.providerCountFn?.() ?? 0,
      models: this.modelCountFn?.() ?? 0,
      capabilities: this.capabilityCountFn?.() ?? 0,
      tools: this.toolCountFn?.() ?? 0,
      agents: this.agentRegistry.size,
      workflows: this.workflowRegistry.size,
      generatedAt: new Date().toISOString(),
    };
  }

  /** Get all agents as ecosystem components. */
  listAgentComponents(): EcosystemComponent[] {
    return this.agentRegistry.list().map((a) => ({
      id: a.id,
      type: 'agent' as const,
      name: a.name,
      description: a.purpose,
      status: a.status,
      riskLevel: a.riskLevel,
      pricingModel: a.pricingModel,
      privacyClass: a.privacyClass,
      tags: a.tags,
    }));
  }

  /** Get all workflows as ecosystem components. */
  listWorkflowComponents(): EcosystemComponent[] {
    return this.workflowRegistry.list().map((w) => ({
      id: w.id,
      type: 'workflow' as const,
      name: w.name,
      description: w.outcome,
      status: w.status,
      riskLevel: w.riskLevel,
      pricingModel: 'PAID',
      privacyClass: w.privacyClass,
      tags: w.tags,
    }));
  }

  /** Find agents that can perform a given capability. */
  findAgentsForCapability(capability: CapabilityType): AgentDefinition[] {
    return this.agentRegistry.listByCapability(capability);
  }

  /** Find workflows that require a given capability. */
  findWorkflowsForCapability(capability: CapabilityType): WorkflowDefinition[] {
    return this.workflowRegistry.listByCapability(capability);
  }

  /** Find agents by provider preference. */
  findAgentsForProvider(family: ProviderFamily): AgentDefinition[] {
    return this.agentRegistry.list().filter((a) => a.preferredProviders.includes(family));
  }

  /** Get the privacy policy for an agent (advisory, not enforced here). */
  getAgentPrivacyPolicy(agentId: string): PrivacyClass | undefined {
    return this.agentRegistry.findById(agentId)?.privacyClass;
  }

  /** Get the risk level for a workflow step. */
  getStepRiskLevel(workflowId: string, stepId: string): RiskLevel | undefined {
    const workflow = this.workflowRegistry.findById(workflowId);
    if (!workflow) return undefined;
    const def = workflow.toDefinition();
    const step = def.steps.find((s) => s.id === stepId);
    return step?.riskLevel;
  }
}
