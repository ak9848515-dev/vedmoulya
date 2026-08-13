// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Capability Repository
// Postgres-backed implementation of the CapabilityRepository contract.
// Stores capabilities as JSONB documents in a single table, indexed by
// the branded CapabilityId (same pattern as PostgresProviderRepository).
// The JSONB approach keeps the rich nested entity atomic on read/write.
//
// EI-001 — Enterprise Capability Registry & Marketplace (CERT-002 C-04)
// ──────────────────────────────────────────────────────────────────

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import { Capability } from '../domain/entities/Capability.js';
import { CapabilityStatus as CapabilityStatusValueObject } from '../domain/value-objects/CapabilityStatus.js';
import { CapabilityVersion } from '../domain/value-objects/CapabilityVersion.js';
import { createCapabilityId, type CapabilityId } from '../domain/value-objects/CapabilityId.js';
import type { CapabilityRepository } from '../domain/repository/CapabilityRepository.js';
import type {
  BusinessModule,
  CapabilityCategory,
  CapabilitySearchCriteria,
  CapabilityStatus,
  RequiredAIFeature,
} from '../types/capability-types.js';
import type postgres from 'postgres';

/** postgres.js's json() parameter type (not exported by the driver). */
type JsonParam = Parameters<postgres.Sql['json']>[0];

interface CapabilityRow {
  id: string;
  data: unknown;
}

export class PostgresCapabilityRepository implements CapabilityRepository {
  private readonly sql: postgres.Sql;

  constructor(sql: postgres.Sql) {
    this.sql = sql;
  }

