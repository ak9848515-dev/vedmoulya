import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { describe, expect, it } from 'vitest';
import { PostgresOpportunityMissionLinkStore } from '@vedmoulya/control-plane';
import { PostgresMissionStore } from '@vedmoulya/mission-runtime';
import type { Mission } from '@vedmoulya/mission-controller';

const localTestUrl = 'postgres://vedmoulya:vedmoulya-dev@localhost:5432/vedmoulya';
const databaseUrl = process.env.POSTGRES_TEST_URL ?? localTestUrl;
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
  'opportunity Mission launch PostgreSQL recovery',
  () => {
    it('hydrates a pending intent after a fresh store connection and finalizes it idempotently', async () => {
      const ownerId = `sprint010-${randomUUID()}`;
      const opportunityId = `opportunity-${randomUUID()}`;
      const link = {
        userId: ownerId,
        opportunityId,
        missionId: `mission_opportunity_${randomUUID()}`,
        createdAt: new Date().toISOString(),
      };
      const firstSql = postgres(databaseUrl, { max: 1 });
      const firstStore = new PostgresOpportunityMissionLinkStore(firstSql);
      await firstStore.ensureTable();
      expect(await firstStore.claimLaunch(link)).toMatchObject({ ...link, status: 'PENDING' });
      const missions = new PostgresMissionStore(firstSql);
      await missions.ensureTable();
      const mission = {
        missionId: link.missionId,
        userId: ownerId,
        title: 'Original persisted Mission',
      } as Mission;
      expect(await missions.createIfAbsent(mission)).toMatchObject(mission);
      await firstSql.end();

      const restartedSql = postgres(databaseUrl, { max: 1 });
      const restartedStore = new PostgresOpportunityMissionLinkStore(restartedSql);
      await restartedStore.ensureTable();
      await restartedStore.hydrate();
      expect(restartedStore.getLaunch(ownerId, opportunityId)).toMatchObject({
        ...link,
        status: 'PENDING',
      });
      const restartedMissions = new PostgresMissionStore(restartedSql);
      await restartedMissions.ensureTable();
      await restartedMissions.hydrate();
      const retry = await restartedMissions.createIfAbsent({
        ...mission,
        title: 'Retry must reuse the persisted Mission',
      });
      expect(retry.title).toBe('Original persisted Mission');
      expect(await restartedMissions.listByUserId(ownerId)).toHaveLength(1);
      await expect(restartedStore.completeLaunch(link)).resolves.toMatchObject({
        ...link,
        status: 'LINKED',
      });
      await restartedSql.end();

      const verifySql = postgres(databaseUrl, { max: 1 });
      const verifyStore = new PostgresOpportunityMissionLinkStore(verifySql);
      await verifyStore.hydrate();
      expect(verifyStore.getByOpportunity(ownerId, opportunityId)).toMatchObject(link);
      await verifySql.end();
    }, 15_000);
  },
);
