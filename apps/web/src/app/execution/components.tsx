// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Execution Explorer: graph layout + diagram components
// EPIC-004 / EI-005 — Enterprise Execution Orchestrator
// Storybook-exported components that previously lived in the route page.
// Route pages may only export `default` + reserved Next.js fields, so the
// graph helpers live here and the page + stories import them.
// ─────────────────────────────────────────────────────────────────────────────

import type React from 'react';
import { Card } from '@vedmoulya/ui';
import { Network } from 'lucide-react';
import type { ExecutionGraphDTO, ExecutionNodeDTO } from '@vedmoulya/execution-orchestrator';
import { CAPABILITY_LABELS } from './explorer-data.js';

// ── Display Maps ────────────────────────────────────────────────────────────

export const NODE_STATUS_STYLE: Record<string, string> = {
  pending:
    'bg-[#F8FAFC] dark:bg-[#0F172A] border-[#E2E8F0] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8]',
  ready: 'bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 border-[#2B5FD9]/40 text-[#2B5FD9]',
  running: 'bg-[#F5F3FF] dark:bg-[#4C1D95]/40 border-[#7C3AED]/40 text-[#7C3AED]',
  completed: 'bg-[#F0FDF4] dark:bg-[#14532D]/40 border-[#22C55E]/40 text-[#16A34A]',
  failed: 'bg-[#FEF2F2] dark:bg-[#450A0A]/40 border-[#EF4444]/40 text-[#EF4444]',
  retrying: 'bg-[#FFFBEB] dark:bg-[#78350F]/40 border-[#F59E0B]/40 text-[#D97706]',
  blocked: 'bg-[#FEF2F2] dark:bg-[#450A0A]/40 border-[#EF4444]/40 text-[#EF4444]',
  skipped: 'bg-[#F1F5F9] dark:bg-[#1E293B] border-[#CBD5E1] dark:border-[#475569] text-[#94A3B8]',
  cancelled: 'bg-[#F1F5F9] dark:bg-[#1E293B] border-[#CBD5E1] dark:border-[#475569] text-[#94A3B8]',
};

const EDGE_COLOR: Record<string, string> = {
  sequential: '#94A3B8',
  parallel: '#2B5FD9',
  conditional: '#7C3AED',
  merge: '#0D9488',
  split: '#2B5FD9',
  retry: '#F59E0B',
  failure: '#EF4444',
};

const EDGE_LABEL: Record<string, string> = {
  sequential: 'Sequential',
  parallel: 'Parallel',
  conditional: 'Conditional',
  merge: 'Merge',
  split: 'Split',
  retry: 'Retry',
  failure: 'Failure',
};

// ── Graph Layout Helpers ────────────────────────────────────────────────────

interface NodePosition {
  x: number;
  y: number;
}

/** Lay out nodes into stage columns (fallback column for un-staged nodes). */
export function layoutGraphNodes(graph: Pick<ExecutionGraphDTO, 'nodes' | 'stages'>): {
  positions: Record<string, NodePosition>;
  width: number;
  height: number;
} {
  const NODE_W = 210;
  const NODE_H = 84;
  const COL_GAP = 60;
  const ROW_GAP = 24;

  const columnOf: Record<string, number> = {};
  graph.stages.forEach((stage, idx) => {
    stage.nodeIds.forEach((nodeId) => {
      columnOf[nodeId] = idx;
    });
  });
  // Un-staged nodes land in a trailing column.
  const used = new Set(Object.values(columnOf));
  let fallbackCol = used.size;
  const staged = new Set(graph.stages.flatMap((s) => s.nodeIds));
  graph.nodes.forEach((node) => {
    if (!staged.has(node.nodeId) && columnOf[node.nodeId] === undefined) {
      columnOf[node.nodeId] = fallbackCol;
      fallbackCol += 1;
    }
  });

  const rowOf: Record<string, number> = {};
  const colCounts: Record<number, number> = {};
  graph.nodes.forEach((node) => {
    const col = columnOf[node.nodeId] ?? 0;
    const row = colCounts[col] ?? 0;
    colCounts[col] = row + 1;
    rowOf[node.nodeId] = row;
  });

  const positions: Record<string, NodePosition> = {};
  graph.nodes.forEach((node) => {
    const col = columnOf[node.nodeId] ?? 0;
    positions[node.nodeId] = {
      x: col * (NODE_W + COL_GAP),
      y: (rowOf[node.nodeId] ?? 0) * (NODE_H + ROW_GAP),
    };
  });

  const cols = Math.max(1, ...Object.values(columnOf).map((c) => c + 1));
  const rows = Math.max(1, ...Object.values(rowOf).map((r) => r + 1));
  return {
    positions,
    width: cols * (NODE_W + COL_GAP) - COL_GAP + 40,
    height: rows * (NODE_H + ROW_GAP) - ROW_GAP + 40,
  };
}

