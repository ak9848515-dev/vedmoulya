// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Execution OpenAPI metadata unit tests
// BLD-009 — Execution Intelligence Engine
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { executionOpenApiSchema } from '../ExecutionOpenAPI.js';

describe('executionOpenApiSchema', () => {
  it('declares OpenAPI 3.1 metadata', () => {
    expect(executionOpenApiSchema.openapi).toBe('3.1.0');
    expect(executionOpenApiSchema.info.title).toContain('Execution');
    expect(executionOpenApiSchema.info.version).toBe('0.1.0');
  });

  it('documents the plan CRUD endpoints', () => {
    const paths = executionOpenApiSchema.paths as Record<
      string,
      { get?: unknown; post?: unknown; patch?: unknown }
    >;
    expect(paths['/api/v1/execution/plans'].post).toBeDefined();
    expect(paths['/api/v1/execution/plans'].get).toBeDefined();
    expect(paths['/api/v1/execution/plans/{id}'].get).toBeDefined();
    expect(paths['/api/v1/execution/plans/{id}'].patch).toBeDefined();
  });

  it('documents lifecycle endpoints', () => {
    const paths = executionOpenApiSchema.paths as Record<
      string,
      { post?: { operationId: string } }
    >;
    expect(paths['/api/v1/execution/plans/{id}/activate'].post.operationId).toBe('activatePlan');
    expect(paths['/api/v1/execution/plans/{id}/start'].post.operationId).toBe('startPlan');
    expect(paths['/api/v1/execution/plans/{id}/pause'].post.operationId).toBe('pausePlan');
    expect(paths['/api/v1/execution/plans/{id}/resume'].post.operationId).toBe('resumePlan');
    expect(paths['/api/v1/execution/plans/{id}/complete'].post.operationId).toBe('completePlan');
    expect(paths['/api/v1/execution/plans/{id}/cancel'].post.operationId).toBe('cancelPlan');
  });

  it('documents mission, task, schedule, and recovery endpoints', () => {
    const paths = executionOpenApiSchema.paths as Record<
      string,
      { post?: { operationId: string } }
    >;
    expect(paths['/api/v1/execution/plans/{id}/missions'].post.operationId).toBe('addMission');
    expect(paths['/api/v1/execution/plans/{id}/tasks'].post.operationId).toBe('addTask');
    expect(paths['/api/v1/execution/plans/{id}/tasks/{taskId}/complete'].post.operationId).toBe(
      'completeTask',
    );
    expect(paths['/api/v1/execution/plans/{id}/schedule'].post.operationId).toBe('scheduleTasks');
    expect(paths['/api/v1/execution/plans/{id}/recover'].post.operationId).toBe('recoverPlan');
  });

  it('documents analysis, search, stats, and health endpoints', () => {
    const paths = executionOpenApiSchema.paths as Record<string, { get?: { operationId: string } }>;
    expect(paths['/api/v1/execution/plans/{id}/bottlenecks'].get.operationId).toBe(
      'analyzeBottlenecks',
    );
    expect(paths['/api/v1/execution/plans/search'].get.operationId).toBe('searchPlans');
    expect(paths['/api/v1/execution/plans/stats'].get.operationId).toBe('getExecutionStats');
    expect(paths['/api/v1/execution/health'].get.operationId).toBe('executionHealth');
  });

  it('createPlan documents request body and responses', () => {
    const createPlan = (
      executionOpenApiSchema.paths as Record<string, { post?: Record<string, unknown> }>
    )['/api/v1/execution/plans'].post;
    expect(createPlan?.requestBody).toBeDefined();
    const responses = createPlan?.responses as Record<string, unknown>;
    expect(responses['201']).toBeDefined();
    expect(responses['400']).toBeDefined();
  });
});
