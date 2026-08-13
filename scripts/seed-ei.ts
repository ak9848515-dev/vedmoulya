// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — EI Seed Migration
// Loads the Enterprise Intelligence platform seed catalogs into the Postgres
// EI tables so the gateway's production repositories (Postgres-backed by
// default since CERT-002 C-04) serve the same platform catalogs the in-memory
// registries used to seed.
//
// Stores seeded (11 catalogs / 11 tables):
//   capability_registry          ← createCatalogCapabilities()   (EI-001)
//   provider_registry            ← createCatalogProviders()      (EI-002)
//   context_registry             ← createCatalogContext()        (EI-003)
//   execution_strategy_registry  ← createCatalogStrategies()     (EI-004)
//   goal_registry                ← createCatalogGoals()          (EI-006)
//   learning_registry            ← createCatalogLearningEvents() (EI-007)
//   brain_registry               ← createCatalogBrainPlan()      (EI-008)
//   knowledge_registry           ← createCatalogKnowledgeItems() (EI-009)
//   memory_registry              ← createCatalogMemoryItems()    (EI-010)
//   os_health_registry           ← createCatalogOSSnapshot()     (OS-001)
//   context_fabric_registry      ← createCatalogFabric*()        (APP-001)
//
// Idempotent: every repository writes with `INSERT … ON CONFLICT (id) DO
// UPDATE`, so re-running updates the seed rows instead of duplicating them.
// No rows are ever deleted.
//
// Resolves the database URL from the environment without touching the
// fail-fast @vedmoulya/core configuration (which also gates AUTH_JWT_SECRET),
// mirroring the gateway's resolution exactly (`config.database.url` reads
// IDENTITY_DATABASE_URL with the same dev default):
//   EI_DATABASE_URL → IDENTITY_DATABASE_URL → postgres://localhost:5432/vedmoulya
// EI_DATABASE_URL exists for seeding a different database explicitly.
//
// Run:
//   npm run seed:ei                 # seed all five stores
//   npm run seed:ei -- --only capabilities,providers
//   npx tsx scripts/seed-ei.ts --dry-run   # print the plan, connect to nothing
// ─────────────────────────────────────────────────────────────────────────────

import postgres from 'postgres';
import { PostgresCapabilityRepository, createCatalogCapabilities } from '@vedmoulya/capabilities';
import { PostgresProviderRepository, createCatalogProviders } from '@vedmoulya/providers';
import { PostgresContextRepository, createCatalogContext } from '@vedmoulya/context';
import {
  PostgresExecutionStrategyRepository,
  createCatalogStrategies,
} from '@vedmoulya/execution-strategy';
import { PostgresGoalRepository, createCatalogGoals } from '@vedmoulya/goals';
import {
  PostgresLearningRepository,
  createCatalogLearningEvents,
} from '@vedmoulya/learning-intelligence';
import { PostgresBrainRepository, createCatalogBrainPlan } from '@vedmoulya/enterprise-brain';
import {
  PostgresKnowledgeRepository,
  createCatalogKnowledgeItems,
  createCatalogKnowledgeRelationships,
} from '@vedmoulya/knowledge-intelligence';
import {
  PostgresMemoryRepository,
  createCatalogMemoryItems,
  createCatalogMemoryRelationships,
} from '@vedmoulya/memory-intelligence';
import { PostgresOSRepository, createCatalogOSSnapshot } from '@vedmoulya/os-intelligence';
import {
  PostgresGraphRepository as PostgresContextFabricRepository,
  createCatalogFabricEntities,
  createCatalogFabricRelationships,
} from '@vedmoulya/context-fabric';

// ── CLI flags ────────────────────────────────────────────────────────────────

interface SeedOptions {
  only: string[];
  dryRun: boolean;
}

function parseArgs(argv: string[]): SeedOptions {
  const only: string[] = [];
  let dryRun = false;
  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('--only=')) {
      const value = arg.slice('--only='.length);
      for (const part of value.split(',')) {
        const trimmed = part.trim();
        if (trimmed) only.push(trimmed);
      }
    }
  }
  return { only, dryRun };
}

// ── Seed target abstraction ──────────────────────────────────────────────────
// Each target closes over its concrete Postgres repository and seed catalog so
// the script never needs the entity types or per-repo save shapes.

interface SeedTarget {
  key: string;
  table: string;
  seedSize: number;
  ensureTable: () => Promise<void>;
  saveSeed: () => Promise<void>;
  count: () => Promise<number>;
}

