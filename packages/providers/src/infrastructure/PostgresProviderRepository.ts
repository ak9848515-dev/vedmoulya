// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Provider Repository
// Postgres-backed implementation of the ProviderRepository contract.
// Stores providers as JSONB documents in a single table, indexed by
// the branded ProviderId. The JSONB approach keeps the rich nested
// entity (models, matrix, health, profiles) atomic on read/write
// without joins or ORM complexity.
//
// EI-002 — Enterprise Provider Registry & Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type { CapabilityType, ModalityType, ProviderFamily } from '@vedmoulya/ai';
import type { Provider } from '../domain/entities/Provider.js';
import type { ProviderRepository } from '../domain/repository/ProviderRepository.js';
import type { ProviderId } from '../domain/value-objects/ProviderId.js';
import type {
  ProviderCapabilityMatrixEntry,
  ProviderCostProfile,
  ProviderLatencyProfile,
  ProviderLifecycleStatus,
  ProviderModel,
  ProviderRateLimits,
  ProviderSearchCriteria,
} from '../types/provider-types.js';
import { Provider as ProviderEntity } from '../domain/entities/Provider.js';
import { ProviderLifecycleStatus as ProviderLifecycleStatusValue } from '../domain/value-objects/ProviderLifecycleStatus.js';
import { ProviderVersion } from '../domain/value-objects/ProviderVersion.js';
import { createProviderId } from '../domain/value-objects/ProviderId.js';
import type postgres from 'postgres';

/** postgres.js's json() parameter type (not exported by the driver). */
type JsonParam = Parameters<postgres.Sql['json']>[0];

// ── Row shape (JSONB fields come as raw strings from postgres.js) ───────────

interface ProviderRow {
  id: string;
  family: string;
  name: string;
  description: string;
  owner: string;
  models: string;
  capabilities: string;
  supported_modalities: string;
  cost: string;
  latency: string;
  rate_limits: string;
  availability: number;
  health: string;
  lifecycle_status: string;
  version: string;
  tags: string;
  documentation_url: string | null;
  matrix: string;
  created_at: string;
  updated_at: string;
}

// ── Repository ──────────────────────────────────────────────────────────────

export class PostgresProviderRepository implements ProviderRepository {
  private readonly sql: postgres.Sql;

  constructor(sql: postgres.Sql) {
    this.sql = sql;
  }

