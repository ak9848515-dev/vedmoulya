// ──────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem Domain Tests (SPRINT-050)
//
// Tests the typed contracts and registries:
// 1. Agent registration and lookup
// 2. Workflow registration and lookup
// 3. Ecosystem summary
// 4. Capability-based lookup
// 5. Provider preference lookup
// 6. Privacy class assignment
// 7. Risk level assignment
// 8. Agent lifecycle transitions
// 9. Workflow lifecycle transitions
// 10. Derived properties (requiredCapabilities, referencedAgentIds, etc.)
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { Agent } from '../domain/entities/Agent.js';
import { Workflow } from '../domain/entities/Workflow.js';
import { AgentRegistry } from '../domain/registries/AgentRegistry.js';
import { WorkflowRegistry } from '../domain/registries/WorkflowRegistry.js';
import { EcosystemService } from '../domain/EcosystemService.js';

// ── Agent Entity ──────────────────────────────────────────────────

describe('Agent entity', () => {
  it('creates with defaults', () => {
    const agent = Agent.create({
      id: 'test-agent',
      name: 'Test Agent',
      purpose: 'Does testing',
      owner: 'user-1',
    });

    expect(agent.id).toBe('test-agent');
    expect(agent.name).toBe('Test Agent');
    expect(agent.purpose).toBe('Does testing');
    expect(agent.owner).toBe('user-1');
    expect(agent.status).toBe('registered');
    expect(agent.riskLevel).toBe('MEDIUM');
    expect(agent.approvalPolicy).toBe('HUMAN_APPROVAL_REQUIRED');
    expect(agent.privacyClass).toBe('PUBLIC');
    expect(agent.pricingModel).toBe('PAID');
    expect(agent.requiredCapabilities).toEqual([]);
    expect(agent.allowedTools).toEqual([]);
    expect(agent.preferredProviders).toEqual([]);
  });

  it('creates with explicit values', () => {
    const agent = Agent.create({
      id: 'career-agent',
      name: 'Career Agent',
      purpose: 'Helps with career planning',
      requiredCapabilities: ['REASONING', 'RESEARCH'],
      allowedTools: ['search', 'calculator'],
      preferredProviders: ['openai', 'anthropic'],
      riskLevel: 'LOW',
      approvalPolicy: 'AUTO',
      privacyClass: 'PRIVATE',
      pricingModel: 'FREE',
      tags: ['career', 'planning'],
      owner: 'user-1',
    });

    expect(agent.requiredCapabilities).toEqual(['REASONING', 'RESEARCH']);
    expect(agent.allowedTools).toEqual(['search', 'calculator']);
    expect(agent.preferredProviders).toEqual(['openai', 'anthropic']);
    expect(agent.riskLevel).toBe('LOW');
    expect(agent.approvalPolicy).toBe('AUTO');
    expect(agent.privacyClass).toBe('PRIVATE');
    expect(agent.pricingModel).toBe('FREE');
    expect(agent.tags).toEqual(['career', 'planning']);
  });

  it('transitions status', () => {
    const agent = Agent.create({
      id: 'test-agent',
      name: 'Test',
      purpose: 'Test',
      owner: 'user-1',
    });

    expect(agent.status).toBe('registered');
    agent.transitionTo('available');
    expect(agent.status).toBe('available');
    agent.transitionTo('disabled');
    expect(agent.status).toBe('disabled');
  });

  it('updates details', () => {
    const agent = Agent.create({
      id: 'test-agent',
      name: 'Old Name',
      purpose: 'Old purpose',
      owner: 'user-1',
    });

    agent.updateDetails({
      name: 'New Name',
      purpose: 'New purpose',
      riskLevel: 'HIGH',
    });

    expect(agent.name).toBe('New Name');
    expect(agent.purpose).toBe('New purpose');
    expect(agent.riskLevel).toBe('HIGH');
  });

  it('serializes to definition', () => {
    const agent = Agent.create({
      id: 'test-agent',
      name: 'Test',
      purpose: 'Test',
      requiredCapabilities: ['CODING'],
      owner: 'user-1',
    });

    const def = agent.toDefinition();
    expect(def.id).toBe('test-agent');
    expect(def.requiredCapabilities).toEqual(['CODING']);
    expect(def.status).toBe('registered');
    expect(def.createdAt).toBeDefined();
    expect(def.updatedAt).toBeDefined();
  });
});