function capabilityTarget(sql: postgres.Sql): SeedTarget {
  const repo = new PostgresCapabilityRepository(sql);
  const items = createCatalogCapabilities();
  return {
    key: 'capabilities',
    table: 'capability_registry',
    seedSize: items.length,
    ensureTable: () => repo.ensureTable(),
    saveSeed: async () => {
      for (const item of items) {
        await repo.save(item);
      }
    },
    count: () => repo.count(),
  };
}

function providerTarget(sql: postgres.Sql): SeedTarget {
  const repo = new PostgresProviderRepository(sql);
  const items = createCatalogProviders();
  return {
    key: 'providers',
    table: 'provider_registry',
    seedSize: items.length,
    ensureTable: () => repo.ensureTable(),
    saveSeed: async () => {
      for (const item of items) {
        await repo.save(item);
      }
    },
    count: () => repo.count(),
  };
}

function contextTarget(sql: postgres.Sql): SeedTarget {
  const repo = new PostgresContextRepository(sql);
  const items = createCatalogContext();
  return {
    key: 'context',
    table: 'context_registry',
    seedSize: items.length,
    ensureTable: () => repo.ensureTable(),
    saveSeed: async () => {
      await repo.saveMany(items);
    },
    count: () => repo.count(),
  };
}

function strategyTarget(sql: postgres.Sql): SeedTarget {
  const repo = new PostgresExecutionStrategyRepository(sql);
  const items = createCatalogStrategies();
  return {
    key: 'strategies',
    table: 'execution_strategy_registry',
    seedSize: items.length,
    ensureTable: () => repo.ensureTable(),
    saveSeed: async () => {
      await repo.saveMany(items);
    },
    count: () => repo.count(),
  };
}

function learningTarget(sql: postgres.Sql): SeedTarget {
  const repo = new PostgresLearningRepository(sql);
  const items = createCatalogLearningEvents();
  return {
    key: 'learning',
    table: 'learning_registry',
    seedSize: items.length,
    ensureTable: () => repo.ensureTable(),
    saveSeed: async () => {
      for (const item of items) {
        await repo.saveEvent(item);
      }
    },
    count: () => repo.countEvents(),
  };
}

function brainTarget(sql: postgres.Sql): SeedTarget {
  const repo = new PostgresBrainRepository(sql);
  const { plan, decisions } = createCatalogBrainPlan();
  return {
    key: 'brain',
    table: 'brain_registry',
    seedSize: decisions.length,
    ensureTable: () => repo.ensureTable(),
    saveSeed: async () => {
      for (const decision of decisions) {
        await repo.saveDecision(decision);
      }
      await repo.savePlan(plan);
    },
    // The BrainRepository contract has no count(); listAllDecisions() is the
    // equivalent (the 14 seed decisions mirror the single seeded plan).
    count: async () => (await repo.listAllDecisions()).length,
  };
}

function knowledgeTarget(sql: postgres.Sql): SeedTarget {
  const repo = new PostgresKnowledgeRepository(sql);
  const items = createCatalogKnowledgeItems();
  const relationships = createCatalogKnowledgeRelationships();
  return {
    key: 'knowledge',
    table: 'knowledge_registry',
    seedSize: items.length,
    ensureTable: () => repo.ensureTable(),
    saveSeed: async () => {
      for (const item of items) {
        await repo.saveItem(item);
      }
      for (const relationship of relationships) {
        await repo.saveRelationship(relationship);
      }
    },
    // The KnowledgeRepository contract has no count(); countItems() is the
    // equivalent (the seed relationships are stored in the same table).
    count: () => repo.countItems(),
  };
}

function goalTarget(sql: postgres.Sql): SeedTarget {
  const repo = new PostgresGoalRepository(sql);
  const items = createCatalogGoals();
  return {
    key: 'goals',
    table: 'goal_registry',
    seedSize: items.length,
    ensureTable: () => repo.ensureTable(),
    saveSeed: async () => {
      for (const item of items) {
        await repo.save(item);
      }
    },
    // The GoalRepository contract has no count(); listAll() is the equivalent.
    count: async () => (await repo.listAll()).length,
  };
}

function memoryTarget(sql: postgres.Sql): SeedTarget {
  const repo = new PostgresMemoryRepository(sql);
  const items = createCatalogMemoryItems();
  const relationships = createCatalogMemoryRelationships();
  return {
    key: 'memory',
    table: 'memory_registry',
    seedSize: items.length,
    ensureTable: () => repo.ensureTable(),
    saveSeed: async () => {
      for (const item of items) {
        await repo.saveItem(item);
      }
      for (const relationship of relationships) {
        await repo.saveRelationship(relationship);
      }
    },
    // The MemoryRepository contract has no count(); countItems() is the
    // equivalent (the seed relationships are stored in the same table).
    count: () => repo.countItems(),
  };
}