  /**
   * Ensure the provider_registry table exists. Safe to call on every start
   * (IF NOT EXISTS). In production, this should be a migration.
   */
  async ensureTable(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS provider_registry (
        id TEXT PRIMARY KEY,
        family TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        owner TEXT NOT NULL DEFAULT '',
        models JSONB NOT NULL DEFAULT '[]',
        capabilities JSONB NOT NULL DEFAULT '[]',
        supported_modalities JSONB NOT NULL DEFAULT '[]',
        cost JSONB NOT NULL DEFAULT '{}',
        latency JSONB NOT NULL DEFAULT '{}',
        rate_limits JSONB NOT NULL DEFAULT '{}',
        availability REAL NOT NULL DEFAULT 0,
        health JSONB NOT NULL DEFAULT '{}',
        lifecycle_status TEXT NOT NULL DEFAULT 'draft',
        version TEXT NOT NULL DEFAULT '1.0.0',
        tags JSONB NOT NULL DEFAULT '[]',
        documentation_url TEXT,
        matrix JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  }

  // ── Row <-> Entity serialization ──────────────────────────────────────────

  /** Parse a JSONB field: postgres.js returns objects as objects, strings as strings. */
  private parseJson(val: unknown): unknown {
    if (typeof val === 'string') return JSON.parse(val);
    return val;
  }

  private rowToProvider(row: ProviderRow): Provider {
    return new ProviderEntity({
      id: createProviderId(row.id),
      family: row.family as ProviderFamily,
      name: row.name,
      description: row.description,
      owner: row.owner,
      models: this.parseJson(row.models) as ProviderModel[],
      capabilities: this.parseJson(row.capabilities) as CapabilityType[],
      supportedModalities: this.parseJson(row.supported_modalities) as ModalityType[],
      cost: this.parseJson(row.cost) as ProviderCostProfile,
      latency: this.parseJson(row.latency) as ProviderLatencyProfile,
      rateLimits: this.parseJson(row.rate_limits) as ProviderRateLimits,
      availability: row.availability,
      health: this.parseJson(row.health) as ProviderEntity['health'],
      lifecycleStatus: ProviderLifecycleStatusValue.fromStatus(
        row.lifecycle_status as ProviderLifecycleStatus,
      ),
      version: ProviderVersion.fromString(row.version),
      tags: this.parseJson(row.tags) as string[],
      documentationUrl: row.documentation_url ?? undefined,
      matrix: this.parseJson(row.matrix) as ProviderCapabilityMatrixEntry[],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  private providerToRow(provider: Provider): Record<string, unknown> {
    return {
      id: provider.id,
      family: provider.family,
      name: provider.name,
      description: provider.description,
      owner: provider.owner,
      models: JSON.stringify([...provider.models]),
      capabilities: JSON.stringify([...provider.capabilities]),
      supported_modalities: JSON.stringify([...provider.supportedModalities]),
      cost: JSON.stringify(provider.cost),
      latency: JSON.stringify(provider.latency),
      rate_limits: JSON.stringify(provider.rateLimits),
      availability: provider.availability,
      health: JSON.stringify(provider.health),
      lifecycle_status: provider.lifecycleStatus.value,
      version: provider.version.toString(),
      tags: JSON.stringify([...provider.tags]),
      documentation_url: provider.documentationUrl ?? null,
      matrix: JSON.stringify([...provider.matrix]),
      created_at: provider.createdAt.toISOString(),
      updated_at: provider.updatedAt.toISOString(),
    };
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async findById(id: ProviderId): Promise<Provider | null> {
    const rows = await this.sql<ProviderRow[]>`
      SELECT * FROM provider_registry WHERE id = ${id}
    `;
    const first = rows[0];
    return first ? this.rowToProvider(first) : null;
  }

  async findByIds(ids: ProviderId[]): Promise<Provider[]> {
    if (ids.length === 0) return [];
    const rows = await this.sql<ProviderRow[]>`
      SELECT * FROM provider_registry WHERE id = ANY(${ids})
    `;
    return rows.map((r) => this.rowToProvider(r));
  }

  async findByFamily(
    family: ProviderFamily,
    params: PaginationParams,
  ): Promise<PaginatedResult<Provider>> {
    const countRows = await this.sql<
      [{ count: number }]
    >`SELECT COUNT(*)::int AS count FROM provider_registry WHERE family = ${family}`;
    const total = countRows[0].count;
    const offset = (params.page - 1) * params.limit;
    const rows = await this.sql<ProviderRow[]>`
      SELECT * FROM provider_registry
      WHERE family = ${family}
      ORDER BY name ASC
      LIMIT ${params.limit} OFFSET ${offset}
    `;
    return {
      data: rows.map((r) => this.rowToProvider(r)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async findByLifecycleStatus(
    status: ProviderLifecycleStatus,
    params: PaginationParams,
  ): Promise<PaginatedResult<Provider>> {
    const countRows = await this.sql<
      [{ count: number }]
    >`SELECT COUNT(*)::int AS count FROM provider_registry WHERE lifecycle_status = ${status}`;
    const total = countRows[0].count;
    const offset = (params.page - 1) * params.limit;
    const rows = await this.sql<ProviderRow[]>`
      SELECT * FROM provider_registry
      WHERE lifecycle_status = ${status}
      ORDER BY name ASC
      LIMIT ${params.limit} OFFSET ${offset}
    `;
    return {
      data: rows.map((r) => this.rowToProvider(r)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async findByCapability(
    capability: CapabilityType,
    params: PaginationParams,
  ): Promise<PaginatedResult<Provider>> {
    // Bind via sql.json(): serializes exactly once for jsonb OID 3802.
    // JSON.stringify(x)::jsonb DOUBLE-encodes — a real-DB corruption bug.
    const countRows = await this.sql<
      [{ count: number }]
    >`SELECT COUNT(*)::int AS count FROM provider_registry WHERE capabilities @> ${this.sql.json([capability])}`;
    const total = countRows[0].count;
    const offset = (params.page - 1) * params.limit;
    const rows = await this.sql<ProviderRow[]>`
      SELECT * FROM provider_registry
      WHERE capabilities @> ${this.sql.json([capability])}
      ORDER BY name ASC
      LIMIT ${params.limit} OFFSET ${offset}
    `;
    return {
      data: rows.map((r) => this.rowToProvider(r)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async findByTag(tag: string, params: PaginationParams): Promise<PaginatedResult<Provider>> {
    // Bind via sql.json(): serializes exactly once for jsonb OID 3802.
    // JSON.stringify(x)::jsonb DOUBLE-encodes — a real-DB corruption bug.
    const countRows = await this.sql<
      [{ count: number }]
    >`SELECT COUNT(*)::int AS count FROM provider_registry WHERE tags @> ${this.sql.json([tag])}`;
    const total = countRows[0].count;
    const offset = (params.page - 1) * params.limit;
    const rows = await this.sql<ProviderRow[]>`
      SELECT * FROM provider_registry
      WHERE tags @> ${this.sql.json([tag])}
      ORDER BY name ASC
      LIMIT ${params.limit} OFFSET ${offset}
    `;
    return {
      data: rows.map((r) => this.rowToProvider(r)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async save(provider: Provider): Promise<void> {
    const row = this.providerToRow(provider);
    await this.sql`
      INSERT INTO provider_registry ${this.sql(row)}
      ON CONFLICT (id) DO UPDATE
      SET
        family = EXCLUDED.family,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        owner = EXCLUDED.owner,
        models = EXCLUDED.models,
        capabilities = EXCLUDED.capabilities,
        supported_modalities = EXCLUDED.supported_modalities,
        cost = EXCLUDED.cost,
        latency = EXCLUDED.latency,
        rate_limits = EXCLUDED.rate_limits,
        availability = EXCLUDED.availability,
        health = EXCLUDED.health,
        lifecycle_status = EXCLUDED.lifecycle_status,
        version = EXCLUDED.version,
        tags = EXCLUDED.tags,
        documentation_url = EXCLUDED.documentation_url,
        matrix = EXCLUDED.matrix,
        updated_at = EXCLUDED.updated_at
    `;
  }

  async update(provider: Provider): Promise<void> {
    // Bind via sql.json(): serializes exactly once for jsonb OID 3802.
    // JSON.stringify(x)::jsonb DOUBLE-encodes — a real-DB corruption bug.
    await this.sql`
      UPDATE provider_registry SET
        name = ${provider.name},
        description = ${provider.description},
        owner = ${provider.owner},
        models = ${this.sql.json([...provider.models] as unknown as JsonParam)},
        capabilities = ${this.sql.json([...provider.capabilities])},
        supported_modalities = ${this.sql.json([...provider.supportedModalities])},
        cost = ${this.sql.json(provider.cost as unknown as JsonParam)},
        latency = ${this.sql.json(provider.latency as unknown as JsonParam)},
        rate_limits = ${this.sql.json(provider.rateLimits as unknown as JsonParam)},
        availability = ${provider.availability},
        health = ${this.sql.json(provider.health as unknown as JsonParam)},
        lifecycle_status = ${provider.lifecycleStatus.value},
        version = ${provider.version.toString()},
        tags = ${this.sql.json([...provider.tags])},
        documentation_url = ${provider.documentationUrl ?? null},
        matrix = ${this.sql.json([...provider.matrix] as unknown as JsonParam)},
        updated_at = ${provider.updatedAt.toISOString()}::timestamptz
      WHERE id = ${provider.id}
    `;
  }

  async delete(id: ProviderId): Promise<void> {
    await this.sql`
      DELETE FROM provider_registry WHERE id = ${id}
    `;
  }

  async exists(id: ProviderId): Promise<boolean> {
    const rows = await this.sql<[{ exists: boolean }]>`
      SELECT EXISTS(SELECT 1 FROM provider_registry WHERE id = ${id}) AS exists
    `;
    return rows[0].exists;
  }

  // ── Search & Discovery ───────────────────────────────────────────────────

  async search(
    criteria: ProviderSearchCriteria,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Provider>> {
    const conditions: string[] = [];
    // postgres.js unsafe() parameter array — concrete JSON/primitive union that
    // satisfies ParameterOrJSON without resorting to `any`.
    const params: Array<string | number | string[] | null> = [];
    let paramIdx = 1;

    if (criteria.query?.trim()) {
      const q = `%${criteria.query.trim().toLowerCase()}%`;
      conditions.push(`(LOWER(name) LIKE $${paramIdx} OR LOWER(description) LIKE $${paramIdx})`);
      params.push(q);
      paramIdx++;
    }
    if (criteria.families && criteria.families.length > 0) {
      conditions.push(`family = ANY($${paramIdx})`);
      params.push(criteria.families);
      paramIdx++;
    }
    if (criteria.lifecycleStatuses && criteria.lifecycleStatuses.length > 0) {
      conditions.push(`lifecycle_status = ANY($${paramIdx})`);
      params.push(criteria.lifecycleStatuses);
      paramIdx++;
    }
    if (criteria.capabilities && criteria.capabilities.length > 0) {
      conditions.push(`capabilities ?| $${paramIdx}`);
      params.push(criteria.capabilities);
      paramIdx++;
    }
    if (criteria.modalities && criteria.modalities.length > 0) {
      conditions.push(`supported_modalities ?| $${paramIdx}`);
      params.push(criteria.modalities);
      paramIdx++;
    }
    if (criteria.tags && criteria.tags.length > 0) {
      conditions.push(`tags @> $${paramIdx}::jsonb`);
      params.push(JSON.stringify(criteria.tags));
      paramIdx++;
    }
    if (criteria.minHealthScore !== undefined) {
      conditions.push(`(health->>'healthScore')::numeric >= $${paramIdx}`);
      params.push(criteria.minHealthScore);
      paramIdx++;
    }
    if (criteria.minContextLength !== undefined) {
      conditions.push(
        `EXISTS (SELECT 1 FROM jsonb_array_elements(models) AS m WHERE (m->>'contextLength')::int >= $${paramIdx})`,
      );
      params.push(criteria.minContextLength);
      paramIdx++;
    }
    if (criteria.feature) {
      const featureMap: Record<string, string> = {
        streaming: 'streaming',
        vision: 'vision',
        function_calling: 'functionCalling',
        embeddings: 'embeddings',
      };
      const col = featureMap[criteria.feature];
      if (col) {
        conditions.push(
          `EXISTS (SELECT 1 FROM jsonb_array_elements(models) AS m WHERE (m->>'${col}')::boolean = true)`,
        );
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRows = await this.sql.unsafe<[{ count: number }]>(
      `SELECT COUNT(*)::int AS count FROM provider_registry ${whereClause}`,
      params,
    );
    const total = countRows[0].count;

    const offset = (pagination.page - 1) * pagination.limit;
    const allParams: Array<string | number | string[] | null> = [
      ...params,
      pagination.limit,
      offset,
    ];
    const limitIdx = paramIdx;
    const offsetIdx = paramIdx + 1;

    const rows = await this.sql.unsafe<ProviderRow[]>(
      `SELECT * FROM provider_registry ${whereClause} ORDER BY name ASC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      allParams,
    );

    return {
      data: rows.map((r) => this.rowToProvider(r)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async findSupportsCapability(capability: CapabilityType): Promise<Provider[]> {
    // Bind via sql.json(): serializes exactly once (jsonb OID 3802).
    const rows = await this.sql<ProviderRow[]>`
      SELECT * FROM provider_registry
      WHERE capabilities @> ${this.sql.json([capability])}
      ORDER BY name ASC
    `;
    return rows.map((r) => this.rowToProvider(r));
  }

  async findSupportsModality(modality: ModalityType): Promise<Provider[]> {
    // Bind via sql.json(): serializes exactly once (jsonb OID 3802).
    const rows = await this.sql<ProviderRow[]>`
      SELECT * FROM provider_registry
      WHERE supported_modalities @> ${this.sql.json([modality])}
      ORDER BY name ASC
    `;
    return rows.map((r) => this.rowToProvider(r));
  }

  async listAll(): Promise<Provider[]> {
    const rows = await this.sql<ProviderRow[]>`
      SELECT * FROM provider_registry ORDER BY name ASC
    `;
    return rows.map((r) => this.rowToProvider(r));
  }

  // ── Statistics ───────────────────────────────────────────────────────────

  async count(): Promise<number> {
    const rows = await this.sql<[{ count: number }]>`
      SELECT COUNT(*)::int AS count FROM provider_registry
    `;
    return rows[0].count;
  }

  async countByLifecycleStatus(): Promise<Record<ProviderLifecycleStatus, number>> {
    const rows = await this.sql<{ lifecycle_status: string; count: number }[]>`
      SELECT lifecycle_status, COUNT(*)::int AS count
      FROM provider_registry
      GROUP BY lifecycle_status
    `;
    const result: Record<ProviderLifecycleStatus, number> = {
      draft: 0,
      testing: 0,
      active: 0,
      maintenance: 0,
      deprecated: 0,
      archived: 0,
    };
    for (const row of rows) {
      result[row.lifecycle_status as ProviderLifecycleStatus] = row.count;
    }
    return result;
  }

  async countByFamily(): Promise<Record<ProviderFamily, number>> {
    const rows = await this.sql<{ family: string; count: number }[]>`
      SELECT family, COUNT(*)::int AS count
      FROM provider_registry
      GROUP BY family
    `;
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.family] = row.count;
    }
    return result;
  }

  async countByCapability(): Promise<Record<CapabilityType, number>> {
    const rows = await this.sql<{ capability: string; count: number }[]>`
      SELECT jsonb_array_elements_text(capabilities) AS capability, COUNT(*)::int AS count
      FROM provider_registry
      GROUP BY capability
    `;
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.capability] = row.count;
    }
    return result;
  }

  async countHealthy(): Promise<number> {
    const rows = await this.sql<[{ count: number }]>`
      SELECT COUNT(*)::int AS count
      FROM provider_registry
      WHERE (health->>'healthScore')::numeric >= 0.7
    `;
    return rows[0].count;
  }
}