// ── Workflow Entity ───────────────────────────────────────────────

describe('Workflow entity', () => {
  it('creates with defaults', () => {
    const workflow = Workflow.create({
      id: 'test-workflow',
      name: 'Test Workflow',
      outcome: 'Test outcome',
      owner: 'user-1',
    });

    expect(workflow.id).toBe('test-workflow');
    expect(workflow.name).toBe('Test Workflow');
    expect(workflow.outcome).toBe('Test outcome');
    expect(workflow.owner).toBe('user-1');
    expect(workflow.status).toBe('DEFINED');
    expect(workflow.riskLevel).toBe('MEDIUM');
    expect(workflow.steps).toEqual([]);
  });

  it('creates with steps', () => {
    const workflow = Workflow.create({
      id: 'video-workflow',
      name: 'Create Video',
      outcome: 'Published educational video',
      steps: [
        {
          id: 'step-1',
          title: 'Generate script',
          purpose: 'Write the video script',
          requiredCapabilities: ['TEXT_GENERATION'],
          agentIds: ['story-agent'],
          allowedTools: [],
          riskLevel: 'LOW',
          approvalPolicy: 'AUTO',
          automationLevel: 'FULLY_AUTOMATED',
          dependencies: [],
          verificationRequirements: ['script length > 100 words'],
        },
        {
          id: 'step-2',
          title: 'Generate video',
          purpose: 'Create the video from script',
          requiredCapabilities: ['VIDEO_GENERATION'],
          agentIds: ['production-agent'],
          allowedTools: ['video-generator'],
          riskLevel: 'HIGH',
          approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
          automationLevel: 'HUMAN_APPROVAL',
          dependencies: ['step-1'],
          verificationRequirements: ['video duration > 30s'],
        },
      ],
      completionCriteria: ['Video published on YouTube'],
      approvalGates: ['step-2'],
      owner: 'user-1',
    });

    expect(workflow.steps).toHaveLength(2);
    expect(workflow.requiredCapabilities).toEqual(['TEXT_GENERATION', 'VIDEO_GENERATION']);
    expect(workflow.referencedAgentIds).toEqual(['story-agent', 'production-agent']);
    expect(workflow.referencedToolNames).toEqual(['video-generator']);
    expect(workflow.approvalGates).toEqual(['step-2']);
  });

  it('adds and removes steps', () => {
    const workflow = Workflow.create({
      id: 'test-workflow',
      name: 'Test',
      outcome: 'Test',
      owner: 'user-1',
    });

    workflow.addStep({
      id: 'step-1',
      title: 'Step 1',
      purpose: 'Do something',
      requiredCapabilities: ['REASONING'],
      agentIds: [],
      allowedTools: [],
      riskLevel: 'LOW',
      approvalPolicy: 'AUTO',
      automationLevel: 'FULLY_AUTOMATED',
      dependencies: [],
      verificationRequirements: [],
    });

    expect(workflow.steps).toHaveLength(1);

    workflow.removeStep('step-1');
    expect(workflow.steps).toHaveLength(0);
  });

  it('transitions status', () => {
    const workflow = Workflow.create({
      id: 'test-workflow',
      name: 'Test',
      outcome: 'Test',
      owner: 'user-1',
    });

    expect(workflow.status).toBe('DEFINED');
    workflow.transitionTo('APPROVED');
    expect(workflow.status).toBe('APPROVED');
    workflow.transitionTo('ACTIVE');
    expect(workflow.status).toBe('ACTIVE');
  });
});

