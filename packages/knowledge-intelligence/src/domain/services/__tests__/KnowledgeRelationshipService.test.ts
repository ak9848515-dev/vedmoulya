// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Relationship tests
// EI-009 — Enterprise Knowledge Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { KnowledgeRelationshipService } from '../KnowledgeRelationshipService.js';
import type { KnowledgeItem } from '../../../types/knowledge-types.js';
import { createCatalogKnowledgeItems } from '../../../catalog/knowledge-catalog.js';

const NOW = '2026-08-01T00:00:00.000Z';

function makeItem(
  id: string,
  title: string,
  description: string,
  tags: string[] = [],
  category: KnowledgeItem['category'] = 'technical',
): KnowledgeItem {
  return {
    knowledgeId: id,
    title,
    description,
    source: 'test',
    sourceType: 'repository',
    owner: 'test',
    category,
    tags,
    trust: { score: 0.8, level: 'high', factors: [] },
    confidence: { score: 0.8, level: 'high', factors: [] },
    version: 1,
    versionHistory: [],
    consumers: [],
    dependencies: [],
    relationships: [],
    citations: [],
    usage: { totalReads: 0, totalConsumers: 0 },
    validationStatus: 'pending',
    lifecycleStatus: 'draft',
    audit: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe('KnowledgeRelationshipService', () => {
  const service = new KnowledgeRelationshipService();

  it('detects supersedes from explicit references', () => {
    const older = makeItem('kn_old', 'Old playbook', 'The first playbook.');
    const newer = makeItem(
      'kn_new',
      'New playbook',
      'This playbook supersedes the Old playbook and replaces it entirely.',
    );
    const detected = service.detectRelationships(newer, [older], 'tester');
    expect(detected.some((r) => r.type === 'supersedes' && r.targetId === 'kn_old')).toBe(true);
  });

  it('detects depends_on from explicit references', () => {
    const dependency = makeItem('kn_a', 'Research capability', 'Does research.');
    const consumer = makeItem(
      'kn_b',
      'Blog pipeline',
      'The blog pipeline depends on the Research capability.',
    );
    const detected = service.detectRelationships(consumer, [dependency], 'tester');
    expect(detected.some((r) => r.type === 'depends_on' && r.targetId === 'kn_a')).toBe(true);
  });

  it('detects implements from explicit references', () => {
    const spec = makeItem('kn_spec', 'API contract', 'The API contract.');
    const impl = makeItem('kn_impl', 'Gateway implementation', 'Implements the API contract.');
    const detected = service.detectRelationships(impl, [spec], 'tester');
    expect(detected.some((r) => r.type === 'implements' && r.targetId === 'kn_spec')).toBe(true);
  });

  it('detects related_to from shared tags', () => {
    const a = makeItem('kn_a', 'A', 'same topic', ['openai', 'provider', 'quality']);
    const b = makeItem('kn_b', 'B', 'same topic', ['openai', 'provider', 'cost']);
    const detected = service.detectRelationships(a, [b], 'tester');
    expect(detected.some((r) => r.type === 'related_to' && r.targetId === 'kn_b')).toBe(true);
  });

  it('skips self-loops and duplicates', () => {
    const a = makeItem('kn_a', 'A', 'self', ['tag1', 'tag2']);
    const detected = service.detectRelationships(a, [a, a], 'tester');
    expect(detected.some((r) => r.targetId === 'kn_a')).toBe(false);
  });

  it('checkIntegrity rejects self-loops and duplicates', () => {
    const edge = {
      relationshipId: 'r1',
      type: 'uses' as const,
      sourceId: 'a',
      targetId: 'b',
      weight: 0.5,
      actor: 't',
      createdAt: NOW,
    };
    expect(service.checkIntegrity(edge, []).allowed).toBe(true);
    expect(service.checkIntegrity({ ...edge, targetId: 'a' }, []).allowed).toBe(false);
    expect(service.checkIntegrity(edge, [edge]).allowed).toBe(false);
  });

  it('derives dependencies from outgoing dependency edges with criticality', () => {
    const item = makeItem('kn_a', 'A', 'desc', []);
    item.relationships = [
      {
        relationshipId: 'r1',
        type: 'depends_on',
        sourceId: 'kn_a',
        targetId: 'kn_b',
        weight: 0.9,
        actor: 't',
        createdAt: NOW,
      },
      {
        relationshipId: 'r2',
        type: 'consumes',
        sourceId: 'kn_a',
        targetId: 'kn_c',
        weight: 0.5,
        actor: 't',
        createdAt: NOW,
      },
      {
        relationshipId: 'r3',
        type: 'related_to',
        sourceId: 'kn_a',
        targetId: 'kn_d',
        weight: 0.5,
        actor: 't',
        createdAt: NOW,
      },
    ];
    const dependencies = service.deriveDependencies(item);
    expect(dependencies.length).toBe(2);
    const critical = dependencies.find((d) => d.targetId === 'kn_b');
    expect(critical?.criticality).toBe('high');
    const soft = dependencies.find((d) => d.targetId === 'kn_c');
    expect(soft?.criticality).toBe('low');
  });

  it('lists the edge types an item participates in', () => {
    const item = createCatalogKnowledgeItems().find(
      (i) => i.knowledgeId === 'kn_blog_pipeline_playbook',
    );
    expect(item).toBeDefined();
    if (!item) return;
    const types = service.relationshipTypes(item);
    expect(types).toContain('depends_on');
    expect(types).toContain('supersedes');
  });
});
