// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision OpenAPI Schema
// OpenAPI metadata for the Decision Intelligence Engine REST API
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

/** OpenAPI schema metadata for the Decision Engine API */
export const decisionOpenApiSchema = {
  openapi: '3.1.0',
  info: {
    title: 'Decision Intelligence Engine API',
    version: '0.1.0',
    description:
      'Decision Engine REST API — create, analyze, evaluate, score, rank, decide, and complete decisions with full lifecycle management',
  },
  paths: {
    '/api/v1/decision/decisions': {
      post: {
        tags: ['Decision Intelligence Engine'],
        summary: 'Create a new decision',
        description:
          'Creates a new decision with the specified title, description, category, and optional priority, tags, and references',
        operationId: 'createDecision',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Decision title' },
                  description: { type: 'string', description: 'Detailed description' },
                  category: {
                    type: 'string',
                    enum: [
                      'strategic',
                      'tactical',
                      'operational',
                      'technical',
                      'business',
                      'career',
                      'learning',
                      'personal',
                    ],
                  },
                  priorityScore: { type: 'number', description: 'Priority score 0–10' },
                },
                required: ['title', 'description', 'category'],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Decision created successfully' },
          '400': { description: 'Validation error' },
        },
      },
      get: {
        tags: ['Decision Intelligence Engine'],
        summary: 'List decisions',
        description: 'Returns paginated list of decisions',
        operationId: 'listDecisions',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          '200': { description: 'List of decisions' },
        },
      },
    },
    '/api/v1/decision/decisions/{id}': {
      get: {
        tags: ['Decision Intelligence Engine'],
        summary: 'Get a decision',
        description: 'Retrieves a decision by ID with all options, scoring, risk, and outcome data',
        operationId: 'getDecision',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Decision retrieved successfully' },
          '404': { description: 'Decision not found' },
        },
      },
      patch: {
        tags: ['Decision Intelligence Engine'],
        summary: 'Update a decision',
        operationId: 'updateDecision',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Decision updated successfully' },
          '404': { description: 'Decision not found' },
        },
      },
      delete: {
        tags: ['Decision Intelligence Engine'],
        summary: 'Archive a decision',
        operationId: 'archiveDecision',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Decision archived' },
          '404': { description: 'Decision not found' },
        },
      },
    },
    '/api/v1/decision/decisions/{id}/analyze': {
      post: {
        tags: ['Decision Intelligence Engine'],
        summary: 'Start analysis phase',
        operationId: 'startAnalysis',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Analysis started' } },
      },
    },
    '/api/v1/decision/decisions/{id}/evaluate': {
      post: {
        tags: ['Decision Intelligence Engine'],
        summary: 'Start evaluation phase',
        operationId: 'startEvaluation',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Evaluation started' } },
      },
    },
    '/api/v1/decision/decisions/{id}/options': {
      post: {
        tags: ['Decision Intelligence Engine'],
        summary: 'Add an option',
        operationId: 'addOption',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Option added' } },
      },
    },
    '/api/v1/decision/decisions/{id}/options/{optionId}/score': {
      post: {
        tags: ['Decision Intelligence Engine'],
        summary: 'Score an option',
        operationId: 'scoreOption',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'optionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Option scored' } },
      },
    },
    '/api/v1/decision/decisions/{id}/options/{optionId}/risk': {
      post: {
        tags: ['Decision Intelligence Engine'],
        summary: 'Assess risk for an option',
        operationId: 'assessRisk',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'optionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Risk assessed' } },
      },
    },
    '/api/v1/decision/decisions/{id}/options/{optionId}/opportunity': {
      post: {
        tags: ['Decision Intelligence Engine'],
        summary: 'Assess opportunity for an option',
        operationId: 'assessOpportunity',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'optionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Opportunity assessed' } },
      },
    },
    '/api/v1/decision/decisions/{id}/rankings': {
      get: {
        tags: ['Decision Intelligence Engine'],
        summary: 'Rank all options',
        operationId: 'rankOptions',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Options ranked' } },
      },
    },
    '/api/v1/decision/decisions/{id}/decide': {
      post: {
        tags: ['Decision Intelligence Engine'],
        summary: 'Make the decision',
        operationId: 'makeDecision',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Decision made' } },
      },
    },
    '/api/v1/decision/decisions/{id}/complete': {
      post: {
        tags: ['Decision Intelligence Engine'],
        summary: 'Complete a decision with outcome',
        operationId: 'completeDecision',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Decision completed' } },
      },
    },
    '/api/v1/decision/decisions/{id}/archive': {
      post: {
        tags: ['Decision Intelligence Engine'],
        summary: 'Archive a decision',
        operationId: 'archiveDecisionById',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Decision archived' } },
      },
    },
    '/api/v1/decision/decisions/{id}/cancel': {
      post: {
        tags: ['Decision Intelligence Engine'],
        summary: 'Cancel a decision',
        operationId: 'cancelDecision',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Decision cancelled' } },
      },
    },
    '/api/v1/decision/decisions/{id}/recommend': {
      get: {
        tags: ['Decision Intelligence Engine'],
        summary: 'Get recommendation',
        operationId: 'getRecommendation',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Recommendation' } },
      },
    },
    '/api/v1/decision/decisions/{id}/compare/{optionA}/{optionB}': {
      get: {
        tags: ['Decision Intelligence Engine'],
        summary: 'Compare two options',
        operationId: 'compareOptions',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'optionA', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'optionB', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Comparison result' } },
      },
    },
    '/api/v1/decision/decisions/search': {
      get: {
        tags: ['Decision Intelligence Engine'],
        summary: 'Search decisions',
        operationId: 'searchDecisions',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Search results' } },
      },
    },
    '/api/v1/decision/decisions/stats': {
      get: {
        tags: ['Decision Intelligence Engine'],
        summary: 'Get decision statistics',
        operationId: 'getDecisionStatistics',
        responses: { '200': { description: 'Decision statistics' } },
      },
    },
    '/api/v1/decision/health': {
      get: {
        tags: ['Decision Intelligence Engine'],
        summary: 'Health check',
        operationId: 'decisionHealth',
        responses: { '200': { description: 'Service is healthy' } },
      },
    },
  },
} as const;
