// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Identity OpenAPI Metadata
// Verifies the documented identity endpoints and schemas
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { identityOpenApiSchema } from '../src/presentation/openapi/IdentityOpenAPI.js';

describe('IdentityOpenAPI', () => {
  it('declares the OpenAPI version and service metadata', () => {
    expect(identityOpenApiSchema.openapi).toBe('3.1.0');
    expect(identityOpenApiSchema.info.title).toBe('Identity API');
    expect(identityOpenApiSchema.info.version).toBe('0.1.0');
    expect(identityOpenApiSchema.info.description).toContain('Identity management');
  });

  it('declares the server base path', () => {
    expect(identityOpenApiSchema.servers).toEqual([
      { url: '/api/v1/identity', description: 'Identity Service' },
    ]);
  });

  it('declares identity and authentication tags', () => {
    const tags = identityOpenApiSchema.tags;
    expect(tags.some((t) => t.name === 'Identity')).toBe(true);
    expect(tags.some((t) => t.name === 'Authentication')).toBe(true);
  });

  it('documents the /users collection endpoints', () => {
    const paths = identityOpenApiSchema.paths;
    expect(paths['/users']).toBeDefined();
    expect((paths['/users'] as Record<string, unknown>).get).toBeDefined();
    expect((paths['/users'] as Record<string, unknown>).post).toBeDefined();
  });

  it('documents the /users/{id} endpoints', () => {
    const paths = identityOpenApiSchema.paths;
    expect((paths['/users/{id}'] as Record<string, unknown>).get).toBeDefined();
    expect((paths['/users/{id}'] as Record<string, unknown>).delete).toBeDefined();
  });

  it('documents lifecycle and profile endpoints', () => {
    const paths = identityOpenApiSchema.paths;
    expect(paths['/users/{id}/profile']).toBeDefined();
    expect(paths['/users/{id}/preferences']).toBeDefined();
    expect(paths['/users/{id}/activate']).toBeDefined();
    expect(paths['/users/{id}/deactivate']).toBeDefined();
    expect(paths['/users/{id}/auth-check']).toBeDefined();
    expect(paths['/health']).toBeDefined();
  });

  it('documents the email lookup endpoint', () => {
    expect(identityOpenApiSchema.paths['/users/email/{email}']).toBeDefined();
  });

  it('defines the component schemas', () => {
    const schemas = identityOpenApiSchema.components.schemas;
    expect(schemas.UserResponse).toBeDefined();
    expect(schemas.RegisterUserRequest).toBeDefined();
    expect(schemas.RegisterUserResponse).toBeDefined();
    expect(schemas.UpdateProfileRequest).toBeDefined();
    expect(schemas.UserListResponse).toBeDefined();
    expect(schemas.ApiError).toBeDefined();
  });

  it('requires email, displayName, and password for registration', () => {
    const schema = identityOpenApiSchema.components.schemas.RegisterUserRequest as {
      required?: string[];
    };
    expect(schema.required).toEqual(expect.arrayContaining(['email', 'displayName', 'password']));
  });

  it('marks the ApiError schema as a failure shape', () => {
    const schema = identityOpenApiSchema.components.schemas.ApiError as {
      properties?: { success?: { enum?: boolean[] } };
    };
    expect(schema.properties?.success?.enum).toContain(false);
  });
});