  /** Ensure the capability_registry table exists (IF NOT EXISTS). */
  async ensureTable(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS capability_registry (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  }

  // ── Row <-> Entity serialization ──────────────────────────────────────────

  /** Plain-object snapshot of a Capability (class → serializable shape). */
  private capabilityToSnapshot(capability: Capability): Record<string, unknown> {
    return {
      id: capability.id,
      name: capability.name,
      category: capability.category,
      description: capability.description,
      owner: capability.owner,
      inputs: [...capability.inputs],
      outputs: [...capability.outputs],
      dependencies: [...capability.dependencies],
      requiredAIFeatures: [...capability.requiredAIFeatures],
      cost: capability.cost,
      tokens: capability.tokens,
      latency: capability.latency,
      quality: capability.quality,
      confidence: capability.confidence,
      version: capability.version.toString(),
      status: capability.status.value,
      tags: [...capability.tags],
      businessModules: [...capability.businessModules],
      documentationUrl: capability.documentationUrl,
      composition: capability.composition.map((c) => ({ id: c.id, slot: c.slot })),
      createdAt: capability.createdAt.toISOString(),
      updatedAt: capability.updatedAt.toISOString(),
    };
  }

  private rowToCapability(row: CapabilityRow): Capability {
    const raw =
      typeof row.data === 'string'
        ? (JSON.parse(row.data) as Record<string, unknown>)
        : (row.data as Record<string, unknown>);
    return Capability.create({
      id: createCapabilityId(String(raw.id)),
      name: String(raw.name),
      category: raw.category as Capability['category'],
      description: String(raw.description),
      owner: String(raw.owner),
      inputs: (raw.inputs as string[] | undefined) ?? [],
      outputs: (raw.outputs as string[] | undefined) ?? [],
      dependencies: ((raw.dependencies as string[] | undefined) ?? []).map((d) =>
        createCapabilityId(d),
      ),
      requiredAIFeatures: (raw.requiredAIFeatures as RequiredAIFeature[] | undefined) ?? [],
      cost: raw.cost as Capability['cost'],
      tokens: raw.tokens as Capability['tokens'],
      latency: raw.latency as Capability['latency'],
      quality: raw.quality as Capability['quality'],
      confidence: (raw.confidence as number | undefined) ?? 0.5,
      version: CapabilityVersion.fromString(String(raw.version)),
      status: CapabilityStatusValueObject.fromStatus(raw.status as CapabilityStatus),
      tags: (raw.tags as string[] | undefined) ?? [],
      businessModules: (raw.businessModules as BusinessModule[] | undefined) ?? [],
      documentationUrl: raw.documentationUrl as string | undefined,
      composition: (
        (raw.composition as Array<{ id: string; slot?: string }> | undefined) ?? []
      ).map((c) => ({
        id: createCapabilityId(c.id),
        slot: c.slot,
      })),
      createdAt: new Date(String(raw.createdAt)),
      updatedAt: new Date(String(raw.updatedAt)),
    });
  }

  private capabilityToRow(capability: Capability): Record<string, unknown> {
    return {
      id: capability.id,
      data: JSON.stringify(this.capabilityToSnapshot(capability)),
      updated_at: new Date(capability.updatedAt).toISOString(),
    };
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async findById(id: CapabilityId): Promise<Capability | null> {
    const rows = await this.sql<
      CapabilityRow[]
    >`SELECT id, data FROM capability_registry WHERE id = ${id}`;
    const first = rows[0];
    return first ? this.rowToCapability(first) : null;
  }

  async findByIds(ids: CapabilityId[]): Promise<Capability[]> {
    if (ids.length === 0) return [];
    const rows = await this.sql<
      CapabilityRow[]
    >`SELECT id, data FROM capability_registry WHERE id = ANY(${ids})`;
    return rows.map((r) => this.rowToCapability(r));
  }

  async findByCategory(
    category: CapabilityCategory,
    params: PaginationParams,
  ): Promise<PaginatedResult<Capability>> {
    return this.paginateWhere(`data->>'category' = $1`, [category], params);
  }

  async findByStatus(
    status: CapabilityStatus,
    params: PaginationParams,
  ): Promise<PaginatedResult<Capability>> {
    return this.paginateWhere(`data->>'status' = $1`, [status], params);
  }

  async findByBusinessModule(
    module: BusinessModule,
    params: PaginationParams,
  ): Promise<PaginatedResult<Capability>> {
    return this.paginateWhere(
      `data->'businessModules' @> $1::jsonb`,
      [JSON.stringify([module])],
      params,
    );
  }

  async findByTag(tag: string, params: PaginationParams): Promise<PaginatedResult<Capability>> {
    return this.paginateWhere(`data->'tags' @> $1::jsonb`, [JSON.stringify([tag])], params);
  }

  async findByAIFeatures(features: RequiredAIFeature[]): Promise<Capability[]> {
    if (features.length === 0) return [];
    const rows = await this.sql<CapabilityRow[]>`
      SELECT id, data FROM capability_registry
      WHERE data->'requiredAIFeatures' ?| ${features}
      ORDER BY data->>'name' ASC
    `;
    return rows.map((r) => this.rowToCapability(r));
  }

  async save(capability: Capability): Promise<void> {
    await this.sql`
      INSERT INTO capability_registry ${this.sql(this.capabilityToRow(capability))}
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
    `;
  }

  async update(capability: Capability): Promise<void> {
    // Bind via sql.json(...): serializes exactly once for jsonb OID 3802.
    // JSON.stringify(x)::jsonb DOUBLE-encodes — a real-DB corruption bug.
    await this.sql`
      UPDATE capability_registry SET
        data = ${this.sql.json(this.capabilityToSnapshot(capability) as unknown as JsonParam)},
        updated_at = ${new Date(capability.updatedAt).toISOString()}::timestamptz
      WHERE id = ${capability.id}
    `;
  }

  async delete(id: CapabilityId): Promise<void> {
    await this.sql`DELETE FROM capability_registry WHERE id = ${id}`;
  }

  async exists(id: CapabilityId): Promise<boolean> {
    const rows = await this.sql<[{ exists: boolean }]>`
      SELECT EXISTS(SELECT 1 FROM capability_registry WHERE id = ${id}) AS exists
    `;
    return rows[0].exists;
  }

  // ── Search & Discovery ───────────────────────────────────────────────────

  async search(
    criteria: CapabilitySearchCriteria,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Capability>> {
    const conditions: string[] = [];
    const params: Array<string | string[] | number> = [];
    let paramIdx = 1;

    const q = criteria.query?.trim().toLowerCase();
    if (q) {
      conditions.push(
        `(LOWER(data->>'name') LIKE $${paramIdx} OR LOWER(data->>'description') LIKE $${paramIdx} OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(data->'tags') t WHERE LOWER(t) LIKE $${paramIdx}))`,
      );
      params.push(`%${q}%`);
      paramIdx++;
    }
    if (criteria.categories && criteria.categories.length > 0) {
      conditions.push(`data->>'category' = ANY($${paramIdx})`);
      params.push(criteria.categories);
      paramIdx++;
    }
    if (criteria.statuses && criteria.statuses.length > 0) {
      conditions.push(`data->>'status' = ANY($${paramIdx})`);
      params.push(criteria.statuses);
      paramIdx++;
    }
    if (criteria.businessModules && criteria.businessModules.length > 0) {
      conditions.push(
        `EXISTS (SELECT 1 FROM jsonb_array_elements_text(data->'businessModules') m WHERE m = ANY($${paramIdx}))`,
      );
      params.push(criteria.businessModules);
      paramIdx++;
    }
    if (criteria.tags && criteria.tags.length > 0) {
      conditions.push(
        `EXISTS (SELECT 1 FROM jsonb_array_elements_text(data->'tags') t WHERE t = ANY($${paramIdx}))`,
      );
      params.push(criteria.tags);
      paramIdx++;
    }
    if (criteria.dependsOn) {
      conditions.push(`data->'dependencies' @> $${paramIdx}::jsonb`);
      params.push(JSON.stringify([criteria.dependsOn]));
      paramIdx++;
    }
    if (criteria.onlyCompositions === true) {
      conditions.push(`(data->>'isComposition')::boolean = true`);
    }

    return this.paginateWhere(conditions.join(' AND '), params, pagination, paramIdx);
  }

  async findByDependency(dependencyId: CapabilityId): Promise<Capability[]> {
    const rows = await this.sql<CapabilityRow[]>`
      SELECT id, data FROM capability_registry
      WHERE data->'dependencies' @> ${this.sql.json([dependencyId])}
    `;
    return rows.map((r) => this.rowToCapability(r));
  }

  async findByCompositionParent(parentId: CapabilityId): Promise<Capability[]> {
    const rows = await this.sql<CapabilityRow[]>`
      SELECT id, data FROM capability_registry
      WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(data->'composition') c WHERE c->>'id' = ${parentId})
    `;
    return rows.map((r) => this.rowToCapability(r));
  }

  async listAll(): Promise<Capability[]> {
    const rows = await this.sql<
      CapabilityRow[]
    >`SELECT id, data FROM capability_registry ORDER BY data->>'name' ASC`;
    return rows.map((r) => this.rowToCapability(r));
  }

  // ── Statistics ───────────────────────────────────────────────────────────

  async count(): Promise<number> {
    const rows = await this.sql<
      [{ count: number }]
    >`SELECT COUNT(*)::int AS count FROM capability_registry`;
    return rows[0].count;
  }

  async countByStatus(): Promise<Record<CapabilityStatus, number>> {
    const rows = await this.sql<{ status: string; count: number }[]>`
      SELECT data->>'status' AS status, COUNT(*)::int AS count
      FROM capability_registry GROUP BY data->>'status'
    `;
    const result: Record<CapabilityStatus, number> = {
      design: 0,
      draft: 0,
      testing: 0,
      active: 0,
      deprecated: 0,
      archived: 0,
    };
    for (const row of rows) result[row.status as CapabilityStatus] = row.count;
    return result;
  }

  async countByCategory(): Promise<Record<CapabilityCategory, number>> {
    const rows = await this.sql<{ category: string; count: number }[]>`
      SELECT data->>'category' AS category, COUNT(*)::int AS count
      FROM capability_registry GROUP BY data->>'category'
    `;
    const result: Record<string, number> = {};
    for (const row of rows) result[row.category] = row.count;
    return result;
  }

  async countByBusinessModule(): Promise<Record<BusinessModule, number>> {
    const rows = await this.sql<{ module: string; count: number }[]>`
      SELECT m AS module, COUNT(*)::int AS count
      FROM capability_registry, jsonb_array_elements_text(data->'businessModules') m
      GROUP BY m
    `;
    const result: Record<BusinessModule, number> = {
      'content-agency': 0,
      learning: 0,
      career: 0,
      marketing: 0,
      business: 0,
      platform: 0,
    };
    for (const row of rows) result[row.module as BusinessModule] = row.count;
    return result;
  }

  // ── Shared pagination helper ─────────────────────────────────────────────

  private async paginateWhere(
    whereClause: string,
    params: Array<string | string[] | number>,
    pagination: PaginationParams,
    baseIdx = 1,
  ): Promise<PaginatedResult<Capability>> {
    const where = whereClause ? `WHERE ${whereClause}` : '';
    const countRows = await this.sql.unsafe<[{ count: number }]>(
      `SELECT COUNT(*)::int AS count FROM capability_registry ${where}`,
      params as never,
    );
    const total = countRows[0].count;
    const offset = (pagination.page - 1) * pagination.limit;
    const allParams = [...params, pagination.limit, offset];
    const rows = await this.sql.unsafe<CapabilityRow[]>(
      `SELECT id, data FROM capability_registry ${where} ORDER BY data->>'name' ASC LIMIT $${baseIdx + params.length} OFFSET $${baseIdx + params.length + 1}`,
      allParams as never,
    );
    return {
      data: rows.map((r) => this.rowToCapability(r)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }
}
