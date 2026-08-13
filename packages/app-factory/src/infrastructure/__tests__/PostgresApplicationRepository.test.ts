// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Postgres Application Repository
// EPIC-008 — Phase 1 persistence. The Postgres repository is exercised
// against a fake tagged-template sql client that records calls and
// returns canned rows — the same hermetic approach every EI Postgres
// repository suite uses, so the DDL statements and JSONB round-trips
// are covered without a live database.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import type postgres from 'postgres';
import { PostgresApplicationRepository } from '../PostgresApplicationRepository.js';
import type { AppProject } from '../../types/app-types.js';

interface RecordedCall {
  strings: readonly string[];
  values: unknown[];
}

function fakeSql(rows: unknown[]): { sql: ReturnType<typeof postgres>; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const tag = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ strings: [...strings], values });
    return Promise.resolve(rows);
  }) as unknown as ReturnType<typeof postgres>;
  // The repo binds JSON documents via sql.json() — the fake returns the raw
  // value (the real driver wraps it in a Parameter for OID 3802).
  tag.json = (value: unknown): unknown => value;
  return { sql: tag, calls };
}

function makeProject(overrides: Partial<AppProject> = {}): AppProject {
  return {
    applicationId: 'app-test-1',
    owner: 'u1',
    name: 'ABAP Debugger',
    archetype: 'abap-debugger',
    status: 'DRAFT',
    goal: 'Build an ABAP debugger.',
    specification: {
      applicationId: 'app-test-1',
      name: 'ABAP Debugger',
      purpose: 'Debug ABAP programs',
      targetUsers: ['developers'],
      userJourneys: [],
      features: [],
      requirements: [{ label: 'parse ABAP', status: 'resolved', reason: 'from goal' }],
      acceptanceCriteria: [],
      budget: { maxIterations: 3 },
      constraints: [],
      archetype: 'abap-debugger',
      derivationReasons: [],
      unresolved: [],
    },
    architecture: {
      applicationId: 'app-test-1',
      layers: [],
      dataModel: [],
      apiContract: [],
      aiCapabilities: [],
      integrations: [],
      securityControls: [],
      performanceTargets: [],
      deploymentTarget: 'local',
      validationReasons: [],
    },
    taskGraph: {
      applicationId: 'app-test-1',
      tasks: [],
      entryTaskIds: [],
      terminalTaskIds: [],
      validated: true,
      validationReasons: [],
    },
    version: '1.0.0',
    technologies: [],
    aiCapabilities: [],
    repositoryPath: 'workspace/app-test-1',
    deploymentStatus: 'not_deployed',
    health: 'unknown',
    fileOperations: [],
    files: [],
    vcOperations: [],
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('PostgresApplicationRepository', () => {
  it('creates the application_projects table + owner index (idempotent DDL)', async () => {
    const { sql, calls } = fakeSql([]);
    const repo = new PostgresApplicationRepository(sql);
    await repo.ensureTable();
    const statement = calls.map((c) => c.strings.join('?')).join(' ');
    expect(statement).toContain('CREATE TABLE IF NOT EXISTS application_projects');
    expect(statement).toContain('application_id TEXT PRIMARY KEY');
    expect(statement).toContain(
      'CREATE INDEX IF NOT EXISTS application_projects_owner_updated_idx',
    );
    expect(statement).toContain('ON application_projects (owner, updated_at DESC)');
  });

  it('upserts a project document as JSONB with owner-scoped columns', async () => {
    const { sql, calls } = fakeSql([]);
    const repo = new PostgresApplicationRepository(sql);
    const project = makeProject();
    await repo.save(project);
    const statement = calls[0]!.strings.join('?');
    expect(statement).toContain('INSERT INTO application_projects');
    expect(statement).toContain('ON CONFLICT (application_id) DO UPDATE');
    const values = calls[0]!.values;
    expect(values[0]).toBe(project.applicationId);
    expect(values[1]).toBe(project.owner);
    expect(values[2]).toBe(project.status);
    // The document binds via sql.json() — the RAW object is the bound value
    // (single encoding; never a pre-stringified double-encoded string).
    expect(values[4]).toMatchObject({ name: 'ABAP Debugger' });
  });

  it('retrieves a project (JSONB as ::text then JSON.parse)', async () => {
    const project = makeProject();
    const { sql } = fakeSql([{ document: JSON.stringify(project) }]);
    const repo = new PostgresApplicationRepository(sql);
    const found = await repo.get(project.applicationId);
    expect(found?.applicationId).toBe(project.applicationId);
    expect(found?.name).toBe('ABAP Debugger');
  });

  it('returns undefined when the project row is missing', async () => {
    const { sql } = fakeSql([]);
    const repo = new PostgresApplicationRepository(sql);
    expect(await repo.get('app-missing')).toBeUndefined();
  });

  it('lists all projects ordered by updated_at desc', async () => {
    const a = makeProject({ applicationId: 'app-a', updatedAt: '2026-08-09T02:00:00.000Z' });
    const b = makeProject({ applicationId: 'app-b', updatedAt: '2026-08-09T01:00:00.000Z' });
    const { sql, calls } = fakeSql([
      { document: JSON.stringify(a) },
      { document: JSON.stringify(b) },
    ]);
    const repo = new PostgresApplicationRepository(sql);
    const rows = await repo.list();
    expect(rows).toHaveLength(2);
    expect(rows[0]?.applicationId).toBe('app-a');
    expect(calls[0]!.strings.join('?')).toContain('ORDER BY updated_at DESC');
  });

  it('lists only the owner when an owner is given', async () => {
    const { sql, calls } = fakeSql([{ document: JSON.stringify(makeProject()) }]);
    const repo = new PostgresApplicationRepository(sql);
    const rows = await repo.list('u1');
    expect(rows).toHaveLength(1);
    const statement = calls[0]!.strings.join('?');
    expect(statement).toContain('WHERE owner =');
    expect(calls[0]!.values[0]).toBe('u1');
  });

  it('deletes a project and reports whether a row was removed', async () => {
    // postgres.js returns the row-count object directly for DELETE statements.
    const calls: RecordedCall[] = [];
    const removedTag = ((strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ strings: [...strings], values });
      return Promise.resolve({ count: 1 });
    }) as unknown as ReturnType<typeof postgres>;
    const repo = new PostgresApplicationRepository(removedTag);
    expect(await repo.delete('app-test-1')).toBe(true);
    expect(calls[0]!.strings.join('?')).toContain('DELETE FROM application_projects');

    const missingCalls: RecordedCall[] = [];
    const missingTag = ((strings: TemplateStringsArray, ...values: unknown[]) => {
      missingCalls.push({ strings: [...strings], values });
      return Promise.resolve({ count: 0 });
    }) as unknown as ReturnType<typeof postgres>;
    const repo2 = new PostgresApplicationRepository(missingTag);
    expect(await repo2.delete('app-missing')).toBe(false);
  });
});
