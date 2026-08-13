// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: DTOs
// EPIC-007 — Phase 20. The typed public contract for the factory.* API.
// Internal engine details (ports, execution internals) are never
// exposed — the DTO is the boundary.
// ──────────────────────────────────────────────────────────────────

import type {
  AppArchetype,
  ApplicationArchitecture,
  ApplicationSpecification,
  ApplicationStatus,
  ApplicationTaskGraph,
  DeploymentResult,
  DeploymentTargetId,
  EconomicsSnapshot,
  FileOperation,
  RepairAttempt,
  SecurityReport,
  UIQualityReport,
  ValidationReport,
  VersionControlOperation,
} from '../types/app-types.js';

export interface FactoryCreateResultDTO {
  applicationId: string;
  name: string;
  archetype: AppArchetype;
  status: ApplicationStatus;
  specification: ApplicationSpecification;
  architecture: ApplicationArchitecture;
  taskGraph: ApplicationTaskGraph;
  unresolved: Array<{ label: string; reason: string }>;
}

export interface FactoryApplicationDTO {
  applicationId: string;
  owner: string;
  name: string;
  archetype: AppArchetype;
  status: ApplicationStatus;
  version: string;
  technologies: Array<{ name: string; category: string }>;
  aiCapabilities: string[];
  deploymentStatus: string;
  deploymentTarget?: DeploymentTargetId;
  health: string;
  lastBuildAt?: string;
  lastValidation?: ValidationReport;
  securityReport?: SecurityReport;
  uiQuality?: UIQualityReport;
  economics?: EconomicsSnapshot;
  fileCount: number;
  vcOperationCount: number;
  repairAttempts?: RepairAttempt[];
  repairLimit?: number;
  repairLimitReached?: boolean;
  terminationReason?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FactoryDetailDTO extends FactoryApplicationDTO {
  specification: ApplicationSpecification;
  architecture: ApplicationArchitecture;
  taskGraph: ApplicationTaskGraph;
  files: Array<{ path: string; kind: string; content: string }>;
  fileOperations: FileOperation[];
  vcOperations: VersionControlOperation[];
  unresolved: Array<{ label: string; reason: string }>;
}

export interface FactoryApproveResultDTO {
  applicationId: string;
  status: ApplicationStatus;
  approvedAt?: string;
}

export interface FactoryBuildResultDTO {
  applicationId: string;
  status: ApplicationStatus;
  validation?: ValidationReport;
  security?: SecurityReport;
  uiQuality?: UIQualityReport;
  economics?: EconomicsSnapshot;
  terminationReason?: string;
  error?: string;
}

export interface FactoryDeployResultDTO extends DeploymentResult {
  applicationId: string;
}

export type { DeploymentResult };
