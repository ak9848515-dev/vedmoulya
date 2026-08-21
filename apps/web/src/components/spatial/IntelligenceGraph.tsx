// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Graph (SPRINT-055)
//
// A live visualization of the VedMoulya AI ecosystem. Every node corresponds
// to real system state — agents, workflows, capabilities, tools, providers.
// No decorative fake neural network. No fabricated agent states.
//
// Architecture:
//   BRAIN (center)
//     ↓
//   WORKFLOWS (layer 1)
//     ↓
//   AGENTS (layer 2)
//     ↓
//   CAPABILITIES (layer 3)
//     ↓
//   TOOLS (layer 4)
//     ↓
//   PROVIDERS (layer 5)
//
// State is fetched from the real ecosystem registries. Active execution
// state comes from the real WorkflowExecutionService.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useMemo, useState, useCallback } from 'react';
import {
  Brain,
  Bot,
  Workflow,
  Boxes,
  Wrench,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Clock,
  Pause,
  XCircle,
  Play,
  ChevronRight,
  Eye,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

export type NodeStatus =
  'active' | 'available' | 'idle' | 'waiting' | 'failed' | 'disabled' | 'unknown';

export interface GraphNode {
  id: string;
  label: string;
  type: 'brain' | 'workflow' | 'agent' | 'capability' | 'tool' | 'provider';
  status: NodeStatus;
  /** Parent node id (for hierarchical layout). */
  parentId?: string;
  /** Additional metadata for inspector. */
  meta?: Record<string, string | number | boolean | string[]>;
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  active?: boolean;
}

export interface IntelligenceGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  activeExecution?: {
    workflowId: string;
    workflowName: string;
    currentStep: number;
    totalSteps: number;
    agentId?: string;
    agentName?: string;
    status: string;
    approvalState?: {
      stepId: string;
      stepTitle: string;
      riskLevel: string;
    };
  };
}

// ── Status Styling ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  NodeStatus,
  {
    color: string;
    bgColor: string;
    borderColor: string;
    icon: React.ReactNode;
    label: string;
    pulse: boolean;
  }
> = {
  active: {
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/50',
    icon: <Play className="h-3 w-3" />,
    label: 'ACTIVE',
    pulse: true,
  },
  available: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/50',
    icon: <CheckCircle2 className="h-3 w-3" />,
    label: 'AVAILABLE',
    pulse: false,
  },
  idle: {
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/20',
    borderColor: 'border-slate-500/50',
    icon: <Clock className="h-3 w-3" />,
    label: 'IDLE',
    pulse: false,
  },
  waiting: {
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/50',
    icon: <Pause className="h-3 w-3" />,
    label: 'WAITING',
    pulse: true,
  },
  failed: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/50',
    icon: <XCircle className="h-3 w-3" />,
    label: 'FAILED',
    pulse: false,
  },
  disabled: {
    color: 'text-slate-500',
    bgColor: 'bg-slate-600/20',
    borderColor: 'border-slate-600/50',
    icon: <AlertCircle className="h-3 w-3" />,
    label: 'DISABLED',
    pulse: false,
  },
  unknown: {
    color: 'text-slate-500',
    bgColor: 'bg-slate-700/20',
    borderColor: 'border-slate-700/50',
    icon: <Eye className="h-3 w-3" />,
    label: 'UNKNOWN',
    pulse: false,
  },
};

const TYPE_ICONS: Record<GraphNode['type'], React.ReactNode> = {
  brain: <Brain className="h-4 w-4" />,
  workflow: <Workflow className="h-4 w-4" />,
  agent: <Bot className="h-4 w-4" />,
  capability: <Boxes className="h-4 w-4" />,
  tool: <Wrench className="h-4 w-4" />,
  provider: <Cpu className="h-4 w-4" />,
};

// ── Graph Node Component ─────────────────────────────────────────────────────

