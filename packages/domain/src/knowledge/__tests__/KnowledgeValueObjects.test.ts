// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Value Objects Tests
// Covers RelationshipType, KnowledgeSource, KnowledgeQuality,
// KnowledgeVersion, KnowledgeLineage, and the branded ID generators.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { RelationshipType } from '../value-objects/RelationshipType.js';
import { KnowledgeSource } from '../value-objects/KnowledgeSource.js';
import { KnowledgeQuality } from '../value-objects/KnowledgeQuality.js';
import { KnowledgeVersion } from '../value-objects/KnowledgeVersion.js';
import { KnowledgeLineage } from '../value-objects/KnowledgeLineage.js';
import {
  createKnowledgeNodeId,
  generateKnowledgeNodeId,
} from '../value-objects/KnowledgeNodeId.js';
import {
  createKnowledgeEdgeId,
  generateKnowledgeEdgeId,
} from '../value-objects/KnowledgeEdgeId.js';
import { createGraphId, generateGraphId } from '../value-objects/GraphId.js';

describe('RelationshipType', () => {
  it('defines the standard relationship types with correct categories', () => {
    expect(RelationshipType.HAS_GOAL().category).toBe('ownership');
    expect(RelationshipType.DEPENDS_ON().category).toBe('dependency');
    expect(RelationshipType.COMPLETED().category).toBe('progression');
    expect(RelationshipType.RESULTED_IN().category).toBe('causality');
    expect(RelationshipType.PART_OF().category).toBe('composition');
    expect(RelationshipType.REFERENCES().category).toBe('association');
    expect(RelationshipType.ATTENDED().category).toBe('temporal');
  });

  it('creates custom types and exposes type/category/label', () => {
    const custom = RelationshipType.custom('CUSTOM', 'association', 'custom label');
    expect(custom.type).toBe('CUSTOM');
    expect(custom.label).toBe('custom label');
  });

  it('category predicates', () => {
    expect(RelationshipType.HAS_GOAL().isOwnership()).toBe(true);
    expect(RelationshipType.LEARNED().isProgression()).toBe(true);
    expect(RelationshipType.DEPENDS_ON().isDependency()).toBe(true);
    expect(RelationshipType.CAUSED().isCausality()).toBe(true);
    expect(RelationshipType.PART_OF().isComposition()).toBe(true);
    expect(RelationshipType.RELATED_TO().isAssociation()).toBe(true);
    expect(RelationshipType.OCCURRED_AT().isTemporal()).toBe(true);
  });

  it('equals compares by type and toString returns the type', () => {
    expect(RelationshipType.DEPENDS_ON().equals(RelationshipType.DEPENDS_ON())).toBe(true);
    expect(RelationshipType.DEPENDS_ON().equals(RelationshipType.SUPPORTS())).toBe(false);
    expect(RelationshipType.DEPENDS_ON().toString()).toBe('DEPENDS_ON');
  });
});

describe('KnowledgeSource', () => {
  it('creates typed sources with detail and timestamp', () => {
    const source = KnowledgeSource.userInput('manual');
    expect(source.type).toBe('user_input');
    expect(source.detail).toBe('manual');
    expect(source.timestamp).toBeInstanceOf(Date);
    expect(KnowledgeSource.aiInference('a').type).toBe('ai_inference');
    expect(KnowledgeSource.systemGenerated('s').type).toBe('system_generated');
    expect(KnowledgeSource.importSource('i').type).toBe('import');
    expect(KnowledgeSource.integration('i').type).toBe('integration');
    expect(KnowledgeSource.conversation('c').type).toBe('conversation');
    expect(KnowledgeSource.document('d').type).toBe('document');
    expect(KnowledgeSource.learning('l').type).toBe('learning');
  });

  it('equals compares type and detail, toString formats', () => {
    expect(KnowledgeSource.userInput('x').equals(KnowledgeSource.userInput('x'))).toBe(true);
    expect(KnowledgeSource.userInput('x').equals(KnowledgeSource.userInput('y'))).toBe(false);
    expect(KnowledgeSource.userInput('x').toString()).toBe('user_input: x');
  });
});

