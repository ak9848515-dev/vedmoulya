// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory OpenAPI Schema
// OpenAPI metadata for the Memory Engine REST API
// ARC-003/ARC-004 — Memory Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

/** OpenAPI schema metadata for the Memory Engine API */
export const memoryOpenApiSchema = {
  openapi: '3.1.0',
  info: {
    title: 'Memory Engine API',
    version: '0.1.0',
    description:
      'Memory Engine REST API — capture, recall, strengthen, timeline, search, and retention',
  },
  paths: {
    '/api/v1/memory/memories': {
      post: {
        tags: ['Memory Engine'],
        summary: 'Capture a new memory',
        description: 'Creates a new memory entry from experience, observation, or reflection',
        operationId: 'captureMemory',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  label: { type: 'string', description: 'Short memory label' },
                  content: { type: 'string', description: 'Full memory content' },
                  category: {
                    type: 'string',
                    enum: [
                      'experience',
                      'observation',
                      'history',
                      'reflection',
                      'context',
                      'conversation',
                      'learning',
                      'insight',
                      'feedback',
                      'decision',
                    ],
                  },
                },
                required: ['label', 'content', 'category'],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Memory captured successfully' },
          '400': { description: 'Validation error' },
        },
      },
    },
    '/api/v1/memory/memories/{id}': {
      get: {
        tags: ['Memory Engine'],
        summary: 'Recall a memory',
        description: 'Retrieves a memory by ID, optionally strengthening it',
        operationId: 'recallMemory',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'strengthen', in: 'query', schema: { type: 'boolean', default: true } },
        ],
        responses: {
          '200': { description: 'Memory retrieved successfully' },
          '404': { description: 'Memory not found' },
        },
      },
      patch: {
        tags: ['Memory Engine'],
        summary: 'Update a memory',
        operationId: 'updateMemory',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Memory updated successfully' },
          '404': { description: 'Memory not found' },
        },
      },
      delete: {
        tags: ['Memory Engine'],
        summary: 'Forget a memory',
        operationId: 'forgetMemory',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Memory forgotten' },
          '404': { description: 'Memory not found' },
        },
      },
    },
    '/api/v1/memory/memories/{id}/strengthen': {
      post: {
        tags: ['Memory Engine'],
        summary: 'Strengthen a memory',
        operationId: 'strengthenMemory',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Memory strengthened' } },
      },
    },
    '/api/v1/memory/memories/{id}/weaken': {
      post: {
        tags: ['Memory Engine'],
        summary: 'Weaken a memory',
        operationId: 'weakenMemory',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Memory weakened' } },
      },
    },
    '/api/v1/memory/memories/{id}/archive': {
      post: {
        tags: ['Memory Engine'],
        summary: 'Archive a memory',
        operationId: 'archiveMemory',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Memory archived' } },
      },
    },
    '/api/v1/memory/memories/{id}/restore': {
      post: {
        tags: ['Memory Engine'],
        summary: 'Restore an archived memory',
        operationId: 'restoreMemory',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Memory restored' } },
      },
    },
    '/api/v1/memory/memories/{id}/timeline': {
      get: {
        tags: ['Memory Engine'],
        summary: 'Get memory timeline',
        operationId: 'getMemoryTimeline',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          {
            name: 'order',
            in: 'query',
            schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          },
        ],
        responses: { '200': { description: 'Timeline retrieved' } },
      },
    },
    '/api/v1/memory/memories/merge': {
      post: {
        tags: ['Memory Engine'],
        summary: 'Merge memories',
        operationId: 'mergeMemories',
        responses: { '200': { description: 'Memories merged' } },
      },
    },
    '/api/v1/memory/search': {
      get: {
        tags: ['Memory Engine'],
        summary: 'Search memories',
        operationId: 'searchMemories',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Search results' } },
      },
    },
    '/api/v1/memory/stats': {
      get: {
        tags: ['Memory Engine'],
        summary: 'Get memory statistics',
        operationId: 'getMemoryStatistics',
        responses: { '200': { description: 'Memory statistics' } },
      },
    },
    '/api/v1/memory/health': {
      get: {
        tags: ['Memory Engine'],
        summary: 'Health check',
        operationId: 'memoryHealth',
        responses: { '200': { description: 'Service is healthy' } },
      },
    },
  },
} as const;
