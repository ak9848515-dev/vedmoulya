// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Intelligence Pipeline: Repository Contract
// EI-006 / INT-001
// ──────────────────────────────────────────────────────────────────

import type { EnterprisePipeline } from '../../types/pipeline-types.js';
import type { PipelineId } from '../value-objects/PipelineId.js';

export interface PipelineRepository {
  save(pipeline: EnterprisePipeline): Promise<void>;
  findById(id: PipelineId): Promise<EnterprisePipeline | undefined>;
  findByGoal(goalId: string): Promise<EnterprisePipeline[]>;
  listAll(): Promise<EnterprisePipeline[]>;
  exists(id: PipelineId): Promise<boolean>;
  delete(id: PipelineId): Promise<boolean>;
}
