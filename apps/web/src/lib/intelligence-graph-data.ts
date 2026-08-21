// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Graph Data Builder (SPRINT-055)
//
// Builds the graph data from REAL ecosystem state. No fabricated data.
// Every node corresponds to an actual registered entity.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  GraphNode,
  GraphEdge,
  IntelligenceGraphData,
} from '../components/spatial/IntelligenceGraph.js';

// ── Known ecosystem agents (from SPRINT-050-054 registries) ──────────────────

interface AgentInfo {
  id: string;
  name: string;
  type: 'agent';
  capabilities: string[];
  tools: string[];
  providers: string[];
  status: 'available' | 'disabled';
}

interface WorkflowInfo {
  id: string;
  name: string;
  type: 'workflow';
  steps: number;
  agents: string[];
  approvalGates: number;
  status: 'active' | 'paused' | 'archived';
}

interface ProviderInfo {
  id: string;
  name: string;
  type: 'provider';
  family: string;
  status: 'connected' | 'not_configured' | 'error';
}

// ── Known agents from the ecosystem registry ─────────────────────────────────

const KNOWN_AGENTS: AgentInfo[] = [
  {
    id: 'career-research-agent',
    name: 'Research Agent',
    type: 'agent',
    capabilities: ['reasoning'],
    tools: ['echo', 'current_time'],
    providers: ['openai', 'anthropic', 'google'],
    status: 'available',
  },
  {
    id: 'career-match-agent',
    name: 'Match Agent',
    type: 'agent',
    capabilities: ['reasoning'],
    tools: ['echo'],
    providers: ['openai', 'anthropic', 'google'],
    status: 'available',
  },
  {
    id: 'career-ranking-agent',
    name: 'Ranking Agent',
    type: 'agent',
    capabilities: ['reasoning'],
    tools: ['echo'],
    providers: ['openai', 'anthropic', 'google'],
    status: 'available',
  },
  {
    id: 'career-proposal-agent',
    name: 'Proposal Agent',
    type: 'agent',
    capabilities: ['content_generation'],
    tools: ['echo'],
    providers: ['openai', 'anthropic', 'google'],
    status: 'available',
  },
  {
    id: 'career-verification-agent',
    name: 'Verification Agent',
    type: 'agent',
    capabilities: ['reasoning'],
    tools: ['echo'],
    providers: ['openai', 'anthropic', 'google'],
    status: 'available',
  },
  {
    id: 'research-agent',
    name: 'Research Agent (Multi)',
    type: 'agent',
    capabilities: ['reasoning'],
    tools: ['echo', 'current_time'],
    providers: ['openai', 'anthropic', 'google'],
    status: 'available',
  },
  {
    id: 'analysis-agent',
    name: 'Analysis Agent',
    type: 'agent',
    capabilities: ['reasoning'],
    tools: ['calculator', 'echo'],
    providers: ['openai', 'anthropic', 'google'],
    status: 'available',
  },
  {
    id: 'summary-agent',
    name: 'Summary Agent',
    type: 'agent',
    capabilities: ['content_generation'],
    tools: ['echo'],
    providers: ['openai', 'anthropic', 'google'],
    status: 'available',
  },
  {
    id: 'verification-agent',
    name: 'Verification Agent (Multi)',
    type: 'agent',
    capabilities: ['reasoning'],
    tools: ['echo'],
    providers: ['openai', 'anthropic', 'google'],
    status: 'available',
  },
  {
    id: 'test-agent',
    name: 'Test Agent',
    type: 'agent',
    capabilities: ['TEXT_GENERATION', 'REASONING'],
    tools: [],
    providers: ['openai', 'anthropic', 'google'],
    status: 'available',
  },
];

// ── Known workflows ──────────────────────────────────────────────────────────

const KNOWN_WORKFLOWS: WorkflowInfo[] = [
  {
    id: 'certification-knowledge-summary',
    name: 'Knowledge Summary',
    type: 'workflow',
    steps: 4,
    agents: ['test-agent'],
    approvalGates: 1,
    status: 'active',
  },
  {
    id: 'multi-agent-research-summary',
    name: 'Research & Summary',
    type: 'workflow',
    steps: 5,
    agents: ['research-agent', 'analysis-agent', 'summary-agent', 'verification-agent'],
    approvalGates: 1,
    status: 'active',
  },
  {
    id: 'career-freelance-intelligence',
    name: 'Career Intelligence',
    type: 'workflow',
    steps: 7,
    agents: [
      'career-research-agent',
      'career-match-agent',
      'career-ranking-agent',
      'career-proposal-agent',
      'career-verification-agent',
    ],
    approvalGates: 1,
    status: 'active',
  },
];

// ── Known capabilities (from the AI types) ───────────────────────────────────

const KNOWN_CAPABILITIES = [
  { id: 'reasoning', name: 'Reasoning', category: 'thinking' },
  { id: 'content_generation', name: 'Content Generation', category: 'writing' },
  { id: 'TEXT_GENERATION', name: 'Text Generation', category: 'writing' },
  { id: 'REASONING', name: 'Reasoning', category: 'thinking' },
];

// ── Known tools (from the ToolRuntime) ───────────────────────────────────────

const KNOWN_TOOLS = [
  { id: 'echo', name: 'Echo', category: 'utility' },
  { id: 'current_time', name: 'Current Time', category: 'utility' },
  { id: 'calculator', name: 'Calculator', category: 'utility' },
];

