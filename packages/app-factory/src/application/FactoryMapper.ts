// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Mapper
// EPIC-007 — Phase 20. Maps internal projects to the public DTOs.
// ──────────────────────────────────────────────────────────────────

import type { AppProject, NewAppProject } from '../types/app-types.js';
import type {
  FactoryApplicationDTO,
  FactoryCreateResultDTO,
  FactoryDetailDTO,
} from './FactoryDTO.js';

export const FactoryMapper = {
  toCreateResult(project: NewAppProject | AppProject): FactoryCreateResultDTO {
    return {
      applicationId: project.applicationId,
      name: project.name,
      archetype: project.archetype,
      status: 'status' in project ? project.status : 'DRAFT',
      specification: project.specification,
      architecture: project.architecture,
      taskGraph: project.taskGraph,
      unresolved: project.specification.unresolved,
    };
  },

  toApplicationDTO(project: AppProject): FactoryApplicationDTO {
    return {
      applicationId: project.applicationId,
      owner: project.owner,
      name: project.name,
      archetype: project.archetype,
      status: project.status,
      version: project.version,
      technologies: project.technologies,
      aiCapabilities: project.aiCapabilities,
      deploymentStatus: project.deploymentStatus,
      deploymentTarget: project.deploymentTarget,
      health: project.health,
      lastBuildAt: project.lastBuildAt,
      lastValidation: project.lastValidation,
      securityReport: project.securityReport,
      uiQuality: project.uiQuality,
      economics: project.economics,
      fileCount: project.files.length,
      vcOperationCount: project.vcOperations.length,
      repairAttempts: project.repairAttempts,
      repairLimit: project.repairLimit,
      repairLimitReached: project.repairLimitReached,
      terminationReason: project.terminationReason,
      error: project.error,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  },

  toDetailDTO(project: AppProject): FactoryDetailDTO {
    return {
      ...this.toApplicationDTO(project),
      specification: project.specification,
      architecture: project.architecture,
      taskGraph: project.taskGraph,
      files: project.files.map((f) => ({ path: f.path, kind: f.kind, content: f.content })),
      fileOperations: project.fileOperations,
      vcOperations: project.vcOperations,
      unresolved: project.specification.unresolved,
    };
  },
};