// ── Graph Diagram ───────────────────────────────────────────────────────────

export function ExecutionGraphDiagram({ graph }: { graph: ExecutionGraphDTO }): React.JSX.Element {
  const { positions, width, height } = layoutGraphNodes(graph);
  const nodeWidth = 210;
  const nodeHeight = 84;
  const byId = new Map<string, ExecutionNodeDTO>(graph.nodes.map((n) => [n.nodeId, n]));
  const critical = new Set(graph.criticalPath);

  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] flex items-center gap-2">
          <Network className="h-4 w-4 text-[#2B5FD9]" /> Graph View
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#64748B] dark:text-[#94A3B8]">
          {Object.entries(EDGE_COLOR).map(([type, color]) => (
            <span key={type} className="inline-flex items-center gap-1">
              <span className="w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
              {EDGE_LABEL[type] ?? type}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div style={{ minWidth: width }} className="relative">
          <svg width={width} height={height} className="block" aria-hidden="true">
            {graph.edges.map((edge) => {
              const from = positions[edge.from];
              const to = positions[edge.to];
              if (!from || !to) return null;
              const x1 = from.x + nodeWidth;
              const y1 = from.y + nodeHeight / 2;
              const x2 = to.x;
              const y2 = to.y + nodeHeight / 2;
              const mx = (x1 + x2) / 2;
              const isCritical = critical.has(edge.from) && critical.has(edge.to);
              return (
                <path
                  key={edge.edgeId}
                  d={`M ${String(x1)} ${String(y1)} C ${String(mx)} ${String(y1)}, ${String(mx)} ${String(y2)}, ${String(x2)} ${String(y2)}`}
                  fill="none"
                  stroke={isCritical ? '#F59E0B' : (EDGE_COLOR[edge.type] ?? '#94A3B8')}
                  strokeWidth={isCritical ? 2.5 : 1.5}
                  strokeDasharray={
                    edge.type === 'retry' || edge.type === 'failure' ? '5 3' : undefined
                  }
                  opacity={0.9}
                />
              );
            })}
          </svg>

          {graph.nodes.map((node) => {
            const pos = positions[node.nodeId];
            if (!pos) return null;
            const onCritical = critical.has(node.nodeId);
            return (
              <div
                key={node.nodeId}
                className={`absolute rounded-xl border bg-white dark:bg-[#0F172A] p-3 shadow-sm transition-transform hover:scale-[1.03] ${NODE_STATUS_STYLE[node.status] ?? 'border-[#E2E8F0] dark:border-[#334155]'} ${onCritical ? 'ring-2 ring-[#F59E0B]/50' : ''}`}
                style={{ left: pos.x, top: pos.y, width: nodeWidth, height: nodeHeight }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC] truncate">
                    {node.label}
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8]">
                    P{String(node.priority)}
                  </span>
                </div>
                <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] mt-0.5 truncate">
                  {CAPABILITY_LABELS[node.capability] ?? node.capability}
                </p>
                <p className="text-[9px] text-[#94A3B8] mt-1 truncate">
                  ${node.budget.maxCostUsd.toFixed(2)} ·{' '}
                  {node.budget.expectedTokens.toLocaleString()} tok · {String(node.timeoutMs)}ms
                </p>
                {onCritical && (
                  <span className="absolute top-1.5 right-1.5 text-[9px] font-bold text-[#F59E0B]">
                    ★
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Dependency list (compact / accessible view) */}
      <div className="mt-3 pt-3 border-t border-[#F1F5F9] dark:border-[#334155]">
        <p className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-2">
          Dependencies
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[11px]">
          {graph.nodes.map((node) => (
            <p key={node.nodeId} className="truncate text-[#64748B] dark:text-[#94A3B8]">
              <span className="font-medium text-[#111827] dark:text-[#F8FAFC]">
                {byId.get(node.nodeId)?.label ?? node.nodeId}
              </span>{' '}
              →{' '}
              {node.dependencies.length > 0
                ? node.dependencies.map((d) => byId.get(d)?.label ?? d).join(', ')
                : 'none'}
            </p>
          ))}
        </div>
      </div>
    </Card>
  );
}