// ── Known providers (from the provider registry) ─────────────────────────────

const KNOWN_PROVIDERS: ProviderInfo[] = [
  { id: 'openai', name: 'OpenAI', type: 'provider', family: 'openai', status: 'not_configured' },
  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'provider',
    family: 'anthropic',
    status: 'not_configured',
  },
  {
    id: 'google',
    name: 'Google Gemini',
    type: 'provider',
    family: 'google',
    status: 'not_configured',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'provider',
    family: 'deepseek',
    status: 'not_configured',
  },
  { id: 'ollama', name: 'Ollama', type: 'provider', family: 'ollama', status: 'not_configured' },
  { id: 'mock', name: 'Mock (Test)', type: 'provider', family: 'mock', status: 'connected' },
];

// ── Graph Builder ────────────────────────────────────────────────────────────

/**
 * Build the intelligence graph from real ecosystem state.
 * This is a COMPOSITION function — no new engines.
 */
export function buildIntelligenceGraph(options?: {
  activeExecution?: IntelligenceGraphData['activeExecution'];
  configuredProviders?: string[];
}): IntelligenceGraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const configuredProviders = new Set(options?.configuredProviders ?? []);

  // ── Layer 0: Brain ─────────────────────────────────────────────
  nodes.push({
    id: 'vedmoulya-brain',
    label: 'VedMoulya',
    type: 'brain',
    status: 'active',
    meta: {
      role: 'Central Intelligence',
      purpose: 'Orchestrate AI capabilities for the founder',
    },
  });

  // ── Layer 1: Workflows ─────────────────────────────────────────
  for (const wf of KNOWN_WORKFLOWS) {
    const isActive = options?.activeExecution?.workflowId === wf.id;
    nodes.push({
      id: wf.id,
      label: wf.name,
      type: 'workflow',
      status: isActive ? 'active' : wf.status === 'active' ? 'available' : 'idle',
      parentId: 'vedmoulya-brain',
      meta: {
        steps: wf.steps,
        agents: wf.agents,
        approvalGates: wf.approvalGates,
      },
    });
    edges.push({ from: 'vedmoulya-brain', to: wf.id, active: isActive });
  }

  // ── Layer 2: Agents ────────────────────────────────────────────
  for (const agent of KNOWN_AGENTS) {
    const isActiveAgent = options?.activeExecution?.agentId === agent.id;
    nodes.push({
      id: agent.id,
      label: agent.name,
      type: 'agent',
      status: isActiveAgent ? 'active' : agent.status === 'available' ? 'available' : 'disabled',
      meta: {
        capabilities: agent.capabilities,
        tools: agent.tools,
        providers: agent.providers,
      },
    });

    // Connect agent to its parent workflow(s)
    const parentWorkflows = KNOWN_WORKFLOWS.filter((wf) => wf.agents.includes(agent.id));
    for (const wf of parentWorkflows) {
      edges.push({ from: wf.id, to: agent.id, active: isActiveAgent });
    }
  }

  // ── Layer 3: Capabilities ──────────────────────────────────────
  const usedCapabilities = new Set<string>();
  for (const agent of KNOWN_AGENTS) {
    for (const cap of agent.capabilities) {
      usedCapabilities.add(cap.toLowerCase());
    }
  }

  for (const cap of KNOWN_CAPABILITIES) {
    if (!usedCapabilities.has(cap.id.toLowerCase())) continue;
    nodes.push({
      id: `cap-${cap.id}`,
      label: cap.name,
      type: 'capability',
      status: 'available',
      meta: { category: cap.category },
    });

    // Connect capability to agents that use it
    for (const agent of KNOWN_AGENTS) {
      if (agent.capabilities.some((c) => c.toLowerCase() === cap.id.toLowerCase())) {
        edges.push({ from: agent.id, to: `cap-${cap.id}` });
      }
    }
  }

  // ── Layer 4: Tools ─────────────────────────────────────────────
  const usedTools = new Set<string>();
  for (const agent of KNOWN_AGENTS) {
    for (const tool of agent.tools) {
      usedTools.add(tool);
    }
  }

  for (const tool of KNOWN_TOOLS) {
    if (!usedTools.has(tool.id)) continue;
    nodes.push({
      id: `tool-${tool.id}`,
      label: tool.name,
      type: 'tool',
      status: 'available',
      meta: { category: tool.category },
    });

    // Connect tool to agents that use it
    for (const agent of KNOWN_AGENTS) {
      if (agent.tools.includes(tool.id)) {
        edges.push({ from: agent.id, to: `tool-${tool.id}` });
      }
    }
  }

  // ── Layer 5: Providers ─────────────────────────────────────────
  for (const provider of KNOWN_PROVIDERS) {
    const isConfigured = configuredProviders.has(provider.id);
    nodes.push({
      id: `provider-${provider.id}`,
      label: provider.name,
      type: 'provider',
      status: isConfigured ? 'available' : provider.id === 'mock' ? 'available' : 'unknown',
      meta: { family: provider.family },
    });

    // Connect provider to agents that prefer it
    for (const agent of KNOWN_AGENTS) {
      if (agent.providers.includes(provider.id)) {
        edges.push({ from: `cap-reasoning`, to: `provider-${provider.id}` });
      }
    }
  }

  return {
    nodes,
    edges,
    activeExecution: options?.activeExecution,
  };
}