function GraphNodeCard({
  node,
  isActive,
  isSelected,
  onClick,
}: {
  node: GraphNode;
  isActive: boolean;
  isSelected: boolean;
  onClick: () => void;
}): React.JSX.Element {
  const config = STATUS_CONFIG[node.status];

  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center gap-2 px-3 py-2 rounded-lg border
        transition-all duration-200 cursor-pointer
        ${config.bgColor} ${config.borderColor}
        ${isSelected ? 'ring-2 ring-blue-500/50' : ''}
        ${isActive ? 'ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/10' : ''}
        hover:scale-[1.02] active:scale-[0.98]
      `}
      aria-label={`${node.label}. Status: ${config.label}. Type: ${node.type}`}
    >
      {/* Pulse indicator for active/waiting */}
      {config.pulse && (
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-current animate-pulse" />
      )}

      {/* Type icon */}
      <span className={config.color}>{TYPE_ICONS[node.type]}</span>

      {/* Label */}
      <span className="text-[12px] font-medium text-[#F8FAFC] truncate max-w-[120px]">
        {node.label}
      </span>

      {/* Status badge */}
      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${config.color} ${config.bgColor}`}>
        {config.label}
      </span>
    </button>
  );
}

// ── Inspector Panel ──────────────────────────────────────────────────────────

