// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Execution Explorer Stories
// EI-005 — Enterprise Execution Orchestrator
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { ExecutionGraphDiagram } from '../app/execution/components.js';
import { WorkerCard } from '../app/execution/workers-view.js';
import type { ExecutionGraphDTO, ExecutionWorkerDTO } from '@vedmoulya/execution-orchestrator';

const graph: ExecutionGraphDTO = {
  graphId: 'graph_demo_001',
  strategyId: 'strategy_blog_seed',
  goalId: 'goal_blog_001',
  goal: 'Generate a blog post about microservices architecture',
  nodes: [
    {
      nodeId: 'node_research',
      capability: 'reasoning',
      providerCandidates: ['anthropic', 'openai', 'google'],
      contextReference: ['knowledge_base', 'conversation_memory'],
      priority: 1,
      dependencies: [],
      retryPolicy: { maxRetries: 2, retryDelayMs: 1000 },
      timeoutMs: 30000,
      budget: { expectedTokens: 2000, maxCostUsd: 0.5, expectedLatencyMs: 5000 },
      metadata: { flowType: 'sequential' },
      status: 'completed',
      label: 'Research',
    },
    {
      nodeId: 'node_writing',
      capability: 'content_generation',
      providerCandidates: ['anthropic', 'openai', 'google'],
      contextReference: ['knowledge_base'],
      priority: 2,
      dependencies: ['node_research'],
      retryPolicy: { maxRetries: 2, retryDelayMs: 1000 },
      timeoutMs: 30000,
      budget: { expectedTokens: 3000, maxCostUsd: 0.8, expectedLatencyMs: 8000 },
      metadata: { flowType: 'sequential' },
      status: 'running',
      label: 'Writing',
    },
    {
      nodeId: 'node_seo',
      capability: 'classification',
      providerCandidates: ['openai', 'deepseek'],
      contextReference: [],
      priority: 3,
      dependencies: ['node_writing'],
      retryPolicy: { maxRetries: 1, retryDelayMs: 500 },
      timeoutMs: 15000,
      budget: { expectedTokens: 1000, maxCostUsd: 0.2, expectedLatencyMs: 3000 },
      metadata: { flowType: 'parallel' },
      status: 'ready',
      label: 'SEO',
    },
    {
      nodeId: 'node_review',
      capability: 'reasoning',
      providerCandidates: ['anthropic', 'openai'],
      contextReference: [],
      priority: 3,
      dependencies: ['node_writing'],
      retryPolicy: { maxRetries: 2, retryDelayMs: 1000 },
      timeoutMs: 20000,
      budget: { expectedTokens: 1500, maxCostUsd: 0.4, expectedLatencyMs: 6000 },
      metadata: { flowType: 'parallel' },
      status: 'ready',
      label: 'Review',
    },
    {
      nodeId: 'node_publishing',
      capability: 'content_generation',
      providerCandidates: ['openai'],
      contextReference: [],
      priority: 4,
      dependencies: ['node_seo', 'node_review'],
      retryPolicy: { maxRetries: 1, retryDelayMs: 2000 },
      timeoutMs: 20000,
      budget: { expectedTokens: 1000, maxCostUsd: 0.2, expectedLatencyMs: 4000 },
      metadata: { flowType: 'sequential' },
      status: 'pending',
      label: 'Publishing',
    },
  ],
  edges: [
    { edgeId: 'edge_1', from: 'node_research', to: 'node_writing', type: 'sequential' },
    { edgeId: 'edge_2', from: 'node_writing', to: 'node_seo', type: 'split' },
    { edgeId: 'edge_3', from: 'node_writing', to: 'node_review', type: 'split' },
    { edgeId: 'edge_4', from: 'node_seo', to: 'node_publishing', type: 'merge' },
    { edgeId: 'edge_5', from: 'node_review', to: 'node_publishing', type: 'merge' },
  ],
  stages: [
    {
      stageId: 'stage_1',
      name: 'Stage 1 — Research',
      nodeIds: ['node_research'],
      order: 1,
      status: 'completed',
    },
    {
      stageId: 'stage_2',
      name: 'Stage 2 — Draft',
      nodeIds: ['node_writing'],
      order: 2,
      status: 'running',
    },
    {
      stageId: 'stage_3',
      name: 'Stage 3 — Parallel (SEO · Review)',
      nodeIds: ['node_seo', 'node_review'],
      order: 3,
      status: 'ready',
    },
    {
      stageId: 'stage_4',
      name: 'Stage 4 — Publish',
      nodeIds: ['node_publishing'],
      order: 4,
      status: 'pending',
    },
  ],
  parallelGroups: [['node_seo', 'node_review']],
  criticalPath: ['node_research', 'node_writing', 'node_review', 'node_publishing'],
  validated: true,
  validation: {
    passed: true,
    checks: [
      { check: 'DAG — no cycles', passed: true, detail: '5 nodes, 5 edges, no cycles detected' },
      { check: 'Edges reference nodes', passed: true, detail: 'All edge endpoints resolve' },
      {
        check: 'Dependencies resolvable',
        passed: true,
        detail: 'All dependencies exist in the graph',
      },
      { check: 'Budgets finite', passed: true, detail: 'Max cost $2.00, tokens 8000' },
      { check: 'Stages cover all nodes', passed: true, detail: '5/5 nodes staged' },
      { check: 'Critical path resolves', passed: true, detail: '4 nodes on the critical path' },
    ],
    summary: 'Execution graph is valid and ready for scheduling.',
  },
  checkpoints: [
    {
      checkpointId: 'cp_1',
      nodeId: 'node_research',
      completedNodeIds: ['node_research'],
      createdAt: '2026-08-04T09:00:00.000Z',
    },
  ],
  createdAt: '2026-08-04T09:00:00.000Z',
  version: '1.0.0',
};

const worker: ExecutionWorkerDTO = {
  workerId: 'worker_writing_02',
  kind: 'writing',
  name: 'Writing Worker',
  capabilities: ['content_generation'],
  concurrency: 3,
  activeTasks: 2,
  status: 'busy',
  health: 0.97,
};

const idleWorker: ExecutionWorkerDTO = {
  ...worker,
  workerId: 'worker_writing_01',
  activeTasks: 0,
  status: 'idle',
  health: 0.95,
};

const metaDiagram: Meta<typeof ExecutionGraphDiagram> = {
  title: 'Explorer/ExecutionGraphDiagram',
  component: ExecutionGraphDiagram,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Stage-column diagram of an execution graph: nodes with status/priority/budget, typed edges, critical path highlight, and a compact dependency list.',
      },
    },
  },
};

export default metaDiagram;

type DiagramStory = StoryObj<typeof ExecutionGraphDiagram>;
type WorkerStory = StoryObj<typeof WorkerCard>;

export const BlogGraph: DiagramStory = {
  args: { graph },
};

const metaWorker: Meta<typeof WorkerCard> = {
  title: 'Explorer/WorkerCard',
  component: WorkerCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Displays a platform execution worker: capabilities, status, load, and health.',
      },
    },
  },
};

export const WorkerBusy: WorkerStory = {
  args: { worker },
};

export const WorkerIdle: WorkerStory = {
  args: { worker: idleWorker },
  parameters: {
    docs: {
      description: { story: 'An idle worker with zero active tasks.' },
    },
  },
};

export { metaWorker };
