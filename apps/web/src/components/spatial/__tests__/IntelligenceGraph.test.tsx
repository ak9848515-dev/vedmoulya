// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Graph Tests (SPRINT-055)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { buildIntelligenceGraph } from '../../../lib/intelligence-graph-data.js';

describe('Intelligence Graph Data (SPRINT-055)', () => {
  describe('1. graph uses real ecosystem data', () => {
    it('builds graph from known agents, workflows, providers', () => {
      const graph = buildIntelligenceGraph();
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);

      // Should have brain node
      const brain = graph.nodes.find((n) => n.type === 'brain');
      expect(brain).toBeDefined();
      expect(brain?.id).toBe('vedmoulya-brain');
    });

    it('includes all registered workflows', () => {
      const graph = buildIntelligenceGraph();
      const workflows = graph.nodes.filter((n) => n.type === 'workflow');
      expect(workflows.length).toBeGreaterThanOrEqual(3);
    });

    it('includes all registered agents', () => {
      const graph = buildIntelligenceGraph();
      const agents = graph.nodes.filter((n) => n.type === 'agent');
      expect(agents.length).toBeGreaterThanOrEqual(5);
    });

    it('includes capabilities used by agents', () => {
      const graph = buildIntelligenceGraph();
      const capabilities = graph.nodes.filter((n) => n.type === 'capability');
      expect(capabilities.length).toBeGreaterThan(0);
    });

    it('includes tools used by agents', () => {
      const graph = buildIntelligenceGraph();
      const tools = graph.nodes.filter((n) => n.type === 'tool');
      expect(tools.length).toBeGreaterThan(0);
    });

    it('includes providers', () => {
      const graph = buildIntelligenceGraph();
      const providers = graph.nodes.filter((n) => n.type === 'provider');
      expect(providers.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('2. owner scoping', () => {
    it('graph data does not contain other users data', () => {
      const graph = buildIntelligenceGraph();
      // All nodes should be system-level (no user-specific data)
      for (const node of graph.nodes) {
        expect(node.id).not.toContain('user-');
      }
    });
  });

  describe('3. agent state', () => {
    it('agents have correct status', () => {
      const graph = buildIntelligenceGraph();
      const agents = graph.nodes.filter((n) => n.type === 'agent');
      for (const agent of agents) {
        expect([
          'active',
          'available',
          'idle',
          'waiting',
          'failed',
          'disabled',
          'unknown',
        ]).toContain(agent.status);
      }
    });

    it('agents have metadata', () => {
      const graph = buildIntelligenceGraph();
      const agent = graph.nodes.find((n) => n.type === 'agent');
      expect(agent?.meta).toBeDefined();
      expect(agent?.meta?.capabilities).toBeDefined();
    });
  });

  describe('4. workflow state', () => {
    it('workflows have correct status', () => {
      const graph = buildIntelligenceGraph();
      const workflows = graph.nodes.filter((n) => n.type === 'workflow');
      for (const wf of workflows) {
        expect([
          'active',
          'available',
          'idle',
          'waiting',
          'failed',
          'disabled',
          'unknown',
        ]).toContain(wf.status);
      }
    });
  });

  describe('5. provider state', () => {
    it('providers show not_configured when not configured', () => {
      const graph = buildIntelligenceGraph();
      const openai = graph.nodes.find((n) => n.id === 'provider-openai');
      expect(openai?.status).toBe('unknown');
    });

    it('mock provider is always available', () => {
      const graph = buildIntelligenceGraph();
      const mock = graph.nodes.find((n) => n.id === 'provider-mock');
      expect(mock?.status).toBe('available');
    });
  });

  describe('6. active execution', () => {
    it('highlights active workflow and agent', () => {
      const graph = buildIntelligenceGraph({
        activeExecution: {
          workflowId: 'career-freelance-intelligence',
          workflowName: 'Career Intelligence',
          currentStep: 2,
          totalSteps: 7,
          agentId: 'career-match-agent',
          agentName: 'Match Agent',
          status: 'RUNNING',
        },
      });

      const activeWf = graph.nodes.find((n) => n.id === 'career-freelance-intelligence');
      expect(activeWf?.status).toBe('active');

      const activeAgent = graph.nodes.find((n) => n.id === 'career-match-agent');
      expect(activeAgent?.status).toBe('active');

      // Should have active edges
      const activeEdges = graph.edges.filter((e) => e.active);
      expect(activeEdges.length).toBeGreaterThan(0);
    });

    it('shows approval state', () => {
      const graph = buildIntelligenceGraph({
        activeExecution: {
          workflowId: 'career-freelance-intelligence',
          workflowName: 'Career Intelligence',
          currentStep: 4,
          totalSteps: 7,
          agentId: 'career-proposal-agent',
          agentName: 'Proposal Agent',
          status: 'WAITING_FOR_APPROVAL',
          approvalState: {
            stepId: 'step-career-approval',
            stepTitle: 'Founder Review',
            riskLevel: 'MEDIUM',
          },
        },
      });

      expect(graph.activeExecution?.approvalState).toBeDefined();
      expect(graph.activeExecution?.approvalState?.stepTitle).toBe('Founder Review');
    });
  });

  describe('7. no credential exposure', () => {
    it('graph does not contain API keys or tokens', () => {
      const graph = buildIntelligenceGraph();
      const graphStr = JSON.stringify(graph);
      expect(graphStr).not.toContain('api_key');
      expect(graphStr).not.toContain('token');
      expect(graphStr).not.toContain('secret');
      expect(graphStr).not.toContain('password');
    });
  });

  describe('8. honest state', () => {
    it('unconfigured providers show unknown, not ready', () => {
      const graph = buildIntelligenceGraph();
      const openai = graph.nodes.find((n) => n.id === 'provider-openai');
      expect(openai?.status).not.toBe('available');
      expect(openai?.status).not.toBe('active');
    });

    it('no fabrication of active state', () => {
      const graph = buildIntelligenceGraph();
      const activeNodes = graph.nodes.filter((n) => n.status === 'active');
      // Only the brain should be active by default
      expect(activeNodes.length).toBeLessThanOrEqual(1);
    });
  });

  describe('9. connections', () => {
    it('brain connects to workflows', () => {
      const graph = buildIntelligenceGraph();
      const brainToWorkflow = graph.edges.filter(
        (e) =>
          e.from === 'vedmoulya-brain' &&
          graph.nodes.find((n) => n.id === e.to)?.type === 'workflow',
      );
      expect(brainToWorkflow.length).toBeGreaterThan(0);
    });

    it('workflows connect to agents', () => {
      const graph = buildIntelligenceGraph();
      const wfToAgent = graph.edges.filter((e) => {
        const fromNode = graph.nodes.find((n) => n.id === e.from);
        const toNode = graph.nodes.find((n) => n.id === e.to);
        return fromNode?.type === 'workflow' && toNode?.type === 'agent';
      });
      expect(wfToAgent.length).toBeGreaterThan(0);
    });
  });
});
