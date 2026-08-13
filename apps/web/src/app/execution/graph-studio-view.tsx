// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Execution Explorer: Graph Studio tab
// EPIC-004 / EI-005 — Enterprise Execution Orchestrator
// Extracted from the route page (CERT-002) and lazy-loaded via next/dynamic to
// keep the initial `/execution` page bundle within the 50 kB budget.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Badge, Loading, TextField, Select } from '@vedmoulya/ui';
import {
  Zap,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  GitBranch,
  Layers,
  Map as MapIcon,
  Network,
  ArrowRight,
  ListChecks,
  Wallet,
  Timer,
  RotateCcw,
  CalendarClock,
  FileText,
} from 'lucide-react';
import {
  useExecutionGraph,
  useExecutionGraphExplain,
  useBuildExecutionGraph,
  useValidateExecutionGraph,
  useOptimizeExecutionGraph,
} from '../../lib/api-client.js';
import { BLOG_SEED, NEWSLETTER_SEED, CAPABILITY_LABELS } from './explorer-data.js';
import { ExecutionGraphDiagram } from './components.js';
import type {
  ExecutionGraphDTO,
  ExecutionNodeDTO,
  ExecutionStageDTO,
  ExplainGraphDTO,
  ScheduleResultDTO,
} from '@vedmoulya/execution-orchestrator';

