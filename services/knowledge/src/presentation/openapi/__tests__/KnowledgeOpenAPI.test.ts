// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge OpenAPI metadata unit tests
// ARC-003 — Knowledge Graph Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { knowledgeOpenApiSchema } from '../KnowledgeOpenAPI.js';

describe('knowledgeOpenApiSchema', () => {
  it('declares OpenAPI 3.1 metadata', () => {
    expect(knowledgeOpenApiSchema.openapi).toBe('3.1.0');
    expect(knowledgeOpenApiSchema.info.title).toContain('Knowledge');
    expect(knowledgeOpenApiSchema.info.version).toBe('0.1.0');
  });

  it('documents the graph endpoints', () => {
    const paths = knowledgeOpenApiSchema.paths as Record<
      string,
      { get?: unknown; post?: unknown; delete?: unknown }
    >;
    expect(paths['/graphs'].get).toBeDefined();
    expect(paths['/graphs'].post).toBeDefined();
    expect(paths['/graphs/{id}'].get).toBeDefined();
    expect(paths['/graphs/{id}'].delete).toBeDefined();
  });

  it('documents node, edge, traversal, search, and analysis endpoints', () => {
    const paths = knowledgeOpenApiSchema.paths as Record<string, unknown>;
    expect(paths['/nodes']).toBeDefined();
    expect(paths['/nodes/{id}']).toBeDefined();
    expect(paths['/nodes/{id}/traverse']).toBeDefined();
    expect(paths['/nodes/{id}/shortest-path']).toBeDefined();
    expect(paths['/nodes/{id}/related']).toBeDefined();
    expect(paths['/nodes/{id}/impact']).toBeDefined();
    expect(paths['/edges']).toBeDefined();
    expect(paths['/search']).toBeDefined();
  });

  it('defines component schemas', () => {
    const components = knowledgeOpenApiSchema.components as { schemas?: Record<string, unknown> };
    expect(components.schemas).toBeDefined();
    expect(components.schemas?.CreateGraphRequest).toBeDefined();
    expect(components.schemas?.CreateNodeRequest).toBeDefined();
    expect(components.schemas?.UpdateNodeRequest).toBeDefined();
    expect(components.schemas?.CreateEdgeRequest).toBeDefined();
  });

  it('declares tag groups', () => {
    const tags = knowledgeOpenApiSchema.tags as Array<{ name: string }>;
    const names = tags.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'Knowledge Graph',
        'Nodes',
        'Edges',
        'Traversal',
        'Search',
        'Analysis',
      ]),
    );
  });
});
