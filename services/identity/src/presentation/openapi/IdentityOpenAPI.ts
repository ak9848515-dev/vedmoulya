// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity OpenAPI Metadata
// API documentation and schema definitions for identity endpoints
// ──────────────────────────────────────────────────────────────────

export const identityOpenApiSchema = {
  openapi: '3.1.0',
  info: {
    title: 'Identity API',
    version: '0.1.0',
    description:
      'Identity management and user lifecycle API. Manages user registration, profile, preferences, authentication status, and lifecycle.',
  },
  servers: [{ url: '/api/v1/identity', description: 'Identity Service' }],
  tags: [
    { name: 'Identity', description: 'User identity and profile management' },
    { name: 'Authentication', description: 'Authentication status and checks' },
  ],
  paths: {
    '/users': {
      get: {
        tags: ['Identity'],
        summary: 'List users',
        description: 'Retrieve a paginated list of all users',
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
            description: 'Page number',
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20, maximum: 100 },
            description: 'Items per page',
          },
        ],
        responses: {
          '200': {
            description: 'Paginated list of users',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/UserListResponse' } },
            },
          },
        },
      },
      post: {
        tags: ['Identity'],
        summary: 'Register a new user',
        description: 'Create a new user account with email and password',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RegisterUserRequest' } },
          },
        },
        responses: {
          '201': {
            description: 'User registered successfully',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/RegisterUserResponse' } },
            },
          },
          '400': { description: 'Validation error' },
          '409': { description: 'Email already registered' },
        },
      },
    },
    '/users/{id}': {
      get: {
        tags: ['Identity'],
        summary: 'Get user by ID',
        description: 'Retrieve a user by their unique identifier',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'User ID',
          },
        ],
        responses: {
          '200': {
            description: 'User found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/UserResponse' } },
            },
          },
          '404': { description: 'User not found' },
        },
      },
      delete: {
        tags: ['Identity'],
        summary: 'Archive a user',
        description: 'Soft-delete/archive a user account',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'User archived' },
          '404': { description: 'User not found' },
        },
      },
    },
    '/users/email/{email}': {
      get: {
        tags: ['Identity'],
        summary: 'Get user by email',
        description: 'Retrieve a user by their email address',
        parameters: [
          {
            name: 'email',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'email' },
          },
        ],
        responses: {
          '200': { description: 'User found' },
          '404': { description: 'User not found' },
        },
      },
    },
    '/users/{id}/profile': {
      patch: {
        tags: ['Identity'],
        summary: 'Update user profile',
        description: "Update a user's profile information",
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpdateProfileRequest' } },
          },
        },
        responses: {
          '200': { description: 'Profile updated' },
          '404': { description: 'User not found' },
        },
      },
    },
    '/users/{id}/preferences': {
      patch: {
        tags: ['Identity'],
        summary: 'Update user preferences',
        description: "Update a user's platform preferences",
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Preferences updated' } },
      },
    },
    '/users/{id}/activate': {
      post: {
        tags: ['Identity'],
        summary: 'Activate a user',
        description: 'Activate a pending user account',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'User activated' } },
      },
    },
    '/users/{id}/deactivate': {
      post: {
        tags: ['Identity'],
        summary: 'Deactivate a user',
        description: 'Suspend/deactivate a user account',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'User deactivated' } },
      },
    },
    '/users/{id}/auth-check': {
      get: {
        tags: ['Authentication'],
        summary: 'Check authentication status',
        description: 'Check if a user can authenticate based on their account status',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Authentication check result' } },
      },
    },
    '/health': {
      get: {
        tags: ['Identity'],
        summary: 'Health check',
        description: 'Identity service health endpoint',
        responses: { '200': { description: 'Service is healthy' } },
      },
    },
  },
  components: {
    schemas: {
      UserResponse: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'User ID' },
          email: { type: 'string', format: 'email' },
          displayName: { type: 'string' },
          statusState: {
            type: 'string',
            enum: ['pending', 'active', 'suspended', 'deleted', 'locked'],
          },
          emailVerified: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      RegisterUserRequest: {
        type: 'object',
        required: ['email', 'displayName', 'password'],
        properties: {
          email: { type: 'string', format: 'email', description: 'User email address' },
          displayName: {
            type: 'string',
            minLength: 2,
            maxLength: 100,
            description: 'Display name',
          },
          givenName: { type: 'string', description: 'Given/first name' },
          familyName: { type: 'string', description: 'Family/last name' },
          password: {
            type: 'string',
            minLength: 8,
            description: 'Password (8+ chars, uppercase, lowercase, number)',
          },
        },
      },
      RegisterUserResponse: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          displayName: { type: 'string' },
          status: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      UpdateProfileRequest: {
        type: 'object',
        properties: {
          displayName: { type: 'string', minLength: 2, maxLength: 100 },
          givenName: { type: 'string' },
          familyName: { type: 'string' },
          avatarUrl: { type: 'string', format: 'uri' },
          bio: { type: 'string', maxLength: 500 },
          timezone: { type: 'string' },
          locale: { type: 'string' },
        },
      },
      UserListResponse: {
        type: 'object',
        properties: {
          users: { type: 'array', items: { $ref: '#/components/schemas/UserResponse' } },
          total: { type: 'integer' },
          page: { type: 'integer' },
          limit: { type: 'integer' },
          totalPages: { type: 'integer' },
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