export default function GraphStudioView({ userId }: { userId: string }): React.JSX.Element {
  const [seed, setSeed] = useState('blog');
  const [graphId, setGraphId] = useState('');
  const buildGraph = useBuildExecutionGraph();
  const validateGraph = useValidateExecutionGraph();
  const optimizeGraph = useOptimizeExecutionGraph();
  const { data: graph, isLoading, isError, refetch } = useExecutionGraph(userId, graphId);
  const { data: explanation } = useExecutionGraphExplain(userId, graphId);
  const [optimized, setOptimized] = useState<ScheduleResultDTO | null>(null);
  const [builtGraph, setBuiltGraph] = useState<ExecutionGraphDTO | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);

  const runBuild = (): void => {
    const payload = seed === 'newsletter' ? NEWSLETTER_SEED : BLOG_SEED;
    setBuildError(null);
    setOptimized(null);
    setBuiltGraph(null);
    void buildGraph
      .mutateAsync({ userId, ...payload })
      .then((res) => {
        const data = (res as { data?: ExecutionGraphDTO }).data;
        if (data) {
          setGraphId(data.graphId);
          setBuiltGraph(data);
        }
      })
      .catch((err: unknown) => {
        setBuildError(err instanceof Error ? err.message : 'Could not build the execution graph.');
      });
  };

  const runValidate = (): void => {
    if (!graphId) return;
    setOptimized(null);
    void validateGraph
      .mutateAsync({ userId, graphId })
      .then(() => {
        // The mutation persisted the updated validation on the server; refetch
        // so the ValidationPanel reflects it.
        void refetch();
      })
      .catch(() => undefined);
  };

  const runOptimize = (): void => {
    if (!graphId) return;
    void optimizeGraph
      .mutateAsync({ userId, graphId })
      .then((res) => {
        const data = (res as { data?: ScheduleResultDTO }).data;
        if (data) setOptimized(data);
      })
      .catch(() => undefined);
  };

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Builder */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="flex flex-col lg:flex-row gap-3 items-center">
          <div className="flex-1 min-w-0">
            <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
              Strategy Seed
            </label>
            <Select
              value={seed}
              onChange={(e) => {
                setSeed(e.target.value);
              }}
              aria-label="Strategy seed"
              options={[
                { value: 'blog', label: 'Blog Generation (hybrid · 5 nodes)' },
                { value: 'newsletter', label: 'Newsletter Generation (sequential · 4 nodes)' },
              ]}
            />
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
              Graph ID
            </label>
            <TextField
              value={graphId}
              onChange={(e) => {
                setGraphId(e.target.value);
                setOptimized(null);
                setBuiltGraph(null);
              }}
              placeholder="graph_… (built automatically, or paste one)"
              aria-label="Graph ID"
              leftIcon={<GitBranch className="h-4 w-4 text-[#94A3B8]" />}
            />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <button
              onClick={runBuild}
              disabled={buildGraph.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-[#2B5FD9] text-white hover:bg-[#2450C4] transition-colors disabled:opacity-50"
            >
              <Zap className="h-4 w-4" /> Build Graph
            </button>
            <button
              onClick={runValidate}
              disabled={!graphId || validateGraph.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-[#22C55E] text-white hover:bg-[#16A34A] transition-colors disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" /> Validate
            </button>
            <button
              onClick={runOptimize}
              disabled={!graphId || optimizeGraph.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" /> Optimize
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Badge variant="ai" size="sm" className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Graph only — no AI execution
          </Badge>
          <Badge variant="info" size="sm" className="flex items-center gap-1.5">
            <GitBranch className="h-3 w-3" /> DAG · stages · critical path · checkpoints
          </Badge>
        </div>
        {buildError && <p className="mt-3 text-[13px] text-[#EF4444]">{buildError}</p>}
        {builtGraph && (
          <p className="mt-3 text-[13px] text-[#22C55E]">
            Graph built and stored as <strong>{builtGraph.graphId}</strong>
          </p>
        )}
      </Card>

      {isLoading && graphId && (
        <div className="flex items-center justify-center h-[40vh]">
          <Loading label="Loading execution graph..." size="lg" />
        </div>
      )}

      {isError && (
        <Card variant="standard" padding="lg" className="max-w-md text-center dark:bg-[#1E293B]">
          <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Graph not found
          </h2>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] mt-1">
            Build a graph above, or paste a valid graph ID.
          </p>
        </Card>
      )}

      {graph && (
        <GraphDetail
          graph={graph}
          onReload={() => {
            void refetch();
          }}
        />
      )}
      {optimized && <ScheduleCard schedule={optimized} />}
      {explanation && <GraphExplanationCard explanation={explanation} />}
    </div>
  );
}

function GraphDetail({
  graph,
  onReload,
}: {
  graph: ExecutionGraphDTO;
  onReload: () => void;
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      {/* Header */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
              {graph.goal}
            </h3>
            <p className="text-[12px] text-[#94A3B8] mt-1">
              {graph.graphId} · {graph.strategyId} · v{graph.version}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={graph.validated ? 'success' : 'warning'} size="sm">
              {graph.validated ? 'Validated' : 'Needs validation'}
            </Badge>
            <Badge variant="info" size="sm">
              {String(graph.nodes.length)} nodes · {String(graph.edges.length)} edges
            </Badge>
            <button
              onClick={onReload}
              className="p-2 rounded-lg hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors"
              aria-label="Reload graph"
            >
              <RefreshCw className="h-4 w-4 text-[#64748B] dark:text-[#94A3B8]" />
            </button>
          </div>
        </div>
      </Card>

      {/* Validation */}
      <ValidationPanel graph={graph} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Stages */}
        <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#2B5FD9]" /> Execution Stages
          </h3>
          <div className="space-y-2">
            {graph.stages.map((stage) => (
              <StageRow key={stage.stageId} stage={stage} graph={graph} />
            ))}
            {graph.stages.length === 0 && (
              <p className="text-[13px] text-[#94A3B8]">No stages were derived.</p>
            )}
          </div>
        </Card>

        {/* Critical path */}
        <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
            <MapIcon className="h-4 w-4 text-[#F59E0B]" /> Critical Path
          </h3>
          <div className="space-y-1.5">
            {graph.criticalPath.map((nodeId, idx) => (
              <div key={nodeId} className="flex items-center gap-2">
                {idx > 0 && <ArrowRight className="h-3 w-3 text-[#F59E0B] shrink-0" />}
                <span className="px-2 py-1 rounded-md border border-[#F59E0B]/40 bg-[#FFFBEB] dark:bg-[#78350F]/40 text-[11px] font-medium text-[#D97706]">
                  {graph.nodes.find((n) => n.nodeId === nodeId)?.label ?? nodeId}
                </span>
              </div>
            ))}
            {graph.criticalPath.length === 0 && (
              <p className="text-[13px] text-[#94A3B8]">No critical path computed.</p>
            )}
          </div>
        </Card>

        {/* Parallel groups + checkpoints */}
        <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
            <Network className="h-4 w-4 text-[#0D9488]" /> Parallel Groups &amp; Checkpoints
          </h3>
          <div className="space-y-3">
            {graph.parallelGroups.map((group, idx) => (
              <div key={String(idx)}>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mb-1">
                  Group {idx + 1}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.map((nodeId) => (
                    <span
                      key={nodeId}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F0FDFA] dark:bg-[#134E4A]/40 text-[#0D9488] border border-[#0D9488]/30"
                    >
                      {graph.nodes.find((n) => n.nodeId === nodeId)?.label ?? nodeId}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {graph.parallelGroups.length === 0 && (
              <p className="text-[13px] text-[#94A3B8]">No parallel groups — fully sequential.</p>
            )}
            <div className="pt-2 border-t border-[#F1F5F9] dark:border-[#334155]">
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mb-1">
                Checkpoints ({String(graph.checkpoints.length)})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {graph.checkpoints.map((cp) => (
                  <span
                    key={cp.checkpointId}
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F5F3FF] dark:bg-[#4C1D95]/40 text-[#7C3AED] border border-[#7C3AED]/30"
                  >
                    {graph.nodes.find((n) => n.nodeId === cp.nodeId)?.label ?? cp.nodeId}
                  </span>
                ))}
                {graph.checkpoints.length === 0 && (
                  <p className="text-[12px] text-[#94A3B8]">No checkpoints inserted.</p>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Graph diagram */}
      <ExecutionGraphDiagram graph={graph} />

      {/* Node table */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-[#2B5FD9]" /> Nodes &amp; Budgets
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {graph.nodes.map((node) => (
            <NodeBudgetRow key={node.nodeId} node={node} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function StageRow({
  stage,
  graph,
}: {
  stage: ExecutionStageDTO;
  graph: ExecutionGraphDTO;
}): React.JSX.Element {
  return (
    <div className="p-2.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC]">
          {stage.order}. {stage.name}
        </span>
        <span className="text-[10px] text-[#94A3B8]">{String(stage.nodeIds.length)} nodes</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {stage.nodeIds.map((nodeId) => (
          <span
            key={nodeId}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[#2B5FD9] border border-[#2B5FD9]/30"
          >
            {graph.nodes.find((n) => n.nodeId === nodeId)?.label ?? nodeId}
          </span>
        ))}
      </div>
    </div>
  );
}

function NodeBudgetRow({ node }: { node: ExecutionNodeDTO }): React.JSX.Element {
  return (
    <div className="p-2.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC]">
          {node.label}
        </span>
        <span className="text-[10px] text-[#94A3B8]">priority {node.priority}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[#64748B] dark:text-[#94A3B8]">
        <span className="px-1.5 py-0.5 rounded bg-[#F5F3FF] dark:bg-[#4C1D95]/40 text-[#7C3AED]">
          {CAPABILITY_LABELS[node.capability] ?? node.capability}
        </span>
        <span className="inline-flex items-center gap-1">
          <Wallet className="h-3 w-3" /> ${node.budget.maxCostUsd.toFixed(2)} ·{' '}
          {node.budget.expectedTokens.toLocaleString()} tok
        </span>
        <span className="inline-flex items-center gap-1">
          <Timer className="h-3 w-3" /> {node.timeoutMs}ms
        </span>
        <span className="inline-flex items-center gap-1">
          <RotateCcw className="h-3 w-3" /> {node.retryPolicy.maxRetries} retries
        </span>
      </div>
    </div>
  );
}

function ValidationPanel({ graph }: { graph: ExecutionGraphDTO }): React.JSX.Element {
  const passed = graph.validation.passed;
  return (
    <Card
      variant="standard"
      padding="md"
      className={`dark:bg-[#1E293B] dark:border-[#334155] ${passed ? 'border-l-4 border-l-[#22C55E]' : 'border-l-4 border-l-[#F59E0B]'}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className={`h-4 w-4 ${passed ? 'text-[#22C55E]' : 'text-[#F59E0B]'}`} />
        <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          Graph Validation {passed ? 'Passed' : 'Issues Found'}
        </h3>
        <Badge variant={passed ? 'success' : 'warning'} size="sm">
          {String(graph.validation.checks.filter((c) => c.passed).length)}/
          {String(graph.validation.checks.length)} checks
        </Badge>
      </div>
      <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] mb-2">
        {graph.validation.summary}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {graph.validation.checks.map((check) => (
          <div key={check.check} className="flex items-center gap-2 text-[12px]">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${check.passed ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'}`}
            />
            <span className="text-[#64748B] dark:text-[#94A3B8] truncate">
              {check.check}: {check.detail}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ScheduleCard({ schedule }: { schedule: ScheduleResultDTO }): React.JSX.Element {
  return (
    <Card
      variant="standard"
      padding="md"
      className="dark:bg-[#1E293B] dark:border-[#334155] border-l-4 border-l-[#7C3AED]"
    >
      <div className="flex items-center gap-2 mb-2">
        <CalendarClock className="h-4 w-4 text-[#7C3AED]" />
        <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          Optimized Schedule
        </h3>
      </div>
      <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] mb-3">{schedule.description}</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {schedule.order.map((nodeId) => (
          <span
            key={nodeId}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F5F3FF] dark:bg-[#4C1D95]/40 text-[#7C3AED] border border-[#7C3AED]/30"
          >
            {nodeId}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {schedule.entries.map((entry) => (
          <div
            key={entry.entryId}
            className="p-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-[#111827] dark:text-[#F8FAFC] truncate">
                {entry.nodeId}
              </span>
              <Badge variant={entry.kind === 'priority' ? 'warning' : 'info'} size="sm">
                {entry.kind}
              </Badge>
            </div>
            <p className="text-[10px] text-[#94A3B8] mt-1">
              priority {entry.priority} · attempts {String(entry.attempts)}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function GraphExplanationCard({
  explanation,
}: {
  explanation: ExplainGraphDTO;
}): React.JSX.Element {
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
      <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-[#2B5FD9]" /> Graph Explanation
      </h3>
      <div className="space-y-2 text-[13px]">
        {[
          { label: 'Goal', value: explanation.goal },
          { label: 'Nodes', value: explanation.nodeSummary },
          { label: 'Edges', value: explanation.edgeSummary },
          { label: 'Stages', value: explanation.stageSummary },
          { label: 'Parallelism', value: explanation.parallelSummary },
          { label: 'Critical path', value: explanation.criticalPathSummary },
          { label: 'Checkpoints', value: explanation.checkpointSummary },
          { label: 'Validation', value: explanation.validationSummary },
        ].map((row) => (
          <p key={row.label} className="text-[#64748B] dark:text-[#94A3B8]">
            <strong className="text-[#111827] dark:text-[#F8FAFC]">{row.label}:</strong> {row.value}
          </p>
        ))}
      </div>
    </Card>
  );
}
