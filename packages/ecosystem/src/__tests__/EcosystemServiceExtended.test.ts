import { describe, it, expect } from 'vitest';
import { EcosystemService } from '../domain/EcosystemService.js';
import { AgentRegistry } from '../domain/registries/AgentRegistry.js';
import { WorkflowRegistry } from '../domain/registries/WorkflowRegistry.js';
import { Agent } from '../domain/entities/Agent.js';
import { Workflow } from '../domain/entities/Workflow.js';

function makeAgent(overrides: Record<string, unknown> = {}) {
  return Agent.create({
    id: overrides.id ?? 'agent-1',
    name: overrides.name ?? 'Test Agent',
    purpose: overrides.purpose ?? 'Test purpose',
    ownerId: overrides.ownerId ?? 'owner-1',
    requiredCapabilities: overrides.requiredCapabilities ?? ['reasoning'],
    preferredProviders: overrides.preferredProviders ?? ['openai'],
    riskLevel: overrides.riskLevel ?? 'LOW',
    pricingModel: overrides.pricingModel ?? 'FREE',
    privacyClass: overrides.privacyClass ?? 'PUBLIC',
    tags: overrides.tags ?? ['test'],
    status: overrides.status ?? 'ACTIVE',
  });
}

function makeWorkflow(overrides: Record<string, unknown> = {}) {
  return Workflow.create({
    id: overrides.id ?? 'wf-1',
    name: overrides.name ?? 'Test Workflow',
    outcome: overrides.outcome ?? 'Test outcome',
    owner: overrides.owner ?? 'owner-1',
    steps: overrides.steps ?? [
      {
        id: 'step-1',
        title: 'Step',
        purpose: 'Do it',
        requiredCapabilities: ['coding'],
        riskLevel: 'LOW',
        approvalPolicy: 'AUTO',
      },
    ],
    tags: overrides.tags ?? ['test'],
    status: overrides.status ?? 'ACTIVE',
  });
}

function makeService(opts: Record<string, unknown> = {}) {
  const agentRegistry = new AgentRegistry();
  const workflowRegistry = new WorkflowRegistry();
  if (opts.agents) {
    for (const a of opts.agents as Agent[]) agentRegistry.register(a);
  }
  if (opts.workflows) {
    for (const w of opts.workflows as Workflow[]) workflowRegistry.register(w);
  }
  return new EcosystemService({
    agentRegistry,
    workflowRegistry,
    providerCount: opts.providerCount as (() => number) | undefined,
    modelCount: opts.modelCount as (() => number) | undefined,
    capabilityCount: opts.capabilityCount as (() => number) | undefined,
    toolCount: opts.toolCount as (() => number) | undefined,
  });
}

