// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge OpenAPI Metadata
// API documentation and schema definitions for knowledge endpoints
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

export const knowledgeOpenApiSchema = {
  openapi: '3.1.0',
  info: {
    title: 'Knowledge Graph API',
    version: '0.1.0',
    description:
      'Knowledge Graph management API. Manages knowledge nodes, edges, graphs, traversal, search, impact analysis, and cycle detection.',
  },
  servers: [{ url: '/api/v1/knowledge', description: 'Knowledge Graph Service' }],
  tags: [
    { name: 'Knowledge Graph', description: 'Graph management and CRUD operations' },
    { name: 'Nodes', description: 'Knowledge node operations' },
    { name: 'Edges', description: 'Relationship/edge operations' },
    { name: 'Traversal', description: 'Graph traversal and path finding' },
    { name: 'Search', description: 'Knowledge search' },
    { name: 'Analysis', description: 'Impact analysis and cycle detection' },
  ],
  paths: {
    '/graphs': {
      get: {
        tags: ['Knowledge Graph'],
        summary: 'List all graphs',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: { '200': { description: 'Paginated list of graphs' } },
      },
      post: {
        tags: ['Knowledge Graph'],
        summary: 'Create a new graph',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateGraphRequest' } },
          },
        },
        responses: { '201': { description: 'Graph created' } },
      },
    },
    '/graphs/{id}': {
      get: {
        tags: ['Knowledge Graph'],
        summary: 'Get graph by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Graph found' }, '404': { description: 'Not found' } },
      },
      delete: {
        tags: ['Knowledge Graph'],
        summary: 'Delete a graph',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Graph deleted' } },
      },
    },
    '/graphs/{graphId}/nodes': {
      get: {
        tags: ['Nodes'],
        summary: 'List nodes in a graph',
        parameters: [
          { name: 'graphId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Paginated list of nodes' } },
      },
    },
    '/nodes': {
      post: {
        tags: ['Nodes'],
        summary: 'Create a new node',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateNodeRequest' } },
          },
        },
        responses: { '201': { description: 'Node created' } },
      },
    },
    '/nodes/{id}': {
      get: {
        tags: ['Nodes'],
        summary: 'Get node by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Node found' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['Nodes'],
        summary: 'Update a node',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpdateNodeRequest' } },
          },
        },
        responses: { '200': { description: 'Node updated' } },
      },
      delete: {
        tags: ['Nodes'],
        summary: 'Delete a node',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Node deleted' } },
      },
    },
    '/nodes/merge': {
      post: {
        tags: ['Nodes'],
        summary: 'Merge two nodes',
        responses: { '200': { description: 'Nodes merged' } },
      },
    },
    '/nodes/split': {
      post: {
        tags: ['Nodes'],
        summary: 'Split a node into two',
        responses: { '200': { description: 'Node split' } },
      },
    },
    '/nodes/{id}/traverse': {
      get: {
        tags: ['Traversal'],
        summary: 'Traverse graph from node',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'maxDepth', in: 'query', schema: { type: 'integer', default: 5 } },
        ],
        responses: { '200': { description: 'Traversal result' } },
      },
    },
    '/nodes/{id}/shortest-path': {
      get: {
        tags: ['Traversal'],
        summary: 'Find shortest path to another node',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'endNodeId', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Shortest path result' } },
      },
    },
    '/nodes/{id}/related': {
      get: {
        tags: ['Traversal'],
        summary: 'Find related knowledge',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Related knowledge' } },
      },
    },
    '/nodes/{id}/impact': {
      get: {
        tags: ['Analysis'],
        summary: 'Analyze impact of node removal',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Impact analysis result' } },
      },
    },
    '/nodes/{id}/edges': {
      get: {
        tags: ['Edges'],
        summary: 'Get all edges for a node',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'List of edges' } },
      },
    },
    '/edges': {
      post: {
        tags: ['Edges'],
        summary: 'Create a new edge',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateEdgeRequest' } },
          },
        },
        responses: { '201': { description: 'Edge created' } },
      },
    },
    '/edges/{id}': {
      delete: {
        tags: ['Edges'],
        summary: 'Delete an edge',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Edge deleted' } },
      },
    },
    '/graphs/{id}/cycles': {
      get: {
        tags: ['Analysis'],
        summary: 'Detect cycles in graph',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Cycle detection result' } },
      },
    },
    '/graphs/{id}/statistics': {
      get: {
        tags: ['Analysis'],
        summary: 'Get graph statistics',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Graph statistics' } },
      },
    },
    '/search': {
      get: {
        tags: ['Search'],
        summary: 'Search knowledge nodes',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Search results' } },
      },
    },
    '/health': {
      get: {
        tags: ['Knowledge Graph'],
        summary: 'Health check',
        responses: { '200': { description: 'Service is healthy' } },
      },
    },
  },
  components: {
    schemas: {
      CreateGraphRequest: {
        type: 'object',
        required: ['label'],
        properties: {
          label: { type: 'string', maxLength: 200 },
          description: { type: 'string' },
        },
      },
      CreateNodeRequest: {
        type: 'object',
        required: ['graphId', 'category', 'label'],
        properties: {
          graphId: { type: 'string' },
          category: { type: 'string' },
          label: { type: 'string', maxLength: 200 },
          description: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
      UpdateNodeRequest: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          description: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          category: { type: 'string' },
        },
      },
      CreateEdgeRequest: {
        type: 'object',
        required: ['graphId', 'sourceId', 'targetId', 'relationshipType', 'relationshipCategory'],
        properties: {
          graphId: { type: 'string' },
          sourceId: { type: 'string' },
          targetId: { type: 'string' },
          relationshipType: { type: 'string' },
          relationshipCategory: { type: 'string' },
          label: { type: 'string' },
          weight: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [false] },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' },
            },
          },
        },
      },
    },
  },
} as const;
