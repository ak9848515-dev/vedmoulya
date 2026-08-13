// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Assembly tests
// APP-001 — Post-V1 Application Platform Layer
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ContextAssemblyService, previewEntity } from '../ContextAssemblyService.js';
import type {
  ContextEntity,
  ContextRankingResult,
  ContextRetrievalQuery,
  PermissionEvaluation,
} from '../../../types/fabric-types.js';

const now = new Date().toISOString();

function entity(entityId: string, label: string, description: string): ContextEntity {
  return {
    entityId,
    graph: 'personal',
    type: 'document',
    label,
    description,
    ownerId: 'user_001',
    tags: [],
    confidence: 0.9,
    lifecycle: 'active',
    source: 'import',
    provenance: {
      source: 'import',
      sourceId: entityId,
      createdAt: now,
      updatedAt: now,
      producedBy: 'test',
      confidence: 0.9,
    },
    permissions: {
      owner: 'user_001',
      scope: 'private',
      allowedUsers: [],
      allowedRoles: [],
      capability: [],
      grantedAt: now,
    },
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

function ranking(entityId: string, score: number): ContextRankingResult {
  return { entityId, score, components: { relevance: score }, reasons: [`matches ${entityId}`] };
}

function allowed(entityId: string): PermissionEvaluation {
  return { entityId, allowed: true, reasons: ['you are the owner'] };
}

function denied(entityId: string): PermissionEvaluation {
  return { entityId, allowed: false, reasons: ['private'] };
}

const query: ContextRetrievalQuery = {
  userId: 'user_001',
  query: 'enterprise platform',
  goalId: 'goal_x',
};

describe('ContextAssemblyService', () => {
  it('assembles a minimum useful package ranked by score', () => {
    const service = new ContextAssemblyService();
    const doc = entity(
      'd1',
      'Enterprise platform doc',
      'Detailed enterprise platform documentation. '.repeat(10),
    );
    const pkg = service.assemble(
      query,
      [
        { entity: doc, ranking: ranking('d1', 0.9), permission: allowed('d1') },
        {
          entity: entity('d2', 'Unrelated', 'Unrelated content'),
          ranking: ranking('d2', 0.2),
          permission: allowed('d2'),
        },
      ],
      [],
      { relevantCapabilities: ['content_generation'] },
    );
    expect(pkg.packageId).toContain('package_');
    expect(pkg.userId).toBe('user_001');
    expect(pkg.goalId).toBe('goal_x');
    expect(pkg.items).toHaveLength(2);
    expect(pkg.items[0].entityId).toBe('d1');
    expect(pkg.items[0].explanation.reasons).toContain('matches d1');
    expect(pkg.relevantCapabilities).toEqual(['content_generation']);
    expect(pkg.estimatedTokens).toBeGreaterThan(0);
    expect(pkg.contextVersion).toContain('fabric-');
  });

  it('never packages unauthorized context (permission hard gate)', () => {
    const service = new ContextAssemblyService();
    const pkg = service.assemble(
      query,
      [
        {
          entity: entity('d1', 'Secret', 'top secret'),
          ranking: ranking('d1', 0.99),
          permission: denied('d1'),
        },
        {
          entity: entity('d2', 'Allowed', 'allowed'),
          ranking: ranking('d2', 0.5),
          permission: allowed('d2'),
        },
      ],
      [],
    );
    expect(pkg.items).toHaveLength(1);
    expect(pkg.items[0].entityId).toBe('d2');
  });

  it('respects the token budget', () => {
    const service = new ContextAssemblyService();
    const candidates = [
      {
        entity: entity('d1', 'One', 'a'.repeat(2000)),
        ranking: ranking('d1', 0.9),
        permission: allowed('d1'),
      },
      {
        entity: entity('d2', 'Two', 'b'.repeat(2000)),
        ranking: ranking('d2', 0.8),
        permission: allowed('d2'),
      },
      {
        entity: entity('d3', 'Three', 'c'.repeat(2000)),
        ranking: ranking('d3', 0.7),
        permission: allowed('d3'),
      },
    ];
    // Previews truncate to 220 chars (~59 tokens each); a 100-token budget
    // admits only the highest-ranked item.
    const pkg = service.assemble(query, candidates, [], { tokenBudget: 100 });
    expect(pkg.estimatedTokens).toBeLessThanOrEqual(100);
    expect(pkg.items.length).toBeLessThan(3);
    expect(pkg.items.length).toBeGreaterThan(0);
  });

  it('builds a summary explanation for the package', () => {
    const service = new ContextAssemblyService();
    const doc = entity('d1', 'Doc', 'content');
    const pkg = service.assemble(
      query,
      [{ entity: doc, ranking: ranking('d1', 0.9), permission: allowed('d1') }],
      [],
    );
    expect(pkg.summary).toHaveLength(1);
    expect(pkg.summary[0].selected).toBe(true);
    expect(pkg.summary[0].entityLabel).toBe('Doc');
  });

  it('describes a package compactly', () => {
    const service = new ContextAssemblyService();
    const doc = entity('d1', 'Doc', 'content');
    const pkg = service.assemble(
      query,
      [{ entity: doc, ranking: ranking('d1', 0.9), permission: allowed('d1') }],
      [],
    );
    const description = service.describe(pkg);
    expect(description).toContain('1 items');
    expect(description).toContain('tokens');
  });

  it('previews entity content with truncation', () => {
    const doc = entity('d1', 'Doc', 'x'.repeat(500));
    const preview = previewEntity(doc, 100);
    expect(preview.length).toBeLessThanOrEqual(101);
    expect(preview.endsWith('…')).toBe(true);
  });
});
