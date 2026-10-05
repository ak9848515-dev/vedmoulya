// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S4 Mission → ClientOps integration
//
// Composes the REAL bridge with the REAL ClientOps repository implementation
// (InMemoryClientOpsRepository — the canonical ClientOpsRepository contract,
// the same interface PostgresClientOpsRepository implements). This is the
// contract-compatibility test: the focused suite uses a hand-written store
// double, so only this proves the bridge speaks the real persistence shape.
//
// The Mission side supplies the VERIFIED objective exactly as MissionService's
// owner-scoped status view projects it — no MockProvider, no fabricated
// success: the objective state under test is the one the gate reads.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { InMemoryClientOpsRepository } from '@vedmoulya/services';
import {
  MissionClientOpsHandoffService,
  handoffDocumentId,
  type HandoffMissionView,
} from '../services/MissionClientOpsHandoff.js';

const NOW = new Date('2026-10-05T09:00:00.000Z');

/** A Mission view shaped exactly like MissionService.buildView() projects it. */
function verifiedMissionView(userId = 'owner-1'): HandoffMissionView {
  return {
    missionId: 'mission_integration_1',
    userId,
    title: 'Produce the client audit summary',
    objectives: [
      {
        objectiveId: 'objective_1',
        state: 'VERIFIED',
        title: 'Write the audit summary',
        verifiedOutcome: {
          outcome: 'Write the audit summary',
          method: 'process-exit',
          evidence: ['command exit code 0'],
          verifiedAt: '2026-10-05T08:59:00.000Z',
        },
      },
    ],
  };
}

function service(missionView: HandoffMissionView, repo: InMemoryClientOpsRepository) {
  return new MissionClientOpsHandoffService({
    missions: { get: async () => missionView },
    clientOps: repo,
    now: () => NOW,
  });
}

describe('S4 integration — VERIFIED Mission outcome → real ClientOps store', () => {
  it('lands a draft deliverable in the real repository, pending approval', async () => {
    const repo = new InMemoryClientOpsRepository();

    const result = await service(verifiedMissionView(), repo).handoffVerifiedOutcome({
      userId: 'owner-1',
      missionId: 'mission_integration_1',
      objectiveId: 'objective_1',
      clientId: 'client_acme',
      deliverableName: 'audit-summary.md',
      deliverableContent: '# Audit summary\n\nFindings…',
      deliverableMime: 'text/markdown',
      opportunityId: 'opportunity_7',
    });

    expect(result.ok).toBe(true);
    if (result.ok === false) return;
    expect(result.pendingApproval).toBe(true);

    // Round-trip through the REAL repository, scoped to the owner.
    const stored = await repo.listDocuments('owner-1');
    expect(stored).toHaveLength(1);
    const document = stored[0]!;
    expect(document.id).toBe(handoffDocumentId('owner-1', 'mission_integration_1', 'objective_1'));
    expect(document.userId).toBe('owner-1');
    expect(document.clientId).toBe('client_acme');
    expect(document.mime).toBe('text/markdown');
    expect(document.metadata).toMatchObject({
      source: 'mission-verified-handoff',
      missionId: 'mission_integration_1',
      objectiveId: 'objective_1',
      verificationMethod: 'process-exit',
      opportunityId: 'opportunity_7',
    });
    // A draft is a draft: nothing is marked as sent or paid.
    expect(document.metadata).not.toHaveProperty('sentAt');
    expect(document.metadata).not.toHaveProperty('paidAt');
  });

  it('is idempotent across the real repository (replayed handoff)', async () => {
    const repo = new InMemoryClientOpsRepository();
    const bridge = service(verifiedMissionView(), repo);
    const input = {
      userId: 'owner-1',
      missionId: 'mission_integration_1',
      objectiveId: 'objective_1',
      clientId: 'client_acme',
      deliverableName: 'audit-summary.md',
      deliverableContent: '# Audit summary',
    };

    await bridge.handoffVerifiedOutcome(input);
    const replay = await bridge.handoffVerifiedOutcome(input);

    expect(replay.ok === true && replay.created).toBe(false);
    expect(await repo.listDocuments('owner-1')).toHaveLength(1);
  });

  it('keeps two owners isolated in the real repository', async () => {
    const repo = new InMemoryClientOpsRepository();

    await service(verifiedMissionView('owner-1'), repo).handoffVerifiedOutcome({
      userId: 'owner-1',
      missionId: 'mission_integration_1',
      objectiveId: 'objective_1',
      clientId: 'client_acme',
      deliverableName: 'a.md',
      deliverableContent: 'a',
    });
    await service(verifiedMissionView('owner-2'), repo).handoffVerifiedOutcome({
      userId: 'owner-2',
      missionId: 'mission_integration_1',
      objectiveId: 'objective_1',
      clientId: 'client_globex',
      deliverableName: 'b.md',
      deliverableContent: 'b',
    });

    expect(await repo.listDocuments('owner-1')).toHaveLength(1);
    expect(await repo.listDocuments('owner-2')).toHaveLength(1);
    expect((await repo.listDocuments('owner-1'))[0]!.clientId).toBe('client_acme');
  });

  it('owner-2 cannot hand off owner-1 mission, and nothing is stored', async () => {
    const repo = new InMemoryClientOpsRepository();

    const result = await service(verifiedMissionView('owner-1'), repo).handoffVerifiedOutcome({
      userId: 'owner-2',
      missionId: 'mission_integration_1',
      objectiveId: 'objective_1',
      clientId: 'client_acme',
      deliverableName: 'x.md',
      deliverableContent: 'x',
    });

    expect(result.ok === false && result.reason).toBe('NOT_OWNER');
    expect(await repo.listDocuments('owner-1')).toHaveLength(0);
    expect(await repo.listDocuments('owner-2')).toHaveLength(0);
  });
});
