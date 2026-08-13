// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Intelligence: Version Service
// EI-009 — Enterprise Knowledge Intelligence Platform
// Versioning + the Knowledge Diff Viewer. Every edit snapshots the
// previous revision into `versionHistory` (title/description/tags) so
// VedMoulya always knows WHAT changed, WHEN, and BY WHOM. The diff
// between any two versions is computed deterministically — field-level
// change detection with added/removed tags.
// ──────────────────────────────────────────────────────────────────

import type {
  KnowledgeDiff,
  KnowledgeItem,
  KnowledgeVersion,
} from '../../types/knowledge-types.js';
import { generateVersionId } from '../value-objects/KnowledgeId.js';

export interface VersionResult {
  item: KnowledgeItem;
  version: KnowledgeVersion;
}

export class KnowledgeVersionService {
  /** Snapshot the current revision and bump the item to version + 1. */
  // Note: the snapshot captures the state AT bump time, so an item's current
  // content enters the history on its NEXT bump; the diff between two
  // consecutive snapshots always reflects what changed in between.
  createVersion(item: KnowledgeItem, changeSummary: string, actor: string): VersionResult {
    const versionNumber = item.version + 1;
    const now = new Date().toISOString();
    const version: KnowledgeVersion = {
      versionId: generateVersionId(),
      knowledgeId: item.knowledgeId,
      versionNumber,
      title: item.title,
      description: item.description,
      tags: [...item.tags],
      changeSummary: changeSummary || `Version ${versionNumber}`,
      actor,
      createdAt: now,
    };
    return {
      item: {
        ...item,
        version: versionNumber,
        versionHistory: [...item.versionHistory, version],
        updatedAt: now,
      },
      version,
    };
  }

  /** All snapshots of an item, oldest → newest. */
  listVersions(item: KnowledgeItem): KnowledgeVersion[] {
    return [...item.versionHistory].sort((a, b) => a.versionNumber - b.versionNumber);
  }

  /** One snapshot by version number. */
  getVersion(item: KnowledgeItem, versionNumber: number): KnowledgeVersion | undefined {
    return item.versionHistory.find((v) => v.versionNumber === versionNumber);
  }

  /** Diff two snapshots (defaults: the last two existing versions). */
  diff(item: KnowledgeItem, fromVersion?: number, toVersion?: number): KnowledgeDiff | undefined {
    const history = this.listVersions(item);
    const last = history[history.length - 1];
    const previous = history[history.length - 2];
    if (!last || !previous) return undefined;

    const from =
      fromVersion !== undefined ? history.find((v) => v.versionNumber === fromVersion) : previous;
    const to = toVersion !== undefined ? history.find((v) => v.versionNumber === toVersion) : last;
    if (!from || !to || from.versionNumber >= to.versionNumber) return undefined;

    const changedFields: string[] = [];
    const titleChanged = from.title !== to.title;
    const descriptionChanged = from.description !== to.description;
    if (titleChanged) changedFields.push('title');
    if (descriptionChanged) changedFields.push('description');

    const tagsAdded = to.tags.filter((tag) => !from.tags.includes(tag));
    const tagsRemoved = from.tags.filter((tag) => !to.tags.includes(tag));
    if (tagsAdded.length > 0) changedFields.push('tags');

    const summary = [
      titleChanged ? 'title changed' : null,
      descriptionChanged ? 'description changed' : null,
      tagsAdded.length > 0 ? `+${tagsAdded.join(', ')}` : null,
      tagsRemoved.length > 0 ? `−${tagsRemoved.join(', ')}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      knowledgeId: item.knowledgeId,
      fromVersion: from.versionNumber,
      toVersion: to.versionNumber,
      changedFields,
      titleChanged,
      descriptionChanged,
      tagsAdded,
      tagsRemoved,
      summary: summary || 'no content changes',
    };
  }
}