describe('KnowledgeQuality', () => {
  it('clamps metric values to 0..1', () => {
    const q = new KnowledgeQuality({ accuracy: 5, completeness: -2 });
    expect(q.accuracy).toBe(1);
    expect(q.completeness).toBe(0);
    expect(q.consistency).toBe(0);
  });

  it('initial and high presets', () => {
    expect(KnowledgeQuality.initial().accuracy).toBe(0.5);
    expect(KnowledgeQuality.high().overall).toBe(1);
  });

  it('overall score, isHighQuality, isAcceptable', () => {
    expect(KnowledgeQuality.high().isHighQuality()).toBe(true);
    expect(KnowledgeQuality.initial().isAcceptable()).toBe(true);
    expect(KnowledgeQuality.initial().isHighQuality()).toBe(false);
    const low = new KnowledgeQuality({
      accuracy: 0.1,
      completeness: 0.1,
      consistency: 0.1,
      timeliness: 0.1,
      relevance: 0.1,
    });
    expect(low.isAcceptable()).toBe(false);
  });

  it('toMetrics and equals', () => {
    const q = KnowledgeQuality.high();
    expect(q.toMetrics().accuracy).toBe(1);
    expect(q.equals(KnowledgeQuality.high())).toBe(true);
    expect(q.equals(KnowledgeQuality.initial())).toBe(false);
  });
});

describe('KnowledgeVersion', () => {
  it('constructs, parses, and formats versions', () => {
    expect(KnowledgeVersion.initial().toString()).toBe('1.0.0');
    expect(KnowledgeVersion.fromString('2.3.4').minor).toBe(3);
    expect(() => KnowledgeVersion.fromString('bad')).toThrow(/Invalid version/);
    expect(KnowledgeVersion.fromString('1.2.3').toInfo()).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
    });
  });

  it('bumps major/minor/patch', () => {
    const v = KnowledgeVersion.initial();
    expect(v.bumpMajor().toString()).toBe('2.0.0');
    expect(v.bumpMinor().toString()).toBe('1.1.0');
    expect(v.bumpPatch().toString()).toBe('1.0.1');
  });

  it('isNewerThan compares by semver', () => {
    expect(new KnowledgeVersion(2, 0, 0).isNewerThan(new KnowledgeVersion(1, 9, 9))).toBe(true);
    expect(new KnowledgeVersion(1, 2, 0).isNewerThan(new KnowledgeVersion(1, 1, 9))).toBe(true);
    expect(new KnowledgeVersion(1, 1, 2).isNewerThan(new KnowledgeVersion(1, 1, 1))).toBe(true);
    expect(new KnowledgeVersion(1, 1, 1).isNewerThan(new KnowledgeVersion(1, 1, 2))).toBe(false);
  });

  it('equals compares all parts', () => {
    expect(KnowledgeVersion.initial().equals(KnowledgeVersion.initial())).toBe(true);
    expect(KnowledgeVersion.initial().equals(KnowledgeVersion.fromString('1.0.1'))).toBe(false);
  });
});

describe('KnowledgeLineage', () => {
  it('creates initial lineage and exposes entries', () => {
    const lineage = KnowledgeLineage.initial('knowledge.node.created', 'src-1', 'created');
    expect(lineage.length).toBe(1);
    expect(lineage.first?.sourceId).toBe('src-1');
    expect(lineage.last?.sourceId).toBe('src-1');
    expect(lineage.entries).toHaveLength(1);
  });

  it('addEntry appends and hasSource matches', () => {
    const lineage = KnowledgeLineage.initial('knowledge.node.created', 'src-1', 'c');
    const next = lineage.addEntry('knowledge.node.updated', 'src-2', 'u');
    expect(next.length).toBe(2);
    expect(next.last?.description).toBe('u');
    expect(next.hasSource('src-2')).toBe(true);
    expect(lineage.hasSource('zzz')).toBe(false);
    expect(lineage.length).toBe(1); // immutable
  });

  it('equals compares entries', () => {
    const a = KnowledgeLineage.initial('knowledge.node.created', 's1', 'c');
    const b = KnowledgeLineage.initial('knowledge.node.created', 's1', 'c');
    const c = KnowledgeLineage.initial('knowledge.node.updated', 's1', 'c');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

describe('Knowledge ID generators', () => {
  it('creates branded ids and generates unique ids', () => {
    expect(createKnowledgeNodeId('raw')).toBe('raw');
    expect(generateKnowledgeNodeId()).toMatch(/^kn_/);
    expect(generateKnowledgeNodeId()).not.toBe(generateKnowledgeNodeId());
    expect(createKnowledgeEdgeId('e')).toBe('e');
    expect(generateKnowledgeEdgeId()).toMatch(/^ke_/);
    expect(createGraphId('g')).toBe('g');
    expect(generateGraphId()).toMatch(/^kg_/);
  });
});