function contextFabricTarget(sql: postgres.Sql): SeedTarget {
  const repo = new PostgresContextFabricRepository(sql);
  const entities = createCatalogFabricEntities();
  const relationships = createCatalogFabricRelationships();
  return {
    key: 'context-fabric',
    table: 'context_fabric_registry',
    seedSize: entities.length + relationships.length,
    ensureTable: () => repo.ensureTable(),
    saveSeed: async () => {
      for (const entity of entities) {
        await repo.saveEntity(entity);
      }
      for (const relationship of relationships) {
        await repo.saveRelationship(relationship);
      }
    },
    // The GraphRepository contract exposes countEntities() + countRelationships().
    count: async () => (await repo.countEntities()) + (await repo.countRelationships()),
  };
}

function osTarget(sql: postgres.Sql): SeedTarget {
  const repo = new PostgresOSRepository(sql);
  const snapshot = createCatalogOSSnapshot();
  return {
    key: 'os',
    table: 'os_health_registry',
    seedSize: 1,
    ensureTable: () => repo.ensureTable(),
    saveSeed: async () => {
      await repo.saveSnapshot(snapshot);
    },
    // The OSRepository contract exposes countSnapshots() for the total.
    count: () => repo.countSnapshots(),
  };
}

function buildTargets(sql: postgres.Sql): SeedTarget[] {
  return [
    capabilityTarget(sql),
    providerTarget(sql),
    contextTarget(sql),
    strategyTarget(sql),
    goalTarget(sql),
    learningTarget(sql),
    brainTarget(sql),
    knowledgeTarget(sql),
    memoryTarget(sql),
    osTarget(sql),
    contextFabricTarget(sql),
  ];
}

// ── Runner ───────────────────────────────────────────────────────────────────

async function seedTarget(target: SeedTarget): Promise<void> {
  await target.ensureTable();
  await target.saveSeed();
}

/**
 * Resolve the database URL: explicit seed override → gateway env → dev default.
 * Deliberately mirrors the gateway's `config.database.url` (IDENTITY_DATABASE_URL
 * only — the gateway never reads a generic DATABASE_URL), so the seed always
 * targets the same database the EI factories resolve at runtime.
 */
function resolveDatabaseUrl(): string {
  return (
    process.env.EI_DATABASE_URL ??
    process.env.IDENTITY_DATABASE_URL ??
    'postgres://localhost:5432/vedmoulya'
  );
}

/** Redact credentials for display (postgres://user:pass@host → postgres://***@host). */
function redactDatabaseUrl(url: string): string {
  return url.replace(/\/\/.*@/, '//***@');
}

function printPlan(targets: SeedTarget[], dryRun: boolean): void {
  console.log(`EI seed migration${dryRun ? ' (dry run — no database connection)' : ''}`);
  console.log(`Database: ${redactDatabaseUrl(resolveDatabaseUrl())}`);
  console.log('');
  for (const target of targets) {
    console.log(
      `  ${target.key.padEnd(13)} → ${target.table.padEnd(28)} ${target.seedSize} seed row(s)`,
    );
  }
  console.log('');
  console.log('Idempotent upsert (ON CONFLICT (id) DO UPDATE) — safe to re-run.');
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const sql = postgres(resolveDatabaseUrl(), {
    max: 5,
    idle_timeout: 30,
    max_lifetime: 60 * 30,
    connection: { application_name: 'vedmoulya-ei-seed' },
  });

  try {
    const allTargets = buildTargets(sql);
    const targets =
      options.only.length > 0
        ? allTargets.filter((target) => options.only.includes(target.key))
        : allTargets;

    const missing = options.only.filter((key) => !allTargets.some((target) => target.key === key));
    if (missing.length > 0) {
      throw new Error(
        `Unknown store(s): ${missing.join(', ')}. Valid: ${allTargets.map((t) => t.key).join(', ')}`,
      );
    }

    printPlan(targets, options.dryRun);

    if (options.dryRun) {
      console.log('✅ Dry run complete — nothing written.');
      return;
    }

    for (const target of targets) {
      await seedTarget(target);
      const total = await target.count();
      console.log(
        `✅ ${target.key}: ${total} row(s) in ${target.table} (seeded ${target.seedSize})`,
      );
    }

    console.log('');
    console.log('✅ EI seed migration complete.');
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    '❌ EI seed migration failed:',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