// ── Agent Registry ────────────────────────────────────────────────

describe('AgentRegistry', () => {
  it('registers and lists agents', () => {
    const registry = new AgentRegistry();
    const agent = Agent.create({
      id: 'career-agent',
      name: 'Career Agent',
      purpose: 'Career planning',
      owner: 'user-1',
    });

    registry.register(agent);
    expect(registry.size).toBe(1);
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0]?.id).toBe('career-agent');
  });

  it('prevents duplicate registration', () => {
    const registry = new AgentRegistry();
    const agent = Agent.create({
      id: 'career-agent',
      name: 'Career Agent',
      purpose: 'Career planning',
      owner: 'user-1',
    });

    registry.register(agent);
    expect(() => registry.register(agent)).toThrow('already registered');
  });

  it('finds by id', () => {
    const registry = new AgentRegistry();
    const agent = Agent.create({
      id: 'career-agent',
      name: 'Career Agent',
      purpose: 'Career planning',
      owner: 'user-1',
    });

    registry.register(agent);
    expect(registry.findById('career-agent')).toBeDefined();
    expect(registry.findById('missing')).toBeUndefined();
  });

  it('lists by owner', () => {
    const registry = new AgentRegistry();
    registry.register(Agent.create({ id: 'a1', name: 'A1', purpose: 'P1', owner: 'user-1' }));
    registry.register(Agent.create({ id: 'a2', name: 'A2', purpose: 'P2', owner: 'user-2' }));

    expect(registry.listByOwner('user-1')).toHaveLength(1);
    expect(registry.listByOwner('user-1')[0]?.id).toBe('a1');
  });

  it('lists by capability', () => {
    const registry = new AgentRegistry();
    registry.register(
      Agent.create({
        id: 'a1',
        name: 'A1',
        purpose: 'P1',
        owner: 'user-1',
        requiredCapabilities: ['REASONING', 'CODING'],
      }),
    );
    registry.register(
      Agent.create({
        id: 'a2',
        name: 'A2',
        purpose: 'P2',
        owner: 'user-1',
        requiredCapabilities: ['VISION'],
      }),
    );

    expect(registry.listByCapability('REASONING')).toHaveLength(1);
    expect(registry.listByCapability('VISION')).toHaveLength(1);
  });

  it('searches by query', () => {
    const registry = new AgentRegistry();
    registry.register(
      Agent.create({
        id: 'career-agent',
        name: 'Career Agent',
        purpose: 'Career planning',
        owner: 'user-1',
      }),
    );
    registry.register(
      Agent.create({
        id: 'research-agent',
        name: 'Research Agent',
        purpose: 'Deep research',
        owner: 'user-1',
      }),
    );

    expect(registry.search({ query: 'career' })).toHaveLength(1);
    expect(registry.search({ query: 'research' })).toHaveLength(1);
  });
});

// ── Workflow Registry ─────────────────────────────────────────────

describe('WorkflowRegistry', () => {
  it('registers and lists workflows', () => {
    const registry = new WorkflowRegistry();
    const workflow = Workflow.create({
      id: 'video-workflow',
      name: 'Create Video',
      outcome: 'Published video',
      owner: 'user-1',
    });

    registry.register(workflow);
    expect(registry.size).toBe(1);
    expect(registry.list()).toHaveLength(1);
  });

  it('prevents duplicate registration', () => {
    const registry = new WorkflowRegistry();
    const workflow = Workflow.create({
      id: 'video-workflow',
      name: 'Create Video',
      outcome: 'Published video',
      owner: 'user-1',
    });

    registry.register(workflow);
    expect(() => registry.register(workflow)).toThrow('already registered');
  });

  it('searches by capability', () => {
    const registry = new WorkflowRegistry();
    registry.register(
      Workflow.create({
        id: 'w1',
        name: 'W1',
        outcome: 'O1',
        owner: 'user-1',
        steps: [
          {
            id: 's1',
            title: 'S1',
            purpose: 'P1',
            requiredCapabilities: ['VIDEO_GENERATION'],
            agentIds: [],
            allowedTools: [],
            riskLevel: 'HIGH',
            approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
            automationLevel: 'HUMAN_APPROVAL',
            dependencies: [],
            verificationRequirements: [],
          },
        ],
      }),
    );

    expect(registry.listByCapability('VIDEO_GENERATION')).toHaveLength(1);
    expect(registry.listByCapability('CODING')).toHaveLength(0);
  });
});

