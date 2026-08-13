// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: DTOs
// APP-001 — Post-V1 Application Platform Layer
// JSON-safe API surface. All dates are ISO strings; all nested
// records are plain objects (tRPC-safe). Output DTOs alias the fabric
// types directly (they are already JSON-safe); input DTOs are
// validated at the tRPC boundary with zod (RouterRegistry).
// ──────────────────────────────────────────────────────────────────

import type {
  BusinessGraph,
  ContextEntity,
  ContextExplanation,
  ContextFabricPackage,
  ContextPermission,
  ContextProvenance,
  ContextRelationship,
  ContextRetrievalResult,
  FabricHealth,
  PersonalGraph,
} from '../types/fabric-types.js';

// ── Output DTOs ───────────────────────────────────────────────────

export type PersonalGraphDTO = PersonalGraph;
export type BusinessGraphDTO = BusinessGraph;
export type ContextEntityDTO = ContextEntity;
export type ContextRelationshipDTO = ContextRelationship;
export type ContextRetrievalResultDTO = ContextRetrievalResult;
export type ContextFabricPackageDTO = ContextFabricPackage;
export type ContextExplanationDTO = ContextExplanation;
export type ContextPermissionDTO = ContextPermission;
export type ContextProvenanceDTO = ContextProvenance;
export type FabricHealthDTO = FabricHealth;

export interface FabricSearchSummaryDTO {
  entityCount: number;
  relationshipCount: number;
  avgConfidence: number;
  permissionCoverage: number;
  checkedAt: string;
}

// ── Input DTOs ────────────────────────────────────────────────────

export interface FabricGraphQueryDTO {
  userId: string;
  organizationId?: string;
}

export interface FabricSearchDTO {
  userId: string;
  organizationId?: string;
  query: string;
  goalId?: string;
  projectId?: string;
  taskId?: string;
  sources?: string[];
  types?: string[];
  tags?: string[];
  minConfidence?: number;
  limit?: number;
}

export interface FabricEntityQueryDTO {
  userId: string;
  entityId: string;
}

export interface FabricRelationshipsQueryDTO {
  userId: string;
  entityId: string;
  maxDepth?: number;
}

export interface FabricPackageBuildDTO {
  userId: string;
  organizationId?: string;
  goalId?: string;
  taskId?: string;
  query: string;
  tokenBudget?: number;
}

export interface FabricExplainDTO {
  userId: string;
  entityId: string;
  goalId?: string;
  projectId?: string;
  taskId?: string;
  query?: string;
}

export interface FabricPermissionQueryDTO {
  userId: string;
  entityId: string;
  organizationId?: string;
}

export interface FabricEntityLinkDTO {
  userId: string;
  fromId: string;
  toId: string;
  type: string;
  weight?: number;
}
