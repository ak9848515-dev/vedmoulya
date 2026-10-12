import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { describe, expect, it } from 'vitest';
import {
  ActiveIntelligenceControlPlane,
  InMemoryControlStores,
  PostgresOpportunityMissionLinkStore,
  PostgresOpportunityStore,
} from '@vedmoulya/control-plane';
import type { OpportunityLifecycleRecord } from '@vedmoulya/control-plane';
import { PostgresMissionStore } from '@vedmoulya/mission-runtime';
import type { Mission } from '@vedmoulya/mission-controller';
import { createControlRouter } from '../routers/ControlRouter.js';

const databaseUrl =
  process.env.POSTGRES_TEST_URL ?? 'postgres://vedmoulya:vedmoulya-dev@localhost:5432/vedmoulya';
const probe = postgres(databaseUrl, { max: 1, connect_timeout: 2 });
let postgresAvailable = false;
try {
  await probe`SELECT 1`;
  postgresAvailable = true;
} catch {
  postgresAvailable = false;
} finally {
  await probe.end().catch(() => undefined);
}

(postgresAvailable ? describe : describe.skip)(
  'joined opportunity Mission trace on Postgres',
  () => {
    it('reconstructs owner-scoped origin, approval, launch intent and Mission across fresh connections', async () => {
      const ownerId = `sprint012-trace-${randomUUID()}`;
      const opportunityId = `opportunity-${randomUUID()}`;
      const missionId = `mission-${randomUUID()}`;
      const now = new Date().toISOString();
      const opportunity: OpportunityLifecycleRecord = {
        id: opportunityId,
        ownerId,
        stableKey: `${ownerId}:${opportunityId}`,
        title: 'Traceable opportunity',
        description: 'Source description retained in its existing owner record.',
        category: 'delivery',
        status: 'PLANNED',
        evidence: [],
        riskLevel: 'LOW',
        automationPotential: 'MEDIUM',
        approval: {
          id: `approval-${randomUUID()}`,
          grantedBy: ownerId,
          grantedAt: now,
          scope: 'mission',
        },
        transitions: [],
        createdAt: now,
        updatedAt: now,
      };
      const mission = {
        missionId,
        userId: ownerId,
        title: 'Traceable Mission',
        objective: 'Complete the approved opportunity',
        description: 'Complete the approved opportunity',
        autonomyLevel: 'CONTROLLED_AUTONOMOUS',
        budget: {},
        budgetUsage: {},
        constraints: {},
        state: 'COMPLETED',
        stateHistory: ['CREATED', 'RUNNING', 'COMPLETED'],
        objectives: [
          {
            objectiveId: `objective-${missionId}`,
            missionId,
            executionRunId: `run-${missionId}`,
            executionTraces: [
              {
                runId: `run-${missionId}`,
                goalId: `goal-${missionId}`,
                planId: `plan-${missionId}`,
                state: 'COMPLETED',
                startedAt: now,
                finishedAt: now,
                usage: {
                  tokens: 20,
                  costUsd: 0.001,
                  latencyMs: 120,
                  toolCalls: 1,
                  attempts: 1,
                  revisions: 0,
                },
                actions: [
                  {
                    actionId: `action-${missionId}`,
                    stepId: 'step-1',
                    attempt: 1,
                    status: 'succeeded',
                    startedAt: now,
                    endedAt: now,
                    observationId: `observation-${missionId}`,
                    provider: 'deterministic-test',
                    toolName: 'safe-test-tool',
                    artifacts: [{ name: 'result.txt', type: 'text/plain' }],
                  },
                ],
                observations: [
                  {
                    observationId: `observation-${missionId}`,
                    actionId: `action-${missionId}`,
                    stepId: 'step-1',
                    attempt: 1,
                    status: 'succeeded',
                    observedAt: now,
                    provider: 'deterministic-test',
                    toolName: 'safe-test-tool',
                  },
                ],
              },
            ],
          },
        ],
        checkpoints: [],
        decisions: [],
        successCriteria: [],
        outcome: 'ACHIEVED',
        createdAt: now,
        updatedAt: now,
        finishedAt: now,
      } as unknown as Mission;

      const writeSql = postgres(databaseUrl, { max: 1 });
      const writeOpportunities = new PostgresOpportunityStore(writeSql);
      const writeLinks = new PostgresOpportunityMissionLinkStore(writeSql);
      const writeMissions = new PostgresMissionStore(writeSql);
      await Promise.all([
        writeOpportunities.ensureTable(),
        writeLinks.ensureTable(),
        writeMissions.ensureTable(),
      ]);
      await Promise.all([
        writeOpportunities.hydrate(),
        writeLinks.hydrate(),
        writeMissions.hydrate(),
      ]);
      writeOpportunities.save(opportunity);
      await writeOpportunities.flush();
      const intent = await writeLinks.claimLaunch({
        userId: ownerId,
        opportunityId,
        missionId,
        createdAt: now,
      });
      expect(intent.status).toBe('PENDING');
      await writeMissions.saveRequired(mission);
      await writeLinks.completeLaunch({
        userId: ownerId,
        opportunityId,
        missionId,
        createdAt: now,
      });
      await writeSql.end();

      const readSql = postgres(databaseUrl, { max: 1 });
      const opportunities = new PostgresOpportunityStore(readSql);
      const links = new PostgresOpportunityMissionLinkStore(readSql);
      const missions = new PostgresMissionStore(readSql);
      await Promise.all([opportunities.ensureTable(), links.ensureTable(), missions.ensureTable()]);
      await Promise.all([opportunities.hydrate(), links.hydrate(), missions.hydrate()]);
      expect(
        (await missions.get(missionId))?.objectives[0]?.executionTraces?.[0]?.actions[0]
          ?.observationId,
      ).toBe(`observation-${missionId}`);
      const memory = new InMemoryControlStores();
      const plane = new ActiveIntelligenceControlPlane({
        brain: { listTasksWithApprovals: () => [], outcomeCount: () => 0 },
        proactive: { refresh: async () => ({ success: true }), listRecommendations: () => [] },
        fabric: {} as never,
        stores: { ...memory, opportunities, opportunityMissionLinks: links },
        now: () => now,
      });
      const router = createControlRouter(plane, {
        approval: {} as never,
        qualify: (() => ({})) as never,
        mission: {
          launch: async () => ({
            success: false,
            code: 'MISSION_CREATION_FAILED',
            message: 'unused',
          }),
        },
        readMissionTrace: async (userId, id) => {
          const record = await missions.get(id);
          if (!record || record.userId !== userId) throw new Error('mission not found for user');
          return {
            missionId: record.missionId,
            userId: record.userId,
            state: record.state,
            outcome: record.outcome,
          };
        },
      });
      const result = await router.getMissionTrace({ userId: ownerId, missionId }, {
        userId: ownerId,
      } as never);
      expect(result.data).toMatchObject({
        origin: { kind: 'OPPORTUNITY', status: 'FOUND', opportunityId, lifecycleStatus: 'PLANNED' },
        approval: { status: 'APPROVED', approvalId: opportunity.approval?.id },
        launchIntent: { status: 'LINKED', opportunityId, missionId },
        mission: { missionId, userId: ownerId, state: 'COMPLETED', outcome: 'ACHIEVED' },
      });
      const foreign = await router.getMissionTrace({ userId: `${ownerId}-foreign`, missionId }, {
        userId: `${ownerId}-foreign`,
      } as never);
      expect(foreign.success).toBe(false);
      await readSql.end();
    });
  },
);
