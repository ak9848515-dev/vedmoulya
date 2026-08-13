// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Version + Diff tests
// EI-009 — Enterprise Knowledge Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { KnowledgeVersionService } from '../KnowledgeVersionService.js';
import type { KnowledgeItem } from '../../../types/knowledge-types.js';
import { createCatalogKnowledgeItems } from '../../../catalog/knowledge-catalog.js';

const NOW = '2026-08-01T00:00:00.000Z';

function item(overrides: Partial<KnowledgeItem> = {}): KnowledgeItem {
  return {
    ...createCatalogKnowledgeItems()[0],
    version: 1,
    versionHistory: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('KnowledgeVersionService', () => {
  const service = new KnowledgeVersionService();

  it('snapshots the current revision and bumps the version', () => {
    const { item: updated, version } = service.createVersion(item(), 'First snapshot', 'owner');
    expect(updated.version).toBe(2);
    expect(version.versionNumber).toBe(2);
    expect(updated.versionHistory.length).toBe(1);
    expect(updated.versionHistory[0].changeSummary).toBe('First snapshot');
    expect(updated.versionHistory[0].actor).toBe('owner');
  });

  it('lists versions oldest → newest', () => {
    let current = item();
    for (const summary of ['v2', 'v3']) {
      current = service.createVersion(current, summary, 'owner').item;
    }
    const versions = service.listVersions(current);
    expect(versions.map((v) => v.versionNumber)).toEqual([2, 3]);
  });

  it('gets a version by number', () => {
    const { item: updated } = service.createVersion(item(), 's', 'owner');
    const version = service.getVersion(updated, 2);
    expect(version?.versionNumber).toBe(2);
    expect(service.getVersion(updated, 99)).toBeUndefined();
  });

  it('computes a diff across versions with added/removed tags', () => {
    const original = item();
    let current = service.createVersion(original, 'First snapshot', 'owner').item;
    current = {
      ...current,
      title: 'A brand new title',
      description: 'Completely different description',
      tags: [...current.tags.filter((t) => t !== 'openai'), 'cost'],
    };
    current = service.createVersion(current, 'Second snapshot', 'owner').item;
    const diff = service.diff(current);
    expect(diff).toBeDefined();
    expect(diff?.titleChanged).toBe(true);
    expect(diff?.descriptionChanged).toBe(true);
    expect(diff?.changedFields).toContain('title');
    expect(diff?.tagsAdded).toContain('cost');
    expect(diff?.tagsRemoved).toContain('openai');
  });

  it('returns undefined when fewer than two versions exist', () => {
    expect(service.diff(item())).toBeUndefined();
  });

  it('diff between explicit versions respects ordering', () => {
    const original = item();
    let current = service.createVersion(original, 'v2', 'owner').item;
    current = service.createVersion({ ...current, title: 'Renamed' }, 'v3', 'owner').item;
    const diff = service.diff(current, 2, 3);
    expect(diff?.fromVersion).toBe(2);
    expect(diff?.toVersion).toBe(3);
    expect(service.diff(current, 3, 2)).toBeUndefined();
  });

  it('summarizes no-op diffs', () => {
    const original = item();
    let current = service.createVersion(original, 'v2', 'owner').item;
    current = service.createVersion({ ...current, source: 'other source' }, 'v3', 'owner').item;
    const diff = service.diff(current);
    expect(diff?.summary).toBe('no content changes');
  });
});
