export const executionOpenApiSchema = {
  openapi: '3.1.0',
  info: {
    title: 'Execution Intelligence Engine API',
    version: '0.1.0',
    description:
      'Execution Engine REST API — create, plan, schedule, execute, monitor, and recover execution plans with full lifecycle management',
  },
  paths: {
    '/api/v1/execution/plans': {
      post: {
        tags: ['Execution Intelligence Engine'],
        summary: 'Create a new execution plan',
        operationId: 'createPlan',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  planningLevel: {
                    type: 'string',
                    enum: ['strategic', 'tactical', 'operational', 'daily'],
                  },
                },
                required: ['title', 'description'],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Plan created successfully' },
          '400': { description: 'Validation error' },
        },
      },
      get: {
        tags: ['Execution Intelligence Engine'],
        summary: 'List execution plans',
        operationId: 'listPlans',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'List of plans' } },
      },
    },
    '/api/v1/execution/plans/{id}': {
      get: {
        tags: ['Execution Intelligence Engine'],
        summary: 'Get an execution plan',
        operationId: 'getPlan',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Plan retrieved' },
          '404': { description: 'Plan not found' },
        },
      },
      patch: {
        tags: ['Execution Intelligence Engine'],
        summary: 'Update an execution plan',
        operationId: 'updatePlan',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Plan updated' },
          '404': { description: 'Plan not found' },
        },
      },
    },
    '/api/v1/execution/plans/{id}/activate': {
      post: {
        tags: ['Execution Intelligence Engine'],
        summary: 'Activate a plan',
        operationId: 'activatePlan',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Plan activated' } },
      },
    },
    '/api/v1/execution/plans/{id}/start': {
      post: {
        tags: ['Execution Intelligence Engine'],
        summary: 'Start a plan',
        operationId: 'startPlan',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Plan started' } },
      },
    },
    '/api/v1/execution/plans/{id}/pause': {
      post: {
        tags: ['Execution Intelligence Engine'],
        summary: 'Pause a plan',
        operationId: 'pausePlan',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Plan paused' } },
      },
    },
    '/api/v1/execution/plans/{id}/resume': {
      post: {
        tags: ['Execution Intelligence Engine'],
        summary: 'Resume a plan',
        operationId: 'resumePlan',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Plan resumed' } },
      },
    },
    '/api/v1/execution/plans/{id}/complete': {
      post: {
        tags: ['Execution Intelligence Engine'],
        summary: 'Complete a plan',
        operationId: 'completePlan',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Plan completed' } },
      },
    },
    '/api/v1/execution/plans/{id}/cancel': {
      post: {
        tags: ['Execution Intelligence Engine'],
        summary: 'Cancel a plan',
        operationId: 'cancelPlan',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Plan cancelled' } },
      },
    },
    '/api/v1/execution/plans/{id}/missions': {
      post: {
        tags: ['Execution Intelligence Engine'],
        summary: 'Add a mission to a plan',
        operationId: 'addMission',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Mission added' } },
      },
    },
    '/api/v1/execution/plans/{id}/tasks': {
      post: {
        tags: ['Execution Intelligence Engine'],
        summary: 'Add a task to a plan',
        operationId: 'addTask',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Task added' } },
      },
    },
    '/api/v1/execution/plans/{id}/tasks/{taskId}/complete': {
      post: {
        tags: ['Execution Intelligence Engine'],
        summary: 'Complete a task',
        operationId: 'completeTask',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'taskId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Task completed' } },
      },
    },
    '/api/v1/execution/plans/{id}/schedule': {
      post: {
        tags: ['Execution Intelligence Engine'],
        summary: 'Schedule tasks',
        operationId: 'scheduleTasks',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Tasks scheduled' } },
      },
    },
    '/api/v1/execution/plans/{id}/recover': {
      post: {
        tags: ['Execution Intelligence Engine'],
        summary: 'Recover a failed plan',
        operationId: 'recoverPlan',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Plan recovered' } },
      },
    },
    '/api/v1/execution/plans/{id}/bottlenecks': {
      get: {
        tags: ['Execution Intelligence Engine'],
        summary: 'Analyze bottlenecks',
        operationId: 'analyzeBottlenecks',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Bottleneck analysis' } },
      },
    },
    '/api/v1/execution/plans/search': {
      get: {
        tags: ['Execution Intelligence Engine'],
        summary: 'Search plans',
        operationId: 'searchPlans',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'planningLevel', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Search results' } },
      },
    },
    '/api/v1/execution/plans/stats': {
      get: {
        tags: ['Execution Intelligence Engine'],
        summary: 'Get execution statistics',
        operationId: 'getExecutionStats',
        responses: { '200': { description: 'Execution statistics' } },
      },
    },
    '/api/v1/execution/health': {
      get: {
        tags: ['Execution Intelligence Engine'],
        summary: 'Health check',
        operationId: 'executionHealth',
        responses: { '200': { description: 'Service is healthy' } },
      },
    },
  },
} as const;