function InspectorPanel({
  node,
  onClose,
}: {
  node: GraphNode;
  onClose: () => void;
}): React.JSX.Element {
  const config = STATUS_CONFIG[node.status];

  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={config.color}>{TYPE_ICONS[node.type]}</span>
          <span className="text-[14px] font-semibold text-[#F8FAFC]">{node.label}</span>
        </div>
        <button onClick={onClose} className="text-[#94A3B8] hover:text-[#F8FAFC] text-[12px]">
          ✕
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full ${config.color} ${config.bgColor}`}
        >
          {config.icon} {config.label}
        </span>
        <span className="text-[10px] text-[#94A3B8] capitalize">{node.type}</span>
      </div>

      {node.meta && (
        <div className="space-y-1.5">
          {Object.entries(node.meta).map(([key, value]) => (
            <div key={key} className="flex justify-between text-[11px]">
              <span className="text-[#94A3B8]">{key}</span>
              <span className="text-[#E2E8F0]">
                {Array.isArray(value) ? value.join(', ') : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Active Execution Bar ─────────────────────────────────────────────────────

function ActiveExecutionBar({
  execution,
}: {
  execution: IntelligenceGraphData['activeExecution'];
}): React.JSX.Element | null {
  if (!execution) return null;

  const progress =
    execution.totalSteps > 0 ? Math.round((execution.currentStep / execution.totalSteps) * 100) : 0;

  return (
    <div className="bg-[#0F172A] border border-emerald-500/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[13px] font-semibold text-[#F8FAFC]">{execution.workflowName}</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
          {execution.status}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-[#1E293B] rounded-full h-1.5">
        <div
          className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[#94A3B8]">
          Step {execution.currentStep} / {execution.totalSteps}
        </span>
        {execution.agentName && (
          <span className="text-[#E2E8F0]">
            <Bot className="h-3 w-3 inline mr-1" />
            {execution.agentName}
          </span>
        )}
      </div>

      {execution.approvalState && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
          <div className="flex items-center gap-2">
            <Pause className="h-3 w-3 text-amber-400" />
            <span className="text-[11px] text-amber-400 font-medium">
              WAITING FOR FOUNDER APPROVAL
            </span>
          </div>
          <p className="text-[10px] text-[#94A3B8] mt-1">
            {execution.approvalState.stepTitle} — Risk: {execution.approvalState.riskLevel}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main Graph Component ─────────────────────────────────────────────────────

export interface IntelligenceGraphProps {
  data: IntelligenceGraphData;
  onNodeClick?: (node: GraphNode) => void;
  onWorkflowStart?: (workflowId: string) => void;
  onApprove?: (executionId: string, stepId: string) => void;
  onReject?: (executionId: string, stepId: string) => void;
}

export function IntelligenceGraph({
  data,
  onNodeClick,
}: IntelligenceGraphProps): React.JSX.Element {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      setSelectedNode(node);
      onNodeClick?.(node);
    },
    [onNodeClick],
  );

  // Group nodes by type for layered layout
  const groupedNodes = useMemo(() => {
    const groups: Record<string, GraphNode[]> = {
      brain: [],
      workflow: [],
      agent: [],
      capability: [],
      tool: [],
      provider: [],
    };
    for (const node of data.nodes) {
      groups[node.type]?.push(node);
    }
    return groups;
  }, [data.nodes]);

  // Filter nodes
  const filteredGroups = useMemo(() => {
    if (filter === 'all') return groupedNodes;
    const result: Record<string, GraphNode[]> = {};
    for (const [type, nodes] of Object.entries(groupedNodes)) {
      result[type] = filter === type ? nodes : [];
    }
    return result;
  }, [groupedNodes, filter]);

  // Active nodes (for highlighting)
  const activeNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (data.activeExecution) {
      ids.add(data.activeExecution.workflowId);
      if (data.activeExecution.agentId) {
        ids.add(data.activeExecution.agentId);
      }
    }
    return ids;
  }, [data.activeExecution]);

  const layerLabels: Record<string, string> = {
    brain: 'VEDMOULYA BRAIN',
    workflow: 'WORKFLOWS',
    agent: 'AGENTS',
    capability: 'CAPABILITIES',
    tool: 'TOOLS',
    provider: 'AI PROVIDERS',
  };

  return (
    <div className="space-y-4">
      {/* Active execution bar */}
      <ActiveExecutionBar execution={data.activeExecution} />

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterButton
          label="All"
          active={filter === 'all'}
          onClick={() => {
            setFilter('all');
          }}
        />
        {Object.keys(layerLabels).map((type) => (
          <FilterButton
            key={type}
            label={layerLabels[type] ?? type}
            active={filter === type}
            onClick={() => {
              setFilter(type);
            }}
            icon={TYPE_ICONS[type as GraphNode['type']]}
          />
        ))}
      </div>

      {/* Graph layers */}
      <div className="space-y-3">
        {Object.entries(filteredGroups).map(([type, nodes]) => {
          if (nodes.length === 0 && filter !== 'all') return null;
          return (
            <div key={type} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">
                  {layerLabels[type]}
                </span>
                <span className="text-[9px] text-[#64748B]">({nodes.length})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {nodes.map((node) => (
                  <GraphNodeCard
                    key={node.id}
                    node={node}
                    isActive={activeNodeIds.has(node.id)}
                    isSelected={selectedNode?.id === node.id}
                    onClick={() => {
                      handleNodeClick(node);
                    }}
                  />
                ))}
                {nodes.length === 0 && (
                  <span className="text-[11px] text-[#64748B] italic">No {type}s registered</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Inspector panel */}
      {selectedNode && (
        <InspectorPanel
          node={selectedNode}
          onClose={() => {
            setSelectedNode(null);
          }}
        />
      )}

      {/* Connection lines (visual representation of edges) */}
      {data.edges.length > 0 && (
        <div className="mt-4 p-3 bg-[#0F172A] rounded-lg border border-[#1E293B]">
          <span className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">
            CONNECTIONS ({data.edges.length})
          </span>
          <div className="mt-2 space-y-1">
            {data.edges.slice(0, 10).map((edge, i) => (
              <div key={i} className="flex items-center gap-1 text-[10px]">
                <span className="text-[#E2E8F0]">{edge.from}</span>
                <ChevronRight className="h-3 w-3 text-[#64748B]" />
                <span className="text-[#E2E8F0]">{edge.to}</span>
                {edge.active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>
            ))}
            {data.edges.length > 10 && (
              <span className="text-[9px] text-[#64748B]">
                +{data.edges.length - 10} more connections
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Filter Button ────────────────────────────────────────────────────────────

function FilterButton({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium
        transition-all duration-150
        ${
          active
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
            : 'bg-[#1E293B] text-[#94A3B8] border border-[#334155] hover:bg-[#334155]'
        }
      `}
    >
      {icon}
      {label}
    </button>
  );
}