describe('EcosystemService', () => {
  describe('getSummary', () => {
    it('returns counts from registries and optional functions', () => {
      const svc = makeService({
        agents: [makeAgent({ id: 'a1' })],
        workflows: [makeWorkflow({ id: 'w1' })],
        providerCount: () => 5,
        modelCount: () => 10,
        capabilityCount: () => 8,
        toolCount: () => 3,
      });
      const summary = svc.getSummary();
      expect(summary.agents).toBe(1);
      expect(summary.workflows).toBe(1);
      expect(summary.providers).toBe(5);
      expect(summary.models).toBe(10);
      expect(summary.capabilities).toBe(8);
      expect(summary.tools).toBe(3);
      expect(summary.generatedAt).toBeTruthy();
    });

    it('defaults optional counts to 0', () => {
      const svc = makeService();
      const summary = svc.getSummary();
      expect(summary.providers).toBe(0);
      expect(summary.models).toBe(0);
      expect(summary.capabilities).toBe(0);
      expect(summary.tools).toBe(0);
    });
  });

  describe('listAgentComponents', () => {
    it('maps agents to ecosystem components', () => {
      const svc = makeService({
        agents: [makeAgent({ id: 'a1', name: 'Agent One', purpose: 'Do things' })],
      });
      const components = svc.listAgentComponents();
      expect(components).toHaveLength(1);
      expect(components[0].type).toBe('agent');
      expect(components[0].name).toBe('Agent One');
      expect(components[0].description).toBe('Do things');
    });

    it('returns empty when no agents', () => {
      expect(makeService().listAgentComponents()).toEqual([]);
    });
  });

  describe('listWorkflowComponents', () => {
    it('maps workflows to ecosystem components', () => {
      const svc = makeService({
        workflows: [makeWorkflow({ id: 'w1', name: 'WF One', outcome: 'Outcome 1' })],
      });
      const components = svc.listWorkflowComponents();
      expect(components).toHaveLength(1);
      expect(components[0].type).toBe('workflow');
      expect(components[0].name).toBe('WF One');
      expect(components[0].pricingModel).toBe('PAID');
    });

    it('returns empty when no workflows', () => {
      expect(makeService().listWorkflowComponents()).toEqual([]);
    });
  });

  describe('findAgentsForCapability', () => {
    it('returns agents with matching capability', () => {
      const svc = makeService({
        agents: [
          makeAgent({ id: 'a1', requiredCapabilities: ['reasoning', 'coding'] }),
          makeAgent({ id: 'a2', requiredCapabilities: ['vision'] }),
        ],
      });
      expect(svc.findAgentsForCapability('reasoning')).toHaveLength(1);
    });
  });

  describe('findWorkflowsForCapability', () => {
    it('returns workflows with matching capability', () => {
      const svc = makeService({
        workflows: [
          makeWorkflow({
            id: 'w1',
            steps: [
              {
                id: 's1',
                title: 'S',
                purpose: 'P',
                requiredCapabilities: ['coding'],
                riskLevel: 'LOW',
                approvalPolicy: 'AUTO',
              },
            ],
          }),
          makeWorkflow({
            id: 'w2',
            steps: [
              {
                id: 's2',
                title: 'S',
                purpose: 'P',
                requiredCapabilities: ['vision'],
                riskLevel: 'LOW',
                approvalPolicy: 'AUTO',
              },
            ],
          }),
        ],
      });
      expect(svc.findWorkflowsForCapability('coding')).toHaveLength(1);
    });
  });

  describe('findAgentsForProvider', () => {
    it('returns agents preferring a specific provider', () => {
      const svc = makeService({
        agents: [
          makeAgent({ id: 'a1', preferredProviders: ['openai', 'deepseek'] }),
          makeAgent({ id: 'a2', preferredProviders: ['google'] }),
        ],
      });
      expect(svc.findAgentsForProvider('openai')).toHaveLength(1);
    });
  });

  describe('getAgentPrivacyPolicy', () => {
    it('returns privacy class for existing agent', () => {
      const svc = makeService({
        agents: [makeAgent({ id: 'a1', privacyClass: 'CONFIDENTIAL' })],
      });
      expect(svc.getAgentPrivacyPolicy('a1')).toBe('CONFIDENTIAL');
    });

    it('returns undefined for unknown agent', () => {
      expect(makeService().getAgentPrivacyPolicy('nope')).toBeUndefined();
    });
  });

  describe('getStepRiskLevel', () => {
    it('returns risk level for existing workflow step', () => {
      const svc = makeService({
        workflows: [
          makeWorkflow({
            id: 'w1',
            steps: [
              {
                id: 's1',
                title: 'S',
                purpose: 'P',
                requiredCapabilities: [],
                riskLevel: 'HIGH',
                approvalPolicy: 'AUTO',
              },
            ],
          }),
        ],
      });
      expect(svc.getStepRiskLevel('w1', 's1')).toBe('HIGH');
    });

    it('returns undefined for unknown workflow', () => {
      expect(makeService().getStepRiskLevel('nope', 's1')).toBeUndefined();
    });

    it('returns undefined for unknown step', () => {
      const svc = makeService({
        workflows: [makeWorkflow({ id: 'w1' })],
      });
      expect(svc.getStepRiskLevel('w1', 'nope')).toBeUndefined();
    });
  });
});
