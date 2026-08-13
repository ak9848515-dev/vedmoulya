// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: In-Memory Repository tests
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { InMemoryOSRepository } from '../InMemoryOSRepository.js';
import { createCatalogOSSnapshot } from '../../catalog/os-catalog.js';

const repo = new InMemoryOSRepository();

describe('InMemoryOSRepository', () => {
  it('saves and lists snapshots newest-first', async () => {
    await repo.saveSnapshot(createCatalogOSSnapshot());
    const later = {
      ...createCatalogOSSnapshot(),
      snapshotId: 'snapshot_os_later',
      checkedAt: '2026-08-06T13:00:00.000Z',
    };
    await repo.saveSnapshot(later);
    const snapshots = await repo.listSnapshots();
    expect(snapshots[0]?.snapshotId).toBe('snapshot_os_later');
    expect(snapshots).toHaveLength(2);
  });

  it('supports a list limit', async () => {
    const snapshots = await repo.listSnapshots(1);
    expect(snapshots).toHaveLength(1);
  });

  it('deduplicates by snapshot id (upsert)', async () => {
    const seed = createCatalogOSSnapshot();
    await repo.saveSnapshot(seed);
    await repo.saveSnapshot({ ...seed, overallScore: 90 });
    const snapshots = await repo.listSnapshots();
    expect(snapshots.filter((s) => s.snapshotId === seed.snapshotId)).toHaveLength(1);
  });

  it('counts snapshots', async () => {
    expect(await repo.countSnapshots()).toBeGreaterThan(0);
  });

  it('no-ops ensureTable (Map-backed double)', async () => {
    await expect(repo.ensureTable()).resolves.toBeUndefined();
  });

  it('returns an empty list when nothing was saved', async () => {
    const empty = new InMemoryOSRepository();
    expect(await empty.listSnapshots()).toEqual([]);
    expect(await empty.countSnapshots()).toBe(0);
  });
});