// ── Ecosystem Service ─────────────────────────────────────────────

describe('EcosystemService', () => {
  it('returns summary with counts', () => {
    const agentRegistry = new AgentRegistry();
    const workflowRegistry = new WorkflowRegistry();

    agentRegistry.register(Agent.create({ id: 'a1', name: 'A1', purpose: 'P1', owner: 'u1' }));
    agentRegistry.register(Agent.create({ id: 'a2', name: 'A2', purpose: 'P2', owner: 'u1' }));
    workflowRegistry.register(
      Workflow.create({ id: 'w1', name: 'W1', outcome: 'O1', owner: 'u1' }),
    );

    const service = new EcosystemService({
      agentRegistry,
      workflowRegistry,
      providerCount: () => 5,
      modelCount: () => 20,
      capabilityCount: () => 17,
      toolCount: () => 3,
    });

    const summary = service.getSummary();
    expect(summary.providers).toBe(5);
    expect(summary.models).toBe(20);
    expect(summary.capabilities).toBe(17);
    expect(summary.tools).toBe(3);
    expect(summary.agents).toBe(2);
    expect(summary.workflows).toBe(1);
    expect(summary.generatedAt).toBeDefined();
  });

  it('lists agent components', () => {
    const agentRegistry = new AgentRegistry();
    const workflowRegistry = new WorkflowRegistry();

    agentRegistry.register(
      Agent.create({
        id: 'career-agent',
        name: 'Career Agent',
        purpose: 'Career planning',
        riskLevel: 'LOW',
        privacyClass: 'PRIVATE',
        tags: ['career'],
        owner: 'u1',
      }),
    );

    const service = new EcosystemService({ agentRegistry, workflowRegistry });
    const components = service.listAgentComponents();

    expect(components).toHaveLength(1);
    expect(components[0]?.type).toBe('agent');
    expect(components[0]?.name).toBe('Career Agent');
    expect(components[0]?.riskLevel).toBe('LOW');
    expect(components[0]?.privacyClass).toBe('PRIVATE');
  });

  it('finds agents for capability', () => {
    const agentRegistry = new AgentRegistry();
    const workflowRegistry = new WorkflowRegistry();

    agentRegistry.register(
      Agent.create({
        id: 'coding-agent',
        name: 'Coding Agent',
        purpose: 'Codes',
        requiredCapabilities: ['CODING'],
        owner: 'u1',
      }),
    );
    agentRegistry.register(
      Agent.create({
        id: 'research-agent',
        name: 'Research Agent',
        purpose: 'Researches',
        requiredCapabilities: ['RESEARCH'],
        owner: 'u1',
      }),
    );

    const service = new EcosystemService({ agentRegistry, workflowRegistry });
    const coding = service.findAgentsForCapability('CODING');
    expect(coding).toHaveLength(1);
    expect(coding[0]?.id).toBe('coding-agent');
  });

  it('returns zero counts when no count functions provided', () => {
    const service = new EcosystemService({
      agentRegistry: new AgentRegistry(),
      workflowRegistry: new WorkflowRegistry(),
    });

    const summary = service.getSummary();
    expect(summary.providers).toBe(0);
    expect(summary.models).toBe(0);
    expect(summary.capabilities).toBe(0);
    expect(summary.tools).toBe(0);
  });
});
