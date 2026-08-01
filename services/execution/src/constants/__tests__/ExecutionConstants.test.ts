// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Execution Constants unit tests
// BLD-009 — Execution Intelligence Engine
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  PLANNING_LEVELS,
  EXECUTION_STATUS_VALUES,
  PRIORITY_LEVELS,
  RESULT_VALUES,
  DEPENDENCY_TYPES,
  STRATEGY_TYPES,
  POLICY_DOMAINS,
  POLICY_SEVERITIES,
  EXECUTION_EVENT_TYPES,
  PAGINATION,
  ID_PREFIX,
  CACHE_PREFIX,
  API_PATHS,
  EXTERNAL_API_PATHS,
} from '../ExecutionConstants.js';

describe('ExecutionConstants', () => {
  it('defines the four planning levels', () => {
    expect(PLANNING_LEVELS).toEqual(['strategic', 'tactical', 'operational', 'daily']);
  });

  it('defines the execution status values', () => {
    expect(EXECUTION_STATUS_VALUES).toContain('pending');
    expect(EXECUTION_STATUS_VALUES).toContain('in_progress');
    expect(EXECUTION_STATUS_VALUES).toContain('completed');
    expect(EXECUTION_STATUS_VALUES).toContain('failed');
    expect(EXECUTION_STATUS_VALUES).toHaveLength(9);
  });

  it('defines priority levels', () => {
    expect(PRIORITY_LEVELS).toEqual(['critical', 'high', 'medium', 'low', 'optional']);
  });

  it('defines result values', () => {
    expect(RESULT_VALUES).toEqual(['success', 'partial', 'failed', 'skipped', 'unknown']);
  });

  it('defines dependency and strategy types', () => {
    expect(DEPENDENCY_TYPES).toEqual([
      'finish_to_start',
      'start_to_start',
      'finish_to_finish',
      'start_to_finish',
    ]);
    expect(STRATEGY_TYPES).toContain('linear');
    expect(STRATEGY_TYPES).toContain('hybrid');
    expect(STRATEGY_TYPES).toContain('opportunistic');
  });

  it('defines policy domains and severities', () => {
    expect(POLICY_DOMAINS).toContain('execution');
    expect(POLICY_DOMAINS).toContain('recovery');
    expect(POLICY_SEVERITIES).toEqual(['critical', 'high', 'medium', 'low']);
  });

  it('defines execution event types including lifecycle events', () => {
    expect(EXECUTION_EVENT_TYPES).toContain('plan.created');
    expect(EXECUTION_EVENT_TYPES).toContain('plan.started');
    expect(EXECUTION_EVENT_TYPES).toContain('plan.completed');
    expect(EXECUTION_EVENT_TYPES).toContain('plan.failed');
    expect(EXECUTION_EVENT_TYPES).toContain('task.created');
    expect(EXECUTION_EVENT_TYPES).toContain('task.completed');
    expect(EXECUTION_EVENT_TYPES).toContain('plan.recovery_initiated');
  });

  it('defines pagination defaults', () => {
    expect(PAGINATION.DEFAULT_PAGE).toBe(1);
    expect(PAGINATION.DEFAULT_LIMIT).toBe(20);
    expect(PAGINATION.MAX_LIMIT).toBe(100);
  });

  it('defines ID prefixes', () => {
    expect(ID_PREFIX.PLAN).toBe('plan_');
    expect(ID_PREFIX.MISSION).toBe('mis_');
    expect(ID_PREFIX.TASK).toBe('task_');
    expect(ID_PREFIX.STEP).toBe('step_');
  });

  it('defines cache prefixes', () => {
    expect(CACHE_PREFIX.PLAN).toBe('exec:plan:');
    expect(CACHE_PREFIX.STATS).toBe('exec:stats:');
  });

  it('defines API paths', () => {
    expect(API_PATHS.BASE).toBe('/api/v1/execution');
    expect(API_PATHS.PLANS).toBe('/plans');
    expect(API_PATHS.HEALTH).toBe('/health');
  });

  it('defines external API paths', () => {
    expect(EXTERNAL_API_PATHS.KNOWLEDGE.SEARCH).toBe('/api/v1/knowledge/search');
    expect(EXTERNAL_API_PATHS.MEMORY.CAPTURE).toBe('/api/v1/memory/capture');
    expect(EXTERNAL_API_PATHS.ORCHESTRATOR.CAPABILITY).toBe('/api/v1/orchestrator/capability');
    expect(EXTERNAL_API_PATHS.DECISION.GET).toBe('/api/v1/decision/decisions');
  });
});
