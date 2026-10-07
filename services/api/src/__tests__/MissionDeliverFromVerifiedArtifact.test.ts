// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — REVENUE-001 · verified artifact → deliverable DRAFT
//
// Proves the artifact→delivery bridge contract used by the web panel: a REAL,
// already-VERIFIED objective plus the (human-reviewed) derived artifact content
// produce a ClientOps DRAFT deliverable — and NOTHING external happens.
//
//   • the derived draft content reaches ClientOps verbatim
//   • pendingApproval stays TRUE (a human always submits externally)
//   • an unverified objective is refused (the deterministic VERIFIED gate)
//   • an empty artifact is refused (no fabricated deliverable)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type { DocumentRecord } from '@vedmoulya/domain';
import {
  MissionClientOpsHandoffService,
  type ClientOpsDocumentStore,
  type HandoffMissionView,
  type MissionLookup,
} from '../services/MissionClientOpsHandoff.js';

const NOW = new Date('2026-10-07T00:10:00.000Z');

function mission(state: string): HandoffMissionView {
  return {
    missionId: 'm-1',
    userId: 'u-1',
    title: 'Build the greeting asset',
    objectives: [
      {
        objectiveId: 'obj-1',
        state,
        title: 'Write greeting.md',
        verifiedOutcome:
          state === 'VERIFIED'
            ? {
                outcome: 'File written and read back with exact content.',
                method: 'command',
                evidence: ['workspace_read ok'],
                verifiedAt: '2026-10-07T00:05:00.000Z',
              }
            : null,
      },
    ],
  };
}

class Store implements ClientOpsDocumentStore {
  readonly documents: DocumentRecord[] = [];
  async listDocuments(userId: string): Promise<DocumentRecord[]> {
    return this.documents.filter((document) => document.userId === userId);
  }
  async saveDocument(document: DocumentRecord): Promise<void> {
    this.documents.push(document);
  }
}

const missions = (state: string): MissionLookup => ({
  get: async () => mission(state),
});

/** The same deterministic draft the web panel derives from the read model. */
const DERIVED_CONTENT = [
  '# Write greeting.md',
  '',
  '## Verified outcome',
  'File written and read back with exact content.',
  '',
  '## Evidence',
  '- workspace_read ok',
].join('\n');

describe('REVENUE-001 — verified artifact → deliverable draft', () => {
  it('stores the derived artifact as a DRAFT and keeps pendingApproval true', async () => {
    const clientOps = new Store();
    const service = new MissionClientOpsHandoffService({
      missions: missions('VERIFIED'),
      clientOps,
      now: () => NOW,
    });

    const result = await service.handoffVerifiedOutcome({
      userId: 'u-1',
      missionId: 'm-1',
      objectiveId: 'obj-1',
      clientId: 'client-1',
      deliverableName: 'Write greeting.md',
      deliverableContent: DERIVED_CONTENT,
      opportunityId: 'opp-1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pendingApproval).toBe(true);
    expect(result.created).toBe(true);
    // The artifact reached ClientOps verbatim, as a draft.
    const stored = clientOps.documents[0];
    expect(stored.metadata.opportunityId).toBe('opp-1');
    expect(stored.metadata.verificationMethod).toBe('command');
  });

  it('refuses an unverified objective — no deliverable is fabricated', async () => {
    const clientOps = new Store();
    const service = new MissionClientOpsHandoffService({
      missions: missions('RUNNING'),
      clientOps,
      now: () => NOW,
    });

    const result = await service.handoffVerifiedOutcome({
      userId: 'u-1',
      missionId: 'm-1',
      objectiveId: 'obj-1',
      clientId: 'client-1',
      deliverableName: 'Write greeting.md',
      deliverableContent: DERIVED_CONTENT,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('OBJECTIVE_NOT_VERIFIED');
    expect(clientOps.documents).toHaveLength(0);
  });

  it('refuses an empty artifact — no empty deliverable is created', async () => {
    const clientOps = new Store();
    const service = new MissionClientOpsHandoffService({
      missions: missions('VERIFIED'),
      clientOps,
      now: () => NOW,
    });

    const result = await service.handoffVerifiedOutcome({
      userId: 'u-1',
      missionId: 'm-1',
      objectiveId: 'obj-1',
      clientId: 'client-1',
      deliverableName: 'Write greeting.md',
      deliverableContent: '   ',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('MISSING_ARTIFACT');
    expect(clientOps.documents).toHaveLength(0);
  });
});
