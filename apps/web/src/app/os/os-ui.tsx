// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System Dashboard: shared UI helpers
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// Engine/status palettes + formatting helpers shared by the OS dashboard views.
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   the only indexed accesses are typed Record lookups keyed by the closed
   OSEngineId / status unions (ENGINE_COLORS[engine], STATUS_STYLES[status]) —
   no runtime attacker-controlled keys. */

import type {
  OSDiagnosticSeverity,
  OSEngineHealthStatus,
  OSEngineId,
  OSPipelineStageStatus,
} from '@vedmoulya/os-intelligence';
import { OS_ENGINE_IDS } from '@vedmoulya/os-intelligence';

/** Engine status → badge/tint palette. */
export const STATUS_STYLES: Record<OSEngineHealthStatus, string> = {
  healthy: 'bg-[#22C55E] text-white',
  degraded: 'bg-[#F59E0B] text-white',
  unhealthy: 'bg-[#EF4444] text-white',
  unknown: 'bg-[#94A3B8] text-white',
};

/** Pipeline stage status → palette. */
export const STAGE_STYLES: Record<OSPipelineStageStatus, string> = {
  passed: 'bg-[#22C55E] text-white',
  not_started: 'bg-[#94A3B8] text-white',
  failed: 'bg-[#EF4444] text-white',
  skipped: 'bg-[#64748B] text-white',
};

/** Diagnostic severity → palette. */
export const SEVERITY_STYLES: Record<OSDiagnosticSeverity, string> = {
  info: 'bg-[#3B82F6] text-white',
  warning: 'bg-[#F59E0B] text-white',
  critical: 'bg-[#EF4444] text-white',
};

/** Per-engine accent colors (11 engines). */
export const ENGINE_COLORS: Partial<Record<OSEngineId, string>> = {
  goals: '#2B5FD9',
  capabilities: '#8B5CF6',
  providers: '#F59E0B',
  context: '#06B6D4',
  strategy: '#F97316',
  orchestrator: '#22C55E',
  intelligence: '#7C3AED',
  learning: '#84CC16',
  brain: '#0D9488',
  knowledge: '#3B82F6',
  memory: '#EC4899',
};

export const ENGINE_LABELS: Record<OSEngineId, string> = {
  goals: 'Goals & Tasks',
  capabilities: 'Capabilities',
  providers: 'Providers',
  context: 'Context',
  strategy: 'Strategy',
  orchestrator: 'Orchestrator',
  intelligence: 'Intelligence',
  learning: 'Learning',
  brain: 'Brain',
  knowledge: 'Knowledge',
  memory: 'Memory',
};

export const ENGINE_IDS: readonly OSEngineId[] = OS_ENGINE_IDS;

/** "EI-006 / goals" → "EI-006" (the delivering sprint). */
export function sprintOf(engine: OSEngineId): string {
  return (
    {
      goals: 'EI-006',
      capabilities: 'EI-001',
      providers: 'EI-002',
      context: 'EI-003',
      strategy: 'EI-004',
      orchestrator: 'EI-005',
      intelligence: 'EI-006',
      learning: 'EI-007',
      brain: 'EI-008',
      knowledge: 'EI-009',
      memory: 'EI-010',
    } as Record<OSEngineId, string>
  )[engine];
}

/** ISO string → compact local time. */
export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** ISO string → short date + time. */
export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** 0-100 score → color (green ≥ 85, amber ≥ 60, red below). */
export function scoreColor(score: number): string {
  if (score >= 85) return '#22C55E';
  if (score >= 60) return '#F59E0B';
  return '#EF4444';
}

/** ms → human latency label. */
export function latencyLabel(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}
