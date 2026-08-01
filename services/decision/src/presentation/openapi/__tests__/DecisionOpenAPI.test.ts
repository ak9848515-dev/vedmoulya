// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Decision OpenAPI Schema Tests
// Validates the OpenAPI metadata surface for the Decision Engine API.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { decisionOpenApiSchema } from '../DecisionOpenAPI.js';

describe('decisionOpenApiSchema', () => {
  it('declares the OpenAPI version and service info', () => {
    expect(decisionOpenApiSchema.openapi).toBe('3.1.0');
    expect(decisionOpenApiSchema.info.title).toBe('Decision Intelligence Engine API');
    expect(decisionOpenApiSchema.info.version).toBe('0.1.0');
    expect(decisionOpenApiSchema.info.description).toContain('Decision Engine REST API');
  });

  it('documents the core CRUD paths', () => {
    const paths = decisionOpenApiSchema.paths;
    expect(paths['/api/v1/decision/decisions'].post.operationId).toBe('createDecision');
    expect(paths['/api/v1/decision/decisions'].get.operationId).toBe('listDecisions');
    expect(paths['/api/v1/decision/decisions/{id}'].get.operationId).toBe('getDecision');
    expect(paths['/api/v1/decision/decisions/{id}'].patch.operationId).toBe('updateDecision');
    expect(paths['/api/v1/decision/decisions/{id}'].delete.operationId).toBe('archiveDecision');
  });

  it('documents lifecycle and option paths', () => {
    const paths = decisionOpenApiSchema.paths;
    expect(paths['/api/v1/decision/decisions/{id}/analyze'].post.operationId).toBe('startAnalysis');
    expect(paths['/api/v1/decision/decisions/{id}/evaluate'].post.operationId).toBe(
      'startEvaluation',
    );
    expect(paths['/api/v1/decision/decisions/{id}/options'].post.operationId).toBe('addOption');
    expect(paths['/api/v1/decision/decisions/{id}/options/{optionId}/score'].post.operationId).toBe(
      'scoreOption',
    );
    expect(paths['/api/v1/decision/decisions/{id}/options/{optionId}/risk'].post.operationId).toBe(
      'assessRisk',
    );
    expect(
      paths['/api/v1/decision/decisions/{id}/options/{optionId}/opportunity'].post.operationId,
    ).toBe('assessOpportunity');
    expect(paths['/api/v1/decision/decisions/{id}/rankings'].get.operationId).toBe('rankOptions');
  });

  it('documents decision, completion, archive, cancel, recommend and compare paths', () => {
    const paths = decisionOpenApiSchema.paths;
    expect(paths['/api/v1/decision/decisions/{id}/decide'].post.operationId).toBe('makeDecision');
    expect(paths['/api/v1/decision/decisions/{id}/complete'].post.operationId).toBe(
      'completeDecision',
    );
    expect(paths['/api/v1/decision/decisions/{id}/archive'].post.operationId).toBe(
      'archiveDecisionById',
    );
    expect(paths['/api/v1/decision/decisions/{id}/cancel'].post.operationId).toBe('cancelDecision');
    expect(paths['/api/v1/decision/decisions/{id}/recommend'].get.operationId).toBe(
      'getRecommendation',
    );
    expect(
      paths['/api/v1/decision/decisions/{id}/compare/{optionA}/{optionB}'].get.operationId,
    ).toBe('compareOptions');
  });

  it('documents search, stats and health paths', () => {
    const paths = decisionOpenApiSchema.paths;
    expect(paths['/api/v1/decision/decisions/search'].get.operationId).toBe('searchDecisions');
    expect(paths['/api/v1/decision/decisions/stats'].get.operationId).toBe('getDecisionStatistics');
    expect(paths['/api/v1/decision/health'].get.operationId).toBe('decisionHealth');
  });

  it('declares the category enum and required fields on create', () => {
    const schema =
      decisionOpenApiSchema.paths['/api/v1/decision/decisions'].post.requestBody.content[
        'application/json'
      ].schema;
    expect(schema.required).toEqual(['title', 'description', 'category']);
    expect(schema.properties.category.enum).toEqual([
      'strategic',
      'tactical',
      'operational',
      'technical',
      'business',
      'career',
      'learning',
      'personal',
    ]);
  });
});
